# ⭐ TEO KICKS API - Review Management Documentation

## 📋 Table of Contents
- [Review Management Overview](#review-management-overview)
- [Review Model](#-review-model)
- [Review Controller](#-review-controller)
- [Review Routes](#-review-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Review Management Overview

Review Management enables users to submit and manage product reviews, including ratings and comments, within the TEO KICKS API system. It supports functionalities for creating, updating, and deleting reviews by users, as well as administrative approval processes. Review statistics, such as average ratings and distribution, are also available.

---

## 👤 Review Model

### Schema Definition
```typescript
interface IReview {
  _id: string;
  user: string; // User ObjectId
  product: string; // Product ObjectId
  rating: number;
  comment: string;
  isVerifiedPurchase: boolean;
  isApproved: boolean;
  orderId?: string; // Order ObjectId
  orderItemId?: string;
  createdAt: Date;
  updatedAt: Date;
  // Virtuals
  timeAgo: string;
}
```

### Model Implementation

**File: `../models/reviewModel.js`**

```javascript
import mongoose from 'mongoose'

const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    isVerifiedPurchase: {
        type: Boolean,
        default: false
    },
    isApproved: {
        type: Boolean,
        default: true
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    orderItemId: {
        type: mongoose.Schema.Types.ObjectId
    }
}, {
    timestamps: true
})

// Compound index to ensure one review per user per product
reviewSchema.index({ user: 1, product: 1 }, { unique: true })

// Virtual for time ago
reviewSchema.virtual('timeAgo').get(function() {
    const now = new Date()
    const diffInSeconds = Math.floor((now - this.createdAt) / 1000)
    
    if (diffInSeconds < 60) {
        return `${diffInSeconds} seconds ago`
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60)
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600)
        return `${hours} hour${hours > 1 ? 's' : ''} ago`
    } else if (diffInSeconds < 2592000) {
        const days = Math.floor(diffInSeconds / 86400)
        return `${days} day${days > 1 ? 's' : ''} ago`
    } else if (diffInSeconds < 31536000) {
        const months = Math.floor(diffInSeconds / 2592000)
        return `${months} month${months > 1 ? 's' : ''} ago`
    } else {
        const years = Math.floor(diffInSeconds / 31536000)
        return `${years} year${years > 1 ? 's' : ''} ago`
    }
})

// Ensure virtual fields are serialized
reviewSchema.set('toJSON', { virtuals: true })
reviewSchema.set('toObject', { virtuals: true })

const Review = mongoose.model('Review', reviewSchema)

export default Review
```

### Validation Rules
```javascript
user:        { required: true, type: ObjectId, ref: 'User' }
product:     { required: true, type: ObjectId, ref: 'Product' }
rating:      { required: true, type: Number, min: 1, max: 5 }
comment:     { required: true, type: String, trim: true, maxlength: 1000 }
isVerifiedPurchase: { type: Boolean, default: false }
isApproved:  { type: Boolean, default: true }
orderId:     { type: ObjectId, ref: 'Order' }
orderItemId: { type: ObjectId }
```

---

## 🎮 Review Controller

### Required Imports
```javascript
import mongoose from 'mongoose'
import Review from '../models/reviewModel.js'
import Product from '../models/productModel.js'
import User from '../models/userModel.js'
import { errorHandler } from '../utils/error.js'
```

### Functions Overview

#### `getProductReviews()`
**Purpose:** Retrieve paginated reviews for a specific product, including aggregated rating statistics (average rating, total reviews, rating distribution).  
**Access:** Public  
**Validation:** `productId` in params.  
**Process:** Queries approved reviews for the product, calculates statistics using aggregation pipeline.  
**Response:** Paginated list of reviews and statistics.

**Controller Implementation:**
```javascript
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
```

#### `createReview()`
**Purpose:** Create a new review (rating and comment) for a product by an authenticated user.  
**Access:** Private (Authenticated User)  
**Validation:** `productId` in params, `rating` and `comment` in body. Checks if product exists and if the user has already reviewed the product.  
**Process:** Creates a new `Review` document.  
**Response:** The newly created review object.

**Controller Implementation:**
```javascript
export const createReview = async (req, res, next) => {
    try {
        const { productId } = req.params
        const { rating, comment } = req.body
        const userId = req.user._id

        // Check if user is verified or admin
        const user = await User.findById(userId)

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
            isVerifiedPurchase: false
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
```

#### `updateReview()`
**Purpose:** Update an existing review.  
**Access:** Private (Authenticated User)  
**Validation:** `reviewId` in params, `rating` and `comment` in body.  
**Process:** Finds the review by ID. Only the original author or an admin can update the review.  
**Response:** The updated review object.

**Controller Implementation:**
```javascript
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
```

#### `deleteReview()`
**Purpose:** Delete an existing review.  
**Access:** Private (Authenticated User)  
**Validation:** `reviewId` in params.  
**Process:** Finds the review by ID. Only the original author or an admin can delete the review.  
**Response:** Success message.

**Controller Implementation:**
```javascript
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
```

#### `getReviewById()`
**Purpose:** Retrieve a single review by its ID.  
**Access:** Public  
**Validation:** `reviewId` in params.  
**Process:** Finds the review by ID and populates user and product details.  
**Response:** A single review object.

**Controller Implementation:**
```javascript
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
```

#### `approveReview()`
**Purpose:** Admin-only function to approve or reject a review, controlling its public visibility.  
**Access:** Private (Admin)  
**Validation:** `reviewId` in params, `isApproved` (boolean) in body.  
**Process:** Updates the `isApproved` status of the review.  
**Response:** The updated review object.

**Controller Implementation:**
```javascript
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
```

#### `getUserReviews()`
**Purpose:** Retrieve all reviews submitted by the authenticated user.  
**Access:** Private (Authenticated User)  
**Validation:** User must be authenticated.  
**Process:** Queries reviews by `req.user._id` and returns paginated results.  
**Response:** Paginated list of reviews by the user.

**Controller Implementation:**
```javascript
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
```

---

## ⭐ Review Routes

### Base Path: `/api/reviews`

### Router Implementation

**File: `../routes/reviewRoute.js`**

```javascript
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
```

### Route Details

#### `GET /api/reviews/products/:productId`
**Headers:** (Optional)  
**Parameters:** `productId` (path) - The ID of the product.  
**Query Parameters:** `page`, `limit`, `sort`  
**Purpose:** Retrieve paginated and approved reviews for a specific product, along with aggregated rating statistics.  
**Access:** Public  
**Response:** `200 OK` with paginated reviews and statistics.

#### `GET /api/reviews/:reviewId`
**Headers:** (Optional)  
**Parameters:** `reviewId` (path) - The ID of the review to retrieve.  
**Purpose:** Retrieve a single review by its unique identifier.  
**Access:** Public  
**Response:** `200 OK` with the review object, or `404 Not Found`.

#### `GET /api/reviews/user/reviews`
**Headers:** `Authorization: Bearer <token>`  
**Query Parameters:** `page`, `limit`  
**Purpose:** Retrieve a paginated list of all reviews submitted by the authenticated user.  
**Access:** Private (Authenticated User)  
**Response:** `200 OK` with paginated list of user's reviews.

#### `POST /api/reviews/products/:productId`
**Headers:** `Authorization: Bearer <token>`  
**Parameters:** `productId` (path) - The ID of the product being reviewed.  
**Body (JSON):**  
```json
{
  "rating": 4,
  "comment": "Good quality, met my expectations."
}
```
**Purpose:** Create a new review for a product.  
**Access:** Private (Authenticated User)  
**Response:** `201 Created` with the newly created review object.

#### `PUT /api/reviews/:reviewId`
**Headers:** `Authorization: Bearer <token>`  
**Parameters:** `reviewId` (path) - The ID of the review to update.  
**Body (JSON):** (partial update allowed)  
```json
{
  "rating": 5,
  "comment": "Excellent quality, exceeded my expectations!"
}
```
**Purpose:** Update an existing review, ensuring the authenticated user is the owner or an admin.  
**Access:** Private (Authenticated User)  
**Response:** `200 OK` with the updated review object.

#### `DELETE /api/reviews/:reviewId`
**Headers:** `Authorization: Bearer <token>`  
**Parameters:** `reviewId` (path) - The ID of the review to delete.  
**Purpose:** Delete an existing review, ensuring the authenticated user is the owner or an admin.  
**Access:** Private (Authenticated User)  
**Response:** `200 OK` with a success message.

#### `PATCH /api/reviews/:reviewId/approve`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `reviewId` (path) - The ID of the review to approve/reject.  
**Body (JSON):**  
```json
{
  "isApproved": true // or false
}
```
**Purpose:** Admin action to approve or reject a review, controlling its public visibility.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with the updated review object.

---

## 🔐 Middleware

- `authenticateToken`: Used on `router.use(authenticateToken)` to protect user-specific and admin routes.
- `authorizeRoles(['admin'])`: Used on `router.patch('/:reviewId/approve')` to restrict access to administrators only for approving reviews.

---

## 📝 API Examples

### Create a Review
```bash
curl -X POST http://localhost:5000/api/reviews/products/<product_id> 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <access_token>" 
  -d '{
    "rating": 5,
    "comment": "Absolutely love these sneakers! Very comfortable and stylish."
  }'
```

### Get Reviews for a Product (Public)
```bash
curl -X GET "http://localhost:5000/api/reviews/products/<product_id>?page=1&limit=5&sort=-rating"
```

### Update a User's Own Review
```bash
curl -X PUT http://localhost:5000/api/reviews/<review_id> 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <access_token>" 
  -d '{
    "rating": 4,
    "comment": "Still good, but not perfect."
  }'
```

### Admin Approve a Review
```bash
curl -X PATCH http://localhost:5000/api/reviews/<review_id>/approve 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <admin_access_token>" 
  -d '{
    "isApproved": true
  }'
```

---

## 🛡️ Security Features

-   **Authentication:** All routes for creating, updating, or deleting reviews, and all admin actions, require a valid JWT. Public read access is available for product reviews.
-   **Authorization:**
    *   Users can only create, update, or delete their *own* reviews. This is enforced by checking `req.user._id` against the `review.user` field within the controller.
    *   Approving/rejecting reviews is strictly restricted to users with the 'admin' role, enforced by `authorizeRoles` middleware.
-   **Unique Reviews:** A compound index (`user: 1, product: 1`) ensures that a single user can submit only one review per product, preventing review spam.
-   **Data Validation:** Rating is constrained between 1 and 5, and comments have a maximum length.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

-   `400 Bad Request`: Invalid input (e.g., missing rating/comment, rating out of range, user attempting to review the same product twice).
-   `401 Unauthorized`: Missing or invalid authentication token.
-   `403 Forbidden`: Access denied (e.g., a user attempting to modify another user's review, or a non-admin attempting to approve/reject a review).
-   `404 Not Found`: The referenced product or review was not found.
-   `500 Internal Server Error`: An unexpected server-side error occurred during processing.

---

## 📊 Database Indexes

-   `user: 1, product: 1` (unique): Ensures a user can only leave one review per product, optimizing lookup and enforcing uniqueness constraints.
-   `product: 1, isApproved: 1`: Facilitates efficient retrieval of approved reviews for a specific product, typically for public display.
-   `user: 1`: Allows for efficient retrieval of all reviews by a specific user.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
