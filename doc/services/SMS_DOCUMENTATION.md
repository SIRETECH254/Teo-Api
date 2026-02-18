# 📱 TEO KICKS API - SMS Service Documentation

## 📋 Table of Contents
- [SMS Service Overview](#sms-service-overview)
- [Configuration](#configuration)
- [Key Functions/Service Methods](#key-functionsservice-methods)
- [Usage in Internal Services](#usage-in-internal-services)
- [Usage in Controllers](#usage-in-controllers)
- [Error Handling](#error-handling)
- [API Examples](#api-examples)
- [Security & Compliance Notes](#security--compliance-notes)

---

## SMS Service Overview

The SMS service in TEO KICKS API utilizes Africa's Talking API to send various types of text messages, such as OTP codes, password reset links, welcome messages, and order notifications. It provides a robust and reliable way to communicate with users via SMS.

**Key Features:**
-   **OTP Delivery:** Sends one-time password codes for user verification.
-   **Password Reset Links:** Delivers secure links for password recovery.
-   **Welcome Messages:** Greets new users upon successful account verification.
-   **Order Notifications:** Sends order status updates (confirmed, packed, shipped, delivered).
-   **Phone Number Formatting:** Standardizes Kenyan phone numbers for API compatibility.

---

## Configuration

Africa's Talking API credentials are managed through environment variables and initialized in `server/services/external/smsService.js`. The service is only initialized if valid credentials are provided.

**Environment Variables:**
-   `AT_API_KEY`: Your Africa's Talking API Key.
-   `AT_USERNAME`: Your Africa's Talking Username.
-   `CLIENT_BASE_URL`: The base URL for the frontend application (used in password reset and order notification links).
-   `OTP_EXP_MINUTES` (Optional): OTP expiration time in minutes (default: 10).

**File: `server/services/external/smsService.js` - Initialization Snippet**
```javascript
import AfricasTalking from "africastalking"
import { errorHandler } from "../utils/error.js"

let africasTalking = null
let sms = null

if (process.env.AT_API_KEY && process.env.AT_USERNAME && 
    process.env.AT_API_KEY !== 'your-africastalking-api-key' && 
    process.env.AT_USERNAME !== 'your-africastalking-username') {

    africasTalking = AfricasTalking({
        apiKey: process.env.AT_API_KEY,
        username: process.env.AT_USERNAME
    })

    sms = africasTalking.SMS

} else {

    console.warn('Africa\'s Talking SMS service not initialized: Invalid or missing credentials')

}
```

---

## Key Functions/Service Methods

The `server/services/external/smsService.js` file provides the following functions for sending SMS.

**`formatPhoneNumber`**
A helper function to ensure phone numbers are in the correct international format (e.g., `+2547XXXXXXXX`).
```javascript
const formatPhoneNumber = (phone) => {
    // Remove any spaces, dashes, or plus signs
    let cleanNumber = phone.replace(/[\s\-\+]/g, '')

    // If number starts with 0, replace with 254
    if (cleanNumber.startsWith('0')) {
        cleanNumber = '254' + cleanNumber.substring(1)
    }

    // If number doesn't start with 254, add it
    if (!cleanNumber.startsWith('254')) {
        cleanNumber = '254' + cleanNumber
    }

    return '+' + cleanNumber
}
```

**`sendOTPSMS`**
Sends an SMS containing a One-Time Password to a user.
```javascript
export const sendOTPSMS = async (phone, otp, name = "User") => {
    if (!phone || !otp) {
        throw errorHandler(400, "Phone number and OTP are required for sending SMS")
    }

    if (!sms) {
        throw errorHandler(500, "SMS service not initialized - check Africa's Talking credentials")
    }

    try {
        const formattedPhone = formatPhoneNumber(phone)
        const message = `Hi ${name}! Your TEO KICKS verification code is: ${otp}. This code expires in ${process.env.OTP_EXP_MINUTES || 10} minutes. Don't share this code with anyone.`

        const options = {
            to: [formattedPhone],
            message: message,
            from: 'TEO_KICKS'
        }

        const result = await sms.send(options)

        if (result.SMSMessageData.Recipients[0].status === 'Success') {
            return { 
                success: true, 
                messageId: result.SMSMessageData.Recipients[0].messageId,
                cost: result.SMSMessageData.Recipients[0].cost
            }
        } else {
            return { 
                success: false, 
                error: result.SMSMessageData.Recipients[0].status
            }
        }
    } catch (error) {
        console.error('Error sending OTP SMS:', error)
        throw errorHandler(500, `Failed to send OTP SMS: ${error.message}`)
    }
}
```

**`sendPasswordResetSMS`**
Sends an SMS with a password reset link to a user.
```javascript
export const sendPasswordResetSMS = async (phone, resetToken, name = "User") => {
    try {
        const formattedPhone = formatPhoneNumber(phone)
        const resetUrl = `${process.env.CLIENT_BASE_URL}/reset-password?token=${resetToken}`
        const message = `Hi ${name}! Reset your TEO KICKS password using this link: ${resetUrl} This link expires in 15 minutes. If you didn't request this, ignore this message.`

        const options = {
            to: [formattedPhone],
            message: message,
            from: 'TEO_KICKS'
        }

        const result = await sms.send(options)

        if (result.SMSMessageData.Recipients[0].status === 'Success') {
            return { 
                success: true, 
                messageId: result.SMSMessageData.Recipients[0].messageId,
                cost: result.SMSMessageData.Recipients[0].cost
            }
        } else {
            return { 
                success: false, 
                error: result.SMSMessageData.Recipients[0].status
            }
        }
    } catch (error) {
        console.error('Error sending password reset SMS:', error)
        return { success: false, error: error.message }
    }
}
```

**`sendWelcomeSMS`**
Sends a welcome SMS to a newly verified user.
```javascript
export const sendWelcomeSMS = async (phone, name) => {
    try {
        const formattedPhone = formatPhoneNumber(phone)
        const message = `Welcome to TEO KICKS, ${name}! 🎉 Your account is now verified. Explore premium footwear at ${process.env.CLIENT_BASE_URL}. Happy shopping! - TEO KICKS Team`

        const options = {
            to: [formattedPhone],
            message: message,
            from: 'TEO_KICKS'
        }

        const result = await sms.send(options)

        if (result.SMSMessageData.Recipients[0].status === 'Success') {
            return { 
                success: true, 
                messageId: result.SMSMessageData.Recipients[0].messageId,
                cost: result.SMSMessageData.Recipients[0].cost
            }
        } else {
            return { 
                success: false, 
                error: result.SMSMessageData.Recipients[0].status
            }
        }
    } catch (error) {
        console.error('Error sending welcome SMS:', error)
        return { success: false, error: error.message }
    }
}
```

**`sendOrderNotificationSMS`**
Sends order status update notifications to customers.
```javascript
export const sendOrderNotificationSMS = async (phone, orderNumber, status, name = "Customer") => {
    try {
        const formattedPhone = formatPhoneNumber(phone)
        let message = ''

        switch (status.toLowerCase()) {
            case 'confirmed':
                message = `Hi ${name}! Your TEO KICKS order #${orderNumber} has been confirmed. We'll notify you when it's packed and ready. Thank you for shopping with us!`
                break
            case 'packed':
                message = `Hi ${name}! Great news! Your order #${orderNumber} has been packed and is ready for shipping. You'll receive tracking details soon.`
                break
            case 'shipped':
                message = `Hi ${name}! Your order #${orderNumber} has been shipped and is on its way to you. Track your order at ${process.env.CLIENT_BASE_URL}/orders/${orderNumber}`
                break
            case 'delivered':
                message = `Hi ${name}! Your order #${orderNumber} has been delivered. Thank you for choosing TEO KICKS! We'd love your feedback.`
                break
            default:
                message = `Hi ${name}! Your TEO KICKS order #${orderNumber} status has been updated to: ${status}. Check your account for details.`
        }

        const options = {
            to: [formattedPhone],
            message: message,
            from: 'TEO_KICKS'
        }

        const result = await sms.send(options)

        if (result.SMSMessageData.Recipients[0].status === 'Success') {
            return { 
                success: true, 
                messageId: result.SMSMessageData.Recipients[0].messageId,
                cost: result.SMSMessageData.Recipients[0].cost
            }
        } else {
            return { 
                success: false, 
                error: result.SMSMessageData.Recipients[0].status
            }
        }
    } catch (error) {
        console.error('Error sending order notification SMS:', error)
        return { success: false, error: error.message }
    }
}
```

---

## Usage in Internal Services

The internal notification service (`server/services/internal/notificationService.js`) uses SMS functions for various user-related communications.

**File: `server/services/internal/notificationService.js` - Snippets**
```javascript
import { sendOTPSMS, sendPasswordResetSMS, sendWelcomeSMS, sendOrderNotificationSMS } from "../external/smsService.js"

// ... inside sendOTPNotification
results.sms = await sendOTPSMS(phone, otp, name)

// ... inside sendPasswordResetNotification
results.sms = await sendPasswordResetSMS(phone, resetToken, name)

// ... inside sendWelcomeNotification
results.sms = await sendWelcomeSMS(phone, name)

// ... inside sendOrderNotification
const result = await sendOrderNotificationSMS(phone, orderNumber, status, name)
```

---

## Usage in Controllers

The authentication controller (`server/controllers/authController.js`) uses the notification service which internally calls SMS functions.

**File: `server/controllers/authController.js` - Snippets**
```javascript
import { sendOTPNotification, sendPasswordResetNotification, sendWelcomeNotification } from "../services/internal/notificationService.js"

// ... inside register or verifyOTP function
const notificationResult = await sendOTPNotification(email, phone, otp, name)

// ... inside forgotPassword function
const notificationResult = await sendPasswordResetNotification(email, phone, resetToken, name)

// ... inside verifyOTP function (after successful verification)
const notificationResult = await sendWelcomeNotification(email, phone, name)
```

Order controllers may also use the order notification SMS function directly or through the notification service for order status updates.

---

## Error Handling

All SMS service functions are equipped with `try-catch` blocks to gracefully handle potential errors during SMS sending, such as network issues, invalid phone numbers, or Africa's Talking API errors. Custom error messages are generated, and the `errorHandler` utility is utilized for consistent error responses. The service also checks for initialization, throwing an error if Africa's Talking credentials are missing.

Functions that don't throw errors (like `sendPasswordResetSMS`, `sendWelcomeSMS`, `sendOrderNotificationSMS`) return an object with `success: false` and an `error` property when failures occur, allowing calling code to handle failures gracefully without breaking the application flow.

---

## API Examples

**OTP SMS Sent During Registration**

When a user registers, the system automatically sends an OTP via SMS (and email) through the internal notification service:

```javascript
// This happens internally in authController.js
const notificationResult = await sendOTPNotification(
    user.email,
    user.phone,
    generatedOTP,
    user.name
)

// Result structure:
{
    success: true,
    results: {
        email: { success: true, attempted: true, messageId: "..." },
        sms: { success: true, attempted: true, messageId: "...", cost: "KES 0.50" }
    },
    message: "OTP sent successfully via email and SMS",
    successCount: 2
}
```

**Order Status Notification**

When an order status changes, the system can send an SMS notification:

```javascript
// Called from orderController.js or similar
const result = await sendOrderNotificationSMS(
    customerPhone,
    orderNumber,
    'shipped',
    customerName
)

// Result structure:
{
    success: true,
    messageId: "ATXid_...",
    cost: "KES 0.50"
}
```

---

## Security & Compliance Notes

-   **API Credentials:** Africa's Talking API credentials (`AT_API_KEY`, `AT_USERNAME`) should be stored securely in environment variables and never committed to version control.
-   **Phone Number Privacy:** Phone numbers are formatted and sent to Africa's Talking API. Ensure compliance with local data protection regulations (e.g., Kenya's Data Protection Act).
-   **Message Content:** SMS messages contain user-specific information (OTP codes, reset tokens, order numbers). These should not be logged in plain text in production environments.
-   **Rate Limiting:** Consider implementing rate limiting for SMS sending to prevent abuse and manage costs.
-   **Sender ID:** The sender ID `TEO_KICKS` must be registered with Africa's Talking. Unregistered sender IDs may cause message delivery failures.
-   **Cost Management:** Monitor SMS costs through Africa's Talking dashboard. Each SMS has an associated cost that varies by destination and message length.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
