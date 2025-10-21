### Backend Specification (Node.js / Express / MongoDB)

This document describes the backend architecture, environment, models, controllers, routes, and APIs that power the store.

---

## Tech & Structure

- **Stack**: Node.js, Express, MongoDB (Mongoose)
- **Patterns**: MVC + services; REST APIs; webhooks for payments; background jobs for notifications
- **Recommended folders**

    - `config/` (env, db)
    - `models/`
    - `controllers/`
    - `routes/`
    - `services/` (business logic: payments, notifications, search, inventory)
    - `middlewares/` (auth, rbac, validators, rate‑limit)
    - `utils/` (helpers, error handling)
    - `jobs/` and `queues/` (BullMQ + Redis)
    - `webhooks/` (M‑Pesa, Paystack)
    - `uploads/` (if storing locally; prefer S3/Cloudinary)
    - `docs/` (OpenAPI/Swagger)

---

## Environment Variables (.env)

### Core Application
- `NODE_ENV` - Environment (development|production|test)
- `PORT` - Server port number
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT token signing
- `JWT_EXPIRES_IN` - JWT token expiration time
- `OTP_EXP_MINUTES` - OTP expiration time in minutes

### Email Configuration
- `SMTP_HOST` - SMTP server hostname
- `SMTP_PORT` - SMTP server port
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password

### SMS Configuration
- `SMS_PROVIDER` - SMS provider (e.g., "twilio" or "africastalking")
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio authentication token
- `TWILIO_FROM` - Twilio phone number
- `AT_API_KEY` - Africa's Talking API key
- `AT_USERNAME` - Africa's Talking username

### Payment Providers
- `DARaja_CONSUMER_KEY` - M-Pesa Daraja consumer key
- `DARaja_CONSUMER_SECRET` - M-Pesa Daraja consumer secret
- `DARaja_PASSKEY` - M-Pesa Daraja passkey
- `DARaja_SHORTCODE` - M-Pesa short code
- `DARaja_ENV` - M-Pesa environment (sandbox|production)
- `PAYSTACK_SECRET_KEY` - Paystack secret key
- `PAYSTACK_PUBLIC_KEY` - Paystack public key

### Application URLs
- `CLIENT_BASE_URL` - Client application base URL
- `ADMIN_BASE_URL` - Admin application base URL

### External Services
- `REDIS_URL` - Redis connection URL for caching and queues
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret

### Currency
- `DEFAULT_CURRENCY` - Store currency (KES - Kenyan Shilling)

