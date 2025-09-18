# Wagadogy Backend Deployment Guide

## Important: Node.js Hosting Requirement

**⚠️ CRITICAL:** Your backend is a Node.js application that requires a Node.js runtime environment. One.com's standard shared hosting typically only supports PHP/HTML and may not support Node.js applications.

## Deployment Options

### Option 1: Check if One.com Supports Node.js
1. Contact one.com support to confirm if they support Node.js hosting
2. Ask specifically about Node.js version 18+ support
3. If they support it, follow the "One.com Deployment" section below

### Option 2: Use a Node.js-Compatible Hosting Service (Recommended)
Consider these alternatives that definitely support Node.js:
- **Vercel** (free tier available) - https://vercel.com
- **Railway** (free tier available) - https://railway.app  
- **Render** (free tier available) - https://render.com
- **DigitalOcean App Platform** - https://www.digitalocean.com/products/app-platform

## One.com Deployment (If Node.js is Supported)

### Files to Upload
Create a deployment folder with these files:

```
deployment-files/
├── server.js (entry point)
├── package.json (rename from package-production.json)
├── backend/ (entire backend folder)
│   ├── hono.ts
│   └── trpc/
│       ├── app-router.ts
│       ├── create-context.ts
│       └── routes/
└── .env (environment variables)
```

### Step-by-Step Deployment

1. **Prepare Files:**
   - Rename `package-production.json` to `package.json`
   - Copy the entire `backend/` folder
   - Copy `server.js`
   - Create `.env` file with production environment variables

2. **Upload via File Manager:**
   - Log into your one.com control panel
   - Navigate to File Manager
   - Upload all files to your subdomain's root directory
   - Ensure file permissions are set correctly

3. **Install Dependencies:**
   - If one.com provides SSH access: `npm install`
   - If not, you may need to upload `node_modules` (not recommended)

4. **Environment Variables:**
   - Set environment variables in one.com's control panel
   - Or ensure `.env` file is uploaded and readable

5. **Start the Server:**
   - Configure one.com to run: `npm start`
   - Or: `node server.js`

## Alternative: Quick Deploy to Vercel (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Create vercel.json:**
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "server.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "/server.js"
       }
     ],
     "env": {
       "EXPO_PUBLIC_SUPABASE_URL": "https://jzxabzfkvckivngombxu.supabase.co",
       "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key"
     }
   }
   ```

3. **Deploy:**
   ```bash
   vercel --prod
   ```

4. **Custom Domain:**
   - Add `backend.wagadogy.com` as a custom domain in Vercel dashboard
   - Update DNS records to point to Vercel

## Testing Your Deployment

Once deployed, test these endpoints:
- `https://backend.wagadogy.com/api/` (health check)
- `https://backend.wagadogy.com/api/health` (detailed health check)
- `https://backend.wagadogy.com/api/test` (API test)

## Next Steps

1. Choose your hosting option
2. Deploy the backend
3. Update your app's environment variable:
   ```
   EXPO_PUBLIC_RORK_API_BASE_URL=https://backend.wagadogy.com
   ```
4. Test the connection from your mobile app

## Troubleshooting

- **CORS Issues:** Ensure CORS is properly configured in `backend/hono.ts`
- **Environment Variables:** Double-check all environment variables are set
- **Port Configuration:** Ensure the hosting service uses the correct port
- **SSL Certificate:** Ensure HTTPS is properly configured for the subdomain