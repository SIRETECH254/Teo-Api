import mongoose from 'mongoose'
import Review from '../models/reviewModel.js'
import Product from '../models/productModel.js'
import User from '../models/userModel.js'
import { errorHandler } from '../utils/error.js'

// Get reviews for a product
export const getProductReviews = async (req, res, next) => {
    try {
        const { productId } = req.params
        const { page = 1, limit = 10, sort = '-createdAt' } = req.query


        const skip = (page - 1) * limit

        const reviews = await Review.find({ 
            product: productId, 
            isApproved: true 
        })
        .populate('user', 'name email avatar')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))

        const total = await Review.countDocuments({ 
            product: productId, 
            isApproved: true 
        })


        // Calculate average rating
        const avgRating = await Review.aggregate([
            { $match: { product: new mongoose.Types.ObjectId(productId), isApproved: true } },
            { $group: { _id: null, avgRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } }
        ])

        // Get rating distribution
        const ratingDistribution = await Review.aggregate([
            { $match: { product: new mongoose.Types.ObjectId(productId), isApproved: true } },
            { $group: { _id: '$rating', count: { $sum: 1 } } },
            { $sort: { _id: -1 } }
        ])

        const response = {
            success: true,
            data: {
                reviews,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalReviews: total,
                    hasNextPage: skip + reviews.length < total,
                    hasPrevPage: page > 1
                },
                stats: {
                    averageRating: avgRating[0]?.avgRating || 0,
                    totalReviews: avgRating[0]?.totalReviews || 0,
                    ratingDistribution
                }
            }
        }
        
        res.status(200).json(response)
    } catch (error) {
        next(error)
    }
}

// Create a review
export const createReview = async (req, res, next) => {
    try {
        const { productId } = req.params
        const { rating, comment } = req.body
        const userId = req.user._id

        // Check if user is verified or admin
        const user = await User.findById(userId)
        
        // Temporarily allow all authenticated users for testing
        // if (!user.isVerified && !user.roles.includes('admin')) {
        //     return res.status(403).json({
        //         success: false,
        //         message: 'Only verified users or admins can create reviews'
        //     })
        // }

        // Check if product exists
        const product = await Product.findById(productId)
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            })
        }

        // Check if user already reviewed this product
        const existingReview = await Review.findOne({ user: userId, product: productId })
        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: 'You have already reviewed this product'
            })
        }

        // Create review
        const review = new Review({
            user: userId,
            product: productId,
            rating,
            comment,
            isVerifiedPurchase: false // TODO: Check if user purchased this product
        })

        await review.save()

        // Populate user info for response
        await review.populate('user', 'name email avatar')

        res.status(201).json({
            success: true,
            message: 'Review created successfully',
            data: review
        })
    } catch (error) {
        next(error)
    }
}

// Update a review
export const updateReview = async (req, res, next) => {
    try {
        const { reviewId } = req.params
        const { rating, comment } = req.body
        const userId = req.user._id
        const userRoles = req.user.roles

        const review = await Review.findById(reviewId)
        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            })
        }

        // Check if user can edit this review (owner or admin)
        if (review.user.toString() !== userId && !userRoles.includes('admin')) {
            return res.status(403).json({
                success: false,
                message: 'You can only edit your own reviews'
            })
        }

        // Update review
        review.rating = rating
        review.comment = comment
        await review.save()

        // Populate user info for response
        await review.populate('user', 'name email avatar')

        res.status(200).json({
            success: true,
            message: 'Review updated successfully',
            data: review
        })
    } catch (error) {
        next(error)
    }
}

// Delete a review
export const deleteReview = async (req, res, next) => {
    try {
        const { reviewId } = req.params
        const userId = req.user._id
        const userRoles = req.user.roles

        const review = await Review.findById(reviewId)
        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            })
        }

        // Check if user can delete this review (owner or admin)
        if (review.user.toString() !== userId && !userRoles.includes('admin')) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own reviews'
            })
        }

        await Review.findByIdAndDelete(reviewId)

        res.status(200).json({
            success: true,
            message: 'Review deleted successfully'
        })
    } catch (error) {
        next(error)
    }
}

// Get a single review
export const getReviewById = async (req, res, next) => {
    try {
        const { reviewId } = req.params

        const review = await Review.findById(reviewId)
        .populate('user', 'name email avatar')
        .populate('product', 'title images')

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            })
        }

        res.status(200).json({
            success: true,
            data: review
        })
    } catch (error) {
        next(error)
    }
}

// Admin: Approve/Reject review
export const approveReview = async (req, res, next) => {
    try {
        const { reviewId } = req.params
        const { isApproved } = req.body

        // Check if user is admin
        if (!req.user.roles.includes('admin')) {
            return res.status(403).json({
                success: false,
                message: 'Only admins can approve/reject reviews'
            })
        }

        const review = await Review.findByIdAndUpdate(
            reviewId,
            { isApproved },
            { new: true }
        ).populate('user', 'name email avatar')

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            })
        }

        res.status(200).json({
            success: true,
            message: `Review ${isApproved ? 'approved' : 'rejected'} successfully`,
            data: review
        })
    } catch (error) {
        next(error)
    }
}

// Get user's reviews
export const getUserReviews = async (req, res, next) => {
    try {
        const userId = req.user._id
        const { page = 1, limit = 10 } = req.query

        const skip = (page - 1) * limit

        const reviews = await Review.find({ user: userId })
        .populate('product', 'title images')
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit))

        const total = await Review.countDocuments({ user: userId })

        res.status(200).json({
            success: true,
            data: {
                reviews,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalReviews: total,
                    hasNextPage: skip + reviews.length < total,
                    hasPrevPage: page > 1
                }
            }
        })
    } catch (error) {
        next(error)
    }
} 