# CORS Configuration Reference

## Current Setup

Your server now has smart CORS configuration with built-in fallbacks:

### Default Fallback Origins
If `CORS_ORIGIN` is not set or is empty, these origins are automatically allowed:
- `http://localhost:5173` (Client app dev)
- `http://localhost:5174` (Admin app dev)
- `http://localhost:5000` (Backend dev)
- `https://teo-kicks.onrender.com` (Production API)

---

## How It Works

### ✅ When CORS_ORIGIN is Set
```env
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,https://my-admin.com,https://my-client.com
```
**Result:** Uses your custom origins
**Log:** `✅ CORS configured with allowed origins: [...]`

### ⚠️ When CORS_ORIGIN is Not Set or Empty
**Result:** Uses the default fallback origins listed above
**Log:** `⚠️ CORS_ORIGIN not set in environment variables, using default origins: [...]`

---

## Debug Your CORS Setup

### 1. Check CORS Configuration
Visit: `https://your-api.onrender.com/api/debug/cors`

Response example:
```json
{
  "allowedOrigins": [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5000",
    "https://teo-kicks.onrender.com"
  ],
  "requestOrigin": "https://your-frontend.com",
  "corsEnabled": true,
  "environmentVariable": "Set",
  "timestamp": "2025-09-30T10:30:00.000Z"
}
```

### 2. Check Server Health
Visit: `https://your-api.onrender.com/api/health`

---

## Setting CORS_ORIGIN in Production (Render)

### In Render Dashboard:

1. Go to your service → **Environment** tab
2. Click **"Add Environment Variable"**
3. Add:
   ```
   Key: CORS_ORIGIN
   Value: http://localhost:5173,http://localhost:5174,http://localhost:5000,https://teo-kicks.onrender.com,https://your-admin-domain.com,https://your-client-domain.com
   ```
4. Click **"Save Changes"** (triggers auto-redeploy)
5. Check logs for: `✅ CORS configured with allowed origins: [...]`

---

## Important Rules

### ✅ Correct Format
```
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,https://app.com
```
- No spaces around commas
- Include protocol (http:// or https://)
- No trailing slashes

### ❌ Common Mistakes
```
# Spaces around commas
CORS_ORIGIN=http://localhost:5173, https://app.com

# Missing protocol
CORS_ORIGIN=localhost:5173,app.com

# Trailing slashes
CORS_ORIGIN=http://localhost:5173/,https://app.com/
```

---

## Troubleshooting

### Issue: CORS errors in production

**Check:**
1. Visit `/api/debug/cors` to see what origins are configured
2. Check if `environmentVariable` shows "Set" or "Not Set"
3. Verify your frontend URL matches exactly (including protocol)

**Common causes:**
- Frontend uses `https://` but you listed `http://`
- Extra trailing slash in configured origin
- Typo in the domain name

### Issue: CORS_ORIGIN not loading in Render

**Try:**
1. Delete the environment variable in Render
2. Save changes
3. Re-add it with the correct value
4. Save again (triggers redeploy)
5. Check the deployment logs

### Issue: CORS blocks all requests

**This is now fixed!** With the fallback origins:
- Development will always work (localhost ports)
- Production has a sensible default
- Even if env var fails, your default domains are allowed

---

## Benefits of This Setup

1. **Works out of the box** - No CORS errors even if env var is missing
2. **Smart logging** - Know exactly what's configured
3. **Debug tools** - Easy troubleshooting with `/api/debug/cors`
4. **Production ready** - Includes your Render domain by default
5. **Development friendly** - All localhost ports already allowed

---

## Quick Test

After deploying to Render, test with:

```bash
# In your browser console (from your frontend)
fetch('https://your-api.onrender.com/api/health')
  .then(res => res.json())
  .then(console.log)
```

**Expected:** Should return server health info without CORS errors!

---

## Recommended: Still Set CORS_ORIGIN in Production

Even though fallbacks work, it's **best practice** to explicitly set `CORS_ORIGIN` in production:

```
CORS_ORIGIN=https://admin-teo-kicks.vercel.app,https://client-teo-kicks.vercel.app,https://teo-kicks.onrender.com,http://localhost:5173,http://localhost:5174
```

This gives you:
- Full control over allowed origins
- Easy to add/remove domains
- Clear logging of what's configured
- Security best practice