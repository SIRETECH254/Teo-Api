# 📍 TEO KICKS API - Location & Places Documentation

## 📋 Table of Contents
- [Location Services Overview](#location-services-overview)
- [Location Controller](#-location-controller)
- [Location Routes](#-location-routes)
- [API Examples](#-api-examples)
- [Error Handling](#-error-handling)

---

## Location Services Overview

Location Services in the TEO KICKS API provide integration with the Google Maps Platform, specifically the Google Places API. This allows the application to perform geographical searches and retrieve location data, which can be used for address validation, store discovery, or delivery point selection.

---

## 🎮 Location Controller

### Required Imports
```javascript
import { Client } from "@googlemaps/google-maps-services-js";
import { errorHandler } from "../utils/error.js";
```

### Functions Overview

#### `searchLocation()`
**Purpose:** Search for locations and places using a text query  
**Access:** Public (or as configured in routes)  
**Validation:** `query` parameter is required  
**Process:** 
1. Extracts `query` from request query parameters.
2. Calls Google Maps `textSearch` API.
3. Uses `GOOGLE_PLACES_API_KEY` from environment variables.
**Response:** Array of location results from Google Places.

**Controller Implementation:**
```javascript
export const searchLocation = async (req, res, next) => {
  const { query } = req.query;

  if (!query) {
    return next(errorHandler(400, "Query parameter is required"));
  }

  try {
    const response = await client.textSearch({
      params: {
        query: query,
        key: process.env.GOOGLE_PLACES_API_KEY || 'YOUR_API_KEY_HERE',
      },
      timeout: 1000,
    });

    res.status(200).json(response.data.results);
  } catch (error) {
    console.error(error.response?.data || error.message);
    next(errorHandler(500, "Failed to fetch location data"));
  }
};
```

---

## 🧾 Location Routes

### Base Path: `/api/locations`

```typescript
GET    /search                   // Search for locations via query string
```

### Router Implementation

**File: `../routes/locationRoute.js`**

```javascript
import express from "express";
import { searchLocation } from "../controllers/locationController.js";

const router = express.Router();

router.get("/search", searchLocation);

export default router;
```

### Route Details

#### `GET /api/locations/search`
**Query Parameters:** `query` (required)
**Headers:** None (Public)
**Response:**
```json
[
  {
    "formatted_address": "London, UK",
    "geometry": {
      "location": {
        "lat": 51.5072178,
        "lng": -0.1275862
      },
      "viewport": {
        "northeast": {
          "lat": 51.6723432,
          "lng": 0.148271
        },
        "southwest": {
          "lat": 51.38494009999999,
          "lng": -0.3514683
        }
      }
    },
    "icon": "https://maps.gstatic.com/mapfiles/place_api/icons/v1/png_71/geocode-71.png",
    "name": "London",
    "place_id": "ChIJdd4hrwug2EcRmSrRfBYy6o0",
    "reference": "ChIJdd4hrwug2EcRmSrRfBYy6o0",
    "types": ["locality", "political"]
  }
]
```

---

## 📝 API Examples

### Search for a Location
```bash
curl -X GET "http://localhost:5000/api/locations/search?query=pizza+in+london"
```

**Successful Response (JSON):**
```json
[
  {
    "formatted_address": "London, UK",
    "geometry": {
      "location": {
        "lat": 51.5072178,
        "lng": -0.1275862
      },
      "viewport": {
        "northeast": {
          "lat": 51.6723432,
          "lng": 0.148271
        },
        "southwest": {
          "lat": 51.38494009999999,
          "lng": -0.3514683
        }
      }
    },
    "icon": "https://maps.gstatic.com/mapfiles/place_api/icons/v1/png_71/geocode-71.png",
    "name": "London",
    "place_id": "ChIJdd4hrwug2EcRmSrRfBYy6o0",
    "reference": "ChIJdd4hrwug2EcRmSrRfBYy6o0",
    "types": ["locality", "political"]
  }
]
```

---

## 🚨 Error Handling

The API uses a centralized error handler. Common responses for this module include:

- **400 Bad Request:** Returned if the `query` parameter is missing.
  ```json
  {
    "success": false,
    "message": "Query parameter is required"
  }
  ```
- **500 Internal Server Error:** Returned if the Google Maps API request fails or if there is a timeout.
  ```json
  {
    "success": false,
    "message": "Failed to fetch location data"
  }
  ```

---

## ⚙️ Configuration

The following environment variable is required in your `.env` file:
- `GOOGLE_PLACES_API_KEY`: Your valid Google Maps API Key with the Places API enabled.

---

**Last Updated:** April 2026  
**Version:** 1.0.0
