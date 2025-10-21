import Order from "../models/orderModel.js"
import Invoice from "../models/invoiceModel.js"
import Cart from "../models/cartModel.js"
import Product from "../models/productModel.js"
import PackagingOption from "../models/packagingOptionModel.js"
import Coupon from "../models/couponModel.js"


// Helper: generate incremental-ish numbers (placeholder; replace with robust generator)
const generateInvoiceNumber = () => `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`


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

    return res.status(201).json({ success: true, data: { orderId: order._id } })
  } catch (err) {
    return next(err)
  }
}


export const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params
    const order = await Order.findById(id)
      .populate('invoiceId')
      .populate('receiptId')
      .populate('addressId')
      .populate({ path: 'customerId', select: 'name email phone' })
      .populate({ path: 'items.productId', select: 'title primaryImage images basePrice' })

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
    return res.json({ success: true, data: { order } })
  } catch (err) {
    return next(err)
  }
}


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


export const assignRider = async (req, res, next) => {
  try {
    // Placeholder; real implementation will create/update Delivery doc
    return res.json({ success: true })
  } catch (err) {
    return next(err)
  }
}


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

