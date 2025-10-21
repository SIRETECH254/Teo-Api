import Receipt from "../models/receiptModel.js"
import Invoice from "../models/invoiceModel.js"
import Order from "../models/orderModel.js"


const generateReceiptNumber = () => `RCP-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`


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

