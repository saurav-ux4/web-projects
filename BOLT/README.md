# 🎵 AI Music Player

A beautiful, cloud-powered music player with AI features. Upload, manage, and play your music collection anywhere.

## 🌟 Features

- **Cloud Storage**: Store music in Cloudinary
- **Database**: MongoDB for song metadata
- **Responsive Design**: Works on all devices
- **Keyboard Shortcuts**: Quick controls
- **Playlist Management**: Add, remove, organize songs
- **Real-time Updates**: Instant feedback
- **PWA Support**: Install as app
- **Offline Mode**: Cache songs for offline playback

## 🚀 Quick Deploy on Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

1. **Fork/Clone** this repository
2. **Create accounts** on:
   - [Render](https://render.com) for hosting
   - [MongoDB Atlas](https://mongodb.com/cloud) for database
   - [Cloudinary](https://cloudinary.com) for file storage
3. **Set environment variables** in Render dashboard
4. **Deploy** - That's it!

## 🔧 Local Development

```bash
# 1. Clone repository
git clone https://github.com/yourusername/ai-music-player.git
cd ai-music-player

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
# Edit .env with your credentials

# 4. Start MongoDB locally (or use Atlas)
# Install MongoDB or use Docker

# 5. Run development server
npm run dev

# 6. Open frontend
# Open public/index.html with live server
# Or serve with: npx serve public/