import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class SimplePhysics {
  constructor() {
    this.gravity = 20;
    this.maxFallSpeed = 60;
    // Slightly shrink collider to reduce jitter against blocks
    this.radius = 0.3;
    this.height = 1.7;
    this.stepHeight = 0.6;
  }

  intersectsWorld(pos, world) {
    const eps = 0.02;
    const minX = Math.floor(pos.x - this.radius + eps);
    const maxX = Math.floor(pos.x + this.radius - eps);
    const minY = Math.floor(pos.y + eps);
    const maxY = Math.floor(pos.y + this.height - eps);
    const minZ = Math.floor(pos.z - this.radius + eps);
    const maxZ = Math.floor(pos.z + this.radius - eps);

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (world.isSolid(x, y, z)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  tryStepUp(pos, world, startY) {
    for (let lift = 0.1; lift <= this.stepHeight; lift += 0.1) {
      pos.y = startY + lift;
      if (!this.intersectsWorld(pos, world)) {
        return true;
      }
    }
    pos.y = startY;
    return false;
  }

  step(position, velocity, world, dt) {
    const pos = position.clone();
    const vel = velocity.clone();
    vel.y -= this.gravity * dt;
    if (vel.y < -this.maxFallSpeed) vel.y = -this.maxFallSpeed;

    let grounded = false;

    // Vertical move
    pos.y += vel.y * dt;
    if (this.intersectsWorld(pos, world)) {
      const dir = Math.sign(vel.y) || -1;
      while (this.intersectsWorld(pos, world)) {
        pos.y -= dir * 0.01;
        if (Math.abs(pos.y - position.y) > 4) break;
      }
      if (dir < 0) grounded = true;
      vel.y = 0;
    }

    const groundedForStep = grounded;

    // Horizontal axes
    const moveAxis = (axis) => {
      const delta = vel[axis] * dt;
      if (delta === 0) return;
      const stepSize = 0.05 * Math.sign(delta);
      let remaining = delta;
      while (Math.abs(remaining) > 1e-4) {
        const move = Math.abs(remaining) > Math.abs(stepSize) ? stepSize : remaining;
        const startY = pos.y;
        pos[axis] += move;
        if (this.intersectsWorld(pos, world)) {
          let stepped = false;
          if (groundedForStep) {
            stepped = this.tryStepUp(pos, world, startY);
          }
          if (!stepped) {
            pos[axis] -= move;
            vel[axis] = 0;
            break;
          }
        }
        remaining -= move;
      }
    };

    moveAxis('x');
    moveAxis('z');

    // Ground check after movement
    const groundProbe = pos.clone();
    groundProbe.y -= 0.15;
    grounded = this.intersectsWorld(groundProbe, world);

    return { position: pos, velocity: vel, grounded };
  }
}
