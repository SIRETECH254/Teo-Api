# 📧 TEO KICKS API - Email Service Documentation

## 📋 Table of Contents
- [Email Service Overview](#email-service-overview)
- [Configuration](#configuration)
- [Key Functions/Service Methods](#key-functionsservice-methods)
- [Usage in Internal Services](#usage-in-internal-services)
- [Usage in Controllers](#usage-in-controllers)
- [Error Handling](#error-handling)
- [API Examples](#api-examples)
- [Security & Compliance Notes](#security--compliance-notes)

---

## Email Service Overview

The email service is responsible for sending various types of email communications, such as OTP codes, password reset links, welcome messages, and order confirmations. It utilizes `nodemailer` to interact with an SMTP server, which can be configured for various providers (Gmail, SendGrid, AWS SES, etc.).

**Key Features:**
-   **OTP Delivery:** Sends one-time password codes for user verification.
-   **Password Reset Links:** Delivers secure links for password recovery.
-   **Welcome Messages:** Greets new users upon successful account verification.
-   **Order Confirmations:** Sends order confirmation emails with order details.
-   **HTML Email Templates:** Rich HTML email templates with TEO KICKS branding.
-   **Configurable SMTP:** Easily adaptable to different SMTP providers.

---

## Configuration

Email service credentials and settings are managed through environment variables and configured in `server/services/external/emailService.js`.

**Environment Variables:**
-   `SMTP_HOST`: The SMTP server host (e.g., `smtp.gmail.com`, `smtp.sendgrid.net`).
-   `SMTP_PORT`: The SMTP server port (default: `587` for TLS, `465` for SSL).
-   `SMTP_USER`: The username for SMTP authentication (e.g., your email address).
-   `SMTP_PASS`: The password for SMTP authentication (e.g., your Gmail App Password or SendGrid API key).
-   `CLIENT_BASE_URL`: Used to construct password reset links and order confirmation links (e.g., `https://teokicks.com`).
-   `OTP_EXP_MINUTES` (Optional): OTP expiration time in minutes (default: 10).

**File: `server/services/external/emailService.js` - Initialization Snippet**
```javascript
import nodemailer from "nodemailer"
import { errorHandler } from "../utils/error.js"

// Create email transporter
const createTransporter = () => {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw errorHandler(500, "Email configuration is missing. Please check SMTP environment variables.")
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    })
}
```

---

## Key Functions/Service Methods

The `server/services/external/emailService.js` file provides the following functions for sending emails.

**`createTransporter`**
A helper function that creates and returns a `nodemailer` transporter instance, configured with SMTP credentials. It throws an error if email configuration environment variables are missing.
```javascript
const createTransporter = () => {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw errorHandler(500, "Email configuration is missing. Please check SMTP environment variables.")
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    })
}
```

**`sendOTPEmail`**
Sends an HTML email containing a One-Time Password to a user with TEO KICKS branding.
```javascript
export const sendOTPEmail = async (email, otp, name = "User") => {
    if (!email || !otp) {
        throw errorHandler(400, "Email and OTP are required for sending OTP email")
    }

    try {
        const transporter = createTransporter()

        const mailOptions = {
            from: `"TEO KICKS" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "Verify Your Account - OTP Code",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #4B2E83; margin: 0;">TEO KICKS</h1>
                        <p style="color: #666; margin: 5px 0;">Your Premium Footwear Destination</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; text-align: center;">
                        <h2 style="color: #333; margin-bottom: 20px;">Account Verification</h2>
                        <p style="color: #666; margin-bottom: 25px;">Hi ${name},</p>
                        <p style="color: #666; margin-bottom: 25px;">Welcome to TEO KICKS! Please verify your account using the OTP code below:</p>
                        
                        <div style="background: #4B2E83; color: white; font-size: 32px; font-weight: bold; padding: 15px 30px; border-radius: 8px; letter-spacing: 3px; margin: 25px 0;">
                            ${otp}
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            This code will expire in ${process.env.OTP_EXP_MINUTES || 10} minutes.
                        </p>
                        <p style="color: #666; font-size: 14px;">
                            If you didn't request this, please ignore this email.
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
                        <p>TEO KICKS - Premium Footwear in Kenya</p>
                        <p>This is an automated message, please do not reply.</p>
                    </div>
                </div>
            `
        }

        const result = await transporter.sendMail(mailOptions)
        console.log(`OTP email sent successfully to ${email}:`, result.messageId)
        return { success: true, messageId: result.messageId }
    } catch (error) {
        console.error('Error sending OTP email:', error)
        throw errorHandler(500, `Failed to send OTP email: ${error.message}`)
    }
}
```

**`sendPasswordResetEmail`**
Sends an HTML email with a password reset link to a user.
```javascript
export const sendPasswordResetEmail = async (email, resetToken, name = "User") => {
    if (!email || !resetToken) {
        throw errorHandler(400, "Email and reset token are required for sending password reset email")
    }

    try {
        const transporter = createTransporter()
        const resetUrl = `${process.env.CLIENT_BASE_URL}/reset-password?token=${resetToken}`

        const mailOptions = {
            from: `"TEO KICKS" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "Reset Your Password - TEO KICKS",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #4B2E83; margin: 0;">TEO KICKS</h1>
                        <p style="color: #666; margin: 5px 0;">Your Premium Footwear Destination</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
                        <p style="color: #666; margin-bottom: 20px;">Hi ${name},</p>
                        <p style="color: #666; margin-bottom: 25px;">
                            We received a request to reset your password for your TEO KICKS account. 
                            Click the button below to create a new password:
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="background: #4B2E83; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                Reset Password
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
                            This link will expire in 15 minutes for security reasons.
                        </p>
                        <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
                            If the button doesn't work, copy and paste this link into your browser:
                        </p>
                        <p style="color: #666; font-size: 12px; word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 4px;">
                            ${resetUrl}
                        </p>
                        <p style="color: #666; font-size: 14px; margin-top: 20px;">
                            If you didn't request this password reset, please ignore this email or contact support if you have concerns.
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
                        <p>TEO KICKS - Premium Footwear in Kenya</p>
                        <p>This is an automated message, please do not reply.</p>
                    </div>
                </div>
            `
        }

        const result = await transporter.sendMail(mailOptions)
        console.log(`Password reset email sent successfully to ${email}:`, result.messageId)
        return { success: true, messageId: result.messageId }
    } catch (error) {
        console.error('Error sending password reset email:', error)
        throw errorHandler(500, `Failed to send password reset email: ${error.message}`)
    }
}
```

**`sendWelcomeEmail`**
Sends a welcome email to a newly verified user with TEO KICKS branding and a call-to-action to shop.
```javascript
export const sendWelcomeEmail = async (email, name) => {
    if (!email || !name) {
        throw errorHandler(400, "Email and name are required for sending welcome email")
    }

    try {
        const transporter = createTransporter()

        const mailOptions = {
            from: `"TEO KICKS" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "Welcome to TEO KICKS! 👟",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #4B2E83; margin: 0;">TEO KICKS</h1>
                        <p style="color: #666; margin: 5px 0;">Your Premium Footwear Destination</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Welcome to the Family! 🎉</h2>
                        <p style="color: #666; margin-bottom: 20px;">Hi ${name},</p>
                        <p style="color: #666; margin-bottom: 25px;">
                            Your account has been successfully verified! Welcome to TEO KICKS, Kenya's premier destination for premium footwear.
                        </p>
                        
                        <div style="background: linear-gradient(135deg, #4B2E83, #E879F9); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0;">
                            <h3 style="margin: 0 0 10px 0;">🎯 Ready to Step Up Your Game?</h3>
                            <p style="margin: 0; opacity: 0.9;">Explore our premium collection and find your perfect pair!</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_BASE_URL}/products" style="background: #4B2E83; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                Shop Now
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; text-align: center;">
                            Follow us for the latest drops and exclusive offers!
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
                        <p>TEO KICKS - Premium Footwear in Kenya</p>
                        <p>Currency: KES (Kenyan Shillings)</p>
                    </div>
                </div>
            `
        }

        const result = await transporter.sendMail(mailOptions)
        console.log(`Welcome email sent successfully to ${email}:`, result.messageId)
        return { success: true, messageId: result.messageId }
    } catch (error) {
        console.error('Error sending welcome email:', error)
        throw errorHandler(500, `Failed to send welcome email: ${error.message}`)
    }
}
```

---

## Usage in Internal Services

The internal notification service (`server/services/internal/notificationService.js`) uses email functions for various user-related communications.

**File: `server/services/internal/notificationService.js` - Snippets**
```javascript
import { sendOTPEmail, sendPasswordResetEmail, sendWelcomeEmail } from "../external/emailService.js"

// ... inside sendOTPNotification
results.email = await sendOTPEmail(email, otp, name)

// ... inside sendPasswordResetNotification
results.email = await sendPasswordResetEmail(email, resetToken, name)

// ... inside sendWelcomeNotification
results.email = await sendWelcomeEmail(email, name)
```

---

## Usage in Controllers

The authentication controller (`server/controllers/authController.js`) uses the notification service which internally calls email functions.

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

---

## Error Handling

All email service functions are designed with `try-catch` blocks to manage potential errors during email transmission, such as invalid configurations, SMTP server issues, or network problems. Errors are standardized using the `errorHandler` utility. A check for missing SMTP environment variables is performed during transporter creation, throwing a descriptive error if configuration is incomplete.

---

## API Examples

**OTP Email Sent During Registration**

When a user registers, the system automatically sends an OTP via email (and SMS) through the internal notification service:

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
        email: { success: true, attempted: true, messageId: "<message-id>" },
        sms: { success: true, attempted: true, messageId: "...", cost: "KES 0.50" }
    },
    message: "OTP sent successfully via email and SMS",
    successCount: 2
}
```

**Password Reset Email**

When a user requests a password reset, the system sends a password reset email:

```javascript
// Called from authController.js forgotPassword function
const notificationResult = await sendPasswordResetNotification(
    user.email,
    user.phone,
    resetToken,
    user.name
)

// Result structure:
{
    success: true,
    results: {
        email: { success: true, messageId: "<message-id>" },
        sms: { success: true, messageId: "...", cost: "KES 0.50" }
    },
    message: "Password reset instructions sent successfully"
}
```

---

## Security & Compliance Notes

-   **SMTP Credentials:** SMTP credentials (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`) should be stored securely in environment variables and never committed to version control.
-   **Email Content:** Email templates contain user-specific information (OTP codes, reset tokens). These should not be logged in plain text in production environments.
-   **Password Reset Tokens:** Reset tokens are single-use and expire after 15 minutes. Ensure proper token validation and expiration handling.
-   **SPF/DKIM/DMARC:** Configure SPF, DKIM, and DMARC records for your sending domain to improve email deliverability and prevent spoofing.
-   **Rate Limiting:** Consider implementing rate limiting for email sending to prevent abuse and manage costs.
-   **Email Provider Limits:** Be aware of your SMTP provider's sending limits (e.g., Gmail: 500 emails/day, SendGrid: varies by plan).
-   **Data Protection:** Ensure compliance with data protection regulations (e.g., Kenya's Data Protection Act) when handling user email addresses and personal information.

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
