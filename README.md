## Voxel Sandbox

Browser-first voxel sandbox inspired by Minecraft: dig, build, blast, drive a car, and save multiple worlds locally. Runs directly in the browser from `index.html`—no build tools required.

### Play
1) Open `index.html` in a modern browser (or serve the folder statically).
2) Click the canvas to lock the pointer. Press `Esc` to open the pause/settings menu.
3) Choose or create a world seed in the menu; each seed has its own local save data (IndexedDB).

### Controls
- Look: mouse. Move: `WASD`. Jump: `Space`. Sprint: `Shift`.
- Tools: `1` Pickaxe, `2` Blaster (wider carve), `3` Bomb tool.
- Left click: dig/remove voxels. Right click: place the selected material.
- Cycle materials: `[` / `]`.
- Bombs: `E` place at crosshair, `F` detonate all.
- Vehicle: spawn/remove via pause menu; `V` to enter/exit nearby car; `C` toggles first/third-person car camera.

### Systems
- **Chunks & world**: 32×32×32 chunks with view-based loading/unloading. Terrain is deterministic by seed. Bedrock floor at the height minimum; blocks above a height limit only placeable within bounds.
- **Generation**: height-mapped grass/stone/dirt with a thicker stone layer; simple structures scattered about. Seed controls terrain; menu “Create New World” sets or randomizes seeds.
- **Meshing**: per-chunk face culling for solid voxels; remesh queue throttles rebuilds.
- **Raycast**: voxel DDA from camera to find block under the crosshair; reach limited to 4 blocks.
- **Physics**: basic FPS controller with gravity, step handling, and collision against solids. Prevents self-placement into your collider.
- **Tools & destruction**: pick/blaster carve spheres; right-click places current material; bombs are physical blocks and detonate into craters/debris.
- **HUD**: shows FPS, tool/material, bomb count, position (X/Y/Z), vehicle status, and car speed when in vehicle.
- **Skybox**: simple bright blue sky.
- **Vehicle**: spawnable car with mouse-look-only camera (no yaw steering), third-person camera option, and speed display in HUD.
- **Saving**: chunks and settings stored locally in IndexedDB; per-seed saves. Three manual save slots in the pause menu; import/export world as JSON; reset world per seed; settings (FOV, sensitivity, fog distance) persist across reloads. Chunk data stored compressed to keep save sizes small.

### UI / Menus
- Pause menu (`Esc`): adjust FOV, mouse sensitivity, fog distance; manage saves (3 slots, download/upload); create/reset worlds by seed; spawn/despawn car.
- HUD overlay: crosshair, status panel, FPS badge.

### Folder Map
- `index.html`, `styles.css` — UI shell and styling.
- `src/main.js` — game bootstrap, loop, menus, HUD wiring.
- `src/core/` — renderer, input, time helpers.
- `src/world/` — chunk logic, generation, meshing, materials, raycast, storage (IndexedDB with compression).
- `src/physics/` — simple physics solver.
- `src/destruction/` — tools, explosions.
- `src/game/` — HUD, car, sky, controller helpers.

### Tips
- If visuals show gaps, let chunks remesh for a moment; reach is limited to 4 blocks so move closer.
- Resetting a world deletes its local saved chunks for that seed only.
- Import/export saves: use the pause menu Download/Upload; files are plain JSON with compressed chunk payloads.
