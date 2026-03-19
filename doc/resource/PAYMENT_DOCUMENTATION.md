# 💰 TEO KICKS API - Payment Management Documentation

## 📋 Table of Contents
- [Payment Management Overview](#payment-management-overview)
- [Payment Model](#-payment-model)
- [Payment Controller](#-payment-controller)
- [Payment Routes](#-payment-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Payment Management Overview

Payment Management handles the processing of payments for invoices within the TEO KICKS API system. It supports multiple payment methods including M-Pesa STK Push (via Daraja API), Paystack card payments, cash payments, post-to-bill, and cash on delivery (COD). Payments are linked to invoices, which are linked to orders, creating a complete transactional flow. Upon successful payment, the system automatically updates invoice and order payment statuses, generates receipts, and updates inventory.

**Key Features:**
- **Multiple Payment Methods:** Supports M-Pesa STK Push, Paystack card payments, cash, post-to-bill, and COD
- **Webhook Integration:** Real-time payment callbacks from M-Pesa and Paystack
- **Automatic Receipt Generation:** Receipts are automatically created upon successful payment
- **Inventory Management:** Stock quantities are automatically updated when payments succeed
- **Real-time Updates:** Socket.io events notify connected clients of payment status changes
- **Status Queries:** Fallback polling endpoints to check payment status

---

## 👤 Payment Model

### Schema Definition
```typescript
interface IPayment {
  _id: string;
  invoiceId: string; // Invoice ObjectId
  method: "mpesa_stk" | "paystack_card" | "cash" | "post_to_bill" | "cod";
  amount: number;
  currency: string; // Default: "KES"
  processorRefs?: {
    daraja?: {
      merchantRequestId?: string;
      checkoutRequestId?: string;
    };
    paystack?: {
      reference?: string;
    };
  };
  status: "INITIATED" | "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
  rawPayload?: any; // Raw webhook payload for debugging
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/paymentModel.js`**

```javascript
import mongoose from "mongoose"


const paymentSchema = new mongoose.Schema({

    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true },

    method: {
        type: String,
        enum: ["mpesa_stk", "paystack_card", "cash", "post_to_bill", "cod"],
        required: true
    },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "KES" },

    processorRefs: {
        daraja: {
            merchantRequestId: { type: String },
            checkoutRequestId: { type: String }
        },
        paystack: {
            reference: { type: String }
        }
    },

    status: { type: String, enum: ["INITIATED", "PENDING", "SUCCESS", "FAILED", "CANCELLED"], default: "PENDING" },

    rawPayload: { type: mongoose.Schema.Types.Mixed, default: null }

}, { timestamps: true })


paymentSchema.index({ invoiceId: 1, createdAt: -1 })
paymentSchema.index({ "processorRefs.daraja.checkoutRequestId": 1 })
paymentSchema.index({ "processorRefs.paystack.reference": 1 })


const Payment = mongoose.model("Payment", paymentSchema)


export default Payment
```

### Validation Rules
```javascript
invoiceId:        { required: true, type: ObjectId, ref: 'Invoice' }
method:           { required: true, type: String, enum: ['mpesa_stk', 'paystack_card', 'cash', 'post_to_bill', 'cod'] }
amount:           { required: true, type: Number, min: 0 }
currency:         { type: String, default: 'KES' }
processorRefs:    { type: Object }
  daraja:           { type: Object }
    merchantRequestId: { type: String }
    checkoutRequestId:  { type: String }
  paystack:         { type: Object }
    reference:         { type: String }
status:           { type: String, enum: ['INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'], default: 'PENDING' }
rawPayload:       { type: Mixed, default: null }
```

---

## 🎮 Payment Controller

### Required Imports
```javascript
import Payment from "../models/paymentModel.js"
import Invoice from "../models/invoiceModel.js"
import Order from "../models/orderModel.js"
import Receipt from "../models/receiptModel.js"
import { initiateMpesaForInvoice, initiatePaystackForInvoice, createPaymentRecord, applySuccessfulPayment } from "../services/internal/paymentService.js"
import { parseCallback as parseDarajaCallback, queryStkPushStatus } from "../services/external/darajaService.js"
import { parseWebhook as parsePaystackWebhook } from "../services/external/paystackService.js"
// io is implicitly available via req.app.get('io') in controller methods
```

### Functions Overview

#### `initiatePayment()`
**Purpose:** Creates a payment placeholder record for an invoice. This is a legacy endpoint primarily used for creating payment records without initiating actual payment processing. For online payment methods, use `payInvoice()` instead.  
**Access:** Private (Authenticated User)  
**Validation:** `invoiceId`, `method`, and `amount` are required. Checks if the invoice exists.  
**Process:** Creates a `Payment` document with the specified method and amount. For offline methods (`cash`, `post_to_bill`, `cod`), the status is immediately set to `SUCCESS`. For online methods, the status remains `PENDING`. Emits a `payment.updated` Socket.io event.  
**Response:** The payment ID and current status.

**Controller Implementation:**
```javascript
export const initiatePayment = async (req, res, next) => {
  try {
    const io = req.app.get('io')

    const { invoiceId, method, amount, currency = 'KES' } = req.body || {}

    if (!invoiceId || !method || amount == null) {
      return res.status(400).json({ success: false, message: 'invoiceId, method and amount are required' })
    }

    const invoice = await Invoice.findById(invoiceId)
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' })

    // Create payment placeholder (external init would happen here)
    const payment = await Payment.create({
      invoiceId: invoice._id,
      method,
      amount,
      currency,
      status: ['cash', 'post_to_bill', 'cod'].includes(method) ? 'SUCCESS' : 'PENDING',
      processorRefs: {}
    })

    io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status })

    return res.status(202).json({ success: true, data: { paymentId: payment._id, status: payment.status } })
  } catch (err) {
    return next(err)
  }
}
```

#### `getPaymentById()`
**Purpose:** Retrieves a single payment by its ID with populated invoice details.  
**Access:** Private (Authenticated User)  
**Validation:** `id` in params.  
**Process:** Finds the payment by ID and populates the `invoiceId` field.  
**Response:** A single payment object with invoiceId populated.

**Controller Implementation:**
```javascript
export const getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params
    const payment = await Payment.findById(id)
      .populate('invoiceId')
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' })
    return res.json({ success: true, data: { payment } })
  } catch (err) {
    return next(err)
  }
}
```

#### `markCashCollected()`
**Purpose:** Marks a cash payment as collected and updates the associated invoice and order payment statuses. This endpoint is used by front office staff to record cash payments.  
**Access:** Private (Authenticated User / Admin)  
**Validation:** `id` in params. Optional `amount` in body to override the payment amount.  
**Process:** Finds the payment and associated invoice. Updates payment status to `SUCCESS`, sets method to `cash`, and updates the amount if provided. Marks the invoice as `PAID` with `balanceDue` set to 0. Updates the order payment status to `PAID`. Creates a receipt for the payment. Emits Socket.io events for payment update and receipt creation.  
**Response:** Success message.

**Controller Implementation:**
```javascript
export const markCashCollected = async (req, res, next) => {
  try {
    const io = req.app.get('io')

    const { id } = req.params
    const { amount } = req.body || {}

    const payment = await Payment.findById(id)
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' })

    const invoice = await Invoice.findById(payment.invoiceId)
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' })

    payment.status = 'SUCCESS'
    payment.method = 'cash'
    payment.amount = amount ?? payment.amount
    await payment.save()

    invoice.paymentStatus = 'PAID'
    invoice.balanceDue = 0
    await invoice.save()

    const order = await Order.findById(invoice.orderId)
    if (order) {
      order.paymentStatus = 'PAID'
      await order.save()
    }

    // Create receipt
    const receipt = await Receipt.create({
      orderId: invoice.orderId,
      invoiceId: invoice._id,
      receiptNumber: generateReceiptNumber(),
      amountPaid: payment.amount,
      paymentMethod: 'cash',
      issuedAt: new Date(),
      pdfUrl: null
    })

    if (order) {
      order.receiptId = receipt._id
      await order.save()
    }

    io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status })
    io?.emit('receipt.created', { receiptId: receipt._id.toString(), orderId: String(invoice.orderId) })

    return res.json({ success: true })
  } catch (err) {
    return next(err)
  }
}
```

#### `mpesaWebhook()`
**Purpose:** Handles M-Pesa/Daraja STK Push callback webhooks. This endpoint receives real-time notifications from Safaricom when a customer completes or cancels an STK Push transaction.  
**Access:** Public (no authentication required - webhook endpoint)  
**Validation:** Validates the webhook payload structure using `parseDarajaCallback()`.  
**Process:** Parses the incoming webhook payload, finds the payment record using the `checkoutRequestId`, stores the raw payload for debugging, and processes the payment result. If successful (ResultCode === 0), applies the payment to the invoice using `applySuccessfulPayment()`. If failed, updates payment status to `FAILED`. Emits Socket.io events for payment updates and callback notifications.  
**Response:** Success message.

**Controller Implementation:**
```javascript
export const mpesaWebhook = async (req, res, next) => {
  try {
    const io = req.app.get('io')

    const payload = req.body 

    // Log the full payload for debugging
    console.log('===== M-PESA WEBHOOK RECEIVED =====')
    console.log('Full payload:', JSON.stringify(payload, null, 2))
    console.log('Body.stkCallback:', JSON.stringify(payload?.Body?.stkCallback, null, 2))
    console.log('CallbackMetadata:', JSON.stringify(payload?.Body?.stkCallback?.CallbackMetadata, null, 2))
    console.log('====================================')

    const parsed = parseDarajaCallback(payload)

    if(payload?.Body?.stkCallback)
    {
      io.emit("callback.received", {message:payload?.Body?.stkCallback.ResultDesc , CODE:payload?.Body?.stkCallback.ResultCode})
    }

    if (!parsed.valid) return res.status(400).json({ success: false, message: 'Invalid payload' })
    
    const payment = await Payment.findOne({ 'processorRefs.daraja.checkoutRequestId': parsed.checkoutRequestId })
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' })

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

#### `paystackWebhook()`
**Purpose:** Handles Paystack payment callback webhooks. This endpoint receives real-time notifications from Paystack when a card payment transaction is completed or fails.  
**Access:** Public (no authentication required - webhook endpoint)  
**Validation:** Validates the webhook payload structure using `parsePaystackWebhook()`.  
**Process:** Parses the incoming webhook payload, finds the payment record using the Paystack `reference`, stores the raw payload for debugging, and processes the payment result. If successful, applies the payment to the invoice using `applySuccessfulPayment()`. If failed, updates payment status to `FAILED`. Emits Socket.io events for payment updates.  
**Response:** Success message.

**Controller Implementation:**
```javascript
export const paystackWebhook = async (req, res, next) => {
  try {
    const io = req.app.get('io')

    const payload = req.body || {}
    const parsed = parsePaystackWebhook(payload)
    if (!parsed.valid) return res.status(400).json({ success: false, message: 'Invalid payload' })

    const payment = await Payment.findOne({ 'processorRefs.paystack.reference': parsed.reference })
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' })

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

#### `payInvoice()`
**Purpose:** Main payment initiation endpoint that supports all payment methods. This is the primary endpoint for processing payments, initiating real integrations with payment processors (M-Pesa and Paystack), and handling offline payment methods.  
**Access:** Private (Authenticated User)  
**Validation:** `invoiceId` and `method` are required. For `mpesa_stk`, `payerPhone` is required. For `paystack_card`, `payerEmail` is required. Validates invoice exists and is not already paid or cancelled. Validates amount is positive.  
**Process:** Creates a payment record via `createPaymentRecord()`. For offline methods (`cash`, `post_to_bill`, `cod`), immediately marks invoice and order as paid, creates a receipt (for cash), and returns success. For `mpesa_stk`, normalizes phone number to Kenyan format (254XXXXXXXXX), initiates STK Push via `initiateMpesaForInvoice()`, and returns payment details with Daraja references. For `paystack_card`, initiates Paystack transaction via `initiatePaystackForInvoice()`, and returns payment details with authorization URL and reference. Emits Socket.io events for payment updates.  
**Response:** Payment ID, status, and method-specific details (Daraja references for M-Pesa, authorization URL for Paystack).

**Controller Implementation:**
```javascript
export const payInvoice = async (req, res, next) => {
  try {
    const io = req.app.get('io')

    const {
      invoiceId,
      method, // 'mpesa_stk' | 'paystack_card' | 'cash' | 'post_to_bill' | 'cod'
      amount: clientAmount,
      payerPhone, // required for mpesa_stk (format 2547XXXXXXXX)
      payerEmail, // required for paystack_card
      callbackUrl // optional override
    } = req.body || {}

    if (!invoiceId || !method) {
      return res.status(400).json({ success: false, message: 'invoiceId and method are required' })
    }

    const invoice = await Invoice.findById(invoiceId)
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' })

    if (invoice.paymentStatus === 'PAID') {
      return res.status(409).json({ success: false, message: 'Invoice already paid' })
    }
    if (invoice.paymentStatus === 'CANCELLED') {
      return res.status(409).json({ success: false, message: 'Invoice is cancelled' })
    }

    const amount = typeof clientAmount === 'number' ? clientAmount : (invoice.balanceDue ?? invoice.total)
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount to charge' })
    }

    // Create payment doc via service
    const payment = await createPaymentRecord({ invoice, method, amount })

    // Handle offline methods quickly
    if (['cash', 'post_to_bill', 'cod'].includes(method)) {
      
      if (method === 'cash') {
        // Immediate mark paid (front office use)
        invoice.paymentStatus = 'PAID'
        invoice.balanceDue = 0
        await invoice.save()

        const order = await Order.findById(invoice.orderId)
        if (order) {
          order.paymentStatus = 'PAID'
          await order.save()
        }

        const receipt = await Receipt.create({
          orderId: invoice.orderId,
          invoiceId: invoice._id,
          receiptNumber: generateReceiptNumber(),
          amountPaid: amount,
          paymentMethod: 'cash',
          issuedAt: new Date(),
          pdfUrl: null
        })

        if (order) {
          order.receiptId = receipt._id
          await order.save()
        }

        io?.emit('payment.updated', { paymentId: payment._id.toString(), status: 'SUCCESS' })
        io?.emit('receipt.created', { receiptId: receipt._id.toString(), orderId: String(invoice.orderId) })
      }

      return res.status(200).json({ success: true, data: { paymentId: payment._id, status: payment.status } })
    }

    // Online methods
    if (method === 'mpesa_stk') {
      if (!payerPhone) return res.status(400).json({ success: false, message: 'payerPhone is required for mpesa_stk' })

      // Normalize and validate Kenyan MSISDN to E.164 without plus, e.g., 2547XXXXXXXX
      const digitsOnly = String(payerPhone).replace(/[^0-9]/g, '')
      let msisdn = digitsOnly
      if (msisdn.startsWith('0')) {
        msisdn = `254${msisdn.slice(1)}`
      }
      if (!msisdn.startsWith('254')) {
        // If user provided +254..., digitsOnly already removed the plus; handle any remaining cases
        if (digitsOnly.startsWith('254')) msisdn = digitsOnly
      }
      if (!/^254\d{9}$/.test(msisdn)) {
        return res.status(400).json({ success: false, message: 'Invalid Kenyan phone format. Use 2547XXXXXXXX' })
      }

      // Ensure absolute callback URL (prefer env, fallback to request host)
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
      return res.status(202).json({ success: true, data: { paymentId: payment._id, status: payment.status, daraja: { merchantRequestId, checkoutRequestId } } })
    }

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
      return res.status(202).json({ success: true, data: { paymentId: payment._id, status: payment.status, authorizationUrl, reference } })
    }

    return res.status(400).json({ success: false, message: 'Unsupported payment method' })
  } catch (err) {
    return next(err)
  }
}
```

#### `queryMpesaByCheckoutId()`
**Purpose:** Queries the status of an M-Pesa STK Push transaction by checkout request ID. This endpoint provides a simplified way to check payment status when only the checkout request ID is available. If the payment is successful, it automatically applies the payment to the invoice.  
**Access:** Private (Authenticated User)  
**Validation:** `checkoutRequestId` in params.  
**Process:** Finds the payment record using the `checkoutRequestId`. Queries the Daraja API directly. If the result code is 0 (success) and payment is not already successful, applies the payment using `applySuccessfulPayment()`. If the result code is not 0 and payment is not already failed, updates payment status to `FAILED`. Emits Socket.io events for payment updates.  
**Response:** Payment status, result code, result description, payment ID, invoice ID, and raw Daraja response.

**Controller Implementation:**
```javascript
export const queryMpesaByCheckoutId = async (req, res, next) => {
  try {
    const { checkoutRequestId } = req.params
    const io = req.app.get('io')

    if (!checkoutRequestId) {
      return res.status(400).json({ success: false, message: 'checkoutRequestId is required' })
    }

    // Find payment by checkoutRequestId
    const payment = await Payment.findOne({ 'processorRefs.daraja.checkoutRequestId': checkoutRequestId })
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found for this checkout request' })
    }

    // Query Daraja API directly
    const result = await queryStkPushStatus({ checkoutRequestId })
    if (!result.ok) {
      return res.status(502).json({ success: false, message: result.error, details: result.details })
    }

    console.log('===== SAFARICOM QUERY RESULT =====')
    console.log('Result Code:', result.resultCode)
    console.log('Result Desc:', result.resultDesc)
    console.log('Full Result:', JSON.stringify(result.raw, null, 2))
    console.log('==================================')

    // Map Daraja result codes: 0 = success, others are pending/failure
    const status = result.resultCode === 0 ? 'SUCCESS' : 'FAILED'
    
    // If successful, update payment status and apply payment
    if (result.resultCode === 0 && payment.status !== 'SUCCESS') {
      const invoice = await Invoice.findById(payment.invoiceId)
      if (invoice) {
        await applySuccessfulPayment({ invoice, payment, io, method: 'mpesa_stk' })
      }
    } else if (result.resultCode !== 0 && payment.status !== 'FAILED') {
      // If failed, update payment status to FAILED
      payment.status = 'FAILED'
      await payment.save()
      io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status })
    }

    return res.json({ 
      success: true, 
      data: { 
        status, 
        resultCode: result.resultCode, 
        resultDesc: result.resultDesc,
        paymentId: payment._id,
        invoiceId: payment.invoiceId,
        raw: result.raw
      } 
    })
  } catch (err) {
    return next(err)
  }
}
```
    }

    // Find payment by checkoutRequestId
    const payment = await Payment.findOne({ 'processorRefs.daraja.checkoutRequestId': checkoutRequestId })
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found for this checkout request' })
    }

    // Query Daraja API directly
    const result = await queryStkPushStatus({ checkoutRequestId })
    if (!result.ok) {
      return res.status(502).json({ success: false, message: result.error, details: result.details })
    }

    // Map Daraja result codes: 0 = success, others are pending/failure
    const status = result.resultCode === 0 ? 'SUCCESS' : 'FAILED'
    
    // If successful, update payment status and apply payment
    if (result.resultCode === 0 && payment.status !== 'SUCCESS') {
      const invoice = await Invoice.findById(payment.invoiceId)
      if (invoice) {
        await applySuccessfulPayment({ invoice, payment, io: req.app.get('io'), method: 'mpesa_stk' })
      }
    } else if (result.resultCode !== 0 && payment.status !== 'FAILED') {
      // If failed, update payment status to FAILED
      payment.status = 'FAILED'
      await payment.save()
      io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status })
    }

    return res.json({ 
      success: true, 
      data: { 
        status, 
        resultCode: result.resultCode, 
        resultDesc: result.resultDesc,
        paymentId: payment._id,
        invoiceId: payment.invoiceId,
        raw: result.raw
      } 
    })
  } catch (err) {
    return next(err)
  }
}
```

---

## 💰 Payment Routes

### Base Path: `/api/payments`

### Router Implementation

**File: `../routes/paymentRoute.js`**

```javascript
import express from "express"
import { authenticateToken } from "../middlewares/auth.js"
import { initiatePayment, getPaymentById, markCashCollected, mpesaWebhook, paystackWebhook, payInvoice, queryMpesaByCheckoutId } from "../controllers/paymentController.js"


