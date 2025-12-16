const DB_NAME = 'voxel-sandbox';
const DB_VERSION = 3;
const STORE_NAME = 'chunks';
const SAVE_STORE = 'saves';
const SETTINGS_STORE = 'settings';

function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(str) {
  const binary = atob(str);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class ChunkStorage {
  constructor(worldId = 'default') {
    this.worldId = worldId;
    this.dbPromise = this.openDB();
    this.saveQueue = new Map();
    this.flushTimer = null;
  }

  key(cx, cy, cz) {
    return `world:${this.worldId}:${cx},${cy},${cz}`;
  }

  openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(SAVE_STORE)) {
          db.createObjectStore(SAVE_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
    });
  }

  async getChunk(cx, cy, cz) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(this.key(cx, cy, cz));
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const value = req.result;
        if (!value || !value.data) {
          resolve(null);
          return;
        }
        resolve(new Uint8Array(value.data));
      };
    });
  }

  queueSave(cx, cy, cz, data) {
    if (!data) return;
    this.saveQueue.set(this.key(cx, cy, cz), new Uint8Array(data));
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flushQueued();
      }, 250);
    }
  }

  async flushQueued() {
    if (this.saveQueue.size === 0) return;
    const entries = Array.from(this.saveQueue.entries());
    this.saveQueue.clear();
    const db = await this.dbPromise;
    await Promise.all(
      entries.map(
        ([key, data]) =>
          new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put({ key, data });
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve();
          })
      )
    );
  }

  async exportWorld() {
    const db = await this.dbPromise;
    const prefix = `world:${this.worldId}:`;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const chunks = [];
      const cursorReq = store.openCursor();
      cursorReq.onerror = () => reject(cursorReq.error);
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) {
          resolve({ worldId: this.worldId, chunks });
          return;
        }
        if (cursor.key.startsWith(prefix)) {
          const coords = cursor.key.slice(prefix.length).split(',').map(Number);
          chunks.push({
            cx: coords[0],
            cy: coords[1],
            cz: coords[2],
            data: bufferToBase64(cursor.value.data),
          });
        }
        cursor.continue();
      };
    });
  }

  async importWorld(payload) {
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!parsed || !Array.isArray(parsed.chunks)) return;
    const db = await this.dbPromise;
    const targetWorld = this.worldId;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await Promise.all(
      parsed.chunks.map(
        (chunk) =>
          new Promise((resolve, reject) => {
            const key = `world:${targetWorld}:${chunk.cx},${chunk.cy},${chunk.cz}`;
            const data = base64ToBuffer(chunk.data);
            const req = store.put({ key, data });
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve();
          })
      )
    );
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async loadFromFile(file) {
    const text = await file.text();
    return this.importWorld(text);
  }

  async downloadExport(filename = 'voxel-world.json') {
    const data = await this.exportWorld();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  slotKey(slot) {
    return `world:${this.worldId}:slot:${slot}`;
  }

  async listSlots() {
    const db = await this.dbPromise;
    const prefix = `world:${this.worldId}:slot:`;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SAVE_STORE, 'readonly');
      const store = tx.objectStore(SAVE_STORE);
      const items = [];
      const req = store.openCursor();
      req.onerror = () => reject(req.error);
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) {
          resolve(items);
          return;
        }
        if (cursor.key.startsWith(prefix)) {
          const slot = Number(cursor.key.slice(prefix.length));
          items.push({ slot, savedAt: cursor.value.savedAt || null });
        }
        cursor.continue();
      };
    });
  }

  async saveSlot(slot, payload) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SAVE_STORE, 'readwrite');
      const store = tx.objectStore(SAVE_STORE);
      const req = store.put({ key: this.slotKey(slot), payload, savedAt: Date.now() });
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  async loadSlot(slot) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SAVE_STORE, 'readonly');
      const store = tx.objectStore(SAVE_STORE);
      const req = store.get(this.slotKey(slot));
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        resolve(req.result ? req.result.payload : null);
      };
    });
  }

  async deleteSlot(slot) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SAVE_STORE, 'readwrite');
      const store = tx.objectStore(SAVE_STORE);
      const req = store.delete(this.slotKey(slot));
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  async clearWorld(targetWorld = this.worldId) {
    const db = await this.dbPromise;
    const chunkPrefix = `world:${targetWorld}:`;
    const slotPrefix = `world:${targetWorld}:slot:`;

    const deleteByPrefix = (storeName, prefix) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.openCursor();
        req.onerror = () => reject(req.error);
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) {
            resolve();
            return;
          }
          if (cursor.key.startsWith(prefix)) {
            store.delete(cursor.key);
          }
          cursor.continue();
        };
      });

    await Promise.all([deleteByPrefix(STORE_NAME, chunkPrefix), deleteByPrefix(SAVE_STORE, slotPrefix)]);
  }

  settingsKey() {
    return 'global:settings';
  }

  async saveSettings(settings) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE, 'readwrite');
      const store = tx.objectStore(SETTINGS_STORE);
      const req = store.put({ key: this.settingsKey(), settings, savedAt: Date.now() });
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  async loadSettings() {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE, 'readonly');
      const store = tx.objectStore(SETTINGS_STORE);
      const req = store.get(this.settingsKey());
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        resolve(req.result ? req.result.settings : null);
      };
    });
  }
}
