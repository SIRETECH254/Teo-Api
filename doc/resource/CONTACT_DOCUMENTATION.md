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

---

## 🎮 Contact Controller

**File: `../controllers/contactController.js`**

### Functions Overview

#### `createContact()`
**Purpose:** Create a new contact message.  
**Access:** Public (Optional authentication to link message to user account).  
**Validation:** `name`, `email`, `subject`, and `message` are required.

#### `getAllContacts()`
**Purpose:** Retrieve all contact messages with pagination and filtering.  
**Access:** Private (Admin)  
**Query Parameters:** `page`, `limit`, `status`, `search`.

#### `getUserContacts()`
**Purpose:** Retrieve messages sent by the logged-in user.  
**Access:** Private (Authenticated User)

#### `getContactById()`
**Purpose:** Retrieve a single contact message by ID.  
**Access:** Private (Admin or Message Owner)

#### `replyToContact()`
**Purpose:** Admin reply to a message. Updates status and sends an email.  
**Access:** Private (Admin)

#### `deleteContact()`
**Purpose:** Delete a contact message.  
**Access:** Private (Admin)

---

## 📦 Contact Routes

### Base Path: `/api/contact`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/` | Public | Send a contact message |
| GET | `/my-messages` | User | Get logged-in user's messages |
| GET | `/` | Admin | Get all messages (paginated) |
| GET | `/:id` | Admin/Owner | Get message by ID |
| POST | `/:id/reply` | Admin | Reply to a message |
| DELETE | `/:id` | Admin | Delete a message |

---

## 🚀 API Examples

### Send a Message
**POST** `/api/contact`
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Order Inquiry",
  "message": "I haven't received my order #12345 yet. Can you please check?"
}
```

### Reply to a Message (Admin)
**POST** `/api/contact/:id/reply`
```json
{
  "replyMessage": "Hello John, we've checked your order and it's currently with our delivery partner. You should receive it by tomorrow."
}
```
