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


// Send OTP email
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


// Send password reset email
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


// Send welcome email
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