import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { createRenderer, resizeRendererToDisplaySize } from './core/renderer.js';
import { Input } from './core/input.js';
import { Time } from './core/time.js';
import { FPSController } from './game/fpsController.js';
import { HUD } from './game/hud.js';
import { Car } from './game/car.js';
import { Sky } from './game/sky.js';
import { VoxelWorld, CHUNK_SIZE, VOXEL_SIZE, VIEW_DISTANCE_CHUNKS } from './world/voxelWorld.js';
import { raycastVoxel } from './world/raycastVoxel.js';
import { Tools } from './destruction/tools.js';
import { Explosions } from './destruction/explosions.js';
import { SimplePhysics } from './physics/simplePhysics.js';
import { NetClient } from './net/client.js';

const REACH_DISTANCE = 4;
const DEFAULT_FOG_FAR = 180;
const DEFAULT_FOV = 75;
const DEFAULT_SENS = 0.0018;

const canvas = document.getElementById('c');
const hudRoot = document.getElementById('hud-root');
const menuOverlay = document.getElementById('menuOverlay');
const menuResume = document.getElementById('menuResume');
const saveSlotsEl = document.getElementById('saveSlots');
const saveDownload = document.getElementById('saveDownload');
const saveUpload = document.getElementById('saveUpload');
const resetWorldBtn = document.getElementById('resetWorld');
const spawnCarBtn = document.getElementById('spawnCar');
const despawnCarBtn = document.getElementById('despawnCar');
const settingFov = document.getElementById('settingFov');
const settingFovValue = document.getElementById('settingFovValue');
const settingSens = document.getElementById('settingSens');
const settingSensValue = document.getElementById('settingSensValue');
const settingFog = document.getElementById('settingFog');
const settingFogValue = document.getElementById('settingFogValue');
const worldSeedInput = document.getElementById('worldSeedInput');
const worldSeedRandom = document.getElementById('worldSeedRandom');
const worldSeedCreate = document.getElementById('worldSeedCreate');
const currentWorldLabel = document.getElementById('currentWorldLabel');
const serverUrlInput = document.getElementById('serverUrl');
const sessionCodeInput = document.getElementById('sessionCode');
const sessionRandom = document.getElementById('sessionRandom');
const sessionHost = document.getElementById('sessionHost');
const sessionJoin = document.getElementById('sessionJoin');
const sessionLeave = document.getElementById('sessionLeave');
const sessionStatus = document.getElementById('sessionStatus');

const renderer = createRenderer(canvas);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbce6ff);
scene.fog = new THREE.Fog(scene.background, 80, DEFAULT_FOG_FAR);

const camera = new THREE.PerspectiveCamera(DEFAULT_FOV, window.innerWidth / window.innerHeight, 0.1, 220);

const ambient = new THREE.AmbientLight(0xcad6ff, 0.55);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
dirLight.position.set(40, 60, 10);
scene.add(dirLight);

const input = new Input(canvas, null);
const time = new Time();
let currentWorldSeed = 'default';
let world = new VoxelWorld(scene, currentWorldSeed);
const physics = new SimplePhysics();
const controller = new FPSController(camera, input, physics);
const hud = new HUD(hudRoot);
const tools = new Tools();
let explosions = new Explosions(scene, world);
let car = null;
let inCar = false;
let thirdPersonCar = true;
let sky = new Sky(scene);
let carLookYaw = 0;
let carLookPitch = 0;

const highlight = (() => {
  const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE));
  const mat = new THREE.LineBasicMaterial({
    color: 0xffff99,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.3,
  });
  const mesh = new THREE.LineSegments(geo, mat);
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
})();

setWorldSeedUI(currentWorldSeed);

const netState = {
  client: null,
  connected: false,
  code: '',
  seed: '',
  pendingChunks: new Set(),
  remotePlayers: new Map(),
  lastStateSent: 0,
};

const remotePlayerGeo = new THREE.BoxGeometry(0.8, 1.8, 0.8);
const remotePlayerMat = new THREE.MeshStandardMaterial({
  color: 0x7bc1ff,
  emissive: 0x0b2238,
  transparent: true,
  opacity: 0.7,
  flatShading: true,
});

