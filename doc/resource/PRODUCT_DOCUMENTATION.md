# 👕 TEO KICKS API - Product Management Documentation

## 📋 Table of Contents
- [Product Management Overview](#product-management-overview)
- [Product Model](#-product-model)
- [Product Controller](#-product-controller)
- [Product Routes](#-product-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Product Management Overview

Product Management is central to the TEO KICKS API system, covering the full scope of product definition, inventory, and presentation. This includes creating detailed product listings, managing SKUs (Stock Keeping Units) for product variants, handling image uploads, setting pricing, and organizing products by categories, collections, and tags. It also supports SEO fields and inventory tracking.

---

## 👤 Product Model

### Schema Definition
```typescript
interface IProduct {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  brand?: string; // Brand ObjectId
  images: Array<{
    url: string;
    alt?: string;
    isPrimary: boolean;
    public_id?: string; // Cloudinary public ID
  }>;
  categories: string[]; // Category ObjectIds
  collections: string[]; // Collection ObjectIds
  tags: string[]; // Tag ObjectIds
  basePrice: number;
  comparePrice?: number;
  variants: string[]; // Variant ObjectIds
  skus: Array<{
    attributes: Array<{
      variantId: string; // Variant ObjectId
      optionId: string; // Option ObjectId
    }>;
    price: number;
    comparePrice?: number;
    stock: number;
    skuCode: string;
    barcode?: string;
    weight?: number;
    dimensions?: {
      length?: number;
      width?: number;
      height?: number;
    };
    isActive: boolean;
    allowPreOrder: boolean;
    preOrderStock: number;
    lowStockThreshold: number;
  }>;
  status: "active" | "draft" | "archived";
  metaTitle?: string;
  metaDescription?: string;
  trackInventory: boolean;
  weight?: number;
  features: string[];
  createdBy: string; // User ObjectId
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/productModel.js`**

```javascript
import mongoose from "mongoose"
import mongoosePaginate from "mongoose-paginate-v2"


const skuSchema = new mongoose.Schema({

    attributes: [{
        variantId: { 
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Variant',
            required: true
        },
        optionId: { 
            type: mongoose.Schema.Types.ObjectId,
            required: true
        }
    }],

    price: { 
        type: Number, 
        required: true,
        min: 0
    },

    comparePrice: { 
        type: Number,
        min: 0
    },

    stock: { 
        type: Number, 
        default: 0,
        min: 0
    },

    skuCode: { 
        type: String,
        required: true,
        unique: true
    },

    barcode: { 
        type: String 
    },

    weight: { 
        type: Number,
        min: 0
    },

    dimensions: {
        length: { type: Number, min: 0 },
        width: { type: Number, min: 0 },
        height: { type: Number, min: 0 }
    },

    isActive: { 
        type: Boolean, 
        default: true 
    },

    // For pre-order functionality
    allowPreOrder: { 
        type: Boolean, 
        default: false 
    },

    preOrderStock: { 
        type: Number, 
        default: 0 
    },

    // For low stock alerts
    lowStockThreshold: { 
        type: Number, 
        default: 5 
    }

}, {
    timestamps: true
})


const productSchema = new mongoose.Schema({

    title: { 
        type: String, 
        required: true,
        trim: true
    },

    slug: { 
        type: String, 
        required: true,
        unique: true,
        lowercase: true
    },

    description: { 
        type: String,
        trim: true
    },

    shortDescription: { 
        type: String,
        trim: true,
        maxlength: 200
    },

    brand: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Brand'
    },

    images: [{
        url: { type: String, required: true },
        alt: { type: String },
        isPrimary: { type: Boolean, default: false }
    }],

    categories: [{ 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],

    collections: [{ 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Collection'
    }],

    tags: [{ 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag'
    }],

    // Base pricing
    basePrice: { 
        type: Number, 
        required: true,
        min: 0
    },

    comparePrice: { 
        type: Number,
        min: 0
    },

    // Variant references
    variants: [{ 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Variant'
    }],

    // SKUs for specific variant combinations
    skus: [skuSchema],

    // Product status
    status: { 
        type: String, 
        enum: ["active", "draft", "archived"],
        default: "draft"
    },

    // SEO fields
    metaTitle: { 
        type: String,
        trim: true
    },

    metaDescription: { 
        type: String,
        trim: true
    },

    // Inventory settings
    trackInventory: { 
        type: Boolean, 
        default: true 
    },



    // Shipping settings
    weight: { 
        type: Number,
        min: 0
    },

    
    // Product features
    features: [{ 
        type: String,
        trim: true
    }],


    // Created by
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }

}, {
    timestamps: true
})


// Indexes for better query performance
// Note: slug index is automatically created due to unique: true
productSchema.index({ status: 1 })
productSchema.index({ categories: 1 })
productSchema.index({ collections: 1 })
productSchema.index({ brand: 1 })
productSchema.index({ tags: 1 })
// Note: skuCode index is automatically created due to unique: true in skuSchema
productSchema.index({ createdAt: -1 })


// Instance method to generate SKUs based on variants
productSchema.methods.generateSKUs = async function() {

    if (!this.variants || this.variants.length === 0) {

        // Create a single default SKU
        this.skus = [{
            attributes: [],
            price: this.basePrice,
            stock: 0,
            skuCode: this.generateSKUCode([])
        }]

        return this.save()

    }

    // Get variant details with options
    const Variant = mongoose.model('Variant')
    const variants = await Variant.find({ _id: { $in: this.variants } })

    // Generate all possible combinations
    const combinations = this.generateCombinations(variants)

    // Helper to build a stable key from attributes for accurate matching
    const buildAttributesKey = (attributes) => {
        const normalized = (attributes || []).map(attr => ({
            variantId: attr.variantId.toString(),
            optionId: attr.optionId.toString(),
        })).sort((a, b) => {
            if (a.variantId !== b.variantId) return a.variantId.localeCompare(b.variantId)
            return a.optionId.localeCompare(b.optionId)
        })
        return normalized.map(n => `${n.variantId}:${n.optionId}`).join('|')
    }

    // Create a map of existing SKUs by their attribute combination for stock preservation
    const existingSkusMap = new Map()
    this.skus.forEach(sku => {
        const key = buildAttributesKey(Array.isArray(sku.attributes) ? sku.attributes.slice() : [])
        existingSkusMap.set(key, sku)
    })

    // Create SKUs for each combination, preserving existing stock levels
    this.skus = combinations.map(combination => {
        const key = buildAttributesKey(Array.isArray(combination) ? combination.slice() : [])

        const existingSku = existingSkusMap.get(key)

        return {
            attributes: combination,
            price: existingSku?.price ?? this.basePrice,
            stock: existingSku?.stock ?? 0,
            skuCode: existingSku?.skuCode ?? this.generateSKUCode(combination),
            barcode: existingSku?.barcode ?? null,
            lowStockThreshold: existingSku?.lowStockThreshold ?? 0,
            allowPreOrder: existingSku?.allowPreOrder ?? 0,
            preOrderStock: existingSku?.preOrderStock ?? 0,
        }
    })

    return this.save()

    }


    // Helper method to generate combinations
    productSchema.methods.generateCombinations = function(variants) {

        if (variants.length === 0) return [[]]

        const [firstVariant, ...restVariants] = variants
        const restCombinations = this.generateCombinations(restVariants)

        const combinations = []

        firstVariant.options.forEach(option => {

            const attribute = {
                variantId: firstVariant._id,
                optionId: option._id
            }

            restCombinations.forEach(restCombination => {

                combinations.push([attribute, ...restCombination])

            })

        })

        return combinations

    }


    // Helper method to generate SKU code
    productSchema.methods.generateSKUCode = function(attributes) {

        if (attributes.length === 0) {

            return `${this.slug.toUpperCase()}-DEFAULT`

        }

        const optionValues = attributes.map(attr => {

            // Find the option value (this would need to be enhanced with actual option lookup)
            return attr.optionId.toString().slice(-4).toUpperCase()

        }).join('-')

        return `${this.slug.toUpperCase()}-${optionValues}`

    }


    // Instance method to update SKU
    productSchema.methods.updateSKU = function(skuId, updateData) {

        const sku = this.skus.id(skuId)

        if (sku) {

            Object.assign(sku, updateData)

            return this.save()

        }

        throw new Error('SKU not found')

    }


    // Instance method to delete SKU
    productSchema.methods.deleteSKU = function(skuId) {

        this.skus = this.skus.filter(sku => sku._id.toString() !== skuId.toString())

        return this.save()

    }


    // Static method to get active products
    productSchema.statics.getActive = function() {

        return this.find({ status: "active" }).sort({ createdAt: -1 })

    }


    // Static method to get products with variants and SKUs
    productSchema.statics.getWithVariants = function() {

        return this.find()
            .populate('variants')
            .populate('categories')
            .populate('collections')
            .sort({ createdAt: -1 })

    }


    // Static method to search products
    productSchema.statics.search = function(query) {

        return this.find({
            $or: [
                { title: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } }
            ],
            status: "active"
        }).populate('brand', 'name')
          .populate('tags', 'name')
          .populate('categories', 'name')
          .populate('collections', 'name')
          .sort({ createdAt: -1 })

    }

    // Static method to search products by brand and tags
    productSchema.statics.searchByBrandAndTags = function(brandId, tagIds) {

        const query = { status: "active" }

        if (brandId) {
            query.brand = brandId
        }

        if (tagIds && tagIds.length > 0) {
            query.tags = { $in: tagIds }
        }

        return this.find(query)
            .populate('brand', 'name')
            .populate('tags', 'name')
            .populate('categories', 'name')
            .populate('collections', 'name')
            .sort({ createdAt: -1 })

    }


    // Add pagination plugin
    productSchema.plugin(mongoosePaginate)


    const Product = mongoose.model('Product', productSchema)


    export default Product
    ```

*   **Validation Rules:**
    *   `title`: Required, string, trimmed.
    *   `slug`: Required, unique, lowercase, trimmed.
    *   `description`: Optional, string, trimmed.
    *   `shortDescription`: Optional, string, trimmed, max 200 chars.
    *   `brand`: Optional, `ObjectId`, ref `Brand`.
    *   `images`: Array of objects (`url`, `alt`, `isPrimary`, `public_id`). `url` is required.
    *   `categories`: Array of `ObjectId`, ref `Category`.
    *   `collections`: Array of `ObjectId`, ref `Collection`.
    *   `tags`: Array of `ObjectId`, ref `Tag`.
    *   `basePrice`: Required, number, min 0.
    *   `comparePrice`: Optional, number, min 0.
    *   `variants`: Array of `ObjectId`, ref `Variant`.
    *   `skus`: Array of `skuSchema`.
        *   `attributes`: Array of objects (`variantId`, `optionId`).
        *   `price`: Required, number, min 0.
        *   `comparePrice`: Optional, number, min 0.
        *   `stock`: Number, default 0, min 0.
        *   `skuCode`: Required, unique, string.
        *   `barcode`: Optional, string.
        *   `weight`: Optional, number, min 0.
        *   `dimensions`: Optional object (`length`, `width`, `height`).
        *   `isActive`: Boolean, default `true`.
        *   `allowPreOrder`: Boolean, default `false`.
        *   `preOrderStock`: Number, default 0.
        *   `lowStockThreshold`: Number, default 5.
    *   `status`: Enum (`active`, `draft`, `archived`), default `draft`.
    *   `metaTitle`: Optional, string, trimmed.
    *   `metaDescription`: Optional, string, trimmed.
    *   `trackInventory`: Boolean, default `true`.
    *   `weight`: Optional, number, min 0.
    *   `features`: Array of strings, trimmed.
    *   `createdBy`: Required, `ObjectId`, ref `User`.

## 🎮 Product Controller

**File: `../controllers/productController.js`**

### Required Imports
```javascript
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
```


## Product Controller

### Functions Overview

#### `createProduct()`
**Purpose:** Create a new product, handling image uploads and initial SKU generation based on variants.  
**Access:** Private (Admin)  
**Validation:** `title` is required.  
**Process:** Generates unique slug, uploads images to Cloudinary, creates product, and auto-generates SKUs if variants are attached.  
**Response:** The newly created product object.

**Controller Implementation:**
```javascript
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
                    if (file.path) {
                        const uploadResult = await uploadToCloudinary(file.path, 'teo-kicks/products')
                        processedImages.push({
                            url: uploadResult.url,
                            public_id: uploadResult.public_id,
                            alt: file.originalname,
                            isPrimary: processedImages.length === 0
                        })
                    } else if (file.secure_url) {
                        processedImages.push({
                            url: file.secure_url,
                            public_id: file.public_id,
                            alt: file.originalname,
                            isPrimary: processedImages.length === 0
                        })
                    } else {
                        const uploadResult = await uploadToCloudinary(file.buffer, 'teo-kicks/products')
                        processedImages.push({
                            url: uploadResult.url,
                            public_id: uploadResult.public_id,
                            alt: file.originalname,
                            isPrimary: processedImages.length === 0
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
        next(errorHandler(500, "Server error while creating product"))
    }
}
```

#### `getAllProducts()`
**Purpose:** Retrieve all products with pagination, search, and filtering options by category, collection, status, etc.  
**Access:** Public  
**Validation:** Optional query parameters for `page`, `limit`, `search`, `category`, `collection`, `status`.  
**Process:** Queries products based on filters and returns paginated results.  
**Response:** Paginated list of product objects.

**Controller Implementation:**
```javascript
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
```

#### `getProductById()`
**Purpose:** Retrieve a single product by its ID, with populated details including categories, collections, and variants.  
**Access:** Public  
**Validation:** `id` in params.  
**Process:** Finds the product by ID and populates related documents.  
**Response:** A single product object with detailed information.

**Controller Implementation:**
```javascript
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
```

#### `updateProduct()`
**Purpose:** Update an existing product, including managing image deletions (via `keepImagePublicIds` or `keepImageDocIds`) and uploading new images.  
**Access:** Private (Admin)  
**Validation:** `productId` in params.  
**Process:** Updates product fields, handles image retention/deletion, uploads new images, and ensures one primary image.  
**Response:** The updated product object.

**Controller Implementation:**
```javascript
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
            ...parseJsonArray(req.body.keepImages || '[]'),
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

            product.images = currentImages.filter(img => keepPublicIds.has(img.public_id) || keepDocIds.has(String(img._id)))
        }

        // Handle new image uploads
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    if (file.path) {
                        const uploadResult = await uploadToCloudinary(file.path, 'teo-kicks/products')
                        processedImages.push({
                            url: uploadResult.url,
                            public_id: uploadResult.public_id,
                            alt: file.originalname,
                            isPrimary: product.images.length === 0
                        })
                    } else if (file.secure_url) {
                        processedImages.push({
                            url: file.secure_url,
                            public_id: file.public_id,
                            alt: file.originalname,
                            isPrimary: product.images.length === 0
                        })
                    } else {
                        const uploadResult = await uploadToCloudinary(file.buffer, 'teo-kicks/products')
                        processedImages.push({
                            url: uploadResult.url,
                            public_id: uploadResult.public_id,
                            alt: file.originalname,
                            isPrimary: product.images.length === 0
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
```

#### `deleteProduct()`
**Purpose:** Delete a product and all its associated images from Cloudinary.  
**Access:** Private (Admin)  
**Validation:** `productId` in params.  
**Process:** Deletes all product images from Cloudinary, then deletes the product document.  
**Response:** Success message.

**Controller Implementation:**
```javascript
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
```

#### `generateSKUs()`
**Purpose:** (Re)generate all possible SKUs for a product based on its currently attached variants. Preserves existing SKU data where attribute combinations match.  
**Access:** Private (Admin)  
**Validation:** `productId` in params.  
**Process:** Calls the product's `generateSKUs()` method to create SKUs for all variant combinations.  
**Response:** The product's regenerated SKUs.

**Controller Implementation:**
```javascript
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
```

#### `updateSKU()`
**Purpose:** Update specific details of a particular SKU within a product.  
**Access:** Private (Admin)  
**Validation:** `productId` and `skuId` in params.  
**Process:** Finds the SKU within the product and updates its properties.  
**Response:** The updated SKU.

**Controller Implementation:**
```javascript
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
```

#### `deleteSKU()`
**Purpose:** Delete a specific SKU from a product.  
**Access:** Private (Admin)  
**Validation:** `productId` and `skuId` in params.  
**Process:** Removes the SKU from the product's SKUs array.  
**Response:** Success message.

**Controller Implementation:**
```javascript
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
```

#### `attachVariant()`
**Purpose:** Attach an existing variant to a product, which triggers SKU regeneration.  
**Access:** Private (Admin)  
**Validation:** `productId` in params, `variantId` in body.  
**Process:** Adds variant to product and regenerates SKUs.  
**Response:** Updated product with new SKUs.

**Controller Implementation:**
```javascript
export const attachVariant = async (req, res, next) => {
    try {
        const { productId } = req.params
        const { variantId } = req.body

        const { error } = validateVariantAttachment(req.body)
        if (error) {
            return next(errorHandler(400, error.details[0].message))
        }

        const product = await Product.findById(productId)
        if (!product) {
            return next(errorHandler(404, "Product not found"))
        }

        if (product.variants.includes(variantId)) {
            return next(errorHandler(400, "Variant already attached to product"))
        }

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
```

#### `detachVariant()`
**Purpose:** Detach a variant from a product, removing all associated SKUs.  
**Access:** Private (Admin)  
**Validation:** `productId` in params, `variantId` in body.  
**Process:** Removes variant and associated SKUs, creates default SKU if no variants remain.  
**Response:** Updated product.

**Controller Implementation:**
```javascript
export const detachVariant = async (req, res, next) => {
    try {
        const { productId } = req.params
        const { variantId } = req.body

        const { error } = validateVariantAttachment(req.body)
        if (error) {
            return next(errorHandler(400, error.details[0].message))
        }

        const product = await Product.findById(productId)
        if (!product) {
            return next(errorHandler(404, "Product not found"))
        }

        product.variants = product.variants.filter(id => id.toString() !== variantId)

        product.skus = product.skus.filter(sku =>
            !sku.attributes.some(attr => attr.variantId.toString() === variantId)
        )

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
```

#### `uploadProductImages()`
**Purpose:** Upload additional images for an existing product.  
**Access:** Private (Admin)  
**Validation:** `productId` in params, images in files.  
**Process:** Uploads images to Cloudinary and adds them to the product.  
**Response:** Newly uploaded image details.

**Controller Implementation:**
```javascript
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
                if (file.path) {
                    const uploadResult = await uploadToCloudinary(file.path, 'teo-kicks/products')
                    uploadedImages.push({
                        url: uploadResult.url,
                        public_id: uploadResult.public_id,
                        alt: file.originalname,
                        isPrimary: product.images.length === 0 && uploadedImages.length === 0
                    })
                } else if (file.secure_url) {
                    uploadedImages.push({
                        url: file.secure_url,
                        public_id: file.public_id,
                        alt: file.originalname,
                        isPrimary: product.images.length === 0 && uploadedImages.length === 0
                    })
                } else {
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
```

#### `deleteProductImage()`
**Purpose:** Delete a specific image from a product and from Cloudinary.  
**Access:** Private (Admin)  
**Validation:** `productId` and `imageId` in params.  
**Process:** Deletes image from Cloudinary and removes it from the product.  
**Response:** Success message.

**Controller Implementation:**
```javascript
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

        if (image.public_id) {
            try {
                await deleteFromCloudinary(image.public_id)
            } catch (deleteError) {
                console.error('Failed to delete image from Cloudinary:', deleteError)
            }
        }

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
```

#### `setPrimaryImage()`
**Purpose:** Set one of the product's images as the primary image.  
**Access:** Private (Admin)  
**Validation:** `productId` and `imageId` in params.  
**Process:** Sets all images to non-primary, then sets the specified image as primary.  
**Response:** Updated primary image details.

**Controller Implementation:**
```javascript
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

        product.images.forEach(img => {
            img.isPrimary = false
        })

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
```

#### `getOptimizedImages()`
**Purpose:** Get URLs for optimized and responsive versions of a product's images (e.g., for different sizes or formats).  
**Access:** Public  
**Validation:** `productId` in params, optional `width` and `height` query parameters.  
**Process:** Generates optimized and responsive image URLs for all product images.  
**Response:** Array of image objects with optimized and responsive URLs.

**Controller Implementation:**
```javascript
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
```

---

## 📦 Product Routes

### Base Path: `/api/products`

### Router Implementation

**File: `../routes/productRoute.js`**
    ```javascript
    import express from "express"
    import { verifyBearerToken, requireAdmin } from "../utils/verify.js"
    import { uploadProductImage } from "../utils/cloudinary.js"
    import {
        createProduct,
        getAllProducts,
        getProductById,
        updateProduct,
        deleteProduct,
        generateSKUs,
        updateSKU,
        deleteSKU,
        uploadProductImages,
        deleteProductImage,
        setPrimaryImage,
        getOptimizedImages,
        attachVariant,
        detachVariant
    } from "../controllers/productController.js"


    const router = express.Router()

    // Public routes
    router.get("/", getAllProducts)
    router.get("/:id", getProductById)
    router.get("/:productId/optimized-images", getOptimizedImages)

    // Protected routes (require authentication)
    router.use(verifyBearerToken)

    // Admin-only routes
    router.post("/", requireAdmin, uploadProductImage.array('images', 10), createProduct)
    router.put("/:productId", requireAdmin, uploadProductImage.array('images', 10), updateProduct)
    router.delete("/:productId", requireAdmin, deleteProduct)

    // Image management routes
    router.post("/:productId/images", requireAdmin, uploadProductImage.array('images', 10), uploadProductImages)
    router.delete("/:productId/images/:imageId", requireAdmin, deleteProductImage)
    router.put("/:productId/images/:imageId/primary", requireAdmin, setPrimaryImage)

    // SKU management routes
    router.post("/:productId/generate-skus", requireAdmin, generateSKUs)
    router.patch("/:productId/skus/:skuId", requireAdmin, updateSKU)
    router.delete("/:productId/skus/:skuId", requireAdmin, deleteSKU)

    // Variant management routes
    router.post("/:productId/attach-variant", requireAdmin, attachVariant)
    router.post("/:productId/detach-variant", requireAdmin, detachVariant)

    export default router
    ```

### Route Details

#### `GET /api/products`
**Purpose:** Retrieve a paginated list of all products, with optional search and filtering.  
**Access:** Public  
**Headers:** (Optional)  
**Query Parameters:** `page`, `limit`, `search`, `category`, `collection`, `status`  
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": [
    {
      "_id": "65e26b1c09b068c201383816",
      "title": "Classic White Sneaker",
      "slug": "classic-white-sneaker",
      "description": "A comfortable and stylish sneaker",
      "shortDescription": "Comfortable and stylish",
      "brand": null,
      "images": [
        {
          "url": "https://res.cloudinary.com/example/image1.jpg",
          "alt": "Classic White Sneaker Front",
          "isPrimary": true,
          "_id": "65e26b1c09b068c201383817"
        }
      ],
      "categories": [],
      "collections": [],
      "tags": [],
      "basePrice": 1500,
      "comparePrice": 1800,
      "variants": [],
      "skus": [
        {
          "attributes": [],
          "price": 1500,
          "stock": 100,
          "skuCode": "CWS-DEFAULT",
          "isActive": true,
          "allowPreOrder": false,
          "preOrderStock": 0,
          "lowStockThreshold": 5,
          "_id": "65e26b1c09b068c201383818"
        }
      ],
      "status": "active",
      "metaTitle": "Classic White Sneaker for Sale",
      "metaDescription": "Buy the best classic white sneakers",
      "trackInventory": true,
      "weight": 500,
      "features": ["Comfortable", "Durable"],
      "createdBy": "65e26b1c09b068c201383800",
      "createdAt": "2026-02-15T10:00:00.000Z",
      "updatedAt": "2026-02-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalDocs": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

#### `GET /api/products/:id`
**Purpose:** Retrieve a single product by its ID, with populated details.  
**Access:** Public  
**Parameters:** `id` (path) - The ID of the product to retrieve.  
**Headers:** (Optional)  
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Product retrieved successfully",
  "data": {
    "_id": "65e26b1c09b068c201383816",
    "title": "Classic White Sneaker",
    "slug": "classic-white-sneaker",
    "description": "A comfortable and stylish sneaker",
    "shortDescription": "Comfortable and stylish",
    "brand": {
      "_id": "65e26b1c09b068c201383809",
      "name": "Nike"
    },
    "images": [
      {
        "url": "https://res.cloudinary.com/example/image1.jpg",
        "alt": "Classic White Sneaker Front",
        "isPrimary": true,
        "_id": "65e26b1c09b068c201383817",
        "public_id": "teo-kicks/products/image1"
      }
    ],
    "categories": [
      {
        "_id": "65e26b1c09b068c201383810",
        "name": "Footwear"
      }
    ],
    "collections": [],
    "tags": [],
    "basePrice": 1500,
    "comparePrice": 1800,
    "variants": [],
    "skus": [
      {
        "attributes": [],
        "price": 1500,
        "stock": 100,
        "skuCode": "CWS-DEFAULT",
        "isActive": true,
        "allowPreOrder": false,
        "preOrderStock": 0,
        "lowStockThreshold": 5,
        "_id": "65e26b1c09b068c201383818"
      }
    ],
    "status": "active",
    "metaTitle": "Classic White Sneaker for Sale",
    "metaDescription": "Buy the best classic white sneakers",
    "trackInventory": true,
    "weight": 500,
    "features": ["Comfortable", "Durable"],
    "createdBy": {
      "_id": "65e26b1c09b068c201383800",
      "name": "Admin User",
      "email": "admin@example.com"
    },
    "createdAt": "2026-02-15T10:00:00.000Z",
    "updatedAt": "2026-02-15T10:00:00.000Z"
  }
}
```

#### `GET /api/products/:productId/optimized-images`
**Purpose:** Get URLs for optimized and responsive versions of a product's images.  
**Access:** Public  
**Parameters:** `productId` (path) - The ID of the product.  
**Headers:** (Optional)  
**Query Parameters:** `width` (optional, default: 800), `height` (optional, default: 800)  
**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "images": [
      {
        "url": "https://res.cloudinary.com/example/image1.jpg",
        "alt": "Classic White Sneaker Front",
        "isPrimary": true,
        "public_id": "teo-kicks/products/image1",
        "_id": "65e26b1c09b068c201383817",
        "optimized": "https://res.cloudinary.com/example/image/upload/c_fill,h_800,w_800/teo-kicks/products/image1.jpg",
        "responsive": {
          "small": "https://res.cloudinary.com/example/image/upload/c_fill,w_400/teo-kicks/products/image1.jpg",
          "medium": "https://res.cloudinary.com/example/image/upload/c_fill,w_800/teo-kicks/products/image1.jpg",
          "large": "https://res.cloudinary.com/example/image/upload/c_fill,w_1200/teo-kicks/products/image1.jpg"
        }
      }
    ]
  }
}
```

#### `POST /api/products`
**Purpose:** Create a new product with images.  
**Access:** Private (Admin Only)  
**Headers:** `Authorization: Bearer <admin_token>`  
**Body:** `multipart/form-data` with product fields and `images` files.  
**Fields:**
- `title` (required): Product title (`string`)
- `description`: Product description (`string`)
- `shortDescription`: Short description (`string`)
- `brand`: Brand ObjectId (`string`)
- `categories`: JSON array of Category ObjectIds (`string[]`)
- `collections`: JSON array of Collection ObjectIds (`string[]`)
- `tags`: JSON array of Tag ObjectIds (`string[]`)
- `basePrice` (required): Base price (`number`)
- `comparePrice`: Compare price (`number`)
- `variants`: JSON array of Variant Objectids (`string[]`)
- `features`: JSON array of feature strings (`string[]`)
- `trackInventory`: Boolean (`boolean`)
- `weight`: Weight in grams (`number`)
- `images`: Image files (up to 10) (`file[]`)
**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "product": {
      "id": "65e26b1c09b068c201383816",
      "title": "Classic White Sneaker",
      "slug": "classic-white-sneaker",
      "description": "A comfortable and stylish sneaker",
      "shortDescription": "Comfortable and stylish",
      "brand": null,
      "images": [
        {
          "url": "https://res.cloudinary.com/example/image1.jpg",
          "alt": "image1.jpg",
          "isPrimary": true,
          "public_id": "teo-kicks/products/image1",
          "_id": "65e26b1c09b068c201383817"
        }
      ],
      "categories": [],
      "collections": [],
      "tags": [],
      "basePrice": 1500,
      "comparePrice": 1800,
      "variants": [],
      "skus": [
        {
          "attributes": [],
          "price": 1500,
          "stock": 0,
          "skuCode": "CLASSIC-WHITE-SNEAKER-DEFAULT",
          "isActive": true,
          "allowPreOrder": false,
          "preOrderStock": 0,
          "lowStockThreshold": 5,
          "_id": "65e26b1c09b068c201383818"
        }
      ],
      "status": "draft",
      "metaTitle": null,
      "metaDescription": null,
      "trackInventory": true,
      "weight": null,
      "features": [],
      "createdBy": "65e26b1c09b068c201383800",
      "createdAt": "2026-02-15T10:00:00.000Z",
      "updatedAt": "2026-02-15T10:00:00.000Z"
    }
  }
}
```

#### `PUT /api/products/:productId`
**Purpose:** Update an existing product, including updating images.  
**Access:** Private (Admin Only)  
**Parameters:** `productId` (path) - The ID of the product to update.  
**Headers:** `Authorization: Bearer <admin_token>`  
**Body:** `multipart/form-data` with product fields, `images` files (new), and `keepImagePublicIds` (JSON array of image public IDs to retain).  
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "product": {
      "id": "65e26b1c09b068c201383816",
      "title": "Updated Classic White Sneaker",
      "slug": "updated-classic-white-sneaker",
      "description": "A comfortable and stylish updated sneaker",
      "shortDescription": "Comfortable and stylish updated",
      "brand": "65e26b1c09b068c201383809",
      "images": [
        {
          "url": "https://res.cloudinary.com/example/image1.jpg",
          "alt": "image1.jpg",
          "isPrimary": true,
          "public_id": "teo-kicks/products/image1",
          "_id": "65e26b1c09b068c201383817"
        },
        {
          "url": "https://res.cloudinary.com/example/new_image.webp",
          "alt": "new_image.webp",
          "isPrimary": false,
          "public_id": "teo-kicks/products/new_image",
          "_id": "65e26b1c09b068c201383819"
        }
      ],
      "categories": [],
      "collections": [],
      "tags": [],
      "basePrice": 1600,
      "comparePrice": 1900,
      "variants": [],
      "skus": [
        {
          "attributes": [],
          "price": 1500,
          "stock": 100,
          "skuCode": "CLASSIC-WHITE-SNEAKER-DEFAULT",
          "isActive": true,
          "allowPreOrder": false,
          "preOrderStock": 0,
          "lowStockThreshold": 5,
          "_id": "65e26b1c09b068c201383818"
        }
      ],
      "status": "active",
      "metaTitle": "Updated Classic White Sneaker for Sale",
      "metaDescription": "Buy the best updated classic white sneakers",
      "trackInventory": true,
      "weight": 550,
      "features": ["Comfortable", "Durable", "Lightweight"],
      "createdBy": "65e26b1c09b068c201383800",
      "createdAt": "2026-02-15T10:00:00.000Z",
      "updatedAt": "2026-02-15T11:00:00.000Z"
    }
  }
}
```

#### `DELETE /api/products/:productId`
**Purpose:** Delete a product and its images.  
**Access:** Private (Admin Only)  
**Parameters:** `productId` (path) - The ID of the product to delete.  
**Headers:** `Authorization: Bearer <admin_token>`  
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

#### `POST /api/products/:productId/images`
**Purpose:** Upload additional images for an existing product.  
**Access:** Private (Admin Only)  
**Parameters:** `productId` (path) - The ID of the product.  
**Headers:** `Authorization: Bearer <admin_token>`  
**Body:** `multipart/form-data` with `images` files.  
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Images uploaded successfully",
  "data": {
    "images": [
      {
        "url": "https://res.cloudinary.com/example/new_image_1.jpg",
        "public_id": "teo-kicks/products/new_image_1",
        "alt": "new_image_1.jpg",
        "isPrimary": false,
        "_id": "65e26b1c09b068c201383820"
      }
    ],
    "totalImages": 3
  }
}
```

#### `DELETE /api/products/:productId/images/:imageId`
**Purpose:** Delete a specific product image.  
**Access:** Private (Admin Only)  
**Parameters:** `productId` (path), `imageId` (path) - The IDs of the product and image.  
**Headers:** `Authorization: Bearer <admin_token>`  
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

#### `PUT /api/products/:productId/images/:imageId/primary`
**Purpose:** Set a specific image as the primary image for a product.  
**Access:** Private (Admin Only)  
**Parameters:** `productId` (path), `imageId` (path) - The IDs of the product and image.  
**Headers:** `Authorization: Bearer <admin_token>`  
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Primary image updated successfully",
  "data": {
    "primaryImage": {
      "_id": "65e26b1c09b068c201383817",
      "url": "https://res.cloudinary.com/example/image1.jpg",
      "alt": "Classic White Sneaker Front",
      "isPrimary": true,
      "public_id": "teo-kicks/products/image1"
    }
  }
}
```

#### `POST /api/products/:productId/generate-skus`
**Purpose:** Regenerate SKUs for a product based on its variants.  
**Access:** Private (Admin Only)  
**Parameters:** `productId` (path) - The ID of the product.  
**Headers:** `Authorization: Bearer <admin_token>`  
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "SKUs generated successfully",
  "data": [
    {
      "_id": "65e26b1c09b068c201383818",
      "attributes": [],
      "price": 1500,
      "stock": 100,
      "skuCode": "CLASSIC-WHITE-SNEAKER-DEFAULT",
      "isActive": true,
      "allowPreOrder": false,
      "preOrderStock": 0,
      "lowStockThreshold": 5
    }
  ]
}
```

#### `PATCH /api/products/:productId/skus/:skuId`
**Purpose:** Update details of a specific SKU.  
**Access:** Private (Admin Only)  
**Parameters:** `productId` (path), `skuId` (path) - The IDs of the product and SKU.  
**Headers:** `Authorization: Bearer <admin_token>`  
**Body (JSON):**
```json
{
  "price": 1600,
  "stock": 50,
  "lowStockThreshold": 10
}
```
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "SKU updated successfully",
  "data": {
    "_id": "65e26b1c09b068c201383818",
    "attributes": [],
    "price": 1600,
    "stock": 50,
    "lowStockThreshold": 10,
    "skuCode": "CLASSIC-WHITE-SNEAKER-DEFAULT",
    "isActive": true,
    "allowPreOrder": false,
    "preOrderStock": 0
  }
}
```

