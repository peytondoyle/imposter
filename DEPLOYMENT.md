# 🚀 Deployment Guide

## Vercel Deployment

### 1. Environment Variables
Set these in your Vercel dashboard:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Build Configuration
- **Framework**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Node.js Version**: 18.x

### 3. Supabase Setup
1. Create a new Supabase project
2. Run the SQL scripts in `/sql/` folder:
   - `schema.sql` - Database schema
   - `rpc_functions.sql` - RPC functions
   - `seed.sql` - Sample data (optional)

### 4. Deployment Steps
1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy!

## Current Status
✅ Build successful
✅ Supabase configured
✅ Vercel config ready
✅ Beautiful UI complete

## Features Ready
- 🎨 Liquid glass UI design
- 🔐 Supabase authentication
- 🎮 Room creation and joining
- 👤 Avatar selection
- 📱 Responsive design