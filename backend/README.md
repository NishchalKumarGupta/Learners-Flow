# Learner's Flow Backend Setup Guide

## Overview
This is the Node.js/Express backend for Learner's Flow Study IDE. It handles YouTube API integration to fetch playlists and video information.

## Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
The `.env` file contains your secret API keys. **Never commit this to Git!**

**Option A: Using existing .env file**
- Edit `backend/.env` and add your YouTube API key:
```
YT_KEY=your_actual_api_key_here
```

**Option B: Creating .env from template**
```bash
cp .env.example .env
# Then edit .env and add your API key
```

### 3. Get Your YouTube API Key
1. Go to [Google Cloud Console](https://console.developers.google.com/apis/credentials)
2. Create a new project
3. Enable YouTube Data API v3
4. Create an API key credential
5. Copy the key and paste it in `backend/.env`

### 4. Start the Server

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server runs on `http://localhost:3000`

## API Endpoints

### Health Check
```
GET /api/health
```

### Get Playlist Videos
```
POST /api/playlist
Body: { "playlistId": "PLxxxxx" }
Returns: { videos: [...] }
```

### Get Video Details
```
POST /api/video
Body: { "videoId": "dQw4w9WgXcQ" }
Returns: { videoId, title, description, thumbnail, viewCount, likeCount }
```

## Environment Variables (.env)
```
YT_KEY=your_youtube_api_key_here    # Your YouTube API key (KEEP SECRET!)
PORT=3000                            # Server port (default 3000)
```

## Security Notes
- ✅ `.env` is in `.gitignore` - it won't be uploaded to GitHub
- ✅ `.env.example` shows what variables are needed (without secrets)
- ✅ Never commit `.env` file
- ✅ Each team member should have their own `.env` file locally
- ✅ In production, use environment variables from hosting platform (Heroku, Vercel, etc.)

## Troubleshooting

**Port already in use:**
```bash
npm start -- --port 3001
# Or set PORT=3001 in .env
```

**API key not working:**
- Check if API key is active in Google Cloud Console
- Verify YouTube Data API v3 is enabled
- Check for typos in `.env`

**CORS errors:**
- Make sure frontend URL is allowed in CORS settings
- Check that backend is running on correct port

## Next Steps
1. Run `npm install` to install dependencies
2. Add your YouTube API key to `.env`
3. Run `npm run dev` to start development server
4. Integrate backend endpoints in your frontend code
