// Authentication state
const authState = {
    isAuthenticated: false,
    sessionId: null,
    email: null,
    sessionExpires: null
};

// DOM elements for login
const loginElements = {
    loginScreen: document.getElementById('loginScreen'),
    mainApp: document.getElementById('mainApp'),
    emailStep: document.getElementById('emailStep'),
    otpStep: document.getElementById('otpStep'),
    emailInput: document.getElementById('emailInput'),
    otpInput: document.getElementById('otpInput'),
    sendOtpBtn: document.getElementById('sendOtpBtn'),
    verifyOtpBtn: document.getElementById('verifyOtpBtn'),
    resendOtpBtn: document.getElementById('resendOtpBtn'),
    loginMessage: document.getElementById('loginMessage')
};

// Player state
const playerState = {
    audio: new Audio(),
    isPlaying: false,
    currentSongIndex: -1,
    songs: []
};

// DOM elements for player
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
    thumbnail: document.getElementById('thumbnail')
};

// Backend URL
const BACKEND_URL = 'https://ai-music-player-backend-p5ad.onrender.com';

// Initialize application
async function initApp() {
    // Check for existing session in sessionStorage
    const savedSession = sessionStorage.getItem('musicPlayerSession');
    
    if (savedSession) {
        try {
            const session = JSON.parse(savedSession);
            
            // Check if session is still valid (less than 24 hours old)
            if (Date.now() - session.createdAt < 24 * 60 * 60 * 1000) {
                authState.sessionId = session.sessionId;
                authState.email = session.email;
                authState.isAuthenticated = true;
                
                showPlayer();
                initPlayer();
                return;
            }
        } catch (error) {
            console.log('Invalid session, showing login');
        }
    }
    
    // No valid session, show login
    showLogin();
    setupLoginListeners();
}

// Show login screen
function showLogin() {
    loginElements.loginScreen.style.display = 'flex';
    loginElements.mainApp.style.display = 'none';
    resetLoginForm();
}

// Show player
function showPlayer() {
    loginElements.loginScreen.style.display = 'none';
    loginElements.mainApp.style.display = 'block';
}

// Reset login form
function resetLoginForm() {
    loginElements.emailStep.style.display = 'block';
    loginElements.otpStep.style.display = 'none';
    loginElements.emailInput.value = '';
    loginElements.otpInput.value = '';
    loginElements.loginMessage.textContent = '';
    loginElements.loginMessage.className = 'login-message';
}

// Setup login event listeners
function setupLoginListeners() {
    loginElements.sendOtpBtn.addEventListener('click', sendOtp);
    loginElements.verifyOtpBtn.addEventListener('click', verifyOtp);
    loginElements.resendOtpBtn.addEventListener('click', sendOtp);
    
    // Allow pressing Enter in input fields
    loginElements.emailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendOtp();
    });
    
    loginElements.otpInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') verifyOtp();
    });
}

// Send OTP to email
async function sendOtp() {
    const email = loginElements.emailInput.value.trim();
    
    if (!email || !email.includes('@')) {
        showLoginMessage('Please enter a valid email address', 'error');
        return;
    }
    
    showLoginMessage('Sending OTP...', 'success');
    loginElements.sendOtpBtn.disabled = true;
    
    try {
        const response = await fetch(`${BACKEND_URL}/auth/send-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to send OTP');
        }
        
        showLoginMessage(data.message || 'OTP sent! Check your email', 'success');
        
        // Show OTP input step
        loginElements.emailStep.style.display = 'none';
        loginElements.otpStep.style.display = 'block';
        loginElements.otpInput.focus();
        
    } catch (error) {
        showLoginMessage(error.message, 'error');
    } finally {
        loginElements.sendOtpBtn.disabled = false;
    }
}

// Verify OTP
async function verifyOtp() {
    const email = loginElements.emailInput.value.trim();
    const otp = loginElements.otpInput.value.trim();
    
    if (!otp || otp.length !== 6) {
        showLoginMessage('Please enter the 6-digit OTP', 'error');
        return;
    }
    
    showLoginMessage('Verifying OTP...', 'success');
    loginElements.verifyOtpBtn.disabled = true;
    
    try {
        const response = await fetch(`${BACKEND_URL}/auth/verify-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, otp })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to verify OTP');
        }
        
        // Save session
        authState.isAuthenticated = true;
        authState.sessionId = data.sessionId;
        authState.email = data.email;
        authState.sessionExpires = Date.now() + 24 * 60 * 60 * 1000;
        
        // Save to sessionStorage
        const sessionData = {
            sessionId: data.sessionId,
            email: data.email,
            createdAt: Date.now()
        };
        sessionStorage.setItem('musicPlayerSession', JSON.stringify(sessionData));
        
        showLoginMessage('Success! Loading your music...', 'success');
        
        // Wait a moment then show player
        setTimeout(() => {
            showPlayer();
            initPlayer();
        }, 1000);
        
    } catch (error) {
        showLoginMessage(error.message, 'error');
    } finally {
        loginElements.verifyOtpBtn.disabled = false;
    }
}

// Show login message
function showLoginMessage(message, type = 'info') {
    loginElements.loginMessage.textContent = message;
    loginElements.loginMessage.className = `login-message ${type}`;
}

