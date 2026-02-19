# 👥 TEO KICKS API - User Management Documentation

## 📋 Table of Contents
- [User Management Overview](#user-management-overview)
- [User Model](#-user-model)
- [User Controller](#-user-controller)
- [User Routes](#-user-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## User Management Overview

User Management covers all users in the TEO KICKS API system. All users authenticate via JWT and are assigned roles from the Role model. Users can have multiple roles assigned. Role-based access control (RBAC) governs permissions throughout the system. The default role for new registrations is "customer".

---

## 👤 User Model

### Schema Definition
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
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    inApp: boolean;
    orderUpdates: boolean;
    promotions: boolean;
    stockAlerts: boolean;
  };
  country: string;
  timezone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/userModel.js`**

```javascript
import mongoose from "mongoose"

const oauthProviderSchema = new mongoose.Schema({
    provider: { type: String, enum: ["google", "apple", "instagram"], required: true },
    providerUserId: { type: String, required: true },
    email: { type: String, required: true },
    linkedAt: { type: Date, default: Date.now }
})

const notificationPreferencesSchema = new mongoose.Schema({
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
    orderUpdates: { type: Boolean, default: true },
    promotions: { type: Boolean, default: false },
    stockAlerts: { type: Boolean, default: false }
})

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true, select: false }, // password is not selected by default
    avatar: { 
        type: String, 
        default: "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png" 
    },
    isVerified: { type: Boolean, default: false },
    otpCode: { type: String, select: false },
    otpExpiry: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpiry: { type: Date, select: false },
    isAdmin: { type: Boolean, default: false },
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
    oauthProviders: [oauthProviderSchema],
    notificationPreferences: {
        type: notificationPreferencesSchema,
        default: () => ({})
    },
    country: { type: String, default: "Kenya" },
    timezone: { type: String, default: "Africa/Nairobi" },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date }
}, {
    timestamps: true
})

userSchema.index({ phone: 1 });
userSchema.index({ roles: 1 });
userSchema.index({ 'oauthProviders.provider': 1, 'oauthProviders.providerUserId': 1 }); // Index for OAuth providers

