# 📦 TEO KICKS API - Order Management Documentation

## 📋 Table of Contents
- [Order Management Overview](#order-management-overview)
- [Order Model](#-order-model)
- [Order Controller](#-order-controller)
- [Order Routes](#-order-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Order Management Overview

Order Management is a core component of the TEO KICKS API system, handling the lifecycle of customer orders. This includes creating orders from a user's cart, managing pricing (subtotal, discounts, fees, tax, total), tracking payment status, and updating order fulfillment statuses. Orders can be for pickup or delivery, scheduled, and are linked to invoices and receipts.

---

## 👤 Order Model

### Schema Definition
```typescript
interface IOrder {
  _id: string;
  customerId: string; // User ObjectId
  createdBy: string; // User ObjectId
  location: "in_shop" | "away";
  type: "pickup" | "delivery";
  items: Array<{
    skuId: string; // SKU ObjectId
    productId: string; // Product ObjectId
    title: string;
    variantOptions?: Map<string, string>;
    quantity: number;
    unitPrice: number;
    packagingChoice?: {
      id?: string; // PackagingOption ObjectId
      name?: string;
      fee?: number;
    };
  }>;
  pricing: {
    subtotal: number;
    discounts: number;
    packagingFee: number;
    schedulingFee: number;
    deliveryFee: number;
    tax: number;
    total: number;
  };
  timing: {
    isScheduled: boolean;
    scheduledAt?: Date | null;
  };
  addressId?: string | null; // Address ObjectId
  paymentPreference: {
    mode: "post_to_bill" | "pay_now" | "cash" | "cod";
    method?: "mpesa_stk" | "paystack_card" | null;
  };
  status:
    | "PLACED"
    | "CONFIRMED"
    | "PACKED"
    | "SHIPPED"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED"
    | "REFUNDED";
  paymentStatus:
    | "UNPAID"
    | "PENDING"
    | "PAID"
    | "PARTIALLY_REFUNDED"
    | "REFUNDED";
  invoiceId?: string | null; // Invoice ObjectId
  receiptId?: string | null; // Receipt ObjectId
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/orderModel.js`**

```javascript
import mongoose from "mongoose"


const orderItemSchema = new mongoose.Schema({
    skuId: { type: mongoose.Schema.Types.ObjectId, ref: "SKU", required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    title: { type: String, required: true },
    variantOptions: { type: Map, of: String, default: undefined },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    packagingChoice: {
        id: { type: String },
        name: { type: String },
        fee: { type: Number, default: 0 }
    }
}, { _id: false })


const pricingSchema = new mongoose.Schema({
    subtotal: { type: Number, required: true, min: 0 },
    discounts: { type: Number, required: true, min: 0, default: 0 },
    packagingFee: { type: Number, required: true, min: 0, default: 0 },
    schedulingFee: { type: Number, required: true, min: 0, default: 0 },
    deliveryFee: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 }
}, { _id: false })


const timingSchema = new mongoose.Schema({
    isScheduled: { type: Boolean, default: false },
    scheduledAt: { type: Date, default: null }
}, { _id: false })


const orderSchema = new mongoose.Schema({

    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    location: { type: String, enum: ["in_shop", "away"], required: true },
    type: { type: String, enum: ["pickup", "delivery"], required: true },

    items: { type: [orderItemSchema], required: true },
    pricing: { type: pricingSchema, required: true },
    timing: { type: timingSchema, required: true },

    addressId: { type: mongoose.Schema.Types.ObjectId, ref: "Address", default: null },

    paymentPreference: {
        mode: { type: String, enum: ["post_to_bill", "pay_now", "cash", "cod"], required: true },
        method: { type: String, enum: ["mpesa_stk", "paystack_card", null], default: null }
    },

    status: {
        type: String,
        enum: [
            "PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED",
            "CANCELLED", "REFUNDED"
        ],
        default: "PLACED"
    },

    paymentStatus: {
        type: String,
        enum: ["UNPAID", "PENDING", "PAID", "PARTIALLY_REFUNDED", "REFUNDED"],
        default: "UNPAID"
    },

    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null },
    receiptId: { type: mongoose.Schema.Types.ObjectId, ref: "Receipt", default: null },

    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }

}, { timestamps: true })


orderSchema.index({ customerId: 1, createdAt: -1 })
orderSchema.index({ status: 1, createdAt: -1 })


const Order = mongoose.model("Order", orderSchema)


export default Order
```

### Validation Rules
```javascript
customerId:     { required: true, type: ObjectId, ref: 'User' }
createdBy:      { required: true, type: ObjectId, ref: 'User' }
location:       { required: true, type: String, enum: ['in_shop', 'away'] }
type:           { required: true, type: String, enum: ['pickup', 'delivery'] }
items:          { required: true, type: Array of orderItemSchema }
  skuId:          { required: true, type: ObjectId, ref: 'SKU' }
  productId:      { required: true, type: ObjectId, ref: 'Product' }
  title:          { required: true, type: String }
  variantOptions: { type: Map, of: String }
  quantity:       { required: true, type: Number, min: 1 }
  unitPrice:      { required: true, type: Number, min: 0 }
  packagingChoice: { type: Object of { id: String, name: String, fee: Number } }
pricing:        { required: true, type: pricingSchema }
  subtotal:       { required: true, type: Number, min: 0 }
  discounts:      { required: true, type: Number, min: 0 }
  packagingFee:   { required: true, type: Number, min: 0 }
  schedulingFee:  { required: true, type: Number, min: 0 }
  deliveryFee:    { required: true, type: Number, min: 0 }
  tax:            { required: true, type: Number, min: 0 }
  total:          { required: true, type: Number, min: 0 }
timing:         { required: true, type: timingSchema }
  isScheduled:    { type: Boolean, default: false }
  scheduledAt:    { type: Date, default: null }
addressId:      { type: ObjectId, ref: 'Address', default: null }
paymentPreference: { required: true, type: Object }
  mode:           { required: true, type: String, enum: ['post_to_bill', 'pay_now', 'cash', 'cod'] }
  method:         { type: String, enum: ['mpesa_stk', 'paystack_card', null], default: null }
status:         { type: String, enum: ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED'], default: 'PLACED' }
paymentStatus:  { type: String, enum: ['UNPAID', 'PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'], default: 'UNPAID' }
invoiceId:      { type: ObjectId, ref: 'Invoice', default: null }
receiptId:      { type: ObjectId, ref: 'Receipt', default: null }
metadata:       { type: Mixed, default: {} }
```

---

## 🎮 Order Controller

### Required Imports
```javascript
import Order from "../models/orderModel.js"
import Invoice from "../models/invoiceModel.js"
import Cart from "../models/cartModel.js"
import Product from "../models/productModel.js"
import PackagingOption from "../models/packagingOptionModel.js"
import Coupon from "../models/couponModel.js"
```

### Functions Overview

#### `createOrder()`
**Purpose:** Creates a new order from a user's active cart. This involves calculating full pricing, applying any valid coupons, resolving packaging options, and initiating an associated invoice.  
**Access:** Private (Authenticated User)  
**Validation:** `customerId`, `location`, `type`, `paymentPreference` are required. Checks for active cart, valid packaging, and coupon.  
**Process:** Fetches cart and relevant details, calculates pricing, creates `Order` and `Invoice` documents, updates coupon usage, and marks the cart as converted. Emits Socket.io events for order and invoice creation.  
**Response:** The ID of the newly created order and its associated invoice.

**Controller Implementation:**
```javascript
export const createOrder = async (req, res, next) => {
  try {
    const io = req.app.get('io')

    const {
      customerId, // can be same as req.user.id when staff acts for self; else provided
      location,
      type,
      timing = { isScheduled: false, scheduledAt: null },
      addressId = null,
      paymentPreference,
      packagingOptionId = null,
      packagingSelections = [],
      couponCode = null,
      cartId = null,
      metadata = {}
    } = req.body || {}

    const actingUserId = req.user?._id || req.user?.id // staff user creating the order
    const ownerCustomerId = customerId || actingUserId

    // Load active cart
    const cart = cartId
      ? await Cart.findOne({ _id: cartId, userId: ownerCustomerId, status: 'active' })
      : await Cart.findOne({ userId: ownerCustomerId, status: 'active' })

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' })
    }

    // Map per-item packaging selections (not primary path; order-level selection preferred)
    const packagingMap = new Map()
    for (const sel of (packagingSelections || [])) {
      if (sel?.skuId && sel?.choiceId) packagingMap.set(String(sel.skuId), sel.choiceId)
    }

    // Fetch product titles for items in cart
    const productIds = Array.from(new Set((cart.items || []).map(ci => String(ci.productId))))
    const productDocs = await Product.find({ _id: { $in: productIds } }, 'title')
    const productIdToTitle = new Map(productDocs.map(p => [String(p._id), p.title]))

    // Build order items from cart (authoritative) with required title
    const items = cart.items.map((ci) => ({
      skuId: ci.skuId,
      productId: ci.productId,
      title: productIdToTitle.get(String(ci.productId)) || 'Unknown product',
      variantOptions: ci.variantOptions || {},
      quantity: ci.quantity,
      unitPrice: ci.price,
      // keep optional per-item snapshot if provided; fee is captured at order level
      packagingChoice: packagingMap.has(String(ci.skuId)) ? { id: packagingMap.get(String(ci.skuId)), name: null, fee: 0 } : undefined
    }))

    // Resolve packaging option (order-level)
    let selectedPackaging = null
    if (packagingOptionId) {
      const opt = await PackagingOption.findOne({ _id: packagingOptionId, isActive: true })
      if (opt) selectedPackaging = { id: String(opt._id), name: opt.name, price: opt.price }
    }
    if (!selectedPackaging) {
      const def = await PackagingOption.findOne({ isActive: true, isDefault: true })
      if (def) selectedPackaging = { id: String(def._id), name: def.name, price: def.price }
    }

    // Recalculate pricing
    const subtotal = items.reduce((sum, it) => sum + (it.unitPrice * it.quantity), 0)
    const packagingFee = selectedPackaging ? Number(selectedPackaging.price || 0) : 0
    const schedulingFee = timing?.isScheduled ? 0 : 0 // TODO: derive from config
    const deliveryFee = (type === 'delivery') ? 0 : 0 // TODO: compute distance-based
    // Apply coupon discount if provided
    let couponSnapshot = null
    let discounts = 0
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: String(couponCode).toUpperCase() })
      if (coupon) {
        // Validate against current user and subtotal
        const validation = coupon.validateCoupon(String(ownerCustomerId), subtotal)
        if (validation.isValid) {
          const discountAmount = coupon.calculateDiscount(subtotal)
          discounts = Math.max(0, Number(discountAmount) || 0)
          couponSnapshot = {
            _id: coupon._id,
            code: coupon.code,
            name: coupon.name,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discountAmount: discounts
          }
        }
      }
    }
    const tax = 0 // TODO: compute from config
    const total = subtotal - discounts + packagingFee + schedulingFee + deliveryFee + tax

    // Create Order first
    const order = await Order.create({
      customerId: ownerCustomerId,
      createdBy: actingUserId,
      location,
      type,
      items,
      pricing: { subtotal, discounts, packagingFee, schedulingFee, deliveryFee, tax, total },
      timing,
      addressId: type === 'delivery' ? addressId : null,
      paymentPreference,
      status: 'PLACED',
      paymentStatus: paymentPreference?.mode === 'pay_now' ? 'PENDING' : 'UNPAID',
      metadata: {
        ...metadata,
        packaging: selectedPackaging || null,
        coupon: couponSnapshot || null
      }
    })

    // Create Invoice linked to Order
    const invoice = await Invoice.create({
      orderId: order._id,
      number: generateInvoiceNumber(),
      lineItems: [
        { label: 'Items subtotal', amount: subtotal },
        ...(packagingFee ? [{ label: `Packaging${selectedPackaging?.name ? ` - ${selectedPackaging.name}` : ''}`, amount: packagingFee }] : []),
        ...(schedulingFee ? [{ label: 'Scheduling', amount: schedulingFee }] : []),
        ...(deliveryFee ? [{ label: 'Delivery', amount: deliveryFee }] : []),
        ...(tax ? [{ label: 'Tax', amount: tax }] : [])
      ],
      subtotal,
      discounts,
      fees: packagingFee + schedulingFee + deliveryFee,
      tax,
      total,
      balanceDue: total,
      paymentStatus: 'PENDING',
      metadata: {
        coupon: couponSnapshot || null
      }
    })

    order.invoiceId = invoice._id
    await order.save()

    // Mark coupon as used (increment usage) on order creation if applied
    if (couponSnapshot) {
      try {
        const c = await Coupon.findById(couponSnapshot._id)
        if (c) await c.incrementUsage(String(ownerCustomerId))
      } catch (_) {
        // Do not block order on coupon usage write
      }
    }

    // Optionally mark cart converted
    cart.status = 'converted'
    await cart.save()

    // Emit events
    io?.emit('order.created', { orderId: order._id.toString() })
    io?.emit('invoice.created', { invoiceId: invoice._id.toString(), orderId: order._id.toString() })

    return res.status(201).json({ success: true, data: { orderId: order._id, invoiceId: invoice._id } })
  } catch (err) {
    return next(err)
  }
}
```

#### `adminCreateOrder()`
**Purpose:** Allows admins to create an order for a specific customer by manually selecting items, bypassing the cart. It resolves item details from current product/SKU data, calculates pricing (including packaging and coupons), and initiates an associated invoice.  
**Access:** Private (Admin)  
**Validation:** `customerId`, `items` (array of `{ productId, skuId, quantity }`), `location`, `type`, and `paymentPreference` are required. Checks for customer existence, product availability, valid packaging, and coupon.  
**Process:** Fetches relevant details for manual items, calculates pricing, creates `Order` and `Invoice` documents, updates coupon usage, and emits events.  
**Response:** The ID of the newly created order and its associated invoice.

**Controller Implementation:**
```javascript
/**
 * Admin: Create order for a specific customer with manual item selection (bypassing cart)
 */
export const adminCreateOrder = async (req, res, next) => {
  try {
    const io = req.app.get('io')

    const {
      customerId, // Required: The customer for whom the order is created
      items: inputItems, // Required: Array of { productId, skuId, quantity }
      location,
      type,
      timing = { isScheduled: false, scheduledAt: null },
      addressId = null,
      paymentPreference,
      packagingOptionId = null,
      couponCode = null,
      metadata = {}
    } = req.body || {}

    if (!customerId) {
      return res.status(400).json({ success: false, message: 'customerId is required' })
    }

    if (!inputItems || !Array.isArray(inputItems) || inputItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Items are required' })
    }

    const actingUserId = req.user?._id || req.user?.id

    // 1. Resolve Item Details (Titles, Variants, Prices) from Products/SKUs
    const productIds = Array.from(new Set(inputItems.map(it => String(it.productId))))
    const products = await Product.find({ _id: { $in: productIds } })
    const productMap = new Map(products.map(p => [String(p._id), p]))

    const items = []
    for (const inputItem of inputItems) {
      const product = productMap.get(String(inputItem.productId))
      if (!product) {
        return res.status(404).json({ success: false, message: `Product ${inputItem.productId} not found` })
      }

      const sku = product.skus.id(inputItem.skuId)
      if (!sku) {
        return res.status(404).json({ success: false, message: `SKU ${inputItem.skuId} not found in product ${product.title}` })
      }

      // Check stock (Informational for admin, but we still validate)
      if (sku.stock < inputItem.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.title}. Available: ${sku.stock}` })
      }

      // Resolve variant options display (Helper would be better, but let's derive)
      // Note: Product model has attributes in SKUs
      const variantOptions = {}
      // If we need to populate names, we'd need more lookups, but let's keep it consistent with orderModel
      
      items.push({
        skuId: sku._id,
        productId: product._id,
        title: product.title,
        variantOptions: sku.variantOptions || {}, // Assuming SKU might have a flattened snapshot
        quantity: inputItem.quantity,
        unitPrice: sku.price,
        packagingChoice: undefined 
      })
    }

    // 2. Resolve packaging
    let selectedPackaging = null
    if (packagingOptionId) {
      const opt = await PackagingOption.findOne({ _id: packagingOptionId, isActive: true })
      if (opt) selectedPackaging = { id: String(opt._id), name: opt.name, price: opt.price }
    }
    if (!selectedPackaging) {
      const def = await PackagingOption.findOne({ isActive: true, isDefault: true })
      if (def) selectedPackaging = { id: String(def._id), name: def.name, price: def.price }
    }

    // 3. Pricing Calculation
    const subtotal = items.reduce((sum, it) => sum + (it.unitPrice * it.quantity), 0)
    const packagingFee = selectedPackaging ? Number(selectedPackaging.price || 0) : 0
    const schedulingFee = timing?.isScheduled ? 0 : 0 
    const deliveryFee = (type === 'delivery') ? 0 : 0 

    // 4. Coupon logic
    let couponSnapshot = null
    let discounts = 0
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: String(couponCode).toUpperCase() })
      if (coupon) {
        const validation = coupon.validateCoupon(String(customerId), subtotal)
        if (validation.isValid) {
          const discountAmount = coupon.calculateDiscount(subtotal)
          discounts = Math.max(0, Number(discountAmount) || 0)
          couponSnapshot = {
            _id: coupon._id,
            code: coupon.code,
            name: coupon.name,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discountAmount: discounts
          }
        }
      }
    }

    const tax = 0
    const total = subtotal - discounts + packagingFee + schedulingFee + deliveryFee + tax

    // 5. Create Order
    const order = await Order.create({
      customerId,
      createdBy: actingUserId,
      location,
      type,
      items,
      pricing: { subtotal, discounts, packagingFee, schedulingFee, deliveryFee, tax, total },
      timing,
      addressId: type === 'delivery' ? addressId : null,
      paymentPreference,
      status: 'PLACED', // Matches regular controller
      paymentStatus: paymentPreference?.mode === 'pay_now' ? 'PENDING' : 'UNPAID', // Matches regular controller
      metadata: {
        ...metadata,
        adminCreated: true,
        packaging: selectedPackaging || null,
        coupon: couponSnapshot || null
      }
    })

    // 6. Create Invoice
    const invoice = await Invoice.create({
      orderId: order._id,
      number: generateInvoiceNumber(),
      lineItems: [
        { label: 'Items subtotal', amount: subtotal },
        ...(packagingFee ? [{ label: `Packaging${selectedPackaging?.name ? ` - ${selectedPackaging.name}` : ''}`, amount: packagingFee }] : []),
        ...(schedulingFee ? [{ label: 'Scheduling', amount: schedulingFee }] : []),
        ...(deliveryFee ? [{ label: 'Delivery', amount: deliveryFee }] : []),
        ...(tax ? [{ label: 'Tax', amount: tax }] : [])
      ],
      subtotal,
      discounts,
      fees: packagingFee + schedulingFee + deliveryFee,
      tax,
      total,
      balanceDue: total,
      paymentStatus: 'PENDING',
      metadata: {
        coupon: couponSnapshot || null
      }
    })

    order.invoiceId = invoice._id
    await order.save()

    // Increment coupon usage
    if (couponSnapshot) {
      try {
        const c = await Coupon.findById(couponSnapshot._id)
        if (c) await c.incrementUsage(String(customerId))
      } catch (_) {}
    }

    // Emit events
    io?.emit('order.created', { orderId: order._id.toString() })
    io?.emit('invoice.created', { invoiceId: invoice._id.toString(), orderId: order._id.toString() })

    return res.status(201).json({ success: true, data: { orderId: order._id, invoiceId: invoice._id } })
  } catch (err) {
    return next(err)
  }
}
```

#### `getOrderById()`
**Purpose:** Retrieves a single order by its ID, with populated details such as invoice, receipt, address, customer, createdBy, and product item data.  
**Access:** Private (Authenticated User / Admin)  
**Validation:** `id` in params.  
**Process:** Finds the order by ID and populates related documents (invoiceId, receiptId, addressId, customerId, createdBy, items.productId).  
**Response:** A single order object with detailed information and all ObjectId references populated.

**Controller Implementation:**
```javascript
export const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params
    const order = await Order.findById(id)
      .populate('invoiceId')
      .populate('receiptId')
      .populate('addressId')
      .populate({ path: 'customerId', select: 'name email phone' })
      .populate({ path: 'createdBy', select: 'name email phone' })
      .populate({ path: 'items.productId', select: 'title primaryImage images basePrice' })

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
    return res.json({ success: true, data: { order } })
  } catch (err) {
    return next(err)
  }
}
```

#### `updateOrderStatus()`
**Purpose:** Updates the fulfillment status of an order.  
**Access:** Private (Admin)  
**Validation:** `id` in params, `status` in body.  
**Process:** Finds the order by ID and updates its status. Emits a `order.updated` Socket.io event.  
**Response:** Success message.

**Controller Implementation:**
```javascript
export const updateOrderStatus = async (req, res, next) => {
  try {
    const io = req.app.get('io')
    const { id } = req.params
    const { status } = req.body

    const order = await Order.findByIdAndUpdate(id, { status }, { new: true })
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })

    io?.to(`order_${order._id}`).emit('order.updated', { orderId: order._id.toString(), status: order.status })
    return res.json({ success: true })
  } catch (err) {
    return next(err)
  }
}
```

#### `assignRider()`
**Purpose:** Placeholder function for assigning a rider to an order. The actual implementation would involve creating or updating a `Delivery` document.  
**Access:** Private (Admin)  
**Validation:** `id` in params.  
**Process:** Returns a success message.  
**Response:** Success message (placeholder).

**Controller Implementation:**
```javascript
export const assignRider = async (req, res, next) => {
  try {
    // Placeholder; real implementation will create/update Delivery doc
    return res.json({ success: true })
  } catch (err) {
    return next(err)
  }
}
```

#### `getUserOrders()`
**Purpose:** Retrieves a paginated list of orders for the currently authenticated user.  
**Access:** Private (Authenticated User)  
**Validation:** Optional query parameters for pagination and filtering.  
**Process:** Builds an aggregation pipeline to filter by `customerId` (from `req.user._id`), join related collections (invoice), sort, and paginate orders.  
**Response:** Paginated list of the user's order objects.

**Controller Implementation:**
```javascript
export const getUserOrders = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      type,
      location,
      q
    } = req.query || {}

    const filters = { customerId: req.user._id }
    if (status) filters.status = status
    if (paymentStatus) filters.paymentStatus = paymentStatus
    if (type) filters.type = type
    if (location) filters.location = location

    const skip = (Number(page) - 1) * Number(limit)

    const pipeline = [
      { $match: filters },
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoiceId',
          foreignField: '_id',
          as: 'invoice'
        }
      },
      { $unwind: { path: '$invoice', preserveNullAndEmptyArrays: true } },
      // Search by invoice number if provided
      ...(q ? [{ $match: { 'invoice.number': { $regex: q, $options: 'i' } } }] : []),
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: Number(limit) },
            {
              $project: {
                _id: 1,
                createdAt: 1,
                status: 1,
                paymentStatus: 1,
                pricing: 1,
                invoice: { _id: '$invoice._id', number: '$invoice.number' }
              }
            }
          ],
          meta: [ { $count: 'total' } ]
        }
      }
    ]

    const result = await Order.aggregate(pipeline)
    const data = result[0]?.data || []
    const total = result[0]?.meta?.[0]?.total || 0

    return res.json({
      success: true,
      data: {
        orders: data,
        pagination: {
          currentPage: Number(page),
          pageSize: Number(limit),
          totalItems: total,
          totalPages: Math.max(1, Math.ceil(total / Number(limit)))
        }
      }
    })
  } catch (err) {
    return next(err)
  }
}
```

#### `getOrders()`
**Purpose:** Retrieves a paginated list of orders, with various filtering options (e.g., status, payment status, type, location, search by invoice number).  
**Access:** Private (Admin)  
**Validation:** Optional query parameters for pagination and filtering.  
**Process:** Builds an aggregation pipeline to filter, join related collections (invoice, customer), sort, and paginate orders.  
**Response:** Paginated list of order objects.

**Controller Implementation:**
```javascript
export const getOrders = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      type,
      location,
      q
    } = req.query || {}

    const filters = {}
    if (status) filters.status = status
    if (paymentStatus) filters.paymentStatus = paymentStatus
    if (type) filters.type = type
    if (location) filters.location = location

    // Basic text search over item titles via aggregation
    const skip = (Number(page) - 1) * Number(limit)

    const pipeline = [
      { $match: filters },
      // Join invoice and customer first
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoiceId',
          foreignField: '_id',
          as: 'invoice'
        }
      },
      { $unwind: { path: '$invoice', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'customerId',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      // Search by invoice number only
      ...(q ? [{ $match: { 'invoice.number': { $regex: q, $options: 'i' } } }] : []),
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: Number(limit) },
            {
              $project: {
                _id: 1,
                createdAt: 1,
                status: 1,
                paymentStatus: 1,
                pricing: 1,
                invoice: { _id: '$invoice._id', number: '$invoice.number' },
                customer: { _id: '$customer._id', name: '$customer.name', email: '$customer.email' }
              }
            }
          ],
          meta: [ { $count: 'total' } ]
        }
      }
    ]

    const result = await Order.aggregate(pipeline)
    const data = result[0]?.data || []
    const total = result[0]?.meta?.[0]?.total || 0

    return res.json({
      success: true,
      data: {
        orders: data,
        pagination: {
          currentPage: Number(page),
          pageSize: Number(limit),
          totalItems: total,
          totalPages: Math.max(1, Math.ceil(total / Number(limit)))
        }
      }
    })
  } catch (err) {
    return next(err)
  }
}
```

#### `deleteOrder()`
**Purpose:** Deletes an order from the system.  
**Access:** Private (Admin)  
**Validation:** `id` in params.  
**Process:** Finds and deletes the order document.  
**Response:** Success message.

**Controller Implementation:**
```javascript
export const deleteOrder = async (req, res, next) => {
  try {
    const { id } = req.params
    const order = await Order.findByIdAndDelete(id)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
    return res.json({ success: true })
  } catch (err) {
    return next(err)
  }
}
```

---

## 📦 Order Routes

### Base Path: `/api/orders`

### Router Implementation

**File: `../routes/orderRoute.js`**

```javascript
import express from "express"
import { authenticateToken, requireAdmin } from "../middlewares/auth.js"
import {
  createOrder,
  adminCreateOrder,
  getOrderById,
  updateOrderStatus,
  assignRider,
  getOrders,
  deleteOrder,
  getUserOrders
} from "../controllers/orderController.js"


