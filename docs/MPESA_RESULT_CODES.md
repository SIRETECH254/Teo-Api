# M-Pesa STK Push Result Codes - Complete Reference

This document provides a comprehensive list of all M-Pesa Daraja API result codes for STK Push (Lipa Na M-Pesa Online) transactions.

---

## ✅ Success Codes

| Code | Description | Action |
|------|-------------|--------|
| `0` | The service request is processed successfully | Payment completed - create receipt and update order |

---

## ❌ Failure Codes - User Action Required

### Insufficient Funds
| Code | Description | User Action |
|------|-------------|-------------|
| `1` | The balance is insufficient for the transaction | User needs to top up M-Pesa balance |

### Authentication Issues
| Code | Description | User Action |
|------|-------------|-------------|
| `2001` | The initiator information is invalid | Wrong PIN entered or PIN is blocked |

### User Cancellation
| Code | Description | User Action |
|------|-------------|-------------|
| `1032` | Request cancelled by user | User pressed cancel on their phone |
| `1037` | DS timeout user cannot be reached | Phone is off or out of network coverage |

### Phone Number Issues
| Code | Description | User Action |
|------|-------------|-------------|
| `1012` | Unable to complete request due to invalid MSISDN | Invalid phone number format |
| `1025` | Unable to initiate transaction | Phone number not registered for M-Pesa |

---

## ⚙️ System/Technical Errors

### Transaction State Issues
| Code | Description | Cause |
|------|-------------|-------|
| `1001` | Unable to lock subscriber | System busy, concurrent transaction |
| `1019` | Transaction expired | Request took too long to process |
| `1031` | Unable to complete the transaction | General transaction failure |

### System Errors
| Code | Description | Cause |
|------|-------------|-------|
| `1026` | System internal error | M-Pesa system issue |
| `1036` | More than one BillRef number | Duplicate transaction reference |
| `1050` | Maximum number of retries reached | Too many failed attempts |
| `1051` | Paybill/Buygoods cannot receive M-Pesa Online transactions | Shortcode not configured for STK |

### Business Rule Violations
| Code | Description | Cause |
|------|-------------|-------|
| `17` | Sender not registered for M-Pesa | Phone number not registered |
| `20` | Amount exceeds maximum allowed | Transaction amount too high |
| `26` | System busy | M-Pesa system overloaded |

---

## 🔄 Processing Codes

| Code | Description | Action |
|------|-------------|--------|
| `9999` | Request is being processed | Keep waiting for final result |

---

## 📊 Sample Webhook Payloads

### ✅ Successful Transaction (Code 0)
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_191220191020363925",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          {
            "Name": "Amount",
            "Value": 1500
          },
          {
            "Name": "MpesaReceiptNumber",
            "Value": "NLJ7RT61SV"
          },
          {
            "Name": "TransactionDate",
            "Value": 20191219102115
          },
          {
            "Name": "PhoneNumber",
            "Value": 254708374149
          }
        ]
      }
    }
  }
}
```

### ❌ Insufficient Balance (Code 1)
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_DMZ_123456789_09122023143022",
      "ResultCode": 1,
      "ResultDesc": "The balance is insufficient for the transaction"
    }
  }
}
```

### ❌ User Cancelled (Code 1032)
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_DMZ_123456789_09122023143022",
      "ResultCode": 1032,
      "ResultDesc": "Request cancelled by user"
    }
  }
}
```

### ❌ Timeout (Code 1037)
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_DMZ_123456789_09122023143022",
      "ResultCode": 1037,
      "ResultDesc": "DS timeout user cannot be reached"
    }
  }
}
```

