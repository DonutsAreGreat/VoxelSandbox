// Minimal multi-session authoritative server (shared world, chunk and edits).
// Run with: npm install ws
//           node server.js --port 8090

import http from 'http';
import https from 'https';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import { SessionManager } from './server/sessionManager.js';

function parsePort(defaultPort = 8090) {
  const envPort = Number(process.env.PORT);
  if (!Number.isNaN(envPort) && envPort > 0) return envPort;

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--port' || arg === '-p') {
      const maybe = Number(args[i + 1]);
      if (!Number.isNaN(maybe) && maybe >= 0 && maybe < 65536) {
        return maybe;
      }
    } else if (!arg.startsWith('-')) {
      const maybe = Number(arg);
      if (!Number.isNaN(maybe) && maybe >= 0 && maybe < 65536) {
        return maybe;
      }
    }
  }

  return defaultPort;
}

const PORT = parsePort(8090);
const MAX_SESSIONS = 3;
const sessions = new SessionManager(MAX_SESSIONS);

function loadTLS() {
  const args = process.argv.slice(2);
  let keyPath = process.env.SSL_KEY;
  let certPath = process.env.SSL_CERT;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--key') keyPath = args[i + 1];
    if (arg === '--cert') certPath = args[i + 1];
  }
  if (keyPath && certPath) {
    try {
      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      };
    } catch (err) {
      console.warn('Could not read TLS key/cert, falling back to WS:', err.message);
    }
  }
  return null;
}

function cleanup(ws) {
  if (!ws.sessionCode) return;
  const session = sessions.getSession(ws.sessionCode);
  if (session) {
    session.players.delete(ws.peerId);
    if (session.peers) {
      session.peers.delete(ws);
    }
    sessions.removeEmptySession(ws.sessionCode);
  }
  ws.sessionCode = null;
}

function ensurePeersSet(session) {
  if (!session.peers) session.peers = new Set();
  return session.peers;
}

function broadcast(session, message, exclude) {
  const peers = ensurePeersSet(session);
  const data = JSON.stringify(message);
  for (const p of peers) {
    if (p !== exclude && p.readyState === p.OPEN) {
      p.send(data);
    }
  }
}

const tlsOptions = loadTLS();
const server = tlsOptions ? https.createServer(tlsOptions) : http.createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.sessionCode = null;
  ws.peerId = null;

  ws.on('message', (data) => {
    let msg = null;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    const { action, code, seed, peerId, payload } = msg || {};

    if (action === 'create') {
      if (!code || !peerId) return;
      const session = sessions.createSession(code, seed || 'default');
      if (!session) {
        ws.send(JSON.stringify({ type: 'error', reason: 'session_unavailable' }));
        return;
      }
      ws.sessionCode = code;
      ws.peerId = peerId;
      ensurePeersSet(session).add(ws);
      session.players.set(peerId, { x: 0, y: 70, z: 0 });
      ws.send(JSON.stringify({ type: 'created', code, seed: session.seed }));
      return;
    }

    if (action === 'join') {
      const session = code ? sessions.getSession(code) : null;
      if (!session || !peerId) {
        ws.send(JSON.stringify({ type: 'error', reason: 'not_found' }));
        return;
      }
      ws.sessionCode = code;
      ws.peerId = peerId;
      ensurePeersSet(session).add(ws);
      session.players.set(peerId, { x: 0, y: 70, z: 0 });
      ws.send(JSON.stringify({ type: 'joined', code, seed: session.seed }));
      // send peers list
      ws.send(JSON.stringify({ type: 'players', players: Array.from(session.players.entries()) }));
      broadcast(session, { type: 'playerJoined', peerId }, ws);
      return;
    }

    if (!ws.sessionCode) return;
    const session = sessions.getSession(ws.sessionCode);
    if (!session) return;

    // chunk request
    if (action === 'chunkRequest' && payload) {
      const { cx, cy, cz } = payload;
      const ch = session.world.serializeChunk(cx, cy, cz);
      ws.send(JSON.stringify({ type: 'chunkData', chunk: { cx, cy, cz, data: ch.data.toString('base64') } }));
      return;
    }

    // edit voxel
    if (action === 'edit' && payload) {
      const { x, y, z, id } = payload;
      if (session.world.setVoxel(x, y, z, id)) {
        broadcast(session, { type: 'edit', x, y, z, id }, null);
      }
      return;
    }

    // player state update
    if (action === 'state' && payload) {
      const { x, y, z } = payload;
      session.players.set(ws.peerId, { x, y, z });
      broadcast(session, { type: 'state', peerId: ws.peerId, x, y, z }, ws);
      return;
    }
  });

  ws.on('close', () => cleanup(ws));
  ws.on('error', () => cleanup(ws));
});

server.listen(PORT, () => {
  const scheme = tlsOptions ? 'wss' : 'ws';
  console.log(`Game session server listening on ${scheme}://0.0.0.0:${PORT} (max sessions ${MAX_SESSIONS})`);
});

wss.on('error', (err) => {
  console.error('WebSocket server error:', err);
});
