import Product from "../models/productModel.js"
import Variant from "../models/variantModel.js"
import { validateProduct, validateSKU, validateVariantAttachment } from "../utils/validation.js"
import { errorHandler } from "../utils/error.js"
import { generateUniqueSlug } from "../utils/slugGenerator.js"
import { 
    uploadToCloudinary, 
    deleteFromCloudinary, 
    getResponsiveImageUrls,
    getOptimizedImageUrl 
} from "../utils/cloudinary.js"



// Helper function to populate optionIds from variant's options
const populateOptionIds = (variant, optionIds) => {
    if (!variant || !variant.options || !optionIds || !Array.isArray(optionIds)) {
        return optionIds
    }
    return optionIds.map(optionId => {
        const optionIdStr = optionId.toString ? optionId.toString() : String(optionId)
        const option = variant.options.find(opt => opt._id && opt._id.toString() === optionIdStr)
        return option || optionId
    })
}

// Helper function to populate optionId from variant's options
const populateOptionId = (variant, optionId) => {
    if (!variant || !variant.options || !optionId) {
        return optionId
    }
    const optionIdStr = optionId.toString ? optionId.toString() : String(optionId)
    const option = variant.options.find(opt => opt._id && opt._id.toString() === optionIdStr)
    return option || optionId
}


// Create a new product
export const createProduct = async (req, res, next) => {
    try {
        const { title, description, shortDescription, brand, categories, collections, tags, basePrice, comparePrice, variants, features, trackInventory, weight, selectedVariantOptions, status } = req.body

        if (!title) {
            return next(errorHandler(400, "Product title is required"))
        }

        // Helper function to parse JSON strings from form-data, or return the value if already parsed
        const parseFormDataField = (value, defaultValue = []) => {
            if (!value) return defaultValue
            if (Array.isArray(value)) return value // Already an array
            if (typeof value === 'object') return value // Already an object
            if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value)
                    return parsed
                } catch (e) {
                    // If parsing fails, treat empty string as empty, others as invalid
                    if (value.trim() === '') {
                        return defaultValue
                    }
                    return defaultValue
                }
            }
            return defaultValue
        }

        // Generate unique slug
        const slug = await generateUniqueSlug(title, async (slug) => {
            const existingProduct = await Product.findOne({ slug })
            return !!existingProduct
        })

        // Handle image uploads
        let processedImages = []
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    // When using Cloudinary storage, the file is already uploaded
                    // We can access the Cloudinary result from the file object
                    if (file.path) {
                        // Traditional file upload - upload to Cloudinary
                        const uploadResult = await uploadToCloudinary(file.path, 'teo-kicks/products')
                        
                        processedImages.push({
                            url: uploadResult.url,
                            public_id: uploadResult.public_id,
                            alt: file.originalname,
                            isPrimary: processedImages.length === 0 // First image is primary
                        })
                    } else if (file.secure_url) {
                        // Cloudinary storage already uploaded the file
                        processedImages.push({
                            url: file.secure_url,
                            public_id: file.public_id,
                            alt: file.originalname,
                            isPrimary: processedImages.length === 0 // First image is primary
                        })
                    } else {
                        // Fallback: try to upload using file buffer
                        const uploadResult = await uploadToCloudinary(file.buffer, 'teo-kicks/products')
                        
                        processedImages.push({
                            url: uploadResult.url,
                            public_id: uploadResult.public_id,
                            alt: file.originalname,
                            isPrimary: processedImages.length === 0 // First image is primary
                        })
                    }
                } catch (uploadError) {
                    console.error('Image upload error:', uploadError)
                    return next(errorHandler(500, `Failed to upload image: ${uploadError.message}`))
                }
            }
        }

        const product = new Product({
            title,
            slug,
            description,
            shortDescription,
            brand: brand || undefined,
            categories: parseFormDataField(categories, []),
            collections: parseFormDataField(collections, []),
            tags: parseFormDataField(tags, []),
            basePrice,
            comparePrice,
            variants: parseFormDataField(variants, []),
            selectedVariantOptions: parseFormDataField(selectedVariantOptions, []),
            images: processedImages,
            features: parseFormDataField(features, []),
            trackInventory,
            weight,
            status: status || undefined, // Use provided status or default to schema default ("draft")
            createdBy: req.user._id
        })

        // Generate SKUs BEFORE first save to avoid null skuCode index error
        // generateSKUs() will save the product, so we don't need to save separately
        await product.generateSKUs()

        res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: {
                product: {
                    id: product._id,
                    title: product.title,
                    slug: product.slug,
                    description: product.description,
                    brand: product.brand,
                    categories: product.categories,
                    collections: product.collections,
                    tags: product.tags,
                    basePrice: product.basePrice,
                    comparePrice: product.comparePrice,
                    variants: product.variants,
                    skus: product.skus,
                    images: product.images,
                    status: product.status,
                    createdAt: product.createdAt
                }
            }
        })

    } catch (error) {
        console.error("Create product error:", error)
        console.error("Create product error stack:", error.stack)
        console.error("Create product error message:", error.message)
        next(errorHandler(500, "Server error while creating product"))
    }
}





