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