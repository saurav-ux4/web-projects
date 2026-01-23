require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const MongoStore = require('connect-mongo');

console.log("🎵 AI Music Player Backend Starting...");

const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('public'));

// Session middleware with MongoDB store
app.use(session({
    secret: process.env.SESSION_SECRET || 'ai-music-player-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 24 * 60 * 60 // 24 hours
    }),
    cookie: {
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined in environment variables');
    process.exit(1);
}

console.log('🔗 Connecting to MongoDB...');
mongoose.connect(MONGODB_URI)
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
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
    filename: String,
    url: String,
    userEmail: String,
    size: Number,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Song = mongoose.model('Song', songSchema);

// Auth middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Unauthorized. Please login.' });
    }
    next();
};

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/mp4', 'audio/x-m4a'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only audio files are allowed.'));
        }
    }
});

// ================== ROUTES ==================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'AI Music Player',
        version: '3.1.0',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1,
        uploadsDir: uploadsDir
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
        
        // Save OTP to database
        await User.findOneAndUpdate(
            { email },
            { 
                email,
                otp,
                otpExpires,
                createdAt: new Date()
            },
            { upsert: true, new: true }
        );
        
        res.json({
            message: 'OTP generated successfully',
            otp: otp // In production, send via email
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
        
        // Get user from database
        const user = await User.findOne({ email });
        
        if (!user || user.otp !== otp || user.otpExpires < new Date()) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }
        
        // Clear OTP after verification
        user.otp = null;
        user.otpExpires = null;
        await user.save();
        
        // Create session
        req.session.userId = user._id;
        req.session.email = email;
        
        res.json({
            message: 'Login successful!',
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
        
        songs = await Song.find({ userEmail: req.session.email }).sort({ createdAt: -1 });
        
        // If no songs, return demo song
        if (songs.length === 0) {
            songs = [{
                _id: 'demo1',
                title: 'Welcome to AI Music Player',
                artist: 'Demo Track',
                url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                userEmail: req.session.email,
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
app.post('/upload', requireAuth, upload.single('audio'), async (req, res) => {
    try {
        const file = req.file;
        const title = req.body.title || path.parse(file.originalname).name;
        const artist = req.body.artist || 'Unknown Artist';
        
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        // Create song record
        const songData = {
            title,
            artist,
            filename: file.filename,
            url: `/uploads/${file.filename}`,
            userEmail: req.session.email,
            size: file.size
        };
        
        const song = new Song(songData);
        await song.save();
        
        res.json({ 
            message: 'Song uploaded successfully', 
            song: {
                ...songData,
                _id: song._id,
                createdAt: song.createdAt
            }
        });
        
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ 
            message: error.message || 'Upload failed', 
            error: error.message 
        });
    }
});

// Delete song
app.delete('/songs/:id', requireAuth, async (req, res) => {
    try {
        const song = await Song.findOne({ 
            _id: req.params.id, 
            userEmail: req.session.email 
        });
        
        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }
        
        // Delete file from filesystem
        if (song.filename) {
            const filePath = path.join(uploadsDir, song.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        // Delete from database
        await Song.deleteOne({ _id: req.params.id });
        
        res.json({ message: 'Song deleted successfully' });
        
    } catch (error) {
        console.error('Delete Error:', error);
        res.status(500).json({ message: 'Error deleting song', error: error.message });
    }
});

// Logout
app.post('/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed' });
        }
        res.json({ message: 'Logged out successfully' });
    });
});

// Get current user
app.get('/auth/user', (req, res) => {
    if (req.session.email) {
        res.json({ email: req.session.email });
    } else {
        res.status(401).json({ message: 'Not logged in' });
    }
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        message: 'Something went wrong!', 
        error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Health: http://localhost:${PORT}/health`);
    console.log(`🔐 OTP Login: Enabled`);
    console.log(`📁 Uploads: ${uploadsDir}`);
    console.log(`📁 Frontend: Served from /public`);
});