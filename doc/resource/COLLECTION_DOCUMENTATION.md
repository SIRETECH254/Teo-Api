# 📦 TEO KICKS API - Collection Management Documentation

## 📋 Table of Contents
- [Collection Management Overview](#collection-management-overview)
- [Collection Model](#-collection-model)
- [Collection Controller](#-collection-controller)
- [Collection Routes](#-collection-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Collection Management Overview

Collection Management allows for the grouping of products into thematic collections within the TEO KICKS API system. This includes functionalities for creating, updating, and deleting collections, as well as retrieving collection listings, including those with product counts. Note that the `products` field was removed from the Collection model, so direct product management via collection endpoints is deprecated.

---

## 👤 Collection Model

### Schema Definition
```typescript
interface ICollection {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  createdBy: string; // User ObjectId
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/collectionModel.js`**

```javascript
import mongoose from "mongoose"


const collectionSchema = new mongoose.Schema({

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

    // Collection description
    description: { 
        type: String, 
        trim: true 
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
collectionSchema.index({ isActive: 1 })


// Static method to get active collections
collectionSchema.statics.getActive = function() {

    return this.find({ isActive: true }).sort({ name: 1 })

}


// Static method to get collections with product count
collectionSchema.statics.getWithProductCount = function() {

    return this.aggregate([
        {
            $addFields: {
                productCount: 0
            }
        },
        {
            $sort: { name: 1 }
        }
    ])

}


const Collection = mongoose.model('Collection', collectionSchema)


export default Collection
```

### Validation Rules
```javascript
name:        { required: true, type: String, trim: true }
slug:        { required: true, type: String, unique: true, lowercase: true }
description: { type: String, trim: true }
isActive:    { type: Boolean, default: true }
createdBy:   { required: true, type: ObjectId, ref: 'User' }
```

---

## 🎮 Collection Controller

### Required Imports
```javascript
import Collection from "../models/collectionModel.js"
import { errorHandler } from "../utils/error.js"
import { generateUniqueSlug } from "../utils/slugGenerator.js"
```

### Functions Overview

#### `createCollection()`
**Purpose:** Create a new collection.  
**Access:** Private (Admin)  
**Validation:** `name` is required. Checks for existing collection with the same name.  
**Process:** Generates a unique slug, creates a new `Collection` document, and saves it.  
**Response:** The newly created collection object.

**Controller Implementation:**
```javascript
export const createCollection = async (req, res, next) => {
    try {
        const { name, description, isActive } = req.body

        if (!name) {
            return next(errorHandler(400, "Collection name is required"))
        }

        // Generate unique slug
        const slug = await generateUniqueSlug(name, async (slug) => {
            const existingCollection = await Collection.findOne({ slug })
            return !!existingCollection
        })

        const collection = new Collection({
            name,
            slug,
            description,
            isActive: isActive !== undefined ? isActive : true,
            createdBy: req.user._id
        })

        await collection.save()

        res.status(201).json({
            success: true,
            message: "Collection created successfully",
            data: {
                collection: {
                    id: collection._id,
                    name: collection.name,
                    slug: collection.slug,
                    description: collection.description,
                    isActive: collection.isActive,
                    createdAt: collection.createdAt
                }
            }
        })

    } catch (error) {
        console.error('Create collection error:', error)
        next(errorHandler(500, "Server error while creating collection"))
    }
}
```

#### `getAllCollections()`
**Purpose:** Get all collections with optional pagination, search, and active status filters.  
**Access:** Public  
**Validation:** Optional query parameters for `page`, `limit`, `search`, `isActive`.  
**Process:** Queries collections based on filters and returns paginated results.  
**Response:** Paginated list of collection objects.

**Controller Implementation:**
```javascript
export const getAllCollections = async (req, res, next) => {
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
            sort: { name: 1 }
        }

        const collections = await Collection.find(query)
            .sort(options.sort)
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit)

        const total = await Collection.countDocuments(query)

        res.status(200).json({
            success: true,
            data: {
                collections,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalCollections: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        })

    } catch (error) {
        console.error('Get all collections error:', error)
        next(errorHandler(500, "Server error while fetching collections"))
    }
}
```

#### `getCollectionById()`
**Purpose:** Get a single collection by its ID.  
**Access:** Public  
**Validation:** `collectionId` in params.  
**Process:** Finds the collection by ID and populates `createdBy` user details.  
**Response:** A single collection object.

**Controller Implementation:**
```javascript
export const getCollectionById = async (req, res, next) => {
    try {
        const { collectionId } = req.params

        const collection = await Collection.findById(collectionId)
            .populate('products', 'title slug images price comparePrice status')
            .populate('createdBy', 'name email')

        if (!collection) {
            return next(errorHandler(404, "Collection not found"))
        }

        res.status(200).json({
            success: true,
            data: {
                collection
            }
        })

    } catch (error) {
        console.error('Get collection by ID error:', error)
        next(errorHandler(500, "Server error while fetching collection"))
    }
}
```

#### `updateCollection()`
**Purpose:** Update an existing collection.  
**Access:** Private (Admin)  
**Validation:** `collectionId` in params.  
**Process:** Finds and updates the collection. If `name` is changed, a new unique `slug` is generated.  
**Response:** The updated collection object.

**Controller Implementation:**
```javascript
export const updateCollection = async (req, res, next) => {
    try {
        const { collectionId } = req.params
        const { name, description, isActive } = req.body

        const collection = await Collection.findById(collectionId)

        if (!collection) {
            return next(errorHandler(404, "Collection not found"))
        }

        // Generate new slug if name changed
        if (name && name !== collection.name) {
            const slug = await generateUniqueSlug(name, async (slug) => {
                const existingCollection = await Collection.findOne({ 
                    slug, 
                    _id: { $ne: collectionId } 
                })
                return !!existingCollection
            })
            collection.slug = slug
        }

        // Update fields
        if (name) collection.name = name
        if (description !== undefined) collection.description = description
        if (isActive !== undefined) collection.isActive = isActive

        await collection.save()

        res.status(200).json({
            success: true,
            message: "Collection updated successfully",
            data: {
                collection: {
                    id: collection._id,
                    name: collection.name,
                    slug: collection.slug,
                    description: collection.description,
                    isActive: collection.isActive,
                    updatedAt: collection.updatedAt
                }
            }
        })

    } catch (error) {
        console.error('Update collection error:', error)
        next(errorHandler(500, "Server error while updating collection"))
    }
}
```

#### `deleteCollection()`
**Purpose:** Delete a collection.  
**Access:** Private (Admin)  
**Validation:** `collectionId` in params.  
**Process:** Finds and deletes the collection document.  
**Response:** Success message.

**Controller Implementation:**
```javascript
export const deleteCollection = async (req, res, next) => {
    try {
        const { collectionId } = req.params

        const collection = await Collection.findById(collectionId)

        if (!collection) {
            return next(errorHandler(404, "Collection not found"))
        }

        await Collection.findByIdAndDelete(collectionId)

        res.status(200).json({
            success: true,
            message: "Collection deleted successfully"
        })

    } catch (error) {
        console.error('Delete collection error:', error)
        next(errorHandler(500, "Server error while deleting collection"))
    }
}
```

#### `addProductToCollection()`
**Purpose:** DEPRECATED - This function is no longer supported as the `products` field was removed from the Collection model.  
**Access:** Private (Admin)  
**Validation:** None.  
**Process:** Returns an error indicating deprecation.  
**Response:** `400 Bad Request` error.

**Controller Implementation:**
```javascript
export const addProductToCollection = async (req, res, next) => {
    return next(errorHandler(400, "Adding products to collections is no longer supported - products field has been removed"))
}
```

#### `removeProductFromCollection()`
**Purpose:** DEPRECATED - This function is no longer supported as the `products` field was removed from the Collection model.  
**Access:** Private (Admin)  
**Validation:** None.  
**Process:** Returns an error indicating deprecation.  
**Response:** `400 Bad Request` error.

**Controller Implementation:**
```javascript
export const removeProductFromCollection = async (req, res, next) => {
    return next(errorHandler(400, "Removing products from collections is no longer supported - products field has been removed"))
}
```

#### `getCollectionsWithProducts()`
**Purpose:** Get all collections along with the count of products associated with each collection (will always be 0 as products are not directly linked).  
**Access:** Public  
**Validation:** None.  
**Process:** Uses an aggregation pipeline to add a `productCount` field.  
**Response:** An array of collection objects, each including a `productCount`.

**Controller Implementation:**
```javascript
export const getCollectionsWithProducts = async (req, res, next) => {
    try {
        const collections = await Collection.getWithProductCount()

        res.status(200).json({
            success: true,
            data: {
                collections
            }
        })

    } catch (error) {
        console.error('Get collections with products error:', error)
        next(errorHandler(500, "Server error while fetching collections with products"))
    }
}
```

#### `getActiveCollections()`
**Purpose:** Get a list of only active collections, sorted by `name`.  
**Access:** Public  
**Validation:** None.  
**Process:** Finds collections where `isActive` is true.  
**Response:** An array of active collection objects.

**Controller Implementation:**
```javascript
export const getActiveCollections = async (req, res, next) => {
    try {
        const collections = await Collection.getActive()

        res.status(200).json({
            success: true,
            data: {
                collections
            }
        })

    } catch (error) {
        console.error('Get active collections error:', error)
        next(errorHandler(500, "Server error while fetching active collections"))
    }
}
```

---

## 📦 Collection Routes

### Base Path: `/api/collections`

### Router Implementation

**File: `../routes/collectionRoute.js`**

```javascript
import express from "express"
import { 
    createCollection,
    getAllCollections,
    getCollectionById,
    updateCollection,
    deleteCollection,
    addProductToCollection,
    removeProductFromCollection,
    getCollectionsWithProducts,
    getActiveCollections
} from "../controllers/collectionController.js"
import { verifyBearerToken, requireAdmin } from "../utils/verify.js"

const router = express.Router()

// Public routes
router.get('/', getAllCollections)
router.get('/with-products', getCollectionsWithProducts)
router.get('/active', getActiveCollections)
router.get('/:collectionId', getCollectionById)

// Protected routes (require authentication)
router.use(verifyBearerToken)

// Admin-only routes
router.post('/', requireAdmin, createCollection)
router.put('/:collectionId', requireAdmin, updateCollection)
router.delete('/:collectionId', requireAdmin, deleteCollection)
router.post('/:collectionId/products', requireAdmin, addProductToCollection)
router.delete('/:collectionId/products/:productId', requireAdmin, removeProductFromCollection)

export default router
```

### Route Details

#### `GET /api/collections`
**Purpose:** Retrieve a paginated list of all collections.  
**Access:** Public  
**Headers:** (Optional)  
**Query Parameters:** `page`, `limit`, `search`, `isActive`  
**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "collections": [
      {
        "_id": "65e26b1c09b068c201383810",
        "name": "Summer Collection 2024",
        "slug": "summer-collection-2024",
        "description": "Exclusive items for Summer 2024.",
        "isActive": true,
        "createdBy": {
          "_id": "65e26b1c09b068c201383800",
          "name": "Admin User",
          "email": "admin@example.com"
        },
        "createdAt": "2026-02-17T10:00:00.000Z",
        "updatedAt": "2026-02-17T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCollections": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/collections/with-products`
**Purpose:** Retrieve a list of all collections, each with a count of their associated products (currently always 0).  
**Access:** Public  
**Headers:** (Optional)  
**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "collections": [
      {
        "_id": "65e26b1c09b068c201383810",
        "name": "Summer Collection 2024",
        "slug": "summer-collection-2024",
        "description": "Exclusive items for Summer 2024.",
        "isActive": true,
        "createdBy": "65e26b1c09b068c201383800",
        "createdAt": "2026-02-17T10:00:00.000Z",
        "updatedAt": "2026-02-17T10:00:00.000Z",
        "productCount": 0
      }
    ]
  }
}
```

#### `GET /api/collections/active`
**Purpose:** Retrieve a list of all active collections.  
**Access:** Public  
**Headers:** (Optional)  
**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "collections": [
      {
        "_id": "65e26b1c09b068c201383810",
        "name": "Summer Collection 2024",
        "slug": "summer-collection-2024",
        "description": "Exclusive items for Summer 2024.",
        "isActive": true,
        "createdBy": "65e26b1c09b068c201383800",
        "createdAt": "2026-02-17T10:00:00.000Z",
        "updatedAt": "2026-02-17T10:00:00.000Z"
      }
    ]
  }
}
```

#### `GET /api/collections/:collectionId`
**Purpose:** Retrieve a single collection by its unique identifier.  
**Access:** Public  
**Parameters:** `collectionId` (path) - The ID of the collection to retrieve.  
**Headers:** (Optional)  
**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "collection": {
      "_id": "65e26b1c09b068c201383810",
      "name": "Summer Collection 2024",
      "slug": "summer-collection-2024",
      "description": "Exclusive items for Summer 2024.",
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

#### `POST /api/collections`
**Purpose:** Create a new collection in the system.  
**Access:** Private (Admin Only)  
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Body (JSON):**  
```json
{
  "name": "Winter Collection",
  "description": "Cozy items for winter.",
  "isActive": true
}
```
**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Collection created successfully",
  "data": {
    "collection": {
      "id": "65e26b1c09b068c201383811",
      "name": "Winter Collection",
      "slug": "winter-collection",
      "description": "Cozy items for winter.",
      "isActive": true,
      "createdBy": "65e26b1c09b068c201383800",
      "createdAt": "2026-02-17T10:10:00.000Z"
    }
  }
}
```

#### `PUT /api/collections/:collectionId`
**Purpose:** Update the details of an existing collection.  
**Access:** Private (Admin Only)  
**Parameters:** `collectionId` (path) - The ID of the collection to update.  
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Body (JSON):** (partial update allowed)  
```json
{
  "name": "Updated Winter Collection",
  "isActive": false
}
```
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Collection updated successfully",
  "data": {
    "collection": {
      "id": "65e26b1c09b068c201383811",
      "name": "Updated Winter Collection",
      "slug": "updated-winter-collection",
      "description": "Cozy items for winter.",
      "isActive": false,
      "updatedAt": "2026-02-17T10:15:00.000Z"
    }
  }
}
```

#### `DELETE /api/collections/:collectionId`
**Purpose:** Delete a collection from the system.  
**Access:** Private (Admin Only)  
**Parameters:** `collectionId` (path) - The ID of the collection to delete.  
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Collection deleted successfully"
}
```

#### `POST /api/collections/:collectionId/products`
**Purpose:** DEPRECATED - This endpoint is no longer supported.  
**Access:** Private (Admin Only)  
**Parameters:** `collectionId` (path) - The ID of the collection.  
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Body (JSON):**  
```json
{
  "productId": "65e26b1c09b068c201383812"
}
```
**Response:** `400 Bad Request`
```json
{
  "success": false,
  "message": "Adding products to collections is no longer supported - products field has been removed",
  "error": "..."
}
```

#### `DELETE /api/collections/:collectionId/products/:productId`
**Purpose:** DEPRECATED - This endpoint is no longer supported.  
**Access:** Private (Admin Only)  
**Parameters:** `collectionId` (path), `productId` (path) - The IDs of the collection and product.  
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Response:** `400 Bad Request`
```json
{
  "success": false,
  "message": "Removing products from collections is no longer supported - products field has been removed",
  "error": "..."
}
```

---

## 🔐 Middleware

- `verifyBearerToken`: Used on `router.use(verifyBearerToken)` to protect all modification routes.
- `requireAdmin`: Used on `router.post('/')`, `router.put('/:collectionId')`, and `router.delete('/:collectionId')` to restrict access to administrators only. Also used on deprecated product management endpoints.

---

## 📝 API Examples

### Create a New Collection
```bash
curl -X POST http://localhost:5000/api/collections 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <admin_access_token>" 
  -d '{
    "name": "Summer Collection 2024",
    "description": "Exclusive items for Summer 2024.",
    "isActive": true
  }'
```

### Get All Collections with Product Count
```bash
curl -X GET http://localhost:5000/api/collections/with-products
```

### Update a Collection
```bash
curl -X PUT http://localhost:5000/api/collections/<collection_id> 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <admin_access_token>" 
  -d '{
    "name": "Updated Summer Collection",
    "description": "New description."
  }'
```

---

## 🛡️ Security Features

-   **Authentication:** All modification endpoints (`POST`, `PUT`, `DELETE`) require a valid JWT.
-   **Authorization:** Collection creation, update, and deletion are restricted to users with the 'admin' role.
-   **Slug Generation:** Ensures unique and clean URLs for collections, preventing conflicts.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

-   `400 Bad Request`: Invalid input (e.g., missing name, collection name already exists). Also returned for deprecated product management endpoints.
-   `401 Unauthorized`: Missing or invalid authentication token.
-   `403 Forbidden`: Access denied (e.g., non-admin attempting an admin operation).
-   `404 Not Found`: The requested collection was not found.
-   `500 Internal Server Error`: An unexpected server-side error occurred during processing.

---

## 📊 Database Indexes

-   `slug: 1` (unique): Ensures fast and unique lookup by the collection's slug.
-   `isActive: 1`: Facilitates efficient filtering of collections by their active status.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
