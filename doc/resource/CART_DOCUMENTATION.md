# 🛒 TEO KICKS API - Cart Management Documentation

## 📋 Table of Contents
- [Cart Management Overview](#cart-management-overview)
- [Cart Model](#-cart-model)
- [Cart Controller](#-cart-controller)
- [Cart Routes](#-cart-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Cart Management Overview

Cart Management handles the functionality of a user's shopping cart, allowing them to add, update, remove, and clear items. It also provides validation to ensure item availability and accurate totals. Carts can have different statuses (active, converted, abandoned) and expire after a period.

---

## 👤 Cart Model

### Schema Definition
```typescript
interface ICart {
  _id: string;
  userId: string; // User ObjectId
  items: Array<{
    productId: string; // Product ObjectId
    skuId: string;
    quantity: number;
    price: number;
    variantOptions?: Map<string, string>;
    createdAt: Date;
    updatedAt: Date;
  }>;
  totalAmount: number;
  totalItems: number;
  status: "active" | "converted" | "abandoned";
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/cartModel.js`**

```javascript
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
```

### Validation Rules
```javascript
userId:      { required: true, type: ObjectId, ref: 'User' }
items:       { type: Array of cartItemSchema }
  productId:   { required: true, type: ObjectId, ref: 'Product' }
  skuId:       { required: true, type: ObjectId }
  quantity:    { required: true, type: Number, min: 1 }
  price:       { required: true, type: Number, min: 0 }
  variantOptions: { type: Map, of: String }
totalAmount: { type: Number, default: 0 }
totalItems:  { type: Number, default: 0 }
status:      { type: String, enum: ['active', 'converted', 'abandoned'], default: 'active' }
expiresAt:   { type: Date, default: (30 days from now) }
```

---

## 🎮 Cart Controller

### Required Imports
```javascript
import Cart from '../models/cartModel.js'
import Product from '../models/productModel.js'
import { errorHandler } from '../utils/error.js'
```

### Functions Overview

#### `getCart()`
**Purpose:** Retrieve the authenticated user's active shopping cart.  
**Access:** Private (Authenticated User)  
**Validation:** User must be authenticated.  
**Process:** Finds or creates an active cart for the `req.user._id`, populates userId and product details.  
**Response:** The cart object with its items and all ObjectId references populated.

**Controller Implementation:**
```javascript
export const getCart = async (req, res, next) => {
    try {
        const userId = req.user._id
        
        const cart = await Cart.findOrCreateByUser(userId)
        
        // Populate product details and userId
        await cart.populate([
            {
                path: 'userId',
                select: 'name email phone'
            },
            {
                path: 'items.productId',
                select: 'title images primaryImage slug skus variants'
            }
        ])

        res.json({
            success: true,
            data: cart
        })
    } catch (error) {
        next(errorHandler(500, error.message))
    }
}
```

#### `addToCart()`
**Purpose:** Add a specified product SKU to the user's cart, handling quantity updates and stock checks.  
**Access:** Private (Authenticated User)  
**Validation:** `productId`, `skuId` are required. Checks product existence, activity, SKU existence, and stock availability.  
**Process:** Retrieves the cart, validates stock, adds/updates the item quantity, and formats variant options.  
**Response:** The updated cart object.

**Controller Implementation:**
```javascript
export const addToCart = async (req, res, next) => {
    try {
        const userId = req.user._id
        const { productId, skuId, quantity = 1, variantOptions = {} } = req.body

        // Validate required fields
        if (!productId || !skuId) {
            return next(errorHandler(400, 'Product ID and SKU ID are required'))
        }

        // Check if product exists and is active
        const product = await Product.findById(productId).populate('variants')
        if (!product || product.status !== 'active') {
            return next(errorHandler(404, 'Product not found or inactive'))
        }

        // Check if SKU exists within the product
        const sku = product.skus.id(skuId)
        if (!sku) {
            return next(errorHandler(404, 'SKU not found'))
        }

        // Validate stock availability
        if (sku.stock < quantity) {
            return next(errorHandler(400, `Insufficient stock. Available: ${sku.stock}`))
        }

        // Get or create cart
        const cart = await Cart.findOrCreateByUser(userId)

        // Check if adding this item would exceed stock
        const existingItem = cart.items.find(item => 
            item.skuId.toString() === skuId
        )
        
        const currentQuantity = existingItem ? existingItem.quantity : 0
        const newTotalQuantity = currentQuantity + quantity
        
        if (newTotalQuantity > sku.stock) {
            return next(errorHandler(400, `Cannot add ${quantity} items. Total quantity would exceed available stock of ${sku.stock}`))
        }

        // Format variant options for display (e.g., "Size: X, Color: Red")
        const formattedVariantOptions = {}
        if (Object.keys(variantOptions).length > 0) {
            // Get variant names from the product
            const variantNames = {}
            
            // Check if product has populated variants
            if (product.variants && Array.isArray(product.variants)) {
                product.variants.forEach(variant => {
                    if (variant.options && Array.isArray(variant.options)) {
                        variant.options.forEach(option => {
                            variantNames[option._id.toString()] = {
                                variantName: variant.name,
                                optionValue: option.value
                            }
                        })
                    }
                })
            }

            // Format the variant options
            Object.keys(variantOptions).forEach(variantId => {
                const optionId = variantOptions[variantId]
                const variantInfo = variantNames[optionId]
                if (variantInfo) {
                    formattedVariantOptions[variantInfo.variantName] = variantInfo.optionValue
                } else {
                    // Fallback: if we can't find the variant info, use the IDs
                    formattedVariantOptions[`Variant_${variantId}`] = `Option_${optionId}`
                }
            })
        }

        // Add item to cart with formatted variant options
        cart.addItem(productId, skuId, quantity, sku.price, formattedVariantOptions)
        await cart.save()

        // Populate details for response
        await cart.populate([
            {
                path: 'items.productId',
                select: 'title images primaryImage slug skus'
            }
        ])

        res.json({
            success: true,
            message: 'Item added to cart successfully',
            data: cart
        })
    } catch (error) {
        next(errorHandler(500, error.message))
    }
}
```

#### `updateCartItem()`
**Purpose:** Update the quantity of a specific item in the user's cart.  
**Access:** Private (Authenticated User)  
**Validation:** `skuId` in params, `quantity` in body (non-negative). Checks stock availability if quantity > 0.  
**Process:** Finds the cart, updates the item's quantity, and recalculates totals. Removes item if quantity is 0.  
**Response:** The updated cart object.

**Controller Implementation:**
```javascript
export const updateCartItem = async (req, res, next) => {
    try {
        const userId = req.user._id
        const { skuId } = req.params
        const { quantity } = req.body

        if (quantity < 0) {
            return next(errorHandler(400, 'Quantity must be non-negative'))
        }

        const cart = await Cart.findOne({ userId, status: 'active' })
        if (!cart) {
            return next(errorHandler(404, 'Cart not found'))
        }

        // Check stock if quantity > 0
        if (quantity > 0) {
            // Find the product that contains this SKU
            const cartItem = cart.items.find(item => item.skuId.toString() === skuId)
            if (!cartItem) {
                return next(errorHandler(404, 'Cart item not found'))
            }

            const product = await Product.findById(cartItem.productId)
            if (!product) {
                return next(errorHandler(404, 'Product not found'))
            }

            const sku = product.skus.id(skuId)
            if (!sku) {
                return next(errorHandler(404, 'SKU not found'))
            }
            
            if (sku.stock < quantity) {
                return next(errorHandler(400, `Insufficient stock. Available: ${sku.stock}`))
            }
        }

        // Update quantity
        cart.updateItemQuantity(skuId, quantity)
        await cart.save()

        // Populate details for response
        await cart.populate([
            {
                path: 'items.productId',
                select: 'title images primaryImage slug skus variants'
            }
        ])

        res.json({
            success: true,
            message: 'Cart updated successfully',
            data: cart
        })
    } catch (error) {
        next(errorHandler(500, error.message))
    }
}
```

#### `removeFromCart()`
**Purpose:** Remove a specific item (SKU) from the user's cart.  
**Access:** Private (Authenticated User)  
**Validation:** `skuId` in params.  
**Process:** Finds the cart, removes the item matching `skuId`, and recalculates totals.  
**Response:** The updated cart object.

**Controller Implementation:**
```javascript
export const removeFromCart = async (req, res, next) => {
    try {
        const userId = req.user._id
        const { skuId } = req.params

        const cart = await Cart.findOne({ userId, status: 'active' })
        if (!cart) {
            return next(errorHandler(404, 'Cart not found'))
        }

        cart.removeItem(skuId)
        await cart.save()

        // Populate details for response
        await cart.populate([
            {
                path: 'items.productId',
                select: 'title images primaryImage slug skus variants'
            }
        ])

        res.json({
            success: true,
            message: 'Item removed from cart successfully',
            data: cart
        })
    } catch (error) {
        next(errorHandler(500, error.message))
    }
}
```

#### `clearCart()`
**Purpose:** Remove all items from the authenticated user's cart.  
**Access:** Private (Authenticated User)  
**Validation:** None.  
**Process:** Finds the cart, clears its items array, and recalculates totals.  
**Response:** An empty cart object.

**Controller Implementation:**
```javascript
export const clearCart = async (req, res, next) => {
    try {
        const userId = req.user._id

        const cart = await Cart.findOne({ userId, status: 'active' })
        if (!cart) {
            return next(errorHandler(404, 'Cart not found'))
        }

        cart.clear()
        await cart.save()

        res.json({
            success: true,
            message: 'Cart cleared successfully',
            data: cart
        })
    } catch (error) {
        next(errorHandler(500, error.message))
    }
}
```

#### `validateCart()`
**Purpose:** Perform validation checks on the user's cart, such as stock availability for all items, before checkout.  
**Access:** Private (Authenticated User)  
**Validation:** User must be authenticated.  
**Process:** Iterates through cart items, checks if products/SKUs exist and if quantities exceed available stock.  
**Response:** An object indicating `isValid` status, `errors`, and `warnings`.

**Controller Implementation:**
```javascript
export const validateCart = async (req, res, next) => {
    try {
        const userId = req.user._id

        const cart = await Cart.findOne({ userId, status: 'active' })
        if (!cart) {
            return next(errorHandler(404, 'Cart not found'))
        }

        // Populate product details
        await cart.populate({
            path: 'items.productId',
            select: 'title images primaryImage slug skus variants'
        })

        const validationResults = {
            isValid: true,
            errors: [],
            warnings: []
        }

        // Check each item
        for (const item of cart.items) {
            const product = item.productId
            
            if (!product) {
                validationResults.isValid = false
                validationResults.errors.push(`Product not found for item`)
                continue
            }

            const sku = product.skus.id(item.skuId)
            
            if (!sku) {
                validationResults.isValid = false
                validationResults.errors.push(`SKU not found for item`)
                continue
            }

            if (sku.stock < item.quantity) {
                validationResults.isValid = false
                validationResults.errors.push(`Insufficient stock for ${sku.skuCode}. Available: ${sku.stock}, Requested: ${item.quantity}`)
            } else if (sku.stock <= 5) {
                validationResults.warnings.push(`Low stock for ${sku.skuCode}. Only ${sku.stock} remaining`)
            }
        }

        res.json({
            success: true,
            data: validationResults
        })
    } catch (error) {
        next(errorHandler(500, error.message))
    }
}
```

---

## 🛒 Cart Routes

### Base Path: `/api/cart`

### Router Implementation

**File: `../routes/cartRoute.js`**

```javascript
import express from 'express'
import { authenticateToken } from '../middlewares/auth.js'
import {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    validateCart
} from '../controllers/cartController.js'

const router = express.Router()

// All cart routes require authentication
router.use(authenticateToken)

router.get('/', getCart)
router.post('/add', addToCart)
router.put('/items/:skuId', updateCartItem)
router.delete('/items/:skuId', removeFromCart)
router.delete('/clear', clearCart)
router.get('/validate', validateCart)

export default router
```

### Route Details

#### `GET /api/cart`
**Headers:** `Authorization: Bearer <token>`  
**Purpose:** Retrieve the authenticated user's current shopping cart, including populated product details.  
**Access:** Private (Authenticated User)  
**Response:** `200 OK` with the cart object.
```json
{
  "success": true,
  "data": {
    "_id": "65e26b1c09b068c201383814",
    "userId": {
      "_id": "65e26b1c09b068c201383812",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "254712345678"
    },
    "items": [
      {
        "_id": "65e26b1c09b068c201383815",
        "productId": {
          "_id": "65e26b1c09b068c201383816",
          "title": "Classic White Sneaker",
          "images": [],
          "primaryImage": "https://example.com/image.jpg",
          "slug": "classic-white-sneaker",
          "skus": [],
          "variants": []
        },
        "skuId": "65e26b1c09b068c201383817",
        "quantity": 1,
        "price": 1500,
        "variantOptions": {
          "Size": "M",
          "Color": "White"
        },
        "createdAt": "2026-02-15T10:00:00.000Z",
        "updatedAt": "2026-02-15T10:00:00.000Z"
      }
    ],
    "totalAmount": 1500,
    "totalItems": 1,
    "status": "active",
    "expiresAt": "2026-03-17T10:00:00.000Z",
    "createdAt": "2026-02-15T10:00:00.000Z",
    "updatedAt": "2026-02-15T10:00:00.000Z"
  }
}
```

#### `POST /api/cart/add`
**Headers:** `Authorization: Bearer <token>`  
**Body (JSON):**  
```json
{
  "productId": "65e26b1c09b068c201383812",
  "skuId": "65e26b1c09b068c201383813",
  "quantity": 1,
  "variantOptions": {
    "Color": "Red",
    "Size": "M"
  }
}
```
**Purpose:** Add a specific product SKU with a given quantity and variant options to the user's cart. If the item exists, its quantity is updated.  
**Access:** Private (Authenticated User)  
**Response:** `200 OK` with the updated cart object.
```json
{
  "success": true,
  "message": "Item added to cart successfully",
  "data": {
    "_id": "65e26b1c09b068c201383814",
    "userId": {
      "_id": "65e26b1c09b068c201383812",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "254712345678"
    },
    "items": [
      {
        "_id": "65e26b1c09b068c201383815",
        "productId": {
          "_id": "65e26b1c09b068c201383816",
          "title": "Classic White Sneaker",
          "images": [],
          "primaryImage": "https://example.com/image.jpg",
          "slug": "classic-white-sneaker",
          "skus": []
        },
        "skuId": "65e26b1c09b068c201383817",
        "quantity": 1,
        "price": 1500,
        "variantOptions": {
          "Size": "M",
          "Color": "White"
        }
      }
    ],
    "totalAmount": 1500,
    "totalItems": 1,
    "status": "active"
  }
}
```

#### `PUT /api/cart/items/:skuId`
**Headers:** `Authorization: Bearer <token>`  
**Parameters:** `skuId` (path) - The ID of the SKU to update in the cart.  
**Body (JSON):**  
```json
{
  "quantity": 2
}
```
**Purpose:** Update the quantity of an item identified by `skuId` in the user's cart. If quantity is 0, the item is removed.  
**Access:** Private (Authenticated User)  
**Response:** `200 OK` with the updated cart object.
```json
{
  "success": true,
  "message": "Cart updated successfully",
  "data": {
    "_id": "65e26b1c09b068c201383814",
    "userId": {
      "_id": "65e26b1c09b068c201383812",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "254712345678"
    },
    "items": [
      {
        "_id": "65e26b1c09b068c201383815",
        "productId": {
          "_id": "65e26b1c09b068c201383816",
          "title": "Classic White Sneaker",
          "images": [],
          "primaryImage": "https://example.com/image.jpg",
          "slug": "classic-white-sneaker",
          "skus": [],
          "variants": []
        },
        "skuId": "65e26b1c09b068c201383817",
        "quantity": 2,
        "price": 1500,
        "variantOptions": {}
      }
    ],
    "totalAmount": 3000,
    "totalItems": 2,
    "status": "active"
  }
}
```

#### `DELETE /api/cart/items/:skuId`
**Headers:** `Authorization: Bearer <token>`  
**Parameters:** `skuId` (path) - The ID of the SKU to remove from the cart.  
**Purpose:** Remove a specific item from the user's cart.  
**Access:** Private (Authenticated User)  
**Response:** `200 OK` with the updated cart object.
```json
{
  "success": true,
  "message": "Item removed from cart successfully",
  "data": {
    "_id": "65e26b1c09b068c201383814",
    "userId": {
      "_id": "65e26b1c09b068c201383812",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "254712345678"
    },
    "items": [],
    "totalAmount": 0,
    "totalItems": 0,
    "status": "active"
  }
}
```

#### `DELETE /api/cart/clear`
**Headers:** `Authorization: Bearer <token>`  
**Purpose:** Remove all items from the authenticated user's shopping cart.  
**Access:** Private (Authenticated User)  
**Response:** `200 OK` with the cleared cart object.
```json
{
  "success": true,
  "message": "Cart cleared successfully",
  "data": {
    "_id": "65e26b1c09b068c201383814",
    "userId": {
      "_id": "65e26b1c09b068c201383812",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "254712345678"
    },
    "items": [],
    "totalAmount": 0,
    "totalItems": 0,
    "status": "active"
  }
}
```

#### `GET /api/cart/validate`
**Headers:** `Authorization: Bearer <token>`  
**Purpose:** Validate the contents of the user's cart, checking for issues like insufficient stock.  
**Access:** Private (Authenticated User)  
**Response:** `200 OK` with validation results, including `isValid` (boolean), `errors` (array of strings), and `warnings` (array of strings).
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "errors": [],
    "warnings": [
      "Low stock for SNEAKER-WHITE-M. Only 3 remaining"
    ]
  }
}
```

---

## 🔐 Middleware

- `authenticateToken`: Used on `router.use(authenticateToken)` to protect all cart routes, ensuring only authenticated users can access and modify their carts.

---

## 📝 API Examples

### Get User Cart
```bash
curl -X GET http://localhost:5000/api/cart 
  -H "Authorization: Bearer <access_token>"
```

### Add Item to Cart
```bash
curl -X POST http://localhost:5000/api/cart/add 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <access_token>" 
  -d '{
    "productId": "65e26b1c09b068c201383812",
    "skuId": "65e26b1c09b068c201383813",
    "quantity": 1,
    "variantOptions": {
      "Color": "Red",
      "Size": "M"
    }
  }'
```

### Update Cart Item Quantity
```bash
curl -X PUT http://localhost:5000/api/cart/items/<sku_id> 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <access_token>" 
  -d '{
    "quantity": 2
  }'
