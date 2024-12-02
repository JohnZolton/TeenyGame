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
  MintPayload,
} from "@cashu/cashu-ts";
import { Init } from "v8";
import { randomBytes, sign } from "crypto";

const TEENYGAME_NPUB =
  "npub17rsxrp635f6pkc3cldnzckjc9mnzxakptm8arhvk2paqf7ms7kxsvulg2x";
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

  const [otherNpub, setOtherNpub] = useState<string>();
  const [otherName, setOtherName] = useState<string>();
  const [otherImgUrl, setOtherImgUrl] = useState<string>();

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
            type: PeerMessages.initialState,
            data: {
              npub: userNpub,
              name: displayName,
              picUrl: imgUrl,
            },
          }),
        );
      });

      newPeer.on("data", (data: Uint8Array) => {
        const message: ReceivedMessage = JSON.parse(
          new TextDecoder().decode(data),
        ) as ReceivedMessage;

        if (message.type === PeerMessages.initialState) {
          setOtherImgUrl(message.data.picUrl);
          setOtherNpub(message.data.npub);
          setOtherName(message.data.name);
        }
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
        <div>Npub: {userNpub}</div>
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
        <CashuArea
          peer={peerRef.current}
          otherImgUrl={otherImgUrl}
          otherName={otherName}
          otherNpub={otherNpub}
          myNpub={userNpub}
        />
      </div>
    </div>
  );
}

interface CashuAreaProps {
  peer: SimplePeer.Instance | null;
  otherNpub: string | undefined;
  otherName: string | undefined;
  otherImgUrl: string | undefined;
  myNpub: string | null | undefined;
}

interface ReceiveCashMessage {
  type: PeerMessages.sendCash;
  data: {
    token: string;
  };
}
interface InitialMessage {
  type: PeerMessages.initialState;
  data: {
    npub: string;
    name: string;
    picUrl: string;
  };
}

type ReceivedMessage = ReceiveCashMessage | InitialMessage;

enum PeerMessages {
  initialState,
  sendCash,
}
function CashuArea({
  peer,
  otherImgUrl,
  otherNpub,
  otherName,
  myNpub,
}: CashuAreaProps) {
  const [proofs, setProofs] = useState<Proof[]>([]);

  const createLockedEcash = useCallback(async () => {
    if (peer?.connected) {
      const amount = 32;
      const { keep, send } = await wallet.send(amount, proofs);

      if (!myNpub || !otherNpub) return;

      setProofs(keep);

      const secret = CashuMultiSig.createMultiSigSecret({
        basePubkey: TEENYGAME_NPUB,
        requiredSigs: 2,
        locktime: Math.floor(Date.now() / 1000 + 600), //10 minutes
        refundPubkey: myNpub,
        additionalPubkeys: [otherNpub],
      });

      const keysetId = send[0]?.id;
      if (!keysetId) return;
      const { blindedMessage, blindingFactor } =
        CashuMultiSig.createBlindedMessage(amount, keysetId);

      const response = await fetch(`${mintUrl}/v1/mint`, {
        method: "POST",
        body: JSON.stringify({ outputs: [blindedMessage] }),
      });
      interface MintResponse {
        signatures: BlindSignature[];
      }
      const { signatures } = (await response.json()) as MintResponse;
      if (!signatures) return;

      const proof = CashuMultiSig.createProofFromBlindSignature({
        amount,
        keysetId: keysetId,
        mintPublicKey: ProjectivePoint.fromHex(wallet.mintInfo.pubkey),
        blindSignature: signatures[0]!.C_,
        blindingFactor,
        secret,
      });
      return proof;
    }
  }, [peer, proofs, otherNpub, myNpub]);

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

  peer?.on("data", (data: Uint8Array) => {
    void (async () => {
      const message = JSON.parse(
        new TextDecoder().decode(data),
      ) as ReceivedMessage;

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
      <div className="flex flex-col gap-y-2">
        <div className="flex flex-col">
          <div>Name: {otherName}</div>
          <div>Npub: {otherNpub}</div>
        </div>
        <div className="flex flex-col items-center justify-center gap-y-2">
          <Button onClick={() => mintTokens()}>Mint Test Tokens</Button>

          {peer?.connected && (
            <Button onClick={() => sendCash()}>Send Cash</Button>
          )}
          {peer?.connected && (
            <Button onClick={() => createLockedEcash()}>
              Create locked eCash
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function generateRandomString(length: number) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

import { ProjectivePoint } from "@noble/secp256k1";

type BlindedMessage = {
  id: string;
  amount: number; //keyset ID
  B_: string; // hex string of blinded point
};

type BlindSignature = {
  amount: number;
  id: string; //hex  string
  C_: string; //hex string
};

type Proof = {
  id: string;
  amount: number;
  secret: string;
  C: string;
};

class CashuMultiSig {
  static createMultiSigSecret(params: {
    basePubkey: string;
    requiredSigs: number;
    locktime: number;
    refundPubkey: string;
    additionalPubkeys: string[];
  }) {
    const secret = [
      "P2PK",
      {
        nonce: Buffer.from(randomBytes(32).toString("hex")),
        data: params.basePubkey,
        tags: [
          ["n_sigs", params.requiredSigs.toString()],
          ["locktime", params.locktime.toString()],
          ["refund", params.refundPubkey],
          ["pubkeys", ...params.additionalPubkeys],
        ],
      },
    ];
    return JSON.stringify(secret);
  }

  static createBlindedMessage(amount: number, keysetId: string) {
    const secret = randomBytes(32);
    const Y = ProjectivePoint.fromPrivateKey(secret);
    const r = BigInt("0x" + randomBytes(32).toString("hex"));
    const rG = ProjectivePoint.BASE.multiply(r);
    const B_ = Y.add(rG);
    return {
      blindedMessage: {
        amount,
        id: keysetId,
        B_: B_.toHex(true),
      },
      blindingFactor: r,
    };
  }

  static createProofFromBlindSignature(params: {
    amount: number;
    keysetId: string;
    mintPublicKey: ProjectivePoint;
    blindSignature: string;
    blindingFactor: bigint;
    secret: string;
  }) {
    const C_ = ProjectivePoint.fromHex(params.blindSignature);
    const rK = params.mintPublicKey.multiply(params.blindingFactor);
    const C = C_.add(rK.negate());

    return {
      id: params.keysetId,
      amount: params.amount,
      secret: params.secret,
      C: C.toHex(true),
    };
  }
}
