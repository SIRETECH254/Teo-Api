import mongoose from "mongoose"


const paymentSchema = new mongoose.Schema({

    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true },

    method: {
        type: String,
        enum: ["mpesa_stk", "paystack_card", "cash", "post_to_bill", "cod"],
        required: true
    },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "KES" },

    processorRefs: {
        daraja: {
            merchantRequestId: { type: String },
            checkoutRequestId: { type: String }
        },
        paystack: {
            reference: { type: String }
        }
    },

    status: { type: String, enum: ["INITIATED", "PENDING", "SUCCESS", "FAILED", "CANCELLED"], default: "PENDING" },

    rawPayload: { type: mongoose.Schema.Types.Mixed, default: null }

}, { timestamps: true })


paymentSchema.index({ invoiceId: 1, createdAt: -1 })
paymentSchema.index({ "processorRefs.daraja.checkoutRequestId": 1 })
paymentSchema.index({ "processorRefs.paystack.reference": 1 })


const Payment = mongoose.model("Payment", paymentSchema)


export default Payment

