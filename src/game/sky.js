import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.time = 0;
    this.clouds = [];
    this.buildDome();
    this.buildSun();
    this.buildClouds();
    this.scene.add(this.group);
  }

  buildDome() {
    const geo = new THREE.SphereGeometry(800, 32, 24);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x87cefa) },
        bottomColor: { value: new THREE.Color(0xb3e5ff) },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPosition;
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        void main() {
          float h = normalize(vWorldPosition).y * 0.5 + 0.5;
          vec3 col = mix(bottomColor, topColor, smoothstep(0.0, 1.0, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.group.add(this.dome);
  }

  buildSun() {
    const geo = new THREE.PlaneGeometry(40, 40);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        color: { value: new THREE.Color(0xfff6c0) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 color;
        void main() {
          vec2 p = vUv - 0.5;
          float d = length(p) * 2.0;
          float alpha = smoothstep(1.0, 0.6, d);
          vec3 col = mix(color * 1.5, color, d);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    this.sun = new THREE.Mesh(geo, mat);
    this.sun.position.set(120, 180, -80);
    this.group.add(this.sun);
  }

  buildClouds() {
    const count = 40;
    for (let i = 0; i < count; i++) {
      const w = 30 + Math.random() * 40;
      const h = 8 + Math.random() * 8;
      const geo = new THREE.PlaneGeometry(w, h);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.26 + Math.random() * 0.12,
        depthWrite: false,
      });
      const cloud = new THREE.Mesh(geo, mat);
      cloud.position.set((Math.random() - 0.5) * 500, 120 + Math.random() * 30, (Math.random() - 0.5) * 500);
      cloud.rotation.y = Math.random() * Math.PI * 2;
      cloud.rotation.x = -0.05;
      cloud.userData.speed = 2 + Math.random() * 2;
      this.clouds.push(cloud);
      this.group.add(cloud);
    }
  }

  update(dt, camera) {
    this.time += dt;
    // keep dome centered
    this.group.position.copy(camera.position);
    // face sun to camera
    if (this.sun) {
      this.sun.lookAt(camera.position);
    }
    // move clouds slowly and wrap
    for (const c of this.clouds) {
      c.position.x += Math.sin(this.time * 0.05) * c.userData.speed * dt;
      c.position.z += Math.cos(this.time * 0.05) * c.userData.speed * dt;
      const r = 260;
      if (c.position.x > r) c.position.x = -r;
      if (c.position.x < -r) c.position.x = r;
      if (c.position.z > r) c.position.z = -r;
      if (c.position.z < -r) c.position.z = r;
      c.lookAt(camera.position.x, c.position.y, camera.position.z);
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      }
    });
  }
}
