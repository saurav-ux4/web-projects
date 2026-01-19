const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 10000;

// ========================
// MIDDLEWARE CONFIGURATION
// ========================
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://ai-music-player.onrender.com', 'https://your-custom-domain.com']
        : ['http://localhost:3000', 'http://127.0.0.1:5500', 'http://localhost:5500'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================
// CLOUDINARY CONFIGURATION
// ========================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

console.log('✅ Cloudinary configured:', process.env.CLOUDINARY_CLOUD_NAME ? 'Yes' : 'No');

// ========================
// MONGODB CONNECTION
// ========================
const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000
        });
        
        console.log('✅ MongoDB connected successfully');
        
        // Test the connection with a ping
        await mongoose.connection.db.admin().ping();
        console.log('✅ MongoDB ping successful');
        
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        
        if (process.env.NODE_ENV === 'production') {
            // In production, try to reconnect
            setTimeout(connectDB, 5000);
        } else {
            process.exit(1);
        }
    }
};

connectDB();

// ========================
// DATABASE SCHEMA
// ========================
const songSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: 200
    },
    artist: { 
        type: String, 
        default: 'Unknown Artist',
        trim: true,
        maxlength: 200
    },
    cloudinaryURL: { 
        type: String, 
        required: true,
        validate: {
            validator: function(v) {
                return /^https?:\/\/.+\..+/.test(v);
            },
            message: 'Invalid URL format'
        }
    },
    cloudinaryId: { type: String }, // Store Cloudinary public ID for deletion
    duration: { type: Number, default: 0 },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: 'audio/mpeg' },
    uploadDate: { type: Date, default: Date.now },
    playCount: { type: Number, default: 0 }
});

// Create indexes for better performance
songSchema.index({ title: 'text', artist: 'text' });
songSchema.index({ uploadDate: -1 });

const Song = mongoose.model('Song', songSchema);

