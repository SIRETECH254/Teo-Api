# TEO KICKS API - Backend Documentation

## Table of Contents
- [Technology Stack](#technology-stack)
- [Required Packages](#required-packages)
- [Database Models](#database-models)
- [Controllers](#controllers)
- [Routes](#routes)
- [Architecture Overview](#architecture-overview)

---

## Technology Stack

- Runtime: Node.js
- Framework: Express.js
- Language: JavaScript
- Database: MongoDB (Mongoose ODM)
- Realtime: Socket.io (live updates)
- API Docs: Swagger (swagger-jsdoc, swagger-ui-express)

---

## Required Packages

### Core Dependencies (from package.json)
```json
{
  "africastalking": "^0.7.3",
  "axios": "^1.10.0",
  "bcryptjs": "^3.0.2",
  "cloudinary": "^1.41.0",
  "cors": "^2.8.5",
  "dotenv": "^17.1.0",
  "express": "^4.18.2",
  "firebase": "^11.10.0",
  "google-auth-library": "^10.3.0",
  "joi": "^18.0.0",
  "mongoose": "^8.16.2",
  "mongoose-paginate-v2": "^1.9.1",
  "multer": "^2.0.1",
  "multer-storage-cloudinary": "^4.0.0",
  "nodemailer": "^7.0.5",
  "nodemon": "^3.1.10",
  "pdfkit": "^0.17.1",
  "socket.io": "^4.8.1",
  "stream-buffers": "^3.0.3",
  "swagger-jsdoc": "^6.2.8",
  "swagger-ui-express": "^5.0.1",
  "validator": "^13.15.15"
}
```

---

## Database Models

### 1. User Model
```typescript
interface IUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  isVerified: boolean;
  lastLoginAt?: Date;
  isAdmin: boolean;
  roles: string[]; // Role ObjectIds
  oauthProviders: Array<{
    provider: "google" | "apple" | "instagram";
    providerUserId: string;
    email: string;
    linkedAt: Date;
  }>;
  notificationPreferences?: {
    email: boolean;
    sms: boolean;
    inApp: boolean;
    orderUpdates: boolean;
    promotions: boolean;
    stockAlerts: boolean;
  };
  country?: string;
  timezone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2. Role Model
```typescript
interface IRole {
  _id: string;
  name: "customer" | "rider" | "staff";
  description: string;
  isActive: boolean;
  createdBy: string; // User ID
  updatedBy?: string; // User ID
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 3. StoreConfig Model
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
    open?: string; // HH:MM format
    close?: string; // HH:MM format
    isOpen: boolean;
  }>;
  paymentMethods: {
    mpesa: { enabled: boolean; shortcode?: string };
    card: { enabled: boolean; paystackKey?: string };
    cash: { enabled: boolean; description: string };
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

---

### 4. Order Model
```typescript
interface IOrder {
  _id: string;
  customerId: string; // User ID
  createdBy: string; // User ID
  location: "in_shop" | "away";
  type: "pickup" | "delivery";
  items: Array<{
    skuId: string; // SKU ObjectId
    productId: string; // Product ObjectId
    title: string;
    variantOptions?: Map<string, string>;
    quantity: number;
    unitPrice: number;
    packagingChoice?: {
      id?: string; // PackagingOption ObjectId
      name?: string;
      fee?: number;
    };
  }>;
  pricing: {
    subtotal: number;
    discounts: number;
    packagingFee: number;
    schedulingFee: number;
    deliveryFee: number;
    tax: number;
    total: number;
  };
  timing: {
    isScheduled: boolean;
    scheduledAt?: Date | null;
  };
  addressId?: string | null; // Address ObjectId
  paymentPreference: {
    mode: "post_to_bill" | "pay_now" | "cash" | "cod";
    method?: "mpesa_stk" | "paystack_card" | null;
  };
  status:
    | "PLACED"
    | "CONFIRMED"
    | "PACKED"
    | "SHIPPED"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED"
    | "REFUNDED";
  paymentStatus:
    | "UNPAID"
    | "PENDING"
    | "PAID"
    | "PARTIALLY_REFUNDED"
    | "REFUNDED";
  invoiceId?: string | null; // Invoice ObjectId
  receiptId?: string | null; // Receipt ObjectId
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}
```

Index:
```typescript
db.orders.createIndex({ customerId: 1, createdAt: -1 });
db.orders.createIndex({ status: 1, createdAt: -1 });
```

---

### 5. Payment Model
```typescript
interface IPayment {
  _id: string;
  invoiceId: string; // Invoice ObjectId
  method: "mpesa_stk" | "paystack_card" | "cash" | "post_to_bill" | "cod";
  amount: number;
  currency: "KES";
  processorRefs?: {
    daraja?: { merchantRequestId?: string; checkoutRequestId?: string };
    paystack?: { reference?: string };
  };
  status: "INITIATED" | "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
  rawPayload?: any;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 6. Notification Model
```typescript
interface INotification {
  _id: string;
  userId: string; // User ObjectId
  type: "order_created" | "payment_success" | "order_status_changed" | "invoice_generated" | "receipt_issued";
  payload?: any;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 7. Address Model
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

---

### 8. Brand Model
```typescript
interface IBrand {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  features: string[];
  sortOrder: number;
  isActive: boolean;
  createdBy: string; // User ObjectId
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 9. Cart Model
```typescript
interface ICart {
  _id: string;
  userId: string; // User ObjectId
  items: Array<{
    productId: string; // Product ObjectId
    skuId: string;
    quantity: number;
    price: number;
    variantOptions?: Map<string, string>;
  }>;
  totalAmount: number;
  totalItems: number;
  status: "active" | "converted" | "abandoned";
  expiresAt?: Date;
  createdAt: Date;
    updatedAt: Date;
}
```

---

### 10. Category Model
```typescript
interface ICategory {
  _id: string;
  name: string;
  slug: string;
  status: "active" | "inactive";
  isActive: boolean;
  createdBy: string; // User ObjectId
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 11. Collection Model
```typescript
interface ICollection {
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

---

### 12. Coupon Model
```typescript
interface ICoupon {
  _id: string;
  code: string;
  name: string;
  description?: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minimumOrderAmount: number;
  maximumDiscountAmount?: number;
  isActive: boolean;
  hasExpiry: boolean;
  expiryDate?: Date;
  hasUsageLimit: boolean;
  usageLimit?: number;
  usedCount: number;
  isFirstTimeOnly: boolean;
  applicableProducts: string[]; // Product ObjectIds
  applicableCategories: string[]; // Category ObjectIds
  excludedProducts: string[]; // Product ObjectIds
  excludedCategories: string[]; // Category ObjectIds
  createdBy: string; // User ObjectId
  lastUsedBy: Array<{
    user: string; // User ObjectId
    usedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 13. Delivery Model
```typescript
interface IDelivery {
  _id: string;
  orderId: string; // Order ObjectId
  assignedTo: string; // User ObjectId
  distanceKm: number;
  deliveryFee: number;
  status: "ASSIGNED" | "PICKED" | "DELIVERED";
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 14. Invoice Model
```typescript
interface IInvoice {
  _id: string;
  orderId: string; // Order ObjectId
  number: string;
  lineItems: Array<{
    label: string;
    amount: number;
  }>;
  subtotal: number;
  discounts: number;
  fees: number;
  tax: number;
  total: number;
  balanceDue: number;
  paymentStatus: "PENDING" | "PAID" | "CANCELLED";
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 15. PackagingOption Model
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

---

### 16. Product Model
```typescript
interface IProduct {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  brand?: string; // Brand ObjectId
  images: Array<{
    url: string;
    alt?: string;
    isPrimary: boolean;
  }>;
  categories: string[]; // Category ObjectIds
  collections: string[]; // Collection ObjectIds
  tags: string[]; // Tag ObjectIds
  basePrice: number;
  comparePrice?: number;
  variants: string[]; // Variant ObjectIds
  skus: Array<{
    attributes: Array<{
      variantId: string; // Variant ObjectId
      optionId: string; // Option ObjectId
    }>;
    price: number;
    comparePrice?: number;
    stock: number;
    skuCode: string;
    barcode?: string;
    weight?: number;
    dimensions?: {
      length?: number;
      width?: number;
      height?: number;
    };
    isActive: boolean;
    allowPreOrder: boolean;
    preOrderStock: number;
    lowStockThreshold: number;
  }>;
  status: "active" | "draft" | "archived";
  metaTitle?: string;
  metaDescription?: string;
  trackInventory: boolean;
  weight?: number;
  features: string[];
  createdBy: string; // User ObjectId
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 17. Receipt Model
```typescript
interface IReceipt {
  _id: string;
  orderId: string; // Order ObjectId
  invoiceId: string; // Invoice ObjectId
  receiptNumber: string;
  amountPaid: number;
  paymentMethod: "mpesa_stk" | "paystack_card" | "cash";
  issuedAt: Date;
  pdfUrl?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 18. Review Model
```typescript
interface IReview {
  _id: string;
  user: string; // User ObjectId
  product: string; // Product ObjectId
  rating: number;
  comment: string;
  isVerifiedPurchase: boolean;
  isApproved: boolean;
  orderId?: string; // Order ObjectId
  orderItemId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 19. Tag Model
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

---

### 20. Variant Model
```typescript
interface IVariant {
  _id: string;
  name: string;
  options: Array<{
    _id: string;
    value: string;
    isActive: boolean;
    sortOrder: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
```
---

## Controllers

### 1. Address Controllers

#### `addressController.js`
- `getUserAddresses()` - Get all authenticated user's addresses
- `getAddressById()` - Get single address by ID
- `createAddress()` - Create new address
- `updateAddress()` - Update address
- `deleteAddress()` - Delete address (hard delete)
- `setDefaultAddress()` - Set default address for authenticated user
- `getDefaultAddress()` - Get default address for authenticated user
- `getAllAddresses()` - Get all addresses for all users (Admin only)

---

### 2. Auth Controllers

#### `authController.js`
- `register()` - Register new user with OTP verification
- `verifyOTP()` - Verify user's OTP
- `resendOTP()` - Resend OTP to user
- `login()` - Login user and generate tokens
- `refreshToken()` - Refresh access token using refresh token
- `forgotPassword()` - Initiate password reset process
- `resetPassword()` - Reset user password using token
- `logout()` - Logout user
- `getMe()` - Get current authenticated user's profile
- `googleAuth()` - Initiate Google OAuth login
- `googleAuthCallback()` - Handle Google OAuth callback (web)
- `googleAuthMobile()` - Handle Google OAuth for mobile (ID token)

---

### 3. Brand Controllers

#### `brandController.js`
- `createBrand()` - Create new brand (Admin)
- `getAllBrands()` - Get all brands (Public)
- `getBrandById()` - Get brand by ID (Public)
- `updateBrand()` - Update brand (Admin)
- `deleteBrand()` - Delete brand (Admin)
- `getPopularBrands()` - Get popular brands (Public)
- `getBrandsWithProducts()` - Get brands with product count (Public)
- `getActiveBrands()` - Get active brands (Public)

---

### 4. Cart Controllers

#### `cartController.js`
- `getCart()` - Get user's active cart
- `addToCart()` - Add item to cart
- `updateCartItem()` - Update cart item quantity
- `removeFromCart()` - Remove item from cart
- `clearCart()` - Clear all items from cart
- `validateCart()` - Validate cart (check stock availability and other rules)

---

### 5. Category Controllers

#### `categoryController.js`
- `createCategory()` - Create new category (Admin)
- `getAllCategories()` - Get all categories (Public)
- `getCategoryById()` - Get category by ID (Public)
- `updateCategory()` - Update category (Admin)
- `deleteCategory()` - Delete category (Admin)
- `getCategoryTree()` - Get category tree (Public)
- `getCategoriesWithProducts()` - Get categories with product count (Public)
- `getRootCategories()` - Get root categories (Public)

---

### 6. Collection Controllers

#### `collectionController.js`
- `createCollection()` - Create new collection (Admin)
- `getAllCollections()` - Get all collections (Public)
- `getCollectionById()` - Get collection by ID (Public)
- `updateCollection()` - Update collection (Admin)
- `deleteCollection()` - Delete collection (Admin)
- `addProductToCollection()` - Add product to collection (DEPRECATED)
- `removeProductFromCollection()` - Remove product from collection (DEPRECATED)
- `getCollectionsWithProducts()` - Get collections with product count (Public)
- `getActiveCollections()` - Get active collections (Public)

---

### 7. Coupon Controllers

#### `couponController.js`
- `createCoupon()` - Create a new coupon (Admin only)
- `getAllCoupons()` - Get all coupons (Admin only)
- `getCouponById()` - Get coupon by ID (Admin only)
- `updateCoupon()` - Update coupon (Admin only)
- `deleteCoupon()` - Delete coupon (Admin only)
- `validateCoupon()` - Validate coupon (Public)
- `applyCoupon()` - Apply coupon to order (Protected)
- `getCouponStats()` - Get coupon statistics (Admin only)
- `generateNewCode()` - Generate new coupon code (Admin only)

---

### 8. Invoice Controllers

#### `invoiceController.js`
- `createInvoice()` - Create invoice for an order
- `getInvoiceById()` - Get invoice by ID

---

### 9. Order Controllers

#### `orderController.js`
- `createOrder()` - Create new order
- `getOrderById()` - Get single order by ID
- `updateOrderStatus()` - Update order status
- `assignRider()` - Assign rider to order (placeholder)
- `getOrders()` - List orders
- `deleteOrder()` - Delete order

---

### 10. Packaging Controllers

#### `packagingController.js`
- `createPackaging()` - Create new packaging option (Admin)
- `getPackagingList()` - Get all packaging options
- `getPackagingById()` - Get packaging option by ID
- `updatePackaging()` - Update packaging option (Admin)
- `deletePackaging()` - Delete packaging option (Admin)
- `setDefaultPackaging()` - Set default packaging option (Admin)
- `getActivePackaging()` - Get active packaging options (Public)
- `getDefaultPackaging()` - Get default packaging option (Public)

---

### 11. Payment Controllers

#### `paymentController.js`
- `initiatePayment()` - Initiate payment (DEPRECATED)
- `getPaymentById()` - Get single payment by ID
- `markCashCollected()` - Mark cash payment as collected (Admin)
- `mpesaWebhook()` - M-Pesa (Daraja) callback handler
- `paystackWebhook()` - Paystack callback handler
- `payInvoice()` - Initiate payment with integrations (Mpesa, Paystack)
- `queryMpesaByCheckoutId()` - Query M-Pesa STK push status by CheckoutRequestID

---

### 12. Product Controllers

#### `productController.js`
- `createProduct()` - Create a new product (Admin)
- `getAllProducts()` - Get all products with pagination and filtering (Public)
- `getProductById()` - Get product by ID (Public)
- `updateProduct()` - Update product (Admin)
- `deleteProduct()` - Delete product (Admin)
- `generateSKUs()` - Generate SKUs for a product (Admin)
- `updateSKU()` - Update SKU details (Admin)
- `deleteSKU()` - Delete SKU from a product (Admin)
- `attachVariant()` - Attach variant to product and regenerate SKUs (Admin)
- `detachVariant()` - Detach variant from product and update SKUs (Admin)
- `uploadProductImages()` - Upload product images (Admin)
- `deleteProductImage()` - Delete product image (Admin)
- `setPrimaryImage()` - Set primary image for a product (Admin)
- `getOptimizedImages()` - Get optimized image URLs for a product (Public)

---

### 13. Receipt Controllers

#### `receiptController.js`
- `createReceipt()` - Create a new receipt for a paid invoice (Admin)
- `getReceiptById()` - Get receipt by ID

---

### 14. Review Controllers

#### `reviewController.js`
- `getProductReviews()` - Get reviews for a product (Public)
- `createReview()` - Create a review for a product
- `updateReview()` - Update own review
- `deleteReview()` - Delete own review
- `getReviewById()` - Get a single review
- `approveReview()` - Admin: Approve/Reject review
- `getUserReviews()` - Get authenticated user's reviews

---

### 15. Role Controllers

#### `roleController.js`
- `createRole()` - Create role (Admin)
- `getAllRoles()` - List roles (Admin)
- `getRoleById()` - Get role by ID (Admin)
- `updateRole()` - Update role (Admin)
- `deleteRole()` - Delete role (Admin)
- `assignRoleToUser()` - Assign role to user (Admin)
- `removeRoleFromUser()` - Remove role from user (Admin)
- `getUsersByRole()` - List users by role (Admin)

---

### 16. Stats Controllers

#### `statsController.js`
- `getOverviewStats()` - Dashboard overview numbers (Admin)
- `getAnalytics()` - Time-series analytics for charts (Admin)

---

### 17. StoreConfig Controllers

#### `storeConfigController.js`
- `getStoreConfig()` - Get store configuration (Public)
- `createStoreConfig()` - Create store configuration (Admin only)
- `updateStoreConfig()` - Update store configuration (Admin only)
- `deleteStoreConfig()` - Delete store configuration (Admin only)
- `initStoreConfig()` - Initialize default store configuration (Admin only)
- `getStoreConfigStatus()` - Get store configuration status (Public)

---

### 18. Tag Controllers

#### `tagController.js`
- `createTag()` - Create new tag (Admin)
- `getAllTags()` - Get all tags (Public)
- `getTagById()` - Get tag by ID (Public)
- `updateTag()` - Update tag (Admin)
- `deleteTag()` - Delete tag (Admin)
- `getTagsByType()` - Get tags by type (DEPRECATED)
- `getPopularTags()` - Get popular tags (Public)
- `getTagsWithProducts()` - Get tags with product count (Public)
- `findOrCreateTag()` - Find or create tag (Admin)

---

### 19. User Controllers

#### `userController.js`
- `getUserProfile()` - Get authenticated user's profile
- `updateUserProfile()` - Update own profile details
- `changePassword()` - Change password
- `getNotificationPreferences()` - Get notification preferences
- `updateNotificationPreferences()` - Update notification preferences
- `getAllUsers()` - Admin list of users
- `getUserById()` - Get user by ID (Admin)
- `updateUserStatus()` - Activate/deactivate user (Admin)
- `setUserAdmin()` - Set user admin role (Admin)
- `assignDefaultRole()` - Assign default customer role to new users (Internal Helper)
- `getUserRoles()` - Get user roles (Admin)
- `deleteUser()` - Delete user (Admin)
- `adminCreateCustomer()` - Admin create customer

---

### 20. Variant Controllers

#### `variantController.js`
- `createVariant()` - Create a new variant (Admin)
- `getAllVariants()` - Get all variants (Public)
- `getVariantById()` - Get variant by ID (Public)
- `updateVariant()` - Update variant (Admin)
- `deleteVariant()` - Delete variant (Admin)
- `addOption()` - Add option to variant (Admin)
- `updateOption()` - Update option in variant (Admin)
- `removeOption()` - Remove option from variant (Admin)
- `getActiveVariants()` - Get active variants (Public)
---





## Routes

### 1. Address Routes
Base: `/api/addresses`

```typescript
GET    /                          // Get all authenticated user's addresses
GET    /default                   // Get default address for authenticated user
GET    /:addressId                // Get single address by ID
POST   /                          // Create new address
PUT    /:addressId                // Update address
PUT    /:addressId/default        // Set default address
DELETE /:addressId                // Delete address
GET    /admin/all                 // Get all addresses for all users (Admin only)
```

---

### 2. Auth Routes
Base: `/api/auth`

```typescript
POST   /register                  // Register new user with OTP verification
POST   /verify-otp                // Verify user's OTP
POST   /resend-otp                // Resend OTP to user
POST   /login                     // Login user and generate tokens
POST   /refresh                   // Refresh access token using refresh token
POST   /forgot-password           // Initiate password reset process
POST   /reset-password/:token     // Reset user password using token
POST   /logout                    // Logout user
GET    /me                        // Get current authenticated user's profile
GET    /google                    // Initiate Google OAuth login
POST   /google/callback           // Handle Google OAuth callback (web)
POST   /google/mobile             // Handle Google OAuth for mobile (ID token)
```

---

### 3. Brand Routes
Base: `/api/brands`

```typescript
GET    /                          // Get all brands (Public)
GET    /popular                   // Get popular brands (Public)
GET    /with-products             // Get brands with product count (Public)
GET    /active                    // Get active brands (Public)
GET    /:brandId                  // Get brand by ID (Public)
POST   /                          // Create new brand (Admin)
PUT    /:brandId                  // Update brand (Admin)
DELETE /:brandId                  // Delete brand (Admin)
```

---

### 4. Cart Routes
Base: `/api/cart`

```typescript
GET    /                          // Get user's active cart
POST   /add                       // Add item to cart
PUT    /items/:skuId              // Update cart item quantity
DELETE /items/:skuId              // Remove item from cart
DELETE /clear                     // Clear all items from cart
GET    /validate                  // Validate cart (check stock availability and other rules)
```

---

### 5. Category Routes
Base: `/api/categories`

```typescript
GET    /                          // Get all categories (Public)
GET    /tree                      // Get category tree (Public)
GET    /with-products             // Get categories with product count (Public)
GET    /root                      // Get root categories (Public)
GET    /:categoryId               // Get category by ID (Public)
POST   /                          // Create new category (Admin)
PUT    /:categoryId               // Update category (Admin)
DELETE /:categoryId               // Delete category (Admin)
```

---

### 6. Collection Routes
Base: `/api/collections`

```typescript
GET    /                          // Get all collections (Public)
GET    /with-products             // Get collections with product count (Public)
GET    /active                    // Get active collections (Public)
GET    /:collectionId             // Get collection by ID (Public)
POST   /                          // Create new collection (Admin)
PUT    /:collectionId             // Update collection (Admin)
DELETE /:collectionId             // Delete collection (Admin)
POST   /:collectionId/products    // Add product to collection (Admin, DEPRECATED)
DELETE /:collectionId/products/:productId // Remove product from collection (Admin, DEPRECATED)
```

---

### 7. Coupon Routes
Base: `/api/coupons`

```typescript
POST   /validate                  // Validate coupon code (Public)
POST   /apply                     // Apply coupon to order (Protected)
POST   /                          // Create a new coupon (Admin only)
GET    /                          // Get all coupons (Admin only)
GET    /stats                     // Get coupon statistics (Admin only)
GET    /:couponId                 // Get coupon by ID (Admin only)
PUT    /:couponId                 // Update coupon (Admin only)
DELETE /:couponId                 // Delete coupon (Admin only)
PATCH  /:couponId/generate-code   // Generate new coupon code (Admin only)
```

---

### 8. Invoice Routes
Base: `/api/invoices`

```typescript
POST   /                          // Create invoice for an order
GET    /:id                       // Get invoice by ID
```

---

### 9. Order Routes
Base: `/api/orders`

```typescript
POST   /                          // Create new order
GET    /                          // Get all orders
GET    /:id                       // Get single order by ID
PATCH  /:id/status                // Update order status
PATCH  /:id/assign-rider          // Assign rider to order (placeholder)
DELETE /:id                       // Delete order
```

---

### 10. Packaging Routes
Base: `/api/packaging`

```typescript
GET    /public                    // Get active packaging options (Public)
GET    /public/default            // Get default packaging option (Public)
GET    /                          // Get all packaging options
GET    /:id                       // Get packaging option by ID
POST   /                          // Create new packaging option (Admin)
PATCH  /:id                       // Update packaging option (Admin)
DELETE /:id                       // Delete packaging option (Admin)
PATCH  /:id/default               // Set default packaging option (Admin)
```

---

### 11. Payment Routes
Base: `/api/payments`

```typescript
POST   /initiate                  // Initiate payment (DEPRECATED)
POST   /pay-invoice               // Initiate payment with integrations (Mpesa, Paystack)
GET    /:id                       // Get payment by ID
PATCH  /:id/cash                  // Mark cash payment as collected (Admin)
POST   /webhooks/mpesa            // M-Pesa (Daraja) callback handler (Public)
POST   /webhooks/paystack         // Paystack callback handler (Public)
GET    /:id/mpesa-status          // Query M-Pesa STK push status for a payment
GET    /mpesa-status/:checkoutRequestId // Query M-Pesa STK push status by checkoutRequestId
```

---

### 12. Product Routes
Base: `/api/products`

```typescript
GET    /                          // Get all products with pagination and filtering (Public)
GET    /:id                       // Get product by ID (Public)
GET    /:productId/optimized-images // Get optimized image URLs for a product (Public)
POST   /                          // Create a new product (Admin)
PUT    /:productId                // Update product (Admin)
DELETE /:productId                // Delete product (Admin)
POST   /:productId/images         // Upload product images (Admin)
DELETE /:productId/images/:imageId // Delete product image (Admin)
PUT    /:productId/images/:imageId/primary // Set primary image for a product (Admin)
POST   /:productId/generate-skus  // Generate SKUs for a product (Admin)
PATCH  /:productId/skus/:skuId    // Update SKU details (Admin)
DELETE /:productId/skus/:skuId    // Delete SKU from a product (Admin)
POST   /:productId/attach-variant // Attach variant to product and regenerate SKUs (Admin)
POST   /:productId/detach-variant // Detach variant from product and update SKUs (Admin)
```

---

### 13. Receipt Routes
Base: `/api/receipts`

```typescript
POST   /                          // Create a new receipt for a paid invoice (Admin)
GET    /:id                       // Get receipt by ID
```

---

### 14. Review Routes
Base: `/api/reviews`

```typescript
GET    /products/:productId       // Get reviews for a product (Public)
GET    /:reviewId                 // Get a single review (Public)
GET    /user/reviews              // Get authenticated user's reviews
POST   /products/:productId       // Create a review for a product
PUT    /:reviewId                 // Update own review
DELETE /:reviewId                 // Delete own review
PATCH  /:reviewId/approve         // Admin: Approve/Reject review
```

---

### 15. Role Routes
Base: `/api/roles`

```typescript
POST   /                          // Create role (Admin)
GET    /                          // List roles (Admin)
GET    /:id                       // Get role by ID (Admin)
PUT    /:id                       // Update role (Admin)
DELETE /:id                       // Delete role (Admin)
POST   /:roleId/assign/:userId    // Assign role to user (Admin)
DELETE /:roleId/remove/:userId    // Remove role from user (Admin)
GET    /:id/users                 // Get users by role (Admin)
```

---

### 16. Stats Routes
Base: `/api/stats`

```typescript
GET    /overview                  // Dashboard overview numbers (Admin)
GET    /analytics                 // Time-series analytics for charts (Admin)
```

---

### 17. StoreConfig Routes
Base: `/api/store-config`

```typescript
GET    /                          // Get store configuration (Public)
POST   /                          // Create store configuration (Admin)
PUT    /                          // Update store configuration (Admin)
DELETE /                          // Delete store configuration (Admin)
GET    /status                    // Get store configuration status (Public)
POST   /init                      // Initialize default store configuration (Admin)
```

---

### 18. Tag Routes
Base: `/api/tags`

```typescript
GET    /                          // Get all tags (Public)
GET    /type/:type                // Get tags by type (DEPRECATED, Public)
GET    /popular                   // Get popular tags (Public)
GET    /with-products             // Get tags with product count (Public)
GET    /:tagId                    // Get tag by ID (Public)
POST   /                          // Create new tag (Admin)
POST   /find-or-create            // Find or create tag (Admin)
PUT    /:tagId                    // Update tag (Admin)
DELETE /:tagId                    // Delete tag (Admin)
```

---

### 19. User Routes
Base: `/api/users`

```typescript
GET    /profile                   // Get authenticated user's profile
PUT    /profile                   // Update own profile details
PUT    /change-password           // Change password
GET    /notifications             // Get notification preferences
PUT    /notifications             // Update notification preferences
GET    /                          // Admin list of users
GET    /:userId                   // Get user by ID (Admin)
PUT    /:userId/status            // Activate/deactivate user (Admin)
DELETE /:userId                   // Delete user (Admin)
PUT    /:userId/admin             // Set user admin role (Admin)
GET    /:userId/roles             // Get user roles (Admin)
POST   /admin-create              // Admin create customer
```

---

### 20. Variant Routes
Base: `/api/variants`

```typescript
GET    /active                    // Get active variants (Public)
GET    /:id                       // Get variant by ID (Public)
GET    /                          // Get all variants (Admin)
POST   /                          // Create a new variant (Admin)
PUT    /:id                       // Update variant (Admin)
POST   /:id/options               // Add option to variant (Admin)
PUT    /:id/options/:optionId     // Update option in variant (Admin)
DELETE /:id/options/:optionId     // Remove option from variant (Admin)
```
---

## Architecture Overview

### Folder Structure
```
server/
├── config/
│   └── swagger.js             # Swagger documentation config
├── models/
│   ├── addressModel.js
│   ├── brandModel.js
│   ├── cartModel.js
│   ├── categoryModel.js
│   ├── collectionModel.js
│   ├── couponModel.js
│   ├── deliveryModel.js
│   ├── invoiceModel.js
│   ├── notificationModel.js
│   ├── orderModel.js
│   ├── packagingOptionModel.js
│   ├── paymentModel.js
│   ├── productModel.js
│   ├── receiptModel.js
│   ├── reviewModel.js
│   ├── roleModel.js
│   ├── storeConfigModel.js
│   ├── tagModel.js
│   ├── userModel.js
│   └── variantModel.js
├── controllers/
│   ├── addressController.js
│   ├── authController.js
│   ├── brandController.js
│   ├── cartController.js
│   ├── categoryController.js
│   ├── collectionController.js
│   ├── couponController.js
│   ├── invoiceController.js
│   ├── orderController.js
│   ├── packagingController.js
│   ├── paymentController.js
│   ├── productController.js
│   ├── receiptController.js
│   ├── reviewController.js
│   ├── roleController.js
│   ├── statsController.js
│   ├── storeConfigController.js
│   ├── tagController.js
│   ├── userController.js
│   └── variantController.js
├── routes/
│   ├── addressRoute.js
│   ├── authRoute.js
│   ├── brandRoute.js
│   ├── cartRoute.js
│   ├── categoryRoute.js
│   ├── collectionRoute.js
│   ├── couponRoute.js
│   ├── invoiceRoute.js
│   ├── orderRoute.js
│   ├── packagingRoute.js
│   ├── paymentRoute.js
│   ├── productRoute.js
│   ├── receiptRoute.js
│   ├── reviewRoute.js
│   ├── roleRoute.js
│   ├── statsRoute.js
│   ├── storeConfigRoute.js
│   ├── tagRoute.js
│   ├── userRoute.js
│   └── variantRoute.js
├── middlewares/
│   └── auth.js                # JWT auth, optionalAuth, requireAdmin, authorizeRoles
├── services/
│   ├── emailService.js
│   ├── notificationService.js
│   ├── paymentService.js
│   ├── smsService.js
│   ├── external/
│   │   ├── darajaService.js   # M-Pesa/Daraja integration
│   │   └── paystackService.js # Paystack integration
│   └── internal/
├── utils/
│   ├── cloudinary.js
│   ├── configCheck.js
│   ├── error.js
│   ├── setupRoles.js
│   ├── slugGenerator.js
│   └── verify.js
└── index.js                   # App entry point
├── doc/                           # Documentation
├── .env                           # Environment variables
├── .gitignore
└── package.json
```

---

### Middleware

#### Authentication Middleware (middlewares/auth.js)
- `authenticateToken` - Verify JWT and load user
- `optionalAuth` - Attach user if token present; do not require auth
- `requireAdmin` - Require admin role
- `authorizeRoles(allowedRoles)` - Role-based access control
- `requireOwnershipOrAdmin(resourceUserIdField)` - Owner or admin
- `requireEmailVerification` - Require verified email

#### Error Handling
- `errorHandler(statusCode, message)` - Centralized error formatter (utils/error.js)

---

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=4500
API_BASE_URL=https://yourdomain.com
CORS_ORIGIN=http://localhost:8081

# Database
MONGO_URI=mongodb://localhost:27017/teokicks

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=your_refresh_secret

# Payments
MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORT_CODE=your_shortcode
MPESA_PASSKEY=your_passkey
CARD_PROVIDER_SECRET=your_card_provider_secret

# Notifications
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_password
FROM_EMAIL=noreply@teokicks.com
AFRICAS_TALKING_API_KEY=your_api_key
AFRICAS_TALKING_USERNAME=your_username
```

---

### Security Features

1. Authentication
   - JWT-based authentication
   - Password hashing with bcryptjs
2. Authorization
   - Role-based access control (admin, staff, customer)
3. API Security
   - CORS allowlist
   - Rate limiting for auth and payments
   - Error responses omit stack traces in production

---

### Integration Points

1. Payment Gateways
   - M-Pesa for mobile money
   - Card payments via provider
2. Communication
   - Email via Nodemailer
   - SMS via Africa's Talking
3. Real-time
   - Socket.io for live updates (e.g., order status)

---

### PDF Generation

- Optional receipt or invoice PDF using PDFKit
- Store receipts with order or payment records if enabled

---

## Getting Started

### Installation
```bash
cd server
npm install
```

### Database Setup
```bash
# Ensure MongoDB is running
mongod
```

### Run Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
npm start
```

---

## API Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

---

## Status Codes

- 200 - OK
- 201 - Created
- 400 - Bad Request
- 401 - Unauthorized
- 403 - Forbidden
- 404 - Not Found
- 500 - Internal Server Error

---

Last Updated: January 2026
Version: 1.0.0

Note: This documentation reflects the current codebase (models, controllers, routes, folder structure, and middleware as implemented).

- 500 - Internal Server Error

---

Last Updated: January 2026
Version: 1.0.0

Note: This documentation reflects the current codebase (models, controllers, routes, folder structure, and middleware as implemented).
