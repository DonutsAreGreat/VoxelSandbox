import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { Chunk, CHUNK_SIZE, VOXEL_SIZE } from './chunk.js';
import { generateChunk, setWorldSeed } from './generation.js';
import { ChunkStorage } from './chunkStorage.js';
import { BEDROCK_ID } from './materials.js';
import { MIN_HEIGHT, MAX_HEIGHT } from './constants.js';

export const VIEW_DISTANCE_CHUNKS = 3;

export class VoxelWorld {
  constructor(scene, worldId = 'default') {
    this.scene = scene;
    this.worldId = worldId;
    this.chunks = new Map();
    this.remeshQueue = [];
    this.queued = new Set();
    this.storage = new ChunkStorage(this.worldId);
    setWorldSeed(this.worldId);

    this.chunkMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.8,
      metalness: 0.05,
    });
  }

  chunkKey(cx, cy, cz) {
    return `${cx},${cy},${cz}`;
  }

  getChunk(cx, cy, cz) {
    return this.chunks.get(this.chunkKey(cx, cy, cz));
  }

  createChunk(cx, cy, cz) {
    const chunk = new Chunk(cx, cy, cz);
    this.chunks.set(this.chunkKey(cx, cy, cz), chunk);
    // Build immediately so we have terrain while storage loads
    generateChunk(chunk);
    this.scheduleRemesh(chunk);
    this.loadChunkFromStorage(chunk);
    return chunk;
  }

  ensureChunk(cx, cy, cz) {
    let chunk = this.getChunk(cx, cy, cz);
    if (!chunk) {
      chunk = this.createChunk(cx, cy, cz);
    }
    return chunk;
  }

  async loadChunkFromStorage(chunk) {
    try {
      const data = await this.storage.getChunk(chunk.cx, chunk.cy, chunk.cz);
      // Chunk might have been unloaded while async load was pending
      if (this.getChunk(chunk.cx, chunk.cy, chunk.cz) !== chunk) return;
      if (data) {
        chunk.replaceData(data);
        this.scheduleRemesh(chunk);
      } else {
        this.storage.queueSave(chunk.cx, chunk.cy, chunk.cz, chunk.data);
      }
    } catch (err) {
      console.error('Chunk load failed', err);
    }
  }

  worldToChunkCoord(v) {
    return Math.floor(v / CHUNK_SIZE);
  }

  getVoxel(wx, wy, wz, createIfMissing = false) {
    if (wy < MIN_HEIGHT || wy > MAX_HEIGHT) return wy === MIN_HEIGHT ? BEDROCK_ID : 0;
    const cx = this.worldToChunkCoord(wx);
    const cy = this.worldToChunkCoord(wy);
    const cz = this.worldToChunkCoord(wz);
    const chunk = createIfMissing ? this.ensureChunk(cx, cy, cz) : this.getChunk(cx, cy, cz);
    if (!chunk) return 0;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((wy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getVoxel(lx, ly, lz);
  }

  setVoxel(wx, wy, wz, id) {
    if (wy < MIN_HEIGHT || wy > MAX_HEIGHT) return false;
    const cx = this.worldToChunkCoord(wx);
    const cy = this.worldToChunkCoord(wy);
    const cz = this.worldToChunkCoord(wz);
    const chunk = this.ensureChunk(cx, cy, cz);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((wy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const existing = chunk.getVoxel(lx, ly, lz);
    if (wy === MIN_HEIGHT && existing === BEDROCK_ID && id === 0) return false; // unbreakable floor
    chunk.setVoxel(lx, ly, lz, id);
    this.scheduleRemesh(chunk);
    this.storage.queueSave(cx, cy, cz, chunk.data);
    return true;

    // Neighbor remesh if we touched a boundary
    const onBoundary = [
      { cond: lx === 0, dx: -1, dy: 0, dz: 0 },
      { cond: lx === CHUNK_SIZE - 1, dx: 1, dy: 0, dz: 0 },
      { cond: lz === 0, dx: 0, dy: 0, dz: -1 },
      { cond: lz === CHUNK_SIZE - 1, dx: 0, dy: 0, dz: 1 },
      { cond: ly === 0, dx: 0, dy: -1, dz: 0 },
      { cond: ly === CHUNK_SIZE - 1, dx: 0, dy: 1, dz: 0 },
    ];
    for (const b of onBoundary) {
      if (b.cond) {
        const neighbor = this.getChunk(cx + b.dx, cy + b.dy, cz + b.dz);
        if (neighbor) this.scheduleRemesh(neighbor);
      }
    }
  }

  isSolid(x, y, z) {
    return this.getVoxel(x, y, z, false) !== 0;
  }

  scheduleRemesh(chunk) {
    const key = this.chunkKey(chunk.cx, chunk.cy, chunk.cz);
    if (this.queued.has(key)) return;
    this.queued.add(key);
    this.remeshQueue.push(chunk);
  }

  processRemeshQueue(limit = 2) {
    let processed = 0;
    while (this.remeshQueue.length > 0 && processed < limit) {
      const chunk = this.remeshQueue.shift();
      if (!chunk) break;
      const key = this.chunkKey(chunk.cx, chunk.cy, chunk.cz);
      this.queued.delete(key);

      if (chunk.mesh && chunk.mesh.parent) {
        this.scene.remove(chunk.mesh);
      }
      const mesh = chunk.rebuildMesh(this, this.chunkMaterial);
      if (mesh) {
        if (!mesh.parent) {
          this.scene.add(mesh);
        }
      }
      processed++;
    }
  }

  updateVisible(center) {
    const centerChunkX = this.worldToChunkCoord(center.x);
    const centerChunkY = this.worldToChunkCoord(center.y);
    const centerChunkZ = this.worldToChunkCoord(center.z);

    for (let y = -1; y <= 1; y++) {
      for (let z = -VIEW_DISTANCE_CHUNKS; z <= VIEW_DISTANCE_CHUNKS; z++) {
        for (let x = -VIEW_DISTANCE_CHUNKS; x <= VIEW_DISTANCE_CHUNKS; x++) {
          const cx = centerChunkX + x;
          const cy = centerChunkY + y;
          const cz = centerChunkZ + z;
          this.ensureChunk(cx, cy, cz);
        }
      }
    }

    for (const [key, chunk] of this.chunks.entries()) {
      const dx = chunk.cx - centerChunkX;
      const dy = chunk.cy - centerChunkY;
      const dz = chunk.cz - centerChunkZ;
      const dist = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
      if (dist > VIEW_DISTANCE_CHUNKS + 1) {
        if (chunk.mesh && chunk.mesh.parent) {
          this.scene.remove(chunk.mesh);
        }
        chunk.dispose();
        this.chunks.delete(key);
      }
    }
  }

  flushSaves() {
    return this.storage.flushQueued();
  }

  async reloadFromStorage(center = new THREE.Vector3()) {
    await this.flushSaves();
    for (const [, chunk] of this.chunks) {
      if (chunk.mesh && chunk.mesh.parent) {
        this.scene.remove(chunk.mesh);
      }
      chunk.dispose();
    }
    this.chunks.clear();
    this.updateVisible(center);
    this.processRemeshQueue(16);
  }
}

// Re-export constants for convenience
export { CHUNK_SIZE, VOXEL_SIZE, MIN_HEIGHT, MAX_HEIGHT };
