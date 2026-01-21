const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

console.log("🎵 AI Music Player Backend Starting...");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://saurav982216_db_user:hGcStjbBugg2K5se@cluster0.lruurc9.mongodb.net/ai-music-player';

console.log('🔗 Connecting to MongoDB...');
console.log('URI:', MONGODB_URI.substring(0, 50) + '...');

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.log('⚠️ MongoDB Warning:', err.message));

// Schemas
const userSchema = new mongoose.Schema({
    email: String,
    otp: String,
    otpExpires: Date,
    createdAt: { type: Date, default: Date.now }
});

const songSchema = new mongoose.Schema({
    title: String,
    artist: String,
    url: String,
    userEmail: String,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Song = mongoose.model('Song', songSchema);

// Session storage
const activeSessions = new Map();

// Auth middleware
const requireAuth = (req, res, next) => {
    const sessionId = req.headers.authorization;
    
    if (!sessionId || !activeSessions.has(sessionId)) {
        return res.status(401).json({ message: 'Unauthorized. Please login.' });
    }
    
    const session = activeSessions.get(sessionId);
    // Check if session is older than 24 hours
    if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
        activeSessions.delete(sessionId);
        return res.status(401).json({ message: 'Session expired.' });
    }
    
    req.user = session;
    next();
};

// ================== ROUTES ==================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'AI Music Player',
        version: '3.0.0',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1
    });
});

// Send OTP
app.post('/auth/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !email.includes('@')) {
            return res.status(400).json({ message: 'Valid email required' });
        }
        
        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        
        console.log(`📧 OTP for ${email}: ${otp}`);
        
        // Save OTP (in memory for now)
        activeSessions.set(`otp_${email}`, { otp, otpExpires });
        
        res.json({
            message: 'OTP generated successfully',
            otp: otp // In production, remove this and send actual email
        });
        
    } catch (error) {
        console.error('OTP Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Verify OTP
app.post('/auth/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        
        // Get stored OTP
        const otpKey = `otp_${email}`;
        const storedOtp = activeSessions.get(otpKey);
        
        if (!storedOtp || storedOtp.otp !== otp || storedOtp.otpExpires < new Date()) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }
        
        // Remove OTP from storage
        activeSessions.delete(otpKey);
        
        // Create session
        const sessionId = crypto.randomBytes(32).toString('hex');
        const session = {
            email,
            sessionId,
            createdAt: Date.now()
        };
        
        activeSessions.set(sessionId, session);
        
        res.json({
            message: 'Login successful!',
            sessionId,
            email
        });
        
    } catch (error) {
        console.error('Verify Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get user's songs
app.get('/songs', requireAuth, async (req, res) => {
    try {
        let songs = [];
        
        if (mongoose.connection.readyState === 1) {
            songs = await Song.find({ userEmail: req.user.email }).sort({ createdAt: -1 });
        }
        
        // If no songs, return demo song
        if (songs.length === 0) {
            songs = [{
                _id: 'demo1',
                title: 'Welcome to AI Music Player',
                artist: 'Demo Track',
                url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                userEmail: req.user.email,
                createdAt: new Date()
            }];
        }
        
        res.json(songs);
        
    } catch (error) {
        console.error('Fetch Error:', error);
        res.status(500).json({ message: 'Error fetching songs', error: error.message });
    }
});

// Upload song
const upload = multer({ storage: multer.memoryStorage() });
app.post('/upload', requireAuth, upload.single('audio'), async (req, res) => {
    try {
        const file = req.file;
        const title = req.body.title || 'New Song';
        const artist = req.body.artist || 'Unknown Artist';
        
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        // Create song record (in a real app, upload to Cloudinary here)
        const songData = {
            title,
            artist,
            url: `https://example.com/audio/${Date.now()}.mp3`, // Placeholder
            userEmail: req.user.email
        };
        
        if (mongoose.connection.readyState === 1) {
            const song = new Song(songData);
            await song.save();
            res.json({ message: 'Song saved successfully', song });
        } else {
            songData._id = `song_${Date.now()}`;
            res.json({ message: 'Song would be saved to database when connected', song: songData });
        }
        
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ message: 'Upload failed', error: error.message });
    }
});

// Logout
app.post('/auth/logout', (req, res) => {
    const sessionId = req.headers.authorization;
    if (sessionId) {
        activeSessions.delete(sessionId);
    }
    res.json({ message: 'Logged out successfully' });
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Health: http://localhost:${PORT}/health`);
    console.log(`🔐 OTP Login: Enabled`);
    console.log(`📁 Frontend: Served from /public`);
});