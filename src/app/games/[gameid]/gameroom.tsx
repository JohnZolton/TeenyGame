"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import SimplePeer from "simple-peer";
import { pusher, pusherClient } from "~/lib/pusher";
import FlappyBirdGame from "./flappy-bird";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Channel } from "pusher-js";
import Pusher from "pusher-js/types/src/core/pusher";
import Members from "pusher-js";
import { create } from "domain";

interface GameRoomProps {
  gameid: string;
}

export default function GameRoom({ gameid }: GameRoomProps) {
  const [peer, setPeer] = useState<SimplePeer.Instance | null>(null);
  const [connected, setConnected] = useState(false);
  const [localPos, setLocalPos] = useState({ y: 250 });
  const [remotePos, setRemotePos] = useState({ y: 250 });
  const [userNpub, setUserNpub] = useState<string | null>();
  const [displayName, setDisplayName] = useState<string | null>();
  const [imgUrl, setImgUrl] = useState<string | null>();
  const [channel, setChannel] = useState<Channel | null>();
  const [isFirstPlayer, setIsFirstPlayer] = useState(false);
  const { mutate: leaveGame } = api.game.leaveGame.useMutation();
  const peerRef = useRef<SimplePeer.Instance | null>(null);

  useEffect(() => {
    const handleUnload = () => {
      leaveGame({ gameId: parseInt(gameid), userId: userNpub ?? "" });
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [gameid, leaveGame, userNpub]);

  // Set initial player role
  useEffect(() => {
    setIsFirstPlayer(window.location.hash === "#init");
  }, []);

  // Create and manage peer connection
  const createPeer = useCallback(
    (initiator: boolean) => {
      console.log(`Creating peer as ${initiator ? "initiator" : "receiver"}`);

      // Clean up any existing peer
      if (peerRef.current) {
        peerRef.current.destroy();
      }

      const newPeer = new SimplePeer({
        initiator,
        trickle: true,
      });

      // When we have connection data to send to the other peer
      newPeer.on("signal", (signalData) => {
        console.log("🚦 Generated signal data to send:", signalData);
        channel?.trigger("client-signal", {
          signalData,
          fromFirstPlayer: isFirstPlayer,
        });
      });

      newPeer.on("connect", () => {
        console.log("🎉 Peer connection established!");
        setConnected(true);
        newPeer.send(
          "Hello from " + (isFirstPlayer ? "first" : "second") + " player!",
        );
      });

      type PeerData = string | Uint8Array;
      type PeerError = Error;
      newPeer.on("data", (data: PeerData) => {
        console.log("📨 Received data:", data);
      });

      newPeer.on("error", (err: PeerError) => {
        console.error("❌ Peer error:", err);
      });

      newPeer.on("close", () => {
        console.log("💔 Peer connection closed");
        setConnected(false);
      });

      peerRef.current = newPeer;
      setPeer(newPeer);
      return newPeer;
    },
    [channel, isFirstPlayer],
  );

  // Set up Pusher channel and handle peer connection
  useEffect(() => {
    console.log("Setting up presence channel...");
    const channel = pusherClient.subscribe(`presence-game-${gameid}`);

    channel.bind(
      "pusher:subscription_succeeded",
      (members: { count: number; me: Members }) => {
        console.log("✅ Channel subscribed");

        // If we're the first player and there are 2 members, initiate the connection
        if (isFirstPlayer && members.count === 2) {
          console.log("Creating initiator peer");
          createPeer(true);
        } else {
          createPeer(false);
        }
      },
    );

    channel.bind("pusher:member_added", (member: Members) => {
      console.log("👋 Member joined:", member);
      // If we're the second player, create our peer (non-initiator)
      if (isFirstPlayer) {
        console.log("Second player creating receiver peer");
        createPeer(true);
      }
    });

    // Handle incoming WebRTC signals
    interface SignalData {
      fromFirstPlayer: boolean;
      signalData: SimplePeer.SignalData;
    }
    channel.bind("client-signal", (data: SignalData) => {
      console.log(
        "📡 Received signal from",
        data.fromFirstPlayer ? "first" : "second",
        "player",
      );

      // Only process signals from the other player
      if (data.fromFirstPlayer !== isFirstPlayer && peerRef.current) {
        console.log("Processing signal data");
        peerRef.current.signal(data.signalData);
      }
    });

    channel.bind("pusher:member_removed", () => {
      console.log("👋 Member left");
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      setConnected(false);
      setPeer(null);
    });

    setChannel(channel);

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      if (peerRef.current) peerRef.current.destroy();
    };
  }, [gameid, isFirstPlayer, createPeer]);

  // Test button to verify connection
  const sendTestMessage = () => {
    if (peerRef.current?.connected) {
      peerRef.current.send("Test message at " + new Date().toISOString());
    }
  };

  return (
    <div className="relative h-[500px] w-full bg-sky-200">
      <div className="mb-4">
        <div>Channel: {channel?.name}</div>
        <div>Role: {isFirstPlayer ? "First Player" : "Second Player"}</div>
        <div>Status: {connected ? "🟢 Connected" : "🔴 Disconnected"}</div>
      </div>
      <Button onClick={() => sendTestMessage()}>test</Button>
    </div>
  );
}
