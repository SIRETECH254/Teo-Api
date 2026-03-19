# 📧 TEO KICKS API - Contact Management Documentation

## 📋 Table of Contents
- [Contact Management Overview](#contact-management-overview)
- [Contact Model](#-contact-model)
- [Contact Controller](#-contact-controller)
- [Contact Routes](#-contact-routes)
- [API Examples](#-api-examples)

---

## Contact Management Overview

Contact Management allows users to send inquiries, feedback, or support requests to the TEO KICKS team. Admins can view these messages, manage their status, and reply directly via email through the API. Logged-in users can also track their message history.

---

## 👤 Contact Model

### Schema Definition
```typescript
interface IContact {
  _id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  userId?: string; // User ObjectId (optional)
  status: "New" | "Read" | "Replied";
  replies: Array<{
    message: string;
    repliedBy: string; // User ObjectId (Admin)
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation
**File: `../models/contactModel.js`**

```javascript
import mongoose from "mongoose"
import mongoosePaginate from "mongoose-paginate-v2"

const contactReplySchema = new mongoose.Schema({
    message: {
        type: String,
        required: true,
        trim: true
    },
    repliedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

const contactSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    status: {
        type: String,
        enum: ['New', 'Read', 'Replied'],
        default: 'New'
    },
    replies: [contactReplySchema]
}, {
    timestamps: true
})

// Indexes for better query performance
contactSchema.index({ email: 1 })
contactSchema.index({ status: 1 })
contactSchema.index({ userId: 1 })
contactSchema.index({ createdAt: -1 })

// Add pagination plugin
contactSchema.plugin(mongoosePaginate)

const Contact = mongoose.model('Contact', contactSchema)

export default Contact
```

---

## 🎮 Contact Controller

**File: `../controllers/contactController.js`**

### Required Imports
```javascript
import Contact from "../models/contactModel.js"
import { errorHandler } from "../utils/error.js"
import { sendContactReplyEmail } from "../services/external/emailService.js"
```

### Functions Overview

#### `createContact()`
**Purpose:** Create a new contact message.  
**Access:** Public (Optional authentication to link message to user account).  
**Validation:** `name`, `email`, `subject`, and `message` are required.

**Controller Implementation:**
```javascript
export const createContact = async (req, res, next) => {
    try {
        const { name, email, subject, message } = req.body

        if (!name || !email || !subject || !message) {
            return next(errorHandler(400, "All fields (name, email, subject, message) are required"))
        }

        const contact = new Contact({
            name,
            email,
            subject,
            message,
            // If user is logged in (middleware might have attached req.user), attach userId
            userId: req.user ? req.user._id : undefined
        })

        await contact.save()

        res.status(201).json({
            success: true,
            message: "Your message has been sent successfully. We will get back to you soon!",
            data: contact
        })
    } catch (error) {
        console.error("Create contact error:", error)
        next(errorHandler(500, "Server error while sending message"))
    }
}
```

#### `getAllContacts()`
**Purpose:** Retrieve all contact messages with pagination and filtering.  
**Access:** Private (Admin)  
**Query Parameters:** `page`, `limit`, `status`, `search`.

**Controller Implementation:**
```javascript
export const getAllContacts = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query

        const query = {}

        if (status) {
            query.status = status
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } }
            ]
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { createdAt: -1 },
            populate: [
                { path: 'userId', select: 'name email' },
                { path: 'replies.repliedBy', select: 'name email' }
            ]
        }

        const contacts = await Contact.paginate(query, options)

        res.status(200).json({
            success: true,
            message: "Contacts retrieved successfully",
            data: contacts.docs,
            pagination: {
                page: contacts.page,
                limit: contacts.limit,
                totalDocs: contacts.totalDocs,
                totalPages: contacts.totalPages,
                hasNextPage: contacts.hasNextPage,
                hasPrevPage: contacts.hasPrevPage
            }
        })
    } catch (error) {
        console.error("Get all contacts error:", error)
        next(errorHandler(500, "Server error while retrieving messages"))
    }
}
```

#### `getUserContacts()`
**Purpose:** Retrieve messages sent by the logged-in user.  
**Access:** Private (Authenticated User)

**Controller Implementation:**
```javascript
export const getUserContacts = async (req, res, next) => {
    try {
        const userId = req.user._id
        const { page = 1, limit = 10 } = req.query

        const query = { userId }
        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { createdAt: -1 },
            populate: [
                { path: 'replies.repliedBy', select: 'name' }
            ]
        }

        const contacts = await Contact.paginate(query, options)

        res.status(200).json({
            success: true,
            message: "Your messages retrieved successfully",
            data: contacts.docs,
            pagination: {
                page: contacts.page,
                limit: contacts.limit,
                totalDocs: contacts.totalDocs,
                totalPages: contacts.totalPages
            }
        })
    } catch (error) {
        console.error("Get user contacts error:", error)
        next(errorHandler(500, "Server error while retrieving your messages"))
    }
}
```

#### `getContactById()`
**Purpose:** Retrieve a single contact message by ID.  
**Access:** Private (Admin or Message Owner)

**Controller Implementation:**
```javascript
export const getContactById = async (req, res, next) => {
    try {
        const { id } = req.params
        const contact = await Contact.findById(id)
            .populate('userId', 'name email')
            .populate('replies.repliedBy', 'name email')

        if (!contact) {
            return next(errorHandler(404, "Message not found"))
        }

        // Check authorization: Admin or Owner
        const isAdmin = req.user.isAdmin
        const isOwner = contact.userId && contact.userId._id.toString() === req.user._id.toString()

        if (!isAdmin && !isOwner) {
            return next(errorHandler(403, "Access denied"))
        }

        // If Admin is reading a 'New' message, update status to 'Read'
        if (isAdmin && contact.status === 'New') {
            contact.status = 'Read'
            await contact.save()
        }

        res.status(200).json({
            success: true,
            data: contact
        })
    } catch (error) {
        console.error("Get contact by ID error:", error)
        next(errorHandler(500, "Server error while retrieving message"))
    }
}
```

#### `replyToContact()`
**Purpose:** Admin reply to a message. Updates status and sends an email.  
**Access:** Private (Admin)

**Controller Implementation:**
```javascript
export const replyToContact = async (req, res, next) => {
    try {
        const { id } = req.params
        const { replyMessage } = req.body

        if (!replyMessage) {
            return next(errorHandler(400, "Reply message is required"))
        }

        const contact = await Contact.findById(id)

        if (!contact) {
            return next(errorHandler(404, "Message not found"))
        }

        // Add reply to the replies array
        contact.replies.push({
            message: replyMessage,
            repliedBy: req.user._id
        })

        // Update status to 'Replied'
        contact.status = 'Replied'
        await contact.save()

        // Send reply email
        try {
            await sendContactReplyEmail(contact.email, contact.name, contact.message, replyMessage)
        } catch (emailError) {
            console.error("Failed to send reply email:", emailError)
            // We don't fail the request if email fails, but maybe inform the user
        }

        res.status(200).json({
            success: true,
            message: "Reply sent successfully",
            data: contact
        })
    } catch (error) {
        console.error("Reply to contact error:", error)
        next(errorHandler(500, "Server error while replying to message"))
    }
}
```

#### `deleteContact()`
**Purpose:** Delete a contact message.  
**Access:** Private (Admin)

**Controller Implementation:**
```javascript
export const deleteContact = async (req, res, next) => {
    try {
        const { id } = req.params
        const contact = await Contact.findByIdAndDelete(id)

        if (!contact) {
            return next(errorHandler(404, "Message not found"))
        }

        res.status(200).json({
            success: true,
            message: "Message deleted successfully"
        })
    } catch (error) {
        console.error("Delete contact error:", error)
        next(errorHandler(500, "Server error while deleting message"))
    }
}
```

---

## 📦 Contact Routes

### Base Path: `/api/contact`

### Router Implementation
**File: `../routes/contactRoute.js`**

```javascript
import express from "express"
import { verifyBearerToken, requireAdmin } from "../utils/verify.js"
import { optionalAuth } from "../middlewares/auth.js"
import {
    createContact,
    getAllContacts,
    getUserContacts,
    getContactById,
    replyToContact,
    deleteContact
} from "../controllers/contactController.js"

