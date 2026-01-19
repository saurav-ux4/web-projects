const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

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

        // Upload to Cloudinary
        const cloudinaryUpload = await cloudinary.uploader.upload(`data:audio/mp3;base64,${file.buffer.toString('base64')}`, {
            resource_type: 'audio',
            folder: 'ai-music-player' // Optional folder in Cloudinary
        });

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
        res.status(500).json({ message: 'Error uploading song', error: error });
    }
});


app.get("/", (req, res) => {
    res.send("AI Music Player backend is running");
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
