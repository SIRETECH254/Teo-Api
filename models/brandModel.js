import mongoose from "mongoose"





const brandSchema = new mongoose.Schema({

    name: { 
        type: String, 
        required: true,
        trim: true
    },

    slug: { 
        type: String, 
        required: true,
        unique: true,
        lowercase: true
    },

    // Brand description
    description: { 
        type: String, 
        trim: true 
    },

    // Brand logo URL
    logo: { 
        type: String 
    },

    // Brand website URL
    website: { 
        type: String 
    },

    // Brand features
    features: [{ 
        type: String,
        trim: true
    }],

    // Sort order for display
    sortOrder: { 
        type: Number, 
        default: 0 
    },

    // Display settings
    isActive: { 
        type: Boolean, 
        default: true 
    },

   
    // Created by
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }

}, {
    timestamps: true
})





// Indexes for better query performance
// Note: slug index is automatically created due to unique: true
brandSchema.index({ isActive: 1 })
brandSchema.index({ sortOrder: 1 })











// Instance method to get products by brand
brandSchema.methods.getProducts = function() {

    return mongoose.model('Product').find({
        brand: this._id,
        status: "active"
    }).sort({ createdAt: -1 })

}





// Static method to get active brands
brandSchema.statics.getActive = function() {

    return this.find({ isActive: true }).sort({ sortOrder: 1, name: 1 })

}





// Static method to get brands with product count
brandSchema.statics.getWithProductCount = function() {

    return this.aggregate([
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: 'brand',
                as: 'brandProducts'
            }
        },
        {
            $addFields: {
                productCount: { $size: '$brandProducts' }
            }
        },
        {
            $project: {
                brandProducts: 0
            }
        },
        {
            $sort: { sortOrder: 1, name: 1 }
        }
    ])

}





// Static method to get popular brands (by product count)
brandSchema.statics.getPopular = function(limit = 10) {

    return this.aggregate([
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: 'brand',
                as: 'brandProducts'
            }
        },
        {
            $addFields: {
                productCount: { $size: '$brandProducts' }
            }
        },
        {
            $match: {
                isActive: true,
                productCount: { $gt: 0 }
            }
        },
        {
            $project: {
                brandProducts: 0
            }
        },
        {
            $sort: { productCount: -1, name: 1 }
        },
        {
            $limit: limit
        }
    ])

}





const Brand = mongoose.model('Brand', brandSchema)





export default Brand 