let menuOpen = false;
let hasLockedPointer = false;

function formatTime(ts) {
  if (!ts) return 'Empty';
  const d = new Date(ts);
  return d.toLocaleString();
}

function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultServerUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname || 'localhost';
  return `${proto}//${host}:8090`;
}

function setSessionStatus(text) {
  if (sessionStatus) sessionStatus.textContent = text;
}

function setWorldSeedUI(seed) {
  if (currentWorldLabel) currentWorldLabel.textContent = seed;
  if (worldSeedInput) worldSeedInput.value = seed;
}

async function switchWorld(seed) {
  const targetSeed = seed && seed.trim() ? seed.trim() : randomSeed();
  currentWorldSeed = targetSeed;

  if (world) {
    await world.flushSaves();
    for (const [, chunk] of world.chunks) {
      if (chunk.mesh && chunk.mesh.parent) scene.remove(chunk.mesh);
      chunk.dispose();
    }
    world.chunks.clear();
  }

  if (explosions) {
    for (const bomb of explosions.bombs) {
      if (bomb.mesh && bomb.mesh.parent) scene.remove(bomb.mesh);
    }
    for (const d of explosions.debris) {
      if (d.mesh && d.mesh.parent) scene.remove(d.mesh);
      if (d.mesh) {
        d.mesh.geometry.dispose();
        if (Array.isArray(d.mesh.material)) {
          d.mesh.material.forEach((m) => m.dispose());
        } else if (d.mesh.material) {
          d.mesh.material.dispose();
        }
      }
    }
  }

  world = new VoxelWorld(scene, currentWorldSeed);
  explosions = new Explosions(scene, world);
  controller.position.set(0, 70, 0);
  controller.velocity.set(0, 0, 0);
  world.updateVisible(controller.position);
  world.processRemeshQueue(16);
  setWorldSeedUI(currentWorldSeed);
  if (car) {
    car.dispose();
    car = null;
    inCar = false;
  }
  if (sky) sky.dispose();
  // recreate sky to reset fog color if needed
  sky = new Sky(scene);
  attachWorldHooks();
  queueSaveSettings();
  await refreshSlots();
  updateHUD();
}

function clearRemotePlayers() {
  for (const [, data] of netState.remotePlayers) {
    if (data.mesh && data.mesh.parent) {
      data.mesh.parent.remove(data.mesh);
    }
  }
  netState.remotePlayers.clear();
}

function ensureRemotePlayer(peerId) {
  if (netState.remotePlayers.has(peerId)) return netState.remotePlayers.get(peerId);
  const mesh = new THREE.Mesh(remotePlayerGeo, remotePlayerMat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  scene.add(mesh);
  const data = { mesh };
  netState.remotePlayers.set(peerId, data);
  return data;
}

function attachWorldHooks() {
  if (!world) return;
  world.onEdit = netState.connected ? handleLocalEdit : null;
  world.onChunkCreated = netState.connected
    ? (chunk) => requestChunkFromServer(chunk.cx, chunk.cy, chunk.cz)
    : null;
}

function requestChunkFromServer(cx, cy, cz) {
  if (!netState.connected || !netState.client) return;
  const key = `${cx},${cy},${cz}`;
  if (netState.pendingChunks.has(key)) return;
  netState.pendingChunks.add(key);
  netState.client.requestChunk(cx, cy, cz);
}

function handleLocalEdit(edit) {
  if (!netState.connected || !netState.client) return;
  netState.client.sendEdit(edit.x, edit.y, edit.z, edit.id);
}

function base64ToUint8(base64) {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    arr[i] = bin.charCodeAt(i);
  }
  return arr;
}

function handleChunkData({ chunk }) {
  if (!chunk || !world) return;
  const key = `${chunk.cx},${chunk.cy},${chunk.cz}`;
  netState.pendingChunks.delete(key);
  const data = base64ToUint8(chunk.data);
  const target = world.ensureChunk(chunk.cx, chunk.cy, chunk.cz);
  target.replaceData(data);
  world.scheduleRemesh(target);
  world.storage.queueSave(chunk.cx, chunk.cy, chunk.cz, target.data);
}

