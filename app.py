from flask import Flask, render_template, request, redirect, url_for
from flask_socketio import SocketIO, join_room, emit

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret'
socketio = SocketIO(app)

# In-memory room dict. Each room tracks connected players and game state.
rooms = {}  # room_id -> {players: [], active: True}

@app.route('/')
def index():
    #render homepage
    return render_template('index.html')

@app.route('/duel/<room_id>')
def duel(room_id):
    #render duel game page
    return render_template('duel.html', room_id=room_id)

# Player joins room
@socketio.on('join')
def on_join(data):
    #Add a player to a room and start the game once two players join.
    room = data['room']
    sid = request.sid

    # Create room on first join.
    if room not in rooms:
        rooms[room] = {"players": [], "active": True}

    # Track this socket session as a player in the room.
    rooms[room]["players"].append(sid)
    join_room(room)

    # Notify everyone in the room that a player joined.
    emit('status', {'msg': 'Player joined'}, room=room)

    # Start the match when exactly two players are present.
    if len(rooms[room]["players"]) == 2:
        emit('start_game', room=room)

# Player loses (tab switch, etc.)
@socketio.on('player_lost')
def player_lost(data):
    #End the game and broadcast winner/loser when one player loses.
    room = data['room']
    loser = request.sid

    # Ignore duplicate loss events after a room is already finished.
    if not rooms[room]["active"]:
        return

    players = rooms[room]["players"]
    # Winner is the remaining player in the room.
    winner = [p for p in players if p != loser][0]

    rooms[room]["active"] = False

    emit('game_over', {
        'winner': winner,
        'loser': loser
    }, room=room)

# Handle disconnect
@socketio.on('disconnect')
def disconnect():
    #Treat an active player's disconnect as a loss for that room.
    for room, data in rooms.items():
        if request.sid in data["players"] and data["active"]:
            player_lost({'room': room})

if __name__ == '__main__':
    socketio.run(app, debug=True)