```

### Clear Cart
```bash
curl -X DELETE http://localhost:5000/api/cart/clear 
  -H "Authorization: Bearer <access_token>"
```

---

## 🛡️ Security Features

-   **Authentication:** All cart operations require a valid JWT token, linking the cart to the authenticated user.
-   **Ownership Enforcement:** The system ensures that users can only manage their own shopping carts, implicitly enforced by using `req.user._id` to query for carts.
-   **Stock Validation:** Prevents over-selling by checking product SKU stock availability before adding or updating items in the cart.
-   **TTL Index:** The `expiresAt` field with a TTL index automatically cleans up abandoned carts from the database, preventing data bloat.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

-   `400 Bad Request`: Invalid input (e.g., missing `productId` or `skuId`, `quantity` below minimum, `quantity` exceeding available stock).
-   `401 Unauthorized`: Missing or invalid authentication token.
-   `404 Not Found`: The user's active cart, specified product, or SKU was not found.
-   `500 Internal Server Error`: An unexpected server-side error occurred during processing.

---

## 📊 Database Indexes

-   `userId: 1, status: 1`: For efficient retrieval of a user's active or converted carts.
-   `expiresAt: 1` (TTL index, `expireAfterSeconds: 0`): Automatically deletes abandoned carts (status 'abandoned') after their `expiresAt` timestamp.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
