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
import {
  CashuMint,
  CashuWallet,
  getEncodedTokenV4,
  MintQuoteState,
  Proof,
} from "@cashu/cashu-ts";

const mintUrl = "https://testnut.cashu.space";
const mint = new CashuMint(mintUrl);
const wallet = new CashuWallet(mint);
await wallet.loadMint();
//localStorage.setItem("wallet-Keys", wallet.keys) ??

interface GameRoomProps {
  gameid: string;
}

export default function GameRoom({ gameid }: GameRoomProps) {
  const [connected, setConnected] = useState(false);
  const [userNpub, setUserNpub] = useState<string | null>();
  const displayName = localStorage.getItem("displayName");
  const imgUrl = localStorage.getItem("profileImage");
  const [channel, setChannel] = useState<Channel | null>();
  const [isFirstPlayer, setIsFirstPlayer] = useState(false);
  const { mutate: leaveGame } = api.game.leaveGame.useMutation();
  const peerRef = useRef<SimplePeer.Instance | null>(null);

  useEffect(() => {
    const handleUnload = () => {
      leaveGame({ gameId: gameid, userId: userNpub ?? "" });
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

  useEffect(() => {
    const storedNpub = localStorage.getItem("userNpub");
    if (storedNpub) {
      setUserNpub(storedNpub);
    } else {
      // Set a default or fetch from a server
      setUserNpub(isFirstPlayer ? "Player 1" : "Player 2");
    }
  }, [isFirstPlayer]);

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
          JSON.stringify({
            type: "initialState",
            data: {
              npub: userNpub,
              name: displayName,
              picUrl: imgUrl,
            },
          }),
        );
      });

      type PeerError = Error;

      newPeer.on("error", (err: PeerError) => {
        console.error("❌ Peer error:", err);
      });

      newPeer.on("close", () => {
        console.log("💔 Peer connection closed");
        setConnected(false);
      });

      peerRef.current = newPeer;
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
        console.log("count: ", members.count);

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
    });

    setChannel(channel);

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      if (peerRef.current) peerRef.current.destroy();
    };
  }, [gameid, isFirstPlayer, createPeer]);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="mb-4">
        <div>Channel: {channel?.name}</div>
        <div>Role: {isFirstPlayer ? "First Player" : "Second Player"}</div>
        <div>Status: {connected ? "🟢 Connected" : "🔴 Disconnected"}</div>
      </div>
      <FlappyBirdGame
        peer={peerRef.current}
        userNpub={userNpub ?? (isFirstPlayer ? "Player 1" : "Player 2")}
        displayName={displayName}
        imgUrl={imgUrl}
      />
      <div className="my-12 flex flex-col">
        <CashuArea peer={peerRef.current} />
      </div>
    </div>
  );
}

interface CashuAreaProps {
  peer: SimplePeer.Instance | null;
}

function CashuArea({ peer }: CashuAreaProps) {
  const [proofs, setProofs] = useState<Proof[]>([]);

  enum PeerMessages {
    init,
    sendCash,
  }

  const sendCash = useCallback(async () => {
    if (peer?.connected) {
      const { keep, send } = await wallet.send(32, proofs);
      const token = getEncodedTokenV4({ mint: mintUrl, proofs: send });

      peer.send(
        JSON.stringify({
          type: PeerMessages.sendCash,
          data: {
            token: token,
          },
        }),
      );
      setProofs(keep);
    }
  }, [peer, proofs]);

  interface ReceiveCashMessage {
    type: PeerMessages.sendCash;
    data: {
      token: string;
    };
  }
  peer?.on("data", (data: Uint8Array) => {
    void (async () => {
      const message = JSON.parse(
        new TextDecoder().decode(data),
      ) as ReceiveCashMessage;
      if (message.type === PeerMessages.sendCash) {
        const receivedProofs = await wallet.receive(message.data.token);
        setProofs((prev) => [...prev, ...receivedProofs]);
      }
    });
  });

  useEffect(() => {
    console.log(`current proofs: `, proofs);
  }, [proofs]);

  async function mintTokens() {
    const mintQuote = await wallet.createMintQuote(64);
    const mintQuoteChecked = await wallet.checkMintQuote(mintQuote.quote);
    if (mintQuoteChecked.state === MintQuoteState.PAID) {
      const proofs = await wallet.mintProofs(64, mintQuote.quote);
      console.log(proofs);
      setProofs(proofs);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-y-2">
      <div>
        {proofs.map((proof, index) => (
          <div key={`proof-${index}`}>eCash: {proof.amount}</div>
        ))}
      </div>
      <Button onClick={() => mintTokens()}>Mint Test Tokens</Button>
      {peer?.connected && <Button onClick={() => sendCash()}>Send Cash</Button>}
    </div>
  );
}
