import mongoose from "mongoose"


const receiptSchema = new mongoose.Schema({

    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true },

    receiptNumber: { type: String, required: true, unique: true },
    amountPaid: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ["mpesa_stk", "paystack_card", "cash"], required: true },
    issuedAt: { type: Date, required: true },
    pdfUrl: { type: String },

    // Optional metadata snapshot (e.g., coupon used)
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }

}, { timestamps: true })


receiptSchema.index({ orderId: 1 })
receiptSchema.index({ invoiceId: 1 })


const Receipt = mongoose.model("Receipt", receiptSchema)


export default Receipt