const router = express.Router()


router.post('/', authenticateToken, createOrder)
router.post('/admin/create', authenticateToken, requireAdmin, adminCreateOrder)
router.get('/', authenticateToken, requireAdmin, getOrders)
router.get('/my-orders', authenticateToken, getUserOrders)
router.get('/:id', authenticateToken, getOrderById)
router.patch('/:id/status', authenticateToken, requireAdmin, updateOrderStatus)
router.patch('/:id/assign-rider', authenticateToken, requireAdmin, assignRider)
router.delete('/:id', authenticateToken, requireAdmin, deleteOrder)


export default router
```

### Route Details

#### `POST /api/orders`
**Headers:** `Authorization: Bearer <token>`  
**Body (JSON):**  
```json
{
  "customerId": "65e26b1c09b068c201383812", // Optional, defaults to authenticated user
  "location": "in_shop",                   // "in_shop" or "away"
  "type": "pickup",                        // "pickup" or "delivery"
  "timing": {
    "isScheduled": false,
    "scheduledAt": null
  },
  "addressId": null,                       // Required if type is "delivery"
  "paymentPreference": {
    "mode": "cash"                         // "post_to_bill", "pay_now", "cash", "cod"
    // "method": "mpesa_stk"                // Optional, "mpesa_stk" or "paystack_card" if mode "pay_now"
  },
  "packagingOptionId": "65e26b1c09b068c201383815", // Optional packaging option
  "couponCode": "SUMMER25",                // Optional coupon code
  "cartId": "65e26b1c09b068c201383814",    // Optional, uses active cart if not provided
  "metadata": {}                           // Optional, additional data
}
```
**Purpose:** Create a new order for the authenticated user (or a specified customer if admin) from their active cart.  
**Access:** Private (Authenticated User)  
**Response:** `201 Created` with the ID of the newly created order and its associated invoice.
```json
{
  {
    "success": true,
    "data": {
      "orderId": "65e26b1c09b068c201383820",
      "invoiceId": "65e26b1c09b068c201383821"
    }
  }
```

#### `POST /api/orders/admin/create`
  **Headers:** `Authorization: Bearer <token>`  
  **Body (JSON):**  
  ```json
  {
    "customerId": "65e26b1c09b068c201383812", // Required: Customer ID for the order
    "items": [                                // Required: Array of items
      {
        "productId": "65e26b1c09b068c201383814",
        "skuId": "65e26b1c09b068c201383813",
        "quantity": 2
      }
    ],
    "location": "in_shop",                   // "in_shop" or "away"
    "type": "pickup",                        // "pickup" or "delivery"
    "timing": {
      "isScheduled": false,
      "scheduledAt": null
    },
    "addressId": null,                       // Required if type is "delivery"
    "paymentPreference": {
      "mode": "cash"                         // "post_to_bill", "pay_now", "cash", "cod"
    },
    "packagingOptionId": "65e26b1c09b068c201383815", // Optional
    "couponCode": "SUMMER25",                // Optional
    "metadata": {}                           // Optional
  }
  ```
  **Purpose:** Create a new order for a specified customer by manually selecting items, bypassing the cart.  
  **Access:** Private (Admin)  
  **Response:** `201 Created` with the ID of the newly created order and its associated invoice.
  ```json
  {
    "success": true,
    "data": {
      "orderId": "65e26b1c09b068c201383820",
      "invoiceId": "65e26b1c09b068c201383821"
    }
  }
  ```

#### `GET /api/orders`
**Headers:** `Authorization: Bearer <token>`  
**Query Parameters:** `page`, `limit`, `status`, `paymentStatus`, `type`, `location`, `q` (search by invoice number).  
**Purpose:** Retrieve a paginated list of all orders in the system.  
**Access:** Private (Admin)  
**Response:** `200 OK` with paginated order data.
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "65e26b1c09b068c201383820",
        "createdAt": "2026-02-15T10:30:00.000Z",
        "status": "PLACED",
        "paymentStatus": "UNPAID",
        "pricing": {
          "subtotal": 1500,
          "discounts": 0,
          "packagingFee": 50,
          "schedulingFee": 0,
          "deliveryFee": 0,
          "tax": 0,
          "total": 1550
        },
        "invoice": {
          "_id": "65e26b1c09b068c201383821",
          "number": "INV-2026-123456"
        },
        "customer": {
          "_id": "65e26b1c09b068c201383812",
          "name": "John Doe",
          "email": "john@example.com"
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "pageSize": 10,
      "totalItems": 1,
      "totalPages": 1
    }
  }
}
```

#### `GET /api/orders/my-orders`
**Headers:** `Authorization: Bearer <token>`  
**Query Parameters:** `page`, `limit`, `status`, `paymentStatus`, `type`, `location`, `q` (search by invoice number).  
**Purpose:** Retrieve a paginated list of orders belonging to the authenticated user.  
**Access:** Private (Authenticated User)  
**Response:** `200 OK` with paginated order data.
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "65e26b1c09b068c201383820",
        "createdAt": "2026-02-15T10:30:00.000Z",
        "status": "PLACED",
        "paymentStatus": "UNPAID",
        "pricing": {
          "subtotal": 1500,
          "discounts": 0,
          "packagingFee": 50,
          "schedulingFee": 0,
          "deliveryFee": 0,
          "tax": 0,
          "total": 1550
        },
        "invoice": {
          "_id": "65e26b1c09b068c201383821",
          "number": "INV-2026-123456"
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "pageSize": 10,
      "totalItems": 1,
      "totalPages": 1
    }
  }
}
```

#### `GET /api/orders/:id`
**Headers:** `Authorization: Bearer <token>`  
**Parameters:** `id` (path) - The ID of the order to retrieve.  
**Purpose:** Retrieve a single order by its unique identifier, with populated details.  
**Access:** Private (Authenticated User / Admin)  
**Response:** `200 OK` with the order object.
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "65e26b1c09b068c201383820",
      "customerId": {
        "_id": "65e26b1c09b068c201383812",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+254712345678"
      },
      "createdBy": {
        "_id": "65e26b1c09b068c201383812",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+254712345678"
      },
      "location": "in_shop",
      "type": "pickup",
      "items": [
        {
          "skuId": "65e26b1c09b068c201383813",
          "productId": {
            "_id": "65e26b1c09b068c201383814",
            "title": "Classic White Sneaker",
            "primaryImage": "https://example.com/image.jpg",
            "images": [],
            "basePrice": 1500
          },
          "title": "Classic White Sneaker",
          "variantOptions": {},
          "quantity": 1,
          "unitPrice": 1500
        }
      ],
      "pricing": {
        "subtotal": 1500,
        "discounts": 0,
        "packagingFee": 50,
        "schedulingFee": 0,
        "deliveryFee": 0,
        "tax": 0,
        "total": 1550
      },
      "timing": {
        "isScheduled": false,
        "scheduledAt": null
      },
      "addressId": null,
      "paymentPreference": {
        "mode": "cash",
        "method": null
      },
      "status": "PLACED",
      "paymentStatus": "UNPAID",
      "invoiceId": {
        "_id": "65e26b1c09b068c201383821",
        "number": "INV-2026-123456"
      },
      "receiptId": null,
      "metadata": {},
      "createdAt": "2026-02-15T10:30:00.000Z",
      "updatedAt": "2026-02-15T10:30:00.000Z"
    }
  }
}
```

