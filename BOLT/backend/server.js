const express = require('express');
const mongoose = require('mongoose');
mongoose.set('strictQuery', false);
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
require('dotenv').config();

console.log("SERVER.JS IS RUNNING - DEBUG MODE");

const app = express();
const port = process.env.PORT || 5000;

// CORS configuration
app.use(cors({
    origin: '*', // Allow all for testing
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Debug: Check if environment variables are loaded
console.log('Environment check:');
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('CLOUDINARY_CLOUD_NAME exists:', !!process.env.CLOUDINARY_CLOUD_NAME);
console.log('CLOUDINARY_API_KEY exists:', !!process.env.CLOUDINARY_API_KEY);

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// MongoDB Connection with better error handling
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-music-player';
console.log('Attempting to connect to MongoDB...');
console.log('URI (first 50 chars):', mongoURI.substring(0, 50) + '...');

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45s
})
.then(() => {
    console.log('✅ Connected to MongoDB successfully');
    console.log('Database:', mongoose.connection.db.databaseName);
})
.catch(err => {
    console.error('❌ MongoDB connection FAILED:', err.message);
    console.error('Full error:', err);
});

// Add MongoDB connection event listeners
mongoose.connection.on('connected', () => {
    console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ Mongoose disconnected from MongoDB');
});

// Song Schema
const songSchema = new mongoose.Schema({
    title: String,
    artist: String,
    cloudinaryURL: String,
    createdAt: { type: Date, default: Date.now }
});

const Song = mongoose.model('Song', songSchema);

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// GET route to fetch all songs
app.get('/songs', async (req, res) => {
    try {
        console.log('📦 Fetching songs from MongoDB...');
        
        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            console.error('❌ MongoDB not connected. State:', mongoose.connection.readyState);
            return res.status(500).json({ 
                message: 'Database not connected',
                error: 'MongoDB connection not ready',
                state: mongoose.connection.readyState 
            });
        }
        
        const songs = await Song.find().sort({ createdAt: -1 });
        console.log(`✅ Found ${songs.length} songs`);
        res.json(songs);
    } catch (error) {
        console.error('❌ Error fetching songs:', error.message);
        console.error('Full error:', error);
        res.status(500).json({ 
            message: 'Error fetching songs',
            error: error.message,
            details: 'Check MongoDB connection and credentials'
        });
    }
});

// POST route to upload a song
app.post('/upload', upload.single('audio'), async (req, res) => {
    try {
        console.log('📤 Upload request received');
        
        const file = req.file;
        const title = req.body.title || 'Untitled';
        const artist = req.body.artist || 'Unknown Artist';

        if (!file) {
            return res.status(400).json({ message: 'No audio file provided' });
        }

        console.log(`📁 Processing: ${file.originalname}, ${file.size} bytes`);

        // Upload to Cloudinary
        const b64 = Buffer.from(file.buffer).toString('base64');
        const dataURI = "data:" + file.mimetype + ";base64," + b64;

        console.log('☁️ Uploading to Cloudinary...');
        
        const cloudinaryUpload = await cloudinary.uploader.upload(dataURI, {
            resource_type: 'auto',
            folder: 'ai-music-player',
            timeout: 60000
        });

        console.log(`✅ Cloudinary URL: ${cloudinaryUpload.secure_url}`);

        // Save to MongoDB
        const newSong = new Song({
            title: title,
            artist: artist,
            cloudinaryURL: cloudinaryUpload.secure_url
        });

        await newSong.save();
        console.log(`💾 Saved to DB: ${title}`);

        res.status(201).json({ 
            message: 'Song uploaded successfully', 
            song: newSong 
        });
        
    } catch (error) {
        console.error('❌ Error uploading song:', error.message);
        console.error('Full error:', error);
        res.status(500).json({ 
            message: 'Error uploading song', 
            error: error.message 
        });
    }
});

app.get("/", (req, res) => {
    res.send("AI Music Player backend is running. Check /health for status.");
});

// Health check with detailed status
app.get("/health", (req, res) => {
    const mongoState = mongoose.connection.readyState;
    const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };
    
    res.json({ 
        ok: true, 
        service: 'AI Music Player Backend',
        timestamp: new Date().toISOString(),
        mongodb: {
            state: mongoState,
            status: states[mongoState] || 'unknown',
            connected: mongoState === 1
        },
        cloudinary: {
            configured: !!process.env.CLOUDINARY_CLOUD_NAME
        },
        endpoints: {
            songs: '/songs',
            upload: '/upload'
        }
    });
});

app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
    console.log(`🌐 Health check: http://localhost:${port}/health`);
    console.log(`🎵 Songs endpoint: http://localhost:${port}/songs`);
});