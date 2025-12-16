import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { CHUNK_SIZE, VOXEL_SIZE } from './chunk.js';
import { BOMB_ID, colorForMaterial } from './materials.js';

const faces = [
  { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], normal: [1, 0, 0] },
  { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], normal: [-1, 0, 0] },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], normal: [0, 1, 0] },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], normal: [0, -1, 0] },
  { dir: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], normal: [0, 0, 1] },
  { dir: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], normal: [0, 0, -1] },
];

export function buildChunkGeometry(chunk, world) {
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];

  let vertexCount = 0;
  // Geometry is built in chunk-local space; chunk.position will offset it into world space.
  const toWorld = (n) => n * VOXEL_SIZE;

  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const id = chunk.getVoxel(x, y, z);
        if (id === 0 || id === BOMB_ID) continue; // bombs render with their own mesh
        const worldX = chunk.cx * CHUNK_SIZE + x;
        const worldY = chunk.cy * CHUNK_SIZE + y;
        const worldZ = chunk.cz * CHUNK_SIZE + z;
        const color = colorForMaterial(id);

        for (const face of faces) {
          const nx = worldX + face.dir[0];
          const ny = worldY + face.dir[1];
          const nz = worldZ + face.dir[2];
          const neighbor = world.getVoxel(nx, ny, nz, false);
          if (neighbor !== 0) continue;

          for (let i = 0; i < 4; i++) {
            const corner = face.corners[i];
            positions.push(
              toWorld(x + corner[0]),
              toWorld(y + corner[1]),
              toWorld(z + corner[2])
            );
            normals.push(face.normal[0], face.normal[1], face.normal[2]);
            colors.push(color.r, color.g, color.b);
          }

          indices.push(vertexCount, vertexCount + 1, vertexCount + 2, vertexCount, vertexCount + 2, vertexCount + 3);
          vertexCount += 4;
        }
      }
    }
  }

  if (positions.length === 0) {
    return null;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