// Get all products with pagination and filtering
export const getAllProducts = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, category, collection, status, sort } = req.query

        const query = {}

        // Add search filter
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ]
        }

        // Add category filter
        if (category) {
            query.categories = category
        }

        // Add collection filter
        if (collection) {
            query.collections = collection
        }

        // Add status filter
        if (status) {
            query.status = status
        }

        // Determine sort order
        let sortOption = { createdAt: -1 } // Default: Newest

        if (sort) {
            switch (sort) {
                case 'name_asc':
                    sortOption = { title: 1 }
                    break
                case 'name_desc':
                    sortOption = { title: -1 }
                    break
                case 'price_asc':
                    sortOption = { basePrice: 1 }
                    break
                case 'price_desc':
                    sortOption = { basePrice: -1 }
                    break
                case 'oldest':
                    sortOption = { createdAt: 1 }
                    break
                case 'newest':
                    sortOption = { createdAt: -1 }
                    break
                default:
                    sortOption = { createdAt: -1 }
            }
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            populate: [
                'categories', 
                'collections', 
                'createdBy',
                'brand',
                'tags',
                {
                    path: 'variants',
                    populate: {
                        path: 'options'
                    }
                },
                {
                    path: 'selectedVariantOptions.variantId',
                    populate: {
                        path: 'options'
                    }
                },
                {
                    path: 'skus.attributes.variantId',
                    select: 'name options',
                    populate: {
                    path: 'options'
                    }
                }
            ],
            sort: sortOption
        }





        const products = await Product.paginate(query, options)

        // Convert to plain objects and populate optionIds and optionId for all products
        if (products.docs) {
            products.docs = products.docs.map(product => {
                const productObj = product.toObject ? product.toObject() : product
                
                // Populate optionIds in selectedVariantOptions
                if (productObj.selectedVariantOptions) {
                    productObj.selectedVariantOptions.forEach(sel => {
                        if (sel.variantId && sel.variantId.options) {
                            sel.optionIds = populateOptionIds(sel.variantId, sel.optionIds)
                        }
                    })
                }

                // Populate optionId in SKU attributes
                if (productObj.skus) {
                    productObj.skus.forEach(sku => {
                        if (sku.attributes) {
                            sku.attributes.forEach(attr => {
                                if (attr.variantId && attr.variantId.options) {
                                    attr.optionId = populateOptionId(attr.variantId, attr.optionId)
                                }
                            })
                        }
                    })
                }
                
                return productObj
            })
        }





        res.json({

            success: true,

            message: "Products retrieved successfully",

            data: products.docs,

            pagination: {

                page: products.page,

                limit: products.limitDocs,

                totalDocs: products.totalDocs,

                totalPages: products.totalPages,

                hasNextPage: products.hasNextPage,

                hasPrevPage: products.hasPrevPage

            }

        })

    } catch (error) {

        console.error("Get all products error:", error)

        res.status(500).json({

            success: false,

            message: "Error retrieving products",

            error: error.message

        })

    }

}