### ❌ Wrong PIN (Code 2001)
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_DMZ_123456789_09122023143022",
      "ResultCode": 2001,
      "ResultDesc": "The initiator information is invalid"
    }
  }
}
```

---

## 🎯 Implementation Notes

### Important Observations:

1. **Only Code 0 has CallbackMetadata**
   - Successful transactions include payment details (amount, receipt number, phone, date)
   - Failed transactions DO NOT include CallbackMetadata

2. **Common User Errors:**
   - Code 1 (Insufficient balance) - Most common
   - Code 1032 (User cancelled) - Second most common
   - Code 1037 (Timeout) - Phone off or unreachable

3. **System Errors:**
   - Usually temporary - user can retry
   - Codes: 1001, 1019, 1026, 1036, 1050

4. **Invalid Configuration:**
   - Code 1025 - Phone not M-Pesa registered
   - Code 1051 - Shortcode not configured

### Recommended User Experience:

| Code Category | UI Treatment | User Guidance |
|---------------|--------------|---------------|
| **0** (Success) | ✅ Green success screen | Show receipt, order details |
| **1, 2001** (User error) | ⚠️ Yellow warning | Clear action needed (top up, correct PIN) |
| **1032** (Cancelled) | ℹ️ Blue info | Neutral - user chose to cancel |
| **1037** (Timeout) | ⏱️ Orange timeout | Check phone connectivity |
| **System errors** | 🔄 Retry prompt | "Try again" button prominent |
| **Invalid config** | 🚫 Red error | Contact support message |

---

## 🧪 Testing in Sandbox

### Sandbox Test Phone Numbers:
- **Success:** Use any valid Kenyan phone format (254XXXXXXXXX)
- **Simulate failure:** Currently no specific test numbers for different error codes
- **Timeout:** Use phone number with airplane mode on

### Production Considerations:
- Monitor most common failure codes
- Track retry success rates
- Set up alerts for system errors (1026, 1036)
- Consider retry limits to prevent abuse

---

## 📝 Payment Confirmation Flow

### Primary Flow (Webhook Callback)
```
Customer initiates payment
        ↓
STK Push sent to phone
        ↓
Customer enters PIN (or cancels/times out)
        ↓
M-Pesa processes transaction
        ↓
Callback sent to webhook with ResultCode
        ↓
Backend emits "callback.received" to frontend
        ↓
Frontend shows appropriate UI based on code
```

### Fallback Flow (Query API - 60 seconds)
```
No callback received within 60 seconds
        ↓
Frontend triggers fallback query
        ↓
Backend calls Safaricom Query API
        ↓
Safaricom returns ResultCode + ResultDesc
        ↓
Backend returns result to frontend
        ↓
Frontend shows appropriate UI based on code
```

---

## 🔄 Safaricom Query API Response Samples

When using the STK Push Query API (fallback after 60 seconds), Safaricom returns:

### ✅ Query Response - Success (Code 0)
```json
{
  "ResponseCode": "0",
  "ResponseDescription": "The service request has been accepted successfully",
  "MerchantRequestID": "29115-34620561-1",
  "CheckoutRequestID": "ws_CO_191220191020363925",
  "ResultCode": "0",
  "ResultDesc": "The service request is processed successfully."
}
```

### ❌ Query Response - Insufficient Balance (Code 1)
```json
{
  "ResponseCode": "0",
  "ResponseDescription": "The service request has been accepted successfully",
  "MerchantRequestID": "29115-34620561-1",
  "CheckoutRequestID": "ws_CO_191220191020363925",
  "ResultCode": "1",
  "ResultDesc": "The balance is insufficient for the transaction"
}
```

### ❌ Query Response - User Cancelled (Code 1032)
```json
{
  "ResponseCode": "0",
  "ResponseDescription": "The service request has been accepted successfully",
  "MerchantRequestID": "29115-34620561-1",
  "CheckoutRequestID": "ws_CO_191220191020363925",
  "ResultCode": "1032",
  "ResultDesc": "Request cancelled by user"
}
```

### ❌ Query Response - Timeout (Code 1037)
```json
{
  "ResponseCode": "0",
  "ResponseDescription": "The service request has been accepted successfully",
  "MerchantRequestID": "29115-34620561-1",
  "CheckoutRequestID": "ws_CO_191220191020363925",
  "ResultCode": "1037",
  "ResultDesc": "DS timeout user cannot be reached"
}
```

### ⏳ Query Response - Still Processing
```json
{
  "ResponseCode": "0",
  "ResponseDescription": "The service request has been accepted successfully",
  "MerchantRequestID": "29115-34620561-1",
  "CheckoutRequestID": "ws_CO_191220191020363925",
  "ResultCode": "",
  "ResultDesc": "Request processing has not been completed"
}
```

**Note:** The Query API returns the **same ResultCode** as the webhook callback, but the structure is slightly different (direct properties vs nested in `Body.stkCallback`).

---

## 📊 Callback vs Query API - Side by Side Comparison

### Success Scenario (Code 0)

**Webhook Callback:**
```json
{
  "Body": {
    "stkCallback": {
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": { "Item": [...] }
    }
  }
}
```

**Query API Response:**
```json
{
  "ResultCode": "0",
  "ResultDesc": "The service request is processed successfully."
}
```

---

### Failed Scenario (Code 1 - Insufficient Balance)

**Webhook Callback:**
```json
{
  "Body": {
    "stkCallback": {
      "ResultCode": 1,
      "ResultDesc": "The balance is insufficient for the transaction"
    }
  }
}
```

**Query API Response:**
```json
{
  "ResultCode": "1",
  "ResultDesc": "The balance is insufficient for the transaction"
}
```

---

### Key Differences

| Aspect | Webhook Callback | Query API |
|--------|------------------|-----------|
| **Structure** | Nested under `Body.stkCallback` | Direct properties |
| **ResultCode Type** | Number (0, 1, 1032, etc.) | String ("0", "1", "1032", etc.) |
| **Includes Metadata** | Yes (for success) | No |
| **Timing** | Instant (when available) | On-demand (polling) |
| **Use Case** | Primary payment confirmation | Fallback when webhook delayed/missing |

---

## 🎯 Complete Payment Tracking System

### Dual Confirmation Strategy

Your system uses **TWO methods** to confirm payment status:

```
┌─────────────────────────────────────────────────────────────┐
│                  PAYMENT INITIATED                          │
│            Frontend → Backend → M-Pesa                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
           ┌───────────┴───────────┐
           │                       │
    ┌──────▼──────┐         ┌─────▼──────┐
    │  PRIMARY    │         │  FALLBACK  │
    │  (Webhook)  │         │  (Query)   │
    └──────┬──────┘         └─────┬──────┘
           │                      │
    Instant (0-30s)          After 60s
           │                      │
           ▼                      ▼
