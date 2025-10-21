import mongoose from "mongoose"


const addressSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // Place name, e.g., "Red Diamonds Ruaraka"
    name: {
        type: String,
        required: true,
        trim: true
    },

    coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },

    regions: {
        country: { type: String, required: true },
        locality: { type: String },
        sublocality: { type: String },
        sublocality_level_1: { type: String },
        administrative_area_level_1: { type: String },
        plus_code: { type: String },
        political: { type: String }
    },

    // Full formatted address
    address: { type: String, required: true, trim: true },

    // User custom notes (e.g., "Near gate B")
    details: { type: String, default: null },

    // Default address flag
    isDefault: { type: Boolean, default: false }

}, {
    timestamps: true
})


// Index for efficient queries
addressSchema.index({ userId: 1, isDefault: 1 })


// Ensure only one default address per user
addressSchema.pre('save', async function(next) {

    if (this.isDefault && this.isModified('isDefault')) {

        await this.constructor.updateMany(
            { userId: this.userId, _id: { $ne: this._id } },
            { $set: { isDefault: false } }
        )

    }

    next()

})


const Address = mongoose.model("Address", addressSchema)


export default Address