import mongoose from "mongoose"


const notificationSchema = new mongoose.Schema({

    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
        type: String,
        enum: [
            "order_created", "payment_success", "order_status_changed", "invoice_generated", "receipt_issued"
        ],
        required: true
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false }

}, { timestamps: true })


notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ type: 1, createdAt: -1 })


const Notification = mongoose.model("Notification", notificationSchema)


export default Notification

