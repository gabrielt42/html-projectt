# 3D Physics Shooter - Multiplayer Edition

A 3D physics-based defense game with multiplayer support.

## Features

- **Single Player Mode**: Defend the core from waves of enemies
- **Multiplayer Co-op**: Play with friends in the same game session
- Real-time synchronization of:
  - Player positions and cameras
  - Enemy spawning and health
  - Projectiles
  - Game state (health, coins, waves)
  - Shop purchases

## Quick Start (Easiest Way!)

### Prerequisites
**You need Node.js installed first!**
- Download from: https://nodejs.org/
- Install the LTS (Long Term Support) version
- **Important:** After installing, restart your computer
- Verify installation: Open a new command prompt and type `node --version`

### Starting the Server

**Windows Users:**
- Simply **double-click `start-server.bat`**
- The window will stay open so you can see what's happening
- The server will start automatically!
- No need to open terminal or type commands

**Mac/Linux Users:**
- Run `./start-server.sh` in terminal
- Or make it executable: `chmod +x start-server.sh` then double-click

The launcher script will:
- ✅ Check if Node.js is installed
- ✅ Automatically install dependencies if needed
- ✅ Start the server on `http://localhost:3000`
- ✅ Show you when it's ready
- ✅ Keep the window open so you can see status messages

## Manual Setup (Alternative)

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

### 3. Open the Game

**For the Host (person running the server):**
- Open `physics.html` in your browser
- Click "Multiplayer"
- Leave server IP empty or enter "localhost"
- Click "Create Room" or "Quick Play"

**For Other Players (joining the host):**
- Open `physics.html` in their browser
- Click "Multiplayer"
- Enter the host's IP address in the "Server IP Address" field
  - To find your IP: Open command prompt and type `ipconfig` (look for IPv4 Address)
  - Example: `192.168.1.100`
- Enter the room code shared by the host
- Click "Join Room"

Multiple players can join the same room by opening the game in different browser tabs/windows.

## How Multiplayer Works

- **Room System**: All players join the "default" room automatically
- **Host**: The first player to join becomes the host and controls enemy spawning
- **Shared State**: All players share:
  - Core health
  - Coins
  - Wave progress
  - Enemy positions and health
- **Individual**: Each player has their own:
  - Camera/position
  - Projectiles
  - Shop purchases (shared coins)

## Development

### Server Configuration

The server runs on port 3000 by default. To change this, set the `PORT` environment variable:

```bash
PORT=8080 npm start
```

### Disabling Multiplayer

To disable multiplayer and play single-player only, set `isMultiplayerEnabled = false` in `physics.html`.

## Deployment

For production deployment:

1. Update the server URL in `physics.html` (line ~2180) to your production server
2. Deploy the server to a hosting service (Heroku, AWS, DigitalOcean, etc.)
3. Update the Socket.io connection URL accordingly

## Requirements

- Node.js 14.0.0 or higher
- Modern web browser with WebSocket support

