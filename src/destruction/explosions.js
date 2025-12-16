import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { BOMB_ID } from '../world/materials.js';
import { VOXEL_SIZE } from '../world/chunk.js';

const bombGeometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
const bombMaterial = new THREE.MeshStandardMaterial({
  color: 0xff5f52,
  emissive: 0x331100,
  roughness: 0.3,
  depthWrite: true,
  depthTest: true,
});
const debrisGeometry = new THREE.BoxGeometry(0.18, 0.18, 0.18);
const debrisMaterial = new THREE.MeshStandardMaterial({ color: 0xffe1a8, roughness: 0.6, metalness: 0.05 });

export class Explosions {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.bombs = [];
    this.debris = [];
  }

  placeBomb(voxel) {
    if (this.world.getVoxel(voxel.x, voxel.y, voxel.z, false) !== 0) return false;

    const position = new THREE.Vector3(
      (voxel.x + 0.5) * VOXEL_SIZE,
      (voxel.y + 0.5) * VOXEL_SIZE,
      (voxel.z + 0.5) * VOXEL_SIZE
    );

    const mesh = new THREE.Mesh(bombGeometry, bombMaterial);
    mesh.position.copy(position);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.scene.add(mesh);

    if (!this.world.setVoxel(voxel.x, voxel.y, voxel.z, BOMB_ID)) {
      this.scene.remove(mesh);
      return false;
    }
    this.bombs.push({ voxel: { ...voxel }, position, mesh });
    return true;
  }

  detonateAll() {
    if (this.bombs.length === 0) return 0;
    let detonated = 0;
    for (const bomb of this.bombs) {
      this.world.setVoxel(bomb.voxel.x, bomb.voxel.y, bomb.voxel.z, 0);
      this.applyExplosion(bomb.position, 3.6);
      if (bomb.mesh.parent) this.scene.remove(bomb.mesh);
      detonated++;
    }
    this.bombs.length = 0;
    return detonated;
  }

  applyExplosion(center, radius) {
    const r2 = radius * radius;
    const minX = Math.floor(center.x - radius);
    const maxX = Math.floor(center.x + radius);
    const minY = Math.floor(center.y - radius);
    const maxY = Math.floor(center.y + radius);
    const minZ = Math.floor(center.z - radius);
    const maxZ = Math.floor(center.z + radius);
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - center.x;
          const dy = y - center.y;
          const dz = z - center.z;
          if (dx * dx + dy * dy + dz * dz <= r2) {
            this.world.setVoxel(x, y, z, 0);
          }
        }
      }
    }

    this.spawnDebris(center);
  }

  spawnDebris(center) {
    const count = 20;
    const mesh = new THREE.InstancedMesh(debrisGeometry.clone(), debrisMaterial.clone(), count);
    const velocities = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.3, Math.random() - 0.5).normalize();
      const speed = 6 + Math.random() * 6;
      velocities.push(dir.multiplyScalar(speed));
      dummy.position.copy(center).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.3) * 0.5, (Math.random() - 0.5) * 0.5));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    this.debris.push({ mesh, velocities, lifetime: 1.5 });
  }

  update(dt) {
    const gravity = 9.8;
    const dummy = new THREE.Object3D();
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.lifetime -= dt;
      if (d.lifetime <= 0) {
        if (d.mesh.parent) this.scene.remove(d.mesh);
        d.mesh.geometry.dispose();
        if (Array.isArray(d.mesh.material)) {
          d.mesh.material.forEach((m) => m.dispose());
        } else {
          d.mesh.material.dispose();
        }
        this.debris.splice(i, 1);
        continue;
      }

      for (let j = 0; j < d.velocities.length; j++) {
        const vel = d.velocities[j];
        vel.y -= gravity * dt;
        vel.multiplyScalar(1 - 0.6 * dt);
        d.mesh.getMatrixAt(j, dummy.matrix);
        dummy.position.setFromMatrixPosition(dummy.matrix);
        dummy.position.addScaledVector(vel, dt);
        dummy.updateMatrix();
        d.mesh.setMatrixAt(j, dummy.matrix);
      }
      d.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
