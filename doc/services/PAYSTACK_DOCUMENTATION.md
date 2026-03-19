# 💳 TEO KICKS API - Paystack Service Documentation

## 📋 Table of Contents
- [Paystack Overview](#paystack-overview)
- [Configuration](#configuration)
- [Key Functions/Service Methods](#key-functionsservice-methods)
- [Usage in Internal Services](#usage-in-internal-services)
- [Usage in Controllers](#usage-in-controllers)
- [Callbacks and Webhooks](#callbacks-and-webhooks)
- [Error Handling](#error-handling)
- [API Examples](#api-examples)
- [Security & Compliance Notes](#security--compliance-notes)

---

## Paystack Overview

Paystack is an online payment gateway that processes card payments for TEO KICKS orders. In this project, Paystack is integrated to handle card payments, providing a secure and reliable way for customers to pay for their footwear orders.

**Key Features:**
-   **Transaction Initialization:** Create and initialize payment transactions for invoices.
-   **Webhook Processing:** Receive real-time notifications for payment status updates.
-   **Invoice-Based Payments:** Payments are linked to invoices, which are linked to orders.

---

## Configuration

Paystack API credentials and settings are managed through environment variables and primarily used in `server/services/external/paystackService.js`.

**Environment Variables:**
-   `PAYSTACK_SECRET_KEY`: Your Paystack Secret Key, used for authenticating API requests and verifying webhooks.
-   `PAYSTACK_CURRENCY` (Optional): The default currency for Paystack transactions (default: `KES`).
-   `FRONTEND_BASE_URL` (Optional): The frontend base URL for payment callback redirects.

**File: `server/services/external/paystackService.js` - Configuration Snippet**
```javascript
import axios from "axios"

export const initTransaction = async ({ amount, email, reference, callbackUrl, currency = 'KES' }) => {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) throw new Error('Paystack secret not configured')

  const resp = await axios.post(
    'https://api.paystack.co/transaction/initialize',
    {
      email,
      amount: Math.round(amount * 100),
      currency,
      reference,
      callback_url: callbackUrl
    },
    { headers: { Authorization: `Bearer ${secret}` } }
  )

  return {
    authorizationUrl: resp.data?.data?.authorization_url,
    reference: resp.data?.data?.reference,
    raw: resp.data
  }
}
```

---

## Key Functions/Service Methods

The `server/services/external/paystackService.js` file provides the core functions for interacting with the Paystack API.

**`initTransaction`**
Initializes a new payment transaction with Paystack, returning an authorization URL where the user can complete the payment.
```javascript
export const initTransaction = async ({ amount, email, reference, callbackUrl, currency = 'KES' }) => {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) throw new Error('Paystack secret not configured')

  try {
    const resp = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: Math.round(amount * 100), // Paystack expects amount in kobo/cents
        currency,
        reference,
        callback_url: callbackUrl
      },
      { headers: { Authorization: `Bearer ${secret}` } }
    )

    return {
      authorizationUrl: resp.data?.data?.authorization_url,
      reference: resp.data?.data?.reference,
      raw: resp.data
    }
  } catch (err) {
    const status = err?.response?.status
    const data = err?.response?.data
    const message = `Paystack transaction initialization failed${status ? ` (HTTP ${status})` : ''}`
    const details = typeof data === 'object' ? JSON.stringify(data) : (data || err.message)
    throw new Error(`${message}: ${details}`)
  }
}
```

**`parseWebhook`**
Parses the incoming Paystack webhook payload to extract relevant transaction details and status.
```javascript
export const parseWebhook = (body) => {
  const event = body?.event
  const reference = body?.data?.reference
  const status = body?.data?.status
  const success = event === 'charge.success' || status === 'success'
  return {
    valid: !!reference,
    success,
    reference,
    raw: body
  }
}
```

---

## Usage in Internal Services

The internal payment service (`server/services/internal/paymentService.js`) utilizes Paystack functions to initiate card transactions for invoice payments.

**File: `server/services/internal/paymentService.js` - Snippets**
```javascript
import { initTransaction } from "../external/paystackService.js"

// ... inside initiatePaystackForInvoice function
export const initiatePaystackForInvoice = async ({ invoice, payment, amount, email, callbackUrl }) => {
  const reference = `INV-${invoice._id}-${Date.now()}`
  const res = await initTransaction({ 
    amount, 
    email, 
    reference, 
    callbackUrl, 
    currency: process.env.PAYSTACK_CURRENCY || 'KES' 
  })
  payment.status = 'PENDING'
  if (!payment.processorRefs) payment.processorRefs = {}
  payment.processorRefs.paystack = { reference }
  await payment.save()
  return res
}
```

---

## Usage in Controllers

The payment controller (`server/controllers/paymentController.js`) handles Paystack payment initiation and webhook processing.

**File: `server/controllers/paymentController.js` - Payment Initiation**
```javascript
import { initiatePaystackForInvoice } from "../services/internal/paymentService.js"
import { parseWebhook as parsePaystackWebhook } from "../services/external/paystackService.js"

// ... inside payInvoice function
if (method === 'paystack_card') {
  if (!payerEmail) return res.status(400).json({ success: false, message: 'payerEmail is required for paystack_card' })

  const callback = callbackUrl || `${process.env.FRONTEND_BASE_URL || ''}/payments/callback`
  const { authorizationUrl, reference } = await initiatePaystackForInvoice({
    invoice,
    payment,
    amount,
    email: payerEmail,
    callbackUrl: callback
  })

  io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status })
  return res.status(202).json({ 
    success: true, 
    data: { 
      paymentId: payment._id, 
      status: payment.status, 
      authorizationUrl, 
      reference 
    } 
  })
}
```

**File: `server/controllers/paymentController.js` - Webhook Handler**
```javascript
export const paystackWebhook = async (req, res, next) => {
  try {
    const io = req.app.get('io')
    const payload = req.body || {}
    const parsed = parsePaystackWebhook(payload)
    
    if (!parsed.valid) {
      return res.status(400).json({ success: false, message: 'Invalid payload' })
    }

    const payment = await Payment.findOne({ 'processorRefs.paystack.reference': parsed.reference })
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' })
    }

    payment.rawPayload = payload

    if (parsed.success) {
      const invoice = await Invoice.findById(payment.invoiceId)
      if (invoice) {
        await applySuccessfulPayment({ invoice, payment, io, method: 'paystack_card' })
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

---

## Callbacks and Webhooks

The Paystack API communicates transaction updates via webhooks. The `paystackWebhook` controller function (`server/controllers/paymentController.js`) is configured to receive these notifications at the endpoint `/api/payments/webhooks/paystack`.

**Webhook Endpoint:** `POST /api/payments/webhooks/paystack`

**Webhook Processing Flow:**
1. Paystack sends a webhook notification when a payment is completed or fails.
2. The webhook handler parses the payload using `parseWebhook`.
3. The system finds the payment record using the reference stored in `processorRefs.paystack.reference`.
4. If successful, the payment is applied to the invoice and order using `applySuccessfulPayment`.
5. Socket.io events are emitted to notify connected clients of payment status updates.

**Important:** Always verify webhook authenticity in production. Consider implementing webhook signature verification using Paystack's webhook secret.

---

## Error Handling

Paystack service functions include robust error handling with `try-catch` blocks to manage API communication failures, invalid responses, or configuration issues. Errors are thrown with descriptive messages including HTTP status codes and response details when available.

The `initTransaction` function throws errors that propagate to the calling code, while `parseWebhook` returns a result object with a `valid` flag that can be checked before processing.

---

## API Examples

**Initiate Card Payment for Invoice**

```bash
curl -X POST http://localhost:5000/api/payments/pay-invoice \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "<invoice_id>",
    "method": "paystack_card",
    "amount": 5000,
    "payerEmail": "customer@example.com",
    "callbackUrl": "https://teokicks.com/payments/callback"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentId": "<payment_id>",
    "status": "PENDING",
    "authorizationUrl": "https://checkout.paystack.com/...",
    "reference": "INV-<invoice_id>-<timestamp>"
  }
}
```

**Webhook Payload Example (from Paystack)**

```json
{
  "event": "charge.success",
  "data": {
    "reference": "INV-<invoice_id>-<timestamp>",
    "status": "success",
    "amount": 500000,
    "currency": "KES",
    "customer": {
      "email": "customer@example.com"
    }
  }
}
```

---

## Security & Compliance Notes

-   **API Credentials:** Paystack secret key (`PAYSTACK_SECRET_KEY`) should be stored securely in environment variables and never committed to version control.
-   **Webhook Verification:** In production, implement webhook signature verification using Paystack's webhook secret to ensure webhooks are authentic and haven't been tampered with.
-   **HTTPS:** Always use HTTPS for webhook endpoints in production to protect webhook payloads in transit.
-   **Idempotency:** The payment reference (`INV-<invoice_id>-<timestamp>`) ensures each payment attempt has a unique identifier, preventing duplicate processing.
-   **Amount Validation:** Always validate the payment amount on the server side before processing webhooks. Compare the webhook amount with the expected invoice amount.
-   **PCI Compliance:** Paystack handles PCI compliance for card data. Never store or log full card numbers or CVV codes.
-   **Currency Handling:** Paystack amounts are in kobo/cents (smallest currency unit). Always multiply by 100 when sending to Paystack and divide by 100 when receiving from Paystack.
-   **Error Logging:** Log webhook payloads and errors for debugging, but ensure sensitive data (like full card details) is not logged.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
