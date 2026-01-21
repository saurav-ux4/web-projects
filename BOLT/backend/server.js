const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

console.log("SERVER.JS IS RUNNING WITH AUTHENTICATION");

const app = express();
const port = process.env.PORT || 5000;

// CORS configuration
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static('public'));

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Nodemailer (using Gmail for demo - for production use SendGrid/Mailgun)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'saurav.982216@gmail.com',
        pass: process.env.EMAIL_PASS || 'ejktiyfzgprqqwme'
    }
});

// Test email configuration
console.log('Email configured:', !!process.env.EMAIL_USER);

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-music-player';

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection failed:', err.message));

// User Schema for authentication
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    otp: String,
    otpExpires: Date,
    isVerified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

// Song Schema
const songSchema = new mongoose.Schema({
    title: String,
    artist: String,
    cloudinaryURL: String,
    userEmail: String, // Link songs to users
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Song = mongoose.model('Song', songSchema);

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }
});

// Store active sessions (in production, use Redis)
const activeSessions = new Map();

// Middleware to check authentication
const authenticate = async (req, res, next) => {
    const sessionId = req.headers.authorization;
    
    if (!sessionId) {
        return res.status(401).json({ message: 'Unauthorized - No session' });
    }
    
    const session = activeSessions.get(sessionId);
    
    if (!session) {
        return res.status(401).json({ message: 'Unauthorized - Session expired' });
    }
    
    // Check if session is expired (24 hours)
    if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
        activeSessions.delete(sessionId);
        return res.status(401).json({ message: 'Unauthorized - Session expired' });
    }
    
    req.user = session;
    next();
};

// 1. Send OTP to email
app.post('/auth/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !email.includes('@')) {
            return res.status(400).json({ message: 'Valid email is required' });
        }
        
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        
        // Create or update user
        await User.findOneAndUpdate(
            { email },
            { 
                email, 
                otp, 
                otpExpires,
                isVerified: false 
            },
            { upsert: true, new: true }
        );
        
        // Send email with OTP
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your OTP for AI Music Player',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>AI Music Player - Verification Code</h2>
                    <p>Your verification code is:</p>
                    <h1 style="background: #f0f0f0; padding: 20px; text-align: center; letter-spacing: 10px; font-size: 32px;">
                        ${otp}
                    </h1>
                    <p>This code will expire in 10 minutes.</p>
                    <p>If you didn't request this code, please ignore this email.</p>
                    <hr>
                    <small>AI Music Player Team</small>
                </div>
            `
        };
        
        // In development, log OTP instead of sending email
        if (process.env.NODE_ENV === 'development') {
            console.log(`📧 OTP for ${email}: ${otp}`);
            return res.json({ 
                message: 'OTP sent (logged to console in development)', 
                otp: otp // Only in development!
            });
        }
        
        await transporter.sendMail(mailOptions);
        res.json({ message: 'OTP sent to your email' });
        
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ message: 'Error sending OTP', error: error.message });
    }
});

// 2. Verify OTP and create session
app.post('/auth/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(400).json({ message: 'Email not found. Request a new OTP.' });
        }
        
        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }
        
        if (user.otpExpires < new Date()) {
            return res.status(400).json({ message: 'OTP expired. Request a new one.' });
        }
        
        // Clear OTP after successful verification
        user.otp = null;
        user.otpExpires = null;
        user.isVerified = true;
        await user.save();
        
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
        console.error('Error verifying OTP:', error);
        res.status(500).json({ message: 'Error verifying OTP', error: error.message });
    }
});

// 3. Logout (remove session)
app.post('/auth/logout', (req, res) => {
    const sessionId = req.headers.authorization;
    
    if (sessionId) {
        activeSessions.delete(sessionId);
    }
    
    res.json({ message: 'Logged out successfully' });
});

// Protected routes
app.get('/songs', authenticate, async (req, res) => {
    try {
        const songs = await Song.find({ userEmail: req.user.email }).sort({ createdAt: -1 });
        res.json(songs);
    } catch (error) {
        console.error('Error fetching songs:', error);
        res.status(500).json({ message: 'Error fetching songs', error: error.message });
    }
});

app.post('/upload', authenticate, upload.single('audio'), async (req, res) => {
    try {
        const file = req.file;
        const title = req.body.title || 'Untitled';
        const artist = req.body.artist || 'Unknown Artist';

        if (!file) {
            return res.status(400).json({ message: 'No audio file provided' });
        }

        // Upload to Cloudinary
        const b64 = Buffer.from(file.buffer).toString('base64');
        const dataURI = "data:" + file.mimetype + ";base64," + b64;

        const cloudinaryUpload = await cloudinary.uploader.upload(dataURI, {
            resource_type: 'auto',
            folder: 'ai-music-player',
            timeout: 60000
        });

        // Save to MongoDB with user email
        const newSong = new Song({
            title: title,
            artist: artist,
            cloudinaryURL: cloudinaryUpload.secure_url,
            userEmail: req.user.email
        });

        await newSong.save();

        res.status(201).json({ 
            message: 'Song uploaded successfully', 
            song: newSong 
        });
        
    } catch (error) {
        console.error('Error uploading song:', error);
        res.status(500).json({ message: 'Error uploading song', error: error.message });
    }
});

// Public health check
app.get('/health', (req, res) => {
    const mongoState = mongoose.connection.readyState;
    const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    
    res.json({ 
        ok: true, 
        service: 'AI Music Player Backend with Auth',
        timestamp: new Date().toISOString(),
        mongodb: {
            state: mongoState,
            status: states[mongoState] || 'unknown',
            connected: mongoState === 1
        },
        activeSessions: activeSessions.size
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
    console.log(`🔐 Authentication enabled`);
    console.log(`📧 Email OTP system active`);
});