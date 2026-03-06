# 🔐 TEO KICKS API - Role Management Documentation

## 📋 Table of Contents
- [Role Management Overview](#role-management-overview)
- [Role Model](#-role-model)
- [Role Controller](#-role-controller)
- [Role Routes](#-role-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Role Management Overview

Role Management provides a comprehensive role-based access control (RBAC) system for the TEO KICKS API. Roles define user permissions and access levels throughout the system. Users can be assigned multiple roles, and administrators have full access to all role management operations. The system includes default roles (customer, rider, staff) that can be initialized automatically. Roles cannot be deleted if they are currently assigned to any users.

---

## 👤 Role Model

### Schema Definition
```typescript
interface IRole {
  _id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdBy: string; // User ObjectId
  updatedBy?: string; // User ObjectId
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/roleModel.js`**

```javascript
import mongoose from "mongoose"

const roleSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        lowercase: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
})

// Index for better query performance
// Note: name index is automatically created due to unique: true
roleSchema.index({ isActive: 1 })

// Static method to create default roles
roleSchema.statics.createDefaultRoles = async function(adminUserId) {
    const defaultRoles = [
        {
            name: 'customer',
            description: 'Regular customer with basic shopping permissions',
            createdBy: adminUserId
        },
        {
            name: 'rider',
            description: 'Delivery personnel with order fulfillment permissions',
            createdBy: adminUserId
        },
        {
            name: 'staff',
            description: 'Internal staff with product and order management permissions',
            createdBy: adminUserId
        }
    ]

    for (const roleData of defaultRoles) {
        const existingRole = await this.findOne({ name: roleData.name })
        if (!existingRole) {
            await this.create(roleData)
        }
    }
}

const Role = mongoose.model("Role", roleSchema)

export default Role
```

### Validation Rules
```javascript
name:        { required: true, type: String, unique: true, trim: true, lowercase: true }
description: { required: true, type: String, trim: true }
isActive:    { type: Boolean, default: true }
createdBy:   { required: true, type: ObjectId, ref: 'User' }
updatedBy:   { type: ObjectId, ref: 'User' }
```

### Static Methods

#### `createDefaultRoles(adminUserId)`
**Purpose:** Initialize default roles in the system.  
**Parameters:** `adminUserId` - The ObjectId of the admin user creating the roles.  
**Process:** Creates three default roles (customer, rider, staff) if they don't already exist.  
**Returns:** Promise that resolves when all default roles are created.

---

## 🎮 Role Controller

### Required Imports
```javascript
import Role from "../models/roleModel.js"
import User from "../models/userModel.js"
import { errorHandler } from "../utils/error.js"
```

### Functions Overview

#### `createRole()`
**Purpose:** Create a new role in the system.  
**Access:** Private (Admin)  
**Validation:** `name` and `description` are required. Checks for existing role with the same name (case-insensitive).  
**Process:** Converts role name to lowercase, creates a new `Role` document, and saves it.  
**Response:** The newly created role object with populated `createdBy` field.

**Controller Implementation:**
```javascript
export const createRole = async (req, res, next) => {
    try {
        const { name, description } = req.body

        // Check if user is admin
        if (!req.user.isAdmin) {
            return next(errorHandler(403, "Access denied. Admin privileges required."))
        }

        // Check if role already exists
        const existingRole = await Role.findOne({ name: name.toLowerCase() })
        if (existingRole) {
            return next(errorHandler(400, "Role with this name already exists"))
        }

        // Create new role
        const role = await Role.create({
            name: name.toLowerCase(),
            description,
            createdBy: req.user._id
        })

        await role.populate('createdBy', 'name email')

        res.status(201).json({
            success: true,
            message: "Role created successfully",
            data: { role }
        })
    } catch (error) {
        console.error('Create role error:', error)
        next(errorHandler(500, "Server error while creating role"))
    }
}
```

#### `getAllRoles()`
**Purpose:** Get all roles with optional pagination, search, and active status filters.  
**Access:** Private (Admin)  
**Validation:** Optional query parameters for `page`, `limit`, `search`, `isActive`.  
**Process:** Queries roles based on filters, populates `createdBy` and `updatedBy` fields, and returns paginated results.  
**Response:** Paginated list of role objects.

**Controller Implementation:**
```javascript
export const getAllRoles = async (req, res, next) => {
    try {
        // Check if user is admin
        if (!req.user.isAdmin) {
            return next(errorHandler(403, "Access denied. Admin privileges required."))
        }

        const { page = 1, limit = 10, search, isActive } = req.query
        const query = {}

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ]
        }

        if (isActive !== undefined) {
            query.isActive = isActive === 'true'
        }

        const pageNum = parseInt(page)
        const limitNum = parseInt(limit)
        const total = await Role.countDocuments(query)

        const roles = await Role.find(query)
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email')
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)

        res.status(200).json({
            success: true,
            data: {
                roles,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.max(1, Math.ceil(total / (limitNum || 1))),
                    total,
                    hasNextPage: pageNum < Math.ceil(total / (limitNum || 1)),
                    hasPrevPage: pageNum > 1
                }
            }
        })
    } catch (error) {
        console.error('Get all roles error:', error)
        next(errorHandler(500, "Server error while fetching roles"))
    }
}
```

#### `getRoleById()`
**Purpose:** Get a single role by its ID.  
**Access:** Private (Admin)  
**Validation:** `id` in params.  
**Process:** Finds the role by ID and populates `createdBy` and `updatedBy` user details.  
**Response:** A single role object.

**Controller Implementation:**
```javascript
export const getRoleById = async (req, res, next) => {
    try {
        // Check if user is admin
        if (!req.user.isAdmin) {
            return next(errorHandler(403, "Access denied. Admin privileges required."))
        }

        const role = await Role.findById(req.params.id)
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email')

        if (!role) {
            return next(errorHandler(404, "Role not found"))
        }

        res.status(200).json({
            success: true,
            data: { role }
        })
    } catch (error) {
        console.error('Get role by ID error:', error)
        next(errorHandler(500, "Server error while fetching role"))
    }
}
```

#### `updateRole()`
**Purpose:** Update an existing role.  
**Access:** Private (Admin)  
**Validation:** `id` in params. Checks for name conflicts if name is being updated.  
**Process:** Finds and updates the role. If `name` is changed, validates uniqueness. Updates `updatedBy` field.  
**Response:** The updated role object.

**Controller Implementation:**
```javascript
export const updateRole = async (req, res, next) => {
    try {
        // Check if user is admin
        if (!req.user.isAdmin) {
            return next(errorHandler(403, "Access denied. Admin privileges required."))
        }

        const { name, description, isActive } = req.body
        const role = await Role.findById(req.params.id)

        if (!role) {
            return next(errorHandler(404, "Role not found"))
        }

        // Check if new name conflicts with existing role
        if (name && name.toLowerCase() !== role.name) {
            const existingRole = await Role.findOne({ 
                name: name.toLowerCase(),
                _id: { $ne: req.params.id }
            })
            if (existingRole) {
                return next(errorHandler(400, "Role with this name already exists"))
            }
        }

        // Update role fields
        if (name) role.name = name.toLowerCase()
        if (description) role.description = description
        if (isActive !== undefined) role.isActive = isActive
        role.updatedBy = req.user._id

        await role.save()

        await role.populate([
            { path: 'createdBy', select: 'name email' },
            { path: 'updatedBy', select: 'name email' }
        ])

        res.status(200).json({
            success: true,
            message: "Role updated successfully",
            data: { role }
        })
    } catch (error) {
        console.error('Update role error:', error)
        next(errorHandler(500, "Server error while updating role"))
    }
}
```

#### `deleteRole()`
**Purpose:** Delete a role from the system.  
**Access:** Private (Admin)  
**Validation:** `id` in params. Prevents deletion if role is assigned to any users.  
**Process:** Checks if role is assigned to users, then deletes the role if safe.  
**Response:** Success message.

**Controller Implementation:**
```javascript
export const deleteRole = async (req, res, next) => {
    try {
        // Check if user is admin
        if (!req.user.isAdmin) {
            return next(errorHandler(403, "Access denied. Admin privileges required."))
        }

        const role = await Role.findById(req.params.id)
        if (!role) {
            return next(errorHandler(404, "Role not found"))
        }

        // Check if role is assigned to any users
        const usersWithRole = await User.countDocuments({ roles: req.params.id })
        if (usersWithRole > 0) {
            return next(errorHandler(400, `Cannot delete role. It is assigned to ${usersWithRole} user(s). Please reassign users before deleting.`))
        }

        await Role.findByIdAndDelete(req.params.id)

        res.status(200).json({
            success: true,
            message: "Role deleted successfully"
        })
    } catch (error) {
        console.error('Delete role error:', error)
        next(errorHandler(500, "Server error while deleting role"))
    }
}
```

#### `assignRoleToUser()`
**Purpose:** Assign a role to a user.  
**Access:** Private (Admin)  
**Validation:** `roleId` and `userId` in params. Verifies both role and user exist. Checks if user already has the role.  
**Process:** Uses User model's `addRole()` method to add the role, saves the user, and populates roles.  
**Response:** Updated user object with assigned roles.

**Controller Implementation:**
```javascript
export const assignRoleToUser = async (req, res, next) => {
    try {
        // Check if user is admin
        if (!req.user.isAdmin) {
            return next(errorHandler(403, "Access denied. Admin privileges required."))
        }

        const { roleId, userId } = req.params

        // Verify role exists
        const role = await Role.findById(roleId)
        if (!role) {
            return next(errorHandler(404, "Role not found"))
        }

        // Verify user exists
        const user = await User.findById(userId)
        if (!user) {
            return next(errorHandler(404, "User not found"))
        }

        // Check if user already has this role
        if (user.roles.includes(roleId)) {
            return next(errorHandler(400, "User already has this role"))
        }

        // Add role to user
        user.addRole(roleId)
        await user.save()

        await user.populate('roles', 'name description')

        res.status(200).json({
            success: true,
            message: "Role assigned successfully",
            data: { 
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    roles: user.roles
                }
            }
        })
    } catch (error) {
        console.error('Assign role error:', error)
        next(errorHandler(500, "Server error while assigning role"))
    }
}
```

#### `removeRoleFromUser()`
**Purpose:** Remove a role from a user.  
**Access:** Private (Admin)  
**Validation:** `roleId` and `userId` in params. Verifies user exists and has the role.  
**Process:** Uses User model's `removeRole()` method to remove the role, saves the user, and populates roles.  
**Response:** Updated user object with remaining roles.

**Controller Implementation:**
```javascript
export const removeRoleFromUser = async (req, res, next) => {
    try {
        // Check if user is admin
        if (!req.user.isAdmin) {
            return next(errorHandler(403, "Access denied. Admin privileges required."))
        }

        const { roleId, userId } = req.params

        // Verify user exists
        const user = await User.findById(userId)
        if (!user) {
            return next(errorHandler(404, "User not found"))
        }

        // Check if user has this role
        if (!user.roles.includes(roleId)) {
            return next(errorHandler(400, "User does not have this role"))
        }

        // Remove role from user
        user.removeRole(roleId)
        await user.save()

        await user.populate('roles', 'name description')

        res.status(200).json({
            success: true,
            message: "Role removed successfully",
            data: { 
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    roles: user.roles
                }
            }
        })
    } catch (error) {
        console.error('Remove role error:', error)
        next(errorHandler(500, "Server error while removing role"))
    }
}
```

#### `getUsersByRole()`
**Purpose:** Get all users assigned to a specific role.  
**Access:** Private (Admin)  
**Validation:** `id` in params. Optional query parameters for `page` and `limit`.  
**Process:** Uses User model's pagination to find users with the specified role.  
**Response:** Paginated list of users with the role.

**Controller Implementation:**
```javascript
export const getUsersByRole = async (req, res, next) => {
    try {
        // Check if user is admin
        if (!req.user.isAdmin) {
            return next(errorHandler(403, "Access denied. Admin privileges required."))
        }

        const { page = 1, limit = 10 } = req.query
        const role = await Role.findById(req.params.id)

        if (!role) {
            return next(errorHandler(404, "Role not found"))
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            select: 'name email phone isAdmin isActive createdAt',
            populate: {
                path: 'roles',
                select: 'name displayName'
            },
            sort: { createdAt: -1 }
        }

        const users = await User.paginate({ roles: req.params.id }, options)

        res.status(200).json({
            success: true,
            data: { 
                role: {
                    id: role._id,
                    name: role.name,
                    displayName: role.displayName
                },
                users 
            }
        })
    } catch (error) {
        console.error('Get users by role error:', error)
        next(errorHandler(500, "Server error while fetching users by role"))
    }
}
```

---

## 🏷️ Role Routes

### Base Path: `/api/roles`

### Router Implementation

**File: `../routes/roleRoute.js`**

```javascript
import express from "express"
import { 
    createRole,
    getAllRoles,
    getRoleById,
    updateRole,
    deleteRole,
    assignRoleToUser,
    removeRoleFromUser,
    getUsersByRole
} from "../controllers/roleController.js"
import { verifyBearerToken, requireAdmin } from "../utils/verify.js"

const router = express.Router()

// All role routes require authentication
router.use(verifyBearerToken)

router.post('/', createRole)
router.get('/', getAllRoles)
router.get('/:id', getRoleById)
router.put('/:id', updateRole)
router.delete('/:id', deleteRole)
router.post('/:roleId/assign/:userId', assignRoleToUser)
router.delete('/:roleId/remove/:userId', removeRoleFromUser)
router.get('/:id/users', getUsersByRole)

export default router
```

### Route Details

#### `POST /api/roles`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Body (JSON):**  
```json
{
  "name": "manager",
  "description": "Store manager with elevated permissions"
}
```
**Purpose:** Create a new role in the system.  
**Access:** Private (Admin Only)  
**Response:** `201 Created` with the details of the newly created role.

#### `GET /api/roles`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Query Parameters:** `page`, `limit`, `search`, `isActive`  
**Purpose:** Retrieve a paginated list of all roles.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with paginated role data.

#### `GET /api/roles/:id`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `id` (path) - The ID of the role to retrieve.  
**Purpose:** Retrieve a single role by its unique identifier.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with the role object, or `404 Not Found`.

#### `PUT /api/roles/:id`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `id` (path) - The ID of the role to update.  
**Body (JSON):** (partial update allowed)  
```json
{
  "name": "updated-role-name",
  "description": "Updated description",
  "isActive": false
}
```
**Purpose:** Update the details of an existing role.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with the updated role object.

#### `DELETE /api/roles/:id`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `id` (path) - The ID of the role to delete.  
**Purpose:** Delete a role from the system. Cannot delete if role is assigned to users.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with a success message, or `400 Bad Request` if role is assigned to users.

#### `POST /api/roles/:roleId/assign/:userId`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** 
- `roleId` (path) - The ID of the role to assign.
- `userId` (path) - The ID of the user to assign the role to.
**Purpose:** Assign a role to a user.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with the updated user object including assigned roles.

#### `DELETE /api/roles/:roleId/remove/:userId`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** 
- `roleId` (path) - The ID of the role to remove.
- `userId` (path) - The ID of the user to remove the role from.
**Purpose:** Remove a role from a user.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with the updated user object with remaining roles.

#### `GET /api/roles/:id/users`
**Headers:** `Authorization: Bearer <admin_access_token>`  
**Parameters:** `id` (path) - The ID of the role.  
**Query Parameters:** `page`, `limit`  
**Purpose:** Retrieve all users assigned to a specific role.  
**Access:** Private (Admin Only)  
**Response:** `200 OK` with paginated list of users with the role.

---

## 🔐 Middleware

- `verifyBearerToken`: Used on `router.use(verifyBearerToken)` to protect all role routes. Verifies JWT token from Authorization header and populates `req.user` with user data including roles.
- `requireAdmin`: All role management operations require admin privileges. This is checked within each controller function by verifying `req.user.isAdmin`.

---

## 📝 API Examples

### Create a New Role
```bash
curl -X POST http://localhost:5000/api/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_access_token>" \
  -d '{
    "name": "manager",
    "description": "Store manager with elevated permissions"
  }'
```

### Get All Roles with Pagination
```bash
curl -X GET "http://localhost:5000/api/roles?page=1&limit=10&isActive=true" \
  -H "Authorization: Bearer <admin_access_token>"
```

### Assign Role to User
```bash
curl -X POST http://localhost:5000/api/roles/<role_id>/assign/<user_id> \
  -H "Authorization: Bearer <admin_access_token>"
```

### Get Users by Role
```bash
curl -X GET "http://localhost:5000/api/roles/<role_id>/users?page=1&limit=10" \
  -H "Authorization: Bearer <admin_access_token>"
```

### Update a Role
```bash
curl -X PUT http://localhost:5000/api/roles/<role_id> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_access_token>" \
  -d '{
    "description": "Updated role description",
    "isActive": true
  }'
```

---

## 🛡️ Security Features

- **Authentication:** All role endpoints require a valid JWT token via the `Authorization: Bearer <token>` header.
- **Authorization:** All role management operations are restricted to users with admin privileges (`isAdmin: true`).
- **Role Name Uniqueness:** Role names are automatically converted to lowercase and must be unique across the system.
- **Deletion Protection:** Roles cannot be deleted if they are currently assigned to any users, preventing orphaned role references.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

- `400 Bad Request`: Invalid input, missing required fields, role name already exists, role is assigned to users (on delete), or user already has/doesn't have the role (on assign/remove).
- `401 Unauthorized`: Missing or invalid authentication token.
- `403 Forbidden`: Access denied - non-admin attempting an admin operation.
- `404 Not Found`: The requested role or user was not found.
- `500 Internal Server Error`: An unexpected server-side error occurred during processing.

---

## 📊 Database Indexes

- `name: 1` (unique): Ensures fast and unique lookup by the role's name (case-insensitive).
- `isActive: 1`: Facilitates efficient filtering of roles by their active status.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
