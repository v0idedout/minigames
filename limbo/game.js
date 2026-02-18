const stage = document.getElementById('stage');
const status = document.getElementById('status-msg');
const winScreen = document.getElementById('win-screen');
const retryBtn = document.getElementById('retry-btn');
const deathScreen = document.getElementById('death-screen');
const deathMsg = document.getElementById('death-msg');
const deathRetryBtn = document.getElementById('death-retry-btn');
const menuScreen = document.getElementById('menu-screen');
const backToMenuBtn = document.getElementById('back-to-menu');
const blackout = document.getElementById('death-blackout');
const deathVideoId = '7JspcP6uP5s';
const ambientVideoId = 'OmahQ9RFOPo';

const grid = [
    {x: 100, y: 75},  {x: 300, y: 75},  {x: 500, y: 75},
    {x: 100, y: 225}, {x: 300, y: 225}, {x: 500, y: 225}
];

let keyObjects = [];
let winningId = null;
let isInputLocked = true;
let player;
let gameStarted = false;
let selectionTimer = null;
let currentMode = null;

let shuffleTimeout = null;
let fadeInInterval = null;
let fadeOutInterval = null;
let resetTimeout = null;
let eliminateTimeout = null;

const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: ambientVideoId,
        playerVars: {
            'autoplay': 0, 'controls': 0, 'showinfo': 0,
            'rel': 0, 'iv_load_policy': 3, 'modestbranding': 1
        },
        events: {
            'onReady': () => console.log("Audio Ready"),
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED && player.getVideoData().video_id === deathVideoId) {
        showDeathScreen();
    }
}

function showDeathScreen() {
    deathMsg.innerText = `you died to ${currentMode}`;
    deathScreen.classList.add('visible');
    setTimeout(() => {
        deathMsg.style.transform = 'translateY(-30px)';
        deathRetryBtn.style.opacity = "1";
        deathRetryBtn.style.pointerEvents = "auto";
    }, 500);
}

function cleanupAll() {
    if (selectionTimer)  { clearInterval(selectionTimer);  selectionTimer  = null; }
    if (shuffleTimeout)  { clearTimeout(shuffleTimeout);   shuffleTimeout  = null; }
    if (fadeInInterval)  { clearInterval(fadeInInterval);  fadeInInterval  = null; }
    if (fadeOutInterval) { clearInterval(fadeOutInterval); fadeOutInterval = null; }
    if (resetTimeout)    { clearTimeout(resetTimeout);     resetTimeout    = null; }
    if (eliminateTimeout){ clearTimeout(eliminateTimeout); eliminateTimeout= null; }
    if (player && typeof player.pauseVideo === 'function') {
        try { player.pauseVideo(); } catch(e) {}
    }
}

function selectMode(mode) {
    cleanupAll();
    currentMode = mode;
    gameStarted = false;
    isInputLocked = true;
    menuScreen.style.display = 'none';
    stage.style.display = 'block';
    status.style.display = 'block';
    status.style.opacity = '1';
    status.innerText = 'CLICK TO START THE CHALLENGE';
    backToMenuBtn.style.display = 'block';
    winScreen.classList.remove('visible');
    deathScreen.classList.remove('visible');
    blackout.classList.remove('visible');
    winScreen.querySelector('.safe-box').style.transform = 'translateY(0)';
    deathMsg.style.transform = 'translateY(0)';
    retryBtn.style.opacity = '0';
    retryBtn.style.pointerEvents = 'none';
    deathRetryBtn.style.opacity = '0';
    deathRetryBtn.style.pointerEvents = 'none';
    init();
    if (player && typeof player.loadVideoById === 'function') {
        player.loadVideoById(ambientVideoId);
        player.pauseVideo();
    }
    document.getElementById('youtube-player').style.visibility = 'hidden';
}

function backToMenu() {
    cleanupAll();
    currentMode = null;
    gameStarted = false;
    isInputLocked = true;
    menuScreen.style.display = 'flex';
    stage.style.display = 'none';
    status.style.display = 'none';
    backToMenuBtn.style.display = 'none';
    winScreen.classList.remove('visible');
    deathScreen.classList.remove('visible');
    blackout.classList.remove('visible');
    status.style.opacity = "1";
    status.innerText = "CLICK TO START THE CHALLENGE";
    winScreen.querySelector('.safe-box').style.transform = 'translateY(0)';
    deathMsg.style.transform = 'translateY(0)';
    retryBtn.style.opacity = "0";
    retryBtn.style.pointerEvents = "none";
    deathRetryBtn.style.opacity = "0";
    deathRetryBtn.style.pointerEvents = "none";
    stage.innerHTML = '';
    keyObjects = [];
    if (player && typeof player.loadVideoById === 'function') {
        player.loadVideoById(ambientVideoId);
        player.pauseVideo();
    }
    document.getElementById('youtube-player').style.visibility = 'hidden';
}

backToMenuBtn.onclick = (e) => { e.stopPropagation(); backToMenu(); };

