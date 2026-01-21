const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

console.log("🚀 AI Music Player Starting...");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://saurav982216_db_user:hGcStjbBugg2K5se@cluster0.lruurc9.mongodb.net/ai-music-player';

console.log('Connecting to MongoDB...');

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
})
.then(() => {
    console.log('✅ MongoDB Connected Successfully');
})
.catch(err => {
    console.error('❌ MongoDB Connection Failed:', err.message);
});

// Schemas
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    otp: String,
    otpExpires: Date,
    createdAt: { type: Date, default: Date.now }
});

const songSchema = new mongoose.Schema({
    title: String,
    artist: String,
    cloudinaryURL: String,
    userEmail: String,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Song = mongoose.model('Song', songSchema);

// In-memory storage (fallback)
const activeSessions = new Map();

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
});

// Auth middleware
const authenticate = (req, res, next) => {
    const sessionId = req.headers.authorization;
    
    if (!sessionId) {
        return res.status(401).json({ message: 'No session token' });
    }
    
    const session = activeSessions.get(sessionId);
    
    if (!session) {
        return res.status(401).json({ message: 'Session expired' });
    }
    
    req.user = session;
    next();
};

// 1. Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'AI Music Player',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1,
        version: '2.0.0'
    });
});

// 2. Send OTP
app.post('/auth/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !email.includes('@')) {
            return res.status(400).json({ message: 'Valid email required' });
        }
        
        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        
        // Save to database or memory
        if (mongoose.connection.readyState === 1) {
            await User.findOneAndUpdate(
                { email },
                { email, otp, otpExpires },
                { upsert: true, new: true }
            );
        }
        
        console.log(`📧 OTP for ${email}: ${otp}`);
        
        res.json({ 
            message: 'OTP generated. Check server logs for code.',
            otp: otp  // In production, remove this line
        });
        
    } catch (error) {
        console.error('OTP Error:', error);
        res.status(500).json({ message: 'Error generating OTP', error: error.message });
    }
});

// 3. Verify OTP
app.post('/auth/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        
        let isValid = false;
        
        // Check in database
        if (mongoose.connection.readyState === 1) {
            const user = await User.findOne({ email, otp });
            if (user && user.otpExpires > new Date()) {
                isValid = true;
                // Clear OTP
                user.otp = null;
                user.otpExpires = null;
                await user.save();
            }
        } else {
            // For demo, accept any OTP that was logged
            console.log(`Verifying OTP for ${email}: ${otp}`);
            isValid = true;
        }
        
        if (!isValid) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }
        
        // Create session
        const sessionId = crypto.randomBytes(32).toString('hex');
        const session = { email, sessionId, createdAt: Date.now() };
        activeSessions.set(sessionId, session);
        
        res.json({
            message: 'OTP verified successfully',
            sessionId,
            email
        });
        
    } catch (error) {
        console.error('Verify Error:', error);
        res.status(500).json({ message: 'Error verifying OTP', error: error.message });
    }
});

// 4. Get Songs
app.get('/songs', authenticate, async (req, res) => {
    try {
        let songs = [];
        
        if (mongoose.connection.readyState === 1) {
            songs = await Song.find({ userEmail: req.user.email }).sort({ createdAt: -1 });
        }
        
        // If no songs, return demo songs
        if (songs.length === 0) {
            songs = [
                {
                    _id: 'demo1',
                    title: 'Welcome Song',
                    artist: 'AI Music Player',
                    cloudinaryURL: 'https://res.cloudinary.com/dchyewou4/video/upload/v1700000000/music/sample.mp3',
                    userEmail: req.user.email,
                    createdAt: new Date()
                }
            ];
        }
        
        res.json(songs);
        
    } catch (error) {
        console.error('Fetch Error:', error);
        res.status(500).json({ message: 'Error fetching songs', error: error.message });
    }
});

// 5. Upload Song (simplified for now)
app.post('/upload', authenticate, upload.single('audio'), async (req, res) => {
    try {
        const file = req.file;
        const title = req.body.title || 'Untitled';
        const artist = req.body.artist || 'Unknown Artist';
        
        if (!file) {
            return res.status(400).json({ message: 'No audio file' });
        }
        
        // For now, just save metadata without Cloudinary
        const songData = {
            title,
            artist,
            cloudinaryURL: `https://example.com/${Date.now()}.mp3`, // Placeholder
            userEmail: req.user.email,
            createdAt: new Date()
        };
        
        if (mongoose.connection.readyState === 1) {
            const song = new Song(songData);
            await song.save();
            res.json({ message: 'Song metadata saved', song });
        } else {
            res.json({ message: 'Upload would be processed with Cloudinary in production', song: songData });
        }
        
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ message: 'Upload failed', error: error.message });
    }
});

// 6. Logout
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
app.listen(port, () => {
    console.log(`🎵 Server running on port ${port}`);
    console.log(`🔗 Health: http://localhost:${port}/health`);
    console.log(`🔐 Authentication: ENABLED`);
});