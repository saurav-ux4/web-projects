const express = require('express');
const mongoose = require('mongoose');
mongoose.set('strictQuery', false);  // Add this line
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env file

console.log("SERVER.JS IS RUNNING");

const app = express();
const port = process.env.PORT || 5000;

// CORS configuration for cloud deployment
app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000', 'https://your-frontend-domain.vercel.app'], // Add your frontend domains
    credentials: true
}));

app.use(express.json());

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// MongoDB Connection (for Atlas)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-music-player', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
    });

// Song Schema
const songSchema = new mongoose.Schema({
    title: String,
    artist: String,
    cloudinaryURL: String
});

const Song = mongoose.model('Song', songSchema);

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// GET route to fetch all songs
app.get('/songs', async (req, res) => {
    try {
        const songs = await Song.find();
        res.json(songs);
    } catch (error) {
        console.error('Error fetching songs:', error);
        res.status(500).json({ message: 'Error fetching songs' });
    }
});

// POST route to upload a song
app.post('/upload', upload.single('audio'), async (req, res) => {
    try {
        const file = req.file;
        const title = req.body.title;
        const artist = req.body.artist;

        if (!file) {
            return res.status(400).json({ message: 'No audio file provided' });
        }

        console.log('Uploading file to Cloudinary...');

        // Upload to Cloudinary
        const cloudinaryUpload = await cloudinary.uploader.upload(`data:${file.mimetype};base64,${file.buffer.toString('base64')}`, {
            resource_type: 'auto',  // Changed from 'audio' to 'auto' for better compatibility
            folder: 'ai-music-player'
        });

        console.log('Cloudinary upload successful:', cloudinaryUpload.secure_url);

        // Save song metadata to MongoDB
        const newSong = new Song({
            title: title,
            artist: artist,
            cloudinaryURL: cloudinaryUpload.secure_url
        });

        await newSong.save();

        res.status(201).json({ message: 'Song uploaded successfully', song: newSong });
    } catch (error) {
        console.error('Error uploading song:', error);
        res.status(500).json({ message: 'Error uploading song', error: error.message });
    }
});

app.get("/", (req, res) => {
    res.send("AI Music Player backend is running");
});

// Health check route
app.get("/health", (req, res) => {
    res.json({ ok: true, message: "Server is healthy", timestamp: new Date() });
});

app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
    console.log(`🌐 MongoDB: ${process.env.MONGODB_URI ? 'Atlas configured' : 'Using local'}`);
    console.log(`☁️ Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'Not configured'}`);
});