
import { Device } from "mediasoup-client";
import { io } from "socket.io-client";

const SERVER_URL =
  import.meta.env.VITE_SIGNALING_SERVER_URL || "http://signaling-server.cluesteam.com";

let socket = null;
let device = null;
let sendTransport = null;
let recvTransport = null;

let localProducers = new Map();
let remoteConsumers = new Map();
let peerInfo = new Map();
let callbacks = {};

let joining = false;
let leaving = false;

function emitAck(event, payload = {}) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error("Signaling server is not connected."));
      return;
    }

    socket.emit(event, payload, (response) => {
      if (!response) {
        reject(new Error(`${event}: server returned no response.`));
        return;
      }

      if (response.ok === false) {
        reject(new Error(response.error || `${event} failed.`));
        return;
      }

      resolve(response);
    });
  });
}

function getPayload(response) {
  // Supports server responses wrapped as { ok: true, params: {...} }
  // as well as responses returned directly.
  return response?.params ?? response;
}

function notifyRemoteTrackClosed(consumer) {
  if (!consumer) return;

  const metadata = remoteConsumers.get(consumer.id);
  if (!metadata) return;

  callbacks.onRemoteTrackClosed?.({
    peerId: metadata.peerId,
    username: metadata.username,
    producerId: metadata.producerId,
    consumerId: consumer.id,
    track: consumer.track,
  });

  remoteConsumers.delete(consumer.id);
}

async function createWebRtcTransport(direction) {
  const response = await emitAck("createWebRtcTransport", { direction });
  const params = getPayload(response);

  if (!params?.id) {
    throw new Error(`Invalid ${direction} transport response.`);
  }

  const transport =
    direction === "send"
      ? device.createSendTransport(params)
      : device.createRecvTransport(params);

  transport.on("connect", ({ dtlsParameters }, callback, errback) => {
    emitAck("connectTransport", {
      transportId: transport.id,
      dtlsParameters,
    })
      .then(() => callback())
      .catch(errback);
  });

  if (direction === "send") {
    transport.on(
      "produce",
      ({ kind, rtpParameters, appData }, callback, errback) => {
        emitAck("produce", {
          transportId: transport.id,
          kind,
          rtpParameters,
          appData,
        })
          .then((response) => {
            const result = getPayload(response);

            if (!result?.id) {
              throw new Error("Server did not return a producer ID.");
            }

            callback({ id: result.id });
          })
          .catch(errback);
      }
    );
  }

  transport.on("connectionstatechange", (state) => {
    console.log(`${direction} transport state:`, state);

    if (state === "failed" || state === "closed") {
      console.warn(`${direction} transport is ${state}.`);
    }
  });

  return transport;
}

async function publishLocalTracks(localStream) {
  if (!localStream || !sendTransport) return;

  const tracks = localStream.getTracks();

  for (const track of tracks) {
    // Avoid publishing the same track twice.
    const alreadyPublished = [...localProducers.values()].some(
      (producer) => producer.track === track && !producer.closed
    );

    if (alreadyPublished) continue;

    const producer = await sendTransport.produce({
      track,
      appData: { source: track.kind },
    });

    localProducers.set(producer.id, producer);

    producer.on("transportclose", () => {
      localProducers.delete(producer.id);
    });

    producer.on("trackended", () => {
      console.log(`Local ${track.kind} track ended.`);
    });
  }
}

async function consumeRemoteProducer({
  producerId,
  peerId,
  username,
}) {
  if (!recvTransport || !device || leaving) return;

  // Ignore duplicate notifications for the same producer.
  if (
    [...remoteConsumers.values()].some(
      (item) => item.producerId === producerId
    )
  ) {
    return;
  }

  try {
    const response = await emitAck("consume", {
      transportId: recvTransport.id,
      producerId,
      rtpCapabilities: device.rtpCapabilities,
    });

    const params = getPayload(response);

    if (!params?.id || !params?.producerId || !params?.rtpParameters) {
      throw new Error("Invalid consumer parameters returned by server.");
    }

    const consumer = await recvTransport.consume({
      id: params.id,
      producerId: params.producerId,
      kind: params.kind,
      rtpParameters: params.rtpParameters,
      appData: { peerId, username },
    });

    const actualPeerId = params.peerId || peerId;
    const actualUsername =
      username ||
      peerInfo.get(actualPeerId)?.username ||
      "Participant";

    remoteConsumers.set(consumer.id, {
      consumer,
      peerId: actualPeerId,
      username: actualUsername,
      producerId,
    });

    consumer.on("transportclose", () => {
      notifyRemoteTrackClosed(consumer);
    });

    consumer.on("producerclose", () => {
      notifyRemoteTrackClosed(consumer);
    });

    // Notify Room.jsx that a remote audio/video track is available.
    callbacks.onRemoteTrack?.({
      peerId: actualPeerId,
      username: actualUsername,
      producerId,
      consumerId: consumer.id,
      track: consumer.track,
    });

    // Server-side consumers are initially paused until resumed.
    await emitAck("resumeConsumer", {
      consumerId: consumer.id,
    });
  } catch (error) {
    console.error("Failed to consume remote producer:", producerId, error);
  }
}

