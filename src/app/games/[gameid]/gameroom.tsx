"use client";
import { useEffect, useState } from "react";
import SimplePeer from "simple-peer";
import { pusher, pusherClient } from "~/lib/pusher";
import FlappyBirdGame from "./flappy-bird";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Channel } from "pusher-js";
import Pusher from "pusher-js/types/src/core/pusher";
import Members from "pusher-js";

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

  const { mutate: leaveGame } = api.game.leaveGame.useMutation();

  useEffect(() => {
    const handleUnload = () => {
      leaveGame({ gameId: parseInt(gameid), userId: userNpub ?? "" });
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [gameid, leaveGame, userNpub]);

  useEffect(() => {
    console.log(
      "Attempting to subscribe to channel:",
      `presence-game-${gameid}`,
    );

    const channel = pusherClient.subscribe(`presence-game-${gameid}`);

    // Log subscription attempt
    channel.bind("pusher:subscription_pending", () => {
      console.log("Subscription pending...");
    });

    // Log successful subscription
    channel.bind("pusher:subscription_succeeded", (members: Members) => {
      console.log("Successfully subscribed!");
      console.log("Current members:", members);
    });

    // Log subscription errors
    channel.bind("pusher:subscription_error", (error: Error) => {
      console.error("Subscription error:", error);
    });

    channel.bind("pusher:member_added", (member: Members) => {
      console.log("Member joined:", member);
    });

    channel.bind("pusher:member_removed", (member: Members) => {
      console.log("Member left:", member);
    });

    type ClientTestData = {
      msg: string;
      timestamp: number;
      sender: string;
    };
    channel.bind("client-test", (data: ClientTestData) => {
      console.log("Received message:", data);
    });

    // Log general connection state
    pusherClient.connection.bind(
      "state_change",
      (states: { previous: string; current: string }) => {
        console.log(
          "Connection state changed:",
          states.previous,
          "->",
          states.current,
        );
      },
    );

    setChannel(channel);

    return () => {
      console.log("Cleaning up channel subscription");
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, [gameid]);

  function handleButtonClick() {
    console.log("clicked");
    if (channel) {
      try {
        channel.trigger("client-test", {
          msg: "hello there",
          timestamp: Date.now(),
          sender: displayName ?? "unknown",
        });
        console.log("Message sent");
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  }

  return (
    <div className="relative h-[500px] w-full bg-sky-200">
      <Button onClick={() => handleButtonClick()}>test</Button>
      <div>{channel?.name}</div>
      {connected ? (
        <div>
          {/* Local player (red circle) */}
          <div
            className="absolute h-8 w-8 rounded-full bg-red-500"
            style={{ top: `${localPos.y}px`, left: "100px" }}
          />

          {/* Remote player (blue circle) */}
          <div
            className="absolute h-8 w-8 rounded-full bg-blue-500"
            style={{ top: `${remotePos.y}px`, left: "300px" }}
          />

          <div className="absolute left-4 top-4 text-sm">
            Use Up/Down arrows to move
          </div>
        </div>
      ) : (
        <div className="inset-0 flex items-center justify-center">
          <p className="text-xl">Connecting to peer...</p>
        </div>
      )}
    </div>
  );
}
