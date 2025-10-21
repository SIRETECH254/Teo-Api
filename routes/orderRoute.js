import express from "express"
import { authenticateToken } from "../middlewares/auth.js"
import { createOrder, getOrderById, updateOrderStatus, assignRider, getOrders, deleteOrder } from "../controllers/orderController.js"


const router = express.Router()


router.post('/', authenticateToken, createOrder)
router.get('/', authenticateToken, getOrders)
router.get('/:id', authenticateToken, getOrderById)
router.patch('/:id/status', authenticateToken, updateOrderStatus)
router.patch('/:id/assign-rider', authenticateToken, assignRider)
router.delete('/:id', authenticateToken, deleteOrder)


export default router

