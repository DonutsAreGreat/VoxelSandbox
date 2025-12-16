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
# VoxelSandbox