// Initialize player
async function initPlayer() {
    if (!authState.isAuthenticated) {
        showLogin();
        return;
    }
    
    await fetchSongs();
    
    // Event listeners
    elements.playBtn.addEventListener('click', togglePlay);
    elements.prevBtn.addEventListener('click', playPrev);
    elements.nextBtn.addEventListener('click', playNext);
    elements.uploadBtn.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileUpload);
    
    // Progress bar
    playerState.audio.addEventListener('timeupdate', updateProgress);
    document.querySelector('.progress-container').addEventListener('click', setProgress);
    
    // Song ended
    playerState.audio.addEventListener('ended', playNext);
    
    // Logout on tab close (optional)
    window.addEventListener('beforeunload', () => {
        if (authState.sessionId) {
            // You could call logout endpoint here if needed
            sessionStorage.removeItem('musicPlayerSession');
        }
    });
}

// Fetch songs with authentication
async function fetchSongs() {
    try {
        const response = await fetch(`${BACKEND_URL}/songs`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': authState.sessionId
            }
        });
        
        if (response.status === 401) {
            // Session expired
            sessionStorage.removeItem('musicPlayerSession');
            authState.isAuthenticated = false;
            showLogin();
            showLoginMessage('Session expired. Please login again.', 'error');
            return;
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        playerState.songs = await response.json();
        renderPlaylist();
    } catch (error) {
        console.error('Error fetching songs:', error);
        elements.playlistContainer.innerHTML = `<div style="color: #ff6b6b; text-align: center; padding: 1rem;">
            Error loading songs. ${error.message}
        </div>`;
    }
}

// Handle file upload with authentication
async function handleFileUpload(e) {
    const files = e.target.files;
    if (files.length === 0) return;

    for (const file of files) {
        const formData = new FormData();
        formData.append('audio', file);
        formData.append('title', file.name.replace(/\.[^/.]+$/, ""));
        formData.append('artist', 'Your Upload');

        try {
            const response = await fetch(`${BACKEND_URL}/upload`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': authState.sessionId
                }
            });
            
            if (response.status === 401) {
                sessionStorage.removeItem('musicPlayerSession');
                authState.isAuthenticated = false;
                showLogin();
                showLoginMessage('Session expired. Please login again.', 'error');
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Upload successful:', result);
            await fetchSongs();
        } catch (error) {
            console.error('Error uploading file:', error);
            alert(`Upload failed: ${error.message}`);
        }
    }

    e.target.value = '';
}

// Rest of your existing player functions (togglePlay, playPrev, playNext, etc.)
// Keep all your existing player functions as they are, but they'll now work
// with the authenticated state

// Toggle play/pause
function togglePlay() {
    if (playerState.isPlaying) {
        playerState.audio.pause();
        playerState.isPlaying = false;
    } else {
        if (playerState.currentSongIndex === -1 && playerState.songs.length > 0) {
            playSong(0);
        } else if (playerState.currentSongIndex >= 0) {
            playerState.audio.play().catch(error => {
                console.error('Error playing audio:', error);
                playerState.isPlaying = false;
                updatePlayButton();
            });
            playerState.isPlaying = true;
        }
    }
    updatePlayButton();
}

// Play previous song
function playPrev() {
    if (playerState.songs.length === 0) return;

    let newIndex = playerState.currentSongIndex - 1;
    if (newIndex < 0) newIndex = playerState.songs.length - 1;

    playSong(newIndex);
}

// Play next song
function playNext() {
    if (playerState.songs.length === 0) return;

    let newIndex = playerState.currentSongIndex + 1;
    if (newIndex >= playerState.songs.length) newIndex = 0;

    playSong(newIndex);
}

// Play specific song
function playSong(index) {
    if (index < 0 || index >= playerState.songs.length) return;

    const song = playerState.songs[index];
    playerState.currentSongIndex = index;
    playerState.audio.src = song.cloudinaryURL;

    elements.songTitle.textContent = song.title;
    elements.artist.textContent = song.artist;
    elements.thumbnail.src = "https://images.pexels.com/photos/167474/pexels-photo-167474.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1";

    playerState.audio.load();
    playerState.audio.play().then(() => {
        playerState.isPlaying = true;
        updatePlayButton();
        renderPlaylist();
    }).catch(error => {
        console.error('Error playing song:', error);
        playerState.isPlaying = false;
        updatePlayButton();
    });
}

// Update play button icon
function updatePlayButton() {
    const icon = elements.playBtn.querySelector('svg');
    icon.innerHTML = playerState.isPlaying ?
        '<path d="M6 3.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5zm4 0a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5z"/>' :
        '<path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>';
}

// Update progress bar
function updateProgress() {
    const { currentTime, duration } = playerState.audio;
    const progressPercent = (currentTime / duration) * 100 || 0;
    elements.progress.style.width = `${progressPercent}%`;

    elements.currentTime.textContent = formatTime(currentTime);
    elements.duration.textContent = formatTime(duration);
}

// Set progress bar position
function setProgress(e) {
    const width = this.clientWidth;
    const clickX = e.offsetX;
    const duration = playerState.audio.duration;

    if (duration) {
        playerState.audio.currentTime = (clickX / width) * duration;
    }
}

// Format time (mm:ss)
function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return "0:00";

    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Render playlist
function renderPlaylist() {
    elements.playlistContainer.innerHTML = '';

    if (playerState.songs.length === 0) {
        elements.playlistContainer.innerHTML = '<div style="color: rgba(255,255,255,0.7); text-align: center; padding: 1rem;">No songs in playlist. Upload some music!</div>';
        return;
    }

    playerState.songs.forEach((song, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        if (index === playerState.currentSongIndex) {
            item.classList.add('playing');
        }

        item.innerHTML = `
            <div><strong>${song.title}</strong></div>
            <div>${song.artist}</div>
        `;

        item.addEventListener('click', () => playSong(index));
        elements.playlistContainer.appendChild(item);
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);