#### `DELETE /api/products/:productId/skus/:skuId`
**Purpose:** Delete a specific SKU from a product.  
**Access:** Private (Admin Only)  
**Parameters:** `productId` (path), `skuId` (path) - The IDs of the product and SKU.  
**Headers:** `Authorization: Bearer <admin_token>`  
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "SKU deleted successfully"
}
```

#### `POST /api/products/:productId/attach-variant`
**Purpose:** Attach a variant to a product and regenerate SKUs.  
**Access:** Private (Admin Only)  
**Parameters:** `productId` (path) - The ID of the product.  
**Headers:** `Authorization: Bearer <admin_token>`  
**Body (JSON):**
```json
{
  "variantId": "65e26b1c09b068c201383811"
}
```
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Variant attached successfully",
  "data": {
    "product": {
      "id": "65e26b1c09b068c201383816",
      "variants": ["65e26b1c09b068c201383811"],
      "skus": [
        {
          "_id": "...",
          "attributes": [
            { "variantId": "65e26b1c09b068c201383811", "optionId": "65e26b1c09b068c201383812" }
          ],
          "price": 1500,
          "stock": 0,
          "skuCode": "SNEAKER-COLOR-RED"
        }
      ]
    }
  }
}
```

#### `POST /api/products/:productId/detach-variant`
**Purpose:** Detach a variant from a product, removing associated SKUs.  
**Access:** Private (Admin Only)  
**Parameters:** `productId` (path) - The ID of the product.  
**Headers:** `Authorization: Bearer <admin_token>`  
**Body (JSON):**
```json
{
  "variantId": "65e26b1c09b068c201383811"
}
```
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Variant detached successfully",
  "data": {
    "product": {
      "id": "65e26b1c09b068c201383816",
      "variants": [],
      "skus": [
        {
          "_id": "...",
          "attributes": [],
          "price": 1500,
          "stock": 100,
          "skuCode": "CLASSIC-WHITE-SNEAKER-DEFAULT"
        }
      ]
    }
  }
}
```

---

## 🔐 Middleware

- `verifyBearerToken`: Ensures the request has a valid JWT token for protected routes.
- `requireAdmin`: Ensures the authenticated user has an 'admin' role for all product modification and management routes.
- `uploadProductImage.array('images', 10)`: Middleware used with `createProduct`, `updateProduct`, and `uploadProductImages` to handle multi-part form data for image uploads (up to 10 images).

---

## 📝 API Examples

### Create Product with Images
    ```bash