function handleRemoteEdit({ x, y, z, id }) {
  if (!world) return;
  world.setVoxel(x, y, z, id, null, { source: 'remote' });
}

function handleRemoteState({ peerId, x, y, z }) {
  if (!netState.connected || !netState.client) return;
  if (peerId === netState.client.peerId) return;
  const player = ensureRemotePlayer(peerId);
  player.mesh.position.set(x, y, z);
}

function hydrateRemotePlayers(list = []) {
  clearRemotePlayers();
  for (const [peerId, pos] of list) {
    if (peerId === netState.client?.peerId) continue;
    const player = ensureRemotePlayer(peerId);
    if (pos) {
      player.mesh.position.set(pos.x, pos.y, pos.z);
    }
  }
}

function disconnectSession(reason = '') {
  if (netState.client && netState.client.ws) {
    netState.client.ws.onclose = null;
    netState.client.ws.close();
  }
  netState.client = null;
  netState.connected = false;
  netState.code = '';
  netState.seed = '';
  netState.pendingChunks.clear();
  netState.lastStateSent = 0;
  clearRemotePlayers();
  attachWorldHooks();
  setSessionStatus(reason ? `Offline (${reason})` : 'Offline');
}

async function connectSession(kind) {
  const code = sessionCodeInput?.value.trim() || 'room1';
  const url = serverUrlInput?.value.trim() || defaultServerUrl();
  setSessionStatus('Connecting...');
  disconnectSession();

  const client = new NetClient(url);
  netState.client = client;

  client.on('close', () => disconnectSession('Disconnected'));
  client.on('chunkData', handleChunkData);
  client.on('edit', handleRemoteEdit);
  client.on('state', handleRemoteState);
  client.on('players', ({ players }) => hydrateRemotePlayers(players));
  client.on('playerJoined', ({ peerId }) => {
    if (peerId !== client.peerId) ensureRemotePlayer(peerId);
  });

  try {
    const res = await client.connect({ action: kind, code, seed: currentWorldSeed });
    netState.code = code;
    netState.seed = res.seed || currentWorldSeed;
    netState.pendingChunks.clear();
    clearRemotePlayers();
    await switchWorld(netState.seed);
    netState.connected = true;
    attachWorldHooks();
    for (const [, chunk] of world.chunks) {
      requestChunkFromServer(chunk.cx, chunk.cy, chunk.cz);
    }
    setSessionStatus(`Connected to ${code} (seed ${netState.seed})`);
  } catch (err) {
    console.error('Failed to connect', err);
    disconnectSession('Failed');
  }
}

function uiSettings() {
  return {
    fov: settingFov ? Number(settingFov.value) || DEFAULT_FOV : DEFAULT_FOV,
    sens: settingSens ? Number(settingSens.value) || DEFAULT_SENS : DEFAULT_SENS,
    fog: settingFog ? Number(settingFog.value) || DEFAULT_FOG_FAR : DEFAULT_FOG_FAR,
  };
}

async function refreshSlots() {
  if (!saveSlotsEl) return;
  const slots = await world.storage.listSlots();
  const slotMap = new Map(slots.map((s) => [s.slot, s.savedAt]));
  saveSlotsEl.innerHTML = '';
  for (let i = 1; i <= 3; i++) {
    const savedAt = slotMap.get(i);
    const slot = document.createElement('div');
    slot.className = 'save-slot';
    slot.innerHTML = `
      <div class="slot-title">Slot ${i}</div>
      <div class="slot-meta">${formatTime(savedAt)}</div>
      <div class="slot-buttons">
        <button class="primary" data-slot="${i}" data-action="save">Save</button>
        <button data-slot="${i}" data-action="load"${savedAt ? '' : ' disabled'}>Load</button>
      </div>
    `;
    saveSlotsEl.appendChild(slot);
  }
}

function applySettingsFromUI() {
  const settings = uiSettings();
  if (settingFov) {
    camera.fov = settings.fov;
    camera.updateProjectionMatrix();
    if (settingFovValue) settingFovValue.textContent = settings.fov.toFixed(0);
  }
  if (settingSens) {
    controller.sensitivity = settings.sens;
    if (settingSensValue) settingSensValue.textContent = settings.sens.toFixed(4);
  }
  if (settingFog) {
    if (scene.fog) scene.fog.far = settings.fog;
    if (settingFogValue) settingFogValue.textContent = settings.fog.toFixed(0);
  }
}

