# How to Play Multiplayer

## For the Host (Person Running the Server)

1. **Start the server:**
   - Double-click `start-server.bat`
   - Wait until you see "Server listening on port 3000"

2. **Find your IP address:**
   - Open Command Prompt (search "cmd" in Windows)
   - Type: `ipconfig`
   - Look for "IPv4 Address" under your network adapter
   - Example: `192.168.1.100`

3. **Start the game:**
   - Open `physics.html` in your browser
   - Click "Multiplayer"
   - Leave server IP empty or enter "localhost"
   - Click "Create Room" or "Quick Play"
   - Share your **IP address** and **room code** with friends

## For Other Players (Joining)

1. **Open the game:**
   - Open `physics.html` in your browser
   - Click "Multiplayer"

2. **Enter server information:**
   - In "Server IP Address" field, enter the host's IP address
   - Example: `192.168.1.100`

3. **Join the room:**
   - Click "Join Room"
   - Enter the 6-character room code from the host
   - Click "Join"

## Troubleshooting

**Can't connect?**
- Make sure the host's server is running
- Make sure you're on the same network (WiFi/LAN)
- Check that the IP address is correct
- Make sure Windows Firewall isn't blocking port 3000

**Firewall blocking?**
- On the host computer, allow port 3000 through Windows Firewall
- Or temporarily disable firewall for testing

**Different networks?**
- For players on different networks, you'll need to:
  1. Set up port forwarding on your router (port 3000)
  2. Use your public IP address (find at whatismyip.com)
  3. Share that IP with friends

