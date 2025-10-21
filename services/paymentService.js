import Payment from "../models/paymentModel.js"
import Invoice from "../models/invoiceModel.js"
import Order from "../models/orderModel.js"
import Receipt from "../models/receiptModel.js"
import Product from "../models/productModel.js"
import { initiateStkPush } from "./external/darajaService.js"
import { initTransaction } from "./external/paystackService.js"


const generateReceiptNumber = () => `RCP-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`


/**
 * Updates inventory by reducing SKU stock quantities for order items
 * @param {Object} order - The order object with items array
 */
const updateInventoryForOrder = async (order) => {
  if (!order.items || order.items.length === 0) {
    console.log('No items in order to update inventory')
    return
  }

  console.log(`Updating inventory for order ${order._id} with ${order.items.length} items`)

  for (const item of order.items) {
    try {
      // Find the product containing the SKU
      const product = await Product.findOne({ 
        'skus._id': item.skuId 
      })

      if (!product) {
        console.error(`Product not found for SKU ${item.skuId}`)
        continue
      }

      // Find the specific SKU within the product
      const sku = product.skus.id(item.skuId)
      if (!sku) {
        console.error(`SKU ${item.skuId} not found in product ${product._id}`)
        continue
      }

      // Check if there's enough stock
      if (sku.stock < item.quantity) {
        console.warn(`Insufficient stock for SKU ${item.skuId}. Available: ${sku.stock}, Requested: ${item.quantity}`)
        // Note: We still proceed to update inventory as the payment is already successful
        // This could happen in edge cases where stock was reduced between cart validation and payment
      }

      // Update the SKU stock
      const newStock = Math.max(0, sku.stock - item.quantity)
      sku.stock = newStock

      console.log(`Updated SKU ${item.skuId} stock: ${sku.stock + item.quantity} -> ${newStock} (reduced by ${item.quantity})`)

      // Save the product (which saves the updated SKU)
      await product.save()

    } catch (error) {
      console.error(`Failed to update inventory for SKU ${item.skuId}:`, error)
      // Continue with other items even if one fails
    }
  }

  console.log(`Completed inventory update for order ${order._id}`)
}


/**
 * Restores inventory by adding back SKU stock quantities for order items
 * Used for refunds, cancellations, or order reversals
 * @param {Object} order - The order object with items array
 */
export const restoreInventoryForOrder = async (order) => {
  if (!order.items || order.items.length === 0) {
    console.log('No items in order to restore inventory')
    return
  }

  console.log(`Restoring inventory for order ${order._id} with ${order.items.length} items`)

  for (const item of order.items) {
    try {
      // Find the product containing the SKU
      const product = await Product.findOne({ 
        'skus._id': item.skuId 
      })

      if (!product) {
        console.error(`Product not found for SKU ${item.skuId}`)
        continue
      }

      // Find the specific SKU within the product
      const sku = product.skus.id(item.skuId)
      if (!sku) {
        console.error(`SKU ${item.skuId} not found in product ${product._id}`)
        continue
      }

      // Restore the SKU stock
      const newStock = sku.stock + item.quantity
      sku.stock = newStock

      console.log(`Restored SKU ${item.skuId} stock: ${sku.stock - item.quantity} -> ${newStock} (added back ${item.quantity})`)

      // Save the product (which saves the updated SKU)
      await product.save()

    } catch (error) {
      console.error(`Failed to restore inventory for SKU ${item.skuId}:`, error)
      // Continue with other items even if one fails
    }
  }

  console.log(`Completed inventory restoration for order ${order._id}`)
}


export const createPaymentRecord = async ({ invoice, method, amount }) => {
  const payment = await Payment.create({
    invoiceId: invoice._id,
    method,
    amount,
    currency: 'KES',
    status: ['cash', 'post_to_bill', 'cod'].includes(method) ? 'SUCCESS' : 'INITIATED',
    processorRefs: {}
  })
  return payment
}


export const applySuccessfulPayment = async ({ invoice, payment, io, method }) => {
  payment.status = 'SUCCESS'
  await payment.save()

  invoice.paymentStatus = 'PAID'
  invoice.balanceDue = 0
  await invoice.save()

  const order = await Order.findById(invoice.orderId)
  if (!order) {
    throw new Error('Order not found for successful payment')
  }

  order.paymentStatus = 'PAID'
  await order.save()

  // Update SKU inventory - reduce stock for each order item
  try {
    await updateInventoryForOrder(order)
  } catch (inventoryError) {
    console.error('Failed to update inventory for order:', order._id, inventoryError)
    // Note: We don't throw here to avoid rolling back the payment
    // The payment is still valid even if inventory update fails
  }

  const receipt = await Receipt.create({
    orderId: invoice.orderId,
    invoiceId: invoice._id,
    receiptNumber: generateReceiptNumber(),
    amountPaid: payment.amount,
    paymentMethod: method,
    issuedAt: new Date(),
    pdfUrl: null,
    metadata: {
      coupon: invoice?.metadata?.coupon || null
    }
  })

  order.receiptId = receipt._id
  await order.save()

  io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status })
  io?.emit('receipt.created', { receiptId: receipt._id.toString(), orderId: String(invoice.orderId) })

  return { receipt }
}


export const initiateMpesaForInvoice = async ({ invoice, payment, amount, phone, callbackUrl }) => {
  const accountReference = invoice.number || invoice._id
  const res = await initiateStkPush({ amount, phone, accountReference, callbackUrl })
  payment.status = 'PENDING'
  // Update only the daraja nested subdocument to avoid assigning undefined to paystack
  if (!payment.processorRefs) payment.processorRefs = {}
  payment.processorRefs.daraja = {
    merchantRequestId: res.merchantRequestId,
    checkoutRequestId: res.checkoutRequestId
  }
  await payment.save()
  return res
}


export const initiatePaystackForInvoice = async ({ invoice, payment, amount, email, callbackUrl }) => {
  const reference = `INV-${invoice._id}-${Date.now()}`
  const res = await initTransaction({ amount, email, reference, callbackUrl, currency: process.env.PAYSTACK_CURRENCY || 'KES' })
  payment.status = 'PENDING'
  // Update only the paystack nested subdocument to avoid assigning undefined to daraja
  if (!payment.processorRefs) payment.processorRefs = {}
  payment.processorRefs.paystack = { reference }
  await payment.save()
  return res
}

