import express from "express"
import { authenticateToken, requireAdmin } from "../middlewares/auth.js"
import { createOrder, getOrderById, updateOrderStatus, assignRider, getOrders, deleteOrder, getUserOrders } from "../controllers/orderController.js"


const router = express.Router()


router.post('/', authenticateToken, createOrder)
router.get('/', authenticateToken, requireAdmin, getOrders)
router.get('/my-orders', authenticateToken, getUserOrders)
router.get('/:id', authenticateToken, getOrderById)
router.patch('/:id/status', authenticateToken, requireAdmin, updateOrderStatus)
router.patch('/:id/assign-rider', authenticateToken, requireAdmin, assignRider)
router.delete('/:id', authenticateToken, requireAdmin, deleteOrder)


export default router