curl -X POST http://localhost:5000/api/products \
  -H "Authorization: Bearer <admin_access_token>" \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.png" \
  -F "title=Classic White Sneaker" \
  -F "description=A comfortable and stylish sneaker for everyday wear." \
  -F "basePrice=79.99" \
  -F "categories=[\"65e26b1c09b068c201383810\"]" \
      -F "brand=65e26b1c09b068c201383809"
    ```

### Get All Products (Public, filtered)
    ```bash
    curl -X GET "http://localhost:5000/api/products?page=1&limit=5&search=sneaker&category=65e26b1c09b068c201383810&status=active"
    ```

### Update Product (changing price and adding new images)
    ```bash
curl -X PUT http://localhost:5000/api/products/<product_id> \
  -H "Authorization: Bearer <admin_access_token>" \
  -F "images=@/path/to/new_image.webp" \
  -F "keepImagePublicIds=[\"cloudinary_public_id_of_old_image_1\", \"cloudinary_public_id_of_old_image_2\"]" \
  -F "title=Updated Classic White Sneaker Pro" \
      -F "basePrice=85.00"
    ```

### Update SKU Stock
    ```bash
curl -X PATCH http://localhost:5000/api/products/<product_id>/skus/<sku_id> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_access_token>" \
      -d '{
        "stock": 50,
        "lowStockThreshold": 10
      }'
    ```

### Attach Variant to Product
    ```bash
