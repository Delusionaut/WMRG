from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import httpx
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.graphics.barcode import code128

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'walmart_receipts')]

# Create the main app without a prefix
app = FastAPI(title="Walmart Receipt Generator API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== Models ==============

class ProductLookupResponse(BaseModel):
    success: bool
    upc: str
    title: Optional[str] = None
    brand: Optional[str] = None
    description: Optional[str] = None
    cached: bool = False
    message: str = ""

class ReceiptItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    upc: str = ""
    price: float
    quantity: int = 1
    is_taxable: bool = True
    tax_flag: str = "X"  # T, X, F, O, N, H
    is_voided: bool = False

class StoreDetails(BaseModel):
    store_type: str = "WM Supercenter"
    phone: str = "951-845-1529"
    manager_name: str = "JESSICA"
    address_line1: str = "1540 E 2ND ST"
    city: str = "BEAUMONT"
    state: str = "CA"
    zip_code: str = "92223"
    store_number: str = "05156"
    op_number: str = "004985"
    te_number: str = "01"
    tr_number: str = "00373"

class PaymentDetails(BaseModel):
    payment_method: str = "DEBIT"
    card_last_four: str = "2593"
    debit_tend: float = 0.0
    cash_back: float = 0.0
    ref_number: str = "512400787256"
    network_id: str = "0069"
    approval_code: str = "811595"
    aid: str = "A0000000042203"
    aac: str = "CCE1EA26C32C0D8A"
    terminal_number: str = "53026334"

class ReceiptCreate(BaseModel):
    store_details: StoreDetails
    items: List[ReceiptItem]
    tax_rate: float
    payment_details: PaymentDetails
    transaction_date: str
    transaction_time: str

# ============== UPC Lookup ==============

async def lookup_upc_from_api(upc: str) -> dict:
    """Lookup product from UPCitemdb API"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as http_client:
            response = await http_client.get(
                "https://api.upcitemdb.com/prod/trial/lookup",
                params={"upc": upc}
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("code") == "OK" and data.get("items"):
                    item = data["items"][0]
                    return {
                        "success": True,
                        "title": item.get("title", ""),
                        "brand": item.get("brand", ""),
                        "description": item.get("description", "")
                    }
            elif response.status_code == 429:
                return {"success": False, "error": "Rate limit exceeded"}
            return {"success": False, "error": "Product not found"}
    except Exception as e:
        logger.error(f"UPC lookup error: {str(e)}")
        return {"success": False, "error": str(e)}

@api_router.get("/products/lookup/{upc}", response_model=ProductLookupResponse)
async def lookup_product(upc: str, background_tasks: BackgroundTasks):
    """Lookup product by UPC with MongoDB caching"""
    # Check cache first
    cached = await db.product_cache.find_one({"upc": upc}, {"_id": 0})
    if cached:
        return ProductLookupResponse(
            success=True,
            upc=upc,
            title=cached.get("title"),
            brand=cached.get("brand"),
            description=cached.get("description"),
            cached=True,
            message="Product found in cache"
        )
    
    # Fetch from API
    result = await lookup_upc_from_api(upc)
    
    if result.get("success"):
        # Cache the result
        cache_doc = {
            "upc": upc,
            "title": result.get("title"),
            "brand": result.get("brand"),
            "description": result.get("description"),
            "cached_at": datetime.now(timezone.utc).isoformat()
        }
        background_tasks.add_task(db.product_cache.update_one, {"upc": upc}, {"$set": cache_doc}, upsert=True)
        
        return ProductLookupResponse(
            success=True,
            upc=upc,
            title=result.get("title"),
            brand=result.get("brand"),
            description=result.get("description"),
            cached=False,
            message="Product found from API"
        )
    
    return ProductLookupResponse(
        success=False,
        upc=upc,
        cached=False,
        message=result.get("error", "Product not found")
    )

# ============== Receipt Generation ==============

def generate_tc_number():
    """Generate a random TC number in Walmart format"""
    import random
    parts = [
        str(random.randint(1000, 9999)),
        str(random.randint(1000, 9999)).zfill(4),
        str(random.randint(1000, 9999)),
        str(random.randint(1000, 9999)),
        str(random.randint(1000, 9999))
    ]
    return " ".join(parts)

@api_router.post("/receipts/calculate")
async def calculate_receipt(data: ReceiptCreate):
    """Calculate receipt totals"""
    subtotal = 0.0
    item_count = 0
    
    for item in data.items:
        if not item.is_voided:
            subtotal += item.price * item.quantity
            item_count += item.quantity
    
    taxable_total = sum(
        item.price * item.quantity 
        for item in data.items 
        if item.is_taxable and not item.is_voided
    )
    tax_amount = round(taxable_total * (data.tax_rate / 100), 2)
    total = round(subtotal + tax_amount, 2)
    
    # Calculate payment
    debit_tend = total
    total_debit_purchase = total + data.payment_details.cash_back
    change_due = data.payment_details.cash_back
    
    tc_number = generate_tc_number()
    
    return {
        "subtotal": round(subtotal, 2),
        "tax_amount": round(tax_amount, 2),
        "total": total,
        "item_count": item_count,
        "debit_tend": debit_tend,
        "total_debit_purchase": round(total_debit_purchase, 2),
        "change_due": round(change_due, 2),
        "tc_number": tc_number
    }

@api_router.post("/receipts/generate-pdf")
async def generate_receipt_pdf(data: ReceiptCreate):
    """Generate PDF receipt"""
    # Calculate totals
    subtotal = 0.0
    item_count = 0
    
    for item in data.items:
        if not item.is_voided:
            subtotal += item.price * item.quantity
            item_count += item.quantity
    
    taxable_total = sum(
        item.price * item.quantity 
        for item in data.items 
        if item.is_taxable and not item.is_voided
    )
    tax_amount = round(taxable_total * (data.tax_rate / 100), 2)
    total = round(subtotal + tax_amount, 2)
    
    debit_tend = total
    total_debit_purchase = total + data.payment_details.cash_back
    change_due = data.payment_details.cash_back
    
    tc_number = generate_tc_number()
    
    # Create PDF
    buffer = BytesIO()
    width = 80 * mm  # 80mm thermal paper width
    
    # Calculate height based on content
    base_height = 200 * mm
    item_height = len(data.items) * 4 * mm
    height = base_height + item_height
    
    c = canvas.Canvas(buffer, pagesize=(width, height))
    
    # Set up fonts - use Courier for monospace receipt look
    c.setFont("Courier-Bold", 14)
    
    y = height - 10 * mm
    center_x = width / 2
    
    # Walmart Logo Text
    c.drawCentredString(center_x, y, "Walmart")
    y -= 5 * mm
    c.setFont("Courier", 8)
    c.drawCentredString(center_x, y, "Save money. Live better.")
    y -= 6 * mm
    
    # Store info
    c.drawCentredString(center_x, y, data.store_details.store_type)
    y -= 4 * mm
    c.drawCentredString(center_x, y, f"{data.store_details.phone} Mgr:{data.store_details.manager_name}")
    y -= 4 * mm
    c.drawCentredString(center_x, y, data.store_details.address_line1)
    y -= 4 * mm
    c.drawCentredString(center_x, y, f"{data.store_details.city} {data.store_details.state} {data.store_details.zip_code}")
    y -= 5 * mm
    
    # Store numbers
    st_line = f"ST# {data.store_details.store_number} OP# {data.store_details.op_number} TE# {data.store_details.te_number} TR# {data.store_details.tr_number}"
    c.drawCentredString(center_x, y, st_line)
    y -= 6 * mm
    
    # Items
    c.setFont("Courier", 7)
    left_margin = 3 * mm
    right_margin = width - 3 * mm
    
    for item in data.items:
        if item.is_voided:
            c.drawString(left_margin, y, "  ** VOIDED ENTRY **")
            y -= 3.5 * mm
        
        # Item name and UPC
        name_upc = f"{item.name[:14].upper():<14} {item.upc}"
        c.drawString(left_margin, y, name_upc)
        
        # Price and tax flag
        price_str = f"{item.price:.2f}"
        flag_str = item.tax_flag
        if item.is_voided:
            price_str = f"{item.price:.2f}-"
            flag_str = f"{item.tax_flag}"
        c.drawRightString(right_margin, y, f"{price_str} {flag_str}")
        y -= 3.5 * mm
        
        # Handle quantity > 1
        if item.quantity > 1 and not item.is_voided:
            qty_line = f"    {item.quantity} AT    1 FOR       {item.price:.2f}"
            c.drawString(left_margin, y, qty_line)
            total_price = item.price * item.quantity
            c.drawRightString(right_margin, y, f"{total_price:.2f} O")
            y -= 3.5 * mm
    
    y -= 2 * mm
    
    # Subtotal
    c.setFont("Courier", 8)
    c.drawRightString(right_margin - 20 * mm, y, "SUBTOTAL")
    c.drawRightString(right_margin, y, f"{subtotal:.2f}")
    y -= 4 * mm
    
    # Tax
    c.drawRightString(right_margin - 20 * mm, y, f"TAX 1    {data.tax_rate:.3f} %")
    c.drawRightString(right_margin, y, f"{tax_amount:.2f}")
    y -= 4 * mm
    
    # Total
    c.drawRightString(right_margin - 20 * mm, y, "TOTAL")
    c.drawRightString(right_margin, y, f"{total:.2f}")
    y -= 5 * mm
    
    # Payment details
    c.drawRightString(right_margin - 20 * mm, y, f"{data.payment_details.payment_method}    TEND")
    c.drawRightString(right_margin, y, f"{debit_tend:.2f}")
    y -= 4 * mm
    
    if data.payment_details.cash_back > 0:
        c.drawRightString(right_margin - 20 * mm, y, "DEBIT CASH BACK")
        c.drawRightString(right_margin, y, f"{data.payment_details.cash_back:.2f}")
        y -= 4 * mm
        
        c.drawRightString(right_margin - 20 * mm, y, "TOTAL DEBIT PURCHASE")
        c.drawRightString(right_margin, y, f"{total_debit_purchase:.2f}")
        y -= 4 * mm
        
        c.drawRightString(right_margin - 20 * mm, y, "CHANGE DUE")
        c.drawRightString(right_margin, y, f"{change_due:.2f}")
        y -= 5 * mm
    
    # EFT Details
    c.setFont("Courier", 7)
    c.drawString(left_margin, y, f"EFT {data.payment_details.payment_method}")
    c.drawRightString(right_margin, y, "PAY FROM PRIMARY")
    y -= 3.5 * mm
    
    c.drawString(left_margin + 5 * mm, y, f"{debit_tend:.2f}")
    c.drawCentredString(center_x, y, "PURCHASE")
    y -= 3.5 * mm
    
    if data.payment_details.cash_back > 0:
        c.drawString(left_margin + 5 * mm, y, f"{data.payment_details.cash_back:.2f}")
        c.drawCentredString(center_x, y, "CASH BACK")
        y -= 3.5 * mm
        
        c.drawString(left_margin + 5 * mm, y, f"{total_debit_purchase:.2f}")
        c.drawCentredString(center_x, y, "TOTAL PURCHASE")
        y -= 3.5 * mm
    
    # Card info
    c.drawString(left_margin, y, f"Debit              **** **** **** {data.payment_details.card_last_four} I O")
    y -= 3.5 * mm
    
    c.drawString(left_margin, y, f"REF # {data.payment_details.ref_number}")
    y -= 3.5 * mm
    
    c.drawString(left_margin, y, f"NETWORK ID. {data.payment_details.network_id} APPR CODE {data.payment_details.approval_code}")
    y -= 3.5 * mm
    
    c.drawString(left_margin, y, "Debit")
    y -= 3.5 * mm
    
    c.drawString(left_margin, y, f"AID {data.payment_details.aid}")
    y -= 3.5 * mm
    
    c.drawString(left_margin, y, f"AAC {data.payment_details.aac}")
    y -= 3.5 * mm
    
    c.drawString(left_margin, y, "*Pin Verified")
    y -= 3.5 * mm
    
    c.drawString(left_margin, y, f"TERMINAL # {data.payment_details.terminal_number}")
    y -= 5 * mm
    
    # Date/Time and items sold
    c.setFont("Courier", 8)
    c.drawCentredString(center_x, y, f"{data.transaction_date}     {data.transaction_time}")
    y -= 4 * mm
    c.drawCentredString(center_x, y, f"# ITEMS SOLD {item_count}")
    y -= 5 * mm
    
    # TC number
    c.drawCentredString(center_x, y, f"TC# {tc_number}")
    y -= 8 * mm
    
    # Barcode
    try:
        tc_for_barcode = tc_number.replace(" ", "")
        barcode = code128.Code128(tc_for_barcode, barHeight=12*mm, barWidth=0.4)
        barcode.drawOn(c, center_x - barcode.width/2, y - 12*mm)
        y -= 18 * mm
    except Exception as e:
        logger.error(f"Barcode generation error: {e}")
        y -= 5 * mm
    
    # Footer
    c.setFont("Courier", 8)
    c.drawCentredString(center_x, y, "Low Prices You Can Trust. Every Day.")
    y -= 4 * mm
    c.drawCentredString(center_x, y, f"{data.transaction_date}     {data.transaction_time}")
    
    c.save()
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=walmart_receipt_{tc_number.replace(' ', '_')}.pdf"}
    )

# ============== Basic Routes ==============

@api_router.get("/")
async def root():
    """Root endpoint for the API."""
    return {"message": "Walmart Receipt Generator API"}

@api_router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

# Include the router in the main app
app.include_router(api_router)

# CORS Middleware configuration
origins = os.environ.get('CORS_ORIGINS', '*').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shutdown event for the MongoDB client
@app.on_event("shutdown")
async def shutdown_db_client():
    """Close the MongoDB client connection on application shutdown."""
    client.close()
    logger.info("MongoDB client closed.")

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Walmart Receipt Generator API server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
