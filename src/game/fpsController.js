import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class FPSController {
  constructor(camera, input, physics) {
    this.camera = camera;
    this.input = input;
    this.physics = physics;

    this.position = new THREE.Vector3(0, 70, 0); // feet position
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.eyeHeight = 1.6;
    this.grounded = false;

    this.walkSpeed = 7;
    this.airControl = 2.5;
    this.accel = 28;
    this.jumpStrength = 7.5;
    this.sensitivity = 0.0018;
    this.friction = 10;
  }

  update(dt, world) {
    const look = this.input.getLookDelta();
    this.yaw -= look.dx * this.sensitivity;
    this.pitch -= look.dy * this.sensitivity;
    const clampPitch = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-clampPitch, Math.min(clampPitch, this.pitch));

    const { forward, strafe } = this.input.getMovement2D();
    const forwardDir = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const rightDir = new THREE.Vector3(forwardDir.z, 0, -forwardDir.x);
    const wishDir = new THREE.Vector3();
    wishDir.addScaledVector(forwardDir, forward);
    wishDir.addScaledVector(rightDir, strafe);
    const sprint = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight') ? 1.6 : 1;
    const maxSpeed = this.walkSpeed * sprint;

    if (wishDir.lengthSq() > 0) {
      wishDir.normalize();
      const control = this.grounded ? this.accel : this.accel * (this.airControl / this.walkSpeed);
      this.velocity.x += wishDir.x * control * dt * maxSpeed;
      this.velocity.z += wishDir.z * control * dt * maxSpeed;

      // Clamp horizontal speed so mid-air acceleration can't grow unbounded.
      const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      if (horizSpeed > maxSpeed) {
        const scale = maxSpeed / horizSpeed;
        this.velocity.x *= scale;
        this.velocity.z *= scale;
      }
    }

    if (this.grounded) {
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, 0, this.friction, dt);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 0, this.friction, dt);
    }

    if (this.input.consumePressed('Space') && this.grounded) {
      this.velocity.y = this.jumpStrength;
      this.grounded = false;
    }

    const result = this.physics.step(this.position, this.velocity, world, dt);
    this.position.copy(result.position);
    this.velocity.copy(result.velocity);
    this.grounded = result.grounded;

    this.camera.position.copy(this.position).add(new THREE.Vector3(0, this.eyeHeight, 0));
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  getEyePosition() {
    return new THREE.Vector3(this.position.x, this.position.y + this.eyeHeight, this.position.z);
  }
}
