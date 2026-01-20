
// Player state
const playerState = {
    audio: new Audio(),
    isPlaying: false,
    currentSongIndex: -1,
    songs: [],
    backgroundColors: ['#1a1a2e', '#16213e', '#283149', '#354259'] // Example background colors
};

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
    thumbnail: document.getElementById('thumbnail')
};

// Backend URL configuration
const BACKEND_URL = 'https://ai-music-player-475v.onrender.com'; // Your Render backend URL

// Initialize player
async function initPlayer() {
    await fetchSongs();
    // Removed duplicate renderPlaylist() call here

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
}

// Fetch songs from the backend
async function fetchSongs() {
    try {
        const response = await fetch(`${BACKEND_URL}/songs`, {
            method: 'GET',
            mode: 'cors', // Explicitly set mode
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        playerState.songs = await response.json();
        renderPlaylist();
    } catch (error) {
        console.error('Error fetching songs:', error);
        // Show error message to user
        elements.playlistContainer.innerHTML = `<div style="color: #ff6b6b; text-align: center; padding: 1rem;">
            Error loading songs. ${error.message}
        </div>`;
    }
}

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

    playerState.audio.load(); // Preload the audio
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

// Handle file upload
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
                mode: 'cors' // Explicitly set mode
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Upload successful:', result);
            await fetchSongs();
        } catch (error) {
            console.error('Error uploading file:', error);
        }
    }

    e.target.value = '';
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
document.addEventListener('DOMContentLoaded', initPlayer);
