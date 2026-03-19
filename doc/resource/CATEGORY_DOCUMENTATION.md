# 🗂️ TEO KICKS API - Category Management Documentation

## 📋 Table of Contents
- [Category Management Overview](#category-management-overview)
- [Category Model](#-category-model)
- [Category Controller](#-category-controller)
- [Category Routes](#-category-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Category Management Overview

Category Management allows for the organization of products into hierarchical or flat categories within the TEO KICKS API system. This includes functionalities for creating, updating, deleting categories, and retrieving category listings, including those with product counts or a "tree" structure (though currently flat).

---

## 👤 Category Model

### Schema Definition
```typescript
interface ICategory {
  _id: string;
  name: string;
  slug: string;
  status: "active" | "inactive";
  isActive: boolean;
  createdBy: string; // User ObjectId
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/categoryModel.js`**

```javascript
import mongoose from "mongoose"


const categorySchema = new mongoose.Schema({

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

    // Status string kept alongside isActive for clarity in API
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
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
categorySchema.index({ isActive: 1 })
categorySchema.index({ status: 1 })


// Instance method to get full path
// Note: hierarchy was removed; getFullPath now returns just the category name
categorySchema.methods.getFullPath = function() {
    return this.name
}


// Static method to get root categories
categorySchema.statics.getRootCategories = function() {
    return this.find({ isActive: true }).sort({ name: 1 })
}


// Static method to get category tree
categorySchema.statics.getCategoryTree = function() {
    return this.find({ isActive: true }).sort({ name: 1 })
}


// Static method to get category with products count
categorySchema.statics.getWithProductCount = function() {

    return this.aggregate([
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: 'categories',
                as: 'products'
            }
        },
        {
            $addFields: {
                productCount: { $size: '$products' }
            }
        },
        {
            $project: {
                products: 0
            }
        },
        { $sort: { name: 1 } }
    ])

}

// Sync status <-> isActive
categorySchema.pre('save', function(next) {
    if (this.isModified('status')) {
        this.isActive = this.status === 'active'
    } else if (this.isModified('isActive')) {
        this.status = this.isActive ? 'active' : 'inactive'
    } else {
        // Ensure consistency on first save
        this.isActive = this.status === 'active'
    }
    next()
})


const Category = mongoose.model('Category', categorySchema)


export default Category
```

### Validation Rules
```javascript
name:        { required: true, type: String, trim: true }
slug:        { required: true, type: String, unique: true, lowercase: true }
status:      { type: String, enum: ['active', 'inactive'], default: 'active' }
isActive:    { type: Boolean, default: true }
createdBy:   { required: true, type: ObjectId, ref: 'User' }
```

---

## 🎮 Category Controller

### Required Imports
```javascript
import Category from "../models/categoryModel.js"
import { errorHandler } from "../utils/error.js"
import { generateUniqueSlug } from "../utils/slugGenerator.js"
```

### Functions Overview

#### `createCategory()`
**Purpose:** Create a new category.  
**Access:** Private (Admin)  
**Validation:** `name` is required. Checks for existing category with the same name.  
**Process:** Generates a unique slug, creates a new `Category` document, and saves it.  
**Response:** The newly created category object.

**Controller Implementation:**
```javascript
export const createCategory = async (req, res, next) => {
    try {
        const { name, description, status } = req.body

        if (!name) {
            return next(errorHandler(400, "Category name is required"))
        }

        // Generate unique slug
        const slug = await generateUniqueSlug(name, async (slug) => {
            const existingCategory = await Category.findOne({ slug })
            return !!existingCategory
        })

        const category = new Category({
            name,
            slug,
            description,
            status: status === 'inactive' ? 'inactive' : 'active',
            createdBy: req.user._id
        })

        await category.save()

        res.status(201).json({
            success: true,
            message: "Category created successfully",
            data: {
                category: {
                    id: category._id,
                    name: category.name,
                    slug: category.slug,
                    description: category.description,
                    status: category.status,
                    isActive: category.isActive,
                    createdAt: category.createdAt
                }
            }
        })

    } catch (error) {
        console.error('Create category error:', error)
        next(errorHandler(500, "Server error while creating category"))
    }
}
```

#### `getAllCategories()`
**Purpose:** Get all categories with optional pagination, search, and active status filters.  
**Access:** Public  
**Validation:** Optional query parameters for `page`, `limit`, `search`, `isActive`, `status`.  
**Process:** Queries categories based on filters and returns paginated results.  
**Response:** Paginated list of category objects.

**Controller Implementation:**
```javascript
export const getAllCategories = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search, isActive, status } = req.query

        const query = {}

        // Search by name
        if (search) {
            query.name = { $regex: search, $options: 'i' }
        }

        // Filter by active status
        if (isActive !== undefined) {
            query.isActive = isActive === 'true'
        }

        // Filter by status string
        if (status) {
            query.status = status
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { name: 1 }
        }

        const categories = await Category.find(query)
            .sort(options.sort)
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit)

        const total = await Category.countDocuments(query)

        res.status(200).json({
            success: true,
            data: {
                categories,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalCategories: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        })

    } catch (error) {
        console.error('Get all categories error:', error)
        next(errorHandler(500, "Server error while fetching categories"))
    }
}
```

#### `getCategoryById()`
**Purpose:** Get a single category by its ID.  
**Access:** Public  
**Validation:** `categoryId` in params.  
**Process:** Finds the category by ID and populates `createdBy` user details.  
**Response:** A single category object.

**Controller Implementation:**
```javascript
export const getCategoryById = async (req, res, next) => {
    try {
        const { categoryId } = req.params

        const category = await Category.findById(categoryId)
            .populate('createdBy', 'name email')

        if (!category) {
            return next(errorHandler(404, "Category not found"))
        }

        res.status(200).json({
            success: true,
            data: {
                category: {
                    id: category._id,
                    name: category.name,
                    slug: category.slug,
                    description: category.description ?? '',
                    status: category.status,
                    isActive: category.isActive,
                    createdAt: category.createdAt,
                    updatedAt: category.updatedAt,
                }
            }
        })

    } catch (error) {
        console.error('Get category by ID error:', error)
        next(errorHandler(500, "Server error while fetching category"))
    }
}
```

#### `updateCategory()`
**Purpose:** Update an existing category.  
**Access:** Private (Admin)  
**Validation:** `categoryId` in params.  
**Process:** Finds and updates the category. If `name` is changed, a new unique `slug` is generated.  
**Response:** The updated category object.

**Controller Implementation:**
```javascript
export const updateCategory = async (req, res, next) => {
    try {
        const { categoryId } = req.params
        const { name, description, isActive, status } = req.body

        const category = await Category.findById(categoryId)

        if (!category) {
            return next(errorHandler(404, "Category not found"))
        }

        // Generate new slug if name changed
        if (name && name !== category.name) {
            const slug = await generateUniqueSlug(name, async (slug) => {
                const existingCategory = await Category.findOne({ 
                    slug, 
                    _id: { $ne: categoryId } 
                })
                return !!existingCategory
            })
            category.slug = slug
        }

        // Update fields
        if (name) category.name = name
        if (description !== undefined) category.description = description
        if (isActive !== undefined) category.isActive = isActive
        if (status !== undefined) category.status = status

        await category.save()

        res.status(200).json({
            success: true,
            message: "Category updated successfully",
            data: {
                category: {
                    id: category._id,
                    name: category.name,
                    slug: category.slug,
                    description: category.description,
                    status: category.status,
                    isActive: category.isActive,
                    updatedAt: category.updatedAt
                }
            }
        })

    } catch (error) {
        console.error('Update category error:', error)
        next(errorHandler(500, "Server error while updating category"))
    }
}
```

#### `deleteCategory()`
**Purpose:** Delete a category.  
**Access:** Private (Admin)  
**Validation:** `categoryId` in params.  
**Process:** Finds and deletes the category document.  
**Response:** Success message.

**Controller Implementation:**
```javascript
export const deleteCategory = async (req, res, next) => {
    try {
        const { categoryId } = req.params

        const category = await Category.findById(categoryId)

        if (!category) {
            return next(errorHandler(404, "Category not found"))
        }

        await Category.findByIdAndDelete(categoryId)

        res.status(200).json({
            success: true,
            message: "Category deleted successfully"
        })

    } catch (error) {
        console.error('Delete category error:', error)
        next(errorHandler(500, "Server error while deleting category"))
    }
}
```

#### `getCategoryTree()`
**Purpose:** Get all active categories in a "tree" structure (currently returns a flat list).  
**Access:** Public  
**Validation:** None.  
**Process:** Finds all active categories.  
**Response:** An array of active category objects.

**Controller Implementation:**
```javascript
export const getCategoryTree = async (req, res, next) => {
    try {
        const categories = await Category.getCategoryTree()

        res.status(200).json({
            success: true,
            data: {
                categories
            }
        })

    } catch (error) {
        console.error('Get category tree error:', error)
        next(errorHandler(500, "Server error while fetching category tree"))
    }
}
```

#### `getCategoriesWithProducts()`
**Purpose:** Get all categories along with the count of products associated with each category.  
**Access:** Public  
**Validation:** None.  
**Process:** Uses an aggregation pipeline to count products per category.  
**Response:** An array of category objects, each including a `productCount`.

**Controller Implementation:**
```javascript
export const getCategoriesWithProducts = async (req, res, next) => {
    try {
        const categories = await Category.getWithProductCount()

        res.status(200).json({
            success: true,
            data: {
                categories
            }
        })

    } catch (error) {
        console.error('Get categories with products error:', error)
        next(errorHandler(500, "Server error while fetching categories with products"))
    }
}
```

#### `getRootCategories()`
**Purpose:** Get all active categories (equivalent to `getCategoryTree` in a flat structure).  
**Access:** Public  
**Validation:** None.  
**Process:** Finds all active categories.  
**Response:** An array of active category objects.

**Controller Implementation:**
```javascript
export const getRootCategories = async (req, res, next) => {
    try {
        const categories = await Category.getRootCategories()

        res.status(200).json({
            success: true,
            data: {
                categories
            }
        })

    } catch (error) {
        console.error('Get root categories error:', error)
        next(errorHandler(500, "Server error while fetching root categories"))
    }
}
```

---

## 🗂️ Category Routes

### Base Path: `/api/categories`

### Router Implementation

**File: `../routes/categoryRoute.js`**

```javascript
import express from "express"
import { 
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
    getCategoryTree,
    getCategoriesWithProducts,
    getRootCategories
} from "../controllers/categoryController.js"
import { verifyBearerToken, requireAdmin } from "../utils/verify.js"

const router = express.Router()

// Public routes
router.get('/', getAllCategories)
router.get('/tree', getCategoryTree)
router.get('/with-products', getCategoriesWithProducts)
router.get('/root', getRootCategories)
router.get('/:categoryId', getCategoryById)

// Protected routes (require authentication)
router.use(verifyBearerToken)

// Admin-only routes
router.post('/', requireAdmin, createCategory)
router.put('/:categoryId', requireAdmin, updateCategory)
router.delete('/:categoryId', requireAdmin, deleteCategory)

export default router
```

### Route Details

#### `GET /api/categories`
**Purpose:** Retrieve a paginated list of all categories.  
**Access:** Public  
**Headers:** (Optional)  
**Query Parameters:** `page`, `limit`, `search`, `isActive`, `status`  
**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "_id": "65e26b1c09b068c201383810",
        "name": "Footwear",
        "slug": "footwear",
        "status": "active",
        "isActive": true,
        "createdBy": {
          "_id": "65e26b1c09b068c201383800",
          "name": "Admin User",
          "email": "admin@example.com"
        },
        "createdAt": "2026-02-17T10:00:00.000Z",
        "updatedAt": "2026-02-17T10:00:00.000Z"
      },
      {
        "_id": "65e26b1c09b068c201383811",
        "name": "Apparel",
        "slug": "apparel",
        "status": "active",
        "isActive": true,
        "createdBy": {
          "_id": "65e26b1c09b068c201383800",
          "name": "Admin User",
          "email": "admin@example.com"
        },
        "createdAt": "2026-02-17T10:05:00.000Z",
        "updatedAt": "2026-02-17T10:05:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCategories": 2,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/categories/tree`
**Purpose:** Retrieve a list of all active categories (currently a flat list).  
**Access:** Public  
**Headers:** (Optional)  
**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "_id": "65e26b1c09b068c201383810",
        "name": "Footwear",
        "slug": "footwear",
        "status": "active",
        "isActive": true,
        "createdBy": "65e26b1c09b068c201383800",
        "createdAt": "2026-02-17T10:00:00.000Z",
        "updatedAt": "2026-02-17T10:00:00.000Z"
      },
      {
        "_id": "65e26b1c09b068c201383811",
        "name": "Apparel",
        "slug": "apparel",
        "status": "active",
        "isActive": true,
        "createdBy": "65e26b1c09b068c201383800",
        "createdAt": "2026-02-17T10:05:00.000Z",
        "updatedAt": "2026-02-17T10:05:00.000Z"
      }
    ]
  }
}
```

#### `GET /api/categories/with-products`
**Purpose:** Retrieve a list of all categories, each with a count of their associated products.  
**Access:** Public  
**Headers:** (Optional)  
**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "_id": "65e26b1c09b068c201383810",
        "name": "Footwear",
        "slug": "footwear",
        "status": "active",
        "isActive": true,
        "createdBy": "65e26b1c09b068c201383800",
        "createdAt": "2026-02-17T10:00:00.000Z",
        "updatedAt": "2026-02-17T10:00:00.000Z",
        "productCount": 5
      },
      {
        "_id": "65e26b1c09b068c201383811",
        "name": "Apparel",
        "slug": "apparel",
        "status": "active",
        "isActive": true,
        "createdBy": "65e26b1c09b068c201383800",
        "createdAt": "2026-02-17T10:05:00.000Z",
        "updatedAt": "2026-02-17T10:05:00.000Z",
        "productCount": 12
      }
    ]
  }
}
```

#### `GET /api/categories/root`
**Purpose:** Retrieve a list of all active categories (equivalent to `/tree` in a flat structure).  
**Access:** Public  
**Headers:** (Optional)  
**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "_id": "65e26b1c09b068c201383810",
        "name": "Footwear",
        "slug": "footwear",
        "status": "active",
        "isActive": true,
        "createdBy": "65e26b1c09b068c201383800",
        "createdAt": "2026-02-17T10:00:00.000Z",
        "updatedAt": "2026-02-17T10:00:00.000Z"
      },
      {
        "_id": "65e26b1c09b068c201383811",
        "name": "Apparel",
        "slug": "apparel",
        "status": "active",
        "isActive": true,
        "createdBy": "65e26b1c09b068c201383800",
        "createdAt": "2026-02-17T10:05:00.000Z",
        "updatedAt": "2026-02-17T10:05:00.000Z"
      }
    ]
  }
}
```