// Get product by ID
export const getProductById = async (req, res) => {

    try {

        const product = await Product.findById(req.params.id)

            .populate('categories')

            .populate('collections')

            .populate('createdBy', 'name email')

            .populate('brand')

            .populate('tags')

            .populate({
                path: 'variants',
                populate: {
                    path: 'options'
                }
            })

            .populate({
                path: 'selectedVariantOptions.variantId',
                populate: {
                    path: 'options'
                }
            })

            .populate({
                path: 'skus.attributes.variantId',
                select: 'name options',
                populate: {
                    path: 'options'
                }
            })
            .lean()





        if (!product) {

            return res.status(404).json({

                success: false,

                message: "Product not found"

            })

        }

        // Populate optionIds in selectedVariantOptions
        if (product.selectedVariantOptions) {
            product.selectedVariantOptions.forEach(sel => {
                if (sel.variantId && sel.variantId.options) {
                    sel.optionIds = populateOptionIds(sel.variantId, sel.optionIds)
                }
            })
        }

        // Populate optionId in SKU attributes
        if (product.skus) {
            product.skus.forEach(sku => {
                if (sku.attributes) {
                    sku.attributes.forEach(attr => {
                        if (attr.variantId && attr.variantId.options) {
                            attr.optionId = populateOptionId(attr.variantId, attr.optionId)
                        }
                    })
                }
            })
        }





        res.json({

            success: true,

            message: "Product retrieved successfully",

            data: product

        })

    } catch (error) {

        console.error("Get product by ID error:", error)

        res.status(500).json({

            success: false,

            message: "Error retrieving product",

            error: error.message

        })

    }

}