const User = mongoose.model("User", userSchema);
export default User;
```

### Validation Rules
```javascript
name:      { required: true }
email:     { required: true, unique: true, format: email }
phone:     { required: true }
password:  { required: true, minlength: 6, select: false }
isAdmin:   { default: false }
roles:     { type: Array, ref: 'Role' }
isVerified: { default: false }
notificationPreferences: {
  email: { default: true },
  sms: { default: true },
  inApp: { default: true },
  orderUpdates: { default: true },
  promotions: { default: false },
  stockAlerts: { default: false }
}
country:   { default: "Kenya" }
timezone:  { default: "Africa/Nairobi" }
isActive:  { default: true }
```

---

## 🎮 User Controller

### Required Imports
```javascript
import bcrypt from "bcryptjs";
import validator from "validator";
import { errorHandler } from "../utils/error.js";
import User from "../models/userModel.js";
import Role from "../models/roleModel.js";
// cloudinary imports removed as not directly used in userController
```

### Functions Overview

#### `getUserProfile()`
**Purpose:** Get current user profile  
**Access:** Authenticated users  
**Validation:** User must exist  
**Process:** Fetch profile and populate roles  
**Response:** User profile data

**Controller Implementation:**
```javascript
export const getUserProfile = async (req, res, next) => {
  try {
    // Load user with populated roles
    const user = await User.findById(req.user?._id)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name description");

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(errorHandler(500, "Server error while fetching user profile"));
  }
};
```

#### `updateUserProfile(updates)`
**Purpose:** Update current user profile  
**Access:** Authenticated users  
**Validation:**
- User must exist
- Phone must be valid and unique if provided
**Process:** Update profile fields and handle avatar changes  
**Response:** Updated profile summary

**Controller Implementation:**
```javascript
export const updateUserProfile = async (req, res, next) => {
  try {
    const { name, phone, avatar, country, timezone } = req.body;
    const user = await User.findById(req.user?._id);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Apply profile updates
    if (name) user.name = name;
    if (phone) {
      if (!validator.isMobilePhone(phone)) {
        return next(errorHandler(400, "Please provide a valid phone number"));
      }

      const existingUser = await User.findOne({
        phone,
        _id: { $ne: user._id }
      });

      if (existingUser) {
        return next(errorHandler(400, "Phone number is already taken by another user"));
      }

      user.phone = phone;
    }
    if (country) user.country = country;
    if (timezone) user.timezone = timezone;

    if (avatar) user.avatar = avatar; // Simple update for avatar URL

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          roles: user.roles,
          isActive: user.isActive,
          isVerified: user.isVerified,
          country: user.country,
          timezone: user.timezone
        }
      }
    });
  }  catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.phone) {
      return next(errorHandler(400, "Phone number is already taken by another user"));
    }
    next(errorHandler(500, "Server error while updating profile"));
  }
};
```

#### `changePassword(passwords)`
**Purpose:** Change user password  
**Access:** Authenticated users  
**Validation:**
- Current and new passwords required
- Current password must match
**Process:** Hash new password and save  
**Response:** Success confirmation

**Controller Implementation:**
```javascript
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    // Require both current and new password
    if (!currentPassword || !newPassword) {
      return next(errorHandler(400, "Current password and new password are required"));
    }

    const user = await User.findById(req.user?._id).select("+password");
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Verify current password
    const isCurrentPasswordValid = bcrypt.compareSync(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return next(errorHandler(400, "Current password is incorrect"));
    }

    // Hash and store new password
    user.password = bcrypt.hashSync(newPassword, 12);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    next(errorHandler(500, "Server error while changing password"));
  }
};
```

#### `getNotificationPreferences()`
**Purpose:** Fetch notification preference settings  
**Access:** Authenticated users  
**Validation:** User must exist  
**Process:** Return preferences object (defaults to empty)  
**Response:** Preferences object

**Controller Implementation:**
```javascript
export const getNotificationPreferences = async (
  req,
  res,
  next
) => {
  try {
    // Fetch notification preferences only
    const user = await User.findById(req.user?._id).select("notificationPreferences");
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    res.status(200).json({
      success: true,
      data: { notificationPreferences: user.notificationPreferences || {} }
    });
  } catch (error) {
    next(errorHandler(500, "Server error while fetching notification preferences"));
  }
};
```

#### `updateNotificationPreferences(preferences)`
**Purpose:** Update notification preferences  
**Access:** Authenticated users  
**Validation:** User must exist  
**Process:** Update email/sms/inApp flags  
**Response:** Updated preferences

**Controller Implementation:**
```javascript
export const updateNotificationPreferences = async (
  req,
  res,
  next
) => {
  try {
    const { email, sms, inApp, orderUpdates, promotions, stockAlerts } = req.body;
    const user = await User.findById(req.user?._id);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Merge provided preferences
    user.notificationPreferences = user.notificationPreferences || {};
    if (email !== undefined) user.notificationPreferences.email = email;
    if (sms !== undefined) user.notificationPreferences.sms = sms;
    if (inApp !== undefined) user.notificationPreferences.inApp = inApp;
    if (orderUpdates !== undefined) user.notificationPreferences.orderUpdates = orderUpdates;
    if (promotions !== undefined) user.notificationPreferences.promotions = promotions;
    if (stockAlerts !== undefined) user.notificationPreferences.stockAlerts = stockAlerts;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Notification preferences updated successfully",
      data: { notificationPreferences: user.notificationPreferences }
    });
  } catch (error) {
    next(errorHandler(500, "Server error while updating notification preferences"));
  }
};
```

#### `getAllUsers(query)`
**Purpose:** List users with filters  
**Access:** Admin/Staff  
**Validation:**
- Optional role must exist
**Process:** Search/filter users and return paginated results  
**Response:** Users + pagination

**Controller Implementation:**
```javascript
export const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, role, status } = req.query;
    const query = {};

    // Apply text search filters
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    // Resolve role name to role id
    if (role) {
      const roleDoc = await Role.findOne({ name: String(role).toLowerCase() });
      if (!roleDoc) {
        return next(errorHandler(404, "Role not found"));
      }
      query.roles = roleDoc._id;
    }

    // Status filters
    if (status === "active") query.isActive = true;
    else if (status === "inactive") query.isActive = false;
    if (status === "verified") query.isVerified = true;
    else if (status === "unverified") query.isVerified = false;

    // Pagination options
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    };

    // Query users with pagination
    const users = await User.find(query)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name description")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    // Total count for pagination
    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalUsers: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error) {
    next(errorHandler(500, "Server error while fetching users"));
  }
};
```

#### `getUserById(userId)`
**Purpose:** Fetch user by id  
**Access:** Admin/Staff  
**Validation:** User must exist  
**Process:** Fetch user and populate roles  
**Response:** User details

**Controller Implementation:**
```javascript
export const getUserById = async (req, res, next) => {
  try {
    const { userId } = req.params;
    // Load target user with role details
    const user = await User.findById(userId)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name description");

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(errorHandler(500, "Server error while fetching user"));
  }
};
```

#### `updateUser(userId, updates)`
**Purpose:** Update a user record (Admin only)  
**Access:** Admin  
**Validation:**
- User must exist
- Email format and uniqueness (if provided)
**Process:** Update profile fields and save  
**Response:** Updated user

**Controller Implementation:**
```javascript
export const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { name, phone, email, avatar, country, timezone } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Apply admin edits
    if (name) user.name = name;
    if (phone) user.phone = phone;

    if (email) {
      // Validate and enforce unique email
      if (!validator.isEmail(email)) {
        return next(errorHandler(400, "Please provide a valid email"));
      }

      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: userId }
      });

      if (existingUser) {
        return next(errorHandler(400, "Email is already taken by another user"));
      }

      user.email = email.toLowerCase();
    }
    if (country) user.country = country;
    if (timezone) user.timezone = timezone;

    if (avatar) user.avatar = avatar; // Simple update for avatar URL

    await user.save();

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          roles: user.roles,
          isActive: user.isActive,
          isVerified: user.isVerified,
          country: user.country,
          timezone: user.timezone
        }
      }
    });
  } catch (error) {
    next(errorHandler(500, "Server error while updating user"));
  }
};
```

#### `updateUserStatus(userId, status)`
**Purpose:** Activate or deactivate a user  
**Access:** Admin  
**Validation:** User must exist  
**Process:** Update `isActive` and save  
**Response:** Updated status

**Controller Implementation:**
```javascript
export const updateUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isActive, roles } = req.body;
    const user = await User.findById(userId);

    // Ensure user exists
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Apply status change if provided
    if (isActive !== undefined) user.isActive = isActive;
    if (roles && Array.isArray(roles)) user.roles = roles;
    await user.save();

    res.status(200).json({
      success: true,
      message: "User status updated successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isActive: user.isActive,
          roles: user.roles
        }
      }
    });
  } catch (error) {
    next(errorHandler(500, "Server error while updating user status"));
  }
};
```

#### `setUserAdmin(userId)`
**Purpose:** Set user admin status  
**Access:** Admin  
**Validation:**
- User must exist
**Process:** Update `isAdmin` status and save  
**Response:** Updated admin status

**Controller Implementation:**
```javascript
export const setUserAdmin = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isAdmin } = req.body;
    const user = await User.findById(userId)
            .populate('roles', 'name description');

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    user.isAdmin = isAdmin;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${isAdmin ? 'promoted to' : 'removed from'} admin successfully`,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
          roles: user.roles
        }
      }
    });
  } catch (error) {
    next(errorHandler(500, "Server error while updating user admin status"));
  }
};
```

