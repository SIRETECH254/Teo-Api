# 🏷️ TEO KICKS API - Brand Management Documentation

## 📋 Table of Contents
- [Brand Management Overview](#brand-management-overview)
- [Brand Model](#-brand-model)
- [Brand Controller](#-brand-controller)
- [Brand Routes](#-brand-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Brand Management Overview

Brand Management allows for the creation, organization, and retrieval of product brands within the TEO KICKS API system. This includes managing brand details, active status, and associating brands with products.

---

## 👤 Brand Model

### Schema Definition
```typescript
interface IBrand {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  features: string[];
  sortOrder: number;
  isActive: boolean;
  createdBy: string; // User ObjectId
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/brandModel.js`**

```javascript
import mongoose from "mongoose"


const brandSchema = new mongoose.Schema({

    name: { 
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

    // Brand description
    description: { 
        type: String, 
        trim: true 
    },

    // Brand logo URL
    logo: { 
        type: String 
    },

    // Brand website URL
    website: { 
        type: String 
    },

    // Brand features
    features: [{ 
        type: String,
        trim: true
    }],

    // Sort order for display
    sortOrder: { 
        type: Number, 
        default: 0 
    },

    // Display settings
    isActive: { 
        type: Boolean, 
        default: true 
    },

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
brandSchema.index({ isActive: 1 })
brandSchema.index({ sortOrder: 1 })


// Instance method to get products by brand
brandSchema.methods.getProducts = function() {

    return mongoose.model('Product').find({
        brand: this._id,
        status: "active"
    }).sort({ createdAt: -1 })

}


// Static method to get active brands
brandSchema.statics.getActive = function() {

    return this.find({ isActive: true }).sort({ sortOrder: 1, name: 1 })

}


// Static method to get brands with product count
brandSchema.statics.getWithProductCount = function() {

    return this.aggregate([
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: 'brand',
                as: 'brandProducts'
            }
        },
        {
            $addFields: {
                productCount: { $size: '$brandProducts' }
            }
        },
        {
            $project: {
                brandProducts: 0
            }
        },
        {
            $sort: { sortOrder: 1, name: 1 }
        }
    ])

}


// Static method to get popular brands (by product count)
brandSchema.statics.getPopular = function(limit = 10) {

    return this.aggregate([
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: 'brand',
                as: 'brandProducts'
            }
        },
        {
            $addFields: {
                productCount: { $size: '$brandProducts' }
            }
        },
        {
            $match: {
                isActive: true,
                productCount: { $gt: 0 }
            }
        },
        {
            $project: {
                brandProducts: 0
            }
        },
        {
            $sort: { productCount: -1, name: 1 }
        },
        {
            $limit: limit
        }
    ])

}


const Brand = mongoose.model('Brand', brandSchema)


export default Brand
```

### Validation Rules
```javascript
name:        { required: true, type: String, trim: true, unique: true (case-insensitive) }
slug:        { required: true, type: String, unique: true, lowercase: true }
description: { type: String, trim: true }
logo:        { type: String }
website:     { type: String }
features:    { type: Array of String, trim: true }
sortOrder:   { type: Number, default: 0 }
isActive:    { type: Boolean, default: true }
createdBy:   { required: true, type: ObjectId, ref: 'User' }
```

---

## 🎮 Brand Controller

### Required Imports
```javascript
import Brand from "../models/brandModel.js"
import { errorHandler } from "../utils/error.js"
import { generateUniqueSlug } from "../utils/slugGenerator.js"
```

### Functions Overview

#### `createBrand()`
**Purpose:** Create a new brand.  
**Access:** Private (Admin)  
**Validation:** `name` is required. Checks for existing brand with the same name.  
**Process:** Generates a unique slug, creates a new `Brand` document, and saves it.  
**Response:** The newly created brand object.

**Controller Implementation:**
```javascript
export const createBrand = async (req, res, next) => {
    try {
        const { name, description, isActive = true } = req.body

        if (!name) {
            return next(errorHandler(400, 'Brand name is required'))
        }

        // Check if brand already exists
        const existingBrand = await Brand.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
        if (existingBrand) {
            return next(errorHandler(400, 'Brand with this name already exists'))
        }

        const slug = await generateUniqueSlug(name, (slug) => Brand.findOne({ slug }))

        const brand = new Brand({
            name,
            slug,
            description,
            isActive,
            createdBy: req.user._id
        })

        await brand.save()

        res.status(201).json({
            success: true,
            message: 'Brand created successfully',
            data: {
                id: brand._id,
                name: brand.name,
                slug: brand.slug,
                description: brand.description,
                isActive: brand.isActive,
                createdAt: brand.createdAt,
                updatedAt: brand.updatedAt
            }
        })

    } catch (error) {
        console.error('Create brand error:', error)
        next(errorHandler(500, 'Server error while creating brand'))
    }
}
```

#### `getAllBrands()`
**Purpose:** Get all brands with optional pagination, search, and active status filters.  
**Access:** Public  
**Validation:** Optional query parameters for `page`, `limit`, `search`, `isActive`.  
**Process:** Queries brands based on filters and returns paginated results.  
**Response:** Paginated list of brand objects.

**Controller Implementation:**
```javascript
export const getAllBrands = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search, isActive } = req.query

        const query = {}

        // Search by name
        if (search) {
            query.name = { $regex: search, $options: 'i' }
        }

        // Filter by active status
        if (isActive !== undefined) {
            query.isActive = isActive === 'true'
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { sortOrder: 1, name: 1 }
        }

        const brands = await Brand.find(query)
            .sort(options.sort)
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit)

        const total = await Brand.countDocuments(query)

        res.status(200).json({
            success: true,
            data: {
                brands,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalBrands: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        })

    } catch (error) {
        console.error('Get all brands error:', error)
        next(errorHandler(500, "Server error while fetching brands"))
    }
}
```

#### `getBrandById()`
**Purpose:** Get a single brand by its ID.  
**Access:** Public  
**Validation:** `brandId` in params.  
**Process:** Finds the brand by ID and populates `createdBy` user details.  
**Response:** A single brand object.

**Controller Implementation:**
```javascript
export const getBrandById = async (req, res, next) => {
    try {
        const { brandId } = req.params

        const brand = await Brand.findById(brandId)
            .populate('createdBy', 'name email')

        if (!brand) {
            return next(errorHandler(404, "Brand not found"))
        }

        res.status(200).json({
            success: true,
            data: {
                brand
            }
        })

    } catch (error) {
        console.error('Get brand by ID error:', error)
        next(errorHandler(500, "Server error while fetching brand"))
    }
}
```

#### `updateBrand()`
**Purpose:** Update an existing brand.  
**Access:** Private (Admin)  
**Validation:** `brandId` in params.  
**Process:** Finds and updates the brand. If `name` is changed, a new unique `slug` is generated.  
**Response:** The updated brand object.

**Controller Implementation:**
```javascript
export const updateBrand = async (req, res, next) => {
    try {
        const { brandId } = req.params
        const { name, description, isActive } = req.body

        const brand = await Brand.findById(brandId)

        if (!brand) {
            return next(errorHandler(404, "Brand not found"))
        }

        // Generate new slug if name changed
        if (name && name !== brand.name) {
            const slug = await generateUniqueSlug(name, async (slug) => {
                const existingBrand = await Brand.findOne({ 
                    slug, 
                    _id: { $ne: brandId } 
                })
                return !!existingBrand
            })
            brand.slug = slug
        }

        // Update fields
        if (name) brand.name = name
        if (description !== undefined) brand.description = description
        if (logo !== undefined) brand.logo = logo
        if (website !== undefined) brand.website = website
        if (features !== undefined) brand.features = features
        if (sortOrder !== undefined) brand.sortOrder = sortOrder
        if (isActive !== undefined) brand.isActive = isActive

        await brand.save()

        res.status(200).json({
            success: true,
            message: "Brand updated successfully",
            data: {
                brand: {
                    id: brand._id,
                    name: brand.name,
                    slug: brand.slug,
                    description: brand.description,
                    logo: brand.logo,
                    website: brand.website,
                    features: brand.features,
                    sortOrder: brand.sortOrder,
                    isActive: brand.isActive,
                    updatedAt: brand.updatedAt
                }
            }
        })

    } catch (error) {
        console.error('Update brand error:', error)
        next(errorHandler(500, "Server error while updating brand"))
    }
}
```

#### `deleteBrand()`
**Purpose:** Delete a brand.  
**Access:** Private (Admin)  
**Validation:** `brandId` in params.  
**Process:** Finds and deletes the brand document.  
**Response:** Success message.

**Controller Implementation:**
```javascript
export const deleteBrand = async (req, res, next) => {
    try {
        const { brandId } = req.params

        const brand = await Brand.findById(brandId)

        if (!brand) {
            return next(errorHandler(404, "Brand not found"))
        }

        await Brand.findByIdAndDelete(brandId)

        res.status(200).json({
            success: true,
            message: "Brand deleted successfully"
        })

    } catch (error) {
        console.error('Delete brand error:', error)
        next(errorHandler(500, "Server error while deleting brand"))
    }
}
```

#### `getPopularBrands()`
**Purpose:** Get a list of popular brands, ordered by the count of associated products.  
**Access:** Public  
**Validation:** Optional `limit` query parameter.  
**Process:** Uses an aggregation pipeline to count products per brand and sort.  
**Response:** An array of popular brand objects.

**Controller Implementation:**
```javascript
export const getPopularBrands = async (req, res, next) => {
    try {
        const { limit = 10 } = req.query

        const brands = await Brand.getPopular(parseInt(limit))

        res.status(200).json({
            success: true,
            data: {
                brands
            }
        })

    } catch (error) {
        console.error('Get popular brands error:', error)
        next(errorHandler(500, "Server error while fetching popular brands"))
    }
}
```

#### `getBrandsWithProducts()`
**Purpose:** Get all brands along with the count of products associated with each brand.  
**Access:** Public  
**Validation:** None.  
**Process:** Uses an aggregation pipeline to count products per brand.  
**Response:** An array of brand objects, each including a `productCount`.

**Controller Implementation:**
```javascript
export const getBrandsWithProducts = async (req, res, next) => {
    try {
        const brands = await Brand.getWithProductCount()

        res.status(200).json({
            success: true,
            data: {
                brands
            }
        })

    } catch (error) {
        console.error('Get brands with products error:', error)
        next(errorHandler(500, "Server error while fetching brands with products"))
    }
}
```

#### `getActiveBrands()`
**Purpose:** Get a list of only active brands, sorted by `sortOrder` then `name`.  
**Access:** Public  
**Validation:** None.  
**Process:** Finds brands where `isActive` is true.  
**Response:** An array of active brand objects.

**Controller Implementation:**
```javascript
export const getActiveBrands = async (req, res, next) => {
    try {
        const brands = await Brand.getActive()

        res.status(200).json({
            success: true,
            data: {
                brands
            }
        })

    } catch (error) {
        console.error('Get active brands error:', error)
        next(errorHandler(500, "Server error while fetching active brands"))
    }
}
```

---

## 🏷️ Brand Routes

### Base Path: `/api/brands`

### Router Implementation

**File: `../routes/brandRoute.js`**

```javascript
import express from "express"
import { 
    createBrand,
    getAllBrands,
    getBrandById,
    updateBrand,
    deleteBrand,
    getPopularBrands,
    getBrandsWithProducts,
    getActiveBrands
} from "../controllers/brandController.js"
import { verifyBearerToken, requireAdmin } from "../utils/verify.js"

const router = express.Router()

// Public routes
router.get('/', getAllBrands)
router.get('/popular', getPopularBrands)
router.get('/with-products', getBrandsWithProducts)
router.get('/active', getActiveBrands)
router.get('/:brandId', getBrandById)

// Protected routes (require authentication)
router.use(verifyBearerToken)

// Admin-only routes
router.post('/', requireAdmin, createBrand)
router.put('/:brandId', requireAdmin, updateBrand)
router.delete('/:brandId', requireAdmin, deleteBrand)

export default router
```

### Route Details

#### `GET /api/brands`
**Headers:** (Optional)  
**Query Parameters:** `page`, `limit`, `search`, `isActive`  
**Purpose:** Retrieve a paginated list of all brands.  
**Access:** Public  
**Response:** `200 OK` with paginated brand data.

#### `GET /api/brands/popular`
**Headers:** (Optional)  
**Query Parameters:** `limit`  
**Purpose:** Retrieve a list of brands sorted by popularity (product count).  
**Access:** Public  
**Response:** `200 OK` with an array of popular brand objects.

#### `GET /api/brands/with-products`
**Headers:** (Optional)  
**Purpose:** Retrieve all brands, each with a count of their associated products.  
**Access:** Public  
**Response:** `200 OK` with an array of brand objects including `productCount`.

#### `GET /api/brands/active`
**Headers:** (Optional)  
**Purpose:** Retrieve a list of all active brands.  
**Access:** Public  
**Response:** `200 OK` with an array of active brand objects.

#### `GET /api/brands/:brandId`
**Headers:** (Optional)  
**Parameters:** `brandId` (path) - The ID of the brand to retrieve.  
**Purpose:** Retrieve a single brand by its unique identifier.  
**Access:** Public  
**Response:** `200 OK` with the brand object, or `404 Not Found`.

#### `POST /api/brands`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Body (JSON):**  
```json
{
  "name": "New Brand Name",
  "description": "Description for the new brand.",
  "logo": "http://example.com/logo.png",
  "website": "http://newbrand.com",
  "features": ["feature1", "feature2"],
  "sortOrder": 10,
  "isActive": true
}
```
**Purpose:** Create a new brand in the system.  
**Access:** Private (Admin Only)  
**Response:** `201 Created` with the details of the newly created brand.

#### `PUT /api/brands/:brandId`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `brandId` (path) - The ID of the brand to update.  
**Body (JSON):** (partial update allowed)  
```json
{
  "name": "Updated Brand Name",
  "isActive": false
}
```
**Purpose:** Update the details of an existing brand.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with the updated brand object.

#### `DELETE /api/brands/:brandId`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `brandId` (path) - The ID of the brand to delete.  
**Purpose:** Delete a brand from the system.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with a success message.

---

## 🔐 Middleware

- `verifyBearerToken`: Used on `router.use(verifyBearerToken)` to protect all modification routes and specific read routes.
- `requireAdmin`: Used on `router.post('/')`, `router.put('/:brandId')`, and `router.delete('/:brandId')` to restrict access to administrators only.

---

## 📝 API Examples

### Create a New Brand
```bash
curl -X POST http://localhost:5000/api/brands 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <admin_access_token>" 
  -d '{
    "name": "Vans",
    "description": "Classic skateboarding shoes and apparel.",
    "logo": "https://example.com/vans_logo.png",
    "website": "https://www.vans.com",
    "features": ["Skateboarding", "Casual", "Footwear"],
    "sortOrder": 5,
    "isActive": true
  }'
```

### Get All Active Brands
```bash
curl -X GET http://localhost:5000/api/brands/active
```

### Update a Brand
```bash
curl -X PUT http://localhost:5000/api/brands/<brand_id> 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <admin_access_token>" 
  -d '{
    "description": "Updated description for Vans.",
    "isActive": false
  }'
```

---

## 🛡️ Security Features

-   **Authentication:** All modification endpoints (`POST`, `PUT`, `DELETE`) and some admin-specific read endpoints require a valid JWT token.
-   **Authorization:** Brand creation, update, and deletion are restricted to users with the 'admin' role.
-   **Slug Generation:** Ensures unique and clean URLs for brands, preventing conflicts.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

-   `400 Bad Request`: Invalid input, missing required fields, or a brand with the same name already exists.
-   `401 Unauthorized`: Missing or invalid authentication token.
-   `403 Forbidden`: Access denied (e.g., non-admin attempting an admin operation).
-   `404 Not Found`: The requested brand was not found.
-   `500 Internal Server Error`: An unexpected server-side error occurred during processing.

---

## 📊 Database Indexes

-   `slug: 1` (unique): Ensures fast and unique lookup by the brand's slug.
-   `isActive: 1`: Facilitates efficient filtering of brands by their active status.
-   `sortOrder: 1`: Allows for custom sorting of brands for display purposes.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
