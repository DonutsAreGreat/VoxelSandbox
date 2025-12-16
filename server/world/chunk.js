import { CHUNK_SIZE } from './constants.js';

export class Chunk {
  constructor(cx, cy, cz) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
  }

  index(x, y, z) {
    return x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
  }

  get(x, y, z) {
    return this.data[this.index(x, y, z)];
  }

  set(x, y, z, id) {
    this.data[this.index(x, y, z)] = id;
  }
}