function openMenu() {
  menuOpen = true;
  input.setPointerLockEnabled(false);
  input.setOverlaySuppressed(true);
  if (document.pointerLockElement) document.exitPointerLock();
  if (menuOverlay) menuOverlay.style.display = 'grid';
  applySettingsFromUI();
  refreshSlots();
}

function closeMenu() {
  menuOpen = false;
  input.setPointerLockEnabled(true);
  if (menuOverlay) menuOverlay.style.display = 'none';
  input.setOverlaySuppressed(false);
  input.requestPointerLock();
}

function toolTip(tool) {
  if (tool === 'Blaster') return 'Left click: carve wider craters';
  if (tool === 'Bomb') return 'E to place, F to detonate';
  return 'Left click: dig, Right click: build';
}

function updateHUD() {
  hud.update({
    toolName: tools.currentToolName(),
    materialName: tools.currentMaterial().name,
    bombs: explosions.bombs.length,
    fps: time.smoothFPS,
    tip: toolTip(tools.currentToolName()),
    position: controller.position,
    vehicle: inCar ? 'Car' : 'On foot',
    speed: inCar && car ? car.velocity.length() : 0,
  });
}

updateHUD();

let settingsSaveTimer = null;
function queueSaveSettings() {
  if (settingsSaveTimer) clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(async () => {
    settingsSaveTimer = null;
    await world.storage.saveSettings({ ...uiSettings(), worldSeed: currentWorldSeed });
  }, 200);
}

function setSettingsUI(settings) {
  if (settingFov) settingFov.value = settings.fov;
  if (settingFovValue) settingFovValue.textContent = settings.fov.toFixed(0);
  if (settingSens) settingSens.value = settings.sens;
  if (settingSensValue) settingSensValue.textContent = settings.sens.toFixed(4);
  if (settingFog) settingFog.value = settings.fog;
  if (settingFogValue) settingFogValue.textContent = settings.fog.toFixed(0);
  applySettingsFromUI();
}

if (settingFov) {
  settingFov.addEventListener('input', () => {
    applySettingsFromUI();
    queueSaveSettings();
  });
}
if (settingSens) {
  settingSens.addEventListener('input', () => {
    applySettingsFromUI();
    queueSaveSettings();
  });
}
if (settingFog) {
  settingFog.addEventListener('input', () => {
    applySettingsFromUI();
    queueSaveSettings();
  });
}
if (menuResume) {
  menuResume.addEventListener('click', () => closeMenu());
}
if (saveDownload) {
  saveDownload.addEventListener('click', async () => {
    await world.flushSaves();
    await world.storage.downloadExport();
  });
}
if (saveUpload) {
  saveUpload.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await world.flushSaves();
    await world.storage.loadFromFile(file);
    await world.reloadFromStorage(controller.position);
    await refreshSlots();
    saveUpload.value = '';
  });
}
if (resetWorldBtn) {
  resetWorldBtn.addEventListener('click', async () => {
    const first = window.confirm('Reset current world? This removes all saved chunks for this seed.');
    if (!first) return;
    const second = window.confirm('Do you really want to reset the world? This cannot be undone.');
    if (!second) return;
    await world.flushSaves();
    await world.storage.clearWorld(currentWorldSeed);
    await switchWorld(currentWorldSeed);
  });
}
if (saveSlotsEl) {
  saveSlotsEl.addEventListener('click', async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.action;
    const slot = Number(target.dataset.slot);
    if (!slot || !action) return;
    if (action === 'save') {
      await world.flushSaves();
      const payload = await world.storage.exportWorld();
      await world.storage.saveSlot(slot, payload);
      await refreshSlots();
    } else if (action === 'load') {
      await world.flushSaves();
      const payload = await world.storage.loadSlot(slot);
      if (payload) {
        await world.storage.importWorld(payload);
        await world.reloadFromStorage(controller.position);
      }
      await refreshSlots();
    }
  });
}

