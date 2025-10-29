import React, { useEffect, useRef, useState, useCallback } from "react";

interface Position {
  x: number;
  y: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  el: HTMLDivElement | null;
}

export default function App() {
  const [colorCount, setColorCount] = useState(2);
  const [ballCount, setBallCount] = useState(8);
  const [isWin, setIsWin] = useState(false);
  const [cursorPos, setCursorPos] = useState<Position | null>(null);
  const [time, setTime] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const gameFieldRef = useRef<HTMLDivElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const cursorRef = useRef<Position | null>(null);
  const timerRef = useRef<number | null>(null);

  const FIELD_WIDTH = 600;
  const FIELD_HEIGHT = 500;
  const BALL_SIZE = 20;
  const GROUP_RADIUS = 100;
  const PUSH_RADIUS = 150;
  const PUSH_FORCE = 2.5;
  const MAX_SPEED = 6;
  const FRICTION = 0.97;

  const generateBalls = useCallback((): Ball[] => {
    if (ballCount < colorCount * 2) {
      const msg = `Error: For ${colorCount} colors, you need at least ${
        colorCount * 2
      } balls. Currently set: ${ballCount}.`;
      setErrorMessage(msg);
      return [];
    }

    setErrorMessage(null);
    const colors = ["red", "green", "blue", "yellow", "purple", "orange"];
    return Array.from({ length: ballCount }, (_, i) => ({
      color: colors[i % colorCount],
      x: Math.random() * (FIELD_WIDTH - BALL_SIZE),
      y: Math.random() * (FIELD_HEIGHT - BALL_SIZE),
      vx: 0,
      vy: 0,
      el: null,
    }));
  }, [ballCount, colorCount]);

  const startGame = useCallback(() => {
    const balls = generateBalls();
    if (!balls.length) return;

    ballsRef.current = balls;
    setIsWin(false);
    setTime(0);
    setCursorPos(null);
    cursorRef.current = null;

    if (timerRef.current) cancelAnimationFrame(timerRef.current);

    const start = performance.now();
    const updateTime = (now: number) => {
      setTime(now - start);
      timerRef.current = requestAnimationFrame(updateTime);
    };
    timerRef.current = requestAnimationFrame(updateTime);
  }, [generateBalls]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const msRemainder = Math.floor(ms % 1000);
    return `${seconds}.${msRemainder.toString().padStart(3, "0")}s`;
  };

  useEffect(() => {
    const field = gameFieldRef.current;
    if (!field) return;

    const handleMove = (e: MouseEvent) => {
      if (isWin) return;
      const rect = field.getBoundingClientRect();
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      cursorRef.current = pos;
      setCursorPos(pos);
    };

    const handleLeave = () => {
      cursorRef.current = null;
      setCursorPos(null);
    };

    field.addEventListener("mousemove", handleMove);
    field.addEventListener("mouseleave", handleLeave);
    return () => {
      field.removeEventListener("mousemove", handleMove);
      field.removeEventListener("mouseleave", handleLeave);
    };
  }, [isWin]);

  useEffect(() => {
    let animationId: number;

    const animate = () => {
      const balls = ballsRef.current;
      if (!balls.length) return;

      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];

        if (cursorRef.current && !isWin) {
          const { x, y } = cursorRef.current;
          const dx = b.x + BALL_SIZE / 2 - x;
          const dy = b.y + BALL_SIZE / 2 - y;
          const dist = Math.hypot(dx, dy);
          if (dist < PUSH_RADIUS && dist > 0) {
            const force = (PUSH_RADIUS - dist) / PUSH_RADIUS;
            b.vx += (dx / dist) * PUSH_FORCE * force;
            b.vy += (dy / dist) * PUSH_FORCE * force;
          }
        }

        for (let j = i + 1; j < balls.length; j++) {
          const o = balls[j];
          const dx = b.x - o.x;
          const dy = b.y - o.y;
          const dist = Math.hypot(dx, dy);
          if (dist < BALL_SIZE && dist > 0) {
            const overlap = BALL_SIZE - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            b.x += (nx * overlap) / 2;
            b.y += (ny * overlap) / 2;
            o.x -= (nx * overlap) / 2;
            o.y -= (ny * overlap) / 2;
            const force = 0.3;
            b.vx += nx * force;
            b.vy += ny * force;
            o.vx -= nx * force;
            o.vy -= ny * force;
          }
        }

        b.x += b.vx;
        b.y += b.vy;
        b.vx *= FRICTION;
        b.vy *= FRICTION;

        const speed = Math.hypot(b.vx, b.vy);
        if (speed > MAX_SPEED) {
          b.vx = (b.vx / speed) * MAX_SPEED;
          b.vy = (b.vy / speed) * MAX_SPEED;
        }

        if (b.x < 0) { b.x = 0; b.vx *= -0.6; }
        if (b.x > FIELD_WIDTH - BALL_SIZE) { b.x = FIELD_WIDTH - BALL_SIZE; b.vx *= -0.6; }
        if (b.y < 0) { b.y = 0; b.vy *= -0.6; }
        if (b.y > FIELD_HEIGHT - BALL_SIZE) { b.y = FIELD_HEIGHT - BALL_SIZE; b.vy *= -0.6; }

        if (b.el) b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;
      }

      if (!isWin && checkWin()) {
        setIsWin(true);
        setCursorPos(null);
        if (timerRef.current) cancelAnimationFrame(timerRef.current);
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isWin]);

  const getHighlight = (ball: Ball) => {
    const balls = ballsRef.current;
    if (!balls.length) return false;

    const sameColorBalls = balls.filter((b) => b.color === ball.color);
    if (sameColorBalls.length < 2) return false;

    const visited = new Set<Ball>();
    const queue: Ball[] = [sameColorBalls[0]];

    while (queue.length) {
      const current = queue.pop()!;
      visited.add(current);
      sameColorBalls.forEach((other) => {
        if (!visited.has(other)) {
          const dx = current.x + BALL_SIZE / 2 - (other.x + BALL_SIZE / 2);
          const dy = current.y + BALL_SIZE / 2 - (other.y + BALL_SIZE / 2);
          if (Math.hypot(dx, dy) <= GROUP_RADIUS) queue.push(other);
        }
      });
    }

    return visited.has(ball) && visited.size > 1;
  };

  const checkWin = (): boolean => {
    const balls = ballsRef.current;
    if (!balls.length) return false;

    const groups: { [color: string]: Ball[] } = {};
    balls.forEach((b) => {
      if (!groups[b.color]) groups[b.color] = [];
      groups[b.color].push(b);
    });

    for (const color in groups) {
      const colorBalls = groups[color];
      const visited = new Set<Ball>();
      const queue = [colorBalls[0]];

      while (queue.length) {
        const current = queue.pop()!;
        visited.add(current);
        colorBalls.forEach((other) => {
          if (!visited.has(other)) {
            const dx = current.x + BALL_SIZE / 2 - (other.x + BALL_SIZE / 2);
            const dy = current.y + BALL_SIZE / 2 - (other.y + BALL_SIZE / 2);
            if (Math.hypot(dx, dy) <= GROUP_RADIUS) queue.push(other);
          }
        });
      }

      if (visited.size !== colorBalls.length) return false;
    }

    const positions = balls.map((b) => ({
      x: b.x + BALL_SIZE / 2,
      y: b.y + BALL_SIZE / 2,
      color: b.color,
    }));

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        if (positions[i].color !== positions[j].color) {
          const dx = positions[i].x - positions[j].x;
          const dy = positions[i].y - positions[j].y;
          if (Math.hypot(dx, dy) <= GROUP_RADIUS) return false;
        }
      }
    }

    return true;
  };

  useEffect(() => {
    startGame();
  }, [ballCount, colorCount, startGame]);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white items-center">
      <header className="bg-gray-800 p-4 w-full text-center">
        <h1 className="text-2xl font-bold">Ball Sort</h1>
      </header>

      <main className="flex-1 p-4 flex flex-col items-center">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex flex-col">
            <label className="mb-1">Number of Balls (min 6)</label>
            <input
              type="number"
              min={6}
              value={ballCount}
              onChange={(e) =>
                setBallCount(Math.max(6, parseInt(e.target.value) || 6))
              }
              className="p-2 rounded text-black"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1">Number of Colors (min 2)</label>
            <input
              type="number"
              min={2}
              value={colorCount}
              onChange={(e) =>
                setColorCount(Math.max(2, parseInt(e.target.value) || 2))
              }
              className="p-2 rounded text-black"
            />
          </div>
          <button
            onClick={startGame}
            className="bg-blue-600 hover:bg-blue-700 rounded px-4 py-2 mt-auto md:mt-6"
          >
            Start Game
          </button>
        </div>

        <div
          ref={gameFieldRef}
          className="relative bg-gray-700 rounded overflow-hidden"
          style={{ width: FIELD_WIDTH, height: FIELD_HEIGHT }}
        >
          {!isWin && (
            <div className="absolute top-2 right-3 text-yellow-300 text-lg font-mono bg-black/40 px-3 py-1 rounded">
              {formatTime(time)}
            </div>
          )}

          {!isWin && cursorPos && (
            <div
              className="absolute pointer-events-none rounded-full bg-white opacity-70 z-50"
              style={{
                width: BALL_SIZE,
                height: BALL_SIZE,
                left: cursorPos.x - BALL_SIZE / 2,
                top: cursorPos.y - BALL_SIZE / 2,
              }}
            />
          )}

          {ballsRef.current.map((ball, i) => {
            const highlight = getHighlight(ball);
            return (
              <div
                key={i}
                ref={(el) => {
                  ballsRef.current[i].el = el;
                }}
                className="absolute rounded-full transition-all"
                style={{
                  width: BALL_SIZE,
                  height: BALL_SIZE,
                  backgroundColor: ball.color,
                  transform: `translate(${ball.x}px, ${ball.y}px)`,
                  border: highlight ? "3px solid white" : "none",
                  boxShadow: highlight ? `0 0 12px 4px ${ball.color}` : "none",
                }}
              />
            );
          })}

          {isWin && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-4xl font-bold text-green-400 gap-4">
              <div>YOU WIN 🎉</div>
              <div className="text-3xl text-yellow-400">{formatTime(time)}</div>
              <button
                onClick={startGame}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold px-6 py-2 rounded-lg transition-all"
              >
                Restart Game
              </button>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="mt-4 text-red-500 text-center font-semibold">
            {errorMessage}
          </div>
        )}
      </main>
    </div>
  );
}
