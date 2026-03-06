# 🏪 TEO KICKS API - Store Configuration Documentation

## 📋 Table of Contents
- [Store Configuration Overview](#store-configuration-overview)
- [Store Config Model](#-store-config-model)
- [Store Config Controller](#-store-config-controller)
- [Store Config Routes](#-store-config-routes)
- [Initialization Script](#initialization-script)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Store Configuration Overview

Store Configuration manages the global settings for the TEO KICKS store. This includes store information (name, email, phone, address), business hours, payment methods configuration, shipping settings, and notification preferences. The system enforces a single store configuration instance - only one configuration can exist at a time. Store configuration is publicly readable but can only be modified by administrators. **Important: Store configuration cannot be deleted once created.** This ensures system stability and prevents accidental loss of critical store settings. Use the update endpoint to modify the configuration instead.

---

## 👤 Store Config Model

### Schema Definition
```typescript
interface IStoreConfig {
  _id: string;
  storeName: string;
  storeEmail: string;
  storePhone: string;
  storeAddress: {
    street: string;
    city: string;
    country: string;
    postalCode: string;
  };
  businessHours: Array<{
    day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
    open: string; // Format: "HH:mm"
    close: string; // Format: "HH:mm"
    isOpen: boolean;
  }>;
  paymentMethods: {
    mpesa: {
      enabled: boolean;
      shortcode?: string;
    };
    card: {
      enabled: boolean;
      paystackKey?: string;
    };
    cash: {
      enabled: boolean;
      description?: string;
    };
  };
  shippingSettings: {
    freeShippingThreshold: number;
    baseDeliveryFee: number;
    feePerKm: number;
  };
  notificationSettings: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    orderConfirmations: boolean;
    stockAlerts: boolean;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/storeConfigModel.js`**

```javascript
import mongoose from 'mongoose'

const businessHoursSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  open: {
    type: String,
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    required: function() { return this.isOpen }
  },
  close: {
    type: String,
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
    required: function() { return this.isOpen }
  },
  isOpen: {
    type: Boolean,
    default: true
  }
}, { _id: false })

const addressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  country: { type: String, required: true },
  postalCode: { type: String, required: true }
}, { _id: false })

const paymentMethodsSchema = new mongoose.Schema({
  mpesa: {
    enabled: { type: Boolean, default: false },
    shortcode: { type: String, required: function() { return this.enabled } }
  },
  card: {
    enabled: { type: Boolean, default: false },
    paystackKey: { type: String, required: function() { return this.enabled } }
  },
  cash: {
    enabled: { type: Boolean, default: false },
    description: { type: String, default: 'Pay on delivery' }
  }
}, { _id: false })

const shippingSettingsSchema = new mongoose.Schema({
  freeShippingThreshold: { type: Number, default: 0 },
  baseDeliveryFee: { type: Number, default: 0 },
  feePerKm: { type: Number, default: 0 }
}, { _id: false })

const notificationSettingsSchema = new mongoose.Schema({
  emailNotifications: { type: Boolean, default: true },
  smsNotifications: { type: Boolean, default: true },
  orderConfirmations: { type: Boolean, default: true },
  stockAlerts: { type: Boolean, default: true }
}, { _id: false })

const storeConfigSchema = new mongoose.Schema({
  // Basic Store Information
  storeName: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  storeEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  storePhone: {
    type: String,
    required: true,
    trim: true
  },
  storeAddress: addressSchema,

  // Business Hours
  businessHours: [businessHoursSchema],

  // Payment Methods
  paymentMethods: paymentMethodsSchema,

  // Shipping Settings
  shippingSettings: shippingSettingsSchema,

  // Notification Settings
  notificationSettings: notificationSettingsSchema,

  // Store Status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

// Ensure only one store configuration can exist
storeConfigSchema.pre('save', async function(next) {
  if (this.isNew) {
    const existingConfig = await this.constructor.findOne()
    if (existingConfig) {
      const error = new Error('Store configuration already exists. Only one configuration is allowed.')
      error.statusCode = 400
      return next(error)
    }
  }
  next()
})

// Update the updatedAt field on save
storeConfigSchema.pre('save', function(next) {
  this.updatedAt = Date.now()
  next()
})

const StoreConfig = mongoose.model('StoreConfig', storeConfigSchema)

export default StoreConfig
```

### Validation Rules
```javascript
storeName:              { required: true, type: String, trim: true, maxLength: 100 }
storeEmail:             { required: true, type: String, trim: true, lowercase: true, email format }
storePhone:             { required: true, type: String, trim: true }
storeAddress:           { required: true, type: Object with street, city, country, postalCode }
businessHours:          { type: Array, each item has day, open, close, isOpen }
businessHours[].day:    { required: true, enum: ['monday'...'sunday'] }
businessHours[].open:    { required if isOpen, format: "HH:mm" }
businessHours[].close:  { required if isOpen, format: "HH:mm" }
businessHours[].isOpen: { type: Boolean, default: true }
paymentMethods:         { type: Object with mpesa, card, cash }
paymentMethods.mpesa.shortcode: { required if mpesa.enabled }
paymentMethods.card.paystackKey: { required if card.enabled }
shippingSettings:       { type: Object with freeShippingThreshold, baseDeliveryFee, feePerKm }
notificationSettings:   { type: Object with emailNotifications, smsNotifications, orderConfirmations, stockAlerts }
isActive:               { type: Boolean, default: true }
```

### Pre-Save Hooks

#### Single Configuration Enforcement
**Purpose:** Ensures only one store configuration exists in the database.  
**Process:** Before saving a new configuration, checks if any existing configuration exists. If found, prevents creation and returns an error.  
**Error:** Returns `400 Bad Request` with message "Store configuration already exists. Only one configuration is allowed."

---

## 🎮 Store Config Controller

### Required Imports
```javascript
import StoreConfig from '../models/storeConfigModel.js'
import { errorHandler } from '../utils/error.js'
```

### Functions Overview

#### `getStoreConfig()`
**Purpose:** Get the current store configuration.  
**Access:** Public  
**Validation:** None.  
**Process:** Finds the single store configuration document. Returns `null` if no configuration exists.  
**Response:** The store configuration object or `null`.

**Controller Implementation:**
```javascript
export const getStoreConfig = async (req, res, next) => {
  try {
    const config = await StoreConfig.findOne()

    res.status(200).json({
      success: true,
      data: {
        config: config || null
      }
    })
  } catch (error) {
    console.error('Get store config error:', error)
    next(errorHandler(500, 'Failed to fetch store configuration'))
  }
}
```

#### `createStoreConfig()`
**Purpose:** Create a new store configuration.  
**Access:** Private (Admin only)  
**Validation:** Validates all required fields. Checks if configuration already exists.  
**Process:** Creates a new store configuration document.  
**Response:** The newly created configuration object.

**Controller Implementation:**
```javascript
export const createStoreConfig = async (req, res, next) => {
  try {
    // Check if configuration already exists
    const existingConfig = await StoreConfig.findOne()

    if (existingConfig) {
      return next(errorHandler(400, 'Store configuration already exists. Use PUT to update instead.'))
    }

    // Create new configuration
    const config = new StoreConfig(req.body)
    await config.save()

    res.status(201).json({
      success: true,
      message: 'Store configuration created successfully',
      data: {
        config
      }
    })
  } catch (error) {
    console.error('Create store config error:', error)

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message)
      return next(errorHandler(400, `Validation Error: ${errors.join(', ')}`))
    }

    if (error.statusCode === 400) {
      return next(error)
    }

    next(errorHandler(500, 'Failed to create store configuration'))
  }
}
```

#### `updateStoreConfig()`
**Purpose:** Update the existing store configuration.  
**Access:** Private (Admin only)  
**Validation:** Validates updated fields. Requires existing configuration.  
**Process:** Finds the existing configuration and updates it with new values.  
**Response:** The updated configuration object.

**Controller Implementation:**
```javascript
export const updateStoreConfig = async (req, res, next) => {
  try {
    // Find existing configuration
    const config = await StoreConfig.findOne()

    if (!config) {
      return next(errorHandler(404, 'Store configuration not found. Use POST to create first.'))
    }

    // Update configuration
    Object.assign(config, req.body)
    await config.save()

    res.status(200).json({
      success: true,
      message: 'Store configuration updated successfully',
      data: {
        config
      }
    })
  } catch (error) {
    console.error('Update store config error:', error)

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message)
      return next(errorHandler(400, `Validation Error: ${errors.join(', ')}`))
    }

    next(errorHandler(500, 'Failed to update store configuration'))
  }
}
```

#### `initStoreConfig()`
**Purpose:** Initialize default store configuration with predefined values.  
**Access:** Private (Admin only)  
**Validation:** Checks if configuration already exists.  
**Process:** Creates a default configuration with sample values for development/setup purposes.  
**Response:** The created or existing configuration object.

**Controller Implementation:**
```javascript
export const initStoreConfig = async (req, res, next) => {
  try {
    // Check if configuration already exists
    const existingConfig = await StoreConfig.findOne()

    if (existingConfig) {
      return res.status(200).json({
        success: true,
        message: 'Store configuration already exists',
        data: {
          config: existingConfig
        }
      })
    }

    // Create default configuration
    const defaultConfig = {
      storeName: 'TEO KICKS Store',
      storeEmail: 'support@teokicks.com',
      storePhone: '+254700000000',
      storeAddress: {
        street: '123 Main Street',
        city: 'Nairobi',
        country: 'Kenya',
        postalCode: '00100'
      },
      businessHours: [
        { day: 'monday', open: '09:00', close: '18:00', isOpen: true },
        { day: 'tuesday', open: '09:00', close: '18:00', isOpen: true },
        { day: 'wednesday', open: '09:00', close: '18:00', isOpen: true },
        { day: 'thursday', open: '09:00', close: '18:00', isOpen: true },
        { day: 'friday', open: '09:00', close: '18:00', isOpen: true },
        { day: 'saturday', open: '10:00', close: '16:00', isOpen: true },
        { day: 'sunday', open: null, close: null, isOpen: false }
      ],
      paymentMethods: {
        mpesa: { enabled: true, shortcode: '123456' },
        card: { enabled: true, paystackKey: 'pk_test_xxx' },
        cash: { enabled: true, description: 'Pay on delivery' }
      },
      shippingSettings: {
        freeShippingThreshold: 5000,
        baseDeliveryFee: 200,
        feePerKm: 50
      },
      notificationSettings: {
        emailNotifications: true,
        smsNotifications: true,
        orderConfirmations: true,
        stockAlerts: true
      },
      isActive: true
    }

    const config = new StoreConfig(defaultConfig)
    await config.save()

    res.status(201).json({
      success: true,
      message: 'Default store configuration created successfully',
      data: {
        config
      }
    })
  } catch (error) {
    console.error('Init store config error:', error)
    next(errorHandler(500, 'Failed to initialize store configuration'))
  }
}
```

#### `getStoreConfigStatus()`
**Purpose:** Check if store configuration exists and get basic status.  
**Access:** Public  
**Validation:** None.  
**Process:** Finds the configuration and returns existence status with minimal data.  
**Response:** Object with `exists` boolean and minimal config data.

**Controller Implementation:**
```javascript
export const getStoreConfigStatus = async (req, res, next) => {
  try {
    const config = await StoreConfig.findOne().select('_id storeName isActive')

    res.status(200).json({
      success: true,
      data: {
        exists: !!config,
        config: config || null
      }
    })
  } catch (error) {
    console.error('Get store config status error:', error)
    next(errorHandler(500, 'Failed to check store configuration status'))
  }
}
```

---

## 🏷️ Store Config Routes

### Base Path: `/api/store-config`

### Router Implementation

**File: `../routes/storeConfigRoute.js`**

```javascript
import express from 'express'
import {
  getStoreConfig,
  createStoreConfig,
  updateStoreConfig,
  initStoreConfig,
  getStoreConfigStatus
} from '../controllers/storeConfigController.js'
import { verifyBearerToken, requireAdmin } from '../utils/verify.js'

const router = express.Router()

// Public routes
router.get('/', getStoreConfig)
router.get('/status', getStoreConfigStatus)

// Protected routes (require authentication and admin)
router.post('/', verifyBearerToken, requireAdmin, createStoreConfig)
router.put('/', verifyBearerToken, requireAdmin, updateStoreConfig)
router.post('/init', verifyBearerToken, requireAdmin, initStoreConfig)

export default router
```

### Route Details

#### `GET /api/store-config`
**Headers:** (Optional)  
**Purpose:** Retrieve the current store configuration.  
**Access:** Public  
**Response:** `200 OK` with the store configuration object or `null` if not configured.

#### `GET /api/store-config/status`
**Headers:** (Optional)  
**Purpose:** Check if store configuration exists and get basic status information.  
**Access:** Public  
**Response:** `200 OK` with existence status and minimal config data.

#### `POST /api/store-config`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Body (JSON):**  
```json
{
  "storeName": "TEO KICKS Store",
  "storeEmail": "support@teokicks.com",
  "storePhone": "+254700000000",
  "storeAddress": {
    "street": "123 Main Street",
    "city": "Nairobi",
    "country": "Kenya",
    "postalCode": "00100"
  },
  "businessHours": [
    {
      "day": "monday",
      "open": "09:00",
      "close": "18:00",
      "isOpen": true
    }
  ],
  "paymentMethods": {
    "mpesa": {
      "enabled": true,
      "shortcode": "123456"
    },
    "card": {
      "enabled": true,
      "paystackKey": "pk_test_xxx"
    },
    "cash": {
      "enabled": true,
      "description": "Pay on delivery"
    }
  },
  "shippingSettings": {
    "freeShippingThreshold": 5000,
    "baseDeliveryFee": 200,
    "feePerKm": 50
  },
  "notificationSettings": {
    "emailNotifications": true,
    "smsNotifications": true,
    "orderConfirmations": true,
    "stockAlerts": true
  },
  "isActive": true
}
```
**Purpose:** Create a new store configuration.  
**Access:** Private (Admin Only)  
**Response:** `201 Created` with the newly created configuration, or `400 Bad Request` if configuration already exists.

#### `PUT /api/store-config`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Body (JSON):** (partial update allowed)  
```json
{
  "storeName": "Updated Store Name",
  "isActive": false
}
```
**Purpose:** Update the existing store configuration.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with the updated configuration, or `404 Not Found` if configuration doesn't exist.

#### `POST /api/store-config/init`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Purpose:** Initialize default store configuration with predefined values.  
**Access:** Private (Admin Only)  
**Response:** `201 Created` with the default configuration, or `200 OK` if configuration already exists.

---

## 🚀 Initialization Script

### Overview

A standalone script is provided to initialize the default store configuration. This script can be run independently to set up the store configuration without using the API endpoints.

### Script Location

**File:** `server/script/storeScript.js`

### Usage

Run the script using Node.js:

```bash
node server/script/storeScript.js
```

Or using npm script (if configured):

```bash
npm run setup:store
```

### What It Does

1. Connects to MongoDB using the `MONGO_URI` environment variable
2. Checks if a store configuration already exists
3. If no configuration exists, creates a default configuration with:
   - Store name: "TEO KICKS Store"
   - Store email: "support@teokicks.com"
   - Store phone: "+254700000000"
   - Default address in Nairobi, Kenya
   - Business hours (Mon-Fri 9-6, Sat 10-4, Sun closed)
   - Payment methods (MPesa, Card, Cash)
   - Default shipping and notification settings
4. If configuration already exists, displays the existing configuration details
5. Exits with appropriate status codes (0 for success, 1 for failure)

### Script Implementation

```javascript
import mongoose from "mongoose"
import StoreConfig from "../models/storeConfigModel.js"
import "dotenv/config"

const setupStoreConfig = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI)
    console.log("Connected to database")

    // Check if store configuration already exists
    const existingConfig = await StoreConfig.findOne()

    if (existingConfig) {
      console.log("Store configuration already exists")
      console.log(`Store Name: ${existingConfig.storeName}`)
      // ... display existing config details
      process.exit(0)
    }

    // Create default configuration
    const defaultConfig = {
      // ... default configuration values
    }

    const config = await StoreConfig.create(defaultConfig)
    console.log("Store configuration created successfully!")
    // ... display created config details
    process.exit(0)
  } catch (error) {
    console.error("Setup failed:", error)
    process.exit(1)
  }
}

setupStoreConfig()
```

### Prerequisites

- MongoDB connection string must be set in `.env` file as `MONGO_URI`
- Database must be accessible
- Node.js environment must be set up

### Output

**On Success:**
```
Connected to database
Store configuration created successfully!

Default configuration:
Store Name: TEO KICKS Store
Store Email: support@teokicks.com
Store Phone: +254700000000
Is Active: true

Note: Store configuration cannot be deleted. Use PUT /api/store-config to update it.
```

**If Configuration Exists:**
```
Connected to database
Store configuration already exists

Existing configuration:
Store Name: TEO KICKS Store
Store Email: support@teokicks.com
Store Phone: +254700000000
Is Active: true
```

### Error Handling

The script handles errors gracefully:
- Database connection failures
- Validation errors
- Duplicate configuration attempts (handled by model pre-save hook)

---

## 🔐 Middleware

- `verifyBearerToken`: Used on protected routes to verify JWT token from Authorization header and populate `req.user` with user data.
- `requireAdmin`: Used on all modification routes to restrict access to administrators only.

---

## 📝 API Examples

### Get Store Configuration
```bash
curl -X GET http://localhost:5000/api/store-config
```

### Check Configuration Status
```bash
curl -X GET http://localhost:5000/api/store-config/status
```

### Create Store Configuration
```bash
curl -X POST http://localhost:5000/api/store-config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_access_token>" \
  -d '{
    "storeName": "TEO KICKS Store",
    "storeEmail": "support@teokicks.com",
    "storePhone": "+254700000000",
    "storeAddress": {
      "street": "123 Main Street",
      "city": "Nairobi",
      "country": "Kenya",
      "postalCode": "00100"
    },
    "businessHours": [
      {
        "day": "monday",
        "open": "09:00",
        "close": "18:00",
        "isOpen": true
      }
    ],
    "paymentMethods": {
      "mpesa": {
        "enabled": true,
        "shortcode": "123456"
      }
    },
    "shippingSettings": {
      "freeShippingThreshold": 5000,
      "baseDeliveryFee": 200,
      "feePerKm": 50
    },
    "isActive": true
  }'
```

### Initialize Default Configuration
```bash
curl -X POST http://localhost:5000/api/store-config/init \
  -H "Authorization: Bearer <admin_access_token>"
```

### Update Store Configuration
```bash
curl -X PUT http://localhost:5000/api/store-config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_access_token>" \
  -d '{
    "storeName": "Updated Store Name",
    "isActive": false
  }'
```

---

## 🛡️ Security Features

- **Public Read Access:** Store configuration can be read by anyone (no authentication required) to allow frontend applications to display store information.
- **Admin-Only Write Access:** All modification operations (create, update, init) require admin authentication and authorization.
- **Non-Deletable Configuration:** Store configuration cannot be deleted once created. This ensures system stability and prevents accidental loss of critical store settings. Use the update endpoint to modify the configuration instead.
- **Single Configuration Enforcement:** The system prevents multiple configurations from being created through a pre-save hook, ensuring data consistency.
- **Validation:** All input data is validated according to schema rules, including email format, time format for business hours, and required fields for enabled payment methods.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

- `400 Bad Request`: Invalid input, missing required fields, validation errors, or configuration already exists (on create).
- `401 Unauthorized`: Missing or invalid authentication token.
- `403 Forbidden`: Access denied - non-admin attempting an admin operation.
- `404 Not Found`: Store configuration not found (on update when no config exists).
- `500 Internal Server Error`: An unexpected server-side error occurred during processing.

**Note:** Store configuration deletion is not supported. If you need to reset the configuration, use the update endpoint to modify all fields.

---

## 📊 Database Indexes

The Store Config model does not define explicit indexes beyond the default `_id` index. Since only one configuration exists at a time, additional indexes are not necessary for query performance.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