#### `GET /api/categories/:categoryId`
**Purpose:** Retrieve a single category by its unique identifier.  
**Access:** Public  
**Parameters:** `categoryId` (path) - The ID of the category to retrieve.  
**Headers:** (Optional)  
**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "category": {
      "id": "65e26b1c09b068c201383810",
      "name": "Footwear",
      "slug": "footwear",
      "description": "All types of shoes and boots",
      "status": "active",
      "isActive": true,
      "createdBy": {
        "_id": "65e26b1c09b068c201383800",
        "name": "Admin User",
        "email": "admin@example.com"
      },
      "createdAt": "2026-02-17T10:00:00.000Z",
      "updatedAt": "2026-02-17T10:00:00.000Z"
    }
  }
}
```

#### `POST /api/categories`
**Purpose:** Create a new category in the system.  
**Access:** Private (Admin Only)  
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Body (JSON):**  
```json
{
  "name": "Electronics",
  "description": "Gadgets and electronic devices",
  "status": "active"
}
```
**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Category created successfully",
  "data": {
    "category": {
      "id": "65e26b1c09b068c201383812",
      "name": "Electronics",
      "slug": "electronics",
      "description": "Gadgets and electronic devices",
      "status": "active",
      "isActive": true,
      "createdBy": "65e26b1c09b068c201383800",
      "createdAt": "2026-02-17T10:10:00.000Z"
    }
  }
}
```

