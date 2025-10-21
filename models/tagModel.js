import mongoose from "mongoose"





const tagSchema = new mongoose.Schema({

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

    // Tag description
    description: { 
        type: String, 
        trim: true 
    },

    // Active status
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
tagSchema.index({ isActive: 1 })











// Instance method to get products by tag
tagSchema.methods.getProducts = function() {

    return mongoose.model('Product').find({
        tags: this._id,
        status: "active"
    }).sort({ createdAt: -1 })

}





// Static method to get active tags
tagSchema.statics.getActive = function() {

    return this.find({ isActive: true }).sort({ name: 1 })

}





// Static method to get tags with product count
tagSchema.statics.getWithProductCount = function() {

    return this.aggregate([
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: 'tags',
                as: 'tagProducts'
            }
        },
        {
            $addFields: {
                productCount: { $size: '$tagProducts' }
            }
        },
        {
            $project: {
                tagProducts: 0
            }
        },
        {
            $sort: { name: 1 }
        }
    ])

}





// Static method to get popular tags (by product count)
tagSchema.statics.getPopular = function(limit = 10) {

    return this.aggregate([
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: 'tags',
                as: 'tagProducts'
            }
        },
        {
            $addFields: {
                productCount: { $size: '$tagProducts' }
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
                tagProducts: 0
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





// Static method to create or find tag by name
tagSchema.statics.findOrCreate = async function(tagData) {

    const existingTag = await this.findOne({ 
        slug: tagData.slug || tagData.name.toLowerCase().replace(/\s+/g, '-')
    })

    if (existingTag) {
        return existingTag
    }

    return this.create(tagData)

}





const Tag = mongoose.model('Tag', tagSchema)





export default Tag 