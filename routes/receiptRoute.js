import express from "express"
import { authenticateToken } from "../middlewares/auth.js"
import { createReceipt, getReceiptById } from "../controllers/receiptController.js"


const router = express.Router()



router.post('/', authenticateToken, createReceipt)


router.get('/:id', authenticateToken, getReceiptById)


export default router

