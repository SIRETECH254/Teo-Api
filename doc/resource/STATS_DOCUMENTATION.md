# 📊 TEO KICKS API - Statistics & Analytics Documentation

## 📋 Table of Contents
- [Statistics Overview](#statistics-overview)
- [Stats Controller](#-stats-controller)
- [Stats Routes](#-stats-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Data Models Reference](#-data-models-reference)

---

## Statistics Overview

The Statistics & Analytics system provides comprehensive dashboard metrics and time-series analytics for the TEO KICKS API. This includes overview statistics (total products, orders, customers, revenue, etc.) and detailed analytics with time-series data for orders, revenue, payments, and customer growth. All statistics endpoints are restricted to administrators only. The analytics endpoint supports multiple time ranges (7 days, 30 days, 90 days, 12 months) for flexible reporting.

**Note:** This resource does not have a dedicated model. Statistics are computed dynamically from existing models (Order, Product, Category, Brand, User, Invoice, Payment) using aggregation pipelines and count queries.

---

## 🎮 Stats Controller

### Required Imports
```javascript
import Order from "../models/orderModel.js"
import Product from "../models/productModel.js"
import Category from "../models/categoryModel.js"
import Brand from "../models/brandModel.js"
import User from "../models/userModel.js"
import Invoice from "../models/invoiceModel.js"
import Payment from "../models/paymentModel.js"
```

### Functions Overview

#### `getOverviewStats()`
**Purpose:** Get dashboard overview statistics including totals and key metrics.  
**Access:** Private (Admin)  
**Validation:** None.  
**Process:** Executes parallel count queries and aggregations to gather statistics from multiple models.  
**Response:** Object containing overview statistics.

**Controller Implementation:**
```javascript
export const getOverviewStats = async (req, res, next) => {
  try {
    const [
      totalProducts,
      totalCategories,
      totalBrands,
      totalOrders,
      totalCustomers,
      totalPaidOrders,
      totalPendingPayments
    ] = await Promise.all([
      Product.countDocuments({}),
      Category.countDocuments({}),
      Brand.countDocuments({}),
      Order.countDocuments({}),
      User.countDocuments({}),
      Order.countDocuments({ paymentStatus: "PAID" }),
      Order.countDocuments({ paymentStatus: "PENDING" })
    ])

    // Revenue: sum of successful payments
    const revenueAgg = await Payment.aggregate([
      { $match: { status: "SUCCESS" } },
      { $group: { _id: null, amount: { $sum: "$amount" } } }
    ])

    const totalRevenue = revenueAgg[0]?.amount || 0

    // Recent orders (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentOrders = await Order.countDocuments({ createdAt: { $gte: sevenDaysAgo } })

    return res.json({
      success: true,
      data: {
        totalProducts,
        totalCategories,
        totalBrands,
        totalOrders,
        totalCustomers,
        totalRevenue,
        recentOrders,
        totalPaidOrders,
        totalPendingPayments
      }
    })
  } catch (err) {
    return next(err)
  }
}
```

**Response Schema:**
```typescript
{
  success: boolean;
  data: {
    totalProducts: number;
    totalCategories: number;
    totalBrands: number;
    totalOrders: number;
    totalCustomers: number;
    totalRevenue: number;
    recentOrders: number; // Orders in last 7 days
    totalPaidOrders: number;
    totalPendingPayments: number;
  }
}
```

#### `getAnalytics()`
**Purpose:** Get time-series analytics data for charts and detailed reporting.  
**Access:** Private (Admin)  
**Validation:** Optional `range` query parameter (7d, 30d, 90d, 12m). Defaults to 30d.  
**Process:** Executes multiple aggregation pipelines to generate time-series data for orders, revenue, payments, customers, and top products.  
**Response:** Object containing time-series data arrays and metadata.

**Controller Implementation:**
```javascript
export const getAnalytics = async (req, res, next) => {
  try {
    const {
      range = "30d" // 7d, 30d, 90d, 12m
    } = req.query || {}

    const now = new Date()
    let start
    let groupFormat
    if (range === "7d") {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      groupFormat = "%Y-%m-%d"
    } else if (range === "90d") {
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      groupFormat = "%Y-%m-%d"
    } else if (range === "12m") {
      start = new Date(now)
      start.setMonth(start.getMonth() - 12)
      groupFormat = "%Y-%m"
    } else { // default 30d
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      groupFormat = "%Y-%m-%d"
    }

    // Orders placed per period
    const ordersSeries = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: now } } },
      { $group: { _id: { $dateToString: { format: groupFormat, date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])

    // Revenue per period (by successful payments)
    const revenueSeries = await Payment.aggregate([
      { $match: { createdAt: { $gte: start, $lte: now }, status: "SUCCESS" } },
      { $group: { _id: { $dateToString: { format: groupFormat, date: "$createdAt" } }, amount: { $sum: "$amount" } } },
      { $sort: { _id: 1 } }
    ])

    // Paid orders per period (based on time they became PAID)
    const paidOrdersSeries = await Order.aggregate([
      { $match: { updatedAt: { $gte: start, $lte: now }, paymentStatus: "PAID" } },
      { $group: { _id: { $dateToString: { format: groupFormat, date: "$updatedAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])

    // Pending payment orders per period (by creation time)
    const pendingOrdersSeries = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: now }, paymentStatus: "PENDING" } },
      { $group: { _id: { $dateToString: { format: groupFormat, date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])

    // Top products by quantity in period
    const topProductsAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: now } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", qty: { $sum: "$items.quantity" } } },
      { $sort: { qty: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, productId: "$product._id", title: "$product.title", qty: 1 } }
    ])

    // Conversion: orders count vs customers created in period
    const customersSeries = await User.aggregate([
      { $match: { createdAt: { $gte: start, $lte: now } } },
      { $group: { _id: { $dateToString: { format: groupFormat, date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])

    return res.json({
      success: true,
      data: {
        meta: { start, end: now, range },
        ordersSeries,
        revenueSeries,
        paidOrdersSeries,
        pendingOrdersSeries,
        customersSeries,
        topProducts: topProductsAgg
      }
    })
  } catch (err) {
    return next(err)
  }
}
```

**Response Schema:**
```typescript
{
  success: boolean;
  data: {
    meta: {
      start: Date;
      end: Date;
      range: string; // "7d" | "30d" | "90d" | "12m"
    };
    ordersSeries: Array<{
      _id: string; // Date string in format based on range
      count: number;
    }>;
    revenueSeries: Array<{
      _id: string; // Date string in format based on range
      amount: number;
    }>;
    paidOrdersSeries: Array<{
      _id: string; // Date string in format based on range
      count: number;
    }>;
    pendingOrdersSeries: Array<{
      _id: string; // Date string in format based on range
      count: number;
    }>;
    customersSeries: Array<{
      _id: string; // Date string in format based on range
      count: number;
    }>;
    topProducts: Array<{
      productId: string;
      title: string;
      qty: number;
    }>;
  }
}
```

**Time Range Formats:**
- `7d`: Last 7 days, grouped by day (`%Y-%m-%d`)
- `30d`: Last 30 days, grouped by day (`%Y-%m-%d`) - Default
- `90d`: Last 90 days, grouped by day (`%Y-%m-%d`)
- `12m`: Last 12 months, grouped by month (`%Y-%m`)

---

## 🏷️ Stats Routes

### Base Path: `/api/stats`

### Router Implementation

**File: `../routes/statsRoute.js`**

```javascript
import express from "express"
import { authenticateToken, requireAdmin } from "../middlewares/auth.js"
import { getOverviewStats, getAnalytics } from "../controllers/statsController.js"

const router = express.Router()

// Protected admin stats
router.get('/overview', authenticateToken, requireAdmin, getOverviewStats)
router.get('/analytics', authenticateToken, requireAdmin, getAnalytics)

export default router
```

### Route Details

#### `GET /api/stats/overview`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Purpose:** Get dashboard overview statistics including totals for products, categories, brands, orders, customers, revenue, and recent activity.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with overview statistics object.

**Response Example:**
```json
{
  "success": true,
  "data": {
    "totalProducts": 150,
    "totalCategories": 12,
    "totalBrands": 8,
    "totalOrders": 342,
    "totalCustomers": 89,
    "totalRevenue": 1250000,
    "recentOrders": 23,
    "totalPaidOrders": 298,
    "totalPendingPayments": 44
  }
}
```

#### `GET /api/stats/analytics`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Query Parameters:** `range` (optional) - Time range: `7d`, `30d`, `90d`, or `12m`. Default: `30d`.  
**Purpose:** Get time-series analytics data for charts including orders, revenue, payments, customer growth, and top products.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with analytics data object.

**Response Example:**
```json
{
  "success": true,
  "data": {
    "meta": {
      "start": "2026-01-01T00:00:00.000Z",
      "end": "2026-01-31T23:59:59.999Z",
      "range": "30d"
    },
    "ordersSeries": [
      { "_id": "2026-01-01", "count": 5 },
      { "_id": "2026-01-02", "count": 8 }
    ],
    "revenueSeries": [
      { "_id": "2026-01-01", "amount": 15000 },
      { "_id": "2026-01-02", "amount": 24000 }
    ],
    "paidOrdersSeries": [
      { "_id": "2026-01-01", "count": 4 },
      { "_id": "2026-01-02", "count": 7 }
    ],
    "pendingOrdersSeries": [
      { "_id": "2026-01-01", "count": 1 },
      { "_id": "2026-01-02", "count": 1 }
    ],
    "customersSeries": [
      { "_id": "2026-01-01", "count": 2 },
      { "_id": "2026-01-02", "count": 3 }
    ],
    "topProducts": [
      {
        "productId": "507f1f77bcf86cd799439011",
        "title": "Nike Air Max",
        "qty": 45
      }
    ]
  }
}
```

---

## 🔐 Middleware

- `authenticateToken`: Used on all stats routes to verify JWT token from Authorization header and populate `req.user` with user data.
- `requireAdmin`: Used on all stats routes to restrict access to administrators only.

---

## 📝 API Examples

### Get Overview Statistics
```bash
curl -X GET http://localhost:5000/api/stats/overview \
  -H "Authorization: Bearer <admin_access_token>"
```

### Get Analytics for Last 7 Days
```bash
curl -X GET "http://localhost:5000/api/stats/analytics?range=7d" \
  -H "Authorization: Bearer <admin_access_token>"
```

### Get Analytics for Last 30 Days (Default)
```bash
curl -X GET http://localhost:5000/api/stats/analytics \
  -H "Authorization: Bearer <admin_access_token>"
```

### Get Analytics for Last 90 Days
```bash
curl -X GET "http://localhost:5000/api/stats/analytics?range=90d" \
  -H "Authorization: Bearer <admin_access_token>"
```

### Get Analytics for Last 12 Months
```bash
curl -X GET "http://localhost:5000/api/stats/analytics?range=12m" \
  -H "Authorization: Bearer <admin_access_token>"
```

---

## 🛡️ Security Features

- **Authentication:** All statistics endpoints require a valid JWT token via the `Authorization: Bearer <token>` header.
- **Authorization:** All statistics endpoints are restricted to users with admin privileges (`isAdmin: true`).
- **Data Privacy:** Statistics aggregate data from multiple models but do not expose sensitive individual user or order details.
- **Performance:** Uses MongoDB aggregation pipelines and parallel queries for efficient data retrieval.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

- `401 Unauthorized`: Missing or invalid authentication token.
- `403 Forbidden`: Access denied - non-admin attempting to access statistics.
- `500 Internal Server Error`: An unexpected server-side error occurred during data aggregation or processing.

---

## 📊 Data Models Reference

The Statistics system aggregates data from the following models:

### Order Model
- Used for: Total orders count, paid/pending orders, orders time-series, top products analysis
- Key Fields: `createdAt`, `updatedAt`, `paymentStatus`, `items[]`

### Payment Model
- Used for: Total revenue calculation, revenue time-series
- Key Fields: `createdAt`, `status`, `amount`

### Product Model
- Used for: Total products count
- Key Fields: `_id`, `title`

### Category Model
- Used for: Total categories count
- Key Fields: `_id`

### Brand Model
- Used for: Total brands count
- Key Fields: `_id`

### User Model
- Used for: Total customers count, customer growth time-series
- Key Fields: `createdAt`

### Invoice Model
- Imported but not currently used in statistics calculations

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
