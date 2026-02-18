# 🏠 TEO KICKS API - Address Management Documentation

## 📋 Table of Contents
- [Address Management Overview](#address-management-overview)
- [Address Model](#-address-model)
- [Address Controller](#-address-controller)
- [Address Routes](#-address-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Address Management Overview

Address Management handles storing and retrieving geographic locations associated with users. It includes functionalities for creating, updating, deleting, and setting default addresses, as well as an admin view for all addresses.

---

## 👤 Address Model

### Schema Definition
```typescript
interface IAddress {
  _id: string;
  userId: string; // User ObjectId
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  regions: {
    country: string;
    locality?: string;
    sublocality?: string;
    sublocality_level_1?: string;
    administrative_area_level_1?: string;
    plus_code?: string;
    political?: string;
  };
  address: string;
  details?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/addressModel.js`**

```javascript
import mongoose from "mongoose"


const addressSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // Place name, e.g., "Red Diamonds Ruaraka"
    name: {
        type: String,
        required: true,
        trim: true
    },

    coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },

    regions: {
        country: { type: String, required: true },
        locality: { type: String },
        sublocality: { type: String },
        sublocality_level_1: { type: String },
        administrative_area_level_1: { type: String },
        plus_code: { type: String },
        political: { type: String }
    },

    // Full formatted address
    address: { type: String, required: true, trim: true },

    // User custom notes (e.g., "Near gate B")
    details: { type: String, default: null },

    // Default address flag
    isDefault: { type: Boolean, default: false }

}, {
    timestamps: true
})


// Index for efficient queries
addressSchema.index({ userId: 1, isDefault: 1 })


// Ensure only one default address per user
addressSchema.pre('save', async function(next) {

    if (this.isDefault && this.isModified('isDefault')) {

        await this.constructor.updateMany(
            { userId: this.userId, _id: { $ne: this._id } },
            { $set: { isDefault: false } }
        )

    }

    next()

})


const Address = mongoose.model("Address", addressSchema)


export default Address
```

### Validation Rules
```javascript
userId:    { required: true, type: ObjectId, ref: 'User' }
name:      { required: true, type: String, trim: true }
coordinates: {
  lat: { required: true, type: Number },
  lng: { required: true, type: Number }
}
regions:   { country: { required: true, type: String }, locality: { type: String }, ... }
address:   { required: true, type: String, trim: true }
details:   { type: String, default: null }
isDefault: { type: Boolean, default: false }
```

---

## 🎮 Address Controller

### Required Imports
```javascript
import Address from "../models/addressModel.js"
import User from "../models/userModel.js"
import { errorHandler } from "../utils/error.js"
```

### Functions Overview

#### `getUserAddresses()`
**Purpose:** Get all authenticated user's addresses.  
**Access:** Private (Authenticated User)  
**Validation:** User must be authenticated.  
**Process:** Fetches all addresses associated with the `req.user._id`.  
**Response:** An array of address objects.

**Controller Implementation:**
```javascript
export const getUserAddresses = async (req, res, next) => {

    try {

        const addresses = await Address.find({ 
            userId: req.user._id
        }).sort({ isDefault: -1, createdAt: -1 })

        res.status(200).json({
            success: true,
            data: {
                addresses: addresses,
                count: addresses.length
            }
        })

    } catch (error) {

        console.error('Get user addresses error:', error)

        next(errorHandler(500, "Server error while fetching addresses"))

    }

}
```

#### `getAddressById()`
**Purpose:** Get a single address by its ID belonging to the authenticated user.  
**Access:** Private (Authenticated User)  
**Validation:** `addressId` in params, address must belong to `req.user._id`.  
**Process:** Finds the address by ID and `userId`.  
**Response:** A single address object.

**Controller Implementation:**
```javascript
export const getAddressById = async (req, res, next) => {

    try {

        const { addressId } = req.params

        const address = await Address.findOne({
            _id: addressId,
            userId: req.user._id
        })

        if (!address) {

            return next(errorHandler(404, "Address not found"))

        }

        res.status(200).json({
            success: true,
            data: {
                address: address
            }
        })

    } catch (error) {

        console.error('Get address by ID error:', error)

        next(errorHandler(500, "Server error while fetching address"))

    }

}
```

#### `createAddress()`
**Purpose:** Create a new address for the authenticated user.  
**Access:** Private (Authenticated User)  
**Validation:** Required fields (`name`, `coordinates.lat`, `coordinates.lng`, `regions.country`, `address`) must be present.  
**Process:** Creates a new address document with `req.user._id` as `userId`. Handles `isDefault` logic to ensure only one default address per user.  
**Response:** The newly created address object.

**Controller Implementation:**
```javascript
export const createAddress = async (req, res, next) => {

    try {

        const { 
            name,
            coordinates,
            regions,
            address: formatted,
            details,
            isDefault
        } = req.body

        // Validation for new schema
        if (!name) {
            return next(errorHandler(400, "Address name is required"))
        }

        if (!coordinates || coordinates.lat === undefined || coordinates.lng === undefined) {
            return next(errorHandler(400, "Coordinates lat and lng are required"))
        }

        if (!regions || !regions.country) {
            return next(errorHandler(400, "Region country is required"))
        }

        if (!formatted) {
            return next(errorHandler(400, "Full formatted address is required"))
        }

        // Check if user exists
        const user = await User.findById(req.user._id)

        if (!user) {

            return next(errorHandler(404, "User not found"))

        }

        // Create new address
        const newAddress = new Address({
            userId: req.user._id,
            name: name.trim(),
            coordinates: {
                lat: parseFloat(coordinates.lat),
                lng: parseFloat(coordinates.lng)
            },
            regions: {
                country: regions.country?.trim(),
                locality: regions.locality?.trim(),
                sublocality: regions.sublocality?.trim(),
                sublocality_level_1: regions.sublocality_level_1?.trim(),
                administrative_area_level_1: regions.administrative_area_level_1?.trim(),
                plus_code: regions.plus_code?.trim(),
                political: regions.political?.trim()
            },
            address: formatted.trim(),
            details: details ?? null,
            isDefault: isDefault || false
        })

        await newAddress.save()

        res.status(201).json({
            success: true,
            message: "Address created successfully",
            data: {
                address: newAddress
            }
        })

    } catch (error) {

        console.error('Create address error:', error)

        if (error.name === 'ValidationError') {

            const message = Object.values(error.errors).map(err => err.message).join(', ')

            return next(errorHandler(400, message))

        }

        next(errorHandler(500, "Server error while creating address"))

    }

}
```

#### `updateAddress()`
**Purpose:** Update an existing address belonging to the authenticated user.  
**Access:** Private (Authenticated User)  
**Validation:** `addressId` in params, address must belong to `req.user._id`.  
**Process:** Finds and updates the address. Handles updating nested `coordinates` and `regions` objects.  
**Response:** The updated address object.

**Controller Implementation:**
```javascript
export const updateAddress = async (req, res, next) => {

    try {

        const { addressId } = req.params

        const { 
            name,
            coordinates,
            regions,
            address: formatted,
            details,
            isDefault
        } = req.body

        const address = await Address.findOne({
            _id: addressId,
            userId: req.user._id
        })

        if (!address) {

            return next(errorHandler(404, "Address not found"))

        }

        // Update fields if provided (new schema)
        if (name !== undefined) address.name = name?.trim() || address.name

        if (coordinates && coordinates.lat !== undefined && coordinates.lng !== undefined) {
            address.coordinates = {
                lat: parseFloat(coordinates.lat),
                lng: parseFloat(coordinates.lng)
            }
        }

        if (regions) {
            address.regions = {
                ...address.regions?.toObject?.() || address.regions || {},
                country: regions.country?.trim() ?? address.regions?.country,
                locality: regions.locality?.trim() ?? address.regions?.locality,
                sublocality: regions.sublocality?.trim() ?? address.regions?.sublocality,
                sublocality_level_1: regions.sublocality_level_1?.trim() ?? address.regions?.sublocality_level_1,
                administrative_area_level_1: regions.administrative_area_level_1?.trim() ?? address.regions?.administrative_area_level_1,
                plus_code: regions.plus_code?.trim() ?? address.regions?.plus_code,
                political: regions.political?.trim() ?? address.regions?.political
            }
        }

        if (formatted !== undefined) address.address = formatted?.trim() || address.address

        if (details !== undefined) address.details = details ?? address.details

        if (isDefault !== undefined) address.isDefault = isDefault

        await address.save()

        res.status(200).json({
            success: true,
            message: "Address updated successfully",
            data: {
                address: address
            }
        })

    } catch (error) {

        console.error('Update address error:', error)

        if (error.name === 'ValidationError') {

            const message = Object.values(error.errors).map(err => err.message).join(', ')

            return next(errorHandler(400, message))

        }

        next(errorHandler(500, "Server error while updating address"))

    }

}
```

#### `deleteAddress()`
**Purpose:** Delete an address belonging to the authenticated user (hard delete).  
**Access:** Private (Authenticated User)  
**Validation:** `addressId` in params, address must belong to `req.user._id`.  
**Process:** Finds and deletes the address document.  
**Response:** Success message.

**Controller Implementation:**
```javascript
export const deleteAddress = async (req, res, next) => {

    try {

        const { addressId } = req.params

        const address = await Address.findOne({
            _id: addressId,
            userId: req.user._id
        })

        if (!address) {

            return next(errorHandler(404, "Address not found"))

        }

        // Hard delete
        await Address.deleteOne({ _id: address._id })

        res.status(200).json({
            success: true,
            message: "Address deleted successfully"
        })

    } catch (error) {

        console.error('Delete address error:', error)

        next(errorHandler(500, "Server error while deleting address"))

    }

}
```

#### `setDefaultAddress()`
**Purpose:** Set a specific address as the default for the authenticated user.  
**Access:** Private (Authenticated User)  
**Validation:** `addressId` in params, address must belong to `req.user._id`.  
**Process:** Sets the specified address's `isDefault` to `true`. A pre-save hook in the model handles unsetting `isDefault` for other addresses of the same user.  
**Response:** The updated address object.

**Controller Implementation:**
```javascript
export const setDefaultAddress = async (req, res, next) => {

    try {

        const { addressId } = req.params

        const address = await Address.findOne({
            _id: addressId,
            userId: req.user._id
        })

        if (!address) {

            return next(errorHandler(404, "Address not found"))

        }

        // Set as default (pre-save hook will handle unsetting others)
        address.isDefault = true

        await address.save()

        res.status(200).json({
            success: true,
            message: "Default address updated successfully",
            data: {
                address: address
            }
        })

    } catch (error) {

        console.error('Set default address error:', error)

        next(errorHandler(500, "Server error while setting default address"))

    }

}
```

#### `getDefaultAddress()`
**Purpose:** Get the default address for the authenticated user.  
**Access:** Private (Authenticated User)  
**Validation:** User must be authenticated.  
**Process:** Finds the address marked as `isDefault: true` for the `req.user._id`.  
**Response:** The default address object.

**Controller Implementation:**
```javascript
export const getDefaultAddress = async (req, res, next) => {

    try {

        const defaultAddress = await Address.findOne({
            userId: req.user._id,
            isDefault: true
        })

        if (!defaultAddress) {

            return next(errorHandler(404, "No default address found"))

        }

        res.status(200).json({
            success: true,
            data: {
                address: defaultAddress
            }
        })

    } catch (error) {

        console.error('Get default address error:', error)

        next(errorHandler(500, "Server error while fetching default address"))

    }

}
```

#### `getAllAddresses()`
**Purpose:** Get all addresses for all users (Admin only), with optional filters and pagination.  
**Access:** Private (Admin only)  
**Validation:** User must be an admin. Filters can include `userId`, `locality`, `country`, `administrativeArea`.  
**Process:** Queries all addresses, populates user details, applies filters, and returns paginated results.  
**Response:** Paginated list of address objects.

**Controller Implementation:**
```javascript
export const getAllAddresses = async (req, res, next) => {

    try {

        const { page = 1, limit = 10, userId, locality, country, administrativeArea } = req.query

        const query = {}

        if (userId) query.userId = userId

        if (locality) query["regions.locality"] = { $regex: locality, $options: 'i' }

        if (country) query["regions.country"] = { $regex: country, $options: 'i' }

        if (administrativeArea) query["regions.administrative_area_level_1"] = { $regex: administrativeArea, $options: 'i' }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { createdAt: -1 }
        }

        const addresses = await Address.find(query)
            .populate('userId', 'name email phone')
            .sort(options.sort)
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit)

        const total = await Address.countDocuments(query)

        res.status(200).json({
            success: true,
            data: {
                addresses: addresses,
                pagination: {
                    currentPage: options.page,
                    totalPages: Math.ceil(total / options.limit),
                    totalAddresses: total,
                    hasNextPage: options.page < Math.ceil(total / options.limit),
                    hasPrevPage: options.page > 1
                }
            }
        })

    } catch (error) {

        console.error('Get all addresses error:', error)

        next(errorHandler(500, "Server error while fetching all addresses"))

    }

}
```

---

## 🗺️ Address Routes

### Base Path: `/api/addresses`

### Router Implementation

**File: `../routes/addressRoute.js`**

```javascript
import express from "express"
import { 
    getUserAddresses, 
    getAddressById, 
    createAddress, 
    updateAddress, 
    deleteAddress,
    setDefaultAddress, 
    getDefaultAddress, 
    getAllAddresses 
} from "../controllers/addressController.js"
import { verifyBearerToken, requireAdmin } from "../utils/verify.js"


const router = express.Router()


// Protected routes - require authentication
router.use(verifyBearerToken)



router.get('/', getUserAddresses)

router.get('/default', getDefaultAddress)

router.get('/:addressId', getAddressById)

router.post('/', createAddress)

router.put('/:addressId', updateAddress)

router.put('/:addressId/default', setDefaultAddress)

router.delete('/:addressId', deleteAddress)


// Admin routes
router.get('/admin/all', requireAdmin, getAllAddresses)


export default router
```

### Route Details

#### `GET /api/addresses`
**Purpose:** Retrieve all addresses belonging to the authenticated user.  
**Access:** Private (Authenticated User)  
**Headers:** `Authorization: Bearer <token>`  
**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "addresses": [
      {
        "_id": "65e26b1c09b068c201383812",
        "userId": "65e26b1c09b068c201383811",
        "name": "My Home Address",
        "coordinates": { "lat": -1.286389, "lng": 36.817223 },
        "regions": { "country": "Kenya", "locality": "Nairobi", "sublocality": "CBD", "administrative_area_level_1": "Nairobi County" },
        "address": "123 Main Street, Nairobi, Kenya",
        "details": "Near the park entrance",
        "isDefault": true,
        "createdAt": "2026-02-17T10:00:00.000Z",
        "updatedAt": "2026-02-17T10:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

#### `GET /api/addresses/default`
**Purpose:** Retrieve the default address set by the authenticated user.  
**Access:** Private (Authenticated User)  
**Headers:** `Authorization: Bearer <token>`  
**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "address": {
      "_id": "65e26b1c09b068c201383812",
      "userId": "65e26b1c09b068c201383811",
      "name": "My Home Address",
      "coordinates": { "lat": -1.286389, "lng": 36.817223 },
      "regions": { "country": "Kenya", "locality": "Nairobi", "sublocality": "CBD", "administrative_area_level_1": "Nairobi County" },
      "address": "123 Main Street, Nairobi, Kenya",
      "details": "Near the park entrance",
      "isDefault": true,
      "createdAt": "2026-02-17T10:00:00.000Z",
      "updatedAt": "2026-02-17T10:00:00.000Z"
    }
  }
}
```

#### `GET /api/addresses/:addressId`
**Purpose:** Retrieve a specific address by its ID, ensuring it belongs to the authenticated user.  
**Access:** Private (Authenticated User)  
**Parameters:** `addressId` (path) - The ID of the address to retrieve.  
**Headers:** `Authorization: Bearer <token>`  
**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "address": {
      "_id": "65e26b1c09b068c201383813",
      "userId": "65e26b1c09b068c201383811",
      "name": "My Work Address",
      "coordinates": { "lat": -1.292066, "lng": 36.821946 },
      "regions": { "country": "Kenya", "locality": "Nairobi", "sublocality": "Upper Hill", "administrative_area_level_1": "Nairobi County" },
      "address": "ABC Towers, Upper Hill Road, Nairobi",
      "details": "First Floor",
      "isDefault": false,
      "createdAt": "2026-02-17T10:05:00.000Z",
      "updatedAt": "2026-02-17T10:05:00.000Z"
    }
  }
}
```

#### `POST /api/addresses`
**Purpose:** Create a new address for the authenticated user.  
**Access:** Private (Authenticated User)  
**Headers:** `Authorization: Bearer <token>`  
**Body (JSON):**  
```json
{
  "name": "New Address",
  "coordinates": { "lat": -1.300000, "lng": 36.800000 },
  "regions": { "country": "Kenya", "locality": "Nairobi", "administrative_area_level_1": "Nairobi County" },
  "address": "456 New Road, Nairobi, Kenya",
  "details": "Opposite the mall",
  "isDefault": false
}
```
**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Address created successfully",
  "data": {
    "address": {
      "userId": "65e26b1c09b068c201383811",
      "name": "New Address",
      "coordinates": { "lat": -1.300000, "lng": 36.800000 },
      "regions": { "country": "Kenya", "locality": "Nairobi", "administrative_area_level_1": "Nairobi County" },
      "address": "456 New Road, Nairobi, Kenya",
      "details": "Opposite the mall",
      "isDefault": false,
      "_id": "65e26b1c09b068c201383814",
      "createdAt": "2026-02-17T10:10:00.000Z",
      "updatedAt": "2026-02-17T10:10:00.000Z"
    }
  }
}
```

#### `PUT /api/addresses/:addressId`
**Purpose:** Update an existing address belonging to the authenticated user.  
**Access:** Private (Authenticated User)  
**Parameters:** `addressId` (path) - The ID of the address to update.  
**Headers:** `Authorization: Bearer <token>`  
**Body (JSON):**  
```json
{
  "name": "Updated Work Address",
  "details": "First Floor, South Wing"
}
```
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Address updated successfully",
  "data": {
    "address": {
      "_id": "65e26b1c09b068c201383813",
      "userId": "65e26b1c09b068c201383811",
      "name": "Updated Work Address",
      "coordinates": { "lat": -1.292066, "lng": 36.821946 },
      "regions": { "country": "Kenya", "locality": "Nairobi", "sublocality": "Upper Hill", "administrative_area_level_1": "Nairobi County" },
      "address": "ABC Towers, Upper Hill Road, Nairobi",
      "details": "First Floor, South Wing",
      "isDefault": false,
      "createdAt": "2026-02-17T10:05:00.000Z",
      "updatedAt": "2026-02-17T10:15:00.000Z"
    }
  }
}
```

#### `PUT /api/addresses/:addressId/default`
**Purpose:** Set a specific address as the default for the authenticated user, unsetting any previous default.  
**Access:** Private (Authenticated User)  
**Parameters:** `addressId` (path) - The ID of the address to set as default.  
**Headers:** `Authorization: Bearer <token>`  
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Default address updated successfully",
  "data": {
    "address": {
      "_id": "65e26b1c09b068c201383813",
      "userId": "65e26b1c09b068c201383811",
      "name": "My Work Address",
      "coordinates": { "lat": -1.292066, "lng": 36.821946 },
      "regions": { "country": "Kenya", "locality": "Nairobi", "sublocality": "Upper Hill", "administrative_area_level_1": "Nairobi County" },
      "address": "ABC Towers, Upper Hill Road, Nairobi",
      "details": "First Floor",
      "isDefault": true,
      "createdAt": "2026-02-17T10:05:00.000Z",
      "updatedAt": "2026-02-17T10:20:00.000Z"
    }
  }
}
```

#### `DELETE /api/addresses/:addressId`
**Purpose:** Delete an address belonging to the authenticated user.  
**Access:** Private (Authenticated User)  
**Parameters:** `addressId` (path) - The ID of the address to delete.  
**Headers:** `Authorization: Bearer <token>`  
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Address deleted successfully"
}
```

#### `GET /api/addresses/admin/all`
**Purpose:** Retrieve all addresses across all users, with powerful filtering and pagination options.  
**Access:** Private (Admin Only)  
**Headers:** `Authorization: Bearer <admin_token>`  
**Query Parameters:**  
- `page` (optional, default: 1): Page number for pagination.  
- `limit` (optional, default: 10): Number of items per page.  
- `userId` (optional): Filter addresses by a specific user ID.  
- `locality` (optional): Filter addresses by locality (case-insensitive regex).  
- `country` (optional): Filter addresses by country (case-insensitive regex).  
- `administrativeArea` (optional): Filter addresses by administrative area (case-insensitive regex).  
**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "addresses": [
      {
        "_id": "65e26b1c09b068c201383812",
        "userId": {
          "_id": "65e26b1c09b068c201383811",
          "name": "John Doe",
          "email": "john@example.com",
          "phone": "+254712345678"
        },
        "name": "My Home Address",
        "coordinates": { "lat": -1.286389, "lng": 36.817223 },
        "regions": { "country": "Kenya", "locality": "Nairobi", "sublocality": "CBD", "administrative_area_level_1": "Nairobi County" },
        "address": "123 Main Street, Nairobi, Kenya",
        "details": "Near the park entrance",
        "isDefault": false,
        "createdAt": "2026-02-17T10:00:00.000Z",
        "updatedAt": "2026-02-17T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalAddresses": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

---

## 🔐 Middleware

- `verifyBearerToken`: Used on `router.use(verifyBearerToken)` to protect all routes from unauthorized access.
- `requireAdmin`: Used on `router.get('/admin/all', requireAdmin, getAllAddresses)` to restrict access to administrators only.

---

## 📝 API Examples

### Create a New Address
```bash
curl -X POST http://localhost:5000/api/addresses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "name": "My Home Address",
    "coordinates": { "lat": -1.286389, "lng": 36.817223 },
    "regions": { "country": "Kenya", "locality": "Nairobi", "sublocality": "CBD" },
    "address": "123 Main Street, Nairobi, Kenya",
    "details": "Near the park entrance",
    "isDefault": true
  }'
```

### Get All User Addresses
```bash
curl -X GET http://localhost:5000/api/addresses \
  -H "Authorization: Bearer <access_token>"
```

### Get All Addresses (Admin Access)
```bash
curl -X GET "http://localhost:5000/api/addresses/admin/all?page=1&limit=5&country=Kenya" \
  -H "Authorization: Bearer <admin_access_token>"
```

---

## 🛡️ Security Features

-   **Authentication:** All endpoints (except public ones, if any were added) require a valid JWT via `verifyBearerToken`.
-   **Authorization:** The `GET /admin/all` endpoint is restricted to users with the 'admin' role using `requireAdmin` middleware. Individual users can only manage their own addresses, enforced by checking `userId` in queries.
-   **Data Validation:** Input data is validated to prevent malformed requests and ensure data integrity.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

-   `400 Bad Request`: Invalid input, missing required fields, or data conflicts (e.g., invalid coordinates, phone number already taken).
-   `401 Unauthorized`: Missing or invalid authentication token.
-   `403 Forbidden`: Access denied, usually due to insufficient permissions (e.g., non-admin accessing an admin endpoint).
-   `404 Not Found`: The requested address or user was not found.
-   `500 Internal Server Error`: An unexpected server-side error occurred during processing.

---

## 📊 Database Indexes

-   `userId: 1, isDefault: 1`: For efficient retrieval of a user's addresses and quickly identifying their default address.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
