import express from "express"
import { 
    getUserProfile, 
    updateUserProfile, 
    changePassword,
    getNotificationPreferences, 
    updateNotificationPreferences,
    getAllUsers, 
    getUserById, 
    updateUserStatus,
    setUserAdmin,
    getUserRoles
} from "../controllers/userController.js"
import { verifyBearerToken, requireRole, requireAdmin } from "../utils/verify.js"
import { deleteUser } from "../controllers/userController.js"


const router = express.Router()


// Protected routes - require authentication
router.use(verifyBearerToken)


// User profile routes
router.get('/profile', getUserProfile)

router.put('/profile', updateUserProfile)

router.put('/change-password', changePassword)



// Notification preferences routes
router.get('/notifications', getNotificationPreferences)

router.put('/notifications', updateNotificationPreferences)


// Admin-only routes
router.get('/', requireAdmin, getAllUsers)

router.get('/:userId', requireAdmin, getUserById)

router.put('/:userId/status', requireAdmin, updateUserStatus)

router.delete('/:userId', requireAdmin, deleteUser)

/**
 * @swagger
 * /api/users/{userId}/admin:
 *   put:
 *     summary: Set user admin status
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isAdmin
 *             properties:
 *               isAdmin:
 *                 type: boolean
 *                 description: Admin status to set
 *                 example: true
 *     responses:
 *       200:
 *         description: User admin status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             name:
 *                               type: string
 *                             email:
 *                               type: string
 *                             isAdmin:
 *                               type: boolean
 *                             roles:
 *                               type: array
 *                               items:
 *                                 $ref: '#/components/schemas/Role'
 *       404:
 *         description: User not found
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
router.put('/:userId/admin', requireAdmin, setUserAdmin)

/**
 * @swagger
 * /api/users/{userId}/roles:
 *   get:
 *     summary: Get user roles
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User roles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             name:
 *                               type: string
 *                             email:
 *                               type: string
 *                             isAdmin:
 *                               type: boolean
 *                             roles:
 *                               type: array
 *                               items:
 *                                 $ref: '#/components/schemas/Role'
 *       404:
 *         description: User not found
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
router.get('/:userId/roles', requireAdmin, getUserRoles)

// Admin onboard customer with phone as initial password
import { adminCreateCustomer } from "../controllers/userController.js"
router.post('/admin-create', requireAdmin, adminCreateCustomer)


export default router