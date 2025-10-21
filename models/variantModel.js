import mongoose from "mongoose"





const optionSchema = new mongoose.Schema({

    value: { 
        type: String, 
        required: true,
        trim: true
    },

    isActive: { 
        type: Boolean, 
        default: true 
    },

    sortOrder: { 
        type: Number, 
        default: 0 
    }

}, {
    timestamps: true
})





const variantSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },

    options: [optionSchema]

}, {
    timestamps: true
})





// Indexes for better query performance
// Note: name index is automatically created due to unique: true





// Pre-save middleware to ensure unique option values within a variant
variantSchema.pre('save', function(next) {

    if (this.options && this.options.length > 0) {

        const values = this.options.map(option => option.value.toLowerCase())

        const uniqueValues = [...new Set(values)]

        if (values.length !== uniqueValues.length) {

            return next(new Error('Duplicate option values are not allowed within a variant'))

        }

    }

    next()

})





// Instance method to add an option
variantSchema.methods.addOption = async function(optionData) {

    this.options.push(optionData)

    await this.save()

    // Auto-regenerate SKUs for all products using this variant
    try {
        const { default: Product } = await import('./productModel.js')
        const products = await Product.find({ variants: this._id })
        
        for (const product of products) {
            await product.generateSKUs()
        }
    } catch (error) {
        console.error('Error regenerating SKUs after adding option:', error)
        // Don't throw error - option was added successfully
    }

    return this

}





// Instance method to remove an option
variantSchema.methods.removeOption = async function(optionId) {

    // Import Product model here to avoid circular dependency
    const { default: Product } = await import('./productModel.js')

    try {

        // First, find and delete all SKUs that reference this option

        const productsToUpdate = await Product.find({ 'skus.attributes.optionId': optionId })

        for (const product of productsToUpdate) {

            // Remove SKUs that have this optionId in their attributes

            product.skus = product.skus.filter(sku => 
                !sku.attributes.some(attr => attr.optionId.toString() === optionId.toString())
            )

            await product.save()

        }

        // Then remove the option from the variant

        this.options = this.options.filter(option => option._id.toString() !== optionId.toString())

        await this.save()

        // Auto-regenerate SKUs for all products using this variant
        try {
            const products = await Product.find({ variants: this._id })
            
            for (const product of products) {
                await product.generateSKUs()
            }
        } catch (error) {
            console.error('Error regenerating SKUs after removing option:', error)
            // Don't throw error - option was removed successfully
        }

        return this

    } catch (error) {

        console.error('Error in removeOption cascade deletion:', error)

        throw error

    }

}





// Instance method to update an option
variantSchema.methods.updateOption = function(optionId, updateData) {

    const option = this.options.id(optionId)

    if (option) {

        Object.assign(option, updateData)

        return this.save()

    }

    throw new Error('Option not found')

}





// Static method to get all variants with their options
variantSchema.statics.getWithOptions = function() {

    return this.find()
        .select('name options')
        .sort({ name: 1 })

}










const Variant = mongoose.model('Variant', variantSchema)





export default Variant 