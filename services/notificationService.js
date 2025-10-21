import { sendOTPEmail, sendPasswordResetEmail, sendWelcomeEmail } from "./emailService.js"
import { sendOTPSMS, sendPasswordResetSMS, sendWelcomeSMS, sendOrderNotificationSMS } from "./smsService.js"
import { errorHandler } from "../utils/error.js"


// Send OTP via both email and SMS
export const sendOTPNotification = async (email, phone, otp, name = "User") => {

    const results = {
        email: { success: false, attempted: false },
        sms: { success: false, attempted: false }
    }

    let successCount = 0

    // Send email
    if (email) {

        results.email.attempted = true

        try {

            results.email = await sendOTPEmail(email, otp, name)

            if (results.email.success) successCount++

        } catch (error) {

            console.error('Email service error:', error.message)

            results.email = { success: false, attempted: true, error: error.message }

        }

    }

    // Send SMS - only if credentials are properly configured
    if (phone && process.env.AT_API_KEY && process.env.AT_USERNAME) {

        results.sms.attempted = true

        try {

            results.sms = await sendOTPSMS(phone, otp, name)

            if (results.sms.success) successCount++

        } catch (error) {

            console.error('SMS service error:', error.message)

            results.sms = { success: false, attempted: true, error: error.message }

        }

    } else if (phone) {

        console.warn('SMS not sent: Africa\'s Talking credentials not configured')

        results.sms = { success: false, attempted: false, error: "SMS credentials not configured" }

    }

    // Determine overall success
    const overallSuccess = successCount > 0

    let message = ""

    if (successCount === 2) {

        message = "OTP sent successfully via email and SMS"

    } else if (results.email.success) {

        message = "OTP sent successfully via email"

    } else if (results.sms.success) {

        message = "OTP sent successfully via SMS"

    } else {

        message = "Failed to send OTP - please check your configuration"

    }

    return {
        success: overallSuccess,
        results: results,
        message: message,
        successCount: successCount
    }

}


// Send password reset via both email and SMS
export const sendPasswordResetNotification = async (email, phone, resetToken, name = "User") => {

    const results = {
        email: { success: false },
        sms: { success: false }
    }

    // Send email
    if (email) {

        try {

            results.email = await sendPasswordResetEmail(email, resetToken, name)

        } catch (error) {

            console.error('Error sending password reset email:', error)

            results.email = { success: false, error: error.message }

        }

    }

    // Send SMS
    if (phone) {

        try {

            results.sms = await sendPasswordResetSMS(phone, resetToken, name)

        } catch (error) {

            console.error('Error sending password reset SMS:', error)

            results.sms = { success: false, error: error.message }

        }

    }

    // Return success if at least one method succeeded
    const overallSuccess = results.email.success || results.sms.success

    return {
        success: overallSuccess,
        results: results,
        message: overallSuccess 
            ? "Password reset instructions sent successfully" 
            : "Failed to send password reset instructions"
    }

}


// Send welcome message via both email and SMS
export const sendWelcomeNotification = async (email, phone, name) => {

    const results = {
        email: { success: false },
        sms: { success: false }
    }

    // Send email
    if (email) {

        try {

            results.email = await sendWelcomeEmail(email, name)

        } catch (error) {

            console.error('Error sending welcome email:', error)

            results.email = { success: false, error: error.message }

        }

    }

    // Send SMS
    if (phone) {

        try {

            results.sms = await sendWelcomeSMS(phone, name)

        } catch (error) {

            console.error('Error sending welcome SMS:', error)

            results.sms = { success: false, error: error.message }

        }

    }

    // Return success if at least one method succeeded
    const overallSuccess = results.email.success || results.sms.success

    return {
        success: overallSuccess,
        results: results,
        message: overallSuccess 
            ? "Welcome message sent successfully" 
            : "Failed to send welcome message"
    }

}


// Send order notification (primarily SMS, but could extend to email)
export const sendOrderNotification = async (phone, orderNumber, status, name = "Customer") => {

    try {

        const result = await sendOrderNotificationSMS(phone, orderNumber, status, name)

        return {
            success: result.success,
            result: result,
            message: result.success 
                ? "Order notification sent successfully" 
                : "Failed to send order notification"
        }

    } catch (error) {

        console.error('Error sending order notification:', error)

        return {
            success: false,
            error: error.message,
            message: "Failed to send order notification"
        }

    }

}