if (spawnCarBtn) {
  spawnCarBtn.addEventListener('click', () => {
    if (car) {
      car.dispose();
      car = null;
      inCar = false;
    }
    car = new Car(scene, world, controller.position.clone());
    updateHUD();
  });
}

if (despawnCarBtn) {
  despawnCarBtn.addEventListener('click', () => {
    if (car) {
      car.dispose();
      car = null;
      inCar = false;
      updateHUD();
    }
  });
}

refreshSlots();

(async () => {
  const saved = await world.storage.loadSettings();
  const seed = saved?.worldSeed ?? currentWorldSeed;
  if (settingFov && saved?.fov) settingFov.value = saved.fov;
  if (settingSens && saved?.sens) settingSens.value = saved.sens;
  if (settingFog && saved?.fog) settingFog.value = saved.fog;
  setSettingsUI({
    fov: settingFov ? Number(settingFov.value) || DEFAULT_FOV : DEFAULT_FOV,
    sens: settingSens ? Number(settingSens.value) || DEFAULT_SENS : DEFAULT_SENS,
    fog: settingFog ? Number(settingFog.value) || DEFAULT_FOG_FAR : DEFAULT_FOG_FAR,
  });
  setWorldSeedUI(seed);
  if (seed !== currentWorldSeed) {
    await switchWorld(seed);
  }
})();

if (worldSeedRandom) {
  worldSeedRandom.addEventListener('click', () => {
    const s = randomSeed();
    if (worldSeedInput) worldSeedInput.value = s;
  });
}

if (worldSeedCreate) {
  worldSeedCreate.addEventListener('click', async () => {
    const seed = worldSeedInput ? worldSeedInput.value : '';
    await switchWorld(seed || randomSeed());
  });
}

if (serverUrlInput && !serverUrlInput.value) {
  serverUrlInput.value = defaultServerUrl();
}
setSessionStatus('Offline');
if (sessionRandom) {
  sessionRandom.addEventListener('click', () => {
    const code = randomSeed();
    if (sessionCodeInput) sessionCodeInput.value = code;
  });
}
if (sessionHost) {
  sessionHost.addEventListener('click', () => connectSession('create'));
}
if (sessionJoin) {
  sessionJoin.addEventListener('click', () => connectSession('join'));
}
if (sessionLeave) {
  sessionLeave.addEventListener('click', () => disconnectSession('Left session'));
}

// If pointer lock is lost (e.g., user presses Escape), automatically open the menu after the first lock.
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    hasLockedPointer = true;
  } else if (hasLockedPointer && !menuOpen) {
    openMenu();
  }
});

// Persist chunk edits when leaving/pausing
window.addEventListener('beforeunload', () => {
  world.flushSaves();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) world.flushSaves();
});

// Optional helpers for manual export/import from the browser console
window.exportWorld = async () => world.storage.downloadExport();
window.importWorldFile = async (file) => {
  await world.storage.loadFromFile(file);
  await world.reloadFromStorage(controller.position);
};

function castFromCamera() {
  const origin = controller.getEyePosition();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  return raycastVoxel(origin, dir, REACH_DISTANCE, world);
}

function handlePrimary() {
  if (!input.pointerLocked) return;
  const hit = castFromCamera();
  if (tools.applyPrimary(world, hit)) {
    updateHUD();
  }
}

function handleSecondary() {
  if (!input.pointerLocked) return;
  const hit = castFromCamera();
  const collider = {
    min: controller.position.clone().add(new THREE.Vector3(-0.35, 0, -0.35)),
    max: controller.position.clone().add(new THREE.Vector3(0.35, controller.eyeHeight, 0.35)),
  };
  if (tools.applySecondary(world, hit, collider)) {
    updateHUD();
  }
}

