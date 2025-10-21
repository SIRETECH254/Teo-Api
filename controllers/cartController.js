import Cart from '../models/cartModel.js'
import Product from '../models/productModel.js'
import { errorHandler } from '../utils/error.js'


// Get user's cart
export const getCart = async (req, res, next) => {
    try {
        const userId = req.user._id
        
        const cart = await Cart.findOrCreateByUser(userId)
        
        // Populate product details
        await cart.populate([
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


// Add item to cart
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


// Update cart item quantity
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


// Remove item from cart
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


// Clear cart
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


// Validate cart (check stock availability)
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