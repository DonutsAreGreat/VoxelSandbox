import { Chunk } from './world/chunk.js';
import { generateChunk, setWorldSeed } from './world/generation.js';
import { CHUNK_SIZE, MIN_HEIGHT, MAX_HEIGHT } from './world/constants.js';
import { MATERIAL } from './world/materials.js';

function chunkKey(cx, cy, cz) {
  return `${cx},${cy},${cz}`;
}

class World {
  constructor(seed = 'default') {
    this.seed = seed;
    this.chunks = new Map();
    setWorldSeed(seed);
  }

  ensureChunk(cx, cy, cz) {
    const key = chunkKey(cx, cy, cz);
    if (this.chunks.has(key)) return this.chunks.get(key);
    const chunk = new Chunk(cx, cy, cz);
    generateChunk(chunk);
    this.chunks.set(key, chunk);
    return chunk;
  }

  worldToChunkCoord(v) {
    return Math.floor(v / CHUNK_SIZE);
  }

  getVoxel(wx, wy, wz) {
    const cx = this.worldToChunkCoord(wx);
    const cy = this.worldToChunkCoord(wy);
    const cz = this.worldToChunkCoord(wz);
    const chunk = this.chunks.get(chunkKey(cx, cy, cz));
    if (!chunk) return 0;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((wy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.get(lx, ly, lz);
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
    chunk.set(lx, ly, lz, id);
    return true;
  }

  serializeChunk(cx, cy, cz) {
    const chunk = this.ensureChunk(cx, cy, cz);
    return {
      cx,
      cy,
      cz,
      data: Buffer.from(chunk.data),
    };
  }
}

export class SessionManager {
  constructor(maxSessions = 3) {
    this.maxSessions = maxSessions;
    this.sessions = new Map(); // code -> session
  }

  createSession(code, seed = 'default') {
    if (this.sessions.size >= this.maxSessions) return null;
    if (this.sessions.has(code)) return null;
    const session = {
      code,
      seed,
      world: new World(seed),
      players: new Map(), // id -> {x,y,z}
    };
    this.sessions.set(code, session);
    return session;
  }

  getSession(code) {
    return this.sessions.get(code);
  }

  removeEmptySession(code) {
    const session = this.sessions.get(code);
    if (!session) return;
    if (session.players.size === 0) {
      this.sessions.delete(code);
    }
  }
}