#### `PUT /api/categories/:categoryId`
**Purpose:** Update the details of an existing category.  
**Access:** Private (Admin Only)  
**Parameters:** `categoryId` (path) - The ID of the category to update.  
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Body (JSON):** (partial update allowed)  
```json
{
  "name": "Men's Footwear",
  "status": "active"
}
```
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Category updated successfully",
  "data": {
    "category": {
      "id": "65e26b1c09b068c201383810",
      "name": "Men's Footwear",
      "slug": "mens-footwear",
      "description": "All types of shoes and boots",
      "status": "active",
      "isActive": true,
      "updatedAt": "2026-02-17T10:15:00.000Z"
    }
  }
}
```

#### `DELETE /api/categories/:categoryId`
**Purpose:** Delete a category from the system.  
**Access:** Private (Admin Only)  
**Parameters:** `categoryId` (path) - The ID of the category to delete.  
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Category deleted successfully"
}
```

---

## 🔐 Middleware

- `verifyBearerToken`: Used on `router.use(verifyBearerToken)` to protect all modification routes.
- `requireAdmin`: Used on `router.post('/')`, `router.put('/:categoryId')`, and `router.delete('/:categoryId')` to restrict access to administrators only.

---

## 📝 API Examples

### Create a New Category
```bash
curl -X POST http://localhost:5000/api/categories 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <admin_access_token>" 
  -d '{
    "name": "Footwear",
    "description": "All types of shoes and boots",
    "status": "active"
  }'
```

