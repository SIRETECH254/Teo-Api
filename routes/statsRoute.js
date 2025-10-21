import express from "express"
import { authenticateToken, requireAdmin } from "../middlewares/auth.js"
import { getOverviewStats, getAnalytics } from "../controllers/statsController.js"


const router = express.Router()


// Protected admin stats
router.get('/overview', authenticateToken, requireAdmin, getOverviewStats)
router.get('/analytics', authenticateToken, requireAdmin, getAnalytics)


export default router

