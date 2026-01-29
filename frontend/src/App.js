import React, { useState, useCallback, useRef, useEffect } from "react";
import { BrowserRouter, Routes, Route, useParams, useNavigate } from "react-router-dom";
import "./App.css";
import axios from "axios";
import Barcode from "react-barcode";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { BrowserMultiFormatReader } from "@zxing/browser";
import {
  Store,
  Package,
  CreditCard,
  Calculator,
  Plus,
  Trash2,
  Search,
  Download,
  RotateCcw,
  Loader2,
  Check,
  X,
  FileText,
  Share2,
  ChevronLeft,
  Upload,
  Camera,
  Save,
  FolderOpen,
  Edit3,
  Clock
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Default values
const defaultStoreDetails = {
  store_type: "WM Supercenter",
  phone: "951-845-1529",
  manager_name: "JESSICA",
  address_line1: "1540 E 2ND ST",
  city: "BEAUMONT",
  state: "CA",
  zip_code: "92223",
  store_number: "05156",
  op_number: "004985",
  te_number: "01",
  tr_number: "00373"
};

const defaultPaymentDetails = {
  payment_method: "DEBIT",
  card_last_four: "2593",
  cash_back: 80.00,
  ref_number: "512400787256",
  network_id: "0069",
  approval_code: "811595",
  aid: "A0000000042203",
  aac: "CCE1EA26C32C0D8A",
  terminal_number: "53026334"
};

// Walmart logo URL for receipt
const WALMART_LOGO_URL = "/walmart-logo.png";

const generateId = () => Math.random().toString(36).substr(2, 9);

// Generate realistic UPC code (12 digits with valid check digit)
const generateUPC = () => {
  const digits = [];
  // Generate first 11 random digits
  for (let i = 0; i < 11; i++) {
    digits.push(Math.floor(Math.random() * 10));
  }
  // Calculate check digit (UPC-A algorithm)
  let oddSum = 0;
  let evenSum = 0;
  for (let i = 0; i < 11; i++) {
    if (i % 2 === 0) {
      oddSum += digits[i];
    } else {
      evenSum += digits[i];
    }
  }
  const checkDigit = (10 - ((oddSum * 3 + evenSum) % 10)) % 10;
  digits.push(checkDigit);
  return digits.join('');
};

const generateTcNumber = () => {
  const parts = [
    Math.floor(1000 + Math.random() * 9000),
    Math.floor(1000 + Math.random() * 9000).toString().padStart(4, '0'),
    Math.floor(1000 + Math.random() * 9000),
    Math.floor(1000 + Math.random() * 9000),
    Math.floor(1000 + Math.random() * 9000)
  ];
  return parts.join(" ");
};

const getCurrentDateTime = () => {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit'
  }).replace(/\//g, '/');
  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return { date, time };
};