const router = express.Router()


router.post('/initiate', authenticateToken, initiatePayment)

router.post('/pay-invoice', authenticateToken, payInvoice)

router.get('/:id', authenticateToken, getPaymentById)

router.patch('/:id/cash', authenticateToken, markCashCollected)

// Webhooks (public)
router.post('/webhooks/mpesa', mpesaWebhook)

router.post('/webhooks/paystack', paystackWebhook)

// Fallback polling for M-Pesa status
// Query M-Pesa status by checkoutRequestId
router.get('/mpesa-status/:checkoutRequestId', authenticateToken, queryMpesaByCheckoutId)


export default router
```

### Route Details

#### `POST /api/payments/initiate`
**Headers:** `Authorization: Bearer <token>`  
**Body (JSON):**  
```json
{
  "invoiceId": "65e26b1c09b068c201383812",
  "method": "cash",
  "amount": 1550,
  "currency": "KES"
}
```
**Purpose:** Create a payment placeholder record for an invoice. This is a legacy endpoint. For actual payment processing, use `POST /api/payments/pay-invoice`.  
**Access:** Private (Authenticated User)  
**Response:** `202 Accepted` with payment ID and status.
```json
{
  "success": true,
  "data": {
    "paymentId": "65e26b1c09b068c201383821",
    "status": "SUCCESS"
  }
}
```

#### `POST /api/payments/pay-invoice`
**Headers:** `Authorization: Bearer <token>`  
**Body (JSON) - M-Pesa STK Push:**  
```json
{
  "invoiceId": "65e26b1c09b068c201383812",
  "method": "mpesa_stk",
  "amount": 1550,
  "payerPhone": "254712345678",
  "callbackUrl": "https://api.example.com/api/payments/webhooks/mpesa"
}
```
**Body (JSON) - Paystack Card:**  
```json
{
  "invoiceId": "65e26b1c09b068c201383812",
  "method": "paystack_card",
  "amount": 1550,
  "payerEmail": "customer@example.com",
  "callbackUrl": "https://example.com/payments/callback"
}
```
**Body (JSON) - Cash:**  
```json
{
  "invoiceId": "65e26b1c09b068c201383812",
  "method": "cash",
  "amount": 1550
}
```
**Body (JSON) - Post to Bill:**  
```json
{
  "invoiceId": "65e26b1c09b068c201383812",
  "method": "post_to_bill"
}
```
**Body (JSON) - Cash on Delivery:**  
```json
{
  "invoiceId": "65e26b1c09b068c201383812",
  "method": "cod"
}
```
**Purpose:** Initiate payment for an invoice using the specified payment method. This is the primary endpoint for processing payments. Supports all payment methods and initiates real integrations with payment processors.  
**Access:** Private (Authenticated User)  
**Response - M-Pesa STK Push (202 Accepted):**  
```json
{
  "success": true,
  "data": {
    "paymentId": "65e26b1c09b068c201383821",
    "status": "PENDING",
    "daraja": {
      "merchantRequestId": "12345-67890-12345",
      "checkoutRequestId": "ws_CO_12345678901234567890"
    }
  }
}
```
**Response - Paystack Card (202 Accepted):**  
```json
{
  "success": true,
  "data": {
    "paymentId": "65e26b1c09b068c201383821",
    "status": "PENDING",
    "authorizationUrl": "https://checkout.paystack.com/xxxxx",
    "reference": "INV-65e26b1c09b068c201383812-1234567890"
  }
}
```
**Response - Cash/Post to Bill/COD (200 OK):**  
```json
{
  "success": true,
  "data": {
    "paymentId": "65e26b1c09b068c201383821",
    "status": "SUCCESS"
  }
}
```

#### `GET /api/payments/:id`
**Headers:** `Authorization: Bearer <token>`  
**Parameters:** `id` (path) - The ID of the payment to retrieve.  
**Purpose:** Retrieve a single payment by its unique identifier with populated invoice details.  
**Access:** Private (Authenticated User)  
**Response:** `200 OK` with the payment object, or `404 Not Found`.
```json
{
  "success": true,
  "data": {
    "payment": {
      "_id": "65e26b1c09b068c201383821",
      "invoiceId": {
        "_id": "65e26b1c09b068c201383812",
        "number": "INV-2026-123456",
        "total": 1550,
        "paymentStatus": "PAID"
      },
      "method": "mpesa_stk",
      "amount": 1550,
      "currency": "KES",
      "status": "SUCCESS",
      "processorRefs": {
        "daraja": {
          "merchantRequestId": "12345-67890-12345",
          "checkoutRequestId": "ws_CO_12345678901234567890"
        }
      },
      "createdAt": "2026-02-15T10:30:00.000Z",
      "updatedAt": "2026-02-15T10:35:00.000Z"
    }
  }
}
```

#### `PATCH /api/payments/:id/cash`
**Headers:** `Authorization: Bearer <token>`  
**Parameters:** `id` (path) - The ID of the payment to mark as collected.  
**Body (JSON):**  
```json
{
  "amount": 1550
}
```
**Purpose:** Mark a cash payment as collected. Updates the payment, invoice, and order statuses, and creates a receipt. Used by front office staff to record cash payments.  
**Access:** Private (Authenticated User / Admin)  
**Response:** `200 OK` with a success message.
```json
{
  "success": true
}
```

#### `POST /api/payments/webhooks/mpesa`
**Headers:** None (public webhook endpoint)  
**Body (JSON):** Raw M-Pesa webhook payload from Safaricom.  
**Purpose:** Receive M-Pesa STK Push callback notifications. This endpoint is called by Safaricom when a customer completes or cancels an STK Push transaction.  
**Access:** Public (no authentication required)  
**Response:** `200 OK` with a success message.
```json
{
  "success": true
}
```
**Webhook Payload Example:**
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
            "Value": 1550
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

#### `POST /api/payments/webhooks/paystack`
**Headers:** None (public webhook endpoint)  
**Body (JSON):** Raw Paystack webhook payload.  
**Purpose:** Receive Paystack payment callback notifications. This endpoint is called by Paystack when a card payment transaction is completed or fails.  
**Access:** Public (no authentication required)  
**Response:** `200 OK` with a success message.
```json
{
  "success": true
}
```


#### `GET /api/payments/mpesa-status/:checkoutRequestId`
**Headers:** `Authorization: Bearer <token>`  
**Parameters:** `checkoutRequestId` (path) - The M-Pesa checkout request ID.  
**Purpose:** Query the status of an M-Pesa STK Push transaction by checkout request ID. If the payment is successful, it automatically applies the payment to the invoice.  
**Access:** Private (Authenticated User)  
**Response:** `200 OK` with payment status, result details, and payment/invoice IDs.
```json
{
  "success": true,
  "data": {
    "status": "SUCCESS",
    "resultCode": 0,
    "resultDesc": "The service request is processed successfully.",
    "paymentId": "65e26b1c09b068c201383821",
    "invoiceId": "65e26b1c09b068c201383812",
    "raw": {
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully."
    }
  }
}
```

---

## 🔐 Middleware

- `authenticateToken`: Used on all authenticated routes to ensure only authenticated users can initiate payments, query payment status, and access payment information. Webhook endpoints (`/webhooks/mpesa` and `/webhooks/paystack`) are public and do not require authentication, as they are called directly by payment processors.

---

## 📝 API Examples

### Initiate Payment (Legacy)
```bash
curl -X POST http://localhost:5000/api/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "invoiceId": "65e26b1c09b068c201383812",
    "method": "cash",
    "amount": 1550,
    "currency": "KES"
  }'
