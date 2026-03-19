import sgMail from "@sendgrid/mail"
import { errorHandler } from "../../utils/error.js"

// Initialize SendGrid with API Key
const initializeSendGrid = () => {

    if (!process.env.SMTP_PASS) {
        throw errorHandler(500, "SendGrid API Key is missing. Please check the SMTP_PASS environment variable.")
    }

    sgMail.setApiKey(process.env.SMTP_PASS)

}

// Send OTP email
export const sendOTPEmail = async (email, otp, name = "User") => {

    if (!email || !otp) {
        throw errorHandler(400, "Email and OTP are required for sending OTP email")
    }

    try {

        initializeSendGrid()

        const msg = {
            to: email,
            from: {
                name: "TEO KICKS",
                email: process.env.SMTP_FROM
            },
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

        const [response] = await sgMail.send(msg)

        console.log(`OTP email sent successfully to ${email}:`, response.headers['x-message-id'])

        return { success: true, messageId: response.headers['x-message-id'] }

    } catch (error) {

        console.error('Error sending OTP email:', error.response?.body || error)

        throw errorHandler(500, `Failed to send OTP email: ${error.message}`)

    }

}

// Send password reset email
export const sendPasswordResetEmail = async (email, resetToken, name = "User") => {

    if (!email || !resetToken) {
        throw errorHandler(400, "Email and reset token are required for sending password reset email")
    }

    try {

        initializeSendGrid()

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`

        const msg = {
            to: email,
            from: {
                name: "TEO KICKS",
                email: process.env.SMTP_FROM
            },
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

        const [response] = await sgMail.send(msg)

        console.log(`Password reset email sent successfully to ${email}:`, response.headers['x-message-id'])

        return { success: true, messageId: response.headers['x-message-id'] }

    } catch (error) {

        console.error('Error sending password reset email:', error.response?.body || error)

        throw errorHandler(500, `Failed to send password reset email: ${error.message}`)

    }

}

// Send welcome email
export const sendWelcomeEmail = async (email, name) => {

    if (!email || !name) {
        throw errorHandler(400, "Email and name are required for sending welcome email")
    }

    try {

        initializeSendGrid()

        const msg = {
            to: email,
            from: {
                name: "TEO KICKS",
                email: process.env.SMTP_FROM
            },
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
                            <a href="${process.env.FRONTEND_URL}/products" style="background: #4B2E83; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
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

        const [response] = await sgMail.send(msg)

        console.log(`Welcome email sent successfully to ${email}:`, response.headers['x-message-id'])

        return { success: true, messageId: response.headers['x-message-id'] }

    } catch (error) {

        console.error('Error sending welcome email:', error.response?.body || error)

        throw errorHandler(500, `Failed to send welcome email: ${error.message}`)

    }

}

// Send contact reply email
export const sendContactReplyEmail = async (email, name, originalMessage, replyMessage) => {

    if (!email || !replyMessage) {
        throw errorHandler(400, "Email and reply message are required")
    }

    try {

        initializeSendGrid()

        const msg = {
            to: email,
            from: {
                name: "TEO KICKS Support",
                email: process.env.SMTP_FROM
            },
            subject: "Re: Your Inquiry at TEO KICKS",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #4B2E83; margin: 0;">TEO KICKS</h1>
                        <p style="color: #666; margin: 5px 0;">Your Premium Footwear Destination</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Hello ${name || 'there'},</h2>
                        <p style="color: #666; margin-bottom: 20px;">
                            Thank you for reaching out to us. Here is our response to your inquiry:
                        </p>
                        
                        <div style="background: white; border-left: 4px solid #4B2E83; padding: 15px; margin: 20px 0; border-radius: 4px;">
                            <p style="color: #333; margin: 0; white-space: pre-wrap;">${replyMessage}</p>
                        </div>
                        
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                            <p style="color: #999; font-size: 13px; font-style: italic;">Your original message:</p>
                            <p style="color: #999; font-size: 13px; white-space: pre-wrap;">"${originalMessage}"</p>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
                        <p>TEO KICKS - Premium Footwear in Kenya</p>
                        <p>This is an automated message, please do not reply directly to this email.</p>
                    </div>
                </div>
            `
        }

        const [response] = await sgMail.send(msg)

        console.log(`Contact reply email sent successfully to ${email}:`, response.headers['x-message-id'])

        return { success: true, messageId: response.headers['x-message-id'] }

    } catch (error) {

        console.error('Error sending contact reply email:', error.response?.body || error)

        throw errorHandler(500, `Failed to send contact reply email: ${error.message}`)

    }

}
