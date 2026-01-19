// Player state
const playerState = {
    audio: new Audio(),
    isPlaying: false,
    currentSongIndex: -1,
    songs: [],
    backgroundColors: ['#1a1a2e', '#16213e', '#283149', '#354259', '#0f3460', '#1b1b2f']
};

// API configuration
const API_BASE_URL = 'http://localhost:5000'; // Change this to your Render URL when deploying

// DOM elements
const elements = {
    songTitle: document.getElementById('songTitle'),
    artist: document.getElementById('artist'),
    progress: document.getElementById('progress'),
    currentTime: document.getElementById('currentTime'),
    duration: document.getElementById('duration'),
    playBtn: document.getElementById('playBtn'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    uploadBtn: document.getElementById('uploadBtn'),
    fileInput: document.getElementById('fileInput'),
    playlistContainer: document.getElementById('playlistContainer'),
    thumbnail: document.getElementById('thumbnail'),
    progressContainer: document.querySelector('.progress-container')
};

// Initialize player
async function initPlayer() {
    console.log('🎵 Initializing music player...');
    
    try {
        await fetchSongs();
        setupEventListeners();
        
        // Auto-play first song if songs exist
        if (playerState.songs.length > 0) {
            console.log(`🎶 Loaded ${playerState.songs.length} songs`);
        } else {
            console.log('📭 No songs found in playlist');
        }
        
        updatePlayButton();
    } catch (error) {
        console.error('❌ Failed to initialize player:', error);
        showError('Failed to load songs. Please check your connection.');
    }
}

// Setup all event listeners
function setupEventListeners() {
    // Control buttons
    elements.playBtn.addEventListener('click', togglePlay);
    elements.prevBtn.addEventListener('click', playPrev);
    elements.nextBtn.addEventListener('click', playNext);
    
    // Upload functionality
    elements.uploadBtn.addEventListener('click', () => {
        console.log('📁 Upload button clicked');
        elements.fileInput.click();
    });
    elements.fileInput.addEventListener('change', handleFileUpload);
    
    // Progress bar
    elements.progressContainer.addEventListener('click', setProgress);
    
    // Audio events
    playerState.audio.addEventListener('timeupdate', updateProgress);
    playerState.audio.addEventListener('loadedmetadata', updateDuration);
    playerState.audio.addEventListener('ended', playNext);
    playerState.audio.addEventListener('error', handleAudioError);
    playerState.audio.addEventListener('play', () => console.log('▶️ Playing'));
    playerState.audio.addEventListener('pause', () => console.log('⏸️ Paused'));
}

// Fetch songs from the backend
async function fetchSongs() {
    try {
        console.log('📥 Fetching songs from server...');
        const response = await fetch(`${API_BASE_URL}/songs`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        playerState.songs = await response.json();
        console.log(`✅ Fetched ${playerState.songs.length} songs`);
        renderPlaylist();
    } catch (error) {
        console.error('❌ Error fetching songs:', error);
        showError('Cannot connect to server. Make sure backend is running.');
    }
}

// Toggle play/pause
function togglePlay() {
    if (!playerState.songs.length) {
        console.log('⚠️ No songs available to play');
        return;
    }
    
    if (playerState.isPlaying) {
        playerState.audio.pause();
        console.log('⏸️ Paused');
    } else {
        if (playerState.currentSongIndex === -1) {
            playSong(0);
        } else {
            playerState.audio.play();
            console.log('▶️ Resumed playing');
        }
    }
    playerState.isPlaying = !playerState.isPlaying;
    updatePlayButton();
}

// Play previous song
function playPrev() {
    if (playerState.songs.length === 0) {
        console.log('⚠️ No songs in playlist');
        return;
    }
    
    let newIndex = playerState.currentSongIndex - 1;
    if (newIndex < 0) newIndex = playerState.songs.length - 1;
    
    console.log('⏮️ Playing previous song');
    playSong(newIndex);
}

// Play next song
function playNext() {
    if (playerState.songs.length === 0) {
        console.log('⚠️ No songs in playlist');
        return;
    }
    
    let newIndex = playerState.currentSongIndex + 1;
    if (newIndex >= playerState.songs.length) newIndex = 0;
    
    console.log('⏭️ Playing next song');
    playSong(newIndex);
}

// Play specific song
function playSong(index) {
    if (index < 0 || index >= playerState.songs.length) {
        console.error('❌ Invalid song index:', index);
        return;
    }
    
    const song = playerState.songs[index];
    console.log(`🎵 Playing: ${song.title} by ${song.artist}`);
    
    playerState.currentSongIndex = index;
    
    // Reset audio and set new source
    playerState.audio.pause();
    playerState.audio.currentTime = 0;
    playerState.audio.src = song.cloudinaryURL;
    
    // Update UI
    elements.songTitle.textContent = song.title || 'Unknown Title';
    elements.artist.textContent = song.artist || 'Unknown Artist';
    elements.thumbnail.src = song.thumbnail || "https://images.pexels.com/photos/167474/pexels-photo-167474.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1";
    
    // Change background color
    changeBackgroundColor();
    
    // Play the audio
    playerState.audio.play().catch(error => {
        console.error('❌ Error playing audio:', error);
        showError('Cannot play this audio file. It may be corrupted or unsupported.');
    });
    
    playerState.isPlaying = true;
    updatePlayButton();
    renderPlaylist();
    
    // Preload next song for better performance
    preloadNextSong();
}

// Preload next song
function preloadNextSong() {
    if (playerState.songs.length <= 1) return;
    
    const nextIndex = (playerState.currentSongIndex + 1) % playerState.songs.length;
    const nextSong = playerState.songs[nextIndex];
    
    const preloadAudio = new Audio();
    preloadAudio.src = nextSong.cloudinaryURL;
    preloadAudio.preload = 'metadata';
}

// Update play button icon
function updatePlayButton() {
    const icon = elements.playBtn.querySelector('svg');
    if (!icon) return;
    
    icon.innerHTML = playerState.isPlaying ?
        // Pause icon
        '<path d="M6 3.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5zm4 0a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5z"/>' :
        // Play icon
        '<path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>';
    
    // Update title attribute for accessibility
    elements.playBtn.title = playerState.isPlaying ? 'Pause' : 'Play';
}

// Update progress bar
function updateProgress() {
    const { currentTime, duration } = playerState.audio;
    
    if (isNaN(duration) || duration === 0) return;
    
    const progressPercent = (currentTime / duration) * 100;
    elements.progress.style.width = `${progressPercent}%`;
    
    elements.currentTime.textContent = formatTime(currentTime);
    
    // Only update duration if it's valid
    if (!isNaN(duration) && isFinite(duration)) {
        elements.duration.textContent = formatTime(duration);
    }
}

// Update duration when metadata loads
function updateDuration() {
    const duration = playerState.audio.duration;
    if (!isNaN(duration) && isFinite(duration)) {
        elements.duration.textContent = formatTime(duration);
    }
}

// Set progress bar position
function setProgress(e) {
    const width = this.clientWidth;
    const clickX = e.offsetX;
    const duration = playerState.audio.duration;
    
    if (isNaN(duration) || duration === 0) return;
    
    playerState.audio.currentTime = (clickX / width) * duration;
    console.log(`⏱️ Seeked to: ${formatTime(playerState.audio.currentTime)}`);
}

// Format time (mm:ss)
function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return "0:00";
    
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// Handle file upload
async function handleFileUpload(e) {
    const files = e.target.files;
    if (files.length === 0) return;
    
    console.log(`📤 Uploading ${files.length} file(s)...`);
    
    // Show loading state
    const originalText = elements.uploadBtn.innerHTML;
    elements.uploadBtn.innerHTML = '<span>Uploading...</span>';
    elements.uploadBtn.disabled = true;
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const file of files) {
        console.log(`📁 Processing: ${file.name}`);
        
        const formData = new FormData();
        formData.append('audio', file);
        formData.append('title', file.name.replace(/\.[^/.]+$/, "")); // Remove extension
        formData.append('artist', 'My Upload');
        
        try {
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                body: formData,
            });
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log(`✅ Upload successful: ${result.song.title}`);
            successCount++;
            
        } catch (error) {
            console.error(`❌ Error uploading ${file.name}:`, error);
            errorCount++;
            showError(`Failed to upload ${file.name}: ${error.message}`);
        }
    }
    
    // Reset button state
    elements.uploadBtn.innerHTML = originalText;
    elements.uploadBtn.disabled = false;
    
    // Reset input
    e.target.value = '';
    
    // Refresh song list
    if (successCount > 0) {
        console.log(`🔄 Refreshing playlist after upload...`);
        await fetchSongs();
        
        // Auto-play the first uploaded song if no song was playing
        if (playerState.currentSongIndex === -1 && playerState.songs.length > 0) {
            playSong(0);
        }
    }
    
    // Show upload summary
    showMessage(`Upload complete: ${successCount} successful, ${errorCount} failed`);
}