```

### Pay Invoice - M-Pesa STK Push
```bash
curl -X POST http://localhost:5000/api/payments/pay-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "invoiceId": "65e26b1c09b068c201383812",
    "method": "mpesa_stk",
    "amount": 1550,
    "payerPhone": "254712345678"
  }'
```

### Pay Invoice - Paystack Card
```bash
curl -X POST http://localhost:5000/api/payments/pay-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "invoiceId": "65e26b1c09b068c201383812",
    "method": "paystack_card",
    "amount": 1550,
    "payerEmail": "customer@example.com"
  }'
```

### Pay Invoice - Cash
```bash
curl -X POST http://localhost:5000/api/payments/pay-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "invoiceId": "65e26b1c09b068c201383812",
    "method": "cash",
    "amount": 1550
  }'
```

### Get Payment by ID
```bash
curl -X GET http://localhost:5000/api/payments/<payment_id> \
  -H "Authorization: Bearer <access_token>"
```

### Mark Cash Collected
```bash
curl -X PATCH http://localhost:5000/api/payments/<payment_id>/cash \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "amount": 1550
  }'
```

### Query M-Pesa Status by Payment ID
```bash
curl -X GET "http://localhost:5000/api/payments/<payment_id>/mpesa-status?invoiceId=<invoice_id>" \
  -H "Authorization: Bearer <access_token>"
