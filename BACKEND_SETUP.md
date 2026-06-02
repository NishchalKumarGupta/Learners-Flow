# Learner's Flow - Complete Setup & Deployment Guide

## ✅ What's Been Done

Your backend has been rebuilt with:
- **Node.js/Express** server for YouTube API integration
- **Environment variable setup** (.env for secrets, .env.example as template)
- **Git version control** (`.env` automatically excluded from commits)
- **Dependencies installed** (express, cors, dotenv, axios)
- **Security configured** (.gitignore prevents secret files from uploading)

## 📁 Project Structure

```
Learner-Flow/
├── index.html                 # Frontend
├── css/
│   └── style.css
├── js/
│   └── app.js
├── backend/                   # NEW BACKEND
│   ├── package.json          # Dependencies list
│   ├── server.js             # Main backend server
│   ├── .env                  # YOUR SECRETS (not committed to Git)
│   ├── .env.example          # Template for team members
│   ├── README.md             # Backend documentation
│   └── node_modules/         # Dependencies (installed)
├── .gitignore               # Updated to exclude .env & node_modules
└── README.md               # Main project documentation
```

## 🔐 Environment Variables & Security

### What is `.env`?
A file that stores **secret information** that shouldn't go on GitHub:
- API keys
- Database passwords
- Authentication tokens
- Any sensitive configuration

### Your Files:
1. **`.env`** - Your LOCAL secrets (on your computer only)
   - Contains your real YouTube API key
   - **NEVER** uploaded to GitHub (protected by .gitignore)
   - Each team member has their own

2. **`.env.example`** - Template file (safe to commit)
   - Shows what variables are needed
   - Has NO actual secrets
   - Helps team members know what to set up

## 🚀 Next Steps to Get Running

### Step 1: Add Your YouTube API Key
```bash
# Edit backend/.env and add your API key
YT_KEY=your_actual_youtube_api_key_here
PORT=3000
```

### Step 2: Start the Backend Server
```bash
cd backend
npm run dev    # For development (auto-restarts on changes)
# OR
npm start      # For production
```

You should see:
```
✅ Learner's Flow Backend running at http://localhost:3000
📺 YouTube API configured: Yes
```

### Step 3: Update Frontend Code
Your `js/app.js` currently makes API calls. Update it to point to your backend:
```javascript
// Change API calls from direct YouTube calls to:
const response = await fetch('http://localhost:3000/api/playlist', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ playlistId: '...' })
});
```

## 📤 Uploading to GitHub

### Step 1: Create a GitHub Repository
1. Go to [GitHub.com](https://github.com)
2. Click "New Repository"
3. Name it "Learner-Flow"
4. Click "Create Repository"

### Step 2: Connect Your Local Git to GitHub
```bash
# Replace YOUR_USERNAME and YOUR_REPO with your actual values
cd c:\Users\KIIT\Desktop\Learner-Flow
git remote add origin https://github.com/YOUR_USERNAME/Learner-Flow.git
git branch -M main
git push -u origin main
```

### Step 3: Verify on GitHub
- Visit your repository: `https://github.com/YOUR_USERNAME/Learner-Flow`
- You should see:
  ✅ index.html, css/, js/ (frontend files)
  ✅ backend/ folder (with .env.example)
  ✅ ❌ NO .env file (protected by .gitignore)
  ✅ ❌ NO node_modules/ (too large to upload)

## 🔒 Security Checklist

- [x] `.env` is in `.gitignore` - won't be committed
- [x] `.env.example` shows what to configure
- [x] `node_modules/` is in `.gitignore` - won't bloat repo
- [x] Backend server doesn't hardcode secrets
- [ ] **TODO**: Add your YouTube API key to `backend/.env`
- [ ] **TODO**: Test that backend runs without errors

## 🧪 Testing Your Setup

1. **Start backend:**
   ```bash
   cd backend && npm run dev
   ```

2. **Test health endpoint:**
   ```bash
   curl http://localhost:3000/api/health
   ```

3. **Expected response:**
   ```json
   {
     "status": "Backend is running",
     "timestamp": "2026-04-30T...",
     "ytApiConfigured": true
   }
   ```

## 💡 Pro Tips

### For Team Members
When someone clones your GitHub repo:
```bash
git clone https://github.com/YOUR_USERNAME/Learner-Flow.git
cd Learner-Flow/backend
npm install                          # Install dependencies
cp .env.example .env                # Create their .env
# They edit .env and add their own API key
npm run dev                          # Run the server
```

### Make Changes & Update GitHub
```bash
# After making changes:
git add .                    # Stage files (not .env!)
git commit -m "Your message" # Commit
git push                     # Upload to GitHub
```

### Use Environment Variables in Production
When deploying (Heroku, Vercel, etc.), set environment variables through their dashboard instead of using .env files.

## ❓ Common Questions

**Q: Why can't I commit .env?**
A: It contains secret API keys. If someone gets your .env, they can use your API quota or steal your data.

**Q: What if I accidentally commit .env?**
A: 1. Regenerate your API key immediately. 2. Run: `git rm --cached .env` 3. Commit the removal.

**Q: My node_modules folder is huge - can I commit it?**
A: No! That's why it's in .gitignore. People install dependencies locally with `npm install`.

**Q: Can I share my .env with team members?**
A: No. Each person should have their own .env with their own API keys.

## 📞 Need Help?

- Backend issues? Check `backend/README.md`
- Git issues? Run `git status` to see current state
- API errors? Check your YouTube API key is active in Google Cloud Console