#### `PATCH /api/orders/:id/status`
**Headers:** `Authorization: Bearer <token>`  
**Parameters:** `id` (path) - The ID of the order to update.  
**Body (JSON):**  
```json
{
  "status": "CONFIRMED" // New fulfillment status
}
```
**Purpose:** Update the fulfillment status of an existing order.  
**Access:** Private (Admin)  
**Response:** `200 OK` with a success message.
```json
{
  "success": true
}
```

#### `PATCH /api/orders/:id/assign-rider`
**Headers:** `Authorization: Bearer <token>`  
**Parameters:** `id` (path) - The ID of the order.  
**Purpose:** Assign a rider to an order (currently a placeholder).  
**Access:** Private (Admin)  
**Response:** `200 OK` with a success message.
```json
{
  "success": true
}
```

#### `DELETE /api/orders/:id`
**Headers:** `Authorization: Bearer <token>`  
**Parameters:** `id` (path) - The ID of the order to delete.  
**Purpose:** Delete an order from the system.  
**Access:** Private (Admin)  
**Response:** `200 OK` with a success message.
```json
{
  "success": true
}
```

---

## 🔐 Middleware

-   `authenticateToken`: Used on all routes to ensure only authenticated users can perform order operations.
-   Further internal authorization is expected within the controller to ensure users can only see/modify their own orders unless they have specific roles (e.g., 'admin', 'staff').