#### `getUserRoles(userId)`
**Purpose:** Get roles for a user  
**Access:** Admin/Staff  
**Validation:** User must exist  
**Process:** Populate role details  
**Response:** Role list

**Controller Implementation:**
```javascript
export const getUserRoles = async (req, res, next) => {
  try {
    const { userId } = req.params;
    // Load user with role details
    const user = await User.findById(userId).populate("roles", "name description");

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
          roles: user.roles
        }
      }
    });
  } catch (error) {
    next(errorHandler(500, "Server error while fetching user roles"));
  }
};
```

#### `deleteUser(userId)`
**Purpose:** Delete user account  
**Access:** Admin  
**Validation:**
- User must exist
- Admin cannot delete own account
**Process:** Delete user by id  
**Response:** Success confirmation

**Controller Implementation:**
```javascript
export const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Prevent deleting self
    if (req.user && String(req.user._id) === String(userId)) {
      return next(errorHandler(400, "You cannot delete your own account"));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    // Delete user record
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    next(errorHandler(500, "Server error while deleting user"));
  }
};
```

#### `adminCreateCustomer(userData)`
**Purpose:** Admin creates customer  
**Access:** Admin  
**Validation:**
- Required fields (name, email, phone)
- Unique email or phone
- Role exists (defaults to customer)
**Process:** Create user with default password and role  
**Response:** Created user summary

