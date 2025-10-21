import mongoose from "mongoose"


const deliverySchema = new mongoose.Schema({

    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    distanceKm: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    status: { type: String, enum: ["ASSIGNED", "PICKED", "DELIVERED"], default: "ASSIGNED" }

}, { timestamps: true })


deliverySchema.index({ orderId: 1 })
deliverySchema.index({ assignedTo: 1, status: 1 })


const Delivery = mongoose.model("Delivery", deliverySchema)


export default Delivery

