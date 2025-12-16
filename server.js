// Helper: list players in a room
function getRoomPlayers(roomId) {
    return Array.from(players.values())
        .filter(p => p.roomId === roomId)
        .map(p => ({
            id: p.id,
            name: p.name
        }));
}

// Helper: get player count in a room
function getRoomPlayerCount(roomId) {
    return Array.from(players.values()).filter(p => p.roomId === roomId).length;
}

// Helper: determine if a player is the host
function isHost(roomId) {
    const playersInRoom = Array.from(players.values()).filter(p => p.roomId === roomId);
    if (playersInRoom.length === 0) return false;
    return playersInRoom[0].id === players.get(playersInRoom[0].id).id; // First player to join is host
}

// Helper: create game state
function createGameState() {
    return {
        coins: 0,
        coreHealth: 100,
        wave: 1,
        enemies: [],
        isPaused: false
    };
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(__dirname));

// Route handler for root path - serve physics.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'physics.html'));
});

// Game state storage
const rooms = new Map(); // roomId -> game state
const players = new Map(); // socket.id -> player object
const roomCodes = new Map(); // roomCode -> roomId

// Generate a random 6-character room code
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Get or create room by code
function getOrCreateRoomByCode(roomCode) {
    if (roomCodes.has(roomCode)) {
        return roomCodes.get(roomCode);
    }
    const roomId = `room_${Date.now()}_${Math.random()}`;
    roomCodes.set(roomCode, roomId);
    rooms.set(roomId, createGameState());
    return roomId;
}