**Controller Implementation:**
```javascript
export const adminCreateCustomer = async (req, res, next) => {
  try {
    const { name, email, phone, roles } = req.body;

    // Validate required fields
    if (!name || !email || !phone) {
      return next(errorHandler(400, "name, email and phone are required"));
    }

    // Enforce unique email/phone
    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }]
    });
    if (existing) {
      return next(
        errorHandler(400, `A user with this ${existing.email === email ? "email" : "phone"} already exists`)
      );
    }

    // Hash phone as initial password
    const passwordHash = bcrypt.hashSync(String(phone), 12);
    
    // Determine roles: provided or default 'customer'
    let roleIds = []
    if (Array.isArray(roles) && roles.length > 0) {
        roleIds = roles
    } else {
        const customerRole = await Role.findOne({ name: 'customer' })
        if (customerRole) {
            roleIds = [customerRole._id]
        }
    }


    // Create user document
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password: passwordHash,
      roles: roleIds,
      isActive: true,
      isVerified: false
    });

    // Populate roles for response
    await user.populate("roles", "name description");

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          roles: user.roles,
          isActive: user.isActive,
          isVerified: user.isVerified,
          avatar: user.avatar,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    next(errorHandler(500, "Server error while creating customer"));
  }
};
```


## 🧾 User Routes

### Base Path: `/api/users`

```typescript
GET    /profile                   // Get current user profile
PUT    /profile                   // Update own profile
PUT    /change-password           // Change password
GET    /notifications             // Get notification preferences
PUT    /notifications             // Update notification preferences
POST   /admin-create              // Admin create customer
GET    /                         // Get all users (admin)
GET    /:userId                   // Get single user (admin)
PUT    /:userId                   // Update user (admin)
PUT    /:userId/status           // Update user status (admin)
PUT    /:userId/admin             // Set user admin role (admin)
GET    /:userId/roles            // Get user roles (admin)
DELETE /:userId                  // Delete user (admin)
```

### Router Implementation

**File: `../routes/userRoute.js`**

```javascript
import express from "express"
import { 
    getUserProfile, 
    updateUserProfile, 
    changePassword,
    getNotificationPreferences, 
    updateNotificationPreferences,
    getAllUsers, 
    getUserById, 
    updateUserStatus,
    setUserAdmin,
    getUserRoles,
    deleteUser,
    adminCreateCustomer
} from "../controllers/userController.js"
import { verifyBearerToken, requireAdmin } from "../utils/verify.js"


const router = express.Router()


// Protected routes - require authentication
router.use(verifyBearerToken)


// User profile routes
router.get('/profile', getUserProfile)

router.put('/profile', updateUserProfile)

router.put('/change-password', changePassword)


// Notification preferences routes
router.get('/notifications', getNotificationPreferences)

router.put('/notifications', updateNotificationPreferences)


// Admin-only routes
router.get('/', requireAdmin, getAllUsers)

router.get('/:userId', requireAdmin, getUserById)

router.put('/:userId/status', requireAdmin, updateUserStatus)

router.delete('/:userId', requireAdmin, deleteUser)

router.put('/:userId/admin', requireAdmin, setUserAdmin)

router.get('/:userId/roles', requireAdmin, getUserRoles)

router.post('/admin-create', requireAdmin, adminCreateCustomer)


export default router;
```

### Route Details

#### `GET /api/users/profile`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "John Doe",
      "email": "john@teokicks.com"
    }
  }
}
```

#### `PUT /api/users/profile`
**Headers:** `Authorization: Bearer <token>`
**Body (JSON):**
```json
{
  "name": "John Smith",
  "phone": "+254712345679",
  "avatar": "https://example.com/new_avatar.jpg",
  "country": "Kenya",
  "timezone": "Africa/Nairobi"
}
```
**Notes:**
- To remove the avatar, send `avatar: null` or an empty string in JSON.
**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

#### `PUT /api/users/change-password`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword123"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

#### `GET /api/users/notifications`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "notificationPreferences": {
      "email": true,
      "sms": true,
      "inApp": true,
      "orderUpdates": true,
      "promotions": false,
      "stockAlerts": false
    }
  }
}
```

