"use client";
import SimplePeer from "simple-peer";

import { useEffect, useRef, useState, useCallback } from "react";
import { Players, PlayerState } from "./gameroom";

interface FlappyBirdGameProps {
  localPos: PlayerState;
  remotePos: Players;
  setLocalPos: (pos: PlayerState) => void;
  peer: SimplePeer.Instance | null;
  connected: boolean;
  userNpub: string | null;
}

const FlappyBirdGame = ({
  localPos,
  remotePos,
  setLocalPos,
  peer,
  connected,
  userNpub,
}: FlappyBirdGameProps) => {
  const [birdPosition, setBirdPosition] = useState(localPos.y);
  const [gameStarted, setGameStarted] = useState(false);
  const [velocity, setVelocity] = useState(0);
  const gravity = 0.6;
  const jumpForce = -10;
  const terminalVelocity = 10;

  const sendMessage = useCallback(() => {
    if (peer?.connected && userNpub) {
      peer.send(
        JSON.stringify({
          type: "updatePosition",
          data: { npub: userNpub, y: birdPosition },
        }),
      );
    }
  }, [peer, birdPosition, userNpub]);

  useEffect(() => {
    setBirdPosition(localPos.y);
  }, [localPos.y]);

  const jump = useCallback(() => {
    if (!gameStarted) {
      setGameStarted(true);
    }
    setVelocity(jumpForce);
  }, [gameStarted]);

  useEffect(() => {
    if (!gameStarted) return;

    const gameLoop = setInterval(() => {
      setBirdPosition((prevPosition) => {
        const newPosition = prevPosition + velocity;
        return Math.max(0, Math.min(500, newPosition));
      });

      setVelocity((prevVelocity) => {
        const newVelocity = prevVelocity + gravity;
        return Math.min(newVelocity, terminalVelocity);
      });

      sendMessage();
    }, 16);

    return () => clearInterval(gameLoop);
  }, [gameStarted, velocity, sendMessage]);
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        jump();
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [gameStarted, jump]);
  return (
    <div
      className="relative h-[500px] w-full overflow-hidden bg-sky-200"
      onClick={jump}
    >
      {/* Local Player Bird */}
      <div
        className="absolute transform transition-transform"
        style={{
          top: `${birdPosition}px`,
          transform: `rotate(${velocity * 4}deg)`,
        }}
      >
        <img
          src={localPos.picUrl ?? "/default.png"}
          alt={`${localPos.name ?? "Player"}'s Bird`}
          className="h-8 w-8 rounded-full"
        />
      </div>
      {!gameStarted && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-2xl font-bold">Click or Press Space to Start</p>
        </div>
      )}
      {!gameStarted && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-2xl font-bold">Click or Press Space to Start</p>
        </div>
      )}
      {Object.keys(remotePos).map((npub) => (
        <div
          key={npub}
          className="absolute transform transition-transform"
          style={{
            top: `${remotePos[npub]}px`,
            transform: `rotate(${velocity * 4}deg)`,
          }}
        >
          {remotePos[npub]?.picUrl && (
            <img
              src={remotePos[npub].picUrl ?? "/default.png"} // Fallback to default.png if no image URL is provided
              alt={`${remotePos[npub].name ?? "Remote Player"}'s Bird`}
              className="h-8 w-8 rounded-full"
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default FlappyBirdGame;
