// Lightweight WebRTC data channel scaffolding.
// You must supply a signaling transport (e.g., fetch/websocket) to move SDP/ICE between peers.

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478?transport=udp' },
];

function createPeer(onData, sendSignal, isHost) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  let channel = null;

  const ensureChannelHandlers = (ch) => {
    ch.onmessage = (e) => onData?.(e.data);
  };

  if (isHost) {
    channel = pc.createDataChannel('game');
    channel.onopen = () => console.log('[p2p] data channel open');
    ensureChannelHandlers(channel);
  } else {
    pc.ondatachannel = (e) => {
      channel = e.channel;
      channel.onopen = () => console.log('[p2p] data channel open');
      ensureChannelHandlers(channel);
    };
  }

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      sendSignal({ type: 'ice', candidate: e.candidate });
    }
  };

  const handleSignal = async (msg) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'offer' && !isHost) {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.desc));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal({ type: 'answer', desc: pc.localDescription });
    } else if (msg.type === 'answer' && isHost) {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.desc));
    } else if (msg.type === 'ice' && msg.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
      } catch (err) {
        console.warn('Failed to add ICE candidate', err);
      }
    }
  };

  const startHost = async () => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal({ type: 'offer', desc: pc.localDescription });
  };

  return {
    pc,
    get channel() {
      return channel;
    },
    handleSignal,
    startHost,
    close() {
      if (channel) channel.close();
      pc.close();
    },
  };
}

// Host side: call createHostPeer, provide sendSignal that delivers messages to guests via your signaling service.
export function createHostPeer(onData, sendSignal) {
  const peer = createPeer(onData, sendSignal, true);
  peer.start = peer.startHost;
  return peer;
}

// Guest side: call createGuestPeer, then feed it host's offer/ice via handleSignal; it will send answer/ice back through sendSignal.
export function createGuestPeer(onData, sendSignal) {
  return createPeer(onData, sendSignal, false);
}