┌──────────────────┐    ┌──────────────────┐
│ callback.received│    │ Query Safaricom  │
│     (Socket)     │    │   Status API     │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │   Frontend  │
              │  Updates UI │
              └─────────────┘
```

### Why Two Methods?

1. **Webhook (Primary):**
   - ⚡ Fast - updates UI in 2-30 seconds
   - 🎯 Reliable when network is stable
   - ⚠️ Can fail if webhook URL unreachable

2. **Query API (Fallback):**
   - 🔄 Backup - queries after 60 seconds
   - ✅ Always works (direct API call)
   - 🐌 Slower - waits 60 seconds before checking

### Result Handling Matrix

| Source | Result Code | Frontend Action | Backend Action |
|--------|-------------|-----------------|----------------|
| **Webhook** | 0 | Update UI to SUCCESS | Save payment, create receipt |
| **Webhook** | 1-9999 | Update UI to FAILED | Mark payment as FAILED |
| **Query** | 0 | Update UI to SUCCESS | Save payment, create receipt |
| **Query** | 1-9999 | Update UI to FAILED | Mark payment as FAILED |

---

## 🔍 Debugging Tips

### For Webhook Callbacks

1. **Log the full callback:**
   ```javascript
   console.log('===== M-PESA WEBHOOK RECEIVED =====')
   console.log('Full payload:', JSON.stringify(payload, null, 2))
   console.log('Result Code:', payload?.Body?.stkCallback?.ResultCode)
   console.log('Result Desc:', payload?.Body?.stkCallback?.ResultDesc)
   console.log('==================================')
   ```

2. **Check ResultCode first:**
   ```javascript
   const resultCode = payload?.Body?.stkCallback?.ResultCode
   const resultDesc = payload?.Body?.stkCallback?.ResultDesc
   ```

3. **Handle missing CallbackMetadata:**
   ```javascript
   const items = payload?.Body?.stkCallback?.CallbackMetadata?.Item || []
   // Will be empty array for failed transactions (all codes except 0)
   ```

### For Query API (Fallback)

1. **Log the query result:**
   ```javascript
   console.log('===== SAFARICOM QUERY RESULT =====')
   console.log('Result Code:', result.resultCode)
   console.log('Result Desc:', result.resultDesc)
   console.log('Full Result:', JSON.stringify(result.raw, null, 2))
   console.log('==================================')
   ```

2. **Extract result code:**
   ```javascript
   const resultCode = Number(result.resultCode || 0)  // Convert string to number
   const resultDesc = result.resultDesc
   ```

3. **Frontend fallback handling:**
   ```javascript
   const { resultCode, resultDesc } = res.data?.data || {}
   console.log('Fallback Query Result:', { resultCode, resultDesc })
   ```

---

## 📋 Quick Reference: What You'll See in Each Scenario

### Scenario 1: Success - Webhook Works (Most Common)
**Timeline:**
- 0s: User enters PIN on phone
- 2-10s: Webhook callback received
- Instant: `callback.received` event → UI updates to SUCCESS ✅

**Console Output:**
```
===== M-PESA WEBHOOK RECEIVED =====
Full payload: { Body: { stkCallback: { ResultCode: 0, ... } } }
Result Code: 0
Result Desc: The service request is processed successfully.
====================================

