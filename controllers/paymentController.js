import Payment from "../models/paymentModel.js"
import Invoice from "../models/invoiceModel.js"
import Order from "../models/orderModel.js"
import Receipt from "../models/receiptModel.js"
import { initiateMpesaForInvoice, initiatePaystackForInvoice, createPaymentRecord, applySuccessfulPayment } from "../services/paymentService.js"
import { parseCallback as parseDarajaCallback, queryStkPushStatus } from "../services/external/darajaService.js"
import { parseWebhook as parsePaystackWebhook } from "../services/external/paystackService.js"


const generateReceiptNumber = () => `RCP-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`


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


export const getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params
    const payment = await Payment.findById(id)
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' })
    return res.json({ success: true, data: { payment } })
  } catch (err) {
    return next(err)
  }
}


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


// Webhooks
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

    console.log(parsed)

    console.log(payload)

    console.log("this is daraja callback")

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


// New: Pay invoice (initiates real integrations)
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


// New: Query M-Pesa Express status for a payment (fallback polling)
export const queryMpesaStatus = async (req, res, next) => {
  try {
    const { paymentId } = req.params
    const { invoiceId } = req.query || {}
    let payment = await Payment.findById(paymentId)
    if (!payment && invoiceId) {
      // Try to locate the latest mpesa payment for this invoice as a fallback
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

    // Map Daraja result codes: 0 = success, others are pending/failure
    const status = result.resultCode === 0 ? 'SUCCESS' : (payment.status === 'SUCCESS' ? 'SUCCESS' : 'PENDING')
    return res.json({ success: true, data: { status, resultCode: result.resultCode, resultDesc: result.resultDesc } })
  } catch (err) {
    return next(err)
  }
}


// New: Query M-Pesa Express status by checkoutRequestId (simplified fallback)
export const queryMpesaByCheckoutId = async (req, res, next) => {
  try {
    const { checkoutRequestId } = req.params

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