// Update product
export const updateProduct = async (req, res, next) => {
    try {
        const { productId } = req.params
        const { title, description, shortDescription, brand, categories, collections, tags, basePrice, comparePrice, variants, features, metaTitle, metaDescription, trackInventory, weight, status, selectedVariantOptions } = req.body

        const product = await Product.findById(productId)

        if (!product) {
            return next(errorHandler(404, "Product not found"))
        }

        // Helper function to parse JSON strings from form-data, or return the value if already parsed
        // Returns { parsed: value, wasProvided: boolean } to distinguish omitted vs empty fields
        const parseFormDataField = (value, defaultValue = []) => {
            // Field was not provided at all
            if (value === undefined) {
                return { parsed: defaultValue, wasProvided: false }
            }
            
            // Field was provided as empty string - treat as explicitly empty
            if (value === '' || value === null) {
                return { parsed: defaultValue, wasProvided: true }
            }
            
            // Already an array
            if (Array.isArray(value)) {
                return { parsed: value, wasProvided: true }
            }
            
            // Already an object
            if (typeof value === 'object') {
                return { parsed: value, wasProvided: true }
            }
            
            // Try to parse as JSON string
            if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value)
                    return { parsed: parsed, wasProvided: true }
                } catch (e) {
                    // If parsing fails, treat empty string as explicitly empty, others as invalid
                    if (value.trim() === '') {
                        return { parsed: defaultValue, wasProvided: true }
                    }
                    return { parsed: defaultValue, wasProvided: true }
                }
            }
            
            return { parsed: defaultValue, wasProvided: true }
        }

        // Generate new slug if title changed
        if (title && title !== product.title) {
            const slug = await generateUniqueSlug(title, async (slug) => {
                const existingProduct = await Product.findOne({ 
                    slug, 
                    _id: { $ne: productId } 
                })
                return !!existingProduct
            })
            product.slug = slug
        }

        // Handle image retention/removal using keep arrays
        // Supports both arrays and JSON strings from form-data
        const parseJsonArray = (raw) => {
            if (!raw) return []
            if (Array.isArray(raw)) return raw
            if (typeof raw === 'string') {
                try {
                    const parsed = JSON.parse(raw)
                    return Array.isArray(parsed) ? parsed : []
                } catch (e) {
                    // If not valid JSON, treat as single value array
                    return raw.trim() ? [raw] : []
                }
            }
            return []
        }

        // Check if image keep arrays were explicitly provided (even if empty)
        const keepImagePublicIdsProvided = req.body.keepImagePublicIds !== undefined || req.body.keepImages !== undefined
        const keepImageDocIdsProvided = req.body.keepImageDocIds !== undefined

        const keepPublicIds = new Set([
            ...parseJsonArray(req.body.keepImagePublicIds),
            ...parseJsonArray(req.body.keepImages), // backward compat
        ].filter(Boolean))

        const keepDocIds = new Set(parseJsonArray(req.body.keepImageDocIds).map(String))

        // Process image removal if keep arrays were explicitly provided
        if (keepImagePublicIdsProvided || keepImageDocIdsProvided) {
            const currentImages = Array.isArray(product.images) ? product.images : []
            const toDelete = currentImages.filter(img => !keepPublicIds.has(img.public_id) && !keepDocIds.has(String(img._id)))

            for (const image of toDelete) {
                if (image.public_id) {
                    try { await deleteFromCloudinary(image.public_id) } catch (e) { console.warn('Cloudinary delete failed:', e?.message) }
                }
            }

            // Retain only images that are kept
            product.images = currentImages.filter(img => keepPublicIds.has(img.public_id) || keepDocIds.has(String(img._id)))
        }

        // Handle new image uploads
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    // When using Cloudinary storage, the file is already uploaded
                    // We can access the Cloudinary result from the file object
                    if (file.path) {
                        // Traditional file upload - upload to Cloudinary
                        const uploadResult = await uploadToCloudinary(file.path, 'teo-kicks/products')
                        
                        product.images.push({
                            url: uploadResult.url,
                            public_id: uploadResult.public_id,
                            alt: file.originalname,
                            isPrimary: product.images.length === 0 // Primary if no images exist
                        })
                    } else if (file.secure_url) {
                        // Cloudinary storage already uploaded the file
                        product.images.push({
                            url: file.secure_url,
                            public_id: file.public_id,
                            alt: file.originalname,
                            isPrimary: product.images.length === 0 // Primary if no images exist
                        })
                    } else {
                        // Fallback: try to upload using file buffer
                        const uploadResult = await uploadToCloudinary(file.buffer, 'teo-kicks/products')
                        
                        product.images.push({
                            url: uploadResult.url,
                            public_id: uploadResult.public_id,
                            alt: file.originalname,
                            isPrimary: product.images.length === 0 // Primary if no images exist
                        })
                    }
                } catch (uploadError) {
                    console.error('Image upload error:', uploadError)
                    return next(errorHandler(500, `Failed to upload image: ${uploadError.message}`))
                }
            }
        }

        // Update fields
        if (title) product.title = title
        if (description !== undefined) product.description = description
        if (shortDescription !== undefined) product.shortDescription = shortDescription
        if (brand !== undefined) product.brand = brand || undefined
        
        // Parse array fields that can be omitted vs explicitly empty
        if (categories !== undefined) {
            const { parsed } = parseFormDataField(categories, [])
            product.categories = parsed
        }
        if (collections !== undefined) {
            const { parsed } = parseFormDataField(collections, [])
            product.collections = parsed
        }
        if (tags !== undefined) {
            const { parsed } = parseFormDataField(tags, [])
            product.tags = parsed
        }
        if (basePrice !== undefined) product.basePrice = basePrice
        if (comparePrice !== undefined) product.comparePrice = comparePrice
        if (features !== undefined) {
            const { parsed } = parseFormDataField(features, [])
            product.features = parsed
        }
        
        // Track changes for variants and selectedVariantOptions
        // CRITICAL: Only update these if explicitly provided in request
        let selectedVariantOptionsChanged = false
        let variantsChanged = false
        
        // Check if variants changed - only update if explicitly provided
        const variantsParseResult = parseFormDataField(variants, [])
        if (variantsParseResult.wasProvided) {
            const parsedVariants = variantsParseResult.parsed
            const existingVariantsStr = JSON.stringify((product.variants || []).map(v => v.toString()).sort())
            const newVariantsStr = JSON.stringify(parsedVariants.map(v => v.toString()).sort())
            if (existingVariantsStr !== newVariantsStr) {
                product.variants = parsedVariants
                variantsChanged = true
            }
        }
        
        // Only update selectedVariantOptions if it's explicitly provided AND different from current value
        const selectedVariantOptionsParseResult = parseFormDataField(selectedVariantOptions, [])
        if (selectedVariantOptionsParseResult.wasProvided) {
            const parsedSelectedVariantOptions = selectedVariantOptionsParseResult.parsed
            // Compare with existing value to detect actual changes
            const existingStr = JSON.stringify(product.selectedVariantOptions || [])
            const newStr = JSON.stringify(parsedSelectedVariantOptions)
            if (existingStr !== newStr) {
                product.selectedVariantOptions = parsedSelectedVariantOptions
                selectedVariantOptionsChanged = true
            }
        }
        
        // If variants changed, sync selectedVariantOptions to remove entries for removed variants
        if (variantsChanged && !selectedVariantOptionsChanged) {
            const currentVariantIds = new Set((product.variants || []).map(v => v.toString()))
            if (product.selectedVariantOptions && product.selectedVariantOptions.length > 0) {
                const filtered = product.selectedVariantOptions.filter(sel => {
                    const variantId = typeof sel.variantId === 'object' ? sel.variantId._id.toString() : sel.variantId.toString()
                    return currentVariantIds.has(variantId)
                })
                if (filtered.length !== product.selectedVariantOptions.length) {
                    product.selectedVariantOptions = filtered
                    selectedVariantOptionsChanged = true
                }
            }
        }
        
        if (metaTitle !== undefined) product.metaTitle = metaTitle
        if (metaDescription !== undefined) product.metaDescription = metaDescription
        if (trackInventory !== undefined) product.trackInventory = trackInventory
        if (weight !== undefined) product.weight = weight
        if (status !== undefined) product.status = status

        // Ensure one image is primary
        if (Array.isArray(product.images) && product.images.length > 0) {
            const hasPrimary = product.images.some(img => img.isPrimary)
            if (!hasPrimary) {
                product.images[0].isPrimary = true
            }
        }

        await product.save()

        // Regenerate SKUs if selectedVariantOptions changed OR variants changed
        if (selectedVariantOptionsChanged || variantsChanged) {
            await product.generateSKUs()
        }

        res.status(200).json({
            success: true,
            message: "Product updated successfully",
            data: {
                product: {
                    id: product._id,
                    title: product.title,
                    slug: product.slug,
                    description: product.description,
                    brand: product.brand,
                    categories: product.categories,
                    collections: product.collections,
                    tags: product.tags,
                    basePrice: product.basePrice,
                    comparePrice: product.comparePrice,
                    variants: product.variants,
                    selectedVariantOptions: product.selectedVariantOptions,
                    skus: product.skus,
                    images: product.images,
                    status: product.status,
                    updatedAt: product.updatedAt
                }
            }
        })

    } catch (error) {
        console.error("Update product error:", error)
        next(errorHandler(500, "Server error while updating product"))
    }
}





