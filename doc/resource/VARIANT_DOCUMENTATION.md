# 🔢 TEO KICKS API - Variant Management Documentation

## 📋 Table of Contents
- [Variant Management Overview](#variant-management-overview)
- [Variant Model](#-variant-model)
- [Variant Controller](#-variant-controller)
- [Variant Routes](#-variant-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Variant Management Overview

Variant Management provides a robust system for defining product attributes that vary (e.g., Size, Color) and their respective options (e.g., Small, Medium, Large; Red, Blue). This enables products to have multiple permutations, each managed as a unique SKU (Stock Keeping Unit). The system handles the creation, updating, and deletion of variants and their options, and ensures that changes cascade to product SKUs.

---

## 👤 Variant Model

### Schema Definition
```typescript
interface IVariant {
  _id: string;
  name: string;
  options: Array<{
    _id: string;
    value: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/variantModel.js`**

```javascript
import mongoose from "mongoose"


const optionSchema = new mongoose.Schema({

    value: { 
        type: String, 
        required: true,
        trim: true
    },

    isActive: { 
        type: Boolean, 
        default: true 
    },

    sortOrder: { 
        type: Number, 
        default: 0 
    }

}, {
    timestamps: true
})


const variantSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },

    options: [optionSchema]

}, {
    timestamps: true
})


// Indexes for better query performance
// Note: name index is automatically created due to unique: true


// Pre-save middleware to ensure unique option values within a variant
variantSchema.pre('save', function(next) {

    if (this.options && this.options.length > 0) {

        const values = this.options.map(option => option.value.toLowerCase())

        const uniqueValues = [...new Set(values)]

        if (values.length !== uniqueValues.length) {

            return next(new Error('Duplicate option values are not allowed within a variant'))

        }

    }

    next()

})


// Instance method to add an option
variantSchema.methods.addOption = async function(optionData) {

    this.options.push(optionData)

    await this.save()

    // Auto-regenerate SKUs for all products using this variant
    try {
        const { default: Product } = await import('./productModel.js')
        const products = await Product.find({ variants: this._id })
        
        for (const product of products) {
            await product.generateSKUs()
        }
    } catch (error) {
        console.error('Error regenerating SKUs after adding option:', error)
        // Don't throw error - option was added successfully
    }

    return this

}


// Instance method to remove an option
variantSchema.methods.removeOption = async function(optionId) {

    // Import Product model here to avoid circular dependency
    const { default: Product } = await import('./productModel.js')

    try {

        // First, find and delete all SKUs that reference this option

        const productsToUpdate = await Product.find({ 'skus.attributes.optionId': optionId })

        for (const product of productsToUpdate) {

            // Remove SKUs that have this optionId in their attributes

            product.skus = product.skus.filter(sku => 
                !sku.attributes.some(attr => attr.optionId.toString() === optionId.toString())
            )

            await product.save()

        }

        // Then remove the option from the variant

        this.options = this.options.filter(option => option._id.toString() !== optionId.toString())

        await this.save()

        // Auto-regenerate SKUs for all products using this variant
        try {
            const products = await Product.find({ variants: this._id })
            
            for (const product of products) {
                await product.generateSKUs()
            }
        } catch (error) {
            console.error('Error regenerating SKUs after removing option:', error)
            // Don't throw error - option was removed successfully
        }

        return this

    } catch (error) {

        console.error('Error in removeOption cascade deletion:', error)

        throw error

    }

}


// Instance method to update an option
variantSchema.methods.updateOption = function(optionId, updateData) {

    const option = this.options.id(optionId)

    if (option) {

        Object.assign(option, updateData)

        return this.save()

    }

    throw new Error('Option not found')

}


// Static method to get all variants with their options
variantSchema.statics.getWithOptions = function() {

    return this.find()
        .select('name options')
        .sort({ name: 1 })

}


const Variant = mongoose.model('Variant', variantSchema)


export default Variant
```

### Validation Rules
```javascript
name:        { required: true, type: String, trim: true, unique: true }
options:     { type: Array of optionSchema }
  value:       { required: true, type: String, trim: true, unique within variant }
  isActive:    { type: Boolean, default: true }
  sortOrder:   { type: Number, default: 0 }
```

---

## 🎮 Variant Controller

### Required Imports
```javascript
import Variant from "../models/variantModel.js"
import { validateVariant, validateVariantOption } from "../utils/validation.js"
// Product model is dynamically imported in instance methods to avoid circular dependency
```

### Functions Overview

#### `createVariant()`
**Purpose:** Create a new variant (e.g., "Size", "Color") along with its initial options.  
**Access:** Private (Admin/Manager)  
**Validation:** `name` is required and unique.  
**Process:** Creates a new `Variant` document.  
**Response:** The newly created variant object.

**Controller Implementation:**
```javascript
export const createVariant = async (req, res) => {
    try {
        const { error } = validateVariant(req.body)

        if (error) {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: error.details.map(detail => detail.message)
            })
        }

        const { name, options } = req.body

        // Check if variant with same name already exists
        const existingVariant = await Variant.findOne({ name })

        if (existingVariant) {
            return res.status(400).json({
                success: false,
                message: "Variant with this name already exists"
            })
        }

        const variant = new Variant({
            name,
            options: options || []
        })

        await variant.save()

        res.status(201).json({
            success: true,
            message: "Variant created successfully",
            data: variant
        })

    } catch (error) {
        console.error("Create variant error:", error)
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        })
    }
}
```

#### `getAllVariants()`
**Purpose:** Retrieve all variants with optional pagination, search, and active status filters.  
**Access:** Private (Admin/Manager)  
**Validation:** Optional query parameters for `page`, `limit`, `search`, `isActive`.  
**Process:** Queries variants based on filters and returns paginated results.  
**Response:** Paginated list of variant objects.

**Controller Implementation:**
```javascript
export const getAllVariants = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, isActive } = req.query

        const query = {}

        if (search) {
            query.name = { $regex: search, $options: 'i' }
        }

        if (isActive !== undefined) {
            query.isActive = isActive === 'true'
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { sortOrder: 1, name: 1 }
        }

        const variants = await Variant.find(query)
            .skip((options.page - 1) * options.limit)
            .limit(options.limit)
            .sort(options.sort)

        const total = await Variant.countDocuments(query)

        res.json({
            success: true,
            data: variants,
            pagination: {
                page: options.page,
                limit: options.limit,
                total,
                pages: Math.ceil(total / options.limit)
            }
        })

    } catch (error) {
        console.error("Get variants error:", error)
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        })
    }
}
```

#### `getVariantById()`
**Purpose:** Retrieve a single variant by its ID.  
**Access:** Public  
**Validation:** `id` in params.  
**Process:** Finds the variant by ID.  
**Response:** A single variant object.

**Controller Implementation:**
```javascript
export const getVariantById = async (req, res) => {
    try {
        const { id } = req.params

        const variant = await Variant.findById(id)

        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found"
            })
        }

        res.json({
            success: true,
            data: variant
        })

    } catch (error) {
        console.error("Get variant by ID error:", error)
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        })
    }
}
```

#### `updateVariant()`
**Purpose:** Update an existing variant's properties (e.g., name).  
**Access:** Private (Admin/Manager)  
**Validation:** `id` in params. `name` must be unique if changed.  
**Process:** Finds and updates the variant.  
**Response:** The updated variant object.

**Controller Implementation:**
```javascript
export const updateVariant = async (req, res) => {
    try {
        const { id } = req.params
        const { error } = validateVariant(req.body)

        if (error) {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: error.details.map(detail => detail.message)
            })
        }

        const { name, description, displayType, colorHex, measurement, isActive, sortOrder } = req.body

        // Check if name is being changed and if it conflicts
        if (name) {
            const existingVariant = await Variant.findOne({ name, _id: { $ne: id } })

            if (existingVariant) {
                return res.status(400).json({
                    success: false,
                    message: "Variant with this name already exists"
                })
            }
        }

        const variant = await Variant.findByIdAndUpdate(
            id,
            {
                name,
                description,
                displayType,
                colorHex,
                measurement,
                isActive,
                sortOrder
            },
            { new: true, runValidators: true }
        )

        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found"
            })
        }

        res.json({
            success: true,
            message: "Variant updated successfully",
            data: variant
        })

    } catch (error) {
        console.error("Update variant error:", error)
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        })
    }
}
```

#### `deleteVariant()`
**Purpose:** Delete a variant. This operation also attempts to clean up associated SKUs in products that used this variant.  
**Access:** Private (Admin/Manager)  
**Validation:** `id` in params.  
**Process:** Finds and deletes the variant document. Cascades to remove related product SKUs.  
**Response:** Success message.

**Controller Implementation:**
```javascript
export const deleteVariant = async (req, res) => {
    try {
        const { id } = req.params

        const variant = await Variant.findByIdAndDelete(id)

        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found"
            })
        }

        res.json({
            success: true,
            message: "Variant deleted successfully"
        })

    } catch (error) {
        console.error("Delete variant error:", error)
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        })
    }
}
```

#### `addOption()`
**Purpose:** Add a new option (e.g., "Small", "Red") to an existing variant. Triggers SKU regeneration for affected products.  
**Access:** Private (Admin/Manager)  
**Validation:** `id` in params, `value` is required for the option.  
**Process:** Adds the new option to the variant's `options` array and then automatically triggers SKU regeneration for all products that use this variant.  
**Response:** The updated variant object.

**Controller Implementation:**
```javascript
export const addOption = async (req, res) => {
    try {
        const { id } = req.params
        const { error } = validateVariantOption(req.body)

        if (error) {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: error.details.map(detail => detail.message)
            })
        }

        const { value, sortOrder } = req.body

        const variant = await Variant.findById(id)

        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found"
            })
        }

        await variant.addOption({ value, sortOrder })

        res.json({
            success: true,
            message: "Option added successfully",
            data: variant
        })

    } catch (error) {
        console.error("Add option error:", error)
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        })
    }
}
```

#### `updateOption()`
**Purpose:** Update an existing option within a variant.  
**Access:** Private (Admin/Manager)  
**Validation:** `id` and `optionId` in params, `value` is required for the option.  
**Process:** Finds the variant and the specific option within it, then updates its properties.  
**Response:** The updated variant object.

**Controller Implementation:**
```javascript
export const updateOption = async (req, res) => {
    try {
        const { id, optionId } = req.params
        const { error } = validateVariantOption(req.body)

        if (error) {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: error.details.map(detail => detail.message)
            })
        }

        const { value, isActive, sortOrder } = req.body

        const variant = await Variant.findById(id)

        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found"
            })
        }

        await variant.updateOption(optionId, { value, isActive, sortOrder })

        res.json({
            success: true,
            message: "Option updated successfully",
            data: variant
        })

    } catch (error) {
        console.error("Update option error:", error)
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        })
    }
}
```

#### `removeOption()`
**Purpose:** Remove an option from a variant. This operation also deletes all product SKUs that use this option and regenerates SKUs for affected products.  
**Access:** Private (Admin/Manager)  
**Validation:** `id` and `optionId` in params.  
**Process:** Finds the variant and the specific option within it. Removes associated SKUs from products, then removes the option from the variant. Triggers SKU regeneration for affected products.  
**Response:** The updated variant object.

**Controller Implementation:**
```javascript
export const removeOption = async (req, res) => {
    try {
        const { id, optionId } = req.params

        const variant = await Variant.findById(id)

        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found"
            })
        }

        // Check if option exists before deletion
        const option = variant.options.id(optionId)
        if (!option) {
            return res.status(404).json({
                success: false,
                message: "Option not found"
            })
        }

        // Perform cascade deletion (removes related SKUs)
        await variant.removeOption(optionId)

        res.json({
            success: true,
            message: "Option and related SKUs removed successfully",
            data: variant
        })

    } catch (error) {
        console.error("Remove option error:", error)
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        })
    }
}
```

#### `getActiveVariants()`
**Purpose:** Retrieve a list of only active variants and their options.  
**Access:** Public  
**Validation:** None.  
**Process:** Finds variants and returns their names and options.  
**Response:** An array of active variant objects.

**Controller Implementation:**
```javascript
export const getActiveVariants = async (req, res) => {
    try {
        const variants = await Variant.getActive()

        res.json({
            success: true,
            data: variants
        })

    } catch (error) {
        console.error("Get active variants error:", error)
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        })
    }
}
```

---

## 🔢 Variant Routes

### Base Path: `/api/variants`

### Router Implementation

**File: `../routes/variantRoute.js`**

```javascript
import express from "express"

import { authenticateToken, authorizeRoles } from "../middlewares/auth.js"

import {

    createVariant,

    getAllVariants,

    getVariantById,

    updateVariant,

    deleteVariant,

    addOption,

    updateOption,

    removeOption,

    getActiveVariants

} from "../controllers/variantController.js"


const router = express.Router()


router.get("/active", getActiveVariants)

router.get("/:id", getVariantById)


// Protected routes (admin only)
router.use(authenticateToken)


router.use(authorizeRoles(["admin", "manager"])) // Note: "manager" role for variants implies product management access


router.get("/", getAllVariants)

router.post("/", createVariant)

router.put("/:id", updateVariant)

router.delete("/:id", deleteVariant)


router.post("/:id/options", addOption)


router.put("/:id/options/:optionId", updateOption)


router.delete("/:id/options/:optionId", removeOption)


export default router
```

### Route Details

#### `GET /api/variants/active`
**Headers:** (Optional)  
**Purpose:** Retrieve a list of all active variants and their associated options, suitable for public display.  
**Access:** Public  
**Response:** `200 OK` with an array of active variant objects.

#### `GET /api/variants/:id`
**Headers:** (Optional)  
**Parameters:** `id` (path) - The ID of the variant to retrieve.  
**Purpose:** Retrieve a single variant by its unique identifier.  
**Access:** Public  
**Response:** `200 OK` with the variant object, or `404 Not Found`.

#### `GET /api/variants`
**Headers:** `Authorization: Bearer <token>`  
**Query Parameters:** `page`, `limit`, `search`, `isActive`  
**Purpose:** Retrieve a paginated list of all variants.  
**Access:** Private (Admin/Manager)  
**Response:** `200 OK` with paginated variant data.

#### `POST /api/variants`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Body (JSON):**  
```json
{
  "name": "Color",
  "options": [
    { "value": "Red" },
    { "value": "Blue" }
  ]
}
```
**Purpose:** Create a new variant (e.g., "Color") with initial options.  
**Access:** Private (Admin/Manager Only)  
**Response:** `201 Created` with the newly created variant object.

#### `PUT /api/variants/:id`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `id` (path) - The ID of the variant to update.  
**Body (JSON):** (partial update allowed)  
```json
{
  "name": "Product Color"
}
```
**Purpose:** Update the main properties of an existing variant.  
**Access:** Private (Admin/Manager Only)  
**Response:** `200 OK` with the updated variant object.

#### `DELETE /api/variants/:id`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `id` (path) - The ID of the variant to delete.  
**Purpose:** Delete a variant and cascade the deletion to any product SKUs that utilized this variant.  
**Access:** Private (Admin/Manager Only)  
**Response:** `200 OK` with a success message.

#### `POST /api/variants/:id/options`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `id` (path) - The ID of the variant to add an option to.  
**Body (JSON):**  
```json
{
  "value": "Green",
  "sortOrder": 3,
  "isActive": true
}
```
**Purpose:** Add a new option to an existing variant. This will automatically trigger SKU regeneration for all products using this variant.  
**Access:** Private (Admin/Manager Only)  
**Response:** `200 OK` with the updated variant object.

#### `PUT /api/variants/:id/options/:optionId`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `id` (path) - Variant ID, `optionId` (path) - Option ID.  
**Body (JSON):** (partial update allowed)  
```json
{
  "value": "Forest Green",
  "isActive": false
}
```
**Purpose:** Update an existing option within a variant.  
**Access:** Private (Admin/Manager Only)  
**Response:** `200 OK` with the updated variant object.

#### `DELETE /api/variants/:id/options/:optionId`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `id` (path) - Variant ID, `optionId` (path) - Option ID.  
**Purpose:** Remove an option from a variant. This cascades to delete associated SKUs in products and regenerates remaining SKUs.  
**Access:** Private (Admin/Manager Only)  
**Response:** `200 OK` with the updated variant object.

---

## 🔐 Middleware

- `authenticateToken`: Used on all routes protected for administrative access.
- `authorizeRoles(['admin', 'manager'])`: Used on all modification routes (`POST`, `PUT`, `DELETE`, option management) and admin-specific read routes to restrict access to users with 'admin' or 'manager' roles.

---

## 📝 API Examples

### Create a New Variant
```bash
curl -X POST http://localhost:5000/api/variants 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <admin_access_token>" 
  -d '{
    "name": "Material",
    "options": [
      { "value": "Cotton", "sortOrder": 1 },
      { "value": "Polyester", "sortOrder": 2 }
    ]
  }'
```

### Add an Option to a Variant
```bash
curl -X POST http://localhost:5000/api/variants/<variant_id>/options 
  -H "Content-Type: application/json" 
  -H "Authorization: Bearer <admin_access_token>" 
  -d '{
    "value": "Nylon",
    "sortOrder": 3
  }'
```

### Get All Active Variants (Public)
```bash
curl -X GET http://localhost:5000/api/variants/active
```

### Delete an Option from a Variant
```bash
curl -X DELETE http://localhost:5000/api/variants/<variant_id>/options/<option_id> 
  -H "Authorization: Bearer <admin_access_token>"
```

---

## 🛡️ Security Features

-   **Authentication:** All administrative operations and sensitive modifications to variant data require a valid JWT token. Public read access is provided for active variants.
-   **Authorization:** Creation, update, and deletion of variants and their options are restricted to users with 'admin' or 'manager' roles, enforced by `authorizeRoles` middleware.
-   **Data Consistency:** Pre-save hooks and instance methods ensure:
    *   Variant names are unique.
    *   Option values within a single variant are unique.
    *   Changes to variants or options (e.g., deletion of an option) correctly cascade to update or remove associated product SKUs, maintaining data integrity.
-   **Input Validation:** Robust server-side validation is applied to variant and option fields.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

-   `400 Bad Request`: Invalid input (e.g., missing name/value, duplicate variant name, duplicate option value within a variant).
-   `401 Unauthorized`: Missing or invalid authentication token.
-   `403 Forbidden`: Access denied (e.g., non-admin/manager attempting an administrative operation).
-   `404 Not Found`: The requested variant or option was not found.
-   `500 Internal Server Error`: An unexpected server-side error occurred during processing (e.g., database errors, SKU regeneration errors).

---

## 📊 Database Indexes

-   `name: 1` (unique): Ensures fast and unique lookup by variant name, preventing duplicate variant definitions.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
