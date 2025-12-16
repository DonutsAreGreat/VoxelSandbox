import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { buildChunkGeometry } from './meshing.js';

export const CHUNK_SIZE = 32;
export const VOXEL_SIZE = 1;

export class Chunk {
  constructor(cx, cy, cz) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
    this.mesh = null;
    this.dirty = true;
  }

  index(x, y, z) {
    return x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
  }

  getVoxel(x, y, z) {
    return this.data[this.index(x, y, z)];
  }

  setVoxel(x, y, z, id) {
    this.data[this.index(x, y, z)] = id;
    this.dirty = true;
  }

  replaceData(buffer) {
    this.data = new Uint8Array(buffer);
    this.dirty = true;
  }

  rebuildMesh(world, material) {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh = null;
    }

    const geometry = buildChunkGeometry(this, world);
    if (!geometry) {
      return null;
    }

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(
      this.cx * CHUNK_SIZE * VOXEL_SIZE,
      this.cy * CHUNK_SIZE * VOXEL_SIZE,
      this.cz * CHUNK_SIZE * VOXEL_SIZE
    );
    this.mesh.receiveShadow = false;
    this.mesh.castShadow = false;
    this.dirty = false;
    return this.mesh;
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
  }
}
