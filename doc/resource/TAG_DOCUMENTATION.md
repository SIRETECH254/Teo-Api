# 🏷️ TEO KICKS API - Tag Management Documentation

## 📋 Table of Contents
- [Tag Management Overview](#tag-management-overview)
- [Tag Model](#-tag-model)
- [Tag Controller](#-tag-controller)
- [Tag Routes](#-tag-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Tag Management Overview

Tag Management provides a flexible way to categorize and group products with keywords within the TEO KICKS API system. This includes functionalities for creating, updating, and deleting tags, as well as retrieving tag listings, including those with product counts. Tags help users discover products and improve searchability.

---

## 👤 Tag Model

### Schema Definition
```typescript
interface ITag {
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

**File: `../models/tagModel.js`**

```javascript
import mongoose from "mongoose"


const tagSchema = new mongoose.Schema({

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

    // Tag description
    description: { 
        type: String, 
        trim: true 
    },

    // Active status
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
tagSchema.index({ isActive: 1 })


// Instance method to get products by tag
tagSchema.methods.getProducts = function() {

    return mongoose.model('Product').find({
        tags: this._id,
        status: "active"
    }).sort({ createdAt: -1 })

}


// Static method to get active tags
tagSchema.statics.getActive = function() {

    return this.find({ isActive: true }).sort({ name: 1 })

}


// Static method to get tags with product count
tagSchema.statics.getWithProductCount = function() {

    return this.aggregate([
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: 'tags',
                as: 'tagProducts'
            }
        },
        {
            $addFields: {
                productCount: { $size: '$tagProducts' }
            }
        },
        {
            $project: {
                tagProducts: 0
            }
        },
        {
            $sort: { name: 1 }
        }
    ])

}


// Static method to get popular tags (by product count)
tagSchema.statics.getPopular = function(limit = 10) {

    return this.aggregate([
        {
            $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: 'tags',
                as: 'tagProducts'
            }
        },
        {
            $addFields: {
                productCount: { $size: '$tagProducts' }
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
                    tagProducts: 0
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


    // Static method to create or find tag by name
    tagSchema.statics.findOrCreate = async function(tagData) {

        const existingTag = await this.findOne({ 
            slug: tagData.slug || tagData.name.toLowerCase().replace(/\s+/g, '-')
        })

        if (existingTag) {
            return existingTag
        }

        return this.create(tagData)

    }


    const Tag = mongoose.model('Tag', tagSchema)


    export default Tag
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

## 🎮 Tag Controller

### Required Imports
```javascript
import Tag from "../models/tagModel.js"
import { errorHandler } from "../utils/error.js"
import { generateUniqueSlug } from "../utils/slugGenerator.js"
```

### Functions Overview

#### `createTag()`
**Purpose:** Create a new tag.  
**Access:** Private (Admin)  
**Validation:** `name` is required. Checks for existing tag with the same name.  
**Process:** Generates a unique slug, creates a new `Tag` document, and saves it.  
**Response:** The newly created tag object.

**Controller Implementation:**
```javascript
export const createTag = async (req, res, next) => {
    try {
        const { name, description, isActive = true } = req.body

        if (!name) {
            return next(errorHandler(400, 'Tag name is required'))
        }

        // Check if tag already exists
        const existingTag = await Tag.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
        if (existingTag) {
            return next(errorHandler(400, 'Tag with this name already exists'))
        }

        const slug = await generateUniqueSlug(name, (slug) => Tag.findOne({ slug }))

        const tag = new Tag({
            name,
            slug,
            description,
            isActive,
            createdBy: req.user._id
        })

        await tag.save()

        res.status(201).json({
            success: true,
            message: 'Tag created successfully',
            data: {
                id: tag._id,
                name: tag.name,
                slug: tag.slug,
                description: tag.description,
                isActive: tag.isActive,
                createdAt: tag.createdAt,
                updatedAt: tag.updatedAt
            }
        })
    } catch (error) {
        next(error)
    }
}
```

#### `getAllTags()`
**Purpose:** Get all tags with optional pagination, search, and active status filters.  
**Access:** Public  
**Validation:** Optional query parameters for `page`, `limit`, `search`, `isActive`.  
**Process:** Queries tags based on filters and returns paginated results.  
**Response:** Paginated list of tag objects.

**Controller Implementation:**
```javascript
export const getAllTags = async (req, res, next) => {
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

        const tags = await Tag.find(query)
            .sort(options.sort)
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit)

        const total = await Tag.countDocuments(query)

        res.status(200).json({
            success: true,
            data: {
                tags,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalTags: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        })

    } catch (error) {
        console.error('Get all tags error:', error)
        next(errorHandler(500, "Server error while fetching tags"))
    }
}
```

#### `getTagById()`
**Purpose:** Get a single tag by its ID.  
**Access:** Public  
**Validation:** `tagId` in params.  
**Process:** Finds the tag by ID and populates `createdBy` user details.  
**Response:** A single tag object.

**Controller Implementation:**
```javascript
export const getTagById = async (req, res, next) => {
    try {
        const { tagId } = req.params

        const tag = await Tag.findById(tagId)
            .populate('createdBy', 'name email')

        if (!tag) {
            return next(errorHandler(404, "Tag not found"))
        }

        res.status(200).json({
            success: true,
            data: {
                tag
            }
        })

    } catch (error) {
        console.error('Get tag by ID error:', error)
        next(errorHandler(500, "Server error while fetching tag"))
    }
}
```

#### `updateTag()`
**Purpose:** Update an existing tag.  
**Access:** Private (Admin)  
**Validation:** `tagId` in params.  
**Process:** Finds and updates the tag. If `name` is changed, a new unique `slug` is generated.  
**Response:** The updated tag object.

**Controller Implementation:**
```javascript
export const updateTag = async (req, res, next) => {
    try {
        const { tagId } = req.params
        const { name, description, isActive } = req.body

        const tag = await Tag.findById(tagId)

        if (!tag) {
            return next(errorHandler(404, "Tag not found"))
        }

        // Generate new slug if name changed
        if (name && name !== tag.name) {
            const slug = await generateUniqueSlug(name, async (slug) => {
                const existingTag = await Tag.findOne({ 
                    slug, 
                    _id: { $ne: tagId } 
                })
                return !!existingTag
            })
            tag.slug = slug
        }

        // Update fields
        if (name) tag.name = name
        if (description !== undefined) tag.description = description
        if (isActive !== undefined) tag.isActive = isActive

        await tag.save()

        res.status(200).json({
            success: true,
            message: "Tag updated successfully",
            data: {
                tag: {
                    id: tag._id,
                    name: tag.name,
                    slug: tag.slug,
                    description: tag.description,
                    isActive: tag.isActive,
                    updatedAt: tag.updatedAt
                }
            }
        })

    } catch (error) {
        console.error('Update tag error:', error)
        next(errorHandler(500, "Server error while updating tag"))
    }
}
```

#### `deleteTag()`
**Purpose:** Delete a tag.  
**Access:** Private (Admin)  
**Validation:** `tagId` in params.  
**Process:** Finds and deletes the tag document.  
**Response:** Success message.

**Controller Implementation:**
```javascript
export const deleteTag = async (req, res, next) => {
    try {
        const { tagId } = req.params

        const tag = await Tag.findById(tagId)

        if (!tag) {
            return next(errorHandler(404, "Tag not found"))
        }

        await Tag.findByIdAndDelete(tagId)

        res.status(200).json({
            success: true,
            message: "Tag deleted successfully"
        })

    } catch (error) {
        console.error('Delete tag error:', error)
        next(errorHandler(500, "Server error while deleting tag"))
    }
}
```

#### `getTagsByType()`
**Purpose:** DEPRECATED - This function is no longer supported as the `type` field was removed from the Tag model.  
**Access:** Public  
**Validation:** `type` in params.  
**Process:** Returns an error indicating deprecation.  
**Response:** `400 Bad Request` error.

**Controller Implementation:**
```javascript
export const getTagsByType = async (req, res, next) => {
    return next(errorHandler(400, "Tags by type is no longer supported - type field has been removed"))
}
```

#### `getPopularTags()`
**Purpose:** Get a list of popular tags, ordered by the count of associated products.  
**Access:** Public  
**Validation:** Optional `limit` query parameter.  
**Process:** Uses an aggregation pipeline to count products per tag and sort.  
**Response:** An array of popular tag objects.

**Controller Implementation:**
```javascript
export const getPopularTags = async (req, res, next) => {
    try {
        const { limit = 10 } = req.query

        const tags = await Tag.getPopular(parseInt(limit))

        res.status(200).json({
            success: true,
            data: {
                tags
            }
        })

    } catch (error) {
        console.error('Get popular tags error:', error)
        next(errorHandler(500, "Server error while fetching popular tags"))
    }
}
```

#### `getTagsWithProducts()`
**Purpose:** Get all tags along with the count of products associated with each tag.  
**Access:** Public  
**Validation:** None.  
**Process:** Uses an aggregation pipeline to count products per tag.  
**Response:** An array of tag objects, each including a `productCount`.

**Controller Implementation:**
```javascript
export const getTagsWithProducts = async (req, res, next) => {
    try {
        const tags = await Tag.getWithProductCount()

        res.status(200).json({
            success: true,
            data: {
                tags
            }
        })

    } catch (error) {
        console.error('Get tags with products error:', error)
        next(errorHandler(500, "Server error while fetching tags with products"))
    }
}
```

#### `findOrCreateTag()`
**Purpose:** Find an existing tag by its name/slug or create a new one if it doesn't exist.  
**Access:** Private (Admin)  
**Validation:** `name` is required in body.  
**Process:** Attempts to find a tag by name/slug; if not found, creates a new tag.  
**Response:** The found or created tag object.

**Controller Implementation:**
```javascript
export const findOrCreateTag = async (req, res, next) => {
    try {
        const { name, description } = req.body

        if (!name) {
            return next(errorHandler(400, "Tag name is required"))
        }

        const tagData = {
            name,
            description,
            createdBy: req.user._id
        }

        const tag = await Tag.findOrCreate(tagData)

        res.status(200).json({
            success: true,
            message: tag.isNew ? "Tag created successfully" : "Tag found",
            data: {
                tag: {
                    id: tag._id,
                    name: tag.name,
                    slug: tag.slug,
                    description: tag.description,
                    isActive: tag.isActive,
                    isNew: tag.isNew
                }
            }
        })

    } catch (error) {
        console.error('Find or create tag error:', error)
        next(errorHandler(500, "Server error while finding or creating tag"))
    }
}
```

---

## 🏷️ Tag Routes

### Base Path: `/api/tags`

### Router Implementation

**File: `../routes/tagRoute.js`**

```javascript
import express from "express"
import { 
    createTag,
    getAllTags,
    getTagById,
    updateTag,
    deleteTag,
    getTagsByType,
    getPopularTags,
    getTagsWithProducts,
    findOrCreateTag
} from "../controllers/tagController.js"
import { verifyBearerToken, requireAdmin } from "../utils/verify.js"

const router = express.Router()

// Public routes
router.get('/', getAllTags)
router.get('/type/:type', getTagsByType) // DEPRECATED
router.get('/popular', getPopularTags)
router.get('/with-products', getTagsWithProducts)
router.get('/:tagId', getTagById)

// Protected routes (require authentication)
router.use(verifyBearerToken)

// Admin-only routes
router.post('/', requireAdmin, createTag)
router.post('/find-or-create', requireAdmin, findOrCreateTag)
router.put('/:tagId', requireAdmin, updateTag)
router.delete('/:tagId', requireAdmin, deleteTag)

export default router
```

### Route Details

#### `GET /api/tags`
**Headers:** (Optional)  
**Query Parameters:** `page`, `limit`, `search`, `isActive`  
**Purpose:** Retrieve a paginated list of all tags.  
**Access:** Public  
**Response:** `200 OK` with paginated tag data.

#### `GET /api/tags/type/:type`
**Headers:** (Optional)  
**Parameters:** `type` (path) - DEPRECATED: The type of tag to filter by.  
**Purpose:** DEPRECATED - This endpoint is no longer supported.  
**Access:** Public  
**Response:** `400 Bad Request` with an error message indicating deprecation.

#### `GET /api/tags/popular`
**Headers:** (Optional)  
**Query Parameters:** `limit`  
**Purpose:** Retrieve a list of tags sorted by popularity (product count).  
**Access:** Public  
**Response:** `200 OK` with an array of popular tag objects.

#### `GET /api/tags/with-products`
**Headers:** (Optional)  
**Purpose:** Retrieve a list of all tags, each with a count of their associated products.  
**Access:** Public  
**Response:** `200 OK` with an array of tag objects including `productCount`.

#### `GET /api/tags/:tagId`
**Headers:** (Optional)  
**Parameters:** `tagId` (path) - The ID of the tag to retrieve.  
**Purpose:** Retrieve a single tag by its unique identifier.  
**Access:** Public  
**Response:** `200 OK` with the tag object, or `404 Not Found`.

#### `POST /api/tags`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Body (JSON):**  
```json
{
  "name": "New Arrivals",
  "description": "Products recently added to the store.",
  "isActive": true
}
```
**Purpose:** Create a new tag in the system.  
**Access:** Private (Admin Only)  
**Response:** `201 Created` with the details of the newly created tag.

#### `POST /api/tags/find-or-create`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Body (JSON):**  
```json
{
  "name": "Limited Edition",
  "description": "Products available for a short period."
}
```
**Purpose:** Find an existing tag by its name/slug or create a new one if it doesn't exist.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with the found or created tag object. `isNew` field indicates if it was created.

#### `PUT /api/tags/:tagId`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `tagId` (path) - The ID of the tag to update.  
**Body (JSON):** (partial update allowed)  
```json
{
  "name": "Updated Tag Name",
  "isActive": false
}
```
**Purpose:** Update the details of an existing tag.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with the updated tag object.

#### `DELETE /api/tags/:tagId`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `tagId` (path) - The ID of the tag to delete.  
**Purpose:** Delete a tag from the system.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with a success message.

---

## 🔐 Middleware

- `verifyBearerToken`: Used on protected routes (`POST`, `PUT`, `DELETE`, `find-or-create`) to ensure authentication.
- `requireAdmin`: Used on protected routes (`POST`, `PUT`, `DELETE`, `find-or-create`) to restrict access to administrators only.

---

## 📝 API Examples

### Create a New Tag
```bash
curl -X POST http://localhost:5000/api/tags 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <admin_access_token>" 
  -d '{
    "name": "Trending",
    "description": "Currently popular products.",
    "isActive": true
  }'
```

### Get Popular Tags
```bash
curl -X GET http://localhost:5000/api/tags/popular?limit=5
```

### Find or Create Tag
```bash
curl -X POST http://localhost:5000/api/tags/find-or-create 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <admin_access_token>" 
  -d '{
    "name": "Exclusive Offers",
    "description": "Special discounts for members."
  }'
```

---

## 🛡️ Security Features

-   **Authentication:** All modification endpoints (`POST`, `PUT`, `DELETE`) and `find-or-create` require a valid JWT. Public read access is available for tag listings and details.
-   **Authorization:** Tag creation, update, deletion, and `find-or-create` operations are restricted to users with the 'admin' role.
-   **Slug Generation:** Ensures unique and SEO-friendly identifiers for tags.
-   **Input Validation:** Robust server-side validation is applied to all incoming tag data.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

-   `400 Bad Request`: Invalid input (e.g., missing name, tag name already exists). Also returned for deprecated routes.
-   `401 Unauthorized`: Missing or invalid authentication token.
-   `403 Forbidden`: Access denied (e.g., non-admin attempting an admin operation).
-   `404 Not Found`: The requested tag was not found.
-   `500 Internal Server Error`: An unexpected server-side error occurred during processing.

---

## 📊 Database Indexes

-   `slug: 1` (unique): Ensures fast and unique lookup by the tag's slug, vital for consistency and search.
-   `isActive: 1`: Facilitates efficient filtering of tags by their active status for public display or internal management.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
