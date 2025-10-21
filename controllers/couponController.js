import Coupon from '../models/couponModel.js'
import { errorHandler } from '../utils/error.js'

// Create a new coupon (Admin only)
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

// Get all coupons (Admin only)
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

// Get coupon by ID (Admin only)
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

// Update coupon (Admin only)
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

// Delete coupon (Admin only)
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

// Validate coupon (Public)
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

// Apply coupon to order (Protected)
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

// Get coupon statistics (Admin only)
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

// Generate new coupon code (Admin only)
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