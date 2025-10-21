import express from "express"
import { authenticateToken } from "../middlewares/auth.js"
import { initiatePayment, getPaymentById, markCashCollected, mpesaWebhook, paystackWebhook, payInvoice, queryMpesaStatus, queryMpesaByCheckoutId } from "../controllers/paymentController.js"


const router = express.Router()




router.post('/initiate', authenticateToken, initiatePayment)


router.post('/pay-invoice', authenticateToken, payInvoice)


router.get('/:id', authenticateToken, getPaymentById)


router.patch('/:id/cash', authenticateToken, markCashCollected)

// Webhooks (public)
router.post('/webhooks/mpesa', mpesaWebhook)


router.post('/webhooks/paystack', paystackWebhook)

// Fallback polling for M-Pesa status
router.get('/:id/mpesa-status', authenticateToken, queryMpesaStatus)

// Query M-Pesa status by checkoutRequestId
router.get('/mpesa-status/:checkoutRequestId', authenticateToken, queryMpesaByCheckoutId)


export default router

