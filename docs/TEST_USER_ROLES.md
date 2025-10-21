# User Roles Test Documentation

## ✅ **Default Role Configuration**

### **User Model Setup:**
```javascript
roles: { 
    type: [String], 
    enum: ["customer", "staff", "admin", "rider"], 
    default: ["customer"] 
}
```

### **Registration Behavior:**
When a user registers, they automatically get:
- `roles: ["customer"]` - Default role assigned
- No explicit role setting needed in controller
- Mongoose applies the default automatically

---

## 🧪 **Test Cases**

### **1. Standard Registration:**
```json
POST /api/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "0712345678",
  "password": "SecurePass123!"
}
```

**Expected User Object:**
```javascript
{
  _id: "...",
  name: "John Doe",
  email: "john@example.com",
  phone: "0712345678",
  roles: ["customer"],        // ✅ Default role applied
  isVerified: false,
  // ... other fields
}
```

### **2. After OTP Verification:**
```json
POST /api/auth/verify-otp
{
  "email": "john@example.com",
  "otp": "123456"
}
```

**Response includes:**
```json
{
  "success": true,
  "data": {
    "user": {
      "roles": ["customer"]    // ✅ Customer role confirmed
    }
  }
}
```

---

## 🔧 **Role Methods Available:**

### **Check Customer Role:**
```javascript
user.hasRole('customer')     // Returns: true
user.hasRole('admin')        // Returns: false
user.isAdmin()              // Returns: false
```

### **Role-Based Access:**
```javascript
// In middleware/routes
requireRole('customer')      // ✅ Allows customer access
requireRole('admin')         // ❌ Denies access
requireAdmin()              // ❌ Denies access
```

---

## 🎯 **Role Assignment Scenarios:**

### **Default (Registration):**
- ✅ `roles: ["customer"]` - Automatic

### **Admin Assignment (Manual):**
```javascript
// Admin can upgrade user roles
user.roles = ["customer", "staff"]
user.roles = ["admin"]
user.roles = ["rider"]
```

### **Multiple Roles Possible:**
```javascript
user.roles = ["customer", "staff", "admin"]
```

---

## ✅ **Verification Checklist:**

1. **Default Role:** ✅ Customer assigned automatically
2. **No Override:** ✅ Controller doesn't set roles explicitly  
3. **Schema Validation:** ✅ Only valid roles allowed
4. **Helper Methods:** ✅ Role checking methods available
5. **Middleware Ready:** ✅ Works with auth middleware

**All new users will have the "customer" role by default!** 🎉