function init() {
    stage.innerHTML = '';
    keyObjects = [];
    for (let i = 0; i < 6; i++) {
        const el = document.createElement('div');
        el.className = 'key-sprite';
        el.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>`;
        el.style.left = grid[i].x + 'px';
        el.style.top  = grid[i].y + 'px';
        const keyObj = { element: el, posIndex: i, id: i };
        el.onclick = () => handleSelection(keyObj);
        stage.appendChild(el);
        keyObjects.push(keyObj);
    }
}

function fadeInAudio() {
    if (fadeInInterval) clearInterval(fadeInInterval);
    let volume = 0;
    player.setVolume(0);
    fadeInInterval = setInterval(() => {
        if (volume < 100) { volume += 5; player.setVolume(volume); }
        else { clearInterval(fadeInInterval); fadeInInterval = null; }
    }, 100);
}

function startChallenge() {
    if (!currentMode || gameStarted || !player) return;
    if (typeof player.playVideo !== 'function') return;
    gameStarted = true;
    status.innerText = "CHOOSE THE CORRECT KEY";
    const minTime = 80, maxTime = 165;
    const startTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    document.getElementById('youtube-player').style.visibility = 'hidden';
    player.loadVideoById(ambientVideoId, startTime);
    player.playVideo();
    fadeInAudio();
    revealWinner();
}

function revealWinner() {
    winningId = Math.floor(Math.random() * 6);
    keyObjects[winningId].element.classList.add('active');
    shuffleTimeout = setTimeout(() => {
        keyObjects[winningId].element.classList.remove('active');
        if (currentMode === 'EN-008-02') {
            keyObjects.forEach(obj => obj.element.classList.add('blinking'));
        }
        performShuffle(0);
    }, 1800);
}

function performShuffle(count) {
    let shuffleSpeed = 370, totalSteps = 36;
    if (currentMode === 'EN-008')    { shuffleSpeed = 300; totalSteps = 45; }
    if (currentMode === 'EN-008-02') { shuffleSpeed = 300; totalSteps = 60; }

    if (count >= totalSteps) {
        keyObjects.forEach(obj => obj.element.classList.remove('blinking'));
        startSelectionTimer();
        return;
    }

    const numToShuffle = Math.floor(Math.random() * 3) + 2;
    let indices = [];
    while (indices.length < numToShuffle) {
        let r = Math.floor(Math.random() * 6);
        if (!indices.includes(r)) indices.push(r);
    }
    let firstPos = keyObjects[indices[0]].posIndex;
    for (let i = 0; i < indices.length - 1; i++) {
        keyObjects[indices[i]].posIndex = keyObjects[indices[i + 1]].posIndex;
    }
    keyObjects[indices[indices.length - 1]].posIndex = firstPos;
    keyObjects.forEach(obj => {
        obj.element.style.left = grid[obj.posIndex].x + 'px';
        obj.element.style.top  = grid[obj.posIndex].y + 'px';
    });
    shuffleTimeout = setTimeout(() => performShuffle(count + 1), shuffleSpeed);
}

function startSelectionTimer() {
    isInputLocked = false;
    let timeLeft = 10;
    status.innerText = `CHOOSE THE CORRECT KEY - ${timeLeft}s`;
    selectionTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(selectionTimer);
            if (!isInputLocked) triggerDeathSequence();
        } else {
            status.innerText = `CHOOSE THE CORRECT KEY - ${timeLeft}s`;
        }
    }, 1000);
}

function fadeAudio() {
    if (fadeOutInterval) clearInterval(fadeOutInterval);
    let volume = player.getVolume();
    fadeOutInterval = setInterval(() => {
        if (volume > 0) { volume -= 5; player.setVolume(volume); }
        else { player.pauseVideo(); clearInterval(fadeOutInterval); fadeOutInterval = null; }
    }, 100);
}

function triggerDeathSequence() {
    isInputLocked = true;
    if (selectionTimer) clearInterval(selectionTimer);
    blackout.classList.add('visible');
    setTimeout(() => {
        const playerEl = document.getElementById('youtube-player');
        playerEl.style.visibility = 'visible';
        player.loadVideoById(deathVideoId);
        player.setVolume(100);
        player.playVideo();
    }, 1200);
}

function handleSelection(clickedObj) {
    if (isInputLocked) return;
    isInputLocked = true;
    if (selectionTimer) clearInterval(selectionTimer);

    if (clickedObj.id === winningId) {
        fadeAudio();
        status.style.opacity = "0";
        backToMenuBtn.style.display = 'none';
        winScreen.classList.add('visible');
        resetTimeout = setTimeout(() => {
            winScreen.querySelector('.safe-box').style.transform = 'translateY(-30px)';
            retryBtn.style.opacity = "1";
            retryBtn.style.pointerEvents = "auto";
        }, 2000);
    } else {
        triggerDeathSequence();
    }
}

function resetGame() {
    cleanupAll();
    winScreen.classList.remove('visible');
    deathScreen.classList.remove('visible');
    blackout.classList.remove('visible');
    gameStarted = false;
    isInputLocked = true;
    status.style.opacity = "1";
    status.innerText = "CLICK TO START THE CHALLENGE";
    document.getElementById('youtube-player').style.visibility = 'hidden';
    if (player && typeof player.loadVideoById === 'function') {
        player.loadVideoById(ambientVideoId);
        player.pauseVideo();
    }
    backToMenuBtn.style.display = 'block';
    stage.style.display = 'block';
    winScreen.querySelector('.safe-box').style.transform = 'translateY(0)';
    deathMsg.style.transform = 'translateY(0)';
    retryBtn.style.opacity = "0";
    retryBtn.style.pointerEvents = "none";
    deathRetryBtn.style.opacity = "0";
    deathRetryBtn.style.pointerEvents = "none";
    init();
}

deathRetryBtn.onclick = (e) => { e.stopPropagation(); resetGame(); };
retryBtn.onclick      = (e) => { e.stopPropagation(); resetGame(); };

window.addEventListener('click', (e) => {
    if (e.target.closest('.mode-btn') || e.target.closest('#back-to-menu') ||
        e.target.closest('#retry-btn') || e.target.closest('#death-retry-btn') ||
        e.target.closest('#back-btn')) return;
    if (currentMode && !gameStarted) startChallenge();
});
