import mongoose from "mongoose"


const packagingOptionSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false }
}, { timestamps: true })


// Unique case-insensitive name
packagingOptionSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } })
packagingOptionSchema.index({ isActive: 1, isDefault: 1 })


const PackagingOption = mongoose.model("PackagingOption", packagingOptionSchema)


export default PackagingOption


