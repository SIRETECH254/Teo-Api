# 💰 TEO KICKS API - Daraja (M-Pesa) Service Documentation

## 📋 Table of Contents
- [Daraja Overview](#daraja-overview)
- [Configuration](#configuration)
- [Key Functions/Service Methods](#key-functionsservice-methods)
- [Usage in Internal Services](#usage-in-internal-services)
- [Usage in Controllers](#usage-in-controllers)
- [Callbacks and Webhooks](#callbacks-and-webhooks)
- [Error Handling](#error-handling)
- [API Examples](#api-examples)
- [Security & Compliance Notes](#security--compliance-notes)

---

## Daraja Overview

Daraja is the API gateway for M-Pesa, a mobile money transfer service in Kenya. In TEO KICKS API, the Daraja API is integrated to facilitate M-Pesa payments for orders, specifically using the STK Push (Sim Tool Kit Push) functionality. This allows customers to confirm payments directly from their mobile phones.

**Key Features:**
-   **STK Push Initiation:** Programmatically trigger M-Pesa STK Push prompts on customer phones.
-   **Transaction Callbacks:** Receive real-time notifications for payment success or failure.
-   **Transaction Status Query:** Check the status of an STK Push transaction.
-   **Secure Authentication:** Uses OAuth 2.0 for API access.
-   **Invoice-Based Payments:** Payments are linked to invoices, which are linked to orders.

---

## Configuration

Daraja API credentials and settings are managed through environment variables and configured in `server/services/external/darajaService.js`.

**Environment Variables:**
-   `MPESA_ENV`: `sandbox` or `production`. Determines the base URL for Daraja API (default: `sandbox`).
-   `MPESA_CONSUMER_KEY`: Your M-Pesa app consumer key.
-   `MPESA_CONSUMER_SECRET`: Your M-Pesa app consumer secret.
-   `MPESA_SHORT_CODE`: The M-Pesa Pay Bill or Buy Goods short code.
-   `MPESA_PASSKEY`: The M-Pesa STK Push Passkey.
-   `CALLBACK_URL` (Optional): The URL endpoint for receiving M-Pesa transaction callbacks. If not provided, defaults to `${API_BASE_URL}/api/payments/webhooks/mpesa`.
-   `API_BASE_URL` (Optional): The base URL of your API server, used to construct callback URLs if `CALLBACK_URL` is not provided.

**File: `server/services/external/darajaService.js` - Base URL Configuration**
```javascript
const getBaseUrl = () => {
  const env = (process.env.MPESA_ENV || 'sandbox').toLowerCase()
  return env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'
}
```

---

## Key Functions/Service Methods

The `server/services/external/darajaService.js` file provides the core functions for interacting with the Daraja API.

**`getAccessToken`**
Fetches an OAuth access token required for authenticating subsequent Daraja API calls.
```javascript
export const getAccessToken = async () => {
  const consumerKey = (process.env.MPESA_CONSUMER_KEY || '').trim()
  const consumerSecret = (process.env.MPESA_CONSUMER_SECRET || '').trim()

  if (!consumerKey || !consumerSecret) {
    throw new Error('Daraja credentials not configured: Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET')
  }

  const base = getBaseUrl()
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')

  try {
    const response = await axios.get(
      `${base}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } }
    )
    if (!response.data?.access_token) {
      throw new Error('Daraja OAuth response missing access_token')
    }
    return response.data.access_token
  } catch (err) {
    const status = err?.response?.status
    const data = err?.response?.data
    const message = `Daraja OAuth failed${status ? ` (HTTP ${status})` : ''}`
    const details = typeof data === 'object' ? JSON.stringify(data) : (data || err.message)
    const error = new Error(`${message}: ${details}`)
    error.cause = err
    throw error
  }
}
```

**`buildTimestamp`**
Generates a timestamp in the format required by Daraja API (YYYYMMDDHHmmss).
```javascript
export const buildTimestamp = () => {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
}
```

**`buildPassword`**
Builds the password string required for STK Push requests by encoding the concatenation of short code, passkey, and timestamp.
```javascript
export const buildPassword = (shortCode, passkey, timestamp) => {
  return Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64')
}
```

**`initiateStkPush`**
Initiates an M-Pesa STK Push transaction on the customer's phone.
```javascript
export const initiateStkPush = async ({ amount, phone, accountReference }) => {
  const shortCode = process.env.MPESA_SHORT_CODE
  const passkey = process.env.MPESA_PASSKEY
  const partyB = shortCode

  if (!shortCode || !passkey) {
    throw new Error('Daraja short code or passkey not configured')
  }

  const accessToken = await getAccessToken()
  const base = getBaseUrl()
  const timestamp = buildTimestamp()
  const password = buildPassword(shortCode, passkey, timestamp)

  const callback = `${process.env.CALLBACK_URL || process.env.API_BASE_URL || ''}/api/payments/webhooks/mpesa`

  const payload = {
    BusinessShortCode: Number(shortCode),
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(amount),
    PartyA: phone,
    PartyB: Number(partyB),
    PhoneNumber: phone,
    CallBackURL: callback,
    AccountReference: String(accountReference),
    TransactionDesc: 'Invoice payment'
  }

    const resp = await axios.post(`${base}/mpesa/stkpush/v1/processrequest`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

    return {
      merchantRequestId: resp.data?.MerchantRequestID,
      checkoutRequestId: resp.data?.CheckoutRequestID,
      raw: resp.data
  }
}
```

**`parseCallback`**
Parses the incoming Daraja callback (webhook) payload to extract relevant transaction details.
```javascript
export const parseCallback = (body) => {
  const stk = body?.Body?.stkCallback || {}
  if (!stk) return { valid: false }

  const resultCode = stk.ResultCode
  const success = resultCode === 0
  const checkoutRequestId = stk.CheckoutRequestID

  let amount = null
  let phone = null
  const items = stk?.CallbackMetadata?.Item || []

  for (const item of items) {
    if (item?.Name === 'Amount') amount = item?.Value
    if (item?.Name === 'PhoneNumber') phone = item?.Value
  }

  return {
    valid: true,
    success,
    checkoutRequestId,
    amount,
    phone,
    raw: body,
    stk
  }
}
```

**`queryStkPushStatus`**
Queries the status of a previously initiated STK Push transaction using its `checkoutRequestId`.
```javascript
export const queryStkPushStatus = async ({ checkoutRequestId, shortCode, passkey }) => {
  const resolvedShortCode = (shortCode || process.env.MPESA_SHORT_CODE || '').trim()
  const resolvedPasskey = (passkey || process.env.MPESA_PASSKEY || '').trim()

  if (!resolvedShortCode || !resolvedPasskey) {
    throw new Error('Daraja short code or passkey not configured')
  }

  const accessToken = await getAccessToken()
  const base = getBaseUrl()
  const timestamp = buildTimestamp()
  const password = buildPassword(resolvedShortCode, resolvedPasskey, timestamp)

  try {
    const resp = await axios.post(
      `${base}/mpesa/stkpushquery/v1/query`,
      {
        BusinessShortCode: Number(resolvedShortCode),
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    return {
      ok: true,
      resultCode: resp.data?.ResultCode,
      resultDesc: resp.data?.ResultDesc,
      raw: resp.data
    }
  } catch (err) {
    const status = err?.response?.status
    const data = err?.response?.data
    return {
      ok: false,
      error: `Daraja STK Query failed${status ? ` (HTTP ${status})` : ''}`,
      details: typeof data === 'object' ? JSON.stringify(data) : (data || err.message)
    }
  }
}
```

---

## Usage in Internal Services

The internal payment service (`server/services/internal/paymentService.js`) utilizes Daraja functions to initiate M-Pesa transactions for invoice payments.

**File: `server/services/internal/paymentService.js` - Snippets**
```javascript
import { initiateStkPush } from "../external/darajaService.js"

// ... inside initiateMpesaForInvoice function
export const initiateMpesaForInvoice = async ({ invoice, payment, amount, phone, callbackUrl }) => {
  const accountReference = invoice.number || invoice._id
  const res = await initiateStkPush({ amount, phone, accountReference, callbackUrl })
  payment.status = 'PENDING'
  if (!payment.processorRefs) payment.processorRefs = {}
  payment.processorRefs.daraja = {
    merchantRequestId: res.merchantRequestId,
    checkoutRequestId: res.checkoutRequestId
  }
  await payment.save()
  return res
}
```

---

## Usage in Controllers

The payment controller (`server/controllers/paymentController.js`) handles M-Pesa payment initiation, webhooks, and status queries.

**File: `server/controllers/paymentController.js` - Payment Initiation**
```javascript
import { initiateMpesaForInvoice } from "../services/internal/paymentService.js"
import { parseCallback as parseDarajaCallback, queryStkPushStatus } from "../services/external/darajaService.js"

// ... inside payInvoice function
if (method === 'mpesa_stk') {
  if (!payerPhone) return res.status(400).json({ success: false, message: 'payerPhone is required for mpesa_stk' })

  // Normalize and validate Kenyan MSISDN to E.164 without plus, e.g., 2547XXXXXXXX
  const digitsOnly = String(payerPhone).replace(/[^0-9]/g, '')
  let msisdn = digitsOnly
  if (msisdn.startsWith('0')) {
    msisdn = `254${msisdn.slice(1)}`
  }
  if (!msisdn.startsWith('254')) {
    if (digitsOnly.startsWith('254')) msisdn = digitsOnly
  }
  if (!/^254\d{9}$/.test(msisdn)) {
    return res.status(400).json({ success: false, message: 'Invalid Kenyan phone format. Use 2547XXXXXXXX' })
  }

  const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`
  const callback = callbackUrl || `${baseUrl}/api/payments/webhooks/mpesa`

  const { merchantRequestId, checkoutRequestId } = await initiateMpesaForInvoice({
    invoice,
    payment,
    amount,
    phone: msisdn,
    callbackUrl: callback
  })

  io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status })
  return res.status(202).json({ 
    success: true, 
    data: { 
      paymentId: payment._id, 
      status: payment.status, 
      daraja: { merchantRequestId, checkoutRequestId } 
    } 
  })
}
```

**File: `server/controllers/paymentController.js` - Webhook Handler**
```javascript
export const mpesaWebhook = async (req, res, next) => {
  try {
    const io = req.app.get('io')
    const payload = req.body

    if (payload?.Body?.stkCallback) {
      io.emit("callback.received", {
        message: payload?.Body?.stkCallback.ResultDesc,
        CODE: payload?.Body?.stkCallback.ResultCode
      })
    }

    const parsed = parseDarajaCallback(payload)
    if (!parsed.valid) {
      return res.status(400).json({ success: false, message: 'Invalid payload' })
    }

    const payment = await Payment.findOne({ 'processorRefs.daraja.checkoutRequestId': parsed.checkoutRequestId })
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' })
    }

    payment.rawPayload = payload

    if (parsed.success) {
      const invoice = await Invoice.findById(payment.invoiceId)
      if (invoice) {
        await applySuccessfulPayment({ invoice, payment, io, method: 'mpesa_stk' })
      }
    } else {
      payment.status = 'FAILED'
      await payment.save()
      io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status })
    }

    return res.json({ success: true })
  } catch (err) {
    return next(err)
  }
}
```

**File: `server/controllers/paymentController.js` - Status Query**
```javascript
export const queryMpesaStatus = async (req, res, next) => {
  try {
    const { paymentId } = req.params
    const { invoiceId } = req.query || {}
    let payment = await Payment.findById(paymentId)
    if (!payment && invoiceId) {
      payment = await Payment.findOne({ invoiceId, method: 'mpesa_stk' }).sort({ createdAt: -1 })
    }
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' })

    const checkoutRequestId = payment?.processorRefs?.daraja?.checkoutRequestId
    if (!checkoutRequestId) {
      return res.status(400).json({ success: false, message: 'No Daraja reference for this payment' })
    }

    const result = await queryStkPushStatus({ checkoutRequestId })
    if (!result.ok) {
      return res.status(502).json({ success: false, message: result.error, details: result.details })
    }

    const status = result.resultCode === 0 ? 'SUCCESS' : (payment.status === 'SUCCESS' ? 'SUCCESS' : 'PENDING')
    return res.json({ success: true, data: { status, resultCode: result.resultCode, resultDesc: result.resultDesc } })
  } catch (err) {
    return next(err)
  }
}
```

---

## Callbacks and Webhooks

The Daraja API relies on callbacks (webhooks) to notify the application of transaction outcomes. The `mpesaWebhook` controller function (`server/controllers/paymentController.js`) is configured as the `CallBackURL` for STK Push transactions.

**Webhook Endpoint:** `POST /api/payments/webhooks/mpesa`

**Webhook Processing Flow:**
1. M-Pesa sends a callback notification when a customer completes or cancels an STK Push.
2. The webhook handler parses the payload using `parseCallback`.
3. The system finds the payment record using the `checkoutRequestId` stored in `processorRefs.daraja.checkoutRequestId`.
4. If successful (ResultCode === 0), the payment is applied to the invoice and order using `applySuccessfulPayment`.
5. Socket.io events are emitted to notify connected clients of payment status updates.

**Important:** The callback URL must be publicly accessible. Use a service like ngrok for local development, or ensure your production server has a public IP/domain.

---

## Error Handling

All Daraja service functions are wrapped in `try-catch` blocks to handle API errors and network issues. Custom error messages are generated to provide informative feedback. Errors are thrown with descriptive messages including HTTP status codes and response details when available.

The `queryStkPushStatus` function returns an object with an `ok` flag instead of throwing, allowing calling code to handle failures gracefully.

---

## API Examples

**Initiate M-Pesa Payment for Invoice**

```bash
curl -X POST http://localhost:5000/api/payments/pay-invoice \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "<invoice_id>",
    "method": "mpesa_stk",
    "amount": 5000,
    "payerPhone": "254712345678",
    "callbackUrl": "https://teokicks.com/api/payments/webhooks/mpesa"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentId": "<payment_id>",
    "status": "PENDING",
    "daraja": {
      "merchantRequestId": "12345-67890-12345",
      "checkoutRequestId": "ws_CO_12345678901234567890"
    }
  }
}
```

**Query M-Pesa STK Push Status**

```bash
curl -X GET "http://localhost:5000/api/payments/mpesa/status/<payment_id>?invoiceId=<invoice_id>" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "SUCCESS",
    "resultCode": 0,
    "resultDesc": "The service request is processed successfully."
  }
}
```

**Webhook Payload Example (from M-Pesa)**

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "12345-67890-12345",
      "CheckoutRequestID": "ws_CO_12345678901234567890",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          {
            "Name": "Amount",
            "Value": 5000
          },
          {
            "Name": "MpesaReceiptNumber",
            "Value": "RFT123456789"
          },
          {
            "Name": "TransactionDate",
            "Value": 20240215123456
          },
          {
            "Name": "PhoneNumber",
            "Value": 254712345678
          }
        ]
      }
    }
  }
}
```

---

## Security & Compliance Notes

-   **API Credentials:** M-Pesa credentials (`MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORT_CODE`, `MPESA_PASSKEY`) should be stored securely in environment variables and never committed to version control.
-   **HTTPS:** Always use HTTPS for webhook endpoints in production to protect callback payloads in transit.
-   **Phone Number Format:** Phone numbers must be in the format `254XXXXXXXXX` (Kenyan E.164 format without the plus sign). The controller normalizes various input formats to this standard.
-   **Amount Validation:** Always validate the payment amount on the server side before processing webhooks. Compare the webhook amount with the expected invoice amount.
-   **Idempotency:** The `checkoutRequestId` ensures each payment attempt has a unique identifier, preventing duplicate processing.
-   **Access Token Caching:** Consider implementing access token caching to reduce OAuth requests. Daraja access tokens are valid for 1 hour.
-   **Sandbox vs Production:** Use the sandbox environment for testing. Sandbox credentials are different from production credentials.
-   **Callback URL:** The callback URL must be publicly accessible. M-Pesa cannot reach localhost or private IP addresses.
-   **Error Logging:** Log webhook payloads and errors for debugging, but ensure sensitive data is not logged in production.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
