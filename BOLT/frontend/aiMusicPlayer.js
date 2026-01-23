console.log("🎵 AI Music Player Frontend Loaded");

// Configuration
const BACKEND_URL = window.location.origin;

// State
const authState = {
    isAuthenticated: false,
    email: null
};

// Player State
const playerState = {
    audio: new Audio(),
    songs: [],
    currentSongIndex: -1,
    isPlaying: false,
    currentFile: null
};

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const emailInput = document.getElementById('emailInput');
const otpInput = document.getElementById('otpInput');
const sendOtpBtn = document.getElementById('sendOtpBtn');
const verifyOtpBtn = document.getElementById('verifyOtpBtn');
const resendOtpBtn = document.getElementById('resendOtpBtn');
const loginMessage = document.getElementById('loginMessage');
const emailStep = document.getElementById('emailStep');
const otpStep = document.getElementById('otpStep');

// Player Elements
const currentTitle = document.getElementById('currentTitle');
const currentArtist = document.getElementById('currentArtist');
const albumArt = document.getElementById('albumArt');
const progress = document.getElementById('progress');
const progressContainer = document.getElementById('progressContainer');
const currentTime = document.getElementById('currentTime');
const duration = document.getElementById('duration');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const volumeBtn = document.getElementById('volumeBtn');
const volumeSlider = document.getElementById('volumeSlider');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const uploadForm = document.getElementById('uploadForm');
const confirmUpload = document.getElementById('confirmUpload');
const cancelUpload = document.getElementById('cancelUpload');
const uploadStatus = document.getElementById('uploadStatus');
const songTitle = document.getElementById('songTitle');
const songArtist = document.getElementById('songArtist');
const songList = document.getElementById('songList');
const userEmail = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log("Checking existing session...");
    checkSession();
    setupEventListeners();
    setupPlayer();
});

async function checkSession() {
    try {
        const response = await fetch(`${BACKEND_URL}/auth/user`);
        if (response.ok) {
            const data = await response.json();
            authState.isAuthenticated = true;
            authState.email = data.email;
            showPlayer();
            loadUserSongs();
            updateUserInfo();
        } else {
            showLogin();
        }
    } catch (error) {
        console.log("No active session");
        showLogin();
    }
}

function showLogin() {
    loginScreen.style.display = 'flex';
    mainApp.style.display = 'none';
    emailInput.value = '';
    otpInput.value = '';
    loginMessage.textContent = '';
    emailStep.style.display = 'block';
    otpStep.style.display = 'none';
}

function showPlayer() {
    loginScreen.style.display = 'none';
    mainApp.style.display = 'block';
}

function updateUserInfo() {
    userEmail.textContent = authState.email;
}

function setupEventListeners() {
    // Login listeners
    sendOtpBtn.addEventListener('click', sendOtp);
    verifyOtpBtn.addEventListener('click', verifyOtp);
    resendOtpBtn.addEventListener('click', sendOtp);
    
    emailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendOtp();
    });
    
    otpInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') verifyOtp();
    });
    
    // Player listeners
    playBtn.addEventListener('click', togglePlay);
    prevBtn.addEventListener('click', playPrevious);
    nextBtn.addEventListener('click', playNext);
    volumeBtn.addEventListener('click', toggleMute);
    volumeSlider.addEventListener('input', updateVolume);
    
    // Progress bar listener
    progressContainer.addEventListener('click', setProgress);
    
    // Upload listeners
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    confirmUpload.addEventListener('click', uploadSong);
    cancelUpload.addEventListener('click', cancelUploadForm);
    
    // Logout listener
    logoutBtn.addEventListener('click', logout);
    
    // Audio event listeners
    playerState.audio.addEventListener('timeupdate', updateProgress);
    playerState.audio.addEventListener('loadedmetadata', updateDuration);
    playerState.audio.addEventListener('ended', playNext);
}

function setupPlayer() {
    playerState.audio.volume = volumeSlider.value / 100;
}