window.addEventListener('mousedown', (e) => {
  if (!input.pointerLocked || inCar) return;
  if (e.button === 0) {
    handlePrimary();
  } else if (e.button === 2) {
    handleSecondary();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (menuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
    return;
  }

  if (menuOpen) return;

  if (e.code === 'Digit1') tools.selectTool(0);
  if (e.code === 'Digit2') tools.selectTool(1);
  if (e.code === 'Digit3') tools.selectTool(2);

  if (e.code === 'BracketLeft') {
    tools.cycleMaterial(-1);
  }
  if (e.code === 'BracketRight') {
    tools.cycleMaterial(1);
  }

  if (e.code === 'KeyE' && tools.currentToolName() === 'Bomb') {
    const hit = castFromCamera();
    if (hit && hit.hit) {
      const target = {
        x: hit.voxel.x + hit.normal.x,
        y: hit.voxel.y + hit.normal.y,
        z: hit.voxel.z + hit.normal.z,
      };
      explosions.placeBomb(target);
    }
  }

  if (e.code === 'KeyF' && tools.currentToolName() === 'Bomb') {
    const count = explosions.detonateAll();
    if (count > 0) updateHUD();
  }

  if (e.code === 'KeyV') {
    if (inCar) {
      inCar = false;
      if (car) controller.position.copy(car.position).add(new THREE.Vector3(0, 1.6, 0));
      controller.velocity.set(0, 0, 0);
      controller.yaw = carLookYaw;
      controller.pitch = carLookPitch;
      updateHUD();
      return;
    } else if (car) {
      const dist = controller.position.distanceTo(car.position);
      if (dist < 3) {
        inCar = true;
        controller.velocity.set(0, 0, 0);
        carLookYaw = car.yaw;
        carLookPitch = controller.pitch;
        updateHUD();
        return;
      }
    }
  }

  if (e.code === 'KeyC' && inCar) {
    thirdPersonCar = !thirdPersonCar;
  }

  updateHUD();
});

window.addEventListener('resize', () => resizeRendererToDisplaySize(renderer, camera));

function animate() {
  requestAnimationFrame(animate);
  time.update();

  if (input.pointerLocked) {
    if (inCar) {
      if (car) {
        const look = input.getLookDelta();
        carLookYaw -= look.dx * controller.sensitivity;
        carLookPitch -= look.dy * controller.sensitivity;
        const clampPitch = Math.PI / 2 - 0.05;
        carLookPitch = Math.max(-clampPitch, Math.min(clampPitch, carLookPitch));

        car.update(time.delta, input);
        controller.position.copy(car.position);
        if (thirdPersonCar) {
          const behind = new THREE.Vector3(Math.sin(carLookYaw), 0, Math.cos(carLookYaw));
          const camPos = car.position.clone()
            .add(new THREE.Vector3(0, 1.8, 0))
            .addScaledVector(behind, 3)
            .add(new THREE.Vector3(0, 1.2, 0));
          camera.position.copy(camPos);
        } else {
          camera.position.copy(car.getSeatPosition());
        }
        camera.rotation.set(carLookPitch, carLookYaw, 0, 'YXZ');
      } else {
        inCar = false;
      }
    } else {
      controller.update(time.delta, world);
    }
  }

  if (netState.connected && netState.client) {
    netState.lastStateSent += time.delta;
    if (netState.lastStateSent > 0.12) {
      netState.client.sendState(controller.position.x, controller.position.y, controller.position.z);
      netState.lastStateSent = 0;
    }
  }

  world.updateVisible(controller.position);
  world.processRemeshQueue(2);
  explosions.update(time.delta);
  sky.update(time.delta, camera);
  resizeRendererToDisplaySize(renderer, camera);
  renderer.render(scene, camera);
  updateHUD();

  const hit = input.pointerLocked ? castFromCamera() : null;
  if (hit && hit.hit) {
    highlight.visible = true;
    highlight.position.set(
      (hit.voxel.x + 0.5) * VOXEL_SIZE,
      (hit.voxel.y + 0.5) * VOXEL_SIZE,
      (hit.voxel.z + 0.5) * VOXEL_SIZE
    );
  } else {
    highlight.visible = false;
  }
}

// Kick off initial chunk build around spawn
world.updateVisible(controller.position);
world.processRemeshQueue(16);
animate();

// Dev info in console
console.log(`Chunk size ${CHUNK_SIZE}, voxel ${VOXEL_SIZE}, view ${VIEW_DISTANCE_CHUNKS}, seed ${currentWorldSeed}`);
