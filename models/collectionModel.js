import mongoose from "mongoose"





const collectionSchema = new mongoose.Schema({

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

    // Collection description
    description: { 
        type: String, 
        trim: true 
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
collectionSchema.index({ isActive: 1 })





























// Static method to get active collections
collectionSchema.statics.getActive = function() {

    return this.find({ isActive: true }).sort({ name: 1 })

}





// Static method to get collections with product count
collectionSchema.statics.getWithProductCount = function() {

    return this.aggregate([
        {
            $addFields: {
                productCount: 0
            }
        },
        {
            $sort: { name: 1 }
        }
    ])

}





const Collection = mongoose.model('Collection', collectionSchema)





export default Collection 