```

### Query M-Pesa Status by Checkout Request ID
```bash
curl -X GET http://localhost:5000/api/payments/mpesa-status/<checkout_request_id> \
  -H "Authorization: Bearer <access_token>"
```

---

## 🛡️ Security Features

- **Authentication:** All payment endpoints (except webhooks) require a valid JWT token. Webhook endpoints are public but should be secured using webhook signature verification in production.
- **Data Integrity:** Payments are strongly linked to invoices via `invoiceId`, maintaining a clear and auditable transactional history. Payment amounts are validated server-side to prevent manipulation.
- **Webhook Security:** Webhook endpoints should implement signature verification to ensure requests are from legitimate payment processors. Consider implementing IP whitelisting for webhook endpoints in production.
- **Phone Number Validation:** M-Pesa phone numbers are normalized and validated to ensure they match the Kenyan format (254XXXXXXXXX).
- **Amount Validation:** Payment amounts are validated against invoice `balanceDue` or `total` to prevent overpayment or underpayment.
- **Status Checks:** The system prevents payment processing for invoices that are already paid or cancelled.
- **Processor References:** Payment processor references (Daraja `checkoutRequestId`, Paystack `reference`) are stored to enable idempotent webhook processing and status queries.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

- `400 Bad Request`: Invalid input (e.g., missing required fields, invalid phone format, invalid amount, unsupported payment method).
- `401 Unauthorized`: Missing or invalid authentication token.
- `404 Not Found`: The referenced invoice or payment was not found.
- `409 Conflict`: Invoice is already paid or cancelled, preventing duplicate payment processing.
- `502 Bad Gateway`: Error communicating with external payment processor (M-Pesa or Paystack).
- `500 Internal Server Error`: An unexpected server-side error occurred during processing.

---

## 📊 Database Indexes

- `invoiceId: 1, createdAt: -1`: For efficient lookup of payments associated with a specific invoice, ordered by creation date (most recent first).
- `processorRefs.daraja.checkoutRequestId: 1`: For fast lookup of payments by M-Pesa checkout request ID (used in webhook processing).
- `processorRefs.paystack.reference: 1`: For fast lookup of payments by Paystack reference (used in webhook processing).

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
