import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export const BOMB_ID = 6;

export const MATERIALS = [
  { id: 0, name: 'Air', color: new THREE.Color(0x000000) },
  { id: 1, name: 'Dirt', color: new THREE.Color(0x8b5a2b) },
  { id: 2, name: 'Stone', color: new THREE.Color(0x7f8796) },
  { id: 3, name: 'Wood', color: new THREE.Color(0xb1824a) },
  { id: 4, name: 'Metal', color: new THREE.Color(0x9fb8c6) },
  { id: 5, name: 'Grass', color: new THREE.Color(0x4e9c54) },
  { id: BOMB_ID, name: 'Bomb', color: new THREE.Color(0xff5f52) },
];

export function colorForMaterial(id) {
  const mat = MATERIALS.find((m) => m.id === id);
  return mat ? mat.color : MATERIALS[0].color;
}
