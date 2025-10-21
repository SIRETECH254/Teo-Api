import mongoose from "mongoose"


const invoiceLineItemSchema = new mongoose.Schema({
    label: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 }
}, { _id: false })


const invoiceSchema = new mongoose.Schema({

    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    number: { type: String, required: true, unique: true },
    lineItems: { type: [invoiceLineItemSchema], default: [] },

    subtotal: { type: Number, required: true, min: 0 },
    // Total discounts applied to this invoice (e.g., coupon). Stored as a positive number.
    discounts: { type: Number, required: true, min: 0, default: 0 },
    fees: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    balanceDue: { type: Number, required: true, min: 0 },

    paymentStatus: { type: String, enum: ["PENDING", "PAID", "CANCELLED"], default: "PENDING" },

    // Optional metadata snapshot, e.g., coupon details used for this invoice
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }

}, { timestamps: true })


invoiceSchema.index({ orderId: 1 })
invoiceSchema.index({ paymentStatus: 1, createdAt: -1 })


const Invoice = mongoose.model("Invoice", invoiceSchema)


export default Invoice

