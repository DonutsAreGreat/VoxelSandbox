import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { MIN_HEIGHT, MAX_HEIGHT } from '../world/constants.js';

export class Car {
  constructor(scene, world, position = new THREE.Vector3(0, 70, 0)) {
    this.scene = scene;
    this.world = world;
    this.position = position.clone();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.rideHeight = 1.2;
    this.seatOffset = new THREE.Vector3(0, 1.1, 0);
    this.mesh = this.buildMesh();
    this.scene.add(this.mesh);
    this.syncMesh();
  }

  buildMesh() {
    const group = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(1.6, 0.8, 3);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3f4c6b, roughness: 0.6, metalness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    group.add(body);

    const cabinGeo = new THREE.BoxGeometry(1.2, 0.7, 1.5);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x6178a0, roughness: 0.55, metalness: 0.25, transparent: true, opacity: 0.85 });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.1, -0.2);
    group.add(cabin);

    const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.9, metalness: 0.1 });
    const wheelPositions = [
      [-0.8, 0.3, 1.1],
      [0.8, 0.3, 1.1],
      [-0.8, 0.3, -1.1],
      [0.8, 0.3, -1.1],
    ];
    for (const wp of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wp[0], wp[1], wp[2]);
      group.add(wheel);
    }

    return group;
  }

  syncMesh() {
    this.mesh.position.copy(this.position);
    this.mesh.rotation.set(0, this.yaw, 0);
  }

  groundHeight(x, z) {
    for (let y = MAX_HEIGHT; y >= MIN_HEIGHT; y--) {
      if (this.world.isSolid(Math.floor(x), y, Math.floor(z))) {
        return y + 1; // surface is top of block
      }
    }
    return MIN_HEIGHT;
  }

  getSeatPosition() {
    const seat = this.seatOffset.clone();
    seat.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    return this.position.clone().add(seat);
  }

  update(dt, input) {
    const forward = input.isDown('KeyW') ? 1 : input.isDown('KeyS') ? -1 : 0;
    const steer = input.isDown('KeyA') ? 1 : input.isDown('KeyD') ? -1 : 0;

    const maxSpeed = 18;
    const accel = 26;
    const friction = 4;
    const turnSpeed = 2.2;

    if (forward !== 0) {
      const dir = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      this.velocity.addScaledVector(dir, forward * accel * dt);
    }

    // steering scales with speed
    const speed = this.velocity.length();
    if (steer !== 0 && speed > 0.2) {
      this.yaw += steer * turnSpeed * dt * Math.min(1, speed / maxSpeed);
    }

    // clamp speed
    if (speed > maxSpeed) {
      this.velocity.multiplyScalar(maxSpeed / speed);
    }

    // friction
    this.velocity.multiplyScalar(Math.max(0, 1 - friction * dt));

    // move
    this.position.addScaledVector(this.velocity, dt);

    // snap to ground
    const groundY = this.groundHeight(this.position.x, this.position.z);
    const targetY = groundY + this.rideHeight;
    this.position.y = targetY;
    this.velocity.y = 0;

    this.syncMesh();
  }

  dispose() {
    if (this.mesh && this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
    this.mesh.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
}
