import AfricasTalking from "africastalking"
import { errorHandler } from "../utils/error.js"


// Initialize Africa's Talking only if credentials are available
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


// Format phone number for Kenya
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


// Send OTP SMS
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
            from: 'TEO_KICKS' // Optional: Your sender ID (must be registered with Africa's Talking)
        }

        const result = await sms.send(options)

        console.log(`OTP SMS sent successfully to ${formattedPhone}:`, result)

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


// Send password reset SMS
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

        console.log(`Password reset SMS sent successfully to ${formattedPhone}:`, result)

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


// Send welcome SMS
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

        console.log(`Welcome SMS sent successfully to ${formattedPhone}:`, result)

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


// Send order notification SMS
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

        console.log(`Order notification SMS sent successfully to ${formattedPhone}:`, result)

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