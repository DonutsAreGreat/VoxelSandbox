import { VOXEL_SIZE } from './chunk.js';

// 3D DDA voxel raycast
export function raycastVoxel(origin, direction, maxDistance, world) {
  const invDir = { x: 1 / direction.x, y: 1 / direction.y, z: 1 / direction.z };
  let stepX = Math.sign(direction.x) || 1;
  let stepY = Math.sign(direction.y) || 1;
  let stepZ = Math.sign(direction.z) || 1;

  let x = Math.floor(origin.x / VOXEL_SIZE);
  let y = Math.floor(origin.y / VOXEL_SIZE);
  let z = Math.floor(origin.z / VOXEL_SIZE);

  let tMaxX = ((stepX > 0 ? (x + 1) : x) * VOXEL_SIZE - origin.x) * invDir.x;
  let tMaxY = ((stepY > 0 ? (y + 1) : y) * VOXEL_SIZE - origin.y) * invDir.y;
  let tMaxZ = ((stepZ > 0 ? (z + 1) : z) * VOXEL_SIZE - origin.z) * invDir.z;

  let tDeltaX = Math.abs(invDir.x * VOXEL_SIZE);
  let tDeltaY = Math.abs(invDir.y * VOXEL_SIZE);
  let tDeltaZ = Math.abs(invDir.z * VOXEL_SIZE);

  let dist = 0;
  const maxSteps = Math.min(512, Math.ceil(maxDistance / VOXEL_SIZE) * 3);
  let normal = { x: 0, y: 0, z: 0 };

  for (let i = 0; i < maxSteps && dist <= maxDistance; i++) {
    const id = world.getVoxel(x, y, z, false);
    if (id !== 0) {
      return {
        hit: true,
        voxel: { x, y, z },
        normal,
        id,
        distance: dist,
      };
    }

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        x += stepX;
        dist = tMaxX;
        tMaxX += tDeltaX;
        normal = { x: -stepX, y: 0, z: 0 };
      } else {
        z += stepZ;
        dist = tMaxZ;
        tMaxZ += tDeltaZ;
        normal = { x: 0, y: 0, z: -stepZ };
      }
    } else {
      if (tMaxY < tMaxZ) {
        y += stepY;
        dist = tMaxY;
        tMaxY += tDeltaY;
        normal = { x: 0, y: -stepY, z: 0 };
      } else {
        z += stepZ;
        dist = tMaxZ;
        tMaxZ += tDeltaZ;
        normal = { x: 0, y: 0, z: -stepZ };
      }
    }
  }

  return { hit: false };
}