async function sendOtp() {
    const email = emailInput.value.trim();
    
    if (!email || !email.includes('@')) {
        showMessage('Please enter a valid email', 'error');
        return;
    }
    
    showMessage('Sending OTP...', '');
    sendOtpBtn.disabled = true;
    
    try {
        const response = await fetch(`${BACKEND_URL}/auth/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to send OTP');
        }
        
        showMessage(`OTP sent! Check console/logs: ${data.otp}`, 'success');
        
        // Show OTP input
        emailStep.style.display = 'none';
        otpStep.style.display = 'block';
        otpInput.focus();
        
    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        sendOtpBtn.disabled = false;
    }
}

async function verifyOtp() {
    const email = emailInput.value.trim();
    const otp = otpInput.value.trim();
    
    if (!otp || otp.length !== 6) {
        showMessage('Enter 6-digit OTP', 'error');
        return;
    }
    
    showMessage('Verifying...', '');
    verifyOtpBtn.disabled = true;
    
    try {
        const response = await fetch(`${BACKEND_URL}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Invalid OTP');
        }
        
        // Update auth state
        authState.isAuthenticated = true;
        authState.email = email;
        
        showMessage('Success! Loading...', 'success');
        
        setTimeout(() => {
            showPlayer();
            loadUserSongs();
            updateUserInfo();
        }, 1000);
        
    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        verifyOtpBtn.disabled = false;
    }
}

async function loadUserSongs() {
    try {
        const response = await fetch(`${BACKEND_URL}/songs`);
        if (!response.ok) throw new Error('Failed to load songs');
        
        const songs = await response.json();
        playerState.songs = songs;
        renderPlaylist();
        
        if (songs.length > 0) {
            playSong(0);
        }
    } catch (error) {
        console.error('Error loading songs:', error);
        songList.innerHTML = '<div class="playlist-item">Failed to load songs. Please try again.</div>';
    }
}

