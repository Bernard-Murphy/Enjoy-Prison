"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { gql, useMutation, useSubscription } from "@apollo/client";

const SEND_SIGNAL_MUTATION = gql`
  mutation SendSignalMessage(
    $sessionId: Int!
    $fromPlayerIndex: Int!
    $message: String!
  ) {
    sendSignalMessage(
      sessionId: $sessionId
      fromPlayerIndex: $fromPlayerIndex
      message: $message
    )
  }
`;

const SIGNAL_SUBSCRIPTION = gql`
  subscription SignalMessage($sessionId: Int!) {
    signalMessage(sessionId: $sessionId) {
      sessionId
      fromPlayerIndex
      message
    }
  }
`;

function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  const turnUrl =
    typeof process !== "undefined" && process.env?.NEXT_PUBLIC_TURN_URL;
  const turnUser =
    typeof process !== "undefined" && process.env?.NEXT_PUBLIC_TURN_USERNAME;
  const turnCred =
    typeof process !== "undefined" && process.env?.NEXT_PUBLIC_TURN_CREDENTIAL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: turnUser || undefined,
      credential: turnCred || undefined,
    });
  }
  return servers;
}

export function useWebRTC(
  sessionId: number | null,
  localPlayerIndex: number,
  options?: {
    onMessage?: (data: string) => void;
    onConnectionStateChange?: (state: string) => void;
  },
) {
  const [connected, setConnected] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const onMessageCb = useRef(options?.onMessage);
  onMessageCb.current = options?.onMessage;

  const [sendSignal] = useMutation(SEND_SIGNAL_MUTATION);
  const sendSignalMessage = useCallback(
    (message: object) => {
      if (sessionId == null) return;
      sendSignal({
        variables: {
          sessionId,
          fromPlayerIndex: localPlayerIndex,
          message: JSON.stringify(message),
        },
      });
    },
    [sessionId, localPlayerIndex, sendSignal],
  );
  const sendSignalRef = useRef(sendSignalMessage);
  sendSignalRef.current = sendSignalMessage;

  useSubscription(SIGNAL_SUBSCRIPTION, {
    variables: { sessionId: sessionId ?? 0 },
    skip: sessionId == null,
    onData: ({ data }) => {
      const msg = data?.data?.signalMessage;
      if (!msg || msg.fromPlayerIndex === localPlayerIndex) return;
      let payload: {
        type?: string;
        sdp?: RTCSessionDescriptionInit;
        candidate?: RTCIceCandidateInit;
      };
      try {
        payload = JSON.parse(msg.message || "{}");
      } catch {
        return;
      }
      const pc = pcRef.current;
      if (!pc) return;
      if (payload.type === "offer" && payload.sdp) {
        pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          .then(() => pc.createAnswer())
          .then((answer) => pc.setLocalDescription(answer))
          .then(() => {
            sendSignalRef.current({
              type: "answer",
              sdp: pc.localDescription?.toJSON?.() ?? pc.localDescription,
            });
          })
          .catch((err) => console.error("[useWebRTC] handle offer error", err));
      } else if (payload.type === "answer" && payload.sdp) {
        pc.setRemoteDescription(new RTCSessionDescription(payload.sdp)).catch(
          (err) => console.error("[useWebRTC] set answer error", err),
        );
      } else if (payload.candidate) {
        pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(
          (err) => console.error("[useWebRTC] addIceCandidate error", err),
        );
      }
    },
  });

  useEffect(() => {
    if (sessionId == null) return;
    const isHost = localPlayerIndex === 0;
    const pc = new RTCPeerConnection({
      iceServers: getIceServers(),
    });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignalRef.current({ candidate: e.candidate.toJSON() });
      }
    };

    function setupDataChannel(dc: RTCDataChannel) {
      dcRef.current = dc;
      dc.binaryType = "arraybuffer";
      dc.onmessage = (e) => {
        const cb = onMessageCb.current;
        if (typeof cb === "function" && typeof e.data === "string") {
          cb(e.data);
        }
      };
      dc.onopen = () => setConnected(true);
      dc.onclose = () => setConnected(false);
    }

    if (isHost) {
      const dc = pc.createDataChannel("game", { ordered: true });
      setupDataChannel(dc);
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          sendSignalRef.current({
            type: "offer",
            sdp: pc.localDescription?.toJSON?.() ?? pc.localDescription,
          });
        })
        .catch((err) => console.error("[useWebRTC] createOffer error", err));
    } else {
      pc.ondatachannel = (e) => {
        if (e.channel.label === "game") setupDataChannel(e.channel);
      };
    }

    return () => {
      if (dcRef.current) dcRef.current.close();
      pc.close();
      pcRef.current = null;
      dcRef.current = null;
      setConnected(false);
    };
  }, [sessionId, localPlayerIndex]);

  const send = useCallback((data: string) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      dc.send(data);
    }
  }, []);

  return { send, connected, onMessage: options?.onMessage };
}
