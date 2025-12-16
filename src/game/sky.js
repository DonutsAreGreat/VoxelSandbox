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
    const geo = new THREE.SphereGeometry(1200, 32, 24);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x8ccfff) },
        midColor: { value: new THREE.Color(0x98d8ff) },
        bottomColor: { value: new THREE.Color(0xbce6ff) },
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
        uniform vec3 midColor;
        uniform vec3 bottomColor;
        void main() {
          float h = normalize(vWorldPosition).y * 0.5 + 0.5;
          vec3 col = mix(bottomColor, midColor, smoothstep(0.0, 0.4, h));
          col = mix(col, topColor, smoothstep(0.4, 1.0, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.dome.renderOrder = -50;
    this.group.add(this.dome);
  }

  buildSun() {
    const geo = new THREE.PlaneGeometry(18, 18);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
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
          float alpha = smoothstep(1.0, 0.4, d);
          vec3 col = mix(color * 1.1, color, d);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    this.sun = new THREE.Mesh(geo, mat);
    this.sunDir = new THREE.Vector3(0.3, 0.65, -0.5).normalize();
    this.sun.position.copy(this.sunDir).multiplyScalar(600);
    this.sun.renderOrder = -40;
    this.group.add(this.sun);
  }

  buildClouds() {
    const count = 18;
    for (let i = 0; i < count; i++) {
      const w = 40 + Math.random() * 50;
      const h = 16 + Math.random() * 10;
      const geo = new THREE.PlaneGeometry(w, h);
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          color: { value: new THREE.Color(0xffffff) },
          opacity: { value: 0.18 + Math.random() * 0.08 },
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
          uniform float opacity;
          void main() {
            vec2 p = vUv - 0.5;
            float d = length(p) * 2.0;
            float a = smoothstep(1.0, 0.4, d);
            gl_FragColor = vec4(color, opacity * a);
          }
        `,
      });
      const cloud = new THREE.Mesh(geo, mat);
      cloud.position.set((Math.random() - 0.5) * 500, 140 + Math.random() * 20, (Math.random() - 0.5) * 500);
      cloud.rotation.y = Math.random() * Math.PI * 2;
      cloud.rotation.x = -0.05;
      cloud.userData.speed = 0.4 + Math.random() * 0.5;
      cloud.renderOrder = -30;
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
      c.position.z += Math.cos(this.time * 0.04) * c.userData.speed * dt;
      const r = 520;
      if (c.position.x > r) c.position.x = -r;
      if (c.position.x < -r) c.position.x = r;
      if (c.position.z > r) c.position.z = -r;
      if (c.position.z < -r) c.position.z = r;
      c.quaternion.copy(camera.quaternion); // billboard toward camera
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
