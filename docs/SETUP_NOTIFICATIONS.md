# TEO KICKS - Email & SMS Notification Setup Guide

## 📧 Email & 📱 SMS Services Successfully Implemented!

Your forgot password and OTP verification now support both **Email** and **SMS** notifications using **Nodemailer** and **Africa's Talking**.

---

## 🚀 What's Been Implemented

### ✅ Services Created:
1. **`emailService.js`** - Professional email templates for OTP, password reset, and welcome messages
2. **`smsService.js`** - Kenya-formatted SMS notifications using Africa's Talking
3. **`notificationService.js`** - Combined service that sends both email and SMS
4. **Updated `authController.js`** - Integrated notification services

### ✅ Features Added:
- **OTP Verification** - Sends OTP via both email and SMS during registration
- **Password Reset** - Sends reset links via email and SMS
- **Welcome Messages** - Sends welcome notifications after account verification
- **Order Notifications** - SMS alerts for order status updates (ready for use)

---

## 🔧 Environment Variables Required

Add these to your `.env` file:

### Email Configuration (Gmail SMTP Example)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Africa's Talking Configuration
```bash
AT_API_KEY=your-africas-talking-api-key
AT_USERNAME=your-africas-talking-username
```

### Application URLs
```bash
CLIENT_BASE_URL=http://localhost:3000
ADMIN_BASE_URL=http://localhost:3001
```

### OTP Configuration
```bash
OTP_EXP_MINUTES=10
```

---

## 📧 Email Setup Instructions

### For Gmail:
1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
   - Use this password in `SMTP_PASS`

### For Other Email Providers:
- **Outlook**: `smtp.outlook.com:587`
- **Yahoo**: `smtp.mail.yahoo.com:587`
- **Custom SMTP**: Contact your email provider

---

## 📱 Africa's Talking Setup Instructions

### 1. Create Account
- Visit [Africa's Talking](https://africastalking.com)
- Sign up for an account
- Verify your account

### 2. Get API Credentials
- Go to your dashboard
- Navigate to "Settings" → "API Keys"
- Copy your `username` and `API key`

### 3. Configure Sender ID (Optional)
- Register a custom sender ID like "TEO_KICKS"
- This appears as the SMS sender name
- Currently using "TEO_KICKS" as sender ID

---

## 🏗️ Package Dependencies

### ✅ Already Installed:
- `nodemailer` - Email sending
- `africastalking` - SMS service (newly added)

### 📦 Installation Command Used:
```bash
npm install africastalking
```

---

## 🔄 How It Works

### 1. **User Registration Flow**:
```
User registers → OTP generated → Email + SMS sent → User verifies → Welcome messages sent
```

### 2. **Password Reset Flow**:
```
User requests reset → Token generated → Email + SMS sent → User clicks link → Password reset
```

### 3. **Notification Service Features**:
- **Dual delivery**: Always attempts both email and SMS
- **Fallback logic**: Success if at least one method works
- **Error handling**: Logs failures but doesn't break the flow
- **Kenya phone formatting**: Auto-formats numbers to +254 format

---

## 📱 SMS Features

### Phone Number Formatting:
- Automatically converts `0712345678` to `+254712345678`
- Handles various input formats
- Optimized for Kenyan phone numbers

### Message Types:
- **OTP Messages**: Verification codes with expiry info
- **Password Reset**: Secure reset links
- **Welcome Messages**: Account activation confirmation
- **Order Updates**: Status notifications (ready for e-commerce flow)

---

## 🎨 Email Templates

### Professional HTML Templates Include:
- **TEO KICKS branding** with purple theme (#4B2E83)
- **Responsive design** for all devices
- **Security messaging** for reset links
- **Clear call-to-action buttons**
- **Kenyan Shilling (KES) currency context**

---

## 🔍 Testing Your Setup

### 1. Test Registration:
```bash
POST /api/auth/register
{
  "name": "Test User",
  "email": "test@example.com",
  "phone": "0712345678",
  "password": "password123"
}
```

### 2. Test Password Reset:
```bash
POST /api/auth/forgot-password
{
  "email": "test@example.com"
}
```

### 3. Check Console Logs:
- Look for "OTP notification result"
- Look for "Password reset notification result"
- Check for any error messages

---

## 🚨 Common Issues & Solutions

### Email Issues:
- **Authentication Error**: Check app password, not regular password
- **Connection Timeout**: Verify SMTP host and port
- **Blocked by Provider**: Some hosts block SMTP, use alternative

### SMS Issues:
- **Invalid Credentials**: Verify API key and username
- **Insufficient Balance**: Top up your Africa's Talking account
- **Invalid Phone Format**: Service auto-formats Kenya numbers

### General Issues:
- **Environment Variables**: Ensure all required vars are set
- **Network Issues**: Check internet connectivity
- **API Limits**: Check rate limits on both services

---

## 🎯 Next Steps

### Ready for Production:
1. **Switch to production SMTP** (SendGrid, Amazon SES, etc.)
2. **Configure production Africa's Talking** account
3. **Set up monitoring** for notification failures
4. **Implement retry logic** for failed notifications
5. **Add notification preferences** per user

### Future Enhancements:
- **Push notifications** for mobile apps
- **Email templates customization** per user language
- **SMS delivery reports** tracking
- **Notification analytics** dashboard

---

## 💡 Usage in Code

The notification services are now integrated into your auth controller:

```javascript
// Registration - sends OTP via email + SMS
const notificationResult = await sendOTPNotification(email, phone, otp, name)

// Password Reset - sends reset link via email + SMS  
const notificationResult = await sendPasswordResetNotification(email, phone, token, name)

// Welcome Message - sends welcome via email + SMS
const welcomeResult = await sendWelcomeNotification(email, phone, name)
```

**Your TEO KICKS authentication system now has professional email and SMS capabilities! 🎉**