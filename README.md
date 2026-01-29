# Walmart Receipt Generator

A web application that generates realistic Walmart-style thermal receipts with manual item entry, UPC lookup, automatic tax calculation, and PDF export.

## Features

- **Split-screen Layout**: Builder panel on the left, live receipt preview on the right
- **Store Details Customization**: Store Type, Phone, Manager, Address, City, State, ZIP
- **Item Management**: Add, remove, void items with auto-generated UPCs
- **UPC Lookup**: Lookup product names via UPCitemdb API (with MongoDB caching)
- **Tax Calculation**: Configurable tax rate with real-time calculations
- **Payment Details**: Debit/Credit/Cash, Card info, REF#, Terminal#, etc.
- **PDF Generation**: Client-side (html2canvas + jsPDF) and server-side (ReportLab)
- **Barcode Generation**: TC# encoded barcodes
- **Share Receipt**: Shareable receipt links

## Tech Stack

- **Frontend**: React 19, Tailwind CSS, react-barcode, html2canvas, jsPDF
- **Backend**: FastAPI (Python), httpx, ReportLab
- **Database**: MongoDB (for UPC caching and shared receipts)

## Prerequisites

- Node.js 18+
- Python 3.11+
- MongoDB 6+
- Yarn package manager

## Installation & Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd walmart-receipt-generator
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Linux/Mac:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017/
DB_NAME=walmart_receipts
CORS_ORIGINS=*
EOF
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
yarn install

# Create .env file (update REACT_APP_BACKEND_URL for your server)
cat > .env << EOF
REACT_APP_BACKEND_URL=http://localhost:8001
EOF
```

### 4. Start MongoDB

```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:6

# Or if MongoDB is installed locally
mongod --dbpath /path/to/data/db
```

### 5. Run the Application

#### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
yarn start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8001/api

#### Production Mode

**Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 4
```

**Frontend (build and serve):**
```bash
cd frontend
yarn build

# Serve with nginx, Apache, or any static file server
# Example with serve:
npx serve -s build -l 3000
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/` | GET | Root endpoint |
| `/api/health` | GET | Health check |
| `/api/products/lookup/{upc}` | GET | Lookup product by UPC |
| `/api/receipts/calculate` | POST | Calculate receipt totals |
| `/api/receipts/generate-pdf` | POST | Generate PDF receipt |
| `/api/receipts/share` | POST | Create shareable receipt |
| `/api/receipts/shared/{receipt_id}` | GET | Get shared receipt |

## Environment Variables

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017/
DB_NAME=walmart_receipts
CORS_ORIGINS=*
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=http://your-server:8001
```

## Deployment Options

### Docker Compose

```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  backend:
    build: ./backend
    ports:
      - "8001:8001"
    environment:
      - MONGO_URL=mongodb://mongodb:27017/
      - DB_NAME=walmart_receipts
      - CORS_ORIGINS=*
    depends_on:
      - mongodb

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_BACKEND_URL=http://localhost:8001

volumes:
  mongo_data:
```

### Nginx Reverse Proxy (Production)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## License

MIT License
