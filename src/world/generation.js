import { CHUNK_SIZE } from './chunk.js';
import { MIN_HEIGHT, MAX_HEIGHT } from './constants.js';
import { BEDROCK_ID } from './materials.js';

// Keep terrain comfortably above bedrock; base height targets ~62 with small variation.
const BASE_HEIGHT = 62;
let worldSeed = 1337;

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function setWorldSeed(seedStr) {
  const cleaned = seedStr && seedStr.trim() ? seedStr.trim() : 'default';
  worldSeed = hashString(cleaned) || 1337;
}

function hash2d(x, z) {
  const s = Math.sin((x + worldSeed * 0.01) * 127.1 + (z + worldSeed * 0.02) * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function smoothNoise(x, z) {
  const sx = x + worldSeed * 0.1;
  const sz = z + worldSeed * 0.1;
  const n = Math.sin(sx * 0.12) + Math.cos(sz * 0.12) + Math.sin((sx + sz) * 0.07);
  return n * 0.5;
}

function terrainHeight(wx, wz) {
  const hills = smoothNoise(wx, wz);
  const bumps = Math.sin((wx + worldSeed) * 0.03) * Math.cos((wz - worldSeed) * 0.03);
  return Math.floor(BASE_HEIGHT + hills * 4 + bumps * 3);
}

function placeStructure(chunk, worldX0, worldZ0, chunkSeed) {
  if (chunkSeed < 0.82) return;
  const size = 6 + Math.floor(chunkSeed * 4);
  const height = 6 + Math.floor(chunkSeed * 6);
  const baseX = Math.floor(worldX0 + CHUNK_SIZE / 2 - size / 2);
  const baseZ = Math.floor(worldZ0 + CHUNK_SIZE / 2 - size / 2);
  const baseY = terrainHeight(baseX, baseZ);

  for (let y = 0; y < height; y++) {
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const wx = baseX + x;
        const wz = baseZ + z;
        const wy = baseY + y;
        const inX = wx - worldX0;
        const inZ = wz - worldZ0;
        const inY = wy - chunk.cy * CHUNK_SIZE;
        if (inX < 0 || inX >= CHUNK_SIZE || inZ < 0 || inZ >= CHUNK_SIZE || inY < 0 || inY >= CHUNK_SIZE) continue;
        const isFrame = x === 0 || z === 0 || x === size - 1 || z === size - 1 || y === height - 1;
        const id = isFrame ? 4 : 3; // metal frame, wood walls
        chunk.setVoxel(inX, inY, inZ, id);
      }
    }
  }
}

export function generateChunk(chunk) {
  const worldX0 = chunk.cx * CHUNK_SIZE;
  const worldZ0 = chunk.cz * CHUNK_SIZE;
  const chunkSeed = hash2d(chunk.cx, chunk.cz);

  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const wx = worldX0 + x;
      const wz = worldZ0 + z;
      const h = terrainHeight(wx, wz);

      for (let y = 0; y < CHUNK_SIZE; y++) {
        const wy = chunk.cy * CHUNK_SIZE + y;
        if (wy < MIN_HEIGHT || wy > MAX_HEIGHT) {
          chunk.setVoxel(x, y, z, 0);
          continue;
        }

        if (wy === MIN_HEIGHT) {
          chunk.setVoxel(x, y, z, BEDROCK_ID);
          continue;
        }

        if (wy > h) {
          chunk.setVoxel(x, y, z, 0);
          continue;
        }

        const depth = h - wy;
        let id = 1; // dirt
        if (depth > 3) id = 2; // stone deeper down
        if (depth === 0) id = 5; // grass cap
        if (depth === 1 && hash2d(wx, wz) > 0.7) id = 3; // occasional wood patch

        chunk.setVoxel(x, y, z, id);
      }
    }
  }

  placeStructure(chunk, worldX0, worldZ0, chunkSeed);
}