### Get All Categories
```bash
curl -X GET "http://localhost:5000/api/categories?page=1&limit=5&search=men&status=active" 
  -H "Authorization: Bearer <access_token>"
```

### Update a Category
```bash
curl -X PUT http://localhost:5000/api/categories/<category_id> 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <admin_access_token>" 
  -d '{
    "name": "Men's Footwear",
    "status": "active"
  }'
```

---

## 🛡️ Security Features

-   **Authentication:** All modification endpoints (`POST`, `PUT`, `DELETE`) require a valid JWT.
-   **Authorization:** Category creation, update, and deletion are restricted to users with the 'admin' role.
-   **Slug Generation:** Ensures unique and clean URLs for categories, preventing conflicts.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

-   `400 Bad Request`: Invalid input (e.g., missing name, category name already exists).
-   `401 Unauthorized`: Missing or invalid authentication token.
-   `403 Forbidden`: Access denied (e.g., non-admin attempting an admin operation).
-   `404 Not Found`: The requested category was not found.
-   `500 Internal Server Error`: An unexpected server-side error occurred during processing.

---

## 📊 Database Indexes

-   `slug: 1` (unique): Ensures fast and unique lookup by the category's slug.
-   `isActive: 1`: Facilitates efficient filtering of categories by their active status.
-   `status: 1`: Allows efficient filtering by the category's status string.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
