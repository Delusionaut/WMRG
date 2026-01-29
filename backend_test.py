#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class WalmartReceiptAPITester:
    def __init__(self, base_url="https://web-assembler-6.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:500]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:500]
                })

            return success, response.json() if success and response.text else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n=== Testing Health Endpoints ===")
        
        # Test root endpoint
        self.run_test("API Root", "GET", "", 200)
        
        # Test health endpoint
        self.run_test("Health Check", "GET", "health", 200)

    def test_upc_lookup(self):
        """Test UPC lookup functionality"""
        print("\n=== Testing UPC Lookup ===")
        
        # Test valid UPC lookup
        test_upc = "012000073496"  # Coca-Cola UPC
        success, response = self.run_test(
            "UPC Lookup - Valid UPC",
            "GET",
            f"products/lookup/{test_upc}",
            200
        )
        
        # Test invalid UPC
        invalid_upc = "000000000000"
        self.run_test(
            "UPC Lookup - Invalid UPC",
            "GET", 
            f"products/lookup/{invalid_upc}",
            200  # Should return 200 but with success: false
        )
        
        # Test malformed UPC
        malformed_upc = "abc123"
        self.run_test(
            "UPC Lookup - Malformed UPC",
            "GET",
            f"products/lookup/{malformed_upc}",
            200  # Should handle gracefully
        )

    def test_receipt_calculation(self):
        """Test receipt calculation endpoint"""
        print("\n=== Testing Receipt Calculation ===")
        
        # Sample receipt data
        receipt_data = {
            "store_details": {
                "store_type": "WM Supercenter",
                "phone": "951-845-1529",
                "manager_name": "JESSICA",
                "address_line1": "1540 E 2ND ST",
                "city": "BEAUMONT",
                "state": "CA",
                "zip_code": "92223",
                "store_number": "05156",
                "op_number": "004985",
                "te_number": "01",
                "tr_number": "00373"
            },
            "items": [
                {
                    "id": "test1",
                    "name": "COCA COLA",
                    "upc": "012000073496",
                    "price": 1.62,
                    "quantity": 1,
                    "is_taxable": True,
                    "tax_flag": "X",
                    "is_voided": False
                },
                {
                    "id": "test2", 
                    "name": "BREAD",
                    "upc": "004900054961",
                    "price": 2.50,
                    "quantity": 2,
                    "is_taxable": False,
                    "tax_flag": "F",
                    "is_voided": False
                }
            ],
            "tax_rate": 7.750,
            "payment_details": {
                "payment_method": "DEBIT",
                "card_last_four": "2593",
                "debit_tend": 0.0,
                "cash_back": 80.00,
                "ref_number": "512400787256",
                "network_id": "0069",
                "approval_code": "811595",
                "aid": "A0000000042203",
                "aac": "CCE1EA26C32C0D8A",
                "terminal_number": "53026334"
            },
            "transaction_date": "05/03/25",
            "transaction_time": "17:34:15"
        }
        
        success, response = self.run_test(
            "Receipt Calculation",
            "POST",
            "receipts/calculate",
            200,
            data=receipt_data
        )
        
        if success:
            # Verify calculation logic
            expected_subtotal = 1.62 + (2.50 * 2)  # 6.62
            expected_tax = round(1.62 * 0.0775, 2)  # Only taxable items
            expected_total = expected_subtotal + expected_tax
            
            print(f"   Expected subtotal: {expected_subtotal}")
            print(f"   Actual subtotal: {response.get('subtotal')}")
            print(f"   Expected tax: {expected_tax}")
            print(f"   Actual tax: {response.get('tax_amount')}")
            print(f"   Expected total: {expected_total}")
            print(f"   Actual total: {response.get('total')}")

    def test_pdf_generation(self):
        """Test PDF generation endpoint"""
        print("\n=== Testing PDF Generation ===")
        
        # Sample receipt data for PDF
        receipt_data = {
            "store_details": {
                "store_type": "WM Supercenter",
                "phone": "951-845-1529",
                "manager_name": "JESSICA",
                "address_line1": "1540 E 2ND ST",
                "city": "BEAUMONT",
                "state": "CA",
                "zip_code": "92223",
                "store_number": "05156",
                "op_number": "004985",
                "te_number": "01",
                "tr_number": "00373"
            },
            "items": [
                {
                    "id": "test1",
                    "name": "TEST ITEM",
                    "upc": "012000073496",
                    "price": 1.99,
                    "quantity": 1,
                    "is_taxable": True,
                    "tax_flag": "X",
                    "is_voided": False
                }
            ],
            "tax_rate": 7.750,
            "payment_details": {
                "payment_method": "DEBIT",
                "card_last_four": "2593",
                "debit_tend": 0.0,
                "cash_back": 0.00,
                "ref_number": "512400787256",
                "network_id": "0069",
                "approval_code": "811595",
                "aid": "A0000000042203",
                "aac": "CCE1EA26C32C0D8A",
                "terminal_number": "53026334"
            },
            "transaction_date": "05/03/25",
            "transaction_time": "17:34:15"
        }
        
        # Test PDF generation
        try:
            url = f"{self.api_url}/receipts/generate-pdf"
            print(f"   URL: {url}")
            response = requests.post(
                url, 
                json=receipt_data, 
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            self.tests_run += 1
            if response.status_code == 200:
                self.tests_passed += 1
                print(f"✅ PDF Generation - Status: {response.status_code}")
                print(f"   Content-Type: {response.headers.get('content-type')}")
                print(f"   Content-Length: {len(response.content)} bytes")
                
                # Verify it's actually a PDF
                if response.content.startswith(b'%PDF'):
                    print("   ✅ Valid PDF format detected")
                else:
                    print("   ⚠️  Warning: Response doesn't appear to be a valid PDF")
            else:
                print(f"❌ PDF Generation Failed - Status: {response.status_code}")
                print(f"   Response: {response.text[:500]}")
                self.failed_tests.append({
                    "test": "PDF Generation",
                    "expected": 200,
                    "actual": response.status_code,
                    "response": response.text[:500]
                })
                
        except Exception as e:
            print(f"❌ PDF Generation Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": "PDF Generation",
                "error": str(e)
            })

    def test_save_load_receipts(self):
        """Test save/load receipt functionality"""
        print("\n=== Testing Save/Load Receipts ===")
        
        # Sample receipt data for saving
        receipt_data = {
            "name": "Test Receipt Save",
            "store_details": {
                "store_type": "WM Supercenter",
                "phone": "951-845-1529",
                "manager_name": "JESSICA",
                "address_line1": "1540 E 2ND ST",
                "city": "BEAUMONT",
                "state": "CA",
                "zip_code": "92223",
                "store_number": "05156",
                "op_number": "004985",
                "te_number": "01",
                "tr_number": "00373"
            },
            "items": [
                {
                    "id": "test1",
                    "name": "TEST ITEM",
                    "upc": "012000073496",
                    "price": 1.99,
                    "quantity": 1,
                    "is_taxable": True,
                    "tax_flag": "X",
                    "is_voided": False
                }
            ],
            "tax_rate": 7.750,
            "payment_details": {
                "payment_method": "DEBIT",
                "card_last_four": "2593",
                "cash_back": 0.00,
                "ref_number": "512400787256",
                "network_id": "0069",
                "approval_code": "811595",
                "aid": "A0000000042203",
                "aac": "CCE1EA26C32C0D8A",
                "terminal_number": "53026334"
            },
            "transaction_date": "05/03/25",
            "transaction_time": "17:34:15",
            "tc_number": "1234 5678 9012 3456 7890"
        }
        
        # Test save receipt
        success, save_response = self.run_test(
            "Save Receipt",
            "POST",
            "receipts/save",
            200,
            data=receipt_data
        )
        
        receipt_id = None
        if success and 'receipt_id' in save_response:
            receipt_id = save_response['receipt_id']
            print(f"   Saved receipt ID: {receipt_id}")
        
        # Test list saved receipts
        success, list_response = self.run_test(
            "List Saved Receipts",
            "GET",
            "receipts/saved",
            200
        )
        
        if success:
            receipts = list_response.get('receipts', [])
            print(f"   Found {len(receipts)} saved receipts")
        
        # Test get specific saved receipt
        if receipt_id:
            success, get_response = self.run_test(
                "Get Saved Receipt",
                "GET",
                f"receipts/saved/{receipt_id}",
                200
            )
            
            if success:
                print(f"   Retrieved receipt name: {get_response.get('name')}")
        
        # Test update saved receipt
        if receipt_id:
            updated_data = receipt_data.copy()
            updated_data['name'] = "Updated Test Receipt"
            
            success, update_response = self.run_test(
                "Update Saved Receipt",
                "PUT",
                f"receipts/saved/{receipt_id}",
                200,
                data=updated_data
            )
        
        # Test delete saved receipt
        if receipt_id:
            success, delete_response = self.run_test(
                "Delete Saved Receipt",
                "DELETE",
                f"receipts/saved/{receipt_id}",
                200
            )

    def test_share_receipts(self):
        """Test share receipt functionality"""
        print("\n=== Testing Share Receipts ===")
        
        # Sample receipt data for sharing
        share_data = {
            "store_details": {
                "store_type": "WM Supercenter",
                "phone": "951-845-1529",
                "manager_name": "JESSICA",
                "address_line1": "1540 E 2ND ST",
                "city": "BEAUMONT",
                "state": "CA",
                "zip_code": "92223",
                "store_number": "05156",
                "op_number": "004985",
                "te_number": "01",
                "tr_number": "00373"
            },
            "items": [
                {
                    "id": "test1",
                    "name": "SHARED ITEM",
                    "upc": "012000073496",
                    "price": 2.99,
                    "quantity": 1,
                    "is_taxable": True,
                    "tax_flag": "X",
                    "is_voided": False
                }
            ],
            "tax_rate": 7.750,
            "payment_details": {
                "payment_method": "DEBIT",
                "card_last_four": "2593",
                "cash_back": 0.00,
                "ref_number": "512400787256",
                "network_id": "0069",
                "approval_code": "811595",
                "aid": "A0000000042203",
                "aac": "CCE1EA26C32C0D8A",
                "terminal_number": "53026334"
            },
            "transaction_date": "05/03/25",
            "transaction_time": "17:34:15",
            "tc_number": "1234 5678 9012 3456 7890",
            "totals": {
                "subtotal": "2.99",
                "tax_amount": "0.23",
                "total": "3.22",
                "item_count": 1,
                "debit_tend": "3.22",
                "total_debit_purchase": "3.22",
                "change_due": "0.00"
            }
        }
        
        # Test share receipt
        success, share_response = self.run_test(
            "Share Receipt",
            "POST",
            "receipts/share",
            200,
            data=share_data
        )
        
        shared_receipt_id = None
        if success and 'receipt_id' in share_response:
            shared_receipt_id = share_response['receipt_id']
            print(f"   Shared receipt ID: {shared_receipt_id}")
        
        # Test get shared receipt
        if shared_receipt_id:
            success, get_shared_response = self.run_test(
                "Get Shared Receipt",
                "GET",
                f"receipts/shared/{shared_receipt_id}",
                200
            )
            
            if success:
                print(f"   Retrieved shared receipt with {len(get_shared_response.get('items', []))} items")

    def test_edge_cases(self):
        """Test edge cases and error handling"""
        print("\n=== Testing Edge Cases ===")
        
        # Test empty receipt calculation
        empty_receipt = {
            "store_details": {
                "store_type": "WM Supercenter",
                "phone": "951-845-1529",
                "manager_name": "JESSICA",
                "address_line1": "1540 E 2ND ST",
                "city": "BEAUMONT",
                "state": "CA",
                "zip_code": "92223",
                "store_number": "05156",
                "op_number": "004985",
                "te_number": "01",
                "tr_number": "00373"
            },
            "items": [],
            "tax_rate": 7.750,
            "payment_details": {
                "payment_method": "DEBIT",
                "card_last_four": "2593",
                "debit_tend": 0.0,
                "cash_back": 0.00,
                "ref_number": "512400787256",
                "network_id": "0069",
                "approval_code": "811595",
                "aid": "A0000000042203",
                "aac": "CCE1EA26C32C0D8A",
                "terminal_number": "53026334"
            },
            "transaction_date": "05/03/25",
            "transaction_time": "17:34:15"
        }
        
        self.run_test(
            "Empty Receipt Calculation",
            "POST",
            "receipts/calculate",
            200,
            data=empty_receipt
        )
        
        # Test malformed request
        self.run_test(
            "Malformed Receipt Request",
            "POST",
            "receipts/calculate",
            422,  # Validation error expected
            data={"invalid": "data"}
        )
        
        # Test get non-existent saved receipt
        self.run_test(
            "Get Non-existent Saved Receipt",
            "GET",
            "receipts/saved/nonexistent",
            404
        )
        
        # Test get non-existent shared receipt
        self.run_test(
            "Get Non-existent Shared Receipt",
            "GET",
            "receipts/shared/nonexistent",
            404
        )

def main():
    """Main test runner"""
    print("🧪 Starting Walmart Receipt Generator API Tests")
    print("=" * 60)
    
    tester = WalmartReceiptAPITester()
    
    # Run all test suites
    tester.test_health_endpoints()
    tester.test_upc_lookup()
    tester.test_receipt_calculation()
    tester.test_pdf_generation()
    tester.test_save_load_receipts()
    tester.test_share_receipts()
    tester.test_edge_cases()
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.failed_tests:
        print(f"\n❌ Failed Tests ({len(tester.failed_tests)}):")
        for i, failure in enumerate(tester.failed_tests, 1):
            print(f"   {i}. {failure.get('test', 'Unknown')}")
            if 'error' in failure:
                print(f"      Error: {failure['error']}")
            else:
                print(f"      Expected: {failure.get('expected')}, Got: {failure.get('actual')}")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"\n📈 Success Rate: {success_rate:.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())