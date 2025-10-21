import mongoose from "mongoose"





const categorySchema = new mongoose.Schema({

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

    // Status string kept alongside isActive for clarity in API
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
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
categorySchema.index({ isActive: 1 })
categorySchema.index({ status: 1 })











// Instance method to get full path
// Note: hierarchy was removed; getFullPath now returns just the category name
categorySchema.methods.getFullPath = function() {
    return this.name
}





// Static method to get root categories
categorySchema.statics.getRootCategories = function() {
    return this.find({ isActive: true }).sort({ name: 1 })
}





// Static method to get category tree
categorySchema.statics.getCategoryTree = function() {
    return this.find({ isActive: true }).sort({ name: 1 })
}





// Static method to get category with products count
categorySchema.statics.getWithProductCount = function() {

    return this.aggregate([
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: 'categories',
                as: 'products'
            }
        },
        {
            $addFields: {
                productCount: { $size: '$products' }
            }
        },
        {
            $project: {
                products: 0
            }
        },
        { $sort: { name: 1 } }
    ])

}

// Sync status <-> isActive
categorySchema.pre('save', function(next) {
    if (this.isModified('status')) {
        this.isActive = this.status === 'active'
    } else if (this.isModified('isActive')) {
        this.status = this.isActive ? 'active' : 'inactive'
    } else {
        // Ensure consistency on first save
        this.isActive = this.status === 'active'
    }
    next()
})





const Category = mongoose.model('Category', categorySchema)





export default Category 