import mongoose from 'mongoose'


const cartItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    skuId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    variantOptions: {
        type: Map,
        of: String,
        default: {}
    }
}, { timestamps: true, _id: true })


const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [cartItemSchema],
    totalAmount: {
        type: Number,
        default: 0
    },
    totalItems: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'converted', 'abandoned'],
        default: 'active'
    },
    expiresAt: {
        type: Date,
        default: function() {
            return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        }
    }
}, { timestamps: true })


// Indexes
cartSchema.index({ userId: 1, status: 1 })
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })


// Methods
cartSchema.methods.calculateTotals = function() {
    this.totalAmount = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0)
    return this
}


cartSchema.methods.addItem = function(productId, skuId, quantity, price, variantOptions = {}) {
    const existingItemIndex = this.items.findIndex(item => 
        item.productId.toString() === productId.toString() && 
        item.skuId.toString() === skuId.toString()
    )

    if (existingItemIndex > -1) {
        // Update existing item quantity
        this.items[existingItemIndex].quantity += quantity
        // Update variant options if provided
        if (Object.keys(variantOptions).length > 0) {
            this.items[existingItemIndex].variantOptions = variantOptions
        }
    } else {
        // Add new item
        this.items.push({
            productId,
            skuId,
            quantity,
            price,
            variantOptions
        })
    }

    this.calculateTotals()
    return this
}


cartSchema.methods.updateItemQuantity = function(skuId, quantity) {
    const itemIndex = this.items.findIndex(item => item.skuId.toString() === skuId.toString())
    
    if (itemIndex > -1) {
        if (quantity <= 0) {
            this.items.splice(itemIndex, 1)
        } else {
            this.items[itemIndex].quantity = quantity
        }
        this.calculateTotals()
    }
    
    return this
}


cartSchema.methods.removeItem = function(skuId) {
    this.items = this.items.filter(item => item.skuId.toString() !== skuId.toString())
    this.calculateTotals()
    return this
}


cartSchema.methods.clear = function() {
    this.items = []
    this.calculateTotals()
    return this
}


// Static methods
cartSchema.statics.findOrCreateByUser = async function(userId) {
    let cart = await this.findOne({ userId, status: 'active' })
    
    if (!cart) {
        cart = new this({ userId })
        await cart.save()
    }
    
    return cart
}


const Cart = mongoose.model('Cart', cartSchema)


export default Cart 