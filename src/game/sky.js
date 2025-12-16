import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.time = 0;
    this.buildDome();
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

  update(dt, camera) {
    this.time += dt;
    // keep dome centered
    this.group.position.copy(camera.position);
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
