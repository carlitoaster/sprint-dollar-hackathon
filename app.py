from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, emit

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret'
socketio = SocketIO(app, cors_allowed_origins='*')

DEFAULT_TIMER_SECONDS = 600
MIN_TIMER_SECONDS = 5
MAX_TIMER_SECONDS = 3600

# Store room state in memory.
rooms = {}
# {
#   "ROOM1": {
#       "players": [sid1, sid2],
#       "active": True,
#       "started": False,
#       "timer_seconds": 600,
#   }
# }


def clamp_timer_seconds(value):
    try:
        seconds = int(value)
    except (TypeError, ValueError):
        return DEFAULT_TIMER_SECONDS
    return max(MIN_TIMER_SECONDS, min(MAX_TIMER_SECONDS, seconds))


def get_or_create_room(room_code: str, timer_seconds: int):
    if room_code not in rooms:
        rooms[room_code] = {
            'players': [],
            'active': True,
            'started': False,
            'timer_seconds': timer_seconds,
        }
    return rooms[room_code]


def end_game_for_loser(room_code: str, loser_sid: str):
    room = rooms.get(room_code)
    if not room or not room['active']:
        return

    players = room['players']
    if loser_sid not in players or len(players) < 2:
        return

    winner_sid = next((sid for sid in players if sid != loser_sid), None)
    if not winner_sid:
        return

    room['active'] = False

    emit(
        'game_over',
        {
            'winner': winner_sid,
            'loser': loser_sid,
        },
        room=room_code,
    )


@app.route('/')
def index():
    return render_template('index.html')


@socketio.on('join')
def handle_join(data):
    room_code = (data.get('room') or '').strip().upper()
    requested_timer_seconds = clamp_timer_seconds(data.get('timer_seconds'))
    sid = request.sid

    if not room_code:
        emit('status', {'msg': 'Enter a room code'})
        return

    room = get_or_create_room(room_code, requested_timer_seconds)

    if sid in room['players']:
        join_room(room_code)
        emit('status', {'msg': f'Rejoined room {room_code}'})
        emit('timer_config', {'timer_seconds': room['timer_seconds']}, to=sid)
        return

    if len(room['players']) >= 2:
        emit('status', {'msg': 'Room is full'})
        return

    room['players'].append(sid)
    join_room(room_code)

    emit('timer_config', {'timer_seconds': room['timer_seconds']}, room=room_code)
    emit('status', {'msg': f'Joined room {room_code}. Waiting for opponent...'}, to=sid)
    emit('status', {'msg': f'{len(room["players"])} / 2 players connected'}, room=room_code)

    if len(room['players']) == 1:
        emit('status', {'msg': f'Room created with a {room["timer_seconds"]}-second timer. Waiting for opponent...'}, to=sid)

    if len(room['players']) == 2 and not room['started']:
        room['started'] = True
        emit('start_game', {'timer_seconds': room['timer_seconds']}, room=room_code)


@socketio.on('player_lost')
def handle_loss(data):
    room_code = (data.get('room') or '').strip().upper()
    loser_sid = request.sid

    room = rooms.get(room_code)
    if not room or not room['active'] or not room['started']:
        return

    end_game_for_loser(room_code, loser_sid)


@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid

    for room_code, room in list(rooms.items()):
        if sid not in room['players']:
            continue

        room['players'] = [player_sid for player_sid in room['players'] if player_sid != sid]

        if room['active'] and room['started']:
            if len(room['players']) == 1:
                remaining_sid = room['players'][0]
                room['active'] = False
                emit(
                    'game_over',
                    {
                        'winner': remaining_sid,
                        'loser': sid,
                    },
                    room=room_code,
                )
            else:
                room['active'] = False

        if not room['players']:
            rooms.pop(room_code, None)
        break


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=False)
