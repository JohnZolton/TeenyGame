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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [birdPosition, setBirdPosition] = useState(localPos.y);
  const [gameStarted, setGameStarted] = useState(false);
  const [velocity, setVelocity] = useState(0);
  const [obstacles, setObstacles] = useState<{ x: number; height: number }[]>(
    [],
  );
  const gravity = 0.6;
  const jumpForce = -10;
  const terminalVelocity = 10;
  const obstacleGap = 150;
  const obstacleWidth = 50;
  const obstacleSpeed = 3;
  const canvasWidth = 500;
  const canvasHeight = 500;

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

      setObstacles((prevObstacles) =>
        prevObstacles.map((obstacle) => ({
          ...obstacle,
          x: obstacle.x - obstacleSpeed,
        })),
      );

      if (gameStarted) {
        const newObstacle = Math.random() * (canvasHeight - obstacleGap);
        if (
          obstacles &&
          obstacles.length > 0 &&
          obstacles[obstacles.length - 1]!.x < canvasWidth - 200
        ) {
          setObstacles((prevObstacles) => [
            ...prevObstacles,
            { x: canvasWidth, height: newObstacle },
          ]);
        }
      }

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      //clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      //draw bird
      ctx.beginPath();
      ctx.arc(50, birdPosition, 20, 0, Math.PI * 2);
      ctx.fillStyle = localPos.picUrl ? "green" : "#5eead4";
      ctx.fill();
      ctx.closePath();

      //draw other birds
      Object.keys(remotePos).forEach((npub) => {
        ctx.beginPath();
        ctx.arc(
          obstacles.reduce(
            (maxX, obstacle) => Math.max(maxX, obstacle.x + obstacleWidth),
            200,
          ),
          remotePos[npub]?.y ?? canvasHeight / 2,
          20,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = localPos.picUrl ? "red" : "#f43f5e";
        ctx.fill();
        ctx.closePath();
      });

      obstacles.forEach((obstacle) => {
        if (
          birdPosition < obstacle.height ||
          birdPosition > obstacle.height + obstacleGap
        ) {
          if (50 > obstacle.x && 50 < obstacle.x + obstacleWidth) {
            setGameStarted(false);
            alert("GameOver");
          }
        }
      });
      if (gameStarted) {
        requestAnimationFrame(draw);
      }
    };
    draw();
  }, [gameStarted, birdPosition, obstacles, remotePos]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        onClick={jump}
        className="border border-black"
      />
      {!gameStarted && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-2xl font-bold">Click or Press Space to Start</p>
        </div>
      )}
    </div>
  );
};

export default FlappyBirdGame;
