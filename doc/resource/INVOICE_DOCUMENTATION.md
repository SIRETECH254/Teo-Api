# 🧾 TEO KICKS API - Invoice Management Documentation

## 📋 Table of Contents
- [Invoice Management Overview](#invoice-management-overview)
- [Invoice Model](#-invoice-model)
- [Invoice Controller](#-invoice-controller)
- [Invoice Routes](#-invoice-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Invoice Management Overview

Invoice Management handles the creation and retrieval of invoices generated for orders within the TEO KICKS API system. Invoices detail the line items, pricing breakdown (subtotal, discounts, fees, tax, total), and payment status, providing a formal record of transactions. Invoices are automatically generated when an order is created.

---

## 👤 Invoice Model

### Schema Definition
```typescript
interface IInvoice {
  _id: string;
  orderId: string; // Order ObjectId
  number: string;
  lineItems: Array<{
    label: string;
    amount: number;
  }>;
  subtotal: number;
  discounts: number;
  fees: number;
  tax: number;
  total: number;
  balanceDue: number;
  paymentStatus: "PENDING" | "PAID" | "CANCELLED";
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/invoiceModel.js`**

```javascript
import mongoose from "mongoose"


const invoiceLineItemSchema = new mongoose.Schema({
    label: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 }
}, { _id: false })


const invoiceSchema = new mongoose.Schema({

    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    number: { type: String, required: true, unique: true },
    lineItems: { type: [invoiceLineItemSchema], default: [] },

    subtotal: { type: Number, required: true, min: 0 },
    // Total discounts applied to this invoice (e.g., coupon). Stored as a positive number.
    discounts: { type: Number, required: true, min: 0, default: 0 },
    fees: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    balanceDue: { type: Number, required: true, min: 0 },

    paymentStatus: { type: String, enum: ["PENDING", "PAID", "CANCELLED"], default: "PENDING" },

    // Optional metadata snapshot, e.g., coupon details used for this invoice
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }

}, { timestamps: true })


invoiceSchema.index({ orderId: 1 })
invoiceSchema.index({ paymentStatus: 1, createdAt: -1 })


const Invoice = mongoose.model("Invoice", invoiceSchema)


export default Invoice
```

### Validation Rules
```javascript
orderId:        { required: true, type: ObjectId, ref: 'Order' }
number:         { required: true, type: String, unique: true }
lineItems:      { type: Array of { label: String, amount: Number (min: 0) } }
subtotal:       { required: true, type: Number, min: 0 }
discounts:      { required: true, type: Number, min: 0, default: 0 }
fees:           { required: true, type: Number, min: 0, default: 0 }
tax:            { required: true, type: Number, min: 0, default: 0 }
total:          { required: true, type: Number, min: 0 }
balanceDue:     { required: true, type: Number, min: 0 }
paymentStatus:  { type: String, enum: ['PENDING', 'PAID', 'CANCELLED'], default: 'PENDING' }
metadata:       { type: Mixed, default: {} }
```

---

## 🎮 Invoice Controller

### Required Imports
```javascript
import Invoice from "../models/invoiceModel.js"
import Order from "../models/orderModel.js"
// io is implicitly available via req.app.get('io') in controller methods
```

### Functions Overview

#### `createInvoice()`
**Purpose:** Creates a new invoice for a given order. This function is primarily designed for internal use, typically triggered automatically after an order is successfully placed.  
**Access:** Private (Authenticated User) - though often restricted further or called internally.  
**Validation:** `orderId` is required. Checks if the order exists and if an invoice already exists for that order.  
**Process:** Fetches order details, constructs line items and pricing from the order, generates a unique invoice number, creates the `Invoice` document, and updates the `Order` with the `invoiceId`. Emits a `invoice.created` Socket.io event.  
**Response:** The ID of the newly created invoice.

**Controller Implementation:**
```javascript
export const createInvoice = async (req, res, next) => {
  try {
    const io = req.app.get('io')

    const { orderId } = req.body || {}

    if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' })

    const order = await Order.findById(orderId)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })

    if (order.invoiceId) {
      return res.status(409).json({ success: false, message: 'Invoice already exists for this order', data: { invoiceId: order.invoiceId } })
    }

    const { subtotal, discounts, packagingFee, schedulingFee, deliveryFee, tax, total } = order.pricing || {}

    const lineItems = [
      { label: 'Items subtotal', amount: subtotal || 0 },
      ...(packagingFee ? [{ label: 'Packaging', amount: packagingFee }] : []),
      ...(schedulingFee ? [{ label: 'Scheduling', amount: schedulingFee }] : []),
      ...(deliveryFee ? [{ label: 'Delivery', amount: deliveryFee }] : []),
      ...(tax ? [{ label: 'Tax', amount: tax }] : [])
    ]

    const invoice = await Invoice.create({
      orderId: order._id,
      number: generateInvoiceNumber(),
      lineItems,
      subtotal: subtotal || 0,
      fees: (packagingFee || 0) + (schedulingFee || 0) + (deliveryFee || 0),
      tax: tax || 0,
      total: total || 0,
      balanceDue: total || 0,
      paymentStatus: 'PENDING'
    })

    order.invoiceId = invoice._id
    await order.save()

    io?.emit('invoice.created', { invoiceId: invoice._id.toString(), orderId: order._id.toString() })

    return res.status(201).json({ success: true, data: { invoiceId: invoice._id } })
  } catch (err) {
    return next(err)
  }
}
```

#### `getInvoiceById()`
**Purpose:** Retrieves a single invoice by its ID.  
**Access:** Private (Authenticated User)  
**Validation:** `id` in params.  
**Process:** Finds the invoice by ID and populates orderId.  
**Response:** A single invoice object with orderId populated.

**Controller Implementation:**
```javascript
export const getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params
    const invoice = await Invoice.findById(id)
      .populate('orderId')
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' })
    return res.json({ success: true, data: { invoice } })
  } catch (err) {
    return next(err)
  }
}
```

---

## 🧾 Invoice Routes

### Base Path: `/api/invoices`

### Router Implementation

**File: `../routes/invoiceRoute.js`**

```javascript
import express from "express"
import { authenticateToken } from "../middlewares/auth.js"
import { createInvoice, getInvoiceById } from "../controllers/invoiceController.js"


const router = express.Router()


router.post('/', authenticateToken, createInvoice)
router.get('/:id', authenticateToken, getInvoiceById)


export default router
```

### Route Details

#### `POST /api/invoices`
**Headers:** `Authorization: Bearer <token>`  
**Body (JSON):**  
```json
{
  "orderId": "65e26b1c09b068c201383812"
}
```
**Purpose:** Create a new invoice for a specified order. This endpoint is typically called by the backend system upon order creation.  
**Access:** Private (Authenticated User)  
**Response:** `201 Created` with the ID of the newly created invoice.
```json
{
  "success": true,
  "data": {
    "invoiceId": "65e26b1c09b068c201383821"
  }
}
```

#### `GET /api/invoices/:id`
**Headers:** `Authorization: Bearer <token>`  
**Parameters:** `id` (path) - The ID of the invoice to retrieve.  
**Purpose:** Retrieve a single invoice by its unique identifier.  
**Access:** Private (Authenticated User)  
**Response:** `200 OK` with the invoice object, or `404 Not Found`.
```json
{
  "success": true,
  "data": {
    "invoice": {
      "_id": "65e26b1c09b068c201383821",
      "orderId": {
        "_id": "65e26b1c09b068c201383820",
        "status": "PLACED",
        "paymentStatus": "UNPAID",
        "pricing": {
          "subtotal": 1500,
          "total": 1550
        }
      },
      "number": "INV-2026-123456",
      "lineItems": [
        { "label": "Items subtotal", "amount": 1500 },
        { "label": "Packaging", "amount": 50 }
      ],
      "subtotal": 1500,
      "discounts": 0,
      "fees": 50,
      "tax": 0,
      "total": 1550,
      "balanceDue": 1550,
      "paymentStatus": "PENDING",
      "createdAt": "2026-02-15T10:30:00.000Z",
      "updatedAt": "2026-02-15T10:30:00.000Z"
    }
  }
}
```

---

## 🔐 Middleware

- `authenticateToken`: Used on all routes to ensure only authenticated users can access invoice information or trigger invoice creation. Further authorization might be applied internally to ensure users can only see their own invoices unless they have an 'admin' role.

---

## 📝 API Examples

### Create an Invoice (typically an internal/backend call)
```bash
curl -X POST http://localhost:5000/api/invoices 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <access_token>" 
  -d '{
    "orderId": "65e26b1c09b068c201383812"
  }'
```

### Get an Invoice by ID
```bash
curl -X GET http://localhost:5000/api/invoices/<invoice_id> 
  -H "Authorization: Bearer <access_token>"
```

---

## 🛡️ Security Features

-   **Authentication:** All invoice endpoints require a valid JWT token.
-   **Data Integrity:** Invoices are strongly linked to orders via `orderId`, maintaining a clear and auditable transactional history. The `number` field ensures unique identification for each invoice.
-   **Access Control:** While `authenticateToken` protects the endpoints, granular access control should be implemented within the controller to ensure users can only view their own invoices, unless they possess an 'admin' role.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

-   `400 Bad Request`: Invalid input (e.g., missing `orderId`).
-   `401 Unauthorized`: Missing or invalid authentication token.
-   `404 Not Found`: The referenced order or the requested invoice was not found.
-   `409 Conflict`: An invoice already exists for the given order, preventing duplicate generation.
-   `500 Internal Server Error`: An unexpected server-side error occurred during processing.

---

## 📊 Database Indexes

-   `orderId: 1`: For efficient lookup of invoices associated with a specific order.
-   `paymentStatus: 1, createdAt: -1`: Facilitates efficient querying of invoices by their payment status, sorted by creation date.
-   `number: 1` (unique): Ensures fast and unique lookup by invoice number.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
