import Invoice from "../models/invoiceModel.js"
import Order from "../models/orderModel.js"


const generateInvoiceNumber = () => `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`


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


export const getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params
    const invoice = await Invoice.findById(id)
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' })
    return res.json({ success: true, data: { invoice } })
  } catch (err) {
    return next(err)
  }
}

