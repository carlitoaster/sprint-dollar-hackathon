const socket = io();

let room = null;
let timeLeft = 600;
let timerInterval = null;

function joinRoom() {
    room = document.getElementById("roomInput").value;
    if (!room) return;

    document.getElementById("lobby").classList.add("hidden");
    document.getElementById("game").classList.remove("hidden");

    socket.emit('join', { room: room });
}

socket.on('start_game', () => {
    document.getElementById("status").innerText = "Game started! Don't leave.";
    startTimer();
});

socket.on('status', (data) => {
    document.getElementById("status").innerText = data.msg;
});

socket.on('game_over', (data) => {
    clearInterval(timerInterval);

    if (data.winner === socket.id) {
        document.getElementById("status").innerHTML = "<span class='win'>You WIN!</span>";
    } else {
        document.getElementById("status").innerHTML = "<span class='danger'>You LOST!</span>";
    }
});

function startTimer() {
    timerInterval = setInterval(() => {
        timeLeft--;

        let minutes = Math.floor(timeLeft / 60);
        let seconds = timeLeft % 60;

        document.getElementById("timer").innerText =
            `${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            document.getElementById("status").innerHTML = "<span class='win'>Both survived!</span>";
        }
    }, 1000);
}

// 🚨 Detect leaving the page
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        socket.emit('player_lost', { room: room });
    }
});

window.addEventListener("beforeunload", () => {
    socket.emit('player_lost', { room: room });
});