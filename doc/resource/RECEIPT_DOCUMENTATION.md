# 🧾 TEO KICKS API - Receipt Management Documentation

## 📋 Table of Contents
- [Receipt Management Overview](#receipt-management-overview)
- [Receipt Model](#-receipt-model)
- [Receipt Controller](#-receipt-controller)
- [Receipt Routes](#-receipt-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Receipt Management Overview

Receipt Management handles the generation and retrieval of payment receipts within the TEO KICKS API system. Receipts serve as proof of payment for completed transactions, linking back to the original order and invoice. They include details such as the amount paid, payment method, and issued date.

---

## 👤 Receipt Model

### Schema Definition
```typescript
interface IReceipt {
  _id: string;
  orderId: string; // Order ObjectId
  invoiceId: string; // Invoice ObjectId
  receiptNumber: string;
  amountPaid: number;
  paymentMethod: "mpesa_stk" | "paystack_card" | "cash";
  issuedAt: Date;
  pdfUrl?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/receiptModel.js`**

```javascript
import mongoose from "mongoose"


const receiptSchema = new mongoose.Schema({

    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true },

    receiptNumber: { type: String, required: true, unique: true },
    amountPaid: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ["mpesa_stk", "paystack_card", "cash"], required: true },
    issuedAt: { type: Date, required: true },
    pdfUrl: { type: String },

    // Optional metadata snapshot (e.g., coupon used)
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }

}, { timestamps: true })


receiptSchema.index({ orderId: 1 })
receiptSchema.index({ invoiceId: 1 })


const Receipt = mongoose.model("Receipt", receiptSchema)


export default Receipt
```

### Validation Rules
```javascript
orderId:        { required: true, type: ObjectId, ref: 'Order' }
invoiceId:      { required: true, type: ObjectId, ref: 'Invoice' }
receiptNumber:  { required: true, type: String, unique: true }
amountPaid:     { required: true, type: Number, min: 0 }
paymentMethod:  { required: true, type: String, enum: ['mpesa_stk', 'paystack_card', 'cash'] }
issuedAt:       { required: true, type: Date }
pdfUrl:         { type: String }
metadata:       { type: Mixed, default: {} }
```

---

## 🎮 Receipt Controller

### Required Imports
```javascript
import Receipt from "../models/receiptModel.js"
import Invoice from "../models/invoiceModel.js"
import Order from "../models/orderModel.js"
// io is implicitly available via req.app.get('io') in controller methods
```

### Functions Overview

#### `createReceipt()`
**Purpose:** Creates a new receipt for a paid invoice. This function is typically for internal system use, triggered automatically upon successful payment processing.  
**Access:** Private (Authenticated User / Admin) - often restricted to internal service calls or admin actions.  
**Validation:** `invoiceId` is required. Checks if the invoice exists and has a `PAID` status.  
**Process:** Fetches invoice and order details, generates a unique receipt number, creates the `Receipt` document, and updates the `Order` with the `receiptId`. Emits a `receipt.created` Socket.io event.  
**Response:** The ID of the newly created receipt.

**Controller Implementation:**
```javascript
export const createReceipt = async (req, res, next) => {
  try {
    const io = req.app.get('io')

    const { invoiceId, pdfUrl = null } = req.body || {}
    if (!invoiceId) return res.status(400).json({ success: false, message: 'invoiceId is required' })

    const invoice = await Invoice.findById(invoiceId)
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' })
    if (invoice.paymentStatus !== 'PAID') return res.status(400).json({ success: false, message: 'Invoice is not paid' })

    const order = await Order.findById(invoice.orderId)

    const receipt = await Receipt.create({
      orderId: invoice.orderId,
      invoiceId: invoice._id,
      receiptNumber: generateReceiptNumber(),
      amountPaid: invoice.total,
      paymentMethod: 'cash',
      issuedAt: new Date(),
      pdfUrl
    })

    if (order) {
      order.receiptId = receipt._id
      await order.save()
    }

    io?.emit('receipt.created', { receiptId: receipt._id.toString(), orderId: String(invoice.orderId) })

    return res.status(201).json({ success: true, data: { receiptId: receipt._id } })
  } catch (err) {
    return next(err)
  }
}
```

#### `getReceiptById()`
**Purpose:** Retrieves a single receipt by its ID.  
**Access:** Private (Authenticated User / Admin)  
**Validation:** `id` in params.  
**Process:** Finds the receipt by ID.  
**Response:** A single receipt object.

**Controller Implementation:**
```javascript
export const getReceiptById = async (req, res, next) => {
  try {
    const { id } = req.params
    const receipt = await Receipt.findById(id)
    if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found' })
    return res.json({ success: true, data: { receipt } })
  } catch (err) {
    return next(err)
  }
}
```

---

## 🧾 Receipt Routes

### Base Path: `/api/receipts`

### Router Implementation

**File: `../routes/receiptRoute.js`**

```javascript
import express from "express"
import { authenticateToken } from "../middlewares/auth.js"
import { createReceipt, getReceiptById } from "../controllers/receiptController.js"


const router = express.Router()


router.post('/', authenticateToken, createReceipt)
router.get('/:id', authenticateToken, getReceiptById)


export default router
```

### Route Details

#### `POST /api/receipts`
**Headers:** `Authorization: Bearer <token>`  
**Body (JSON):**  
```json
{
  "invoiceId": "65e26b1c09b068c201383812",
  "pdfUrl": "https://example.com/receipts/recipt_INV-2026-123456.pdf"
}
```
**Purpose:** Create a new receipt for a specified paid invoice. This endpoint is typically called by the backend system (e.g., payment service after a successful payment).  
**Access:** Private (Authenticated User / Admin)  
**Response:** `201 Created` with the ID of the newly created receipt.
```json
{
  "success": true,
  "data": {
    "receiptId": "65e26b1c09b068c201383822"
  }
}
```

#### `GET /api/receipts/:id`
**Headers:** `Authorization: Bearer <token>`  
**Parameters:** `id` (path) - The ID of the receipt to retrieve.  
**Purpose:** Retrieve a single receipt by its unique identifier.  
**Access:** Private (Authenticated User / Admin)  
**Response:** `200 OK` with the receipt object, or `404 Not Found`.
```json
{
  "success": true,
  "data": {
    "receipt": {
      "_id": "65e26b1c09b068c201383822",
      "orderId": "65e26b1c09b068c201383820",
      "invoiceId": "65e26b1c09b068c201383821",
      "receiptNumber": "RCP-2026-123456",
      "amountPaid": 1550,
      "paymentMethod": "cash",
      "issuedAt": "2026-02-15T10:35:00.000Z",
      "pdfUrl": null,
      "createdAt": "2026-02-15T10:35:00.000Z",
      "updatedAt": "2026-02-15T10:35:00.000Z"
    }
  }
}
```

---

## 🔐 Middleware

- `authenticateToken`: Used on all routes to ensure only authenticated users can access receipt information or trigger receipt creation. Further authorization might be applied internally to ensure users can only see their own receipts unless they have an 'admin' role.

---

## 📝 API Examples

### Create a Receipt (typically an internal/backend call)
```bash
curl -X POST http://localhost:5000/api/receipts 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <admin_access_token>" 
  -d '{
    "invoiceId": "65e26b1c09b068c201383812",
    "pdfUrl": "https://example.com/receipts/recipt_INV-2026-123456.pdf"
  }'
```

### Get a Receipt by ID
```bash
curl -X GET http://localhost:5000/api/receipts/<receipt_id> 
  -H "Authorization: Bearer <access_token>"
```

---

## 🛡️ Security Features

-   **Authentication:** All receipt endpoints require a valid JWT token.
-   **Data Integrity:** Receipts are strongly linked to orders and invoices via ObjectIds, ensuring a clear and auditable payment trail. The `receiptNumber` field ensures unique identification for each receipt. Receipts can only be generated for invoices that have a `PAID` status.
-   **Access Control:** Access to `Receipt` data needs to be carefully controlled, typically allowing customers to view only their own receipts, while administrators might have access to all receipts.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

-   `400 Bad Request`: Invalid input (e.g., missing `invoiceId`, attempting to create a receipt for an unpaid invoice).
-   `401 Unauthorized`: Missing or invalid authentication token.
-   `404 Not Found`: The referenced invoice or the requested receipt was not found.
-   `500 Internal Server Error`: An unexpected server-side error occurred during processing.

---

## 📊 Database Indexes

-   `orderId: 1`: For efficient lookup of receipts associated with a specific order.
-   `invoiceId: 1`: For efficient lookup of receipts associated with a specific invoice.
-   `receiptNumber: 1` (unique): Ensures fast and unique lookup by receipt number.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
