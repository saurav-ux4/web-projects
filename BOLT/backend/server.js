const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ ok: true, message: "Server is healthy" });
});

// Root endpoint
app.get("/", (req, res) => {
    res.send("AI Music Player backend is running");
});

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-music-player', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

// Song Schema
const songSchema = new mongoose.Schema({
    title: { type: String, required: true },
    artist: { type: String, default: 'Unknown Artist' },
    cloudinaryURL: { type: String, required: true },
    duration: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const Song = mongoose.model('Song', songSchema);

// Multer setup for file uploads (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-m4a'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only audio files are allowed.'));
        }
    }
});

// GET route to fetch all songs
app.get('/songs', async (req, res) => {
    try {
        const songs = await Song.find().sort({ createdAt: -1 });
        console.log(`📀 Fetched ${songs.length} songs`);
        res.json(songs);
    } catch (error) {
        console.error('❌ Error fetching songs:', error);
        res.status(500).json({ message: 'Error fetching songs', error: error.message });
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
            console.log('❌ No audio file provided');
            return res.status(400).json({ message: 'No audio file provided' });
        }

        console.log(`📁 Processing file: ${file.originalname}, Size: ${file.size} bytes`);

        // Convert buffer to base64 for Cloudinary
        const b64 = Buffer.from(file.buffer).toString('base64');
        const dataURI = "data:" + file.mimetype + ";base64," + b64;

        console.log('☁️ Uploading to Cloudinary...');
        
        // Upload to Cloudinary
        const cloudinaryUpload = await cloudinary.uploader.upload(dataURI, {
            resource_type: 'auto',
            folder: 'ai-music-player',
            timeout: 60000 // 60 second timeout for large files
        });

        console.log(`✅ Cloudinary upload successful: ${cloudinaryUpload.secure_url}`);

        // Save song metadata to MongoDB
        const newSong = new Song({
            title: title,
            artist: artist,
            cloudinaryURL: cloudinaryUpload.secure_url,
            duration: cloudinaryUpload.duration || 0
        });

        await newSong.save();
        console.log(`💾 Saved to database: ${title}`);

        res.status(201).json({ 
            message: 'Song uploaded successfully', 
            song: newSong 
        });
        
    } catch (error) {
        console.error('❌ Error uploading song:', error);
        res.status(500).json({ 
            message: 'Error uploading song', 
            error: error.message,
            details: error 
        });
    }
});

// DELETE route to remove a song
app.delete('/songs/:id', async (req, res) => {
    try {
        const song = await Song.findByIdAndDelete(req.params.id);
        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }
        res.json({ message: 'Song deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting song:', error);
        res.status(500).json({ message: 'Error deleting song', error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('🔥 Server error:', err);
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Start server
app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
    console.log(`🌐 Health check: http://localhost:${port}/health`);
    console.log(`🎵 API endpoint: http://localhost:${port}/songs`);
});