function ReceiptBuilder() {
  const navigate = useNavigate();
  const [storeDetails, setStoreDetails] = useState(defaultStoreDetails);
  const [items, setItems] = useState([]);
  const [taxRate, setTaxRate] = useState(7.750);
  const [paymentDetails, setPaymentDetails] = useState(defaultPaymentDetails);
  const [tcNumber, setTcNumber] = useState(generateTcNumber());
  const [dateTime, setDateTime] = useState(getCurrentDateTime());
  const [upcLookupStatus, setUpcLookupStatus] = useState({});
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scannerItemId, setScannerItemId] = useState(null);
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  
  // Save/Load state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [receiptName, setReceiptName] = useState("");
  const [savedReceipts, setSavedReceipts] = useState([]);
  const [currentReceiptId, setCurrentReceiptId] = useState(null);
  const [loadingReceipts, setLoadingReceipts] = useState(false);

  const receiptRef = useRef(null);

  // Calculate totals
  const calculateTotals = useCallback(() => {
    let subtotal = 0;
    let itemCount = 0;
    let taxableTotal = 0;

    items.forEach(item => {
      if (!item.is_voided) {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        itemCount += item.quantity;
        if (item.is_taxable) {
          taxableTotal += itemTotal;
        }
      }
    });

    const taxAmount = Math.round(taxableTotal * (taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;
    const debitTend = total;
    const totalDebitPurchase = Math.round((total + paymentDetails.cash_back) * 100) / 100;
    const changeDue = paymentDetails.cash_back;

    return {
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2),
      itemCount,
      debitTend: debitTend.toFixed(2),
      totalDebitPurchase: totalDebitPurchase.toFixed(2),
      changeDue: changeDue.toFixed(2)
    };
  }, [items, taxRate, paymentDetails.cash_back]);

  const totals = calculateTotals();

  // Add new item
  const addItem = () => {
    const newItem = {
      id: generateId(),
      name: "",
      upc: generateUPC(),
      price: 0,
      quantity: 1,
      is_taxable: true,
      tax_flag: "X",
      is_voided: false
    };
    setItems([...items, newItem]);
  };

  // Update item
  const updateItem = (id, field, value) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // Remove item
  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  // Toggle void
  const toggleVoid = (id) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, is_voided: !item.is_voided } : item
    ));
  };

  // UPC Lookup
  const lookupUpc = async (itemId, upc) => {
    if (!upc || upc.length < 8) return;

    setUpcLookupStatus(prev => ({ ...prev, [itemId]: 'loading' }));

    try {
      const response = await axios.get(`${API}/products/lookup/${upc}`);
      if (response.data.success && response.data.title) {
        updateItem(itemId, 'name', response.data.title.substring(0, 14));
        setUpcLookupStatus(prev => ({ ...prev, [itemId]: 'success' }));
      } else {
        setUpcLookupStatus(prev => ({ ...prev, [itemId]: 'not_found' }));
      }
    } catch (error) {
      console.error('UPC lookup error:', error);
      setUpcLookupStatus(prev => ({ ...prev, [itemId]: 'error' }));
    }

    setTimeout(() => {
      setUpcLookupStatus(prev => ({ ...prev, [itemId]: null }));
    }, 3000);
  };

  // Generate PDF using html2canvas + jspdf - 80mm width thermal receipt
  const generatePdfClient = async () => {
    if (!receiptRef.current) return;

    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true
      });

      const imgData = canvas.toDataURL('image/png');
      // 80mm width for thermal receipt, height proportional
      const pdfWidth = 80;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`walmart_receipt_${tcNumber.replace(/ /g, '_')}.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error generating PDF. Please try again.');
    }
    setIsGeneratingPdf(false);
  };

  // Generate PDF via backend
  const generatePdfBackend = async () => {
    setIsGeneratingPdf(true);
    try {
      const response = await axios.post(`${API}/receipts/generate-pdf`, {
        store_details: storeDetails,
        items: items,
        tax_rate: taxRate,
        payment_details: paymentDetails,
        transaction_date: dateTime.date,
        transaction_time: dateTime.time
      }, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `walmart_receipt_${tcNumber.replace(/ /g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error generating PDF. Please try again.');
    }
    setIsGeneratingPdf(false);
  };

  // Share receipt
  const shareReceipt = async () => {
    if (items.length === 0) {
      alert('Please add at least one item to share the receipt.');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const totalsData = calculateTotals();
      const response = await axios.post(`${API}/receipts/share`, {
        store_details: storeDetails,
        items: items,
        tax_rate: taxRate,
        payment_details: paymentDetails,
        transaction_date: dateTime.date,
        transaction_time: dateTime.time,
        tc_number: tcNumber,
        totals: {
          subtotal: totalsData.subtotal,
          tax_amount: totalsData.taxAmount,
          total: totalsData.total,
          item_count: totalsData.itemCount,
          debit_tend: totalsData.debitTend,
          total_debit_purchase: totalsData.totalDebitPurchase,
          change_due: totalsData.changeDue
        }
      });

      const receiptId = response.data.receipt_id;
      const shareUrl = `${window.location.origin}/receipt/${receiptId}`;
      
      // Try native share, fallback to clipboard
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Walmart Receipt',
            text: 'View my Walmart receipt',
            url: shareUrl
          });
        } catch (err) {
          navigator.clipboard.writeText(shareUrl);
          alert(`Link copied to clipboard!\n${shareUrl}`);
        }
      } else {
        navigator.clipboard.writeText(shareUrl);
        alert(`Link copied to clipboard!\n${shareUrl}`);
      }
    } catch (error) {
      console.error('Share error:', error);
      alert('Error sharing receipt. Please try again.');
    }
    setIsGeneratingPdf(false);
  };

  // Reset form
  const resetForm = () => {
    setStoreDetails(defaultStoreDetails);
    setItems([]);
    setTaxRate(7.750);
    setPaymentDetails(defaultPaymentDetails);
    setTcNumber(generateTcNumber());
    setDateTime(getCurrentDateTime());
    setCurrentReceiptId(null);
    setReceiptName("");
  };

  // ============== Barcode Scanner ==============
  const startScanner = async (itemId) => {
    setScannerItemId(itemId);
    setShowScanner(true);
    
    try {
      codeReaderRef.current = new BrowserMultiFormatReader();
      const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
      
      if (videoInputDevices.length === 0) {
        alert('No camera found. Please ensure camera permissions are granted.');
        setShowScanner(false);
        return;
      }
      
      // Prefer back camera on mobile
      const backCamera = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear')
      );
      const deviceId = backCamera ? backCamera.deviceId : videoInputDevices[0].deviceId;
      
      await codeReaderRef.current.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result, error) => {
          if (result) {
            const scannedUpc = result.getText();
            updateItem(itemId, 'upc', scannedUpc);
            lookupUpc(itemId, scannedUpc);
            stopScanner();
          }
        }
      );
    } catch (error) {
      console.error('Scanner error:', error);
      alert('Error accessing camera. Please check permissions.');
      setShowScanner(false);
    }
  };

  const stopScanner = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    setShowScanner(false);
    setScannerItemId(null);
  };

  // ============== Save/Load Receipts ==============
  const fetchSavedReceipts = async () => {
    setLoadingReceipts(true);
    try {
      const response = await axios.get(`${API}/receipts/saved`);
      setSavedReceipts(response.data.receipts);
    } catch (error) {
      console.error('Error fetching receipts:', error);
    }
    setLoadingReceipts(false);
  };

  const saveReceipt = async () => {
    if (!receiptName.trim()) {
      alert('Please enter a name for this receipt.');
      return;
    }

    try {
      const receiptData = {
        name: receiptName,
        store_details: storeDetails,
        items: items,
        tax_rate: taxRate,
        payment_details: paymentDetails,
        transaction_date: dateTime.date,
        transaction_time: dateTime.time,
        tc_number: tcNumber
      };

      if (currentReceiptId) {
        await axios.put(`${API}/receipts/saved/${currentReceiptId}`, receiptData);
        alert('Receipt updated successfully!');
      } else {
        const response = await axios.post(`${API}/receipts/save`, receiptData);
        setCurrentReceiptId(response.data.receipt_id);
        alert('Receipt saved successfully!');
      }
      setShowSaveModal(false);
    } catch (error) {
      console.error('Save error:', error);
      alert('Error saving receipt. Please try again.');
    }
  };

  const loadReceipt = async (receiptId) => {
    try {
      const response = await axios.get(`${API}/receipts/saved/${receiptId}`);
      const data = response.data;
      
      setStoreDetails(data.store_details);
      setItems(data.items.map(item => ({ ...item, id: item.id || generateId() })));
      setTaxRate(data.tax_rate);
      setPaymentDetails(data.payment_details);
      setDateTime({ date: data.transaction_date, time: data.transaction_time });
      setTcNumber(data.tc_number);
      setCurrentReceiptId(receiptId);
      setReceiptName(data.name);
      
      setShowLoadModal(false);
    } catch (error) {
      console.error('Load error:', error);
      alert('Error loading receipt. Please try again.');
    }
  };

  const deleteReceipt = async (receiptId) => {
    if (!window.confirm('Are you sure you want to delete this receipt?')) return;
    
    try {
      await axios.delete(`${API}/receipts/saved/${receiptId}`);
      fetchSavedReceipts();
      if (currentReceiptId === receiptId) {
        setCurrentReceiptId(null);
        setReceiptName("");
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Error deleting receipt. Please try again.');
    }
  };

  const openLoadModal = () => {
    fetchSavedReceipts();
    setShowLoadModal(true);
  };

  return (
    <div className="app-container">
      {/* Barcode Scanner Modal */}
      {showScanner && (
        <div className="scanner-modal" data-testid="scanner-modal">
          <div className="scanner-container">
            <div className="scanner-header">
              <h3>Scan Barcode</h3>
              <button onClick={stopScanner} className="close-btn" data-testid="close-scanner-btn">
                <X size={24} />
              </button>
            </div>
            <div className="scanner-video-container">
              <video ref={videoRef} className="scanner-video" />
              <div className="scanner-overlay">
                <div className="scanner-target"></div>
              </div>
            </div>
            <p className="scanner-hint">Point camera at barcode</p>
          </div>
        </div>
      )}

      {/* Save Receipt Modal */}
      {showSaveModal && (
        <div className="modal-overlay" data-testid="save-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3><Save size={20} /> Save Receipt</h3>
              <button onClick={() => setShowSaveModal(false)} className="close-btn">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <label className="form-label">Receipt Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Grocery Shopping 01/29"
                value={receiptName}
                onChange={(e) => setReceiptName(e.target.value)}
                data-testid="receipt-name-input"
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSaveModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveReceipt} data-testid="confirm-save-btn">
                <Save size={16} />
                {currentReceiptId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Receipt Modal */}
      {showLoadModal && (
        <div className="modal-overlay" data-testid="load-modal">
          <div className="modal-content modal-lg">
            <div className="modal-header">
              <h3><FolderOpen size={20} /> Load Receipt</h3>
              <button onClick={() => setShowLoadModal(false)} className="close-btn">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {loadingReceipts ? (
                <div className="text-center py-8">
                  <Loader2 size={32} className="animate-spin mx-auto text-blue-600" />
                </div>
              ) : savedReceipts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FolderOpen size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No saved receipts</p>
                </div>
              ) : (
                <div className="receipt-list">
                  {savedReceipts.map((receipt) => (
                    <div key={receipt.receipt_id} className="receipt-list-item" data-testid={`receipt-item-${receipt.receipt_id}`}>
                      <div className="receipt-list-info">
                        <span className="receipt-list-name">{receipt.name}</span>
                        <span className="receipt-list-date">
                          <Clock size={12} /> {receipt.transaction_date}
                        </span>
                      </div>
                      <div className="receipt-list-actions">
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => loadReceipt(receipt.receipt_id)}
                          data-testid={`load-receipt-${receipt.receipt_id}`}
                        >
                          <FolderOpen size={14} /> Load
                        </button>
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteReceipt(receipt.receipt_id)}
                          data-testid={`delete-receipt-${receipt.receipt_id}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="header-logo">
          <span className="spark">✦</span>
          <h1>Walmart Receipt Generator</h1>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-secondary"
            onClick={openLoadModal}
            data-testid="load-receipt-btn"
          >
            <FolderOpen size={16} />
            Load
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowSaveModal(true)}
            data-testid="save-receipt-btn"
          >
            <Save size={16} />
            Save
          </button>
          <button
            className="btn btn-secondary"
            onClick={resetForm}
            data-testid="reset-form-btn"
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      </header>

      <div className="main-content">
        {/* Builder Panel */}
        <div className="builder-panel">
          {/* Store Details Section */}
          <div className="form-section">
            <h3 className="form-section-title">
              <Store size={18} />
              Store Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Store Type</label>
                <input
                  type="text"
                  className="form-input form-input-sm"
                  value={storeDetails.store_type}
                  onChange={(e) => setStoreDetails({...storeDetails, store_type: e.target.value})}
                  data-testid="store-type-input"
                />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input
                  type="text"
                  className="form-input form-input-sm"
                  value={storeDetails.phone}
                  onChange={(e) => setStoreDetails({...storeDetails, phone: e.target.value})}
                  data-testid="store-phone-input"
                />
              </div>
              <div>
                <label className="form-label">Manager Name</label>
                <input
                  type="text"
                  className="form-input form-input-sm"
                  value={storeDetails.manager_name}
                  onChange={(e) => setStoreDetails({...storeDetails, manager_name: e.target.value})}
                  data-testid="store-manager-input"
                />
              </div>
              <div>
                <label className="form-label">Address</label>
                <input
                  type="text"
                  className="form-input form-input-sm"
                  value={storeDetails.address_line1}
                  onChange={(e) => setStoreDetails({...storeDetails, address_line1: e.target.value})}
                  data-testid="store-address-input"
                />
              </div>
              <div>
                <label className="form-label">City</label>
                <input
                  type="text"
                  className="form-input form-input-sm"
                  value={storeDetails.city}
                  onChange={(e) => setStoreDetails({...storeDetails, city: e.target.value})}
                  data-testid="store-city-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="form-label">State</label>
                  <input
                    type="text"
                    className="form-input form-input-sm"
                    value={storeDetails.state}
                    onChange={(e) => setStoreDetails({...storeDetails, state: e.target.value})}
                    data-testid="store-state-input"
                  />
                </div>
                <div>
                  <label className="form-label">ZIP</label>
                  <input
                    type="text"
                    className="form-input form-input-sm"
                    value={storeDetails.zip_code}
                    onChange={(e) => setStoreDetails({...storeDetails, zip_code: e.target.value})}
                    data-testid="store-zip-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="form-section">
            <div className="flex justify-between items-center mb-3">
              <h3 className="form-section-title mb-0">
                <Package size={18} />
                Items
              </h3>
              <button
                className="btn btn-primary btn-sm"
                onClick={addItem}
                data-testid="add-item-btn"
              >
                <Plus size={14} />
                Add Item
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package size={32} className="mx-auto mb-2 opacity-50" />
                <p>No items added yet</p>
                <p className="text-sm">Click "Add Item" to start</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className={`item-row ${item.is_voided ? 'voided' : ''}`}
                    data-testid={`item-row-${index}`}
                  >
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <label className="form-label">Item Name</label>
                        <input
                          type="text"
                          className="form-input form-input-sm"
                          placeholder="CHERRY COKE"
                          value={item.name}
                          onChange={(e) => updateItem(item.id, 'name', e.target.value.toUpperCase())}
                          maxLength={14}
                          data-testid={`item-name-input-${index}`}
                        />
                      </div>
                      <div className="col-span-4">
                        <label className="form-label flex items-center gap-1">
                          UPC
                          {upcLookupStatus[item.id] === 'loading' && (
                            <Loader2 size={12} className="animate-spin text-yellow-600" />
                          )}
                          {upcLookupStatus[item.id] === 'success' && (
                            <Check size={12} className="text-green-600" />
                          )}
                          {upcLookupStatus[item.id] === 'error' && (
                            <X size={12} className="text-red-600" />
                          )}
                        </label>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            className="form-input form-input-sm mono-font flex-1"
                            placeholder="004900054961"
                            value={item.upc}
                            onChange={(e) => updateItem(item.id, 'upc', e.target.value)}
                            data-testid={`item-upc-input-${index}`}
                          />
                          <button
                            className="btn btn-secondary btn-icon btn-sm"
                            onClick={() => startScanner(item.id)}
                            title="Scan Barcode"
                            data-testid={`item-scan-btn-${index}`}
                          >
                            <Camera size={14} />
                          </button>
                          <button
                            className="btn btn-secondary btn-icon btn-sm"
                            onClick={() => lookupUpc(item.id, item.upc)}
                            title="Lookup UPC"
                            data-testid={`item-lookup-btn-${index}`}
                          >
                            <Search size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="form-label">Price</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-input form-input-sm"
                          placeholder="1.62"
                          value={item.price || ''}
                          onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                          data-testid={`item-price-input-${index}`}
                        />
                      </div>
                      <div className="col-span-2 flex gap-1">
                        <select
                          className="form-input form-input-sm"
                          value={item.tax_flag}
                          onChange={(e) => {
                            updateItem(item.id, 'tax_flag', e.target.value);
                            updateItem(item.id, 'is_taxable', ['T', 'X'].includes(e.target.value));
                          }}
                          data-testid={`item-tax-flag-${index}`}
                        >
                          <option value="X">X</option>
                          <option value="T">T</option>
                          <option value="F">F</option>
                          <option value="O">O</option>
                          <option value="N">N</option>
                        </select>
                        <button
                          className="btn btn-icon btn-sm"
                          style={{ background: item.is_voided ? '#059669' : '#FEE2E2', color: item.is_voided ? 'white' : '#DC2626' }}
                          onClick={() => toggleVoid(item.id)}
                          title={item.is_voided ? 'Unvoid' : 'Void'}
                          data-testid={`item-void-btn-${index}`}
                        >
                          {item.is_voided ? <Check size={14} /> : <X size={14} />}
                        </button>
                        <button
                          className="btn btn-danger btn-icon btn-sm"
                          onClick={() => removeItem(item.id)}
                          title="Remove"
                          data-testid={`item-remove-btn-${index}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {item.quantity > 1 && (
                      <div className="mt-2 text-xs text-gray-500">
                        Qty: {item.quantity} @ ${item.price.toFixed(2)} each
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tax Section */}
          <div className="form-section">
            <h3 className="form-section-title">
              <Calculator size={18} />
              Tax Rate
            </h3>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.001"
                className="form-input w-32"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                data-testid="tax-rate-input"
              />
              <span className="text-gray-500">%</span>
            </div>
          </div>

          {/* Payment Details Section */}
          <div className="form-section">
            <h3 className="form-section-title">
              <CreditCard size={18} />
              Payment Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Payment Method</label>
                <select
                  className="form-input form-input-sm"
                  value={paymentDetails.payment_method}
                  onChange={(e) => setPaymentDetails({...paymentDetails, payment_method: e.target.value})}
                  data-testid="payment-method-select"
                >
                  <option value="DEBIT">DEBIT</option>
                  <option value="CREDIT">CREDIT</option>
                  <option value="CASH">CASH</option>
                </select>
              </div>
              <div>
                <label className="form-label">Card Last 4</label>
                <input
                  type="text"
                  className="form-input form-input-sm mono-font"
                  maxLength={4}
                  value={paymentDetails.card_last_four}
                  onChange={(e) => setPaymentDetails({...paymentDetails, card_last_four: e.target.value})}
                  data-testid="card-last-four-input"
                />
              </div>
              <div>
                <label className="form-label">Cash Back</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input form-input-sm"
                  value={paymentDetails.cash_back}
                  onChange={(e) => setPaymentDetails({...paymentDetails, cash_back: parseFloat(e.target.value) || 0})}
                  data-testid="cash-back-input"
                />
              </div>
              <div>
                <label className="form-label">REF #</label>
                <input
                  type="text"
                  className="form-input form-input-sm mono-font"
                  value={paymentDetails.ref_number}
                  onChange={(e) => setPaymentDetails({...paymentDetails, ref_number: e.target.value})}
                  data-testid="ref-number-input"
                />
              </div>
              <div>
                <label className="form-label">Network ID</label>
                <input
                  type="text"
                  className="form-input form-input-sm mono-font"
                  value={paymentDetails.network_id}
                  onChange={(e) => setPaymentDetails({...paymentDetails, network_id: e.target.value})}
                  data-testid="network-id-input"
                />
              </div>
              <div>
                <label className="form-label">Approval Code</label>
                <input
                  type="text"
                  className="form-input form-input-sm mono-font"
                  value={paymentDetails.approval_code}
                  onChange={(e) => setPaymentDetails({...paymentDetails, approval_code: e.target.value})}
                  data-testid="approval-code-input"
                />
              </div>
              <div>
                <label className="form-label">Terminal #</label>
                <input
                  type="text"
                  className="form-input form-input-sm mono-font"
                  value={paymentDetails.terminal_number}
                  onChange={(e) => setPaymentDetails({...paymentDetails, terminal_number: e.target.value})}
                  data-testid="terminal-number-input"
                />
              </div>
              <div>
                <label className="form-label">AID</label>
                <input
                  type="text"
                  className="form-input form-input-sm mono-font text-xs"
                  value={paymentDetails.aid}
                  onChange={(e) => setPaymentDetails({...paymentDetails, aid: e.target.value})}
                  data-testid="aid-input"
                />
              </div>
            </div>
          </div>

          {/* Date/Time Section */}
          <div className="form-section">
            <h3 className="form-section-title">
              <FileText size={18} />
              Transaction Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Date (MM/DD/YY)</label>
                <input
                  type="text"
                  className="form-input form-input-sm mono-font"
                  value={dateTime.date}
                  onChange={(e) => setDateTime({...dateTime, date: e.target.value})}
                  placeholder="05/03/25"
                  data-testid="transaction-date-input"
                />
              </div>
              <div>
                <label className="form-label">Time (HH:MM:SS)</label>
                <input
                  type="text"
                  className="form-input form-input-sm mono-font"
                  value={dateTime.time}
                  onChange={(e) => setDateTime({...dateTime, time: e.target.value})}
                  placeholder="17:34:15"
                  data-testid="transaction-time-input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="preview-panel">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Receipt Preview</h2>

          {/* Receipt - Exact Walmart format */}
          <div className="receipt-container receipt-paper" ref={receiptRef} data-testid="receipt-preview">
            {/* Header Logo */}
            <div className="receipt-center">
              <img
                src={WALMART_LOGO_URL}
                alt="Walmart"
                className="receipt-logo-img"
              />
            </div>

            {/* Store Info - Centered */}
            <div className="receipt-center receipt-store-tight">
              <div>{storeDetails.store_type}</div>
              <div>{storeDetails.phone} Mgr:{storeDetails.manager_name}</div>
              <div>{storeDetails.address_line1}</div>
              <div>{storeDetails.city} {storeDetails.state} {storeDetails.zip_code}</div>
            </div>

            {/* Store Numbers */}
            <div className="receipt-center receipt-store-numbers">
              ST# {storeDetails.store_number} OP# {storeDetails.op_number} TE# {storeDetails.te_number} TR# {storeDetails.tr_number}
            </div>

            {/* Items */}
            <div className="receipt-items">
              {items.map((item) => (
                <React.Fragment key={item.id}>
                  {item.is_voided && (
                    <div className="receipt-center receipt-bold">** VOIDED ENTRY **</div>
                  )}
                  <div className="receipt-item-row">
                    <span className="receipt-item-name">{item.name.padEnd(14, ' ').substring(0, 14)}</span>
                    <span className="receipt-item-upc">{item.upc || generateUPC()}</span>
                    <span className="receipt-item-price">{item.is_voided ? `${item.price.toFixed(2)}-${item.tax_flag}` : `${item.price.toFixed(2)} ${item.tax_flag}`}</span>
                  </div>
                  {item.quantity > 1 && !item.is_voided && (
                    <div className="receipt-item-row receipt-indent">
                      <span className="receipt-item-name">{item.quantity} AT    1 FOR</span>
                      <span className="receipt-item-upc">{item.price.toFixed(2)}</span>
                      <span className="receipt-item-price">{(item.price * item.quantity).toFixed(2)} O</span>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Totals Section */}
            <div className="receipt-totals-section">
              <div className="receipt-total-line">
                <span>SUBTOTAL</span>
                <span className="receipt-value">{totals.subtotal}</span>
              </div>
              <div className="receipt-total-line">
                <span>TAX 1    {taxRate.toFixed(3)} %</span>
                <span className="receipt-value">{totals.taxAmount}</span>
              </div>
              <div className="receipt-total-line">
                <span>TOTAL</span>
                <span className="receipt-value">{totals.total}</span>
              </div>
            </div>

            {/* Payment Section */}
            <div className="receipt-payment-section">
              <div className="receipt-total-line">
                <span>{paymentDetails.payment_method}    TEND</span>
                <span className="receipt-value">{totals.debitTend}</span>
              </div>
              {paymentDetails.cash_back > 0 && (
                <>
                  <div className="receipt-total-line">
                    <span>DEBIT CASH BACK</span>
                    <span className="receipt-value">{paymentDetails.cash_back.toFixed(2)}</span>
                  </div>
                  <div className="receipt-total-line">
                    <span>TOTAL DEBIT PURCHASE</span>
                    <span className="receipt-value">{totals.totalDebitPurchase}</span>
                  </div>
                  <div className="receipt-total-line">
                    <span>CHANGE DUE</span>
                    <span className="receipt-value">{totals.changeDue}</span>
                  </div>
                </>
              )}
            </div>

            {/* EFT Details */}
            <div className="receipt-eft-section">
              <div className="receipt-item-line">
                <span>EFT {paymentDetails.payment_method}</span>
                <span>PAY FROM PRIMARY</span>
              </div>
              <div className="receipt-eft-amounts">
                <div>{totals.debitTend} PURCHASE</div>
                {paymentDetails.cash_back > 0 && (
                  <>
                    <div>{paymentDetails.cash_back.toFixed(2)} CASH BACK</div>
                    <div>{totals.totalDebitPurchase} TOTAL PURCHASE</div>
                  </>
                )}
              </div>
              {paymentDetails.payment_method !== 'CASH' && (
                <div>Debit              **** **** **** {paymentDetails.card_last_four} I O</div>
              )}
              <div>REF # {paymentDetails.ref_number}</div>
              <div>NETWORK ID. {paymentDetails.network_id} APPR CODE {paymentDetails.approval_code}</div>
              {paymentDetails.payment_method !== 'CASH' && (
                <>
                  <div>Debit</div>
                  <div>AID {paymentDetails.aid}</div>
                  <div>AAC {paymentDetails.aac}</div>
                  <div>*Pin Verified</div>
                </>
              )}
              <div>TERMINAL # {paymentDetails.terminal_number}</div>
            </div>

            {/* Date/Time and Items Sold */}
            <div className="receipt-center receipt-datetime">
              <div>{dateTime.date}          {dateTime.time}</div>
            </div>

            {/* Items Sold - Large and Centered */}
            <div className="receipt-items-sold">
              # ITEMS SOLD {totals.itemCount}
            </div>

            {/* TC Number */}
            <div className="receipt-center">
              TC# {tcNumber}
            </div>

            {/* Barcode */}
            <div className="receipt-barcode">
              <Barcode
                value={`TC${tcNumber.replace(/ /g, '')}${Date.now().toString()}WM`}
                width={0.85}
                height={28}
                fontSize={0}
                margin={0}
                displayValue={false}
              />
            </div>

            {/* Footer */}
            <div className="receipt-center receipt-footer">
              <div>Low Prices You Can Trust. Every Day.</div>
              <div>{dateTime.date}          {dateTime.time}</div>
            </div>
          </div>

          {/* Download Buttons */}
          <div className="download-area">
            <button
              className="btn btn-primary"
              onClick={generatePdfClient}
              disabled={isGeneratingPdf}
              data-testid="download-pdf-btn"
            >
              {isGeneratingPdf ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              Download PDF
            </button>
            <button
              className="btn btn-secondary"
              onClick={generatePdfBackend}
              disabled={isGeneratingPdf}
              data-testid="download-pdf-backend-btn"
            >
              {isGeneratingPdf ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <FileText size={16} />
              )}
              Generate via Server
            </button>
            <button
              className="btn btn-secondary"
              onClick={shareReceipt}
              disabled={isGeneratingPdf}
              data-testid="share-receipt-btn"
            >
              {isGeneratingPdf ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Share2 size={16} />
              )}
              Share Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Shared Receipt View Component
function SharedReceiptView() {
  const { receiptId } = useParams();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const receiptRef = useRef(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const response = await axios.get(`${API}/receipts/shared/${receiptId}`);
        setReceipt(response.data);
      } catch (err) {
        setError('Receipt not found');
      } finally {
        setLoading(false);
      }
    };
    fetchReceipt();
  }, [receiptId]);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Walmart Receipt',
          text: 'View my Walmart receipt',
          url: shareUrl
        });
      } catch (err) {
        // User cancelled or error
        navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    }
  };

  const downloadPdf = async () => {
    if (!receiptRef.current) return;
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true
      });
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 80;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`walmart_receipt.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
    }
  };

  if (loading) {
    return (
      <div className="shared-receipt-page">
        <div className="shared-receipt-header">
          <button onClick={() => navigate('/')} className="back-btn">
            <ChevronLeft size={24} />
          </button>
          <h1>Receipt Detail</h1>
          <div style={{width: 40}}></div>
        </div>
        <div className="shared-receipt-content">
          <div className="flex items-center justify-center h-64">
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="shared-receipt-page">
        <div className="shared-receipt-header">
          <button onClick={() => navigate('/')} className="back-btn">
            <ChevronLeft size={24} />
          </button>
          <h1>Receipt Detail</h1>
          <div style={{width: 40}}></div>
        </div>
        <div className="shared-receipt-content">
          <div className="text-center py-16 text-gray-500">
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">Receipt not found</p>
          </div>
        </div>
      </div>
    );
  }

  const { store_details, items, tax_rate, payment_details, transaction_date, transaction_time, tc_number, totals } = receipt;

  return (
    <div className="shared-receipt-page">
      {/* Header */}
      <div className="shared-receipt-header">
        <button onClick={() => navigate('/')} className="back-btn" data-testid="back-btn">
          <ChevronLeft size={24} />
        </button>
        <h1>Receipt Detail</h1>
        <button onClick={handleShare} className="share-btn" data-testid="share-btn">
          <Upload size={20} />
        </button>
      </div>

      {/* Receipt Content */}
      <div className="shared-receipt-content">
        <div className="receipt-container receipt-paper" ref={receiptRef} data-testid="shared-receipt">
          {/* Header Logo */}
          <div className="receipt-center">
            <img src="/walmart-logo.png" alt="Walmart" className="receipt-logo-img" />
          </div>

          {/* Store Info */}
          <div className="receipt-center receipt-store-tight">
            <div>{store_details.store_type}</div>
            <div>{store_details.phone} Mgr:{store_details.manager_name}</div>
            <div>{store_details.address_line1}</div>
            <div>{store_details.city} {store_details.state} {store_details.zip_code}</div>
          </div>

          {/* Store Numbers */}
          <div className="receipt-center receipt-store-numbers">
            ST# {store_details.store_number} OP# {store_details.op_number} TE# {store_details.te_number} TR# {store_details.tr_number}
          </div>

          {/* Items */}
          <div className="receipt-items">
            {items.map((item, idx) => (
              <React.Fragment key={idx}>
                {item.is_voided && (
                  <div className="receipt-center receipt-bold">** VOIDED ENTRY **</div>
                )}
                <div className="receipt-item-row">
                  <span className="receipt-item-name">{item.name.padEnd(14, ' ').substring(0, 14)}</span>
                  <span className="receipt-item-upc">{item.upc}</span>
                  <span className="receipt-item-price">{item.is_voided ? `${item.price.toFixed(2)}-${item.tax_flag}` : `${item.price.toFixed(2)} ${item.tax_flag}`}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Totals */}
          <div className="receipt-totals-section">
            <div className="receipt-total-line">
              <span>SUBTOTAL</span>
              <span className="receipt-value">{totals.subtotal}</span>
            </div>
            <div className="receipt-total-line">
              <span>TAX 1    {tax_rate.toFixed(3)} %</span>
              <span className="receipt-value">{totals.tax_amount}</span>
            </div>
            <div className="receipt-total-line">
              <span>TOTAL</span>
              <span className="receipt-value">{totals.total}</span>
            </div>
          </div>

          {/* Payment Section */}
          <div className="receipt-payment-section">
            <div className="receipt-total-line">
              <span>{payment_details.payment_method}    TEND</span>
              <span className="receipt-value">{totals.debit_tend}</span>
            </div>
            {payment_details.cash_back > 0 && (
              <>
                <div className="receipt-total-line">
                  <span>DEBIT CASH BACK</span>
                  <span className="receipt-value">{payment_details.cash_back.toFixed(2)}</span>
                </div>
                <div className="receipt-total-line">
                  <span>TOTAL DEBIT PURCHASE</span>
                  <span className="receipt-value">{totals.total_debit_purchase}</span>
                </div>
                <div className="receipt-total-line">
                  <span>CHANGE DUE</span>
                  <span className="receipt-value">{totals.change_due}</span>
                </div>
              </>
            )}
          </div>

          {/* EFT Details */}
          <div className="receipt-eft-section">
            <div className="receipt-item-line">
              <span>EFT {payment_details.payment_method}</span>
              <span>PAY FROM PRIMARY</span>
            </div>
            <div className="receipt-eft-amounts">
              <div>{totals.debit_tend} PURCHASE</div>
              {payment_details.cash_back > 0 && (
                <>
                  <div>{payment_details.cash_back.toFixed(2)} CASH BACK</div>
                  <div>{totals.total_debit_purchase} TOTAL PURCHASE</div>
                </>
              )}
            </div>
            {payment_details.payment_method !== 'CASH' && (
              <div>Debit              **** **** **** {payment_details.card_last_four} I O</div>
            )}
            <div>REF # {payment_details.ref_number}</div>
            <div>NETWORK ID. {payment_details.network_id} APPR CODE {payment_details.approval_code}</div>
            {payment_details.payment_method !== 'CASH' && (
              <>
                <div>Debit</div>
                <div>AID {payment_details.aid}</div>
                <div>AAC {payment_details.aac}</div>
                <div>*Pin Verified</div>
              </>
            )}
            <div>TERMINAL # {payment_details.terminal_number}</div>
          </div>

          {/* Date/Time */}
          <div className="receipt-center receipt-datetime">
            <div>{transaction_date}          {transaction_time}</div>
          </div>

          {/* Items Sold - Large */}
          <div className="receipt-items-sold">
            # ITEMS SOLD {totals.item_count}
          </div>

          {/* TC Number */}
          <div className="receipt-center">
            TC# {tc_number}
          </div>

          {/* Barcode */}
          <div className="receipt-barcode">
            <Barcode
              value={`TC${tc_number.replace(/ /g, '')}WM`}
              width={0.85}
              height={28}
              fontSize={0}
              margin={0}
              displayValue={false}
            />
          </div>

          {/* Footer */}
          <div className="receipt-center receipt-footer">
            <div>Low Prices You Can Trust. Every Day.</div>
            <div>{transaction_date}          {transaction_time}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main App with Router
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ReceiptBuilder />} />
        <Route path="/receipt/:receiptId" element={<SharedReceiptView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
