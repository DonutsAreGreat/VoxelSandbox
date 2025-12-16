
## Voxel Sandbox

Browser-only first-person destructible voxel sandbox. Open `index.html` directly in a modern browser (no server or build step required).

### Controls
- Click overlay to lock pointer and play.
- Mouse look + `WASD` to move, `Space` to jump, `Shift` to sprint.
- `1` Pickaxe, `2` Blaster, `3` Bomb tool.
- Left click: remove voxels (larger radius on Blaster).
- Right click: place voxel of the selected material.
- `[` / `]` cycle placeable materials.
- Bomb tool: `E` place bomb at crosshair hit, `F` detonate all bombs.

### Systems overview
- **Chunks**: Voxel grid split into `CHUNK_SIZE` cubes (see `src/world/chunk.js`). `VoxelWorld` keeps a map of loaded chunks keyed by chunk coordinates and unloads chunks outside `VIEW_DISTANCE_CHUNKS`.
- **Generation**: `src/world/generation.js` builds a flat-ish terrain with simple metal/wood box structures using deterministic noise.
- **Meshing**: `src/world/meshing.js` does face-culling meshing per chunk, only emitting visible faces and using vertex colors for materials. Chunks remesh via a queue to throttle rebuilds.
- **Raycast**: `src/world/raycastVoxel.js` implements 3D DDA stepping through voxel cells to find the first solid hit from the camera center.
- **Physics**: `src/physics/simplePhysics.js` runs capsule-like AABB collision against solid voxels with gravity and small step-up.
- **Destruction**: `src/destruction/tools.js` handles tool selection and carving/placing; `src/destruction/explosions.js` manages bombs, spherical blasts, and short-lived debris cubes.

### Files
- `index.html`, `styles.css` – UI shell and style.
- `src/main.js` – scene setup, loop, HUD wiring.
- `src/core/*` – renderer, input, time helpers.
- `src/game/*` – player controller and HUD.
- `src/world/*` – voxel storage, meshing, materials, generation, raycast.
- `src/destruction/*` – tools and explosions.
- `src/physics/simplePhysics.js` – movement/collision solver.

### WebRTC signaling (self-host)
If you want browser-to-browser multiplayer hosting, run the minimal signaling relay included:
1) `npm install ws`
2) `node signaling-server.js --port 8080`

It simply relays WebRTC offer/answer/ICE payloads between peers in the same room code; you still need to hook your client to send/receive signals (see `src/net/p2p.js` scaffolding). The game logic remains local/hosted in the browser; this server only handles signaling.

### Simple multi-session WS hub (server hosting)
`server.js` is a minimal WebSocket hub that can host up to 3 sessions:
- Install deps: `npm install ws`
- Run: `node server.js --port 8090`
- Messages: send `{action:'create', code:'myroom'}` or `{action:'join', code:'myroom'}`; payloads are relayed to peers in the same room.
This is only a skeleton; you still need to hook in real game state/logic on the server and adapt the client to connect to it instead of running everything locally.

### In-game shared world (experimental)
- Run `node server.js --port 8090`.
- Open the pause menu → Multiplayer: set the server URL (defaults to localhost), room code, then Host or Join.
- The server is authoritative for chunks/edits; all players see the same blocks and simple box avatars at each player's position.
- If your site is served over HTTPS, browsers require WSS. Start the server with TLS: `node server.js --port 8090 --key /path/to/key.pem --cert /path/to/cert.pem` (or set `SSL_KEY`/`SSL_CERT`). Without TLS, use plain HTTP to avoid mixed-content blocking.
# VoxelSandbox