M-Pesa Callback Received: { CODE: 0, message: "..." }
Payment confirmed!
```

---

### Scenario 2: Failed - Insufficient Balance (Webhook Works)
**Timeline:**
- 0s: User enters PIN on phone
- 2-10s: Webhook callback received
- Instant: `callback.received` event → UI updates to FAILED ❌

**Console Output:**
```
===== M-PESA WEBHOOK RECEIVED =====
Full payload: { Body: { stkCallback: { ResultCode: 1, ... } } }
Result Code: 1
Result Desc: The balance is insufficient for the transaction
====================================

M-Pesa Callback Received: { CODE: 1, message: "..." }
Insufficient M-Pesa balance
```

---

### Scenario 3: Success - Webhook Delayed (Fallback Used)
**Timeline:**
- 0s: User enters PIN on phone
- 60s: No webhook received, fallback query triggered
- 61s: Query API returns ResultCode 0
- Instant: UI updates to SUCCESS ✅

**Console Output:**
```
Fallback: Querying M-Pesa status from Safaricom...

===== SAFARICOM QUERY RESULT =====
Result Code: 0
Result Desc: The service request is processed successfully.
==================================

Fallback Query Result: { resultCode: 0, resultDesc: "..." }
Payment confirmed!
```

---

### Scenario 4: Failed - User Cancelled (Fallback Used)
**Timeline:**
- 0s: User cancels on phone
- 60s: No webhook received, fallback query triggered
- 61s: Query API returns ResultCode 1032
- Instant: UI updates to FAILED ❌

**Console Output:**
```
Fallback: Querying M-Pesa status from Safaricom...

===== SAFARICOM QUERY RESULT =====
Result Code: 1032
Result Desc: Request cancelled by user
==================================

Fallback Query Result: { resultCode: 1032, resultDesc: "..." }
Payment was cancelled
```

---

## 🎨 Frontend Display Examples

### Success (Code 0):
```
✅ Payment Successful! 🎉
"The service request is processed successfully."

Order Summary:
- Subtotal: KSh 1,500.00
- Packaging: KSh 50.00
- Total Paid: KSh 1,550.00

Receipt: RCP-2025-123456
[Go to Orders] button
```

### Insufficient Balance (Code 1):
```
⚠️ Insufficient Balance
"The balance is insufficient for the transaction"

Please top up your M-Pesa account and try again.

Amount needed: KSh 1,550.00
[Retry Payment] [Close] buttons
```

### User Cancelled (Code 1032):
```
ℹ️ Payment Cancelled
"Request cancelled by user"

You cancelled the payment on your phone.
[Retry Payment] [Close] buttons
```

### Timeout (Code 1037):
```
⏱️ Request Timeout
"DS timeout user cannot be reached"

Could not reach your phone. Please ensure:
- Your phone is on
- You have network coverage
- M-Pesa service is not down

[Retry Payment] [Close] buttons
```

### Wrong PIN (Code 2001):
```
🔒 Wrong PIN Entered
"The initiator information is invalid"

Incorrect M-Pesa PIN entered. Please try again.
Note: Multiple wrong attempts may block your PIN.

[Retry Payment] [Close] buttons
```

---

## 📞 Support Scenarios

When to show "Contact Support":
- Code 1026, 1036 (System errors persisting after 3 retries)
- Code 1051 (Configuration issue - merchant side)
- Unknown codes not in this reference

When to allow retry:
- All user-facing errors (1, 1032, 1037, 2001)
- Temporary system errors (1001, 1019)

When to block retry:
- Code 1025 (Invalid phone - needs correction first)
- After 3 consecutive failures with same error code

---

*Last Updated: September 30, 2025*