import mongoose from "mongoose"


const orderItemSchema = new mongoose.Schema({
    skuId: { type: mongoose.Schema.Types.ObjectId, ref: "SKU", required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    title: { type: String, required: true },
    variantOptions: { type: Map, of: String, default: undefined },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    packagingChoice: {
        id: { type: String },
        name: { type: String },
        fee: { type: Number, default: 0 }
    }
}, { _id: false })


const pricingSchema = new mongoose.Schema({
    subtotal: { type: Number, required: true, min: 0 },
    discounts: { type: Number, required: true, min: 0, default: 0 },
    packagingFee: { type: Number, required: true, min: 0, default: 0 },
    schedulingFee: { type: Number, required: true, min: 0, default: 0 },
    deliveryFee: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 }
}, { _id: false })


const timingSchema = new mongoose.Schema({
    isScheduled: { type: Boolean, default: false },
    scheduledAt: { type: Date, default: null }
}, { _id: false })


const orderSchema = new mongoose.Schema({

    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    location: { type: String, enum: ["in_shop", "away"], required: true },
    type: { type: String, enum: ["pickup", "delivery"], required: true },

    items: { type: [orderItemSchema], required: true },
    pricing: { type: pricingSchema, required: true },
    timing: { type: timingSchema, required: true },

    addressId: { type: mongoose.Schema.Types.ObjectId, ref: "Address", default: null },

    paymentPreference: {
        mode: { type: String, enum: ["post_to_bill", "pay_now", "cash", "cod"], required: true },
        method: { type: String, enum: ["mpesa_stk", "paystack_card", null], default: null }
    },

    status: {
        type: String,
        enum: [
            "PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED",
            "CANCELLED", "REFUNDED"
        ],
        default: "PLACED"
    },

    paymentStatus: {
        type: String,
        enum: ["UNPAID", "PENDING", "PAID", "PARTIALLY_REFUNDED", "REFUNDED"],
        default: "UNPAID"
    },

    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null },
    receiptId: { type: mongoose.Schema.Types.ObjectId, ref: "Receipt", default: null },

    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }

}, { timestamps: true })


orderSchema.index({ customerId: 1, createdAt: -1 })
orderSchema.index({ status: 1, createdAt: -1 })


const Order = mongoose.model("Order", orderSchema)


export default Order