const router = express.Router()

// Public route to send a contact message
// Using optionalAuth to capture user info if logged in, but not required
router.post("/", optionalAuth, createContact)

// Protected routes (require authentication)
router.use(verifyBearerToken)

// User routes
router.get("/my-messages", getUserContacts)
router.get("/:id", getContactById)

// Admin-only routes
router.get("/", requireAdmin, getAllContacts)
router.post("/:id/reply", requireAdmin, replyToContact)
router.delete("/:id", requireAdmin, deleteContact)

export default router
```

### Route Details

#### `POST /api/contact`
**Purpose:** Send a new contact message. Optionally links the message to a logged-in user.  
**Access:** Public (Authentication optional)  
**Headers:** (Optional) `Authorization: Bearer <token>` if user is logged in.  
**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "subject": "Inquiry about Product Availability",
  "message": "Hi, I'm interested in the 'Classic White Sneaker' (ID: 65e26b1c09b068c201383816). Is size 9 back in stock soon?"
}
```
**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Your message has been sent successfully. We will get back to you soon!",
  "data": {
    "name": "John Doe",
    "email": "john.doe@example.com",
    "subject": "Inquiry about Product Availability",
    "message": "Hi, I'm interested in the 'Classic White Sneaker' (ID: 65e26b1c09b068c201383816). Is size 9 back in stock soon?",
    "status": "New",
    "replies": [],
    "_id": "65e26b1c09b068c201383850",
    "createdAt": "2026-03-17T12:00:00.000Z",
    "updatedAt": "2026-03-17T12:00:00.000Z",
    "__v": 0
  }
}
```

#### `GET /api/contact/my-messages`
**Purpose:** Retrieve all contact messages submitted by the authenticated user.  
**Access:** Private (Authenticated User)  
**Headers:** `Authorization: Bearer <token>`  
**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Number of items per page (default: 10)
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Your messages retrieved successfully",
  "data": [
    {
      "_id": "65e26b1c09b068c201383850",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "subject": "Inquiry about Product Availability",
      "message": "Hi, I'm interested in the 'Classic White Sneaker' (ID: 65e26b1c09b068c201383816). Is size 9 back in stock soon?",
      "userId": "65e26b1c09b068c201383800",
      "status": "New",
      "replies": [],
      "createdAt": "2026-03-17T12:00:00.000Z",
      "updatedAt": "2026-03-17T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalDocs": 1,
    "totalPages": 1
  }
}
```

