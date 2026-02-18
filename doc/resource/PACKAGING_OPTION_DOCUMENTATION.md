# 🎁 TEO KICKS API - Packaging Option Management Documentation

## 📋 Table of Contents
- [Packaging Option Management Overview](#packaging-option-management-overview)
- [Packaging Option Model](#-packaging-option-model)
- [Packaging Controller](#-packaging-controller)
- [Packaging Routes](#-packaging-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Packaging Option Management Overview

Packaging Option Management provides the ability to define and manage various packaging choices available for orders within the TEO KICKS API system. This includes options like gift wrapping, special boxes, or eco-friendly packaging, each with an associated price. It supports managing active status, default options, and retrieval of options for public display.

---

## 👤 Packaging Option Model

### Schema Definition
```typescript
interface IPackagingOption {
  _id: string;
  name: string;
  price: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/packagingOptionModel.js`**

```javascript
import mongoose from "mongoose"


const packagingOptionSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false }
}, { timestamps: true })


// Unique case-insensitive name
packagingOptionSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } })
packagingOptionSchema.index({ isActive: 1, isDefault: 1 })


const PackagingOption = mongoose.model("PackagingOption", packagingOptionSchema)


export default PackagingOption
```

### Validation Rules
```javascript
name:      { required: true, type: String, trim: true, unique: true (case-insensitive) }
price:     { required: true, type: Number, min: 0 }
isActive:  { type: Boolean, default: true }
isDefault: { type: Boolean, default: false }
```

---

## 🎮 Packaging Controller

### Required Imports
```javascript
import PackagingOption from "../models/packagingOptionModel.js"
import { errorHandler } from "../utils/error.js"
```

### Functions Overview

#### `createPackaging()`
**Purpose:** Create a new packaging option.  
**Access:** Private (Admin)  
**Validation:** `name` and `price` are required. `price` must be non-negative. Checks for existing option with the same name.  
**Process:** Creates a new `PackagingOption` document. If `isDefault` is true, it unsets `isDefault` for other options.  
**Response:** The newly created packaging option object.

**Controller Implementation:**
```javascript
export const createPackaging = async (req, res, next) => {
    try {
        const { name, price, isActive = true, isDefault = false } = req.body || {}

        if (!name || typeof name !== 'string') {
            return next(errorHandler(400, 'Name is required'))
        }

        if (price == null || Number(price) < 0) {
            return next(errorHandler(400, 'Price must be a non-negative number'))
        }

        // If making default, unset others
        if (isDefault) {
            await PackagingOption.updateMany({ isDefault: true }, { $set: { isDefault: false } })
        }

        const option = await PackagingOption.create({ name: name.trim(), price: Number(price), isActive: Boolean(isActive), isDefault: Boolean(isDefault && isActive) })

        return res.status(201).json({ success: true, data: { packaging: option } })
    } catch (err) {
        if (err?.code === 11000) {
            return next(errorHandler(409, 'A packaging option with that name already exists'))
        }
        return next(err)
    }
}
```

#### `getPackagingList()`
**Purpose:** Get all packaging options with optional pagination, search, and status filters.  
**Access:** Private (Admin)  
**Validation:** Optional query parameters for `page`, `limit`, `search`, `active`, `isDefault`, `minPrice`, `maxPrice`, `sort`.  
**Process:** Queries packaging options based on filters and returns paginated results.  
**Response:** Paginated list of packaging option objects.

**Controller Implementation:**
```javascript
export const getPackagingList = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            active,
            isDefault,
            minPrice,
            maxPrice,
            sort = 'createdAt:desc'
        } = req.query || {}

        const filters = {}
        if (search) filters.name = { $regex: search, $options: 'i' }
        if (active !== undefined) filters.isActive = String(active) === 'true'
        if (isDefault !== undefined) filters.isDefault = String(isDefault) === 'true'
        if (minPrice != null || maxPrice != null) {
            filters.price = {}
            if (minPrice != null) filters.price.$gte = Number(minPrice)
            if (maxPrice != null) filters.price.$lte = Number(maxPrice)
        }

        const [sortField, sortDirRaw] = String(sort).split(':')
        const sortDir = String(sortDirRaw).toLowerCase() === 'asc' ? 1 : -1

        const skip = (Number(page) - 1) * Number(limit)

        const [data, total] = await Promise.all([
            PackagingOption.find(filters).collation({ locale: 'en', strength: 2 }).sort({ [sortField || 'createdAt']: sortDir }).skip(skip).limit(Number(limit)),
            PackagingOption.countDocuments(filters)
        ])

        return res.json({
            success: true,
            data: {
                packaging: data,
                pagination: {
                    currentPage: Number(page),
                    pageSize: Number(limit),
                    totalItems: Number(total),
                    totalPages: Math.max(1, Math.ceil(Number(total) / Number(limit)))
                }
            }
        })
    } catch (err) {
        return next(err)
    }
}
```

#### `getPackagingById()`
**Purpose:** Get a single packaging option by its ID.  
**Access:** Private (Admin)  
**Validation:** `id` in params.  
**Process:** Finds the packaging option by ID.  
**Response:** A single packaging option object.

**Controller Implementation:**
```javascript
export const getPackagingById = async (req, res, next) => {
    try {
        const { id } = req.params
        const option = await PackagingOption.findById(id)
        if (!option) return next(errorHandler(404, 'Packaging option not found'))
        return res.json({ success: true, data: { packaging: option } })
    } catch (err) {
        return next(err)
    }
}
```

#### `updatePackaging()`
**Purpose:** Update an existing packaging option.  
**Access:** Private (Admin)  
**Validation:** `id` in params. Performs validation on `price`. Handles `isDefault` transitions.  
**Process:** Finds and updates the packaging option. If `isDefault` is set to true, it unsets others. If `isActive` is set to false, `isDefault` is also unset.  
**Response:** The updated packaging option object.

**Controller Implementation:**
```javascript
export const updatePackaging = async (req, res, next) => {
    try {
        const { id } = req.params
        const { name, price, isActive, isDefault } = req.body || {}

        const update = {}
        if (name != null) update.name = String(name).trim()
        if (price != null) {
            if (Number(price) < 0) return next(errorHandler(400, 'Price must be a non-negative number'))
            update.price = Number(price)
        }
        if (isActive != null) update.isActive = Boolean(isActive)
        if (isDefault != null) update.isDefault = Boolean(isDefault)

        // Handle default flag transitions
        if (update.isDefault === true) {
            // Unset default on others first
            await PackagingOption.updateMany({ _id: { $ne: id }, isDefault: true }, { $set: { isDefault: false } })
            // Ensure active when default
            update.isActive = true
        }

        if (update.isActive === false) {
            // If deactivating, cannot remain default
            update.isDefault = false
        }

        const option = await PackagingOption.findByIdAndUpdate(id, update, { new: true, runValidators: true, context: 'query' })
        if (!option) return next(errorHandler(404, 'Packaging option not found'))
        return res.json({ success: true, data: { packaging: option } })
    } catch (err) {
        if (err?.code === 11000) {
            return next(errorHandler(409, 'A packaging option with that name already exists'))
        }
        return next(err)
    }
}
```

#### `deletePackaging()`
**Purpose:** Delete a packaging option.  
**Access:** Private (Admin)  
**Validation:** `id` in params.  
**Process:** Finds and deletes the packaging option document. If the deleted option was default, it attempts to promote another active, lowest-priced option to default.  
**Response:** Success message.

**Controller Implementation:**
```javascript
export const deletePackaging = async (req, res, next) => {
    try {
        const { id } = req.params
        const option = await PackagingOption.findByIdAndDelete(id)
        if (!option) return next(errorHandler(404, 'Packaging option not found'))

        // If deleted was default, try auto-promote the lowest-priced active option
        if (option.isDefault) {
            const replacement = await PackagingOption.findOne({ isActive: true }).sort({ price: 1, name: 1 })
            if (replacement) {
                replacement.isDefault = true
                await replacement.save()
            }
        }

        return res.json({ success: true })
    } catch (err) {
        return next(err)
    }
}
```

#### `setDefaultPackaging()`
**Purpose:** Set a specific packaging option as the default.  
**Access:** Private (Admin)  
**Validation:** `id` in params. Checks if the option is active.  
**Process:** Unsets `isDefault` for all other options and sets `isDefault` to `true` for the specified option.  
**Response:** The updated packaging option object.

**Controller Implementation:**
```javascript
export const setDefaultPackaging = async (req, res, next) => {
    try {
        const { id } = req.params
        const option = await PackagingOption.findById(id)
        if (!option) return next(errorHandler(404, 'Packaging option not found'))
        if (!option.isActive) return next(errorHandler(400, 'Cannot set an inactive option as default'))

        await PackagingOption.updateMany({ _id: { $ne: id }, isDefault: true }, { $set: { isDefault: false } })
        option.isDefault = true
        await option.save()

        return res.json({ success: true, data: { packaging: option } })
    } catch (err) {
        return next(err)
    }
}
```

#### `getActivePackaging()`
**Purpose:** Get a list of only active packaging options, sorted by default status, price, and name.  
**Access:** Public  
**Validation:** None.  
**Process:** Finds options where `isActive` is true.  
**Response:** An array of active packaging option objects.

**Controller Implementation:**
```javascript
export const getActivePackaging = async (req, res, next) => {
    try {
        const options = await PackagingOption.find({ isActive: true }).sort({ isDefault: -1, price: 1, name: 1 })
        return res.json({ success: true, data: { packaging: options } })
    } catch (err) {
        return next(err)
    }
}
```

#### `getDefaultPackaging()`
**Purpose:** Get the currently set default active packaging option.  
**Access:** Public  
**Validation:** None.  
**Process:** Finds the single active option marked as default.  
**Response:** The default packaging option object.

**Controller Implementation:**
```javascript
export const getDefaultPackaging = async (req, res, next) => {
    try {
        const option = await PackagingOption.findOne({ isActive: true, isDefault: true })
        if (!option) return res.status(404).json({ success: false, message: 'No default packaging configured' })
        return res.json({ success: true, data: { packaging: option } })
    } catch (err) {
        return next(err)
    }
}
```

---

## 🎁 Packaging Routes

### Base Path: `/api/packaging`

### Router Implementation

**File: `../routes/packagingRoute.js`**

```javascript
import express from "express"
import { verifyBearerToken, requireAdmin } from "../utils/verify.js"
import {
    createPackaging,
    getPackagingList,
    getPackagingById,
    updatePackaging,
    deletePackaging,
    setDefaultPackaging,
    getActivePackaging,
    getDefaultPackaging
} from "../controllers/packagingController.js"


const router = express.Router()


// Public (checkout) endpoints
router.get('/public', getActivePackaging)
router.get('/public/default', getDefaultPackaging)


// Admin-list/read
router.get('/', getPackagingList)
router.get('/:id', getPackagingById)


// Protected mutations
router.use(verifyBearerToken)
router.post('/', requireAdmin, createPackaging)
router.patch('/:id', requireAdmin, updatePackaging)
router.delete('/:id', requireAdmin, deletePackaging)
router.patch('/:id/default', requireAdmin, setDefaultPackaging)


export default router
```

### Route Details

#### `GET /api/packaging/public`
**Headers:** (Optional)  
**Purpose:** Retrieve a list of all active packaging options available for public display (e.g., on checkout).  
**Access:** Public  
**Response:** `200 OK` with an array of packaging option objects.
```json
{
  "success": true,
  "data": {
    "packaging": [
      {
        "_id": "65e26b1c09b068c201383815",
        "name": "Standard Box",
        "price": 50,
        "isActive": true,
        "isDefault": true,
        "createdAt": "2026-02-15T10:00:00.000Z",
        "updatedAt": "2026-02-15T10:00:00.000Z"
      },
      {
        "_id": "65e26b1c09b068c201383816",
        "name": "Gift Box",
        "price": 100,
        "isActive": true,
        "isDefault": false,
        "createdAt": "2026-02-15T10:05:00.000Z",
        "updatedAt": "2026-02-15T10:05:00.000Z"
      }
    ]
  }
}
```

#### `GET /api/packaging/public/default`
**Headers:** (Optional)  
**Purpose:** Retrieve the currently configured default active packaging option.  
**Access:** Public  
**Response:** `200 OK` with the default packaging option object, or `404 Not Found`.
```json
{
  "success": true,
  "data": {
    "packaging": {
      "_id": "65e26b1c09b068c201383815",
      "name": "Standard Box",
      "price": 50,
      "isActive": true,
      "isDefault": true,
      "createdAt": "2026-02-15T10:00:00.000Z",
      "updatedAt": "2026-02-15T10:00:00.000Z"
    }
  }
}
```

#### `GET /api/packaging`
**Headers:** `Authorization: Bearer <token>`  
**Query Parameters:** `page`, `limit`, `search`, `active`, `isDefault`, `minPrice`, `maxPrice`, `sort`  
**Purpose:** Retrieve a paginated list of all packaging options, with comprehensive filtering and sorting.  
**Access:** Private (Admin)  
**Response:** `200 OK` with paginated packaging option data.
```json
{
  "success": true,
  "data": {
    "packaging": [
      {
        "_id": "65e26b1c09b068c201383815",
        "name": "Standard Box",
        "price": 50,
        "isActive": true,
        "isDefault": true
      }
    ],
    "pagination": {
      "currentPage": 1,
      "pageSize": 10,
      "totalItems": 1,
      "totalPages": 1
    }
  }
}
```

#### `GET /api/packaging/:id`
**Headers:** `Authorization: Bearer <token>`  
**Parameters:** `id` (path) - The ID of the packaging option to retrieve.  
**Purpose:** Retrieve a single packaging option by its unique identifier.  
**Access:** Private (Admin)  
**Response:** `200 OK` with the packaging option object, or `404 Not Found`.
```json
{
  "success": true,
  "data": {
    "packaging": {
      "_id": "65e26b1c09b068c201383815",
      "name": "Standard Box",
      "price": 50,
      "isActive": true,
      "isDefault": true,
      "createdAt": "2026-02-15T10:00:00.000Z",
      "updatedAt": "2026-02-15T10:00:00.000Z"
    }
  }
}
```

#### `POST /api/packaging`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Body (JSON):**  
```json
{
  "name": "Eco-Friendly Box",
  "price": 25,
  "isActive": true,
  "isDefault": false
}
```
**Purpose:** Create a new packaging option in the system.  
**Access:** Private (Admin Only)  
**Response:** `201 Created` with the details of the newly created packaging option.
```json
{
  "success": true,
  "data": {
    "packaging": {
      "_id": "65e26b1c09b068c201383815",
      "name": "Eco-Friendly Box",
      "price": 25,
      "isActive": true,
      "isDefault": false,
      "createdAt": "2026-02-15T10:00:00.000Z",
      "updatedAt": "2026-02-15T10:00:00.000Z"
    }
  }
}
```

#### `PATCH /api/packaging/:id`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `id` (path) - The ID of the packaging option to update.  
**Body (JSON):** (partial update allowed)  
```json
{
  "price": 30,
  "isActive": true,
  "isDefault": true
}
```
**Purpose:** Update the details of an existing packaging option.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with the updated packaging option object.
```json
{
  "success": true,
  "data": {
    "packaging": {
      "_id": "65e26b1c09b068c201383815",
      "name": "Standard Box",
      "price": 30,
      "isActive": true,
      "isDefault": true,
      "updatedAt": "2026-02-15T11:00:00.000Z"
    }
  }
}
```

#### `DELETE /api/packaging/:id`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `id` (path) - The ID of the packaging option to delete.  
**Purpose:** Delete a packaging option from the system.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with a success message.
```json
{
  "success": true
}
```

#### `PATCH /api/packaging/:id/default`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `id` (path) - The ID of the packaging option to set as default.  
**Purpose:** Set a specific packaging option as the global default.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with the updated packaging option object.
```json
{
  "success": true,
  "data": {
    "packaging": {
      "_id": "65e26b1c09b068c201383815",
      "name": "Standard Box",
      "price": 50,
      "isActive": true,
      "isDefault": true,
      "updatedAt": "2026-02-15T11:00:00.000Z"
    }
  }
}
```

---

## 🔐 Middleware

- `verifyBearerToken`: Used on mutation routes (`POST`, `PATCH`, `DELETE`) and admin-specific read routes to ensure authentication.
- `requireAdmin`: Used on mutation routes (`POST`, `PATCH`, `DELETE`) and admin-specific read routes to restrict access to administrators only.

---

## 📝 API Examples

### Get All Active Packaging Options (Public)
```bash
curl -X GET http://localhost:5000/api/packaging/public
```

### Create a New Packaging Option (Admin)
```bash
curl -X POST http://localhost:5000/api/packaging 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <admin_access_token>" 
  -d '{
    "name": "Gift Box",
    "price": 100,
    "isActive": true,
    "isDefault": false
  }'
```

### Update a Packaging Option and Set as Default (Admin)
```bash
curl -X PATCH http://localhost:5000/api/packaging/<packaging_option_id> 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <admin_access_token>" 
  -d '{
    "price": 120,
    "isDefault": true
  }'
```

---

## 🛡️ Security Features

-   **Authentication:** All administrative and modification endpoints require a valid JWT token.
-   **Authorization:** Creation, update, and deletion of packaging options are restricted to users with the 'admin' role. Setting a default option is also admin-only.
-   **Unique Names:** Ensures each packaging option has a unique name (case-insensitive), preventing duplicates.
-   **Default Option Management:** Automated logic ensures only one packaging option can be marked as default at any given time, simplifying configuration.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

-   `400 Bad Request`: Invalid input (e.g., missing name or price, non-negative price, attempting to set an inactive option as default).
-   `401 Unauthorized`: Missing or invalid authentication token.
-   `403 Forbidden`: Access denied (e.g., non-admin attempting an admin operation).
-   `404 Not Found`: The requested packaging option was not found.
-   `409 Conflict`: A packaging option with the same name already exists.
-   `500 Internal Server Error`: An unexpected server-side error occurred during processing.

---

## 📊 Database Indexes

-   `name: 1` (unique, collation: `en`, `strength: 2`): Ensures efficient and unique (case-insensitive) lookup by packaging option name.
-   `isActive: 1, isDefault: 1`: Facilitates efficient filtering to retrieve active options and the currently set default option.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
