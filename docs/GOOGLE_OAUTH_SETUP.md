# Google OAuth Setup Guide

This guide will help you set up Google OAuth authentication for the TEO KICKS admin app.

## Prerequisites

1. You need a Google Cloud Console account
2. You should have your Google Client ID and Client Secret ready

## Environment Variables Required

Add the following environment variables to your `.env` file:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
FRONTEND_URL=http://localhost:5173
```

## Google OAuth Setup Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the necessary APIs:
   - Go to "APIs & Services" > "Library"
   - Search for and enable "Google+ API" (for user profile information)
   - Also enable "People API" if needed

### 2. Configure OAuth Consent Screen (CRITICAL STEP)

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type (for public apps) or "Internal" (for Google Workspace only)
3. Fill out the OAuth consent screen:
   - **App name**: "TEO KICKS Admin" (or your preferred name)
   - **User support email**: Your email
   - **App logo**: Upload your app logo (optional but recommended)
   - **Application home page**: `http://localhost:5173` (full URL with http://)
   - **App domain**: `localhost` (just the domain name)
   - **Authorized domains**: Add `localhost` for development
   - **Developer contact information**: Your email

### 3. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Select "Web application" as the application type
4. **IMPORTANT**: Add authorized redirect URIs:
   - For development: `http://localhost:5173/auth/google/callback`
   - For production: `https://yourdomain.com/auth/google/callback`
5. **CRITICAL**: Also add your backend callback URL if different:
   - `http://localhost:5000/auth/google/callback` (if your backend handles the callback)

### 4. Add Test Users (IMPORTANT FOR TESTING)

1. In the OAuth consent screen settings, scroll down to "Test users"
2. Click "Add users"
3. Add the email addresses of users who should be able to test your app
4. **Include your email**: `clivon84@gmail.com` and any other test emails
5. Save the changes

### 3. Get Your Credentials

After creating the OAuth client, you'll get:
- **Client ID**: A long string that looks like `123456789-abcdef.apps.googleusercontent.com`
- **Client Secret**: A shorter string

### 4. Configure Environment Variables

Create a `.env` file in the server directory and add:

```env
GOOGLE_CLIENT_ID=your-actual-client-id
GOOGLE_CLIENT_SECRET=your-actual-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
FRONTEND_URL=http://localhost:5173
```

## Testing the OAuth Flow

1. Start your backend server: `npm run dev`
2. Start your frontend: `npm run dev`
3. Go to the login page
4. Click "Continue with Google"
5. You should be redirected to Google for authentication
6. After authentication, you should be redirected back and logged in

## Troubleshooting

### Specific Error: "Access blocked: Authorization Error"

If you see this error, it usually means:

1. **Missing Test Users**: Your email (`clivon84@gmail.com`) is not added as a test user
   - Solution: Go to OAuth consent screen → Test users → Add your email

2. **Incomplete OAuth Consent Screen**: The app information is not fully configured
   - Solution: Fill out all required fields in the OAuth consent screen

3. **App Status**: The app is still in "Draft" mode and needs publishing
   - Solution: Publish your OAuth consent screen (for testing purposes)

### Common Issues:

1. **"redirect_uri_mismatch"**: Make sure the redirect URI in your Google Console matches exactly with `GOOGLE_REDIRECT_URI`
2. **"invalid_client"**: Check that your Client ID and Secret are correct
3. **"invalid_scope"**: The requested scopes are not allowed
4. **CORS errors**: Make sure `FRONTEND_URL` matches your frontend URL
5. **"App not verified"**: For production, Google requires app verification

### Debug Steps:

1. **Check OAuth Consent Screen Status**:
   - Go to Google Cloud Console → APIs & Services → OAuth consent screen
   - Ensure all required fields are filled
   - Check if your email is added to test users
   - Publish the consent screen if it's in draft mode

2. **Verify Redirect URIs**:
   - Go to Credentials → Your OAuth Client → Authorized redirect URIs
   - Ensure `http://localhost:5173/auth/google/callback` is listed
   - Also add `http://localhost:5000/auth/google/callback` if needed

3. **Check Environment Variables**:
   - Ensure your `.env` file has the correct `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
   - Verify `GOOGLE_REDIRECT_URI` matches exactly what's in Google Console

4. **Test with Different Accounts**:
   - Try with a different Google account
   - Make sure you're not signed into multiple Google accounts

5. **Check Browser Console**:
   - Open developer tools (F12)
   - Check for any JavaScript errors
   - Look at network requests to see if there are any failed API calls

6. **Check Server Logs**:
   - Look at your backend terminal for any error messages
   - Check if the Google OAuth endpoints are being called correctly

## Production Deployment

For production deployment:

1. Update the redirect URI to your production domain
2. Set `NODE_ENV=production`
3. Make sure your production server has the correct environment variables
4. Update the `FRONTEND_URL` to your production frontend URL

## Security Notes

- Never commit your `.env` file to version control
- Use different OAuth credentials for development and production
- Regularly rotate your OAuth client secrets
- Monitor your OAuth usage in Google Cloud Console

## Need Help?

If you encounter any issues:
1. Check the server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure your Google Cloud project is properly configured
4. Test with a fresh Google account that hasn't been used before