#### `GET /api/contact`
**Purpose:** Retrieve all contact messages (admin view).  
**Access:** Private (Admin)  
**Headers:** `Authorization: Bearer <admin_token>`  
**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Number of items per page (default: 10)
- `status`: Filter by message status (`New`, `Read`, `Replied`)
- `search`: Search term for name, email, or subject
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Contacts retrieved successfully",
  "data": [
    {
      "_id": "65e26b1c09b068c201383850",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "subject": "Inquiry about Product Availability",
      "message": "Hi, I'm interested in the 'Classic White Sneaker' (ID: 65e26b1c09b068c201383816). Is size 9 back in stock soon?",
      "userId": {
        "_id": "65e26b1c09b068c201383800",
        "name": "John Doe",
        "email": "john.doe@example.com"
      },
      "status": "New",
      "replies": [],
      "createdAt": "2026-03-17T12:00:00.000Z",
      "updatedAt": "2026-03-17T12:00:00.000Z"
    },
    {
      "_id": "65e26b1c09b068c201383851",
      "name": "Jane Smith",
      "email": "jane.smith@example.com",
      "subject": "Feedback on Website",
      "message": "The website navigation is a bit confusing on mobile. Could you improve it?",
      "status": "Replied",
      "replies": [
        {
          "message": "Thank you for your valuable feedback, Jane. We are constantly working to improve our mobile experience and will take your suggestions into consideration.",
          "repliedBy": {
            "_id": "65e26b1c09b068c201383801",
            "name": "Admin User",
            "email": "admin@example.com"
          },
          "createdAt": "2026-03-17T13:00:00.000Z",
          "_id": "65e26b1c09b068c201383852"
        }
      ],
      "createdAt": "2026-03-16T10:00:00.000Z",
      "updatedAt": "2026-03-17T13:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalDocs": 2,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

#### `GET /api/contact/:id`
**Purpose:** Retrieve a single contact message by its ID. Marks message as 'Read' if accessed by an Admin and status was 'New'.  
**Access:** Private (Admin or Message Owner)  
**Headers:** `Authorization: Bearer <token>`  
**Parameters:** `id` (path) - The ID of the contact message.  
**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "_id": "65e26b1c09b068c201383850",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "subject": "Inquiry about Product Availability",
    "message": "Hi, I'm interested in the 'Classic White Sneaker' (ID: 65e26b1c09b068c201383816). Is size 9 back in stock soon?",
    "userId": {
      "_id": "65e26b1c09b068c201383800",
      "name": "John Doe",
      "email": "john.doe@example.com"
    },
    "status": "Read",
    "replies": [],
    "createdAt": "2026-03-17T12:00:00.000Z",
    "updatedAt": "2026-03-17T12:05:00.000Z"
  }
}
```

#### `POST /api/contact/:id/reply`
**Purpose:** Send a reply to a specific contact message. Updates the message status to 'Replied' and sends an email to the original sender.  
**Access:** Private (Admin)  
**Headers:** `Authorization: Bearer <admin_token>`  
**Parameters:** `id` (path) - The ID of the contact message to reply to.  
**Request Body:**
```json
{
  "replyMessage": "Hello John, thank you for your patience. The 'Classic White Sneaker' in size 9 is expected to be back in stock within the next 2-3 weeks. We will notify you once it's available. Apologies for the delay!"
}
```
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Reply sent successfully",
  "data": {
    "_id": "65e26b1c09b068c201383850",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "subject": "Inquiry about Product Availability",
    "message": "Hi, I'm interested in the 'Classic White Sneaker' (ID: 65e26b1c09b068c201383816). Is size 9 back in stock soon?",
    "userId": "65e26b1c09b068c201383800",
    "status": "Replied",
    "replies": [
      {
        "message": "Hello John, thank you for your patience. The 'Classic White Sneaker' in size 9 is expected to be back in stock within the next 2-3 weeks. We will notify you once it's available. Apologies for the delay!",
        "repliedBy": "65e26b1c09b068c201383801",
        "createdAt": "2026-03-17T12:10:00.000Z",
        "_id": "65e26b1c09b068c201383853"
      }
    ],
    "createdAt": "2026-03-17T12:00:00.000Z",
    "updatedAt": "2026-03-17T12:10:00.000Z"
  }
}
```

#### `DELETE /api/contact/:id`
**Purpose:** Delete a contact message.  
**Access:** Private (Admin)  
**Headers:** `Authorization: Bearer <admin_token>`  
**Parameters:** `id` (path) - The ID of the contact message to delete.  
**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Message deleted successfully"
}
```
