// AI Music Player Backend with Authentication
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const path = require('path');

console.log("🚀 AI Music Player Backend Starting...");

const app = express();
const port = process.env.PORT || 5000;

// ========== CONFIGURATION ==========
const config = {
    // MongoDB Atlas
    mongodbUri: process.env.MONGODB_URI || 'mongodb+srv://saurav982216_db_user:hGcStjbBugg2K5se@cluster0.lruurc9.mongodb.net/ai-music-player',
    
    // Cloudinary
    cloudinary: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dchyewou4',
        api_key: process.env.CLOUDINARY_API_KEY || '378845981546511',
        api_secret: process.env.CLOUDINARY_API_SECRET || 'tIE3-JdRdzTDseFKji7It-fjBs0'
    },
    
    // Email (optional for now)
    email: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
};

// ========== MIDDLEWARE ==========
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static('public'));

// ========== SERVICE SETUP ==========
console.log('🔧 Setting up services...');

// Cloudinary
cloudinary.config(config.cloudinary);
console.log('✅ Cloudinary configured');

// Email Service (Optional)
let transporter = null;
if (config.email.user && config.email.pass) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: config.email.user,
            pass: config.email.pass
        }
    });
    console.log('✅ Email service configured');
} else {
    console.log('⚠️ Email not configured - OTPs will be logged to console');
}

// MongoDB Connection
console.log('🔗 Connecting to MongoDB Atlas...');
mongoose.connect(config.mongodbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
})
.then(() => {
    console.log('✅ MongoDB Atlas Connected');
    console.log('Database:', mongoose.connection.db.databaseName);
})
.catch(err => {
    console.error('❌ MongoDB Connection Failed:', err.message);
    console.log('⚠️ Running in demo mode without database');
});

// ========== DATABASE SCHEMAS ==========
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    otp: String,
    otpExpires: Date,
    verifiedAt: Date,
    createdAt: { type: Date, default: Date.now }
});

const songSchema = new mongoose.Schema({
    title: { type: String, required: true },
    artist: { type: String, default: 'Unknown Artist' },
    cloudinaryURL: { type: String, required: true },
    userEmail: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Song = mongoose.model('Song', songSchema);

// ========== IN-MEMORY STORAGE (Fallback) ==========
const activeSessions = new Map();
const demoUsers = new Map();
const demoSongs = [];

// ========== AUTHENTICATION MIDDLEWARE ==========
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

// ========== ROUTES ==========

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'running',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        services: {
            mongodb: mongoose.connection.readyState === 1,
            cloudinary: !!config.cloudinary.cloud_name,
            email: !!transporter
        }
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
        
        // Store in database (or memory)
        if (mongoose.connection.readyState === 1) {
            await User.findOneAndUpdate(
                { email },
                { email, otp, otpExpires },
                { upsert: true, new: true }
            );
        } else {
            demoUsers.set(email, { otp, otpExpires });
        }
        
        // Send email or log to console
        if (transporter) {
            const mailOptions = {
                from: config.email.user,
                to: email,
                subject: 'Your OTP for AI Music Player',
                html: `<h1>${otp}</h1><p>Use this code to login</p>`
            };
            await transporter.sendMail(mailOptions);
            res.json({ message: 'OTP sent to your email' });
        } else {
            console.log(`📧 OTP for ${email}: ${otp}`);
            res.json({ 
                message: 'OTP generated (check console)', 
                otp: otp 
            });
        }
        
    } catch (error) {
        console.error('OTP Error:', error);
        res.status(500).json({ message: 'Error sending OTP', error: error.message });
    }
});

// Verify OTP
app.post('/auth/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        
        let userData;
        
        // Check in database or memory
        if (mongoose.connection.readyState === 1) {
            const user = await User.findOne({ email });
            if (!user || user.otp !== otp || user.otpExpires < new Date()) {
                return res.status(400).json({ message: 'Invalid or expired OTP' });
            }
            
            // Clear OTP
            user.otp = null;
            user.otpExpires = null;
            user.verifiedAt = new Date();
            await user.save();
            
        } else {
            userData = demoUsers.get(email);
            if (!userData || userData.otp !== otp || userData.otpExpires < new Date()) {
                return res.status(400).json({ message: 'Invalid or expired OTP' });
            }
            demoUsers.delete(email);
        }
        
        // Create session
        const sessionId = crypto.randomBytes(32).toString('hex');
        const session = {
            email,
            sessionId,
            createdAt: Date.now()
        };
        
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

// Get Songs
app.get('/songs', authenticate, async (req, res) => {
    try {
        let songs;
        
        if (mongoose.connection.readyState === 1) {
            songs = await Song.find({ userEmail: req.user.email }).sort({ createdAt: -1 });
        } else {
            // Demo songs
            songs = demoSongs.filter(song => song.userEmail === req.user.email);
            
            // Add sample song if none
            if (songs.length === 0) {
                songs = [{
                    _id: 'demo1',
                    title: 'Welcome to AI Music Player',
                    artist: 'Demo Artist',
                    cloudinaryURL: 'https://res.cloudinary.com/dchyewou4/video/upload/v1700000000/sample.mp3',
                    userEmail: req.user.email,
                    createdAt: new Date()
                }];
            }
        }
        
        res.json(songs);
        
    } catch (error) {
        console.error('Fetch Songs Error:', error);
        res.status(500).json({ message: 'Error fetching songs', error: error.message });
    }
});

// Upload Song
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
});

app.post('/upload', authenticate, upload.single('audio'), async (req, res) => {
    try {
        const file = req.file;
        const title = req.body.title || 'Untitled';
        const artist = req.body.artist || 'Unknown Artist';
        
        if (!file) {
            return res.status(400).json({ message: 'No audio file' });
        }
        
        // Upload to Cloudinary
        const b64 = Buffer.from(file.buffer).toString('base64');
        const dataURI = `data:${file.mimetype};base64,${b64}`;
        
        const uploadResult = await cloudinary.uploader.upload(dataURI, {
            resource_type: 'auto',
            folder: 'ai-music-player',
            timeout: 60000
        });
        
        const songData = {
            title,
            artist,
            cloudinaryURL: uploadResult.secure_url,
            userEmail: req.user.email,
            createdAt: new Date()
        };
        
        // Save to database or memory
        if (mongoose.connection.readyState === 1) {
            const song = new Song(songData);
            await song.save();
            res.json({ message: 'Song uploaded', song });
        } else {
            songData._id = `demo${Date.now()}`;
            demoSongs.push(songData);
            res.json({ message: 'Song uploaded (demo mode)', song: songData });
        }
        
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ message: 'Upload failed', error: error.message });
    }
});

// Serve Frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== START SERVER ==========
app.listen(port, () => {
    console.log(`🎵 AI Music Player running on port ${port}`);
    console.log(`🌐 Health: http://localhost:${port}/health`);
    console.log(`🔐 Authentication: ENABLED`);
    console.log(`📧 OTP Mode: ${transporter ? 'Email' : 'Console Logging'}`);
});