const socket = io({
    transports: ['polling', 'websocket'],
    autoConnect: false
});

const DEFAULT_TIMER_SECONDS = 600;
let room = null;
let timeLeft = DEFAULT_TIMER_SECONDS;
let roomTimerSeconds = DEFAULT_TIMER_SECONDS;
let timerInterval = null;
let gameEnded = false;
let hasLostFocus = false;

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getSelectedTimerSeconds() {
    const input = document.getElementById('timerInput');
    const rawValue = parseInt(input.value, 10);

    if (Number.isNaN(rawValue)) {
        input.value = DEFAULT_TIMER_SECONDS;
        return DEFAULT_TIMER_SECONDS;
    }

    const clampedValue = Math.max(5, Math.min(3600, rawValue));
    input.value = clampedValue;
    return clampedValue;
}

function updateTimerDisplay(seconds) {
    document.getElementById('timer').innerText = formatTime(seconds);
}

function updateChosenTimerLabel(seconds) {
    document.getElementById('chosenTimer').innerText = `Round time: ${formatTime(seconds)}`;
}

function setLobbyEnabled(isEnabled) {
    document.getElementById('roomInput').disabled = !isEnabled;
    document.getElementById('timerInput').disabled = !isEnabled;
    document.getElementById('joinButton').disabled = !isEnabled;
}

function joinRoom() {
    room = document.getElementById('roomInput').value.trim().toUpperCase();
    if (!room) return;

    roomTimerSeconds = getSelectedTimerSeconds();
    gameEnded = false;
    hasLostFocus = false;

    updateTimerDisplay(roomTimerSeconds);
    updateChosenTimerLabel(roomTimerSeconds);
    setLobbyEnabled(false);

    document.getElementById('lobby').classList.add('hidden');
    document.getElementById('game').classList.remove('hidden');

    if (socket.connected) {
        document.getElementById('status').innerText = 'Joining room...';
        socket.emit('join', { room, timer_seconds: roomTimerSeconds });
    } else {
        document.getElementById('status').innerText = 'Connecting...';
        socket.connect();
    }
}

socket.on('connect', () => {
    if (room) {
        document.getElementById('status').innerText = 'Joining room...';
        socket.emit('join', { room, timer_seconds: roomTimerSeconds });
    }
});

socket.on('connect_error', () => {
    document.getElementById('status').innerHTML = "<span class='danger'>Could not connect to host. Make sure the server is running and the other device is on the same Wi-Fi/hotspot.</span>";
    document.getElementById('lobby').classList.remove('hidden');
    document.getElementById('game').classList.add('hidden');
    setLobbyEnabled(true);
});

socket.on('disconnect', () => {
    if (!gameEnded) {
        document.getElementById('status').innerHTML = "<span class='danger'>Disconnected from server.</span>";
    }
});

socket.on('timer_config', (data) => {
    roomTimerSeconds = data.timer_seconds || DEFAULT_TIMER_SECONDS;
    updateTimerDisplay(roomTimerSeconds);
    updateChosenTimerLabel(roomTimerSeconds);
});

socket.on('start_game', (data) => {
    gameEnded = false;
    hasLostFocus = false;
    roomTimerSeconds = data.timer_seconds || roomTimerSeconds;
    updateChosenTimerLabel(roomTimerSeconds);
    document.getElementById('status').innerText = 'Game started! Stay on this tab.';
    startTimer(roomTimerSeconds);
});

socket.on('status', (data) => {
    document.getElementById('status').innerText = data.msg;
});

socket.on('game_over', (data) => {
    clearInterval(timerInterval);
    gameEnded = true;

    if (data.winner === socket.id) {
        document.getElementById('status').innerHTML = "<span class='win'>You WIN!</span>";
    } else {
        document.getElementById('status').innerHTML = "<span class='danger'>You LOST!</span>";
    }
});

function startTimer(startSeconds) {
    clearInterval(timerInterval);
    timeLeft = startSeconds;
    updateTimerDisplay(timeLeft);

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timeLeft);

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            gameEnded = true;
            document.getElementById('status').innerHTML = "<span class='win'>Both survived!</span>";
        }
    }, 1000);
}

function loseForLeavingTab() {
    if (!room || gameEnded || hasLostFocus) return;

    hasLostFocus = true;
    clearInterval(timerInterval);
    document.getElementById('status').innerHTML = "<span class='danger'>You left the tab and lost.</span>";
    socket.emit('player_lost', { room });
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        loseForLeavingTab();
    }
});

window.addEventListener('blur', () => {
    loseForLeavingTab();
});

window.joinRoom = joinRoom;
updateTimerDisplay(DEFAULT_TIMER_SECONDS);
updateChosenTimerLabel(DEFAULT_TIMER_SECONDS);
