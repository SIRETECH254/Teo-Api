# 💰 TEO KICKS API - Coupon Management Documentation

## 📋 Table of Contents
- [Coupon Management Overview](#coupon-management-overview)
- [Coupon Model](#-coupon-model)
- [Coupon Controller](#-coupon-controller)
- [Coupon Routes](#-coupon-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Coupon Management Overview

Coupon Management provides functionality for creating, managing, and applying discount coupons within the TEO KICKS API system. This includes defining various types of discounts, usage limits, expiry dates, and applicability to specific products or categories. Coupons can be validated and applied to orders, affecting the final price.

---

## 👤 Coupon Model

### Schema Definition
```typescript
interface ICoupon {
  _id: string;
  code: string;
  name: string;
  description?: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minimumOrderAmount: number;
  maximumDiscountAmount?: number;
  isActive: boolean;
  hasExpiry: boolean;
  expiryDate?: Date;
  hasUsageLimit: boolean;
  usageLimit?: number;
  usedCount: number;
  isFirstTimeOnly: boolean;
  applicableProducts: string[]; // Product ObjectIds
  applicableCategories: string[]; // Category Objectids
  excludedProducts: string[]; // Product ObjectIds
  excludedCategories: string[]; // Category ObjectIds
  createdBy: string; // User ObjectId
  lastUsedBy: Array<{
    user: string; // User ObjectId
    usedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  // Virtuals
  isExpired: boolean;
  isUsageLimitReached: boolean;
  isValid: boolean;
  remainingUsage?: number | null;
}
```

### Model Implementation

**File: `../models/couponModel.js`**

```javascript
import mongoose from 'mongoose'

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    minimumOrderAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    maximumDiscountAmount: {
        type: Number,
        min: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    hasExpiry: {
        type: Boolean,
        default: false
    },
    expiryDate: {
        type: Date
    },
    hasUsageLimit: {
        type: Boolean,
        default: false
    },
    usageLimit: {
        type: Number,
        min: 1
    },
    usedCount: {
        type: Number,
        default: 0,
        min: 0
    },
    isFirstTimeOnly: {
        type: Boolean,
        default: false
    },
    applicableProducts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    applicableCategories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],
    excludedProducts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    excludedCategories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastUsedBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        usedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
})

// Indexes for better performance
couponSchema.index({ isActive: 1, expiryDate: 1 })
couponSchema.index({ createdBy: 1 })

// Virtual for checking if coupon is expired
couponSchema.virtual('isExpired').get(function() {
    if (!this.hasExpiry || !this.expiryDate) {
        return false
    }
    return new Date() > this.expiryDate
})

// Virtual for checking if coupon usage limit is reached
couponSchema.virtual('isUsageLimitReached').get(function() {
    if (!this.hasUsageLimit) {
        return false
    }
    return this.usedCount >= this.usageLimit
})

// Virtual for checking if coupon is valid
couponSchema.virtual('isValid').get(function() {
    return this.isActive && !this.isExpired && !this.isUsageLimitReached
})

// Virtual for remaining usage count
couponSchema.virtual('remainingUsage').get(function() {
    if (!this.hasUsageLimit) {
        return null // No limit
    }
    return Math.max(0, this.usageLimit - this.usedCount)
})

// Method to generate unique coupon code
couponSchema.statics.generateUniqueCode = async function(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code
    let isUnique = false
    
    while (!isUnique) {
        code = ''
        for (let i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        
        // Check if code already exists
        const existingCoupon = await this.findOne({ code })
        if (!existingCoupon) {
            isUnique = true
        }
    }
    
    return code
}

// Method to validate coupon
couponSchema.methods.validateCoupon = function(userId, orderAmount = 0) {
    // Check if coupon is active
    if (!this.isActive) {
        return { isValid: false, message: 'Coupon is not active' }
    }
    
    // Check if coupon is expired
    if (this.isExpired) {
        return { isValid: false, message: 'Coupon has expired' }
    }
    
    // Check if usage limit is reached
    if (this.isUsageLimitReached) {
        return { isValid: false, message: 'Coupon usage limit reached' }
    }
    
    // Check minimum order amount
    if (orderAmount < this.minimumOrderAmount) {
        return { 
            isValid: false, 
            message: `Minimum order amount of ${this.minimumOrderAmount} required` 
        }
    }
    
    // Check if first time only and user has used it before
    if (this.isFirstTimeOnly) {
        const hasUsedBefore = this.lastUsedBy.some(usage => 
            usage.user.toString() === userId
        )
        if (hasUsedBefore) {
            return { isValid: false, message: 'Coupon can only be used once per customer' }
        }
    }
    
    return { isValid: true, message: 'Coupon is valid' }
}

// Method to calculate discount amount
couponSchema.methods.calculateDiscount = function(orderAmount) {
    let discountAmount = 0
    
    if (this.discountType === 'percentage') {
        discountAmount = (orderAmount * this.discountValue) / 100
    } else {
        discountAmount = this.discountValue
    }
    
    // Apply maximum discount limit if set
    if (this.maximumDiscountAmount && discountAmount > this.maximumDiscountAmount) {
        discountAmount = this.maximumDiscountAmount
    }
    
    // Ensure discount doesn't exceed order amount
    discountAmount = Math.min(discountAmount, orderAmount)
    
    return Math.round(discountAmount * 100) / 100 // Round to 2 decimal places
}

// Method to increment usage count
couponSchema.methods.incrementUsage = function(userId) {
    this.usedCount += 1
    this.lastUsedBy.push({
        user: userId,
        usedAt: new Date()
    })
    return this.save()
}

// Ensure virtual fields are serialized
couponSchema.set('toJSON', { virtuals: true })
couponSchema.set('toObject', { virtuals: true })

const Coupon = mongoose.model('Coupon', couponSchema)

export default Coupon
```

### Validation Rules
```javascript
code:        { required: true, type: String, unique: true, uppercase: true, trim: true }
name:        { required: true, type: String, trim: true }
description: { type: String, trim: true }
discountType: { required: true, type: String, enum: ['percentage', 'fixed'] }
discountValue: { required: true, type: Number, min: 0 }
minimumOrderAmount: { type: Number, default: 0, min: 0 }
maximumDiscountAmount: { type: Number, min: 0 }
isActive:    { type: Boolean, default: true }
hasExpiry:   { type: Boolean, default: false }
expiryDate:  { type: Date }
hasUsageLimit: { type: Boolean, default: false }
usageLimit:  { type: Number, min: 1 }
usedCount:   { type: Number, default: 0, min: 0 }
isFirstTimeOnly: { type: Boolean, default: false }
applicableProducts: { type: Array of ObjectId, ref: 'Product' }
applicableCategories: { type: Array of ObjectId, ref: 'Category' }
excludedProducts: { type: Array of ObjectId, ref: 'Product' }
excludedCategories: { type: Array of ObjectId, ref: 'Category' }
createdBy:   { required: true, type: ObjectId, ref: 'User' }
lastUsedBy:  { type: Array of { user: ObjectId, usedAt: Date } }
```

---

## 🎮 Coupon Controller

### Required Imports
```javascript
import Coupon from '../models/couponModel.js'
import { errorHandler } from '../utils/error.js'
```

### Functions Overview

#### `createCoupon()`
**Purpose:** Create a new coupon in the system.  
**Access:** Private (Admin)  
**Validation:** `name`, `discountType`, `discountValue` are required. Performs validation on discount value, expiry date, and usage limits.  
**Process:** Generates a unique coupon code, creates a new `Coupon` document, and saves it.  
**Response:** The newly created coupon object.

**Controller Implementation:**
```javascript
export const createCoupon = async (req, res, next) => {
    try {
        const {
            name,
            description,
            discountType,
            discountValue,
            minimumOrderAmount,
            maximumDiscountAmount,
            hasExpiry,
            expiryDate,
            hasUsageLimit,
            usageLimit,
            isFirstTimeOnly,
            applicableProducts,
            applicableCategories,
            excludedProducts,
            excludedCategories
        } = req.body

        // Validate required fields
        if (!name || !discountType || !discountValue) {
            return next(errorHandler(400, 'Name, discount type, and discount value are required'))
        }

        // Validate discount value
        if (discountValue <= 0) {
            return next(errorHandler(400, 'Discount value must be greater than 0'))
        }

        // Validate percentage discount
        if (discountType === 'percentage' && discountValue > 100) {
            return next(errorHandler(400, 'Percentage discount cannot exceed 100%'))
        }

        // Validate expiry date
        if (hasExpiry && expiryDate) {
            const expiry = new Date(expiryDate)
            if (expiry <= new Date()) {
                return next(errorHandler(400, 'Expiry date must be in the future'))
            }
        }

        // Validate usage limit
        if (hasUsageLimit && (!usageLimit || usageLimit < 1)) {
            return next(errorHandler(400, 'Usage limit must be at least 1'))
        }

        // Generate unique coupon code
        const code = await Coupon.generateUniqueCode()

        const coupon = new Coupon({
            code,
            name,
            description,
            discountType,
            discountValue,
            minimumOrderAmount: minimumOrderAmount || 0,
            maximumDiscountAmount,
            hasExpiry,
            expiryDate: hasExpiry ? expiryDate : null,
            hasUsageLimit,
            usageLimit: hasUsageLimit ? usageLimit : null,
            isFirstTimeOnly: isFirstTimeOnly || false,
            applicableProducts: applicableProducts || [],
            applicableCategories: applicableCategories || [],
            excludedProducts: excludedProducts || [],
            excludedCategories: excludedCategories || [],
            createdBy: req.user._id
        })

        await coupon.save()

        res.status(201).json({
            success: true,
            message: 'Coupon created successfully',
            data: coupon
        })
    } catch (error) {
        next(error)
    }
}
```

#### `getAllCoupons()`
**Purpose:** Retrieve all coupons with optional pagination, search, and status filters.  
**Access:** Private (Admin)  
**Validation:** Optional query parameters for `page`, `limit`, `sort`, `search`, `status`.  
**Process:** Queries coupons based on filters and returns paginated results.  
**Response:** Paginated list of coupon objects.

**Controller Implementation:**
```javascript
export const getAllCoupons = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, sort = '-createdAt', search, status } = req.query

        const skip = (page - 1) * limit

        // Build query
        let query = {}

        // Search filter
        if (search) {
            query.$or = [
                { code: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ]
        }

        // Status filter
        if (status === 'active') {
            query.isActive = true
        } else if (status === 'inactive') {
            query.isActive = false
        }

        const coupons = await Coupon.find(query)
            .populate('createdBy', 'name email')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))

        const total = await Coupon.countDocuments(query)

        res.status(200).json({
            success: true,
            data: {
                coupons,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalCoupons: total,
                    hasNextPage: skip + coupons.length < total,
                    hasPrevPage: page > 1
                }
            }
        })
    } catch (error) {
        next(error)
    }
}
```

#### `getCouponById()`
**Purpose:** Retrieve a single coupon by its ID.  
**Access:** Private (Admin)  
**Validation:** `couponId` in params.  
**Process:** Finds the coupon by ID and populates `createdBy`, `applicableProducts`, `applicableCategories`, etc.  
**Response:** A single coupon object.

**Controller Implementation:**
```javascript
export const getCouponById = async (req, res, next) => {
    try {
        const { couponId } = req.params

        const coupon = await Coupon.findById(couponId)
            .populate('createdBy', 'name email')
            .populate('applicableProducts', 'title')
            .populate('applicableCategories', 'name')
            .populate('excludedProducts', 'title')
            .populate('excludedCategories', 'name')
            .populate('lastUsedBy.user', 'name email')

        if (!coupon) {
            return next(errorHandler(404, 'Coupon not found'))
        }

        res.status(200).json({
            success: true,
            data: coupon
        })
    } catch (error) {
        next(error)
    }
}
```

#### `updateCoupon()`
**Purpose:** Update an existing coupon.  
**Access:** Private (Admin)  
**Validation:** `couponId` in params. Performs validation on updated fields.  
**Process:** Finds and updates the coupon.  
**Response:** The updated coupon object.

**Controller Implementation:**
```javascript
export const updateCoupon = async (req, res, next) => {
    try {
        const { couponId } = req.params
        const {
            name,
            description,
            discountType,
            discountValue,
            minimumOrderAmount,
            maximumDiscountAmount,
            isActive,
            hasExpiry,
            expiryDate,
            hasUsageLimit,
            usageLimit,
            isFirstTimeOnly,
            applicableProducts,
            applicableCategories,
            excludedProducts,
            excludedCategories
        } = req.body

        const coupon = await Coupon.findById(couponId)

        if (!coupon) {
            return next(errorHandler(404, 'Coupon not found'))
        }

        // Validate discount value if provided
        if (discountValue !== undefined) {
            if (discountValue <= 0) {
                return next(errorHandler(400, 'Discount value must be greater than 0'))
            }
            if (discountType === 'percentage' && discountValue > 100) {
                return next(errorHandler(400, 'Percentage discount cannot exceed 100%'))
            }
        }

        // Validate expiry date if provided
        if (hasExpiry && expiryDate) {
            const expiry = new Date(expiryDate)
            if (expiry <= new Date()) {
                return next(errorHandler(400, 'Expiry date must be in the future'))
            }
        }

        // Validate usage limit if provided
        if (hasUsageLimit && usageLimit !== undefined) {
            if (usageLimit < 1) {
                return next(errorHandler(400, 'Usage limit must be at least 1'))
            }
            if (usageLimit < coupon.usedCount) {
                return next(errorHandler(400, 'Usage limit cannot be less than current usage count'))
            }
        }

        // Update fields
        if (name !== undefined) coupon.name = name
        if (description !== undefined) coupon.description = description
        if (discountType !== undefined) coupon.discountType = discountType
        if (discountValue !== undefined) coupon.discountValue = discountValue
        if (minimumOrderAmount !== undefined) coupon.minimumOrderAmount = minimumOrderAmount
        if (maximumDiscountAmount !== undefined) coupon.maximumDiscountAmount = maximumDiscountAmount
        if (isActive !== undefined) coupon.isActive = isActive
        if (hasExpiry !== undefined) coupon.hasExpiry = hasExpiry
        if (expiryDate !== undefined) coupon.expiryDate = hasExpiry ? expiryDate : null
        if (hasUsageLimit !== undefined) coupon.hasUsageLimit = hasUsageLimit
        if (usageLimit !== undefined) coupon.usageLimit = hasUsageLimit ? usageLimit : null
        if (isFirstTimeOnly !== undefined) coupon.isFirstTimeOnly = isFirstTimeOnly
        if (applicableProducts !== undefined) coupon.applicableProducts = applicableProducts
        if (applicableCategories !== undefined) coupon.applicableCategories = applicableCategories
        if (excludedProducts !== undefined) coupon.excludedProducts = excludedProducts
        if (excludedCategories !== undefined) coupon.excludedCategories = excludedCategories

        await coupon.save()

        res.status(200).json({
            success: true,
            message: 'Coupon updated successfully',
            data: coupon
        })
    } catch (error) {
        next(error)
    }
}
```

#### `deleteCoupon()`
**Purpose:** Delete a coupon from the system.  
**Access:** Private (Admin)  
**Validation:** `couponId` in params. Prevents deletion if the coupon has been used (`usedCount > 0`).  
**Process:** Finds and deletes the coupon document.  
**Response:** Success message.

**Controller Implementation:**
```javascript
export const deleteCoupon = async (req, res, next) => {
    try {
        const { couponId } = req.params

        const coupon = await Coupon.findById(couponId)

        if (!coupon) {
            return next(errorHandler(404, 'Coupon not found'))
        }

        // Check if coupon has been used
        if (coupon.usedCount > 0) {
            return next(errorHandler(400, 'Cannot delete coupon that has been used'))
        }

        await Coupon.findByIdAndDelete(couponId)

        res.status(200).json({
            success: true,
            message: 'Coupon deleted successfully'
        })
    } catch (error) {
        next(error)
    }
}
```

#### `validateCoupon()`
**Purpose:** Validate a coupon code against an order amount and, optionally, a user (for `isFirstTimeOnly` coupons).  
**Access:** Public  
**Validation:** `code` is required.  
**Process:** Finds the coupon, checks its active status, expiry, usage limits, minimum order amount, and first-time usage. Calculates the potential discount.  
**Response:** Validation status, message, and calculated discount.

**Controller Implementation:**
```javascript
export const validateCoupon = async (req, res, next) => {
    try {
        const { code } = req.body
        const { orderAmount = 0 } = req.query
        const userId = req.user?._id || req.user?.userId

        if (!code) {
            return next(errorHandler(400, 'Coupon code is required'))
        }

        const coupon = await Coupon.findOne({ code: code.toUpperCase() })

        if (!coupon) {
            return res.status(200).json({
                success: false,
                message: 'Invalid coupon code'
            })
        }

        // Validate coupon
        const validation = coupon.validateCoupon(userId ? String(userId) : null, parseFloat(orderAmount))

        if (!validation.isValid) {
            return res.status(200).json({
                success: false,
                message: validation.message
            })
        }

        // Calculate discount
        const discountAmount = coupon.calculateDiscount(parseFloat(orderAmount))

        res.status(200).json({
            success: true,
            message: 'Coupon is valid',
            data: {
                coupon: {
                    _id: coupon._id,
                    code: coupon.code,
                    name: coupon.name,
                    description: coupon.description,
                    discountType: coupon.discountType,
                    discountValue: coupon.discountValue,
                    minimumOrderAmount: coupon.minimumOrderAmount,
                    maximumDiscountAmount: coupon.maximumDiscountAmount
                },
                discountAmount,
                orderAmount: parseFloat(orderAmount),
                finalAmount: parseFloat(orderAmount) - discountAmount
            }
        })
    } catch (error) {
        next(error)
    }
}
```

#### `applyCoupon()`
**Purpose:** Apply a valid coupon to an order, returning the calculated discount. This function is typically called during checkout.  
**Access:** Private (Authenticated User)  
**Validation:** `code` and `orderAmount` are required. Performs all validations from `validateCoupon`.  
**Process:** Validates the coupon and calculates the discount amount.  
**Response:** Applied coupon details and the discount amount.

**Controller Implementation:**
```javascript
export const applyCoupon = async (req, res, next) => {
    try {
        const { code, orderAmount } = req.body
        const userId = req.user._id

        if (!code) {
            return next(errorHandler(400, 'Coupon code is required'))
        }

        if (!orderAmount || orderAmount <= 0) {
            return next(errorHandler(400, 'Valid order amount is required'))
        }

        const coupon = await Coupon.findOne({ code: code.toUpperCase() })

        if (!coupon) {
            return next(errorHandler(404, 'Invalid coupon code'))
        }

        // Validate coupon
        const validation = coupon.validateCoupon(userId, orderAmount)

        if (!validation.isValid) {
            return next(errorHandler(400, validation.message))
        }

        // Calculate discount
        const discountAmount = coupon.calculateDiscount(orderAmount)

        res.status(200).json({
            success: true,
            message: 'Coupon applied successfully',
            data: {
                coupon: {
                    _id: coupon._id,
                    code: coupon.code,
                    name: coupon.name,
                    discountType: coupon.discountType,
                    discountValue: coupon.discountValue
                },
                discountAmount,
                orderAmount,
                finalAmount: orderAmount - discountAmount
            }
        })
    } catch (error) {
        next(error)
    }
}
```

#### `getCouponStats()`
**Purpose:** Retrieve various statistics about coupons, such as total, active, expired, and top-used coupons.  
**Access:** Private (Admin)  
**Validation:** None.  
**Process:** Performs count queries and aggregation to gather statistics.  
**Response:** An object containing coupon statistics.

**Controller Implementation:**
```javascript
export const getCouponStats = async (req, res, next) => {
    try {
        const totalCoupons = await Coupon.countDocuments()
        const activeCoupons = await Coupon.countDocuments({ isActive: true })
        const expiredCoupons = await Coupon.countDocuments({
            hasExpiry: true,
            expiryDate: { $lt: new Date() }
        })
        const usedCoupons = await Coupon.countDocuments({ usedCount: { $gt: 0 } })

        // Get top used coupons
        const topUsedCoupons = await Coupon.find({ usedCount: { $gt: 0 } })
            .sort({ usedCount: -1 })
            .limit(5)
            .select('code name usedCount')

        res.status(200).json({
            success: true,
            data: {
                totalCoupons,
                activeCoupons,
                expiredCoupons,
                usedCoupons,
                topUsedCoupons
            }
        })
    } catch (error) {
        next(error)
    }
}
```

#### `generateNewCode()`
**Purpose:** Generate a new unique code for an existing coupon.  
**Access:** Private (Admin)  
**Validation:** `couponId` in params. Prevents code change if the coupon has been used.  
**Process:** Generates a new unique code and updates the coupon.  
**Response:** The updated coupon object with the new code.

**Controller Implementation:**
```javascript
export const generateNewCode = async (req, res, next) => {
    try {
        const { couponId } = req.params

        const coupon = await Coupon.findById(couponId)

        if (!coupon) {
            return next(errorHandler(404, 'Coupon not found'))
        }

        // Check if coupon has been used
        if (coupon.usedCount > 0) {
            return next(errorHandler(400, 'Cannot change code for coupon that has been used'))
        }

        // Generate new unique code
        const newCode = await Coupon.generateUniqueCode()
        coupon.code = newCode

        await coupon.save()

        res.status(200).json({
            success: true,
            message: 'New coupon code generated successfully',
            data: {
                code: newCode
            }
        })
    } catch (error) {
        next(error)
    }
}
```

---

## 💰 Coupon Routes

### Base Path: `/api/coupons`

### Router Implementation

**File: `../routes/couponRoute.js`**

```javascript
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

// Public routes
router.post('/validate', validateCoupon)

// Protected routes (require authentication)
router.use(authenticateToken)

router.post('/apply', applyCoupon)

// Admin routes (require admin role)
router.use(authorizeRoles(['admin']))

router.post('/', createCoupon)
router.get('/', getAllCoupons)
router.get('/stats', getCouponStats)
router.get('/:couponId', getCouponById)
router.put('/:couponId', updateCoupon)
router.delete('/:couponId', deleteCoupon)
router.patch('/:couponId/generate-code', generateNewCode)

export default router
```

### Route Details

#### `POST /api/coupons/validate`
**Headers:** (Optional)  
**Query Parameters:** `orderAmount` (optional)  
**Body (JSON):**  
```json
{
  "code": "SUMMER25"
}
```
**Purpose:** Validate a coupon code against minimum order amount, expiry, and usage rules without applying it.  
**Access:** Public  
**Response:** `200 OK` with validation results and potential discount amount.

#### `POST /api/coupons/apply`
**Headers:** `Authorization: Bearer <access_token>`  
**Body (JSON):**  
```json
{
  "code": "SUMMER25",
  "orderAmount": 1500
}
```
**Purpose:** Apply a coupon to an order by validating it and calculating the discount.  
**Access:** Private (Authenticated User)  
**Response:** `200 OK` with applied coupon details and discount amount.

#### `POST /api/coupons`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Body (JSON):**  
```json
{
  "name": "New Customer Discount",
  "description": "25% off for first-time buyers",
  "discountType": "percentage",
  "discountValue": 25,
  "minimumOrderAmount": 500,
  "isFirstTimeOnly": true,
  "hasExpiry": true,
  "expiryDate": "2026-12-31T23:59:59Z",
  "hasUsageLimit": true,
  "usageLimit": 100
}
```
**Purpose:** Create a new coupon in the system.  
**Access:** Private (Admin Only)  
**Response:** `201 Created` with the details of the newly created coupon.

#### `GET /api/coupons`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Query Parameters:** `page`, `limit`, `sort`, `search`, `status`  
**Purpose:** Retrieve a paginated list of all coupons, with filtering and sorting options.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with paginated coupon data.

#### `GET /api/coupons/stats`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Purpose:** Retrieve overall statistics about coupons.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with coupon statistics.

#### `GET /api/coupons/:couponId`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `couponId` (path) - The ID of the coupon to retrieve.  
**Purpose:** Retrieve a single coupon by its unique identifier.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with the coupon object, or `404 Not Found`.

#### `PUT /api/coupons/:couponId`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `couponId` (path) - The ID of the coupon to update.  
**Body (JSON):** (partial update allowed)  
```json
{
  "description": "Updated description for the coupon.",
  "isActive": false,
  "usageLimit": 50
}
```
**Purpose:** Update the details of an existing coupon.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with the updated coupon object.

#### `DELETE /api/coupons/:couponId`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `couponId` (path) - The ID of the coupon to delete.  
**Purpose:** Delete a coupon from the system.  
**Access:** Private (Admin Only). Fails if coupon has been used.  
**Response:** `200 OK` with a success message.

#### `PATCH /api/coupons/:couponId/generate-code`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `couponId` (path) - The ID of the coupon to generate a new code for.  
**Purpose:** Generate a new unique code for an existing coupon. Fails if coupon has been used.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with the updated coupon object showing the new code.

---

## 🔐 Middleware

- `authenticateToken`: Used to protect the `/apply` route and all admin-level routes.
- `authorizeRoles(['admin'])`: Used on all admin-level routes to ensure only users with the 'admin' role can perform the operation.

---

## 📝 API Examples

### Validate a Coupon (Public)
```bash
curl -X POST http://localhost:5000/api/coupons/validate?orderAmount=1000 
  -H "Content-Type: application/json" 
  -d '{
    "code": "SUMMER25"
  }'
```

### Apply a Coupon to an Order (Protected)
```bash
curl -X POST http://localhost:5000/api/coupons/apply 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <access_token>" 
  -d '{
    "code": "SUMMER25",
    "orderAmount": 1500
  }'
```

### Create a New Coupon (Admin)
```bash
curl -X POST http://localhost:5000/api/coupons 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <admin_access_token>" 
  -d '{
    "name": "New Customer Discount",
    "description": "25% off for first-time buyers",
    "discountType": "percentage",
    "discountValue": 25,
    "minimumOrderAmount": 500,
    "isFirstTimeOnly": true,
    "hasExpiry": true,
    "expiryDate": "2026-12-31T23:59:59Z",
    "hasUsageLimit": true,
    "usageLimit": 100
  }'
```

### Get Coupon Statistics (Admin)
```bash
curl -X GET http://localhost:5000/api/coupons/stats 
  -H "Authorization: Bearer <admin_access_token>"
```

---

## 🛡️ Security Features

-   **Authentication:** Endpoints for applying coupons and all admin operations require a valid JWT token.
-   **Authorization:** Most coupon management operations (create, read all, update, delete, stats, generate code) are strictly controlled by role-based access control, requiring the 'admin' role. The `apply` route requires general authentication to track `isFirstTimeOnly` usage.
-   **Unique Codes:** The system ensures that each coupon has a unique code, preventing duplicates.
-   **Usage Tracking and Limits:** Coupons can be configured with total usage limits and per-user first-time usage restrictions, which are enforced during validation and application.
-   **Expiry Dates:** Coupons can be set to expire, and this expiry is checked during validation.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

-   `400 Bad Request`: Invalid input (e.g., missing required fields, invalid discount values, trying to delete/change code for a used coupon, invalid/expired date).
-   `401 Unauthorized`: Missing or invalid authentication token.
-   `403 Forbidden`: Access denied (e.g., non-admin attempting an admin operation).
-   `404 Not Found`: The requested coupon was not found.
-   `409 Conflict`: A coupon with the provided code already exists.
-   `500 Internal Server Error`: An unexpected server-side error occurred during processing.

---

## 📊 Database Indexes

-   `code: 1` (unique, uppercase): Ensures efficient and unique lookup by coupon code, enforcing uniqueness and speeding up queries.
-   `isActive: 1, expiryDate: 1`: Provides a compound index for efficient filtering of active and non-expired coupons.
-   `createdBy: 1`: Facilitates querying coupons created by a specific user.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
