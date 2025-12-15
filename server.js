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

// Game state storage
const rooms = new Map(); // roomId -> game state
const players = new Map(); // socketId -> player info
const roomCodes = new Map(); // roomCode -> roomId
const roomCodeToId = new Map(); // roomCode -> roomId (reverse lookup)

// Generate a random room code (6 characters, alphanumeric)
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
    if (roomCodeToId.has(roomCode)) {
        return roomCodeToId.get(roomCode);
    }
    
    // Create new room with this code
    const roomId = `room-${Date.now()}-${Math.random()}`;
    rooms.set(roomId, createGameState());
    roomCodeToId.set(roomCode, roomId);
    return roomId;
}

// Default game state
function createGameState() {
    return {
        wave: 1,
        coreHealth: 100,
        coins: 150,
        enemies: [],
        enemiesToSpawn: 10,
        totalEnemiesForWave: 10,
        waveInProgress: false,
        nextSpawnTime: 0,
        speedyEnemiesToSpawn: 0,
        splitterEnemiesToSpawn: 0,
        projectiles: [],
        turrets: [],
        barriers: [],
        shopPurchases: [],
        lastUpdate: Date.now()
    };
}

// Player info
function createPlayer(socketId, roomId) {
    return {
        id: socketId,
        roomId: roomId,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        cameraRotation: { x: 0, y: 0 },
        lastUpdate: Date.now()
    };
}

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('createRoom', (callback) => {
        // Generate a unique room code
        let roomCode;
        do {
            roomCode = generateRoomCode();
        } while (roomCodeToId.has(roomCode));
        
        const roomId = getOrCreateRoomByCode(roomCode);
        const gameState = rooms.get(roomId);
        
        // Leave previous room if any
        const oldPlayer = players.get(socket.id);
        if (oldPlayer && oldPlayer.roomId) {
            socket.leave(oldPlayer.roomId);
        }

        // Join new room
        socket.join(roomId);
        
        const player = createPlayer(socket.id, roomId);
        players.set(socket.id, player);
        
        // First player in room is host
        const isHost = Array.from(players.values()).filter(p => p.roomId === roomId).length === 1;
        
        // Send room code and game state
        socket.emit('gameState', gameState);
        socket.emit('roomCreated', {
            roomCode: roomCode,
            isHost: isHost
        });
        
        console.log(`Player ${socket.id} created room ${roomCode} (${roomId})`);
        if (callback) callback({ roomCode, isHost });
    });

    socket.on('joinRoomByCode', (roomCode, callback) => {
        if (!roomCode || roomCode.length !== 6) {
            socket.emit('joinRoomFailed', { reason: 'invalid_code' });
            if (callback) callback({ success: false, reason: 'invalid_code' });
            return;
        }
        
        if (!roomCodeToId.has(roomCode)) {
            socket.emit('joinRoomFailed', { reason: 'room_not_found' });
            if (callback) callback({ success: false, reason: 'room_not_found' });
            return;
        }
        
        const roomId = roomCodeToId.get(roomCode);
        
        // Leave previous room if any
        const oldPlayer = players.get(socket.id);
        if (oldPlayer && oldPlayer.roomId) {
            socket.leave(oldPlayer.roomId);
        }

        // Join new room
        socket.join(roomId);
        
        const gameState = rooms.get(roomId);
        const player = createPlayer(socket.id, roomId);
        players.set(socket.id, player);
        
        // Check if host (first player in room)
        const isHost = Array.from(players.values()).filter(p => p.roomId === roomId).length === 1;
        
        // Send current game state to new player
        socket.emit('gameState', gameState);
        socket.emit('roomJoined', {
            roomCode: roomCode,
            isHost: isHost
        });
        
        // Notify others in room
        socket.to(roomId).emit('playerJoined', {
            playerId: socket.id,
            position: player.position
        });

        // Send list of other players in room
        const otherPlayers = Array.from(players.values())
            .filter(p => p.roomId === roomId && p.id !== socket.id)
            .map(p => ({
                id: p.id,
                position: p.position,
                rotation: p.rotation,
                cameraRotation: p.cameraRotation
            }));
        
        socket.emit('otherPlayers', otherPlayers);

        console.log(`Player ${socket.id} joined room ${roomCode} (${roomId})`);
        if (callback) callback({ success: true, roomCode, isHost });
    });

    socket.on('quickPlay', (callback) => {
        // Find a room with space (max 4 players per room) or create new one
        let roomId = null;
        let roomCode = null;
        
        for (const [code, id] of roomCodeToId.entries()) {
            const playersInRoom = Array.from(players.values()).filter(p => p.roomId === id).length;
            if (playersInRoom < 4) {
                roomId = id;
                roomCode = code;
                break;
            }
        }
        
        // Create new room if none available
        if (!roomId) {
            roomCode = generateRoomCode();
            roomId = getOrCreateRoomByCode(roomCode);
        }
        
        // Leave previous room if any
        const oldPlayer = players.get(socket.id);
        if (oldPlayer && oldPlayer.roomId) {
            socket.leave(oldPlayer.roomId);
        }

        // Join room
        socket.join(roomId);
        
        const gameState = rooms.get(roomId);
        const player = createPlayer(socket.id, roomId);
        players.set(socket.id, player);
        
        // Check if host
        const isHost = Array.from(players.values()).filter(p => p.roomId === roomId).length === 1;
        
        // Send game state
        socket.emit('gameState', gameState);
        socket.emit('quickPlayJoined', {
            roomCode: roomCode,
            isHost: isHost
        });
        
        // Notify others
        socket.to(roomId).emit('playerJoined', {
            playerId: socket.id,
            position: player.position
        });

        // Send list of other players
        const otherPlayers = Array.from(players.values())
            .filter(p => p.roomId === roomId && p.id !== socket.id)
            .map(p => ({
                id: p.id,
                position: p.position,
                rotation: p.rotation,
                cameraRotation: p.cameraRotation
            }));
        
        socket.emit('otherPlayers', otherPlayers);

        console.log(`Player ${socket.id} quick played into room ${roomCode} (${roomId})`);
        if (callback) callback({ roomCode, isHost });
    });

    socket.on('updatePosition', (data) => {
        const player = players.get(socket.id);
        if (player) {
            player.position = data.position || player.position;
            player.rotation = data.rotation || player.rotation;
            player.cameraRotation = data.cameraRotation || player.cameraRotation;
            player.lastUpdate = Date.now();

            // Broadcast to others in room
            socket.to(player.roomId).emit('playerMoved', {
                playerId: socket.id,
                position: player.position,
                rotation: player.rotation,
                cameraRotation: player.cameraRotation
            });
        }
    });

    socket.on('shoot', (data) => {
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const gameState = rooms.get(player.roomId);
            if (gameState) {
                // Add projectile to game state
                const projectile = {
                    id: `${socket.id}-${Date.now()}-${Math.random()}`,
                    playerId: socket.id,
                    position: data.position,
                    velocity: data.velocity,
                    radius: data.radius,
                    mass: data.mass,
                    ammoType: data.ammoType,
                    chargeLevel: data.chargeLevel || 0,
                    timestamp: Date.now()
                };
                
                gameState.projectiles.push(projectile);
                
                // Broadcast to all in room
                io.to(player.roomId).emit('projectileShot', projectile);
            }
        }
    });

    socket.on('enemyHit', (data) => {
        const player = players.get(socket.id);
        if (player && player.roomId) {
            // Broadcast enemy hit to all players
            io.to(player.roomId).emit('enemyHit', {
                enemyIndex: data.enemyIndex,
                damage: data.damage,
                playerId: socket.id
            });
        }
    });

    socket.on('enemyKilled', (data) => {
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const gameState = rooms.get(player.roomId);
            if (gameState) {
                // Remove enemy from state
                gameState.enemies = gameState.enemies.filter((e, i) => i !== data.enemyIndex);
                
                // Update coins
                gameState.coins += data.coins || 0;
                
                // Broadcast to all
                io.to(player.roomId).emit('enemyKilled', {
                    enemyIndex: data.enemyIndex,
                    coins: data.coins,
                    totalCoins: gameState.coins,
                    position: data.position
                });
            }
        }
    });

    socket.on('coreHit', (data) => {
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const gameState = rooms.get(player.roomId);
            if (gameState) {
                gameState.coreHealth = Math.max(0, gameState.coreHealth - (data.damage || 0));
                
                // Broadcast to all
                io.to(player.roomId).emit('coreHit', {
                    damage: data.damage,
                    coreHealth: gameState.coreHealth
                });
            }
        }
    });

    socket.on('waveComplete', (data) => {
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const gameState = rooms.get(player.roomId);
            if (gameState) {
                gameState.wave++;
                gameState.coins += data.bonus || 0;
                gameState.enemiesToSpawn = data.enemiesToSpawn || 10;
                gameState.totalEnemiesForWave = gameState.enemiesToSpawn;
                gameState.waveInProgress = true;
                gameState.nextSpawnTime = Date.now() + 4000;
                gameState.speedyEnemiesToSpawn = data.speedyEnemiesToSpawn || 0;
                gameState.splitterEnemiesToSpawn = data.splitterEnemiesToSpawn || 0;
                
                // Broadcast to all
                io.to(player.roomId).emit('waveComplete', {
                    wave: gameState.wave,
                    bonus: data.bonus,
                    totalCoins: gameState.coins,
                    enemiesToSpawn: gameState.enemiesToSpawn,
                    speedyEnemiesToSpawn: gameState.speedyEnemiesToSpawn,
                    splitterEnemiesToSpawn: gameState.splitterEnemiesToSpawn
                });
            }
        }
    });

    socket.on('enemySpawned', (data) => {
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const gameState = rooms.get(player.roomId);
            if (gameState) {
                const enemy = {
                    id: data.id,
                    position: data.position,
                    velocity: data.velocity,
                    isBoss: data.isBoss || false,
                    isSpeedy: data.isSpeedy || false,
                    isSplitter: data.isSplitter || false,
                    hp: data.hp,
                    maxHp: data.maxHp,
                    radius: data.radius,
                    mass: data.mass,
                    coinValue: data.coinValue
                };
                
                gameState.enemies.push(enemy);
                
                // Broadcast to all
                io.to(player.roomId).emit('enemySpawned', enemy);
            }
        }
    });

    socket.on('shopPurchase', (data) => {
        const player = players.get(socket.id);
        if (player && player.roomId) {
            const gameState = rooms.get(player.roomId);
            if (gameState) {
                // Validate purchase (check coins)
                if (gameState.coins >= data.cost) {
                    gameState.coins -= data.cost;
                    gameState.shopPurchases.push({
                        playerId: socket.id,
                        type: data.type,
                        cost: data.cost,
                        timestamp: Date.now()
                    });
                    
                    // Broadcast to all
                    io.to(player.roomId).emit('shopPurchase', {
                        playerId: socket.id,
                        type: data.type,
                        cost: data.cost,
                        totalCoins: gameState.coins
                    });
                } else {
                    // Not enough coins
                    socket.emit('shopPurchaseFailed', {
                        type: data.type,
                        reason: 'insufficient_funds'
                    });
                }
            }
        }
    });

    socket.on('gameOver', () => {
        const player = players.get(socket.id);
        if (player && player.roomId) {
            // Reset game state
            rooms.set(player.roomId, createGameState());
            
            // Broadcast to all
            io.to(player.roomId).emit('gameReset');
        }
    });

    socket.on('disconnect', () => {
        const player = players.get(socket.id);
        if (player && player.roomId) {
            // Notify others
            socket.to(player.roomId).emit('playerLeft', {
                playerId: socket.id
            });
        }
        
        players.delete(socket.id);
        console.log('Player disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT}/physics.html in your browser`);
});