---

## 📝 API Examples

### Create a New Order (from cart)
```bash
curl -X POST http://localhost:5000/api/orders 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <access_token>" 
  -d '{
    "customerId": "65e26b1c09b068c201383812",
    "location": "in_shop",
    "type": "pickup",
    "paymentPreference": {
      "mode": "cash"
    },
    "packagingOptionId": "65e26b1c09b068c201383815",
    "couponCode": "SUMMER25",
    "cartId": "65e26b1c09b068c201383814"
  }'
```

### Create a New Order (Admin, manual selection)
```bash
curl -X POST http://localhost:5000/api/orders/admin/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_access_token>" \
  -d '{
    "customerId": "65e26b1c09b068c201383812",
    "items": [
      {
        "productId": "65e26b1c09b068c201383814",
        "skuId": "65e26b1c09b068c201383813",
        "quantity": 2
      }
    ],
    "location": "in_shop",
    "type": "pickup",
    "paymentPreference": {
      "mode": "cash"
    }
  }'
```

### Get Orders (Customer)
```bash
curl -X GET "http://localhost:5000/api/orders/my-orders?page=1&limit=10&status=PLACED" 
  -H "Authorization: Bearer <customer_access_token>"
```

### Get Orders (Admin, search by invoice number)
```bash
curl -X GET "http://localhost:5000/api/orders?q=INV-2026-123456" 
  -H "Authorization: Bearer <admin_access_token>"
```

