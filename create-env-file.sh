#!/bin/bash

# Create .env file for TEO KICKS server
# Run this script to create your environment configuration

cat > .env << EOL
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/teo-kicks

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback

# Frontend URL (for CORS and redirects)
FRONTEND_URL=http://localhost:5173

# Email Configuration (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# SMS Configuration (optional)
AFRICASTALKING_USERNAME=your-username
AFRICASTALKING_API_KEY=your-api-key

# OTP Configuration
OTP_EXP_MINUTES=10

# Cloudinary Configuration (optional)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
EOL

echo ".env file created successfully!"
echo ""
echo "IMPORTANT: Update the following variables with your actual values:"
echo "- GOOGLE_CLIENT_ID"
echo "- GOOGLE_CLIENT_SECRET"
echo "- JWT_SECRET"
echo "- JWT_REFRESH_SECRET"
echo "- MONGODB_URI (if using MongoDB)"
echo ""
echo "Then run: npm install && npm run dev"