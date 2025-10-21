import express from "express"
import { authenticateToken } from "../middlewares/auth.js"
import { createInvoice, getInvoiceById } from "../controllers/invoiceController.js"


const router = express.Router()


/**
 * @swagger
 * tags:
 *   - name: Invoices
 *     description: Invoice management
 */

/**
 * @swagger
 * /invoices:
 *   post:
 *     summary: Create invoice for an order
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', authenticateToken, createInvoice)

/**
 * @swagger
 * /invoices/{id}:
 *   get:
 *     summary: Get invoice by ID
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/:id', authenticateToken, getInvoiceById)


export default router