// ========================
// FILE UPLOAD CONFIGURATION
// ========================
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit (Cloudinary free tier: 10MB, adjust as needed)
        files: 10 // Max 10 files per request
    },
    fileFilter: (req, file, cb) => {
        // Accept audio files and some common formats
        const allowedMimes = [
            'audio/mpeg', // mp3
            'audio/wav',
            'audio/wave',
            'audio/x-wav',
            'audio/mp4',
            'audio/x-m4a',
            'audio/ogg',
            'audio/webm',
            'audio/flac'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type not allowed: ${file.mimetype}. Please upload audio files only.`));
        }
    }
}).single('audio'); // 'audio' is the field name in form data

// ========================
// API ROUTES
// ========================

// Health check endpoint (required by Render)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME ? 'configured' : 'not configured',
        environment: process.env.NODE_ENV || 'development'
    });
});

// API Welcome
app.get('/api', (req, res) => {
    res.json({
        message: 'AI Music Player API',
        version: '2.0.0',
        endpoints: {
            songs: 'GET /api/songs',
            upload: 'POST /api/upload',
            delete: 'DELETE /api/songs/:id',
            health: 'GET /health'
        }
    });
});

// Get all songs
app.get('/api/songs', async (req, res) => {
    try {
        const songs = await Song.find()
            .sort({ uploadDate: -1 })
            .select('-__v') // Exclude version key
            .lean(); // Convert to plain JavaScript objects
        
        res.json({
            success: true,
            count: songs.length,
            data: songs
        });
    } catch (error) {
        console.error('❌ Error fetching songs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch songs',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Upload a song
app.post('/api/upload', (req, res) => {
    upload(req, res, async function(err) {
        if (err instanceof multer.MulterError) {
            // Multer error (file size, etc.)
            return res.status(400).json({
                success: false,
                message: `Upload error: ${err.message}`
            });
        } else if (err) {
            // Other errors
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }
        
        try {
            const file = req.file;
            const { title = 'Untitled', artist = 'Unknown Artist' } = req.body;
            
            if (!file) {
                return res.status(400).json({
                    success: false,
                    message: 'No audio file provided'
                });
            }
            
            console.log(`📤 Uploading: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
            
            // Convert buffer to base64 for Cloudinary
            const b64 = Buffer.from(file.buffer).toString('base64');
            const dataURI = `data:${file.mimetype};base64,${b64}`;
            
            // Upload to Cloudinary with audio resource type
            const cloudinaryResult = await cloudinary.uploader.upload(dataURI, {
                resource_type: 'auto', // Automatically detect audio/video
                folder: 'ai-music-player',
                public_id: `song_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                overwrite: false,
                timeout: 120000 // 2 minutes timeout for large files
            });
            
            console.log(`✅ Cloudinary upload successful: ${cloudinaryResult.secure_url}`);
            
            // Create song in database
            const song = new Song({
                title: title || file.originalname.replace(/\.[^/.]+$/, ""), // Remove extension
                artist: artist,
                cloudinaryURL: cloudinaryResult.secure_url,
                cloudinaryId: cloudinaryResult.public_id,
                duration: cloudinaryResult.duration || 0,
                fileSize: file.size,
                mimeType: file.mimetype
            });
            
            await song.save();
            
            res.status(201).json({
                success: true,
                message: 'Song uploaded successfully',
                data: {
                    id: song._id,
                    title: song.title,
                    artist: song.artist,
                    url: song.cloudinaryURL,
                    duration: song.duration,
                    uploadDate: song.uploadDate
                }
            });
            
        } catch (error) {
            console.error('❌ Upload error:', error);
            
            // Handle specific Cloudinary errors
            let errorMessage = 'Failed to upload song';
            if (error.message.includes('File size too large')) {
                errorMessage = 'File size exceeds limit (max 10MB for free Cloudinary)';
            } else if (error.message.includes('Invalid image file')) {
                errorMessage = 'Invalid audio file format';
            }
            
            res.status(500).json({
                success: false,
                message: errorMessage,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    });
});

// Delete a song
app.delete('/api/songs/:id', async (req, res) => {
    try {
        const song = await Song.findById(req.params.id);
        
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found'
            });
        }
        
        // Delete from Cloudinary if cloudinaryId exists
        if (song.cloudinaryId) {
            try {
                await cloudinary.uploader.destroy(song.cloudinaryId, {
                    resource_type: 'video' // Cloudinary treats audio as video resource
                });
                console.log(`🗑️ Deleted from Cloudinary: ${song.cloudinaryId}`);
            } catch (cloudinaryError) {
                console.warn('⚠️ Could not delete from Cloudinary:', cloudinaryError.message);
                // Continue with database deletion even if Cloudinary deletion fails
            }
        }
        
        // Delete from database
        await Song.findByIdAndDelete(req.params.id);
        
        res.json({
            success: true,
            message: 'Song deleted successfully'
        });
        
    } catch (error) {
        console.error('❌ Delete error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete song',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Increment play count
app.put('/api/songs/:id/play', async (req, res) => {
    try {
        const song = await Song.findByIdAndUpdate(
            req.params.id,
            { $inc: { playCount: 1 } },
            { new: true }
        ).select('title artist playCount');
        
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found'
            });
        }
        
        res.json({
            success: true,
            data: song
        });
        
    } catch (error) {
        console.error('❌ Play count update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update play count'
        });
    }
});

// ========================
// STATIC FILE SERVING (FOR PRODUCTION)
// ========================
if (process.env.NODE_ENV === 'production') {
    // Serve static files from the 'public' directory
    app.use(express.static(path.join(__dirname, 'public')));
    
    // Handle React routing, return all requests to React app
    app.get('*', (req, res) => {
        // Don't serve API routes as static files
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({
                success: false,
                message: 'API endpoint not found'
            });
        }
        
        // For all other routes, serve the frontend
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
} else {
    // Development route
    app.get('/', (req, res) => {
        res.send(`
            <html>
                <head><title>AI Music Player - Development</title></head>
                <body style="font-family: Arial; padding: 20px;">
                    <h1>🎵 AI Music Player Backend</h1>
                    <p>Server is running in development mode.</p>
                    <p>Frontend should be served separately (e.g., via Live Server).</p>
                    <h3>API Endpoints:</h3>
                    <ul>
                        <li><a href="/health">/health</a> - Health check</li>
                        <li><a href="/api">/api</a> - API info</li>
                        <li><a href="/api/songs">/api/songs</a> - Get all songs</li>
                    </ul>
                    <h3>Test Upload (curl):</h3>
                    <pre>curl -X POST -F "audio=@song.mp3" -F "title=My Song" http://localhost:${PORT}/api/upload</pre>
                </body>
            </html>
        `);
    });
}

// ========================
// ERROR HANDLING MIDDLEWARE
// ========================
app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err.stack);
    
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 Handler (must be last)
app.use('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({
            success: false,
            message: 'API endpoint not found'
        });
    } else if (process.env.NODE_ENV === 'production') {
        res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.status(404).send('Route not found');
    }
});

// ========================
// SERVER STARTUP
// ========================
const server = app.listen(PORT, () => {
    console.log(`
    🚀 AI Music Player Server Started!
    ==================================
    Environment: ${process.env.NODE_ENV || 'development'}
    Port: ${PORT}
    MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Disconnected ❌'}
    Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Configured ✅' : 'Not Configured ❌'}
    
    📍 Endpoints:
    - Health: http://localhost:${PORT}/health
    - API: http://localhost:${PORT}/api
    - Songs: http://localhost:${PORT}/api/songs
    
    🎵 Frontend: ${process.env.NODE_ENV === 'production' ? 'Served from /public' : 'Run separately on port 5500'}
    ==================================
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('HTTP server closed.');
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed.');
            process.exit(0);
        });
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Promise Rejection:', err);
    // Don't crash in production
    if (process.env.NODE_ENV === 'production') {
        // Log to external service if available
    }
});

module.exports = app; // For testing