# 🚚 TEO KICKS API - Delivery Management Documentation

## 📋 Table of Contents
- [Delivery Management Overview](#delivery-management-overview)
- [Delivery Model](#-delivery-model)
- [Delivery Controller](#-delivery-controller)
- [Delivery Routes](#-delivery-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Delivery Management Overview

Delivery Management pertains to the tracking and assignment of orders for physical delivery. It records details such as the assigned rider, distance, delivery fee, and current status of a delivery. While the `Delivery` model exists, dedicated API endpoints for its direct management (creation, update, retrieval) are currently integrated or abstracted within the Order management system rather than exposed through separate routes.

---

## 👤 Delivery Model

### Schema Definition
```typescript
interface IDelivery {
  _id: string;
  orderId: string; // Order ObjectId
  assignedTo: string; // User ObjectId (Rider)
  distanceKm: number;
  deliveryFee: number;
  status: "ASSIGNED" | "PICKED" | "DELIVERED";
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/deliveryModel.js`**

```javascript
import mongoose from "mongoose"


const deliverySchema = new mongoose.Schema({

    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    distanceKm: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    status: { type: String, enum: ["ASSIGNED", "PICKED", "DELIVERED"], default: "ASSIGNED" }

}, { timestamps: true })


deliverySchema.index({ orderId: 1 })
deliverySchema.index({ assignedTo: 1, status: 1 })


const Delivery = mongoose.model("Delivery", deliverySchema)


export default Delivery
```

### Validation Rules
```javascript
orderId:    { required: true, type: ObjectId, ref: 'Order' }
assignedTo: { required: true, type: ObjectId, ref: 'User' }
distanceKm: { type: Number, default: 0 }
deliveryFee: { type: Number, default: 0 }
status:     { type: String, enum: ['ASSIGNED', 'PICKED', 'DELIVERED'], default: 'ASSIGNED' }
```

---

## 🎮 Delivery Controller

### Functions Overview

#### (Not Applicable)
**Purpose:** Direct API endpoints for Delivery management are not currently exposed via a dedicated `deliveryController.js`. Delivery assignment and updates are typically handled within the context of order processing (e.g., `orderController.js`).

**Note:** Delivery records are created and managed internally when orders are assigned to riders. The `assignRider` functionality in `orderController.js` handles delivery assignment. Delivery status updates may be triggered through order status changes or rider management workflows.

---

## 🚚 Delivery Routes

### Base Path: (Not Applicable)

### Router Implementation

**File: (Not Applicable)**

### Route Details

#### (Not Applicable)
**Purpose:** There are no dedicated routes for Delivery management. Delivery-related actions are expected to be part of the `orderRoute.js` or handled internally.

---

## 🔐 Middleware

**Not Applicable:** No specific middleware explicitly for a Delivery resource. Authentication and authorization are handled at the Order level or through internal system logic.

---

## 📝 API Examples

**Not Applicable:** As there are no dedicated routes for Delivery, no direct API examples can be provided. Delivery details would typically be part of an Order response or managed internally by the system.

---

## 🛡️ Security Features

-   **Data Integrity:** Foreign key references ensure valid `orderId` and `assignedTo` (User) associations, maintaining relational integrity.
-   **Access Control:** Access to `Delivery` data is implicitly controlled through the security measures applied to the `Order` resource. Riders assigned to deliveries would have specific permissions within the broader system to update delivery statuses.

---

## 🚨 Error Handling

Errors related to `Delivery` instances would typically propagate from `Order` management or other associated processes (e.g., if an invalid `orderId` or `assignedTo` user is provided during the creation of a Delivery record within an Order flow).

---

## 📊 Database Indexes

-   `orderId: 1`: For efficient lookup of deliveries associated with a specific order.
-   `assignedTo: 1, status: 1`: For efficiently querying deliveries assigned to a particular user (e.g., a rider) and filtering by their current status.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
