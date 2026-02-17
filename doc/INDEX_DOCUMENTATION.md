# 🚀 TEO KICKS API - `index.js` Documentation

## 📋 Table of Contents
- [Overview](#overview)
- [Core Dependencies and Imports](#core-dependencies-and-imports)
- [Application Setup (Express & Core Middleware)](#application-setup-express--core-middleware)
  - [CORS Configuration](#cors-configuration)
  - [Body Parsing](#body-parsing)
- [Database Connection](#database-connection)
- [Static File Serving](#static-file-serving)
- [Health Checks & Debug Endpoints](#health-checks--debug-endpoints)
- [Swagger Documentation Setup](#swagger-documentation-setup)
- [Route Registrations](#route-registrations)
- [Real-time Features (Socket.io)](#real-time-features-socketio)
- [Global Error Handling](#global-error-handling)
- [Server Start-up](#server-start-up)
- [Key Environment Variables](#key-environment-variables)

---

## Overview

`index.js` is the main entry point for the TEO KICKS API application. It is responsible for setting up the Express server, configuring middleware, establishing the database connection, registering all API routes, initializing real-time communication (Socket.io), and starting the server. This file essentially orchestrates all the different components of the backend.

---

## Core Dependencies and Imports

The file begins by importing essential modules and routes from various parts of the project, laying the foundation for the application's functionality.

```javascript
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import "dotenv/config"; // Loads environment variables
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import swaggerConfig from "./config/swagger.js";
// Import all route modules
import authRoutes from "./routes/authRoute.js";
import roleRoutes from "./routes/roleRoute.js";
import userRoutes from "./routes/userRoute.js";
import addressRoutes from "./routes/addressRoute.js";
import brandRoutes from "./routes/brandRoute.js";
import cartRoutes from "./routes/cartRoute.js";
import categoryRoutes from "./routes/categoryRoute.js";
import collectionRoutes from "./routes/collectionRoute.js";
import couponRoutes from "./routes/couponRoute.js";
import invoiceRoutes from "./routes/invoiceRoute.js";
import orderRoutes from "./routes/orderRoute.js";
import packagingRoutes from "./routes/packagingRoute.js";
import paymentRoutes from "./routes/paymentRoute.js";
import productRoutes from "./routes/productRoute.js";
import receiptRoutes from "./routes/receiptRoute.js";
import reviewRoutes from "./routes/reviewRoute.js";
import statsRoutes from "./routes/statsRoute.js";
import storeConfigRoutes from "./routes/storeConfigRoute.js";
import tagRoutes from "./routes/tagRoute.js";
import variantRoutes from "./routes/variantRoute.js";
```

---

## Application Setup (Express & Core Middleware)

The Express application is initialized, and core middleware are configured to handle cross-origin requests, parse request bodies, and manage basic server settings.

```javascript
const app = express();
const PORT = process.env.PORT || 4500;
```

### CORS Configuration

CORS (Cross-Origin Resource Sharing) is configured to allow requests only from a predefined list of origins, enhancing security by preventing unauthorized domains from accessing the API.

```javascript
// CORS Configuration with explicit origins
const allowedOrigins = [
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:8083",
  "http://localhost:8084",
  "http://localhost:5173",
  "http://localhost:4500",
  "https://teo-kicks-api.onrender.com", // Assuming new deployment URL
  "https://teo-kicks-admin.onrender.com" // Assuming new deployment URL
];

// Add CALLBACK_URL if it exists
if (process.env.CALLBACK_URL) {
  allowedOrigins.push(process.env.CALLBACK_URL);
}

// CORS middleware configuration
app.use(
  cors({
    origin: (
      origin,
      callback
    ) => {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS blocked request from origin: \${origin}`);
        callback(new Error("Not allowed by CORS: Origin not in whitelist"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.options("*", cors()); // Enable pre-flight across all routes
```

### Body Parsing

Middleware to parse incoming request bodies into a usable format (JSON and URL-encoded).

```javascript
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
```

---

## Database Connection

The application connects to a MongoDB database using Mongoose. The connection URI is fetched from environment variables.

```javascript
// DB CONNECTION
mongoose
.connect(process.env.MONGO_URI)
.then(() => console.log("DB CONNECTED"))
.catch((err) => console.log("DB Connection Error:", err.message));
```

---

## Static File Serving

Configures Express to serve static files from the `uploads` directory under the `/uploads` URL path, primarily used for accessing uploaded user avatars or other media.

```javascript
// Static file serving for uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
```

---

## Health Checks & Debug Endpoints

Two utility endpoints are provided for monitoring and troubleshooting:

-   `/api/health`: A simple endpoint to check if the API server is operational.
-   `/api/debug/cors`: An endpoint to inspect CORS configuration and incoming request origins, useful for debugging CORS-related issues.

```javascript
// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "OK",
    message: "TEO KICKS API Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0"
  });
});

// CORS debug endpoint (helpful for troubleshooting)
app.get("/api/debug/cors", (req, res) => {
  res.json({
    allowedOrigins,
    requestOrigin: req.get("origin") || "No origin header",
    corsEnabled: true,
    environmentVariable: process.env.CORS_ORIGIN ? "Set" : "Not Set",
    timestamp: new Date().toISOString()
  });
});
```

---

## Swagger Documentation Setup

Integrates Swagger UI to serve interactive API documentation, accessible at `/api/docs`.

```javascript
// Swagger Documentation
app.use(
  "/api/docs",
  swaggerConfig.swaggerUi.serve,
  swaggerConfig.swaggerUi.setup(swaggerConfig.specs, swaggerConfig.options)
);
```

---

## Route Registrations

All modular API routes (defined in `server/routes/*.js` files) are registered with the Express application under their respective base paths.

```javascript
app.use("/api/auth", authRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/collections", collectionRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/packaging", packagingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/products", productRoutes);
app.use("/api/receipts", receiptRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/store-config", storeConfigRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/variants", variantRoutes);
```

---

## Real-time Features (Socket.io)

Socket.io is integrated to enable real-time, bidirectional communication between clients and the server, used for features like live notifications.

```javascript
// Socket.io setup for real-time features
// Create HTTP server that wraps the Express app
const server = createServer(app);

// Attach Socket.io to the HTTP server
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  }
});

// Store socket connections for real-time notifications
const socketConnections = new Map();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Listen for user authentication to map socket to user
  socket.on("authenticate", (userId) => {
    socketConnections.set(userId, socket.id);
    socket.join(`user_\${userId}`);
    console.log(`User \${userId} connected with socket \${socket.id}`);
  });

  socket.on("disconnect", () => {
    // Remove from connections
    for (const [key, value] of socketConnections.entries()) {
      if (value === socket.id) {
        socketConnections.delete(key);
        break;
      }
    }
    console.log("Client disconnected:", socket.id);
  });
});

app.set("io", io); // Make Socket.io instance accessible via app.get('io')
app.set("socketConnections", socketConnections); // Store active socket connections
```

---

## Global Error Handling

A comprehensive global error handling middleware is implemented to catch and process any errors that occur during request processing. This ensures consistent error responses and prevents the application from crashing due to unhandled exceptions.

```javascript
// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl
  });
});

// Global error handler (catches errors passed via next(err))
app.use(
  (err, _req, res, _next) => {
    console.error(err.stack);

    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV === "development" && {
        error: err.message,
        stack: err.stack
      })
    });
  }
);
```

---

## Server Start-up

The HTTP server (which wraps the Express app) is started on the configured port. This allows both standard HTTP requests and WebSocket connections (for Socket.io) to be handled by the same server instance.

```javascript
// Start server
server.listen(PORT, (err) => {
  if (!err) {
    console.log(`🚀 TEO KICKS API Server running on http://localhost:\${PORT}`);
    console.log(`📚 API Documentation: http://localhost:\${PORT}/api/docs`);
    console.log(`🌍 Environment: \${process.env.NODE_ENV || "development"}`);
    console.log(`🔒 CORS Origins: \${allowedOrigins.join(", ")}`);
    console.log("🔌 Socket.io enabled for real-time features");
  } else {
    console.error("Failed to start server:", err);
  }
});
```

---

## Key Environment Variables

`index.js` relies on several environment variables for its operation:

-   `PORT`: The port number on which the server will listen (defaults to 4500).
-   `MONGO_URI`: The connection string for the MongoDB database (e.g., `mongodb://localhost:27017/teokicks`).
-   `NODE_ENV`: The current environment (e.g., `development`, `production`); affects error logging.
-   `CALLBACK_URL`: (Optional) Additional origin allowed for CORS, typically for webhook callbacks.
-   `JWT_SECRET`: Secret key for signing JWTs.
-   `JWT_EXPIRES_IN`: Expiration time for JWTs (e.g., `1d`).
-   `JWT_REFRESH_SECRET`: Secret key for signing refresh tokens.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