// Render playlist
function renderPlaylist() {
    elements.playlistContainer.innerHTML = '';
    
    if (playerState.songs.length === 0) {
        elements.playlistContainer.innerHTML = `
            <div class="playlist-item empty">
                <div>No songs in playlist</div>
                <div>Upload some music to get started!</div>
            </div>
        `;
        return;
    }
    
    playerState.songs.forEach((song, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        
        if (index === playerState.currentSongIndex) {
            item.classList.add('playing');
        }
        
        item.innerHTML = `
            <div class="playlist-item-content">
                <div class="playlist-title"><strong>${song.title || 'Unknown Title'}</strong></div>
                <div class="playlist-artist">${song.artist || 'Unknown Artist'}</div>
            </div>
            <div class="playlist-duration">${formatTime(song.duration || 0)}</div>
        `;
        
        item.addEventListener('click', () => {
            console.log(`🎵 Selected song: ${song.title}`);
            playSong(index);
        });
        
        elements.playlistContainer.appendChild(item);
    });
}

// Change background color
function changeBackgroundColor() {
    const randomIndex = Math.floor(Math.random() * playerState.backgroundColors.length);
    const color = playerState.backgroundColors[randomIndex];
    
    document.body.style.background = `linear-gradient(135deg, ${color} 0%, ${adjustColor(color, -20)} 100%)`;
    
    // Also update progress bar color
    document.documentElement.style.setProperty('--progress-color', playerState.backgroundColors[(randomIndex + 1) % playerState.backgroundColors.length]);
}

