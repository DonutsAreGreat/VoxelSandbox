// Minimal WebRTC signaling relay for the Voxel Sandbox.
// Usage:
//   npm install ws
//   node signaling-server.js --port 8080
//
// Protocol (plain WebSocket):
//   Client sends JSON: { code: "<room>", peerId: "<unique-client-id>", payload: {...} }
//   The first peer to join a code is treated as "host". All messages for a code are broadcast
//   to every other peer in that code. You carry SDP offers/answers/ICE in `payload`.
//
// This server is intentionally lightweight: no auth, no persistence, in-memory only.

import { WebSocketServer } from 'ws';
import http from 'http';

const port = Number(process.env.PORT || process.argv[2] || 8080);

// roomCode -> Set of peers
const rooms = new Map();

function cleanupPeer(peer) {
  if (!peer.room) return;
  const set = rooms.get(peer.room);
  if (set) {
    set.delete(peer);
    if (set.size === 0) {
      rooms.delete(peer.room);
    }
  }
  peer.room = null;
}

const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.room = null;
  ws.peerId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const { code, peerId, payload } = msg || {};
      if (!code || !peerId || !payload) return;

      // join room
      if (!ws.room) {
        ws.room = code;
        ws.peerId = peerId;
        if (!rooms.has(code)) rooms.set(code, new Set());
        rooms.get(code).add(ws);
      }

      const peers = rooms.get(code);
      if (!peers) return;

      const forward = JSON.stringify({ from: peerId, payload });
      for (const p of peers) {
        if (p !== ws && p.readyState === p.OPEN) {
          p.send(forward);
        }
      }
    } catch (err) {
      console.warn('Bad message', err);
    }
  });

  ws.on('close', () => cleanupPeer(ws));
  ws.on('error', () => cleanupPeer(ws));
});

server.listen(port, () => {
  console.log(`Signaling server listening on :${port}`);
});