curl -X POST http://localhost:5000/api/products/<product_id>/attach-variant \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_access_token>" \
      -d '{
        "variantId": "65e26b1c09b068c201383811"
      }'
    ```

---

## 🛡️ Security Features

- **Authentication:** All administrative operations and sensitive modifications to product data require a valid JWT token. Public read access is available for product listings and details.
- **Authorization:** All product creation, update, deletion, image management, SKU management, and variant attachment/detachment operations are restricted to users with the 'admin' role.
- **Slug Generation:** Ensures unique and SEO-friendly URLs for products, preventing conflicts.
- **Image Management:** Integration with Cloudinary provides secure cloud storage for product images. Image deletion includes removal from Cloudinary.
- **Input Validation:** Robust server-side validation is applied to all incoming product and SKU data to ensure data integrity and prevent malformed entries.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

- `400 Bad Request`: Invalid input (e.g., missing required fields, invalid pricing, product title/slug already exists, invalid image data, invalid variant attachment).
- `401 Unauthorized`: Missing or invalid authentication token.
- `403 Forbidden`: Access denied (e.g., non-admin attempting an admin operation).
- `404 Not Found`: Product, SKU, Image, or Variant not found.
- `500 Internal Server Error`: Server-side issues during processing (e.g., Cloudinary upload/delete errors, database errors).

---

## 📊 Database Indexes

- `slug: 1` (unique): Ensures fast and unique lookup by product slug, vital for SEO and direct access.
- `status: 1`: Efficiently filters products by their status (`active`, `draft`, `archived`) for various display and management purposes.
- `categories: 1`, `collections: 1`, `brand: 1`, `tags: 1`: Facilitates efficient filtering of products by their categorical, collection, brand, and tag associations.
- `skus.skuCode: 1` (unique): Ensures unique SKU codes within a product, essential for inventory management.
- `createdAt: -1`: Provides a default sort order for product listings, showing the most recently created products first.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
