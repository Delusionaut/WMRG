# Walmart Receipt Generator - PRD

## Original Problem Statement
Build a web application that generates Walmart receipts identical to actual thermal receipts. Allow for manual item entry and UPC scanning/lookup via publicly accessible database API. Auto-calculate totals and tax, and provide finished result in PDF format.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + React Router + @zxing/browser (barcode scanning)
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (for UPC caching, saved receipts, shared receipts)
- **PDF Generation**: 
  - Client-side: html2canvas + jsPDF
  - Server-side: ReportLab

## User Personas
1. **General Users**: Create/recreate receipts for expense reporting, returns, records
2. **Small Businesses**: Generate receipt templates without dedicated POS
3. **Developers/QA**: Test receipt processing systems

## Core Requirements (Static)
- ✅ Manual item entry with Name, UPC, Price, Tax Flag
- ✅ UPC lookup via UPCitemdb API
- ✅ Auto tax calculation
- ✅ Live receipt preview with thermal paper styling
- ✅ PDF generation (client & server)
- ✅ Store details customization
- ✅ Payment details section
- ✅ Barcode generation (TC#)
- ✅ Reset/Clear functionality
- ✅ Share receipt feature with unique links
- ✅ Camera-based barcode scanning
- ✅ Save/Load receipts to database

## Implemented Features (Jan 29, 2026)
- [x] Split-screen layout (builder panel + live preview)
- [x] Store Details form (Type, Phone, Manager, Address, City, State, ZIP, Store#, OP#, TE#, TR#)
- [x] Items section with Add/Remove/Void functionality
- [x] UPC lookup with MongoDB caching
- [x] **Camera barcode scanning** - Scan barcodes with phone camera
- [x] Tax rate input with real-time calculations
- [x] Payment details (Method, Card Last 4, Cash Back, REF#, Network ID, etc.)
- [x] Transaction date/time inputs
- [x] Large, bold, centered "# ITEMS SOLD" display
- [x] Receipt preview with Walmart logo and barcode
- [x] Download PDF (client-side)
- [x] Generate via Server (backend PDF)
- [x] Reset form button
- [x] **Save Receipt** - Save receipts to database with custom names
- [x] **Load Receipt** - Load previously saved receipts
- [x] **Share Receipt** - Shareable links with mobile-first view
- [x] README.md with deployment instructions

## API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/` | GET | Root endpoint |
| `/api/health` | GET | Health check |
| `/api/products/lookup/{upc}` | GET | UPC lookup with caching |
| `/api/receipts/calculate` | POST | Calculate receipt totals |
| `/api/receipts/generate-pdf` | POST | Generate PDF receipt |
| `/api/receipts/share` | POST | Create shareable receipt |
| `/api/receipts/shared/{id}` | GET | Get shared receipt |
| `/api/receipts/save` | POST | Save receipt to database |
| `/api/receipts/saved` | GET | List all saved receipts |
| `/api/receipts/saved/{id}` | GET | Get saved receipt |
| `/api/receipts/saved/{id}` | PUT | Update saved receipt |
| `/api/receipts/saved/{id}` | DELETE | Delete saved receipt |

## Prioritized Backlog

### P0 (Must Have) - COMPLETED
- [x] Manual item entry
- [x] UPC lookup via API
- [x] Auto tax calculation
- [x] PDF generation
- [x] Receipt preview
- [x] Share receipt feature
- [x] Camera barcode scanning
- [x] Save/Load receipts

### P1 (Should Have) - FUTURE
- [ ] Receipt templates/presets
- [ ] Expiring share links (auto-delete after X days)
- [ ] User authentication

### P2 (Nice to Have) - FUTURE
- [ ] Multiple tax rates per item
- [ ] Batch item import from CSV
- [ ] Print directly from browser
- [ ] QR codes on receipts

## Next Tasks
1. Receipt templates/presets
2. Expiring share links
3. User authentication

## Tech Stack
- Frontend: React 19, Tailwind CSS, React Router, @zxing/browser, react-barcode, html2canvas, jsPDF, Lucide icons
- Backend: FastAPI, httpx, ReportLab, Motor (async MongoDB)
- Database: MongoDB
- Fonts: IBM Plex Sans (UI), Courier Prime (receipt)
