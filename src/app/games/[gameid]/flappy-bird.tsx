"use client";
import SimplePeer from "simple-peer";

import { useEffect, useRef, useState, useCallback } from "react";
import { Players, PlayerState } from "./gameroom";
import { object } from "zod";
import { GamepadIcon } from "lucide-react";

interface FlappyBirdGameProps {
  localPos: PlayerState;
  remotePos: Players;
  peer: SimplePeer.Instance | null;
  connected: boolean;
  userNpub: string | null;
}

const FlappyBirdGame = ({
  localPos,
  remotePos,
  peer,
  connected,
  userNpub,
}: FlappyBirdGameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const birdPositionRef = useRef(250);
  const gameLoopRef = useRef<number>();
  const gameStartedRef = useRef(false);
  const velocityRef = useRef(0);
  const [gameStarted, setGameStarted] = useState(false);
  const obstaclesRef = useRef<{ x: number; height: number }[]>([]);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const GAME_CONFIG = {
    gravity: 1,
    jumpForce: -15,
    terminalVelocity: 10,
    obstacleGap: 200,
    obstacleWidth: 50,
    obstacleSpeed: 3,
    canvasWidth: 500,
    canvasHeight: 500,
    birdRadius: 20,
    birdX: 140,
    updateInterval: 16,
  };

  const sendMessage = useCallback(() => {
    if (peer?.connected && userNpub) {
      peer.send(
        JSON.stringify({
          type: "updatePosition",
          data: { npub: userNpub, y: birdPositionRef.current },
        }),
      );
    }
  }, [peer, birdPositionRef, userNpub]);

  const jump = useCallback(() => {
    velocityRef.current = GAME_CONFIG.jumpForce;
  }, [gameStarted]);

  function clearCanvas(ctx: CanvasRenderingContext2D | null | undefined) {
    if (!canvasRef.current || !ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvasRef.current?.width, canvasRef.current?.height);
  }
  function drawStartMessage(ctx: CanvasRenderingContext2D | null | undefined) {
    if (!ctx || !canvasRef.current) {
      return;
    }
    clearCanvas(ctx);
    ctx.save();
    ctx.font = "25px Arial";
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "Click or Press Space to Start",
      canvasRef.current.width / 2,
      canvasRef.current?.height - 100,
    );
    ctx.restore();
    drawCircularImage(
      ctx,
      localPos.picUrl,
      GAME_CONFIG.birdX,
      birdPositionRef.current,
      "green",
    );
  }
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!gameStarted) {
        setGameStarted(true);
        gameStartedRef.current = true;
      } else {
        if (e.code === "Space") {
          jump();
          e.preventDefault();
        }
      }
    };

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!gameStarted) {
      drawStartMessage(ctx);
    } else {
      clearCanvas(ctx);
    }

    function handleCanvasClick() {
      if (!gameStarted) {
        setGameStarted(true);
      }
    }
    canvas?.addEventListener("click", handleCanvasClick);
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [gameStarted, jump]);

  //cache profile pictures
  useEffect(() => {
    if (localPos.picUrl && !imagesRef.current[localPos.picUrl]) {
      const img = new Image();
      img.src = localPos.picUrl;
      imagesRef.current[localPos.picUrl] = img;
    }
    Object.keys(remotePos).forEach((npub) => {
      if (
        remotePos[npub]?.picUrl &&
        !imagesRef.current[remotePos[npub].picUrl]
      ) {
        const remoteImage = new Image();
        remoteImage.src = remotePos[npub]?.picUrl;
        imagesRef.current[remotePos[npub].picUrl] = remoteImage;
      }
    });
  }, [localPos.picUrl, remotePos]);

  function drawCircularImage(
    ctx: CanvasRenderingContext2D,
    imageUrl: string | null,
    x: number,
    y: number,
    color: string,
  ) {
    const image = imageUrl ? imagesRef.current[imageUrl] : null;
    if (image?.complete) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, GAME_CONFIG.birdRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        image,
        x - GAME_CONFIG.birdRadius,
        y - GAME_CONFIG.birdRadius,
        GAME_CONFIG.birdRadius * 2,
        GAME_CONFIG.birdRadius * 2,
      );
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, GAME_CONFIG.birdRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.closePath();
    }
  }

  useEffect(() => {
    if (!gameStarted) {
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const updateState = () => {
      velocityRef.current += GAME_CONFIG.gravity;
      velocityRef.current = Math.min(
        velocityRef.current,
        GAME_CONFIG.terminalVelocity,
      );
      birdPositionRef.current = Math.max(
        0,
        Math.min(
          GAME_CONFIG.canvasHeight,
          birdPositionRef.current + velocityRef.current,
        ),
      );

      obstaclesRef.current = obstaclesRef.current
        .map((obstacle) => ({
          ...obstacle,
          x: obstacle.x - GAME_CONFIG.obstacleSpeed,
        }))
        .filter((obstacle) => obstacle.x + GAME_CONFIG.obstacleWidth > 0);

      if (
        obstaclesRef.current.length === 0 ||
        obstaclesRef.current[obstaclesRef.current.length - 1]!.x <
          GAME_CONFIG.canvasWidth - 200
      ) {
        obstaclesRef.current.push({
          x: GAME_CONFIG.canvasWidth,
          height:
            Math.random() *
            (GAME_CONFIG.canvasHeight - GAME_CONFIG.obstacleGap),
        });
      }

      for (const obstacle of obstaclesRef.current) {
        // Bird's circle center and radius
        const birdCenterY = birdPositionRef.current;
        const birdRadius = GAME_CONFIG.birdRadius;
        const birdCenterX = GAME_CONFIG.birdX;

        // Top obstacle rectangle
        const topRect = {
          x1: obstacle.x,
          y1: 0,
          x2: obstacle.x + GAME_CONFIG.obstacleWidth,
          y2: obstacle.height,
        };

        // Bottom obstacle rectangle
        const bottomRect = {
          x1: obstacle.x,
          y1: obstacle.height + GAME_CONFIG.obstacleGap,
          x2: obstacle.x + GAME_CONFIG.obstacleWidth,
          y2: GAME_CONFIG.canvasHeight,
        };

        // Function to check collision between a circle and a rectangle
        const circleRectangleCollision = (
          circleX: number,
          circleY: number,
          radius: number,
          rect: { x1: number; x2: number; y1: number; y2: number },
        ) => {
          // Find the closest point on the rectangle to the circle center
          const closestX = Math.max(rect.x1, Math.min(circleX, rect.x2));
          const closestY = Math.max(rect.y1, Math.min(circleY, rect.y2));

          // Calculate the distance from the circle center to this closest point
          const distanceX = circleX - closestX;
          const distanceY = circleY - closestY;

          // If the distance is less than the circle radius, there is a collision
          const distanceSquared = distanceX * distanceX + distanceY * distanceY;
          return distanceSquared < radius * radius;
        };

        // Check collision with top obstacle
        if (
          circleRectangleCollision(
            birdCenterX,
            birdCenterY,
            birdRadius,
            bottomRect,
          ) ||
          circleRectangleCollision(
            birdCenterX,
            birdCenterY,
            birdRadius,
            topRect,
          )
        ) {
          gameStartedRef.current = false;
          setGameStarted(false);
          birdPositionRef.current = 250;
          velocityRef.current = GAME_CONFIG.gravity;
          obstaclesRef.current = [];
          return;
        }
      }
      sendMessage();
    };

    //clear canvas
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawCircularImage(
        ctx,
        localPos.picUrl,
        GAME_CONFIG.birdX,
        birdPositionRef.current,
        "green",
      );

      //draw other birds
      Object.entries(remotePos).forEach(([npub, player]) => {
        drawCircularImage(
          ctx,
          player.picUrl,
          GAME_CONFIG.birdX,
          player.y ?? GAME_CONFIG.canvasHeight / 2,
          localPos.picUrl ? "red" : "#f43f5e",
        );
      });

      ctx.fillStyle = "#2563eb";
      obstaclesRef.current.forEach((obstacle) => {
        ctx.fillRect(obstacle.x, 0, GAME_CONFIG.obstacleWidth, obstacle.height);
        ctx.fillRect(
          obstacle.x,
          obstacle.height + GAME_CONFIG.obstacleGap,
          GAME_CONFIG.obstacleWidth,
          GAME_CONFIG.canvasHeight,
        );
      });
    };

    if (gameStartedRef.current) {
      gameLoopRef.current = requestAnimationFrame(draw);
    }

    const gameLoop = () => {
      updateState();
      draw();
    };
    const intervalId = setInterval(gameLoop, GAME_CONFIG.updateInterval);
    return () => {
      clearInterval(intervalId);
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameStarted, birdPositionRef, obstaclesRef, remotePos]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={GAME_CONFIG.canvasWidth}
        height={GAME_CONFIG.canvasHeight}
        className="border border-black"
      />
    </div>
  );
};

export default FlappyBirdGame;