#### `PUT /api/users/notifications`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "email": true,
  "sms": false,
  "inApp": true,
  "orderUpdates": true,
  "promotions": false,
  "stockAlerts": false
}
```
**Response:**
```json
{
  "success": true,
  "message": "Notification preferences updated successfully"
}
```

#### `POST /api/users/admin-create`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "name": "Jane Customer",
  "email": "jane@customer.com",
  "phone": "+254712345680",
  "roles": ["<customer_role_id>"] // Optional, defaults to customer
}
```
**Response:**
```json
{
  "success": true,
  "message": "Customer created successfully",
  "data": {
    "user": {
      "id": "...",
      "name": "Jane Customer",
      "email": "jane@customer.com"
    }
  }
}
```

#### `GET /api/users`
**Headers:** `Authorization: Bearer <admin_token>`
**Query:** `page`, `limit`, `search`, `role`, `status`
**Response:**
```json
{
  "success": true,
  "data": {
    "users": [],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalUsers": 0
    }
  }
}
```
**Notes:**
- This project does not have a `service` model directly associated with users.


#### `GET /api/users/:userId`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "John Doe",
      "email": "john@teokicks.com"
    }
  }
}
```

#### `PUT /api/users/:userId/status`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "isActive": false
}
```
**Response:**
```json
{
  "success": true,
  "message": "User status updated successfully"
}
```

#### `PUT /api/users/:userId/admin`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "isAdmin": true
}
```
**Response:**
```json
{
  "success": true,
  "message": "User promoted to admin successfully",
  "data": {
    "user": {
      "id": "...",
      "name": "John Doe",
      "email": "john@teokicks.com",
      "isAdmin": true,
      "roles": []
    }
  }
}
```

#### `GET /api/users/:userId/roles`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "John Doe",
      "email": "john@teokicks.com",
      "isAdmin": false,
      "roles": []
    }
  }
}
```

#### `DELETE /api/users/:userId`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `verifyBearerToken`
**Purpose:** Verify JWT token  
**Usage:**
```javascript
import { verifyBearerToken } from '../utils/verify.js';
router.get('/profile', verifyBearerToken, getUserProfile);
```

#### `requireRole(allowedRoles)`
**Purpose:** Check user permissions  
**Usage:**
```javascript
import { requireRole } from '../utils/verify.js';
router.get('/', verifyBearerToken, requireRole(['admin']), getAllUsers);
```

#### `requireAdmin`
**Purpose:** Admin access only  
**Usage:**
```javascript
import { requireAdmin } from '../utils/verify.js';
router.delete('/:userId', verifyBearerToken, requireAdmin, deleteUser);
```

---

## 📝 API Examples

### Get Current User Profile
```bash
curl -X GET http://localhost:5000/api/users/profile \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "John Doe",
      "email": "john@teokicks.com"
    }
  }
}
```

### Update Profile
```bash
curl -X PUT http://localhost:5000/api/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "name": "John Smith",
    "phone": "+254712345679",
    "avatar": "https://example.com/new_avatar.jpg",
    "country": "Kenya",
    "timezone": "Africa/Nairobi"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

### Change Password
```bash
curl -X PUT http://localhost:5000/api/users/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "currentPassword": "oldPassword123",
    "newPassword": "newSecurePassword123"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### Admin Create Customer
```bash
curl -X POST http://localhost:5000/api/users/admin-create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_access_token>" \
  -d '{
    "name": "Jane Customer",
    "email": "jane@customer.com",
    "phone": "+254712345680",
    "roles": ["<customer_role_id>"]
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Customer created successfully",
  "data": {
    "user": {
      "id": "...",
      "name": "Jane Customer",
      "email": "jane@customer.com"
    }
  }
}
```

---

## 🛡️ Security Features

- **RBAC:** Route-level authorization via `verifyBearerToken`, `requireRole`, `requireAdmin`.
- **Least Privilege:** Sensitive actions limited to `admin` (delete, role changes).
- **Sensitive Fields Excluded:** Password, OTP, reset tokens never returned.
- **Ownership:** Self-service endpoints operate on `req.user._id`.

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "User not found" }
```

---

## 📊 Database Indexes

```javascript
userSchema.index({ phone: 1 });
userSchema.index({ roles: 1 });
userSchema.index({ 'oauthProviders.provider': 1, 'oauthProviders.providerUserId': 1 });
```

---

**Last Updated:** February 2026  
**Version:** 1.0.0
