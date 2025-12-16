// Minimal client-side networking for the authoritative WS server.

export class NetClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.handlers = new Map();
    this.peerId = Math.random().toString(36).slice(2, 10);
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
  }

  off(type, fn) {
    this.handlers.get(type)?.delete(fn);
  }

  emit(type, data) {
    this.handlers.get(type)?.forEach((fn) => fn(data));
  }

  connect({ action, code, seed }) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({ action, code, peerId: this.peerId, seed }));
      };
      this.ws.onerror = (e) => reject(e);
      this.ws.onclose = () => this.emit('close');
      this.ws.onmessage = (e) => {
        let msg = null;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        const { type } = msg || {};
        if (type === 'created' || type === 'joined') {
          resolve(msg);
        } else {
          this.emit(type, msg);
        }
      };
    });
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  requestChunk(cx, cy, cz) {
    this.send({ action: 'chunkRequest', payload: { cx, cy, cz } });
  }

  sendEdit(x, y, z, id) {
    this.send({ action: 'edit', payload: { x, y, z, id } });
  }

  sendState(x, y, z) {
    this.send({ action: 'state', payload: { x, y, z } });
  }
}