// Create player object
function createPlayer(socketId, roomId) {
    return {
        id: socketId,
        roomId: roomId,
        name: `Player ${socketId.slice(-4)}`
    };
}

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Create player
    const player = createPlayer(socket.id, null);
    players.set(socket.id, player);

    // Quick Play handler
    socket.on('quickPlay', (callback) => {
        const roomCode = 'QPROOM'; // Single room for quick play
        const roomId = getOrCreateRoomByCode(roomCode);
        const gameState = rooms.get(roomId);
        
        // Leave previous room if any
        const oldPlayer = players.get(socket.id);
        if (oldPlayer && oldPlayer.roomId) {
            socket.leave(oldPlayer.roomId);
        }

        // Join room
        socket.join(roomId);
        
        const newPlayer = createPlayer(socket.id, roomId);
        players.set(socket.id, newPlayer);
        
        const playerCount = getRoomPlayerCount(roomId);
        const playersInRoom = Array.from(players.values())
            .filter(p => p.roomId === roomId)
            .map(p => ({ id: p.id, name: p.name }));

        // Send initial game state
        socket.emit('gameState', gameState);
        socket.emit('quickPlayJoined', {
            roomCode: roomCode,
            isHost: isHost(roomId),
            playerCount: playerCount,
            players: playersInRoom
        });
        
        // Notify others about new player and current player count
        io.in(roomId).emit('quickPlayWaiting', {
            playerCount: playerCount,
            players: playersInRoom
        });

        // If second player joins, restart match to sync spawns
        if (playerCount >= 2) {
            const newState = createGameState();
            rooms.set(roomId, newState);
            io.in(roomId).emit('gameState', newState); // Send fresh state
            io.in(roomId).emit('gameReset'); // Trigger game reset
            io.in(roomId).emit('quickPlayReady'); // Signal game start
            console.log(`Quick Play room ${roomCode} ready, restarting match.`);
        }
        
        console.log(`Player ${socket.id} quick played into room ${roomCode} (${roomId}). Players: ${playerCount}`);
        if (callback) callback({ success: true, roomCode, isHost: isHost(roomId) });
    });

    // Create room handler
    socket.on('createRoom', (callback) => {
        let roomCode = generateRoomCode();
        // Ensure unique code
        while (roomCodes.has(roomCode)) {
            roomCode = generateRoomCode();
        }
        
        const roomId = getOrCreateRoomByCode(roomCode);
        
        // Leave previous room if any
        const oldPlayer = players.get(socket.id);
        if (oldPlayer && oldPlayer.roomId) {
            socket.leave(oldPlayer.roomId);
        }

        socket.join(roomId);
        const player = createPlayer(socket.id, roomId);
        players.set(socket.id, player);
        
        const gameState = rooms.get(roomId);
        socket.emit('gameState', gameState);
        
        console.log(`Player ${socket.id} created room ${roomCode} (${roomId})`);
        if (callback) callback({ success: true, roomCode, isHost: true });
    });

    // Join room by code handler
    socket.on('joinRoom', (data, callback) => {
        const { roomCode } = data;
        
        if (!roomCode || roomCode.length !== 6) {
            if (callback) callback({ success: false, error: 'Invalid room code' });
            return;
        }

        const roomId = getOrCreateRoomByCode(roomCode);
        
        // Leave previous room if any
        const oldPlayer = players.get(socket.id);
        if (oldPlayer && oldPlayer.roomId) {
            socket.leave(oldPlayer.roomId);
        }

        socket.join(roomId);
        const player = createPlayer(socket.id, roomId);
        players.set(socket.id, player);
        
        const gameState = rooms.get(roomId);
        socket.emit('gameState', gameState);
        
        // Notify others
        socket.to(roomId).emit('playerJoined', {
            playerId: socket.id,
            name: player.name
        });
        
        console.log(`Player ${socket.id} joined room ${roomCode} (${roomId})`);
        if (callback) callback({ success: true, roomCode, isHost: isHost(roomId) });
    });

    // Leave room handler
    socket.on('leaveRoom', (roomCode) => {
        const player = players.get(socket.id);
        if (player && player.roomId) {
            socket.leave(player.roomId);
            socket.to(player.roomId).emit('playerLeft', {
                playerId: socket.id
            });
            players.delete(socket.id);
            console.log(`Player ${socket.id} left room ${player.roomId}`);
        }
    });

    // Position update handler
    socket.on('updatePosition', (data) => {
        const player = players.get(socket.id);
        if (player && player.roomId) {
            socket.to(player.roomId).emit('playerPosition', {
                playerId: socket.id,
                position: data.position,
                rotation: data.rotation,
                cameraRotation: data.cameraRotation
            });
        }
    });

    // Shop purchase handler
    socket.on('shopPurchase', (data) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        
        const gameState = rooms.get(player.roomId);
        if (!gameState) return;
        
        // Validate purchase (check coins)
        const cost = data.cost;
        if (gameState.coins < cost) {
            socket.emit('shopPurchaseError', { error: 'Not enough coins' });
            return;
        }
        
        // Apply purchase
        gameState.coins -= cost;
        
        // Store purchase in game state
        if (!gameState.shopPurchases) {
            gameState.shopPurchases = [];
        }
        gameState.shopPurchases.push({
            type: data.type,
            cost: cost,
            timestamp: Date.now()
        });
        
        // Broadcast to all players in room
        io.in(player.roomId).emit('shopPurchase', {
            type: data.type,
            cost: cost,
            totalCoins: gameState.coins
        });
        
        console.log(`Player ${socket.id} purchased ${data.type} in room ${player.roomId}`);
    });

    // Enemy spawn handler (host only)
    socket.on('enemySpawned', (data) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        
        // Only host can spawn enemies
        if (!isHost(player.roomId)) return;
        
        // Broadcast to all other players
        socket.to(player.roomId).emit('enemySpawned', data);
    });

    // Enemy hit handler
    socket.on('enemyHit', (data) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        
        // Broadcast to all players in room
        io.in(player.roomId).emit('enemyHit', data);
    });

    // Enemy killed handler
    socket.on('enemyKilled', (data) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        
        const gameState = rooms.get(player.roomId);
        if (!gameState) return;
        
        // Add coins to shared pool
        gameState.coins += data.coins || 0;
        
        // Broadcast to all players
        io.in(player.roomId).emit('enemyKilled', {
            enemyId: data.enemyId,
            coins: data.coins,
            totalCoins: gameState.coins,
            position: data.position
        });
    });

    // Game state sync handler (host sends periodic updates)
    socket.on('gameStateSync', (data) => {
        const player = players.get(socket.id);
        if (!player || !player.roomId) return;
        
        // Only host can sync game state
        if (!isHost(player.roomId)) return;
        
        const gameState = rooms.get(player.roomId);
        if (gameState) {
            // Update from host
            gameState.coins = data.coins || gameState.coins;
            gameState.coreHealth = data.coreHealth || gameState.coreHealth;
            gameState.wave = data.wave || gameState.wave;
            
            // Broadcast to all other players
            socket.to(player.roomId).emit('gameState', gameState);
        }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
        const player = players.get(socket.id);
        if (player && player.roomId) {
            // Notify others
            socket.to(player.roomId).emit('playerLeft', {
                playerId: socket.id
            });

            // If it's a quick play room, update waiting status
            const quickPlayRoomId = getOrCreateRoomByCode('QPROOM');
            if (player.roomId === quickPlayRoomId || roomCodes.get('QPROOM') === player.roomId) {
                players.delete(socket.id); // Remove player before counting
                const roomId = player.roomId;
                const playerCount = getRoomPlayerCount(roomId);
                const playersInRoom = Array.from(players.values())
                    .filter(p => p.roomId === roomId)
                    .map(p => ({ id: p.id, name: p.name }));
                io.in(roomId).emit('quickPlayWaiting', {
                    playerCount: playerCount,
                    players: playersInRoom
                });
            } else {
                players.delete(socket.id);
            }
            console.log('Player disconnected:', socket.id);
        } else {
            players.delete(socket.id);
            console.log('Player disconnected (no room):', socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT}/physics.html in your browser`);
});
