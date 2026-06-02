# Learner's Flow - Study IDE with YouTube Integration

A web-based IDE for learning programming with integrated YouTube playlist support, multi-language code execution, and study tracking.

## 🎯 Features

- 📺 **YouTube Playlist Integration** - Load and manage study videos
- 💻 **Multi-Language IDE** - Write and execute code in Python, Java, C++
- 📝 **Note-Taking System** - Take notes while watching videos
- 🔥 **Study Streak Tracking** - Track your daily learning progress
- 🎨 **Modern UI** - Clean, responsive interface for better learning

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- YouTube API key from [Google Cloud Console](https://console.developers.google.com/apis/credentials)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/NishchalKumarGupta/Learner-Flow.git
   cd Learner-Flow
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   ```

3. **Add YouTube API Key**
   - Edit `backend/.env`
   - Add your YouTube API key:
   ```
   YT_KEY=your_api_key_here
   PORT=3000
   ```

4. **Start Backend Server**
   ```bash
   node server.js
   ```
   Backend will run on `http://localhost:3000`

5. **Start Frontend Server** (in another terminal)
   ```bash
   npx http-server
   ```
   Frontend will run on `http://localhost:8080`

6. **Open in Browser**
   - Go to `http://localhost:8080`

## 📁 Project Structure

```
Learner-Flow/
├── index.html              # Main frontend
├── css/
│   └── style.css          # Styling
├── js/
│   └── app.js             # Frontend logic
├── backend/
│   ├── server.js          # Express backend server
│   ├── package.json       # Dependencies
│   ├── .env               # Local configuration (secrets)
│   ├── .env.example       # Template (safe to commit)
│   └── README.md          # Backend documentation
├── .gitignore             # Git ignore rules
└── BACKEND_SETUP.md       # Detailed backend guide
```

## 🔌 API Endpoints

### Health Check
```
GET /api/health
```
Returns backend status and API configuration.

### Get Playlist Videos
```
GET /api/playlist?playlistId=PLxxxx&pageToken=optional
```
Fetches videos from a YouTube playlist.

### Get Video Details
```
POST /api/video
Body: { "videoId": "dQw4w9WgXcQ" }
```
Retrieves detailed video information.

## 🔐 Security

- ✅ `.env` file is in `.gitignore` - your API key is never committed
- ✅ `.env.example` shows required variables without secrets
- ✅ Use environment variables for all sensitive data
- ✅ Each developer has their own local `.env` file

### Getting YouTube API Key

1. Go to [Google Cloud Console](https://console.developers.google.com/)
2. Create a new project
3. Enable **YouTube Data API v3**
4. Create an **API Key** credential
5. Add it to your `backend/.env`

## 🛠️ Tech Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **API**: YouTube Data API v3
- **Code Execution**: Piston API (remote execution)
- **Version Control**: Git & GitHub

## 📝 Environment Variables

Create a `.env` file in the `backend/` folder:

```env
# YouTube API Key (keep secret!)
YT_KEY=your_youtube_api_key_here

# Server Configuration
PORT=3000
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Change port in .env
PORT=3001

# Or kill process using port 3000
taskkill /F /IM node.exe  (Windows)
lsof -ti:3000 | xargs kill -9  (Mac/Linux)
```

### API Key Not Working
- Verify API key is active in Google Cloud Console
- Check YouTube Data API v3 is enabled
- Ensure no typos in `.env`

### CORS Errors
- Make sure backend is running on correct port
- Verify frontend URL is allowed in CORS settings

## 🚀 Deployment

### Deploying Backend to Heroku/Vercel
1. Create account on Heroku or Vercel
2. Set environment variables through their dashboard
3. Deploy your backend
4. Update frontend API URL to your deployed backend

### Deploying Frontend
- Use GitHub Pages, Netlify, or Vercel
- Ensure API URLs point to your backend

## 📚 Learning Resources

- [YouTube Data API Docs](https://developers.google.com/youtube/v3)
- [Express.js Guide](https://expressjs.com/)
- [Piston API](https://github.com/engineer-man/piston)

## 👨‍💻 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -m "Add new feature"`)
4. Push to branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the MIT License.

## 💡 Future Enhancements

- [ ] User authentication & profiles
- [ ] Save and sync notes to cloud
- [ ] Code collaboration features
- [ ] Dark mode
- [ ] Mobile app version
- [ ] Video transcripts & search
- [ ] Custom code templates

## 📞 Support

For issues or questions, please open an issue on GitHub.

## 🙏 Acknowledgments

- YouTube Data API for playlist integration
- Piston API for code execution
- All contributors and supporters

---

**Made with ❤️ for learners by NishchalKumarGupta**
