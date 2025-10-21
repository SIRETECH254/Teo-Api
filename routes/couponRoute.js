import express from 'express'
import {
    createCoupon,
    getAllCoupons,
    getCouponById,
    updateCoupon,
    deleteCoupon,
    validateCoupon,
    applyCoupon,
    getCouponStats,
    generateNewCode
} from '../controllers/couponController.js'
import { authenticateToken, authorizeRoles } from '../middlewares/auth.js'

const router = express.Router()

/**
 * @swagger
 * /api/coupons/validate:
 *   post:
 *     summary: Validate coupon code
 *     tags: [Coupons]
 *     parameters:
 *       - in: query
 *         name: orderAmount
 *         required: true
 *         schema:
 *           type: number
 *         description: Order amount to validate against minimum requirements
 *         example: 1000
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 description: Coupon code to validate
 *                 example: "SAVE20"
 *     responses:
 *       200:
 *         description: Coupon is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     coupon:
 *                       $ref: '#/components/schemas/Coupon'
 *                     discountAmount:
 *                       type: number
 *                       description: Calculated discount amount
 *                       example: 200
 *                     finalAmount:
 *                       type: number
 *                       description: Final amount after discount
 *                       example: 800
 *       400:
 *         description: Invalid coupon code or conditions not met
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Coupon not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Public routes
router.post('/validate', validateCoupon)

// Protected routes (require authentication)
router.use(authenticateToken)

/**
 * @swagger
 * /api/coupons/apply:
 *   post:
 *     summary: Apply coupon to order
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - orderAmount
 *             properties:
 *               code:
 *                 type: string
 *                 description: Coupon code to apply
 *                 example: "SAVE20"
 *               orderAmount:
 *                 type: number
 *                 description: Order amount to apply coupon to
 *                 example: 1000
 *     responses:
 *       200:
 *         description: Coupon applied successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Coupon applied successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     coupon:
 *                       $ref: '#/components/schemas/Coupon'
 *                     discountAmount:
 *                       type: number
 *                       description: Applied discount amount
 *                       example: 200
 *                     finalAmount:
 *                       type: number
 *                       description: Final amount after discount
 *                       example: 800
 *       400:
 *         description: Invalid coupon or conditions not met
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Coupon not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/apply', applyCoupon)

// Admin routes (require admin role)
router.use(authorizeRoles(['admin']))

/**
 * @swagger
 * /api/coupons:
 *   post:
 *     summary: Create a new coupon
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - discountType
 *               - discountValue
 *             properties:
 *               name:
 *                 type: string
 *                 description: Coupon name
 *                 example: "Summer Sale"
 *               description:
 *                 type: string
 *                 description: Coupon description
 *                 example: "Get 20% off on all items"
 *               discountType:
 *                 type: string
 *                 enum: [percentage, fixed]
 *                 description: Type of discount
 *                 example: "percentage"
 *               discountValue:
 *                 type: number
 *                 description: Discount value (percentage or fixed amount)
 *                 example: 20
 *               minimumAmount:
 *                 type: number
 *                 description: Minimum order amount
 *                 example: 500
 *               maximumDiscount:
 *                 type: number
 *                 description: Maximum discount amount
 *                 example: 1000
 *               usageLimit:
 *                 type: integer
 *                 description: Total usage limit
 *                 example: 100
 *               perUserLimit:
 *                 type: integer
 *                 description: Usage limit per user
 *                 example: 1
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *                 description: Expiry date
 *                 example: "2024-12-31T23:59:59Z"
 *               applicableProducts:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Applicable product IDs
 *                 example: ["60f7b3b3b3b3b3b3b3b3b3", "60f7b3b3b3b3b3b3b3b3b4"]
 *               applicableCategories:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Applicable category IDs
 *                 example: ["60f7b3b3b3b3b3b3b3b3b5"]
 *     responses:
 *       201:
 *         description: Coupon created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Coupon created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Coupon'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', createCoupon)

/**
 * @swagger
 * /api/coupons:
 *   get:
 *     summary: Get all coupons (admin only)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for coupon name or code
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, expired]
 *         description: Filter by coupon status
 *     responses:
 *       200:
 *         description: Coupons retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     coupons:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Coupon'
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', getAllCoupons)

/**
 * @swagger
 * /api/coupons/stats:
 *   get:
 *     summary: Get coupon statistics (admin only)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Coupon statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalCoupons:
 *                       type: integer
 *                       description: Total number of coupons
 *                       example: 25
 *                     activeCoupons:
 *                       type: integer
 *                       description: Number of active coupons
 *                       example: 15
 *                     expiredCoupons:
 *                       type: integer
 *                       description: Number of expired coupons
 *                       example: 5
 *                     totalUsage:
 *                       type: integer
 *                       description: Total coupon usage count
 *                       example: 1250
 *                     totalDiscount:
 *                       type: number
 *                       description: Total discount amount given
 *                       example: 25000
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/stats', getCouponStats)

/**
 * @swagger
 * /api/coupons/{couponId}:
 *   get:
 *     summary: Get coupon by ID (admin only)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: couponId
 *         required: true
 *         schema:
 *           type: string
 *         description: Coupon ID
 *     responses:
 *       200:
 *         description: Coupon retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Coupon'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Coupon not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:couponId', getCouponById)

/**
 * @swagger
 * /api/coupons/{couponId}:
 *   put:
 *     summary: Update coupon (admin only)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: couponId
 *         required: true
 *         schema:
 *           type: string
 *         description: Coupon ID to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Coupon name
 *                 example: "Updated Summer Sale"
 *               description:
 *                 type: string
 *                 description: Coupon description
 *                 example: "Get 25% off on all items"
 *               discountType:
 *                 type: string
 *                 enum: [percentage, fixed]
 *                 description: Type of discount
 *                 example: "percentage"
 *               discountValue:
 *                 type: number
 *                 description: Discount value
 *                 example: 25
 *               minimumAmount:
 *                 type: number
 *                 description: Minimum order amount
 *                 example: 750
 *               maximumDiscount:
 *                 type: number
 *                 description: Maximum discount amount
 *                 example: 1500
 *               usageLimit:
 *                 type: integer
 *                 description: Total usage limit
 *                 example: 200
 *               perUserLimit:
 *                 type: integer
 *                 description: Usage limit per user
 *                 example: 2
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *                 description: Expiry date
 *                 example: "2024-12-31T23:59:59Z"
 *               isActive:
 *                 type: boolean
 *                 description: Whether coupon is active
 *                 example: true
 *     responses:
 *       200:
 *         description: Coupon updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Coupon updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Coupon'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Coupon not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/:couponId', updateCoupon)

/**
 * @swagger
 * /api/coupons/{couponId}:
 *   delete:
 *     summary: Delete coupon (admin only)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: couponId
 *         required: true
 *         schema:
 *           type: string
 *         description: Coupon ID to delete
 *     responses:
 *       200:
 *         description: Coupon deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Coupon deleted successfully"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Coupon not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:couponId', deleteCoupon)

/**
 * @swagger
 * /api/coupons/{couponId}/generate-code:
 *   patch:
 *     summary: Generate new coupon code (admin only)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: couponId
 *         required: true
 *         schema:
 *           type: string
 *         description: Coupon ID to generate new code for
 *     responses:
 *       200:
 *         description: New coupon code generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "New coupon code generated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     coupon:
 *                       $ref: '#/components/schemas/Coupon'
 *                     newCode:
 *                       type: string
 *                       description: Newly generated coupon code
 *                       example: "SUMMER2024ABC"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Coupon not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch('/:couponId/generate-code', generateNewCode)

export default router 