function handleNewProducer(data) {
  if (!data?.producerId || !data?.peerId) return;

  const username =
    data.username ||
    peerInfo.get(data.peerId)?.username ||
    "Participant";

  if (!peerInfo.has(data.peerId)) {
    peerInfo.set(data.peerId, { username });
  }

  consumeRemoteProducer({
    producerId: data.producerId,
    peerId: data.peerId,
    username,
  });
}

function handleProducerClosed(data) {
  if (!data) return;

  for (const [consumerId, metadata] of remoteConsumers) {
    const matchesProducer =
      metadata.producerId === data.producerId;

    const matchesConsumer =
      data.consumerId && consumerId === data.consumerId;

    if (matchesProducer || matchesConsumer) {
      notifyRemoteTrackClosed(metadata.consumer);
    }
  }
}

function handlePeerLeft({ peerId } = {}) {
  if (!peerId) return;

  for (const [consumerId, metadata] of remoteConsumers) {
    if (metadata.peerId === peerId) {
      notifyRemoteTrackClosed(metadata.consumer);
    }
  }

  peerInfo.delete(peerId);
  callbacks.onPeerLeft?.({ peerId });
}

function registerSocketListeners() {
  socket.on("newProducer", handleNewProducer);
  socket.on("producerClosed", handleProducerClosed);
  socket.on("peerLeft", handlePeerLeft);

  socket.on("peerJoined", (data) => {
    if (data?.peerId) {
      peerInfo.set(data.peerId, {
        username: data.username || "Participant",
      });
    }

    callbacks.onPeerJoined?.(data);
  });

  socket.on("consumerClosed", (data) => {
    if (!data) return;

    for (const [consumerId, metadata] of remoteConsumers) {
      if (
        consumerId === data.consumerId ||
        metadata.producerId === data.producerId
      ) {
        notifyRemoteTrackClosed(metadata.consumer);
      }
    }
  });

  socket.on("connect_error", (error) => {
    console.error("Signaling connection error:", error.message);
  });
}

export async function joinConference({
  username,
  localStream,
  onRemoteTrack,
  onRemoteTrackClosed,
  onPeerJoined,
  onPeerLeft,
}) {
  if (joining) {
    throw new Error("Already joining the conference.");
  }

  if (socket?.connected && device && sendTransport && recvTransport) {
    return;
  }

  joining = true;
  leaving = false;

  callbacks = {
    onRemoteTrack,
    onRemoteTrackClosed,
    onPeerJoined,
    onPeerLeft,
  };

  try {
    socket = io(SERVER_URL, {
      autoConnect: false,
      reconnection: false,
      timeout: 10000,
    });

    registerSocketListeners();

    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
      socket.connect();
    });

    console.log("Connected to signaling server:", socket.id);

    const joinResponse = await emitAck("joinRoom", {
      username: username?.trim() || "Participant",
    });

    const roomData = getPayload(joinResponse);

    if (!roomData?.routerRtpCapabilities) {
      throw new Error("Server did not return router RTP capabilities.");
    }

    device = new Device();

    await device.load({
      routerRtpCapabilities: roomData.routerRtpCapabilities,
    });

    // Remember existing participants before consuming their producers.
    const existingPeers = roomData.peers || [];

    for (const peer of existingPeers) {
      peerInfo.set(peer.peerId, {
        username: peer.username || "Participant",
      });
    }

    sendTransport = await createWebRtcTransport("send");
    recvTransport = await createWebRtcTransport("recv");

    // Publish local audio and video.
    await publishLocalTracks(localStream);

    // Consume producers that existed before we joined.
    for (const peer of existingPeers) {
      for (const producer of peer.producers || []) {
        await consumeRemoteProducer({
          producerId: producer.producerId,
          peerId: peer.peerId,
          username: peer.username,
        });
      }
    }

    console.log("Joined DC Conference Call.");
  } catch (error) {
    console.error("Unable to join conference:", error);

    await leaveConference();

    throw error;
  } finally {
    joining = false;
  }
}

export async function setProducerEnabled(kind, enabled) {
  const producer = [...localProducers.values()].find(
    (item) => item.kind === kind && !item.closed
  );

  if (!producer) return;

  try {
    await emitAck(enabled ? "resumeProducer" : "pauseProducer", {
      producerId: producer.id,
    });
  } catch (error) {
    console.error(`Unable to update ${kind} producer:`, error);
  }
}

export async function leaveConference() {
  if (leaving) return;

  leaving = true;

  try {
    if (socket?.connected) {
      try {
        await emitAck("leaveRoom");
      } catch (error) {
        console.warn("Could not signal leaveRoom:", error.message);
      }
    }

    for (const { consumer } of remoteConsumers.values()) {
      try {
        consumer.close();
      } catch { }
    }

    for (const producer of localProducers.values()) {
      try {
        producer.close();
      } catch { }
    }

    remoteConsumers.clear();
    localProducers.clear();
    peerInfo.clear();

    try {
      sendTransport?.close();
    } catch { }

    try {
      recvTransport?.close();
    } catch { }

    sendTransport = null;
    recvTransport = null;
    device = null;

    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
  } finally {
    callbacks = {};
    leaving = false;
  }
}
