"use client";

import React, { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  angle: number;
  speed: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

export function Confetti() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];
    const initialParticles: Particle[] = Array.from({ length: 120 }).map((_, i) => {
      return {
        id: i,
        x: 50, // start at percentage center-x
        y: 40, // start at percentage center-y
        size: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        angle: Math.random() * 360,
        speed: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 10 - 5,
        opacity: 1,
      };
    });

    setParticles(initialParticles);

    let animationFrameId: number;
    let elapsed = 0;

    const update = () => {
      elapsed += 1;
      setParticles((prev) =>
        prev
          .map((p) => {
            // physics simulation
            const rad = (p.angle * Math.PI) / 180;
            // Add gravity effect
            const nextX = p.x + (Math.cos(rad) * p.speed) / 10;
            const nextY = p.y + (Math.sin(rad) * p.speed) / 10 + elapsed * 0.005; // gravity pulls down

            return {
              ...p,
              x: nextX,
              y: nextY,
              rotation: p.rotation + p.rotationSpeed,
              opacity: Math.max(0, 1 - elapsed * 0.003), // gradually fade out
            };
          })
          .filter((p) => p.opacity > 0 && p.y < 120 && p.x > -20 && p.x < 120)
      );

      if (elapsed < 300) {
        animationFrameId = requestAnimationFrame(update);
      }
    };

    animationFrameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            transform: `translate(-50%, -50%) rotate(${p.rotation}deg)`,
            opacity: p.opacity,
            borderRadius: p.id % 3 === 0 ? "50%" : p.id % 3 === 1 ? "0%" : "3px 10px 4px",
            boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
          }}
        />
      ))}
    </div>
  );
}