// Delete product
export const deleteProduct = async (req, res, next) => {
    try {
        const { productId } = req.params

        const product = await Product.findById(productId)

        if (!product) {
            return next(errorHandler(404, "Product not found"))
        }

        // Delete images from Cloudinary
        if (product.images && product.images.length > 0) {
            for (const image of product.images) {
                if (image.public_id) {
                    try {
                        await deleteFromCloudinary(image.public_id)
                    } catch (deleteError) {
                        console.error('Failed to delete image from Cloudinary:', deleteError)
                    }
                }
            }
        }

        await Product.findByIdAndDelete(productId)

        res.status(200).json({
            success: true,
            message: "Product deleted successfully"
        })

    } catch (error) {
        console.error("Delete product error:", error)
        next(errorHandler(500, "Server error while deleting product"))
    }
}





// Generate SKUs for a product
export const generateSKUs = async (req, res) => {

    try {

        const product = await Product.findById(req.params.id)


        if (!product) {

            return res.status(404).json({

                success: false,

                message: "Product not found"

            })

        }





        await product.generateSKUs()





        res.json({

            success: true,

            message: "SKUs generated successfully",

            data: product.skus

        })

    } catch (error) {

        console.error("Generate SKUs error:", error)

        res.status(500).json({

            success: false,

            message: "Error generating SKUs",

            error: error.message

        })

    }

}





// Update SKU
export const updateSKU = async (req, res) => {

    try {

        const { productId, skuId } = req.params

        const updateData = req.body

        const product = await Product.findById(productId)





        if (!product) {

            return res.status(404).json({

                success: false,

                message: "Product not found"

            })

        }





        const sku = product.skus.id(skuId)

        if (!sku) {

            return res.status(404).json({

                success: false,

                message: "SKU not found"

            })

        }





        Object.assign(sku, updateData)

        await product.save()





        res.json({

            success: true,

            message: "SKU updated successfully",

            data: sku

        })

    } catch (error) {

        console.error("Update SKU error:", error)

        res.status(500).json({

            success: false,

            message: "Error updating SKU",

            error: error.message

        })

    }

}





