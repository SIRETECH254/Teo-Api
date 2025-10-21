import express from 'express'
import {
  getStoreConfig,
  createStoreConfig,
  updateStoreConfig,
  deleteStoreConfig,
  initStoreConfig,
  getStoreConfigStatus
} from '../controllers/storeConfigController.js'
import { verifyBearerToken, requireAdmin } from '../utils/verify.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     BusinessHours:
 *       type: object
 *       properties:
 *         day:
 *           type: string
 *           enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday]
 *         open:
 *           type: string
 *           pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *         close:
 *           type: string
 *           pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *         isOpen:
 *           type: boolean
 *           default: true
 *       required:
 *         - day
 *         - isOpen
 *
 *     Address:
 *       type: object
 *       properties:
 *         street:
 *           type: string
 *         city:
 *           type: string
 *         country:
 *           type: string
 *         postalCode:
 *           type: string
 *       required:
 *         - street
 *         - city
 *         - country
 *         - postalCode
 *
 *     PaymentMethods:
 *       type: object
 *       properties:
 *         mpesa:
 *           type: object
 *           properties:
 *             enabled:
 *               type: boolean
 *               default: false
 *             shortcode:
 *               type: string
 *         card:
 *           type: object
 *           properties:
 *             enabled:
 *               type: boolean
 *               default: false
 *             paystackKey:
 *               type: string
 *         cash:
 *           type: object
 *           properties:
 *             enabled:
 *               type: boolean
 *               default: false
 *             description:
 *               type: string
 *               default: 'Pay on delivery'
 *
 *     ShippingSettings:
 *       type: object
 *       properties:
 *         freeShippingThreshold:
 *           type: number
 *           default: 0
 *         baseDeliveryFee:
 *           type: number
 *           default: 0
 *         feePerKm:
 *           type: number
 *           default: 0
 *
 *     NotificationSettings:
 *       type: object
 *       properties:
 *         emailNotifications:
 *           type: boolean
 *           default: true
 *         smsNotifications:
 *           type: boolean
 *           default: true
 *         orderConfirmations:
 *           type: boolean
 *           default: true
 *         stockAlerts:
 *           type: boolean
 *           default: true
 *
 *     StoreConfig:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ObjectId
 *         storeName:
 *           type: string
 *           maxLength: 100
 *         storeEmail:
 *           type: string
 *           format: email
 *         storePhone:
 *           type: string
 *         storeAddress:
 *           $ref: '#/components/schemas/Address'
 *         businessHours:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/BusinessHours'
 *         paymentMethods:
 *           $ref: '#/components/schemas/PaymentMethods'
 *         shippingSettings:
 *           $ref: '#/components/schemas/ShippingSettings'
 *         notificationSettings:
 *           $ref: '#/components/schemas/NotificationSettings'
 *         isActive:
 *           type: boolean
 *           default: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - storeName
 *         - storeEmail
 *         - storePhone
 */

/**
 * @swagger
 * /api/store-config:
 *   get:
 *     summary: Get store configuration
 *     tags: [Store Configuration]
 *     security: []
 *     responses:
 *       200:
 *         description: Store configuration retrieved successfully
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
 *                     config:
 *                       oneOf:
 *                         - $ref: '#/components/schemas/StoreConfig'
 *                         - type: 'null'
 *       500:
 *         description: Server error
 */
router.get('/', getStoreConfig)

/**
 * @swagger
 * /api/store-config:
 *   post:
 *     summary: Create store configuration (Admin only)
 *     tags: [Store Configuration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               storeName:
 *                 type: string
 *                 example: "TEO KICKS Store"
 *               storeEmail:
 *                 type: string
 *                 format: email
 *                 example: "support@teokicks.com"
 *               storePhone:
 *                 type: string
 *                 example: "+254700000000"
 *               storeAddress:
 *                 $ref: '#/components/schemas/Address'
 *               businessHours:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/BusinessHours'
 *               paymentMethods:
 *                 $ref: '#/components/schemas/PaymentMethods'
 *               shippingSettings:
 *                 $ref: '#/components/schemas/ShippingSettings'
 *               notificationSettings:
 *                 $ref: '#/components/schemas/NotificationSettings'
 *               isActive:
 *                 type: boolean
 *                 example: true
 *             required:
 *               - storeName
 *               - storeEmail
 *               - storePhone
 *     responses:
 *       201:
 *         description: Store configuration created successfully
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
 *                   example: "Store configuration created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     config:
 *                       $ref: '#/components/schemas/StoreConfig'
 *       400:
 *         description: Configuration already exists or validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 */
router.post('/', verifyBearerToken, requireAdmin, createStoreConfig)

/**
 * @swagger
 * /api/store-config:
 *   put:
 *     summary: Update store configuration (Admin only)
 *     tags: [Store Configuration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               storeName:
 *                 type: string
 *                 example: "TEO KICKS Premium Store"
 *               storeEmail:
 *                 type: string
 *                 format: email
 *                 example: "support@teokicks.com"
 *               storePhone:
 *                 type: string
 *                 example: "+254700000000"
 *               storeAddress:
 *                 $ref: '#/components/schemas/Address'
 *               businessHours:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/BusinessHours'
 *               paymentMethods:
 *                 $ref: '#/components/schemas/PaymentMethods'
 *               shippingSettings:
 *                 $ref: '#/components/schemas/ShippingSettings'
 *               notificationSettings:
 *                 $ref: '#/components/schemas/NotificationSettings'
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Store configuration updated successfully
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
 *                   example: "Store configuration updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     config:
 *                       $ref: '#/components/schemas/StoreConfig'
 *       404:
 *         description: Store configuration not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 */
router.put('/', verifyBearerToken, requireAdmin, updateStoreConfig)

/**
 * @swagger
 * /api/store-config:
 *   delete:
 *     summary: Delete store configuration (Admin only)
 *     tags: [Store Configuration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Store configuration deleted successfully
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
 *                   example: "Store configuration deleted successfully"
 *       404:
 *         description: Store configuration not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 */
router.delete('/', verifyBearerToken, requireAdmin, deleteStoreConfig)

/**
 * @swagger
 * /api/store-config/status:
 *   get:
 *     summary: Get store configuration status
 *     tags: [Store Configuration]
 *     security: []
 *     responses:
 *       200:
 *         description: Configuration status retrieved successfully
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
 *                     exists:
 *                       type: boolean
 *                       example: true
 *                     config:
 *                       oneOf:
 *                         - $ref: '#/components/schemas/StoreConfig'
 *                         - type: 'null'
 *       500:
 *         description: Server error
 */
router.get('/status', getStoreConfigStatus)

/**
 * @swagger
 * /api/store-config/init:
 *   post:
 *     summary: Initialize default store configuration (Admin only)
 *     tags: [Store Configuration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration already exists
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
 *                   example: "Store configuration already exists"
 *                 data:
 *                   type: object
 *                   properties:
 *                     config:
 *                       $ref: '#/components/schemas/StoreConfig'
 *       201:
 *         description: Default configuration created successfully
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
 *                   example: "Default store configuration created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     config:
 *                       $ref: '#/components/schemas/StoreConfig'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 */
router.post('/init', verifyBearerToken, requireAdmin, initStoreConfig)

export default router