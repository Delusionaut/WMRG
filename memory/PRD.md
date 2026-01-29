# Walmart Receipt Generator - PRD

## Original Problem Statement
Build a web application that generates Walmart receipts identical to actual thermal receipts. Allow for manual item entry and UPC scanning/lookup via publicly accessible database API. Auto-calculate totals and tax, and provide finished result in PDF format.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + React Router
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (for UPC caching and shared receipts)
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

## Implemented Features (Jan 29, 2026)
- [x] Split-screen layout (builder panel + live preview)
- [x] Store Details form (Type, Phone, Manager, Address, City, State, ZIP, Store#, OP#, TE#, TR#)
- [x] Items section with Add/Remove/Void functionality
- [x] UPC lookup with MongoDB caching
- [x] Tax rate input with real-time calculations
- [x] Payment details (Method, Card Last 4, Cash Back, REF#, Network ID, Approval Code, Terminal#, AID, AAC)
- [x] Transaction date/time inputs with proper spacing in receipt
- [x] Large, bold, centered "# ITEMS SOLD" display
- [x] Receipt preview with Walmart logo and barcode
- [x] Download PDF (client-side)
- [x] Generate via Server (backend PDF)
- [x] Reset form button
- [x] **Share Receipt feature** with shareable links
- [x] **Shared Receipt view** (mobile-first design with blue header)
- [x] README.md with deployment instructions

## API Endpoints
- `GET /api/` - Root endpoint
- `GET /api/health` - Health check
- `GET /api/products/lookup/{upc}` - UPC lookup with caching
- `POST /api/receipts/calculate` - Calculate receipt totals
- `POST /api/receipts/generate-pdf` - Generate PDF receipt
- `POST /api/receipts/share` - Create shareable receipt
- `GET /api/receipts/shared/{receipt_id}` - Get shared receipt

## Prioritized Backlog

### P0 (Must Have) - COMPLETED
- [x] Manual item entry
- [x] UPC lookup via API
- [x] Auto tax calculation
- [x] PDF generation
- [x] Receipt preview
- [x] Share receipt feature

### P1 (Should Have) - FUTURE
- [ ] Camera-based barcode scanning for mobile users
- [ ] Receipt templates/presets
- [ ] Expiring share links (auto-delete after X days)

### P2 (Nice to Have) - FUTURE
- [ ] Multiple tax rates per item
- [ ] Receipt history per user
- [ ] Print directly from browser

## Next Tasks
1. Camera-based barcode scanning for mobile
2. Receipt templates/presets
3. Expiring share links

## Tech Stack
- Frontend: React 19, Tailwind CSS, React Router, react-barcode, html2canvas, jsPDF, Lucide icons
- Backend: FastAPI, httpx, ReportLab, Motor (async MongoDB)
- Database: MongoDB
- Fonts: IBM Plex Sans (UI), Courier Prime (receipt)