// Delete SKU
export const deleteSKU = async (req, res, next) => {
    try {
        const { productId, skuId } = req.params

        const product = await Product.findById(productId)

        if (!product) {
            return next(errorHandler(404, "Product not found"))
        }

        const sku = product.skus.id(skuId)
        if (!sku) {
            return next(errorHandler(404, "SKU not found"))
        }

        sku.remove()
        await product.save()

        res.status(200).json({
            success: true,
            message: "SKU deleted successfully"
        })

    } catch (error) {
        console.error("Delete SKU error:", error)
        next(errorHandler(500, "Server error while deleting SKU"))
    }
}



// Attach variant to product
export const attachVariant = async (req, res, next) => {
    try {
        const { productId } = req.params
        const { variantId, optionIds } = req.body

        // Validate request data
        const { error } = validateVariantAttachment(req.body)
        if (error) {
            return next(errorHandler(400, error.details[0].message))
        }

        // Validate optionIds if provided
        if (!optionIds || !Array.isArray(optionIds) || optionIds.length === 0) {
            return next(errorHandler(400, "optionIds array is required and must not be empty"))
        }

        const product = await Product.findById(productId)
        if (!product) {
            return next(errorHandler(404, "Product not found"))
        }

        // Fetch variant to validate optionIds
        const variant = await Variant.findById(variantId)
        if (!variant) {
            return next(errorHandler(404, "Variant not found"))
        }

        // Validate all optionIds belong to this variant
        const variantOptionIds = new Set(variant.options.map(opt => opt._id.toString()))
        const invalidOptionIds = optionIds.filter(optId => !variantOptionIds.has(optId.toString()))
        
        if (invalidOptionIds.length > 0) {
            return next(errorHandler(400, `Invalid optionIds: ${invalidOptionIds.join(', ')}. These options do not belong to the specified variant.`))
        }

        // Initialize selectedVariantOptions if it doesn't exist
        if (!product.selectedVariantOptions) {
            product.selectedVariantOptions = []
        }

        // Check if variant selection already exists, update it; otherwise add new
        const existingSelectionIndex = product.selectedVariantOptions.findIndex(
            sel => sel.variantId.toString() === variantId.toString()
        )

        if (existingSelectionIndex >= 0) {
            // Update existing selection
            product.selectedVariantOptions[existingSelectionIndex].optionIds = optionIds
        } else {
            // Add new selection
            product.selectedVariantOptions.push({
                variantId,
                optionIds
            })
        }

        // Sync variants array (ensure variantId is in variants if not already)
        if (!product.variants.some(id => id.toString() === variantId.toString())) {
            product.variants.push(variantId)
        }

        // Regenerate SKUs based on selected options
        await product.generateSKUs()

        res.status(200).json({
            success: true,
            message: "Variant attached successfully",
            data: {
                product: {
                    id: product._id,
                    variants: product.variants,
                    selectedVariantOptions: product.selectedVariantOptions,
                    skus: product.skus
                }
            }
        })

    } catch (error) {
        console.error("Attach variant error:", error)
        next(errorHandler(500, "Server error while attaching variant"))
    }
}



// Detach variant from product
export const detachVariant = async (req, res, next) => {
    try {
        const { productId } = req.params
        const { variantId } = req.body

        // Validate request data
        const { error } = validateVariantAttachment(req.body)
        if (error) {
            return next(errorHandler(400, error.details[0].message))
        }

        const product = await Product.findById(productId)
        if (!product) {
            return next(errorHandler(404, "Product not found"))
        }

        // Remove from selectedVariantOptions
        if (product.selectedVariantOptions) {
            product.selectedVariantOptions = product.selectedVariantOptions.filter(
                sel => sel.variantId.toString() !== variantId.toString()
            )
        }

        // Remove variant from variants array
        product.variants = product.variants.filter(id => id.toString() !== variantId.toString())

        // Regenerate SKUs (will create default SKU if no selectedVariantOptions remain)
        await product.generateSKUs()

        res.status(200).json({
            success: true,
            message: "Variant detached successfully",
            data: {
                product: {
                    id: product._id,
                    variants: product.variants,
                    selectedVariantOptions: product.selectedVariantOptions,
                    skus: product.skus
                }
            }
        })

    } catch (error) {
        console.error("Detach variant error:", error)
        next(errorHandler(500, "Server error while detaching variant"))
    }
}