// Helper to adjust color brightness
function adjustColor(color, amount) {
    let usePound = false;
    
    if (color[0] === "#") {
        color = color.slice(1);
        usePound = true;
    }
    
    const num = parseInt(color, 16);
    let r = (num >> 16) + amount;
    let g = ((num >> 8) & 0x00FF) + amount;
    let b = (num & 0x0000FF) + amount;
    
    r = Math.min(Math.max(0, r), 255);
    g = Math.min(Math.max(0, g), 255);
    b = Math.min(Math.max(0, b), 255);
    
    return (usePound ? "#" : "") + (b | (g << 8) | (r << 16)).toString(16).padStart(6, '0');
}

// Handle audio errors
function handleAudioError(error) {
    console.error('❌ Audio error:', error);
    showError('Error playing audio. The file may be corrupted or unsupported.');
    
    // Try to play next song if current one fails
    setTimeout(playNext, 1000);
}

// Show error message
function showError(message) {
    console.error('❌ Error:', message);
    
    // Create error toast
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// Show message
function showMessage(message) {
    console.log('💬 Message:', message);
    
    const toast = document.createElement('div');
    toast.className = 'toast info';
    toast.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Spacebar to play/pause
    if (e.code === 'Space' && !e.target.matches('input, textarea, button')) {
        e.preventDefault();
        togglePlay();
    }
    
    // Arrow keys for navigation
    if (e.code === 'ArrowLeft') {
        playerState.audio.currentTime = Math.max(0, playerState.audio.currentTime - 10);
    }
    if (e.code === 'ArrowRight') {
        playerState.audio.currentTime = Math.min(playerState.audio.duration, playerState.audio.currentTime + 10);
    }
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initPlayer);

// Add CSS for toast notifications
const toastStyles = document.createElement('style');
toastStyles.textContent = `
    .toast {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-width: 300px;
        max-width: 400px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    
    .toast.error {
        background: linear-gradient(135deg, #ff4757, #ff3838);
    }
    
    .toast.info {
        background: linear-gradient(135deg, #3742fa, #5352ed);
    }
    
    .toast button {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        margin-left: 15px;
        opacity: 0.8;
    }
    
    .toast button:hover {
        opacity: 1;
    }
    
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(toastStyles);