#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class ShareReceiptTester:
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

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:300]}...")
                    return success, response_data
                except:
                    print(f"   Response: {response.text[:200]}...")
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:500]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:500]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_share_receipt_flow(self):
        """Test the complete share receipt flow"""
        print("\n=== Testing Share Receipt Flow ===")
        
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
                    "quantity": 1,
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
                "cash_back": 20.00,
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
                "subtotal": "4.12",
                "tax_amount": "0.13",
                "total": "4.25",
                "item_count": 2,
                "debit_tend": "4.25",
                "total_debit_purchase": "24.25",
                "change_due": "20.00"
            }
        }
        
        # Test 1: Create shared receipt
        success, response = self.run_test(
            "Create Shared Receipt",
            "POST",
            "receipts/share",
            200,
            data=share_data
        )
        
        if not success:
            print("❌ Cannot continue testing - share receipt creation failed")
            return None
            
        receipt_id = response.get('receipt_id')
        if not receipt_id:
            print("❌ No receipt_id returned from share endpoint")
            return None
            
        print(f"   ✅ Receipt ID created: {receipt_id}")
        
        # Test 2: Retrieve shared receipt
        success, receipt_data = self.run_test(
            "Get Shared Receipt",
            "GET",
            f"receipts/shared/{receipt_id}",
            200
        )
        
        if success:
            # Verify the data integrity
            print("   ✅ Verifying shared receipt data...")
            
            # Check store details
            if receipt_data.get('store_details', {}).get('store_type') == share_data['store_details']['store_type']:
                print("   ✅ Store details preserved correctly")
            else:
                print("   ❌ Store details mismatch")
                
            # Check items
            if len(receipt_data.get('items', [])) == len(share_data['items']):
                print("   ✅ Items count preserved correctly")
            else:
                print("   ❌ Items count mismatch")
                
            # Check totals
            if receipt_data.get('totals', {}).get('total') == share_data['totals']['total']:
                print("   ✅ Totals preserved correctly")
            else:
                print("   ❌ Totals mismatch")
        
        # Test 3: Try to get non-existent receipt
        self.run_test(
            "Get Non-existent Receipt",
            "GET",
            "receipts/shared/nonexistent123",
            404
        )
        
        return receipt_id

def main():
    """Main test runner"""
    print("🧪 Testing Share Receipt Functionality")
    print("=" * 50)
    
    tester = ShareReceiptTester()
    
    # Run share receipt tests
    receipt_id = tester.test_share_receipt_flow()
    
    # Print final results
    print("\n" + "=" * 50)
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
    
    if receipt_id:
        print(f"\n🔗 Test receipt URL: {tester.base_url}/receipt/{receipt_id}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())