### Update Order Status (Admin)
```bash
curl -X PATCH http://localhost:5000/api/orders/<order_id>/status 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <admin_access_token>" 
  -d '{
    "status": "CONFIRMED"
  }'
```

---

## 🛡️ Security Features

-   **Authentication:** All order endpoints require a valid JWT token.
-   **Authorization:** Access to view, create, and modify orders is crucial. Implementations within the controller (`orderController.js`) should enforce role-based access control (RBAC) to ensure customers can only manage their own orders, while admins/staff can manage all orders.
-   **Data Integrity:** Orders are strongly linked to customers, products, addresses, invoices, and receipts via MongoDB ObjectIds. Pricing calculations are performed server-side to prevent client-side manipulation of financial data.
-   **Socket.io Events:** Real-time updates on order status changes are emitted securely via Socket.io to relevant parties.

---


## 🚨 Error Handling

Common HTTP status codes and their meanings:

-   `400 Bad Request`: Invalid input (e.g., empty cart, invalid pricing, missing required fields, invalid customer ID).
-   `401 Unauthorized`: Missing or invalid authentication token.
-   `403 Forbidden`: Access denied (e.g., a customer attempting to modify another user's order or a non-admin attempting admin-only order actions).
-   `404 Not Found`: The referenced cart, order, product, invoice, or packaging option was not found.
-   `500 Internal Server Error`: An unexpected server-side error occurred during processing.

---

## 📊 Database Indexes

-   `customerId: 1, createdAt: -1`: For efficient retrieval of a customer's orders, ordered by the most recent first.
-   `status: 1, createdAt: -1`: For efficient querying of orders by their fulfillment status, sorted by creation date.
-   `invoiceId: 1`: For quick lookup of the invoice linked to an order.
-   `receiptId: 1`: For quick lookup of the receipt linked to an order.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
