import { MATERIALS, BOMB_ID, BEDROCK_ID } from '../world/materials.js';

const TOOL_TYPES = ['Pickaxe', 'Blaster', 'Bomb'];

export class Tools {
  constructor() {
    this.toolIndex = 0;
    this.materialIndex = 1; // stone by default
  }

  selectTool(idx) {
    if (idx >= 0 && idx < TOOL_TYPES.length) {
      this.toolIndex = idx;
    }
  }

  cycleMaterial(delta) {
    const usable = MATERIALS.filter((m) => m.id !== 0 && m.id !== BOMB_ID && m.id !== BEDROCK_ID);
    this.materialIndex = (this.materialIndex + delta + usable.length) % usable.length;
  }

  currentMaterial() {
    const usable = MATERIALS.filter((m) => m.id !== 0 && m.id !== BOMB_ID && m.id !== BEDROCK_ID);
    return usable[this.materialIndex] || usable[0];
  }

  currentToolName() {
    return TOOL_TYPES[this.toolIndex];
  }

  radiusForTool() {
    if (this.toolIndex === 1) return 1.5;
    if (this.toolIndex === 2) return 0.9;
    return 0.7;
  }

  applyPrimary(world, hit) {
    if (!hit || !hit.hit) return false;
    const radius = this.radiusForTool();
    carveSphere(world, hit.voxel, radius);
    return true;
  }

  applySecondary(world, hit) {
    const mat = this.currentMaterial().id;
    if (hit && hit.hit) {
      const target = {
        x: hit.voxel.x + hit.normal.x,
        y: hit.voxel.y + hit.normal.y,
        z: hit.voxel.z + hit.normal.z,
      };
      return world.setVoxel(target.x, target.y, target.z, mat) === true;
    }
    return false;
  }
}

function carveSphere(world, centerVoxel, radius) {
  const r2 = radius * radius;
  const minX = Math.floor(centerVoxel.x - radius);
  const maxX = Math.floor(centerVoxel.x + radius);
  const minY = Math.floor(centerVoxel.y - radius);
  const maxY = Math.floor(centerVoxel.y + radius);
  const minZ = Math.floor(centerVoxel.z - radius);
  const maxZ = Math.floor(centerVoxel.z + radius);
  for (let y = minY; y <= maxY; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - centerVoxel.x;
        const dy = y - centerVoxel.y;
        const dz = z - centerVoxel.z;
        if (dx * dx + dy * dy + dz * dz <= r2) {
          world.setVoxel(x, y, z, 0);
        }
      }
    }
  }
}
