import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = false;
  return renderer;
}

export function resizeRendererToDisplaySize(renderer, camera) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const needResize = renderer.domElement.width !== width || renderer.domElement.height !== height;
  if (needResize) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}