### Firebase Configuration
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_PRIVATE_KEY` - Firebase private key
- `FIREBASE_CLIENT_EMAIL` - Firebase client email
- `FIREBASE_DATABASE_URL` - Firebase database URL

### OAuth Providers
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `APPLE_CLIENT_ID` - Apple OAuth client ID
- `APPLE_TEAM_ID` - Apple team ID
- `APPLE_KEY_ID` - Apple key ID
- `APPLE_PRIVATE_KEY` - Apple private key
- `INSTAGRAM_CLIENT_ID` - Instagram OAuth client ID
- `INSTAGRAM_CLIENT_SECRET` - Instagram OAuth client secret
- `INSTAGRAM_REDIRECT_URI` - Instagram OAuth redirect URI

---

## Packages

### Core Framework & Database
- `express`: Web application framework for Node.js
- `mongoose`: MongoDB object modeling for Node.js
- `cors`: Cross-Origin Resource Sharing middleware
- `dotenv`: Environment variables loader

### Authentication & Security
- `jsonwebtoken`: JSON Web Token implementation
- `bcryptjs`: Password hashing library
- `validator`: String validation and sanitization library

### File Uploads & Media
- `multer`: Middleware for handling multipart/form-data (file uploads)
- `cloudinary`: Cloud-based image and video management service
- `multer-storage-cloudinary`: Multer storage engine for Cloudinary

### Communication & Notifications
- `nodemailer`: Send emails from Node.js applications
- `socket.io`: Real-time bidirectional event-based communication
- `axios`: HTTP client for making API requests

### Authentication Services
- `firebase`: Google Firebase SDK for authentication and other services

### PDF Generation & Documents
- `pdfkit`: JavaScript library for generating PDF documents
- `stream-buffers`: Buffer utilities for streams

### Development
- `nodemon`: Development utility that automatically restarts server on file changes

### Documentation
- `swagger-ui-express`: Swagger UI middleware for Express
- `swagger-jsdoc`: Generate Swagger documentation from JSDoc comments

### Additional Packages (Recommended)
- Security: `express-rate-limit`, `hpp`, `xss-clean`, `express-mongo-sanitize`, `helmet`
- Payments: M‑Pesa (Daraja via REST), `paystack-sdk` or direct REST
- SMS: `twilio` or `africastalking`
- Queues: `bullmq`, `ioredis`
- Logging: `pino` (or `winston`), `pino-pretty`
- Testing: `jest`, `supertest`
- OAuth & SSO: `passport`, `passport-google-oauth20`, `passport-apple`, `passport-instagram`

---

## Data Models (Mongoose)

- **User**
  - Profile: name, email, phone, password hash, avatar
  - Auth: OTP code/hash & expiry, isVerified, roles ["customer", "staff", "admin", ...]
  - OAuth: linked providers [{ provider: "google"|"apple"|"instagram", providerUserId, email, linkedAt }]
  - Addresses: list (label, street, city, region, country, postal, isDefault)
  - Preferences: notification settings
  - Location: country, timezone

- **Variant (Attribute) & Options**
  - Example attributes: Size, Color, Material; options: [S, M, L], [Red, Blue], etc.
  - Flexible schema so any product can use any variants.
  - Full CRUD for attributes and options; attach/detach variants to products.

- **Product**
  - Basic: title, slug, description, brand, images, categories, collections, tags
  - Pricing: basePrice, compareAtPrice, tax class
  - Variants: list of attributes used (e.g., Size, Color)
  - SKUs: concrete combinations with SKU, price, compareAtPrice, stock, barcode, image, weight
  - Status: active, draft, archived
  - Packaging options: [{ name, fee, description, isDefault }]

- **Inventory**
  - Tracks stock per SKU (variant combination), reserves on order placement, deducts on payment.
  - Real‑time stock updates; prevent add‑to‑cart when qty is 0 unless pre‑order is enabled; optional back‑in‑stock notifications.

- **Wishlist**
  - User ↔ Product references, createdAt

- **Compare**
  - User ↔ Products up to N items

- **Cart**
  - User (authenticated only)
  - Items [{ productId, skuId, qty, priceSnapshot, customization }]
  - Coupon, totals { subtotal, discount, tax, shipping, total }

- **Coupon**
  - Code, type (percent/amount/free‑shipping)
  - Rules: minSpend, usage limit, start/end dates
  - Discount value for fixed amount coupons
  - Status

- **Campaign**
  - Name, audience/segments, schedule (start/end), message, channels (email/sms/in‑app), performance stats

- **Order**
  - User
  - Items (productId, skuId, name, image, qty, price)
  - Address snapshot, shipping method
  - Status: Placed → Confirmed → Packed → Shipped → OutForDelivery → Delivered → (Cancelled/Refunded)
  - Payments: list (provider, ref, amount, result, timestamps)
  - Totals: { subtotal, discounts, shipping, tax, grandTotal }
  - Timeline: events with actor (system/staff)
  - Receipt: receiptNumber, receiptUrl (or storage key), receiptGeneratedAt
  - Fulfilment: fulfilNow (bool), scheduledAt (Date), schedulingFee
  - Context: orderOrigin ("in-shop"|"away"), settlement ("pay-now"|"post-to-bill")
  - Delivery: method ("pickup"|"delivery"), deliveryDistanceKm, deliveryFeePerKm, deliveryFeeTotal, assignedRiderId

- **Payment**
  - Provider: mpesa|paystack|cash, amount, status, externalRef, metadata, webhook logs

- **Notification**
  - Type: in‑app | email | sms; template, payload, user(s), read status

Supporting taxonomies often used: Category, Collection, Brand (optional but recommended for filtering).

- **Review**
  - product, user, orderId?, orderItemId?
  - rating (1..5), title, body, images []
  - isVerifiedPurchase (bool), isApproved (bool)
  - createdAt, updatedAt

- **ContactMessage**
  - fromEmail, fromUserId?
  - subject?, content
  - status: open|resolved, assignedTo?
  - replies: [{ channel: email|sms|in-app, to, body, sentAt, meta }]
  - createdAt, updatedAt

- **StoreSettings**
  - Identity: storeName, contactEmail, contactPhone
  - Location: address { street, city, region, country, postal }, timezone
  - Hours: weekly schedule [{ day: 0-6, open: "09:00", close: "18:00", closed: boolean }]
  - Days off / Holidays: dates [], notes
  - Visibility flags: showContactOnSite, showHoursOnSite
  - Fulfilment: { enableScheduling, schedulingFee }
  - Delivery: { feePerKm }
  - Billing: { allowPostToBillInShop }

---

## Controllers (Responsibilities)

- Auth: register, login, OTP send/verify, refresh token, logout, social OAuth (init/callback), forgot password (request), reset password (confirm)
- Users: profile CRUD, addresses CRUD, notification prefs, list (admin)
- Products: CRUD, variant builder, SKU generation, images upload
- Inventory: adjust, reserve, release; low‑stock alerts
  - Enforce out‑of‑stock restriction on cart; allow pre‑order if enabled; push real‑time updates.
- Wishlist: add/remove/list
- Compare: add/remove/list
- Cart: add/update/remove/merge, apply/remove coupon, totals
- Coupons: CRUD, validate/apply
- Campaigns: CRUD, schedule, stats
- Orders: create (customer/admin), detail, list/filter, status transitions, timeline notes
  - Support fulfil‑now and scheduled; compute scheduling fee; apply in‑shop vs away payment rules; post‑to‑bill flow; delivery fee per km computation; rider claim/assign operations.
- Payments: create intents, M‑Pesa STK push, Paystack init, confirm, webhooks
- Receipts: generate on successful payment, attach/store URL, email to customer, resend on demand
- Notifications: send/broadcast (email/sms/in‑app), mark read
- Store settings: get/update settings (admin only), compute current open/closed status
- Reviews: create (verified purchasers only), update/delete own review, admin approve/reject, list & aggregate ratings per product
- Contact: submit contact messages (public), admin list/assign, reply via email/SMS/in‑app, resolve

---

## Routes (High‑Level)


- `/api/auth` — register, login, otp, refresh, logout, forgot‑password, reset‑password
- `/api/auth/oauth/:provider` — start OAuth (google|apple|instagram)
- `/api/auth/oauth/:provider/callback` — OAuth callback
- `/api/users` — me, profile, addresses, notifications
- `/api/products` — list, detail, filters, variants, admin CRUD
- `/api/products/:productId/reviews` — list reviews, create review (if verified buyer)
- `/api/products/:productId/reviews/:reviewId` — update/delete (owner or admin), approve (admin)
- `/api/wishlist` — list/add/remove
- `/api/compare` — list/add/remove
- `/api/cart` — get/set/update/apply‑coupon (auth‑required)
  - Reject add/update when stock unavailable unless pre‑order enabled
- `/api/coupons` — validate, admin CRUD
- `/api/campaigns` — admin CRUD, stats
- `/api/orders` — create, list, detail, status updates
  - Support payload: { fulfilNow|scheduledAt, origin: 'in-shop'|'away', settlement: 'pay-now'|'post-to-bill', method: 'pickup'|'delivery', packagingOptionId }
  - Delivery fee per km calculation (reads delivery settings)
  - Rider: `/api/orders/available` (rider) list claimable; `/api/orders/:id/claim` (rider) claim; `/api/orders/:id/assign` (admin) assign
- `/api/orders/:id/receipt` — get/download receipt (owner or admin)
- `/api/orders/:id/receipt/resend` — resend receipt email to customer (admin)
- `/api/payments` — init, confirm, webhooks (mpesa/paystack), admin collect
- `/api/notifications` — list, mark‑read, broadcast (admin)
- `/api/store-settings` — get public settings
- `/api/admin/store-settings` — get/update (admin only)
 - `/api/contact` — submit contact message (public)
 - `/api/admin/contacts` — list/search, get one
 - `/api/admin/contacts/:id/reply` — reply via channel { channel, body }
 - `/api/admin/contacts/:id/status` — set status open/resolved, assign owner
  - Include fulfilment (scheduling + fee), delivery (per‑km fee), billing (post‑to‑bill policies)

---

## API Sketch (Examples)

- Auth
  - POST `/api/auth/register` { name, email/phone, password } → sends OTP
  - POST `/api/auth/verify-otp` { email/phone, otp } → activates account
  - POST `/api/auth/login` { email/phone, password }
  - POST `/api/auth/forgot-password` { email } → sends reset link/token
  - POST `/api/auth/reset-password` { token, newPassword }
  - GET `/api/auth/oauth/google` → redirect to Google consent
  - GET `/api/auth/oauth/google/callback` → exchange code, sign in/up
  - GET `/api/auth/oauth/apple` and `/callback`
  - GET `/api/auth/oauth/instagram` and `/callback`

- Products
  - GET `/api/products` ?q=&category=&collection=&variants[Size]=M&variants[Color]=Red&price[min]=&price[max]=&sort=
  - GET `/api/products/:slug` → includes variant matrix, SKU stock, prices in KES
  - POST `/api/products` (admin) → create with KES pricing
  - All product responses include prices in KES
  - GET `/api/products/:id/reviews` — list with pagination and aggregates (avg, counts per star)
  - POST `/api/products/:id/reviews` { rating, title, body, images } — requires Delivered order containing product; one per user
  - PATCH `/api/products/:id/reviews/:reviewId` — author can edit within policy window
  - DELETE `/api/products/:id/reviews/:reviewId` — author or admin
  - POST `/api/products/:id/reviews/:reviewId/approve` — admin approval

- Wishlist / Compare
  - POST `/api/wishlist` { productId } (auth‑required)
  - DELETE `/api/wishlist/:productId`
  - POST `/api/compare` { productId } (auth‑required)
  - DELETE `/api/compare/:productId`

- Cart & Coupons
  - GET `/api/cart` → returns cart with prices in KES
  - POST `/api/cart/items` { productId, skuId, qty, customization }
  - PATCH `/api/cart/items/:itemId` { qty, skuId }
  - DELETE `/api/cart/items/:itemId`
  - Response/validation ensures item cannot be added when stock is 0 unless product/SKU has preOrderEnabled
  - POST `/api/cart/coupon` { code } → validates coupon
  - All cart endpoints require authentication

- Orders
  - POST `/api/orders` { addressId, shippingMethod, paymentMethod, fulfilNow, scheduledAt, origin, settlement, method, packagingOptionId } → creates order (reserves stock)
  - GET `/api/orders/:id` — details + tracking timeline
  - PATCH `/api/orders/:id/status` { status } (admin)
  - GET `/api/orders/available` (rider) — list of delivery orders to claim
  - POST `/api/orders/:id/claim` (rider) — claim an order
  - POST `/api/orders/:id/assign` (admin) { riderId }

- Payments
  - POST `/api/payments/mpesa/initiate` { orderId, phone } → STK Push to customer phone
  - POST `/api/payments/paystack/initiate` { orderId } → returns authorization URL
  - POST `/api/webhooks/mpesa` — receive M‑Pesa callbacks
  - POST `/api/webhooks/paystack` — receive Paystack events
  - POST `/api/payments/admin/collect` { orderId, method, phone? } — admin prompts customer (e.g., STK)
  - On success: generate receipt (PDF), persist receiptUrl, notify customer (email with attachment/link)

- Notifications & Broadcasts
  - GET `/api/notifications`
  - POST `/api/notifications/broadcast` (admin) { channel, audience, templateId, params }
  
- Contact Messages
  - POST `/api/contact` { email, content, subject? }
  - GET `/api/admin/contacts` (admin) ?q=&status=&page=&pageSize=
  - GET `/api/admin/contacts/:id`
  - POST `/api/admin/contacts/:id/reply` (admin) { channel: "email"|"sms"|"in-app", body }
  - PATCH `/api/admin/contacts/:id/status` (admin) { status: "open"|"resolved", assignedTo }
  
- Store Settings
  - GET `/api/store-settings` → public info (name, contact, location visibility, hours)
  - GET `/api/admin/store-settings` (admin) → full editable settings
  - PUT `/api/admin/store-settings` (admin) { storeName, contactEmail, ..., hours, daysOff, fulfilment: { enableScheduling, schedulingFee }, delivery: { feePerKm }, billing: { allowPostToBillInShop } }

---

## Auth, OTP & RBAC

- OTP on register and (optionally) on sensitive actions.
- JWT access + refresh tokens; short‑lived access tokens.
- RBAC middleware checks roles/permissions per route (e.g., `admin`, `staff`, `customer`).
- Social login supported (Google, Apple ID, Instagram). Accounts can be linked to an existing user via email match or explicit link.

---

## Payments (M‑Pesa Daraja, Paystack, Cash)

- M‑Pesa: STK Push from server using Consumer Key/Secret and Passkey; verify result via callback and/or query; update order/payment status.
- Paystack: Initialize transaction (server), redirect/authorize (client), verify via webhook; update order/payment status.
- Cash: Mark as collected by staff/delivery with audit trail.

---

## Notifications

- In‑app notifications stored in DB, delivered via API and websockets (optional).
- Email via Nodemailer/SMTP provider; SMS via Twilio/Africa’s Talking.
- Background jobs handle OTP, order updates, campaigns, low‑stock alerts.

---

## Inventory & Stock

- Reserve stock on order creation; release on timeout/cancel; deduct on payment success.
- Track per‑SKU (variant) quantities and thresholds for alerts.

---

## Validation, Security & Observability

- Input validation (Zod/Joi), rate limits, CORS, Helmet, mongo sanitize, XSS clean, HPP.
- Centralized error handler with problem details.
- Structured logs (Pino) with request tracing; health checks.
- Rate limit review creation/edits; profanity filter; anti‑spam; audit log for moderation actions.
 - Contact form: rate limit, CAPTCHA support, spam filtering; store minimal PII.

---

## Testing & Docs

- Unit tests (Jest), API tests (Supertest), factories/fixtures.
- Swagger/OpenAPI docs served at `/api/docs` (disabled in production or protected).

This backend spec supports the required flows: flexible variants per product, robust filters, coupons, wishlist/compare, order lifecycle, OTP verification, notifications, payments via M‑Pesa, Paystack, and Cash, including admin‑initiated orders with customer prompts. All prices and transactions are handled in KES (Kenyan Shillings).