function renderPlaylist() {
    songList.innerHTML = '';
    
    playerState.songs.forEach((song, index) => {
        const songElement = document.createElement('div');
        songElement.className = 'playlist-item';
        if (index === playerState.currentSongIndex) {
            songElement.classList.add('playing');
        }
        
        songElement.innerHTML = `
            <strong>${song.title || 'Unknown Title'}</strong><br>
            <small>${song.artist || 'Unknown Artist'}</small>
            <button class="delete-btn" data-id="${song._id}" style="float: right; background: none; border: none; color: #ff6b6b; cursor: pointer;">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        songElement.addEventListener('click', () => playSong(index));
        
        // Add delete button listener
        const deleteBtn = songElement.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSong(song._id);
        });
        
        songList.appendChild(songElement);
    });
}

function playSong(index) {
    if (index < 0 || index >= playerState.songs.length) return;
    
    playerState.currentSongIndex = index;
    const song = playerState.songs[index];
    
    // Update UI
    currentTitle.textContent = song.title || 'Unknown Title';
    currentArtist.textContent = song.artist || 'Unknown Artist';
    
    // Set audio source
    playerState.audio.src = song.url.startsWith('http') ? song.url : `${BACKEND_URL}${song.url}`;
    
    // Update playlist
    renderPlaylist();
    
    // Play the song
    playerState.audio.play()
        .then(() => {
            playerState.isPlaying = true;
            playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        })
        .catch(error => {
            console.error('Playback error:', error);
            showMessage('Error playing song. Try another format.', 'error');
        });
}

function togglePlay() {
    if (playerState.currentSongIndex === -1 && playerState.songs.length > 0) {
        playSong(0);
        return;
    }
    
    if (playerState.isPlaying) {
        playerState.audio.pause();
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
    } else {
        playerState.audio.play();
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    }
    playerState.isPlaying = !playerState.isPlaying;
}

function playPrevious() {
    if (playerState.songs.length === 0) return;
    
    let newIndex = playerState.currentSongIndex - 1;
    if (newIndex < 0) newIndex = playerState.songs.length - 1;
    
    playSong(newIndex);
}

function playNext() {
    if (playerState.songs.length === 0) return;
    
    let newIndex = playerState.currentSongIndex + 1;
    if (newIndex >= playerState.songs.length) newIndex = 0;
    
    playSong(newIndex);
}

function updateProgress() {
    const { currentTime: audioCurrentTime, duration: audioDuration } = playerState.audio;
    
    if (audioDuration) {
        const progressPercent = (audioCurrentTime / audioDuration) * 100;
        progress.style.width = `${progressPercent}%`;
        
        // Update time display
        currentTime.textContent = formatTime(audioCurrentTime);
    }
}

function updateDuration() {
    duration.textContent = formatTime(playerState.audio.duration);
}

function setProgress(e) {
    const width = this.clientWidth;
    const clickX = e.offsetX;
    const duration = playerState.audio.duration;
    
    if (duration) {
        playerState.audio.currentTime = (clickX / width) * duration;
    }
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function toggleMute() {
    playerState.audio.muted = !playerState.audio.muted;
    volumeBtn.innerHTML = playerState.audio.muted ? 
        '<i class="fas fa-volume-mute"></i>' : 
        '<i class="fas fa-volume-up"></i>';
}

function updateVolume() {
    playerState.audio.volume = volumeSlider.value / 100;
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file type
    if (!file.type.startsWith('audio/')) {
        showMessage('Please select an audio file', 'error');
        return;
    }
    
    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
        showMessage('File too large (max 50MB)', 'error');
        return;
    }
    
    playerState.currentFile = file;
    songTitle.value = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
    songArtist.value = '';
    uploadForm.style.display = 'block';
    uploadStatus.style.display = 'none';
}

async function uploadSong() {
    if (!playerState.currentFile) return;
    
    const formData = new FormData();
    formData.append('audio', playerState.currentFile);
    formData.append('title', songTitle.value.trim() || playerState.currentFile.name);
    formData.append('artist', songArtist.value.trim() || 'Unknown Artist');
    
    uploadStatus.style.display = 'block';
    uploadStatus.innerHTML = '<div style="color: #90ee90;">Uploading...</div>';
    confirmUpload.disabled = true;
    
    try {
        const response = await fetch(`${BACKEND_URL}/upload`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Upload failed');
        }
        
        uploadStatus.innerHTML = '<div style="color: #90ee90;">Upload successful!</div>';
        
        // Reset form
        cancelUploadForm();
        
        // Reload songs
        setTimeout(() => {
            loadUserSongs();
        }, 1000);
        
    } catch (error) {
        uploadStatus.innerHTML = `<div style="color: #ff6b6b;">Error: ${error.message}</div>`;
    } finally {
        confirmUpload.disabled = false;
    }
}

function cancelUploadForm() {
    uploadForm.style.display = 'none';
    uploadStatus.style.display = 'none';
    fileInput.value = '';
    playerState.currentFile = null;
}

async function deleteSong(songId) {
    if (!confirm('Are you sure you want to delete this song?')) return;
    
    try {
        const response = await fetch(`${BACKEND_URL}/songs/${songId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete song');
        }
        
        // Remove from local state
        playerState.songs = playerState.songs.filter(song => song._id !== songId);
        
        // Update UI
        renderPlaylist();
        
        // If current song was deleted, play next or stop
        if (playerState.currentSongIndex >= playerState.songs.length) {
            if (playerState.songs.length > 0) {
                playSong(0);
            } else {
                playerState.audio.pause();
                playerState.isPlaying = false;
                currentTitle.textContent = 'No songs available';
                currentArtist.textContent = 'Upload some music!';
                playBtn.innerHTML = '<i class="fas fa-play"></i>';
            }
        }
        
    } catch (error) {
        console.error('Error deleting song:', error);
        showMessage('Failed to delete song', 'error');
    }
}

async function logout() {
    try {
        await fetch(`${BACKEND_URL}/auth/logout`, {
            method: 'POST'
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    // Clear local state
    authState.isAuthenticated = false;
    authState.email = null;
    playerState.songs = [];
    playerState.currentSongIndex = -1;
    playerState.audio.pause();
    playerState.isPlaying = false;
    
    // Show login screen
    showLogin();
}

function showMessage(text, type) {
    loginMessage.textContent = text;
    loginMessage.className = `login-message ${type}`;
}

// Global function for showing messages in player
window.showMessage = showMessage;