"use client";
import SimplePeer from "simple-peer";

import { useEffect, useRef, useState, useCallback } from "react";
import { object } from "zod";
import { GamepadIcon } from "lucide-react";
import { init } from "next/dist/compiled/webpack/webpack";
import { start } from "repl";

interface FlappyBirdGameProps {
  peer: SimplePeer.Instance | null;
  userNpub: string | null;
  displayName: string | null;
  imgUrl: string | null;
}
export type Players = Record<string, PlayerState>;
export interface PlayerState {
  y: number;
  velocity: number;
  name?: string | null | undefined;
  picUrl?: string | null | undefined;
  image?: HTMLImageElement;
}
interface Obstacle {
  x: number;
  height: number;
}

const FlappyBirdGame = ({
  peer,
  userNpub,
  displayName,
  imgUrl,
}: FlappyBirdGameProps) => {
  const baseGravity = 15;
  const baseInterval = 16;
  const baseObstacleSpeed = 50;
  const initialHeight = 250;
  const initialVelocity = 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const birdPositionRef = useRef(initialHeight);
  const gameLoopRef = useRef<number>();
  const gameStartedRef = useRef(false);
  const velocityRef = useRef(0);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const isHost = useRef(false);
  const otherPlayers = useRef<Players>({});
  const [isGameStarted, setIsGameStarted] = useState(false);
  const maxOtherPlayer = useRef(0);
  const hostDiceRoll = useRef(Math.random());

  const GAME_CONFIG = {
    gravity: baseGravity / baseInterval,
    jumpForce: -15,
    terminalVelocity: 10,
    obstacleGap: 200,
    obstacleWidth: 50,
    startY: initialHeight,
    obstacleSpeed: baseObstacleSpeed / baseInterval,
    canvasWidth: 500,
    canvasHeight: 500,
    birdRadius: 20,
    birdX: 140,
    updateInterval: baseInterval,
  };

  // determine randomly

  type PeerData = Uint8Array;
  enum MessageType {
    initialState,
    startGame,
    endGame,
    updatePosition,
    determineHost,
    updateObstacles,
  }
  interface InitialStateMessage {
    type: MessageType.initialState;
    data: {
      npub: string;
      name: string;
      picUrl: string;
    };
  }
  interface StartGameMessage {
    type: MessageType.startGame;
    data: {
      npub: string;
      name: string;
      picUrl: string;
    };
  }

  interface EndGameMessage {
    type: MessageType.endGame;
    data: {
      npub: string;
      name: string;
      picUrl: string;
      players: Players;
    };
  }
  interface UpdatePositionMessage {
    type: MessageType.updatePosition;
    data: {
      npub: string;
      y: number;
      velocity: number;
      obstacles: Obstacle[];
    };
  }
  interface DetermineHostMessage {
    type: MessageType.determineHost;
    data: {
      npub: string;
      val: number;
    };
  }
  type Message =
    | InitialStateMessage
    | StartGameMessage
    | EndGameMessage
    | UpdatePositionMessage
    | DetermineHostMessage;
  peer?.on("data", (data: PeerData) => {
    //console.log("📨 Received data:", data);
    const message: Message = JSON.parse(
      new TextDecoder().decode(data),
    ) as Message;
    //console.log(message);

    if (message.type === MessageType.determineHost) {
      determineHost();
      otherPlayers.current = {
        ...otherPlayers.current,
        [message.data.npub]: {
          ...otherPlayers.current[message.data.npub],
          y: initialHeight,
          velocity: initialVelocity,
        },
      };
    }

    if (message.type === MessageType.startGame) {
      startGame();
      console.log("game started");
    }

    if (message.type === MessageType.endGame) {
      endGame();
      console.log("game ended");
    }

    if (message.type === MessageType.updatePosition && otherPlayers.current) {
      otherPlayers.current = {
        ...otherPlayers.current,
        [message.data.npub]: {
          ...otherPlayers.current[message.data.npub],
          y: message.data.y,
          velocity: message.data.velocity,
        },
      };
      if (!isHost.current) {
        obstaclesRef.current = message.data.obstacles;
      }
    }

    if (message.type === MessageType.determineHost) {
      console.log(message.data);
      maxOtherPlayer.current = Math.max(
        maxOtherPlayer.current,
        message.data.val,
      );
      isHost.current = hostDiceRoll.current > maxOtherPlayer.current;
      console.log("host updated, ishost: ", isHost.current);
    }
  });

  const sendEndGame = useCallback(() => {
    peer?.send(
      JSON.stringify({
        type: "endGame",
        data: { started: true },
      }),
    );
  }, [peer]);

  const endGame = useCallback(() => {
    gameStartedRef.current = false;
    setIsGameStarted(false);
    birdPositionRef.current = GAME_CONFIG.startY;
    velocityRef.current = GAME_CONFIG.gravity;
    obstaclesRef.current = [];
    if (otherPlayers.current) {
      Object.entries(otherPlayers.current).forEach(([npub, player]) => {
        otherPlayers.current[npub] = {
          ...player,
          y: GAME_CONFIG.startY,
          velocity: GAME_CONFIG.gravity,
        };
      });
    }
  }, [peer]);

  const determineHost = useCallback(() => {
    hostDiceRoll.current = Math.random();
    peer?.send(
      JSON.stringify({
        type: "determineHost",
        data: { val: hostDiceRoll.current },
      }),
    );
  }, [peer]);

  const startGame = useCallback(() => {
    gameStartedRef.current = true;
    setIsGameStarted(true);
  }, []);
  const sendStartGame = useCallback(() => {
    peer?.send(
      JSON.stringify({
        type: "startGame",
        data: { started: true },
      }),
    );
  }, [peer]);

  const sendMessage = useCallback(() => {
    if (peer?.connected && userNpub) {
      peer.send(
        JSON.stringify({
          type: "updatePosition",
          data: {
            npub: userNpub,
            y: birdPositionRef.current,
            obstacles: obstaclesRef.current,
          },
        }),
      );
    }
  }, [peer, birdPositionRef, userNpub]);

  const jump = useCallback(() => {
    velocityRef.current = GAME_CONFIG.jumpForce;
  }, []);

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
      imgUrl,
      GAME_CONFIG.birdX,
      birdPositionRef.current,
      "green",
    );
  }
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        if (!isGameStarted) {
          startGame();
          sendStartGame();
        } else {
          jump();
        }
        e.preventDefault();
      }
    };

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!gameStartedRef.current) {
      drawStartMessage(ctx);
    } else {
      clearCanvas(ctx);
    }

    function handleCanvasClick(e: MouseEvent) {
      if (!isGameStarted) {
        startGame();
        sendStartGame();
      } else {
        jump();
      }
      e.preventDefault();
    }
    canvas?.addEventListener("click", handleCanvasClick);
    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
      canvas?.removeEventListener("click", handleCanvasClick);
    };
  }, [startGame, isGameStarted, jump]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!gameStartedRef.current) {
      drawStartMessage(ctx);
    }
  }, [isGameStarted, imgUrl]);

  //cache profile pictures
  useEffect(() => {
    if (imgUrl && !imagesRef.current[imgUrl]) {
      const img = new Image();
      img.src = imgUrl;
      imagesRef.current[imgUrl] = img;
    }
    if (otherPlayers.current) {
      Object.keys(otherPlayers.current).forEach((npub) => {
        const player = otherPlayers.current[npub];

        const picUrl = player?.picUrl;
        if (picUrl && !imagesRef.current?.[picUrl]) {
          const remoteImage = new Image();
          remoteImage.src = picUrl;
          imagesRef.current[picUrl] = remoteImage;
        }
      });
    }
  }, [imgUrl, otherPlayers]);

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
    if (!isGameStarted) {
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
        isHost.current &&
        (obstaclesRef.current.length === 0 ||
          obstaclesRef.current[obstaclesRef.current.length - 1]!.x <
            GAME_CONFIG.canvasWidth - 200)
      ) {
        obstaclesRef.current.push({
          x: GAME_CONFIG.canvasWidth,
          height:
            Math.random() *
            (GAME_CONFIG.canvasHeight - GAME_CONFIG.obstacleGap),
        });
      }

      //collision detection
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
          endGame();
          sendEndGame();
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
        imgUrl,
        GAME_CONFIG.birdX,
        birdPositionRef.current,
        "green",
      );

      //draw other birds
      Object.entries(otherPlayers.current).forEach(([npub, player]) => {
        if (player.picUrl) {
          drawCircularImage(
            ctx,
            player.picUrl,
            GAME_CONFIG.birdX,
            player.y ?? GAME_CONFIG.canvasHeight / 2,
            player.picUrl ? "red" : "#f43f5e",
          );
        }
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
  }, [
    gameStartedRef,
    isGameStarted,
    birdPositionRef,
    obstaclesRef,
    otherPlayers,
  ]);

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
