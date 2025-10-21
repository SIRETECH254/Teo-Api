import express from 'express'
import { authenticateToken, authorizeRoles } from '../middlewares/auth.js'
import {
    getProductReviews,
    createReview,
    updateReview,
    deleteReview,
    getReviewById,
    approveReview,
    getUserReviews
} from '../controllers/reviewController.js'

const router = express.Router()

// Public routes
router.get('/products/:productId', getProductReviews)
router.get('/:reviewId', getReviewById)

// Protected routes (require authentication)
router.use(authenticateToken)

// User routes
router.get('/user/reviews', getUserReviews)
router.post('/products/:productId', createReview)
router.put('/:reviewId', updateReview)
router.delete('/:reviewId', deleteReview)

// Admin routes
router.patch('/:reviewId/approve', authorizeRoles(['admin']), approveReview)

export default router 