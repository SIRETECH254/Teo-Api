import Product from "../models/productModel.js"
import { validateProduct, validateSKU, validateVariantAttachment } from "../utils/validation.js"
import { errorHandler } from "../utils/error.js"
import { generateUniqueSlug } from "../utils/slugGenerator.js"
import { 
    uploadToCloudinary, 
    deleteFromCloudinary, 
    getResponsiveImageUrls,
    getOptimizedImageUrl 
} from "../utils/cloudinary.js"





// Create a new product
export const createProduct = async (req, res, next) => {
    try {
        const { title, description, shortDescription, brand, categories, collections, tags, basePrice, comparePrice, variants, features, trackInventory, weight } = req.body

        if (!title) {
            return next(errorHandler(400, "Product title is required"))
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
            brand,
            categories: categories ? JSON.parse(categories) : [],
            collections: collections ? JSON.parse(collections) : [],
            tags: tags ? JSON.parse(tags) : [],
            basePrice,
            comparePrice,
            variants: variants ? JSON.parse(variants) : [],
            images: processedImages,
            features: features ? JSON.parse(features) : [],
            trackInventory,
            weight,
            createdBy: req.user._id
        })

        await product.save()

        // Auto-generate SKUs if variants are attached
        if (product.variants && product.variants.length > 0) {
            await product.generateSKUs()
        }

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

        const { page = 1, limit = 10, search, category, collection, status } = req.query

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





        const options = {

            page: parseInt(page),

            limit: parseInt(limit),

            populate: ['categories', 'collections', 'createdBy'],

            sort: { createdAt: -1 }

        }





        const products = await Product.paginate(query, options)





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

            .populate({
                path: 'variants',
                populate: {
                    path: 'options'
                }
            })





        if (!product) {

            return res.status(404).json({

                success: false,

                message: "Product not found"

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
        const { title, description, shortDescription, brand, categories, collections, tags, basePrice, comparePrice, variants, features, metaTitle, metaDescription, trackInventory, weight, status } = req.body

        const product = await Product.findById(productId)

        if (!product) {
            return next(errorHandler(404, "Product not found"))
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
        const parseJsonArray = (raw) => {
            try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : [] } catch { return [] }
        }

        const keepPublicIds = new Set([
            ...parseJsonArray(req.body.keepImagePublicIds || '[]'),
            ...parseJsonArray(req.body.keepImages || '[]'), // backward compat
        ].filter(Boolean))

        const keepDocIds = new Set(parseJsonArray(req.body.keepImageDocIds || '[]').map(String))

        if (keepPublicIds.size > 0 || keepDocIds.size > 0) {
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
        if (brand !== undefined) product.brand = brand
        if (categories !== undefined) product.categories = JSON.parse(categories)
        if (collections !== undefined) product.collections = JSON.parse(collections)
        if (tags !== undefined) product.tags = JSON.parse(tags)
        if (basePrice !== undefined) product.basePrice = basePrice
        if (comparePrice !== undefined) product.comparePrice = comparePrice
        if (variants !== undefined) product.variants = JSON.parse(variants)
        if (features !== undefined) product.features = JSON.parse(features)
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

        // Check if variant already attached
        if (product.variants.includes(variantId)) {
            return next(errorHandler(400, "Variant already attached to product"))
        }

        // Add variant and regenerate SKUs
        product.variants.push(variantId)
        await product.generateSKUs()

        res.status(200).json({
            success: true,
            message: "Variant attached successfully",
            data: {
                product: {
                    id: product._id,
                    variants: product.variants,
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

        // Remove variant
        product.variants = product.variants.filter(id => id.toString() !== variantId)

        // Remove SKUs that contain this variant
        product.skus = product.skus.filter(sku =>
            !sku.attributes.some(attr => attr.variantId.toString() === variantId)
        )

        // If no variants left, create default SKU
        if (product.variants.length === 0) {
            product.skus = [{
                attributes: [],
                price: product.basePrice,
                stock: 0,
                skuCode: `${product.slug.toUpperCase()}-DEFAULT`
            }]
        }

        await product.save()

        res.status(200).json({
            success: true,
            message: "Variant detached successfully",
            data: {
                product: {
                    id: product._id,
                    variants: product.variants,
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