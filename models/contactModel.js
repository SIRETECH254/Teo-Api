import mongoose from "mongoose"
import mongoosePaginate from "mongoose-paginate-v2"

const contactReplySchema = new mongoose.Schema({
    message: {
        type: String,
        required: true,
        trim: true
    },
    repliedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

const contactSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    status: {
        type: String,
        enum: ['New', 'Read', 'Replied'],
        default: 'New'
    },
    replies: [contactReplySchema]
}, {
    timestamps: true
})

// Indexes for better query performance
contactSchema.index({ email: 1 })
contactSchema.index({ status: 1 })
contactSchema.index({ userId: 1 })
contactSchema.index({ createdAt: -1 })

// Add pagination plugin
contactSchema.plugin(mongoosePaginate)

const Contact = mongoose.model('Contact', contactSchema)

export default Contact