// Upload product images
export const uploadProductImages = async (req, res, next) => {
    try {
        const { productId } = req.params

        const product = await Product.findById(productId)
        if (!product) {
            return next(errorHandler(404, "Product not found"))
        }

        if (!req.files || req.files.length === 0) {
            return next(errorHandler(400, "No images uploaded"))
        }

        const uploadedImages = []
        for (const file of req.files) {
            try {
                // When using Cloudinary storage, the file is already uploaded
                // We can access the Cloudinary result from the file object
                if (file.path) {
                    // Traditional file upload - upload to Cloudinary
                    const uploadResult = await uploadToCloudinary(file.path, 'teo-kicks/products')
                    
                    uploadedImages.push({
                        url: uploadResult.url,
                        public_id: uploadResult.public_id,
                        alt: file.originalname,
                        isPrimary: product.images.length === 0 && uploadedImages.length === 0
                    })
                } else if (file.secure_url) {
                    // Cloudinary storage already uploaded the file
                    uploadedImages.push({
                        url: file.secure_url,
                        public_id: file.public_id,
                        alt: file.originalname,
                        isPrimary: product.images.length === 0 && uploadedImages.length === 0
                    })
                } else {
                    // Fallback: try to upload using file buffer
                    const uploadResult = await uploadToCloudinary(file.buffer, 'teo-kicks/products')
                    
                    uploadedImages.push({
                        url: uploadResult.url,
                        public_id: uploadResult.public_id,
                        alt: file.originalname,
                        isPrimary: product.images.length === 0 && uploadedImages.length === 0
                    })
                }
            } catch (uploadError) {
                console.error('Image upload error:', uploadError)
                return next(errorHandler(500, `Failed to upload image: ${uploadError.message}`))
            }
        }

        // Add new images to product
        product.images.push(...uploadedImages)
        await product.save()

        res.status(200).json({
            success: true,
            message: "Images uploaded successfully",
            data: {
                images: uploadedImages,
                totalImages: product.images.length
            }
        })

    } catch (error) {
        console.error("Upload product images error:", error)
        next(errorHandler(500, "Server error while uploading images"))
    }
}

// Delete product image
export const deleteProductImage = async (req, res, next) => {
    try {
        const { productId, imageId } = req.params

        const product = await Product.findById(productId)
        if (!product) {
            return next(errorHandler(404, "Product not found"))
        }

        const image = product.images.id(imageId)
        if (!image) {
            return next(errorHandler(404, "Image not found"))
        }

        // Delete from Cloudinary
        if (image.public_id) {
            try {
                await deleteFromCloudinary(image.public_id)
            } catch (deleteError) {
                console.error('Failed to delete image from Cloudinary:', deleteError)
            }
        }

        // Remove from product
        image.remove()
        await product.save()

        res.status(200).json({
            success: true,
            message: "Image deleted successfully"
        })

    } catch (error) {
        console.error("Delete product image error:", error)
        next(errorHandler(500, "Server error while deleting image"))
    }
}

// Set primary image
export const setPrimaryImage = async (req, res, next) => {
    try {
        const { productId, imageId } = req.params

        const product = await Product.findById(productId)
        if (!product) {
            return next(errorHandler(404, "Product not found"))
        }

        const image = product.images.id(imageId)
        if (!image) {
            return next(errorHandler(404, "Image not found"))
        }

        // Reset all images to not primary
        product.images.forEach(img => {
            img.isPrimary = false
        })

        // Set selected image as primary
        image.isPrimary = true
        await product.save()

        res.status(200).json({
            success: true,
            message: "Primary image updated successfully",
            data: {
                primaryImage: image
            }
        })

    } catch (error) {
        console.error("Set primary image error:", error)
        next(errorHandler(500, "Server error while setting primary image"))
    }
}

// Get optimized image URLs
export const getOptimizedImages = async (req, res, next) => {
    try {
        const { productId } = req.params
        const { width = 800, height = 800 } = req.query

        const product = await Product.findById(productId)
        if (!product) {
            return next(errorHandler(404, "Product not found"))
        }

        const optimizedImages = product.images.map(image => ({
            ...image.toObject(),
            optimized: getOptimizedImageUrl(image.public_id, { width: parseInt(width), height: parseInt(height) }),
            responsive: getResponsiveImageUrls(image.public_id)
        }))

        res.status(200).json({
            success: true,
            data: {
                images: optimizedImages
            }
        })

    } catch (error) {
        console.error("Get optimized images error:", error)
        next(errorHandler(500, "Server error while getting optimized images"))
    }
} 