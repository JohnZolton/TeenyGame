"use client";
import React, { useState, useEffect, useCallback } from "react";

const FlappyBirdGame = () => {
  const [birdPosition, setBirdPosition] = useState(250);
  const [gameStarted, setGameStarted] = useState(false);
  const [velocity, setVelocity] = useState(0);
  const gravity = 0.6;
  const jumpForce = -10;
  const terminalVelocity = 10;

  const jump = useCallback(() => {
    if (!gameStarted) {
      setGameStarted(true);
    }
    setVelocity(jumpForce);
  }, [gameStarted]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        jump();
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [jump]);

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
    }, 16);

    return () => clearInterval(gameLoop);
  }, [gameStarted, velocity]);

  return (
    <div
      className="relative h-[500px] w-full overflow-hidden bg-sky-200"
      onClick={jump}
    >
      <div
        className="absolute h-8 w-8 transform rounded-full bg-yellow-400 transition-transform"
        style={{
          top: `${birdPosition}px`,
          transform: `rotate(${velocity * 4}deg)`,
        }}
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
