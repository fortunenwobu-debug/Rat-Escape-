import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Play, MousePointer2 } from 'lucide-react';
import { Entity, EntityState, GameState, Point } from '../types';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const RAT_RADIUS = 15;
const CAT_RADIUS = 20;

const ZONES = {
  START: { x: 0, width: 150, color: '#dcfce7', label: 'START' }, // Green-50
  MIDDLE: { x: 150, width: 500, color: '#fef9c3', label: 'CAT ZONE' }, // Yellow-50
  SAFE: { x: 650, width: 150, color: '#dbeafe', label: 'SAFE' }, // Blue-50
};

// Middle zone lanes for cats
const LANES = [
  { x: 150 + (500 / 3) * 0, width: 500 / 3 },
  { x: 150 + (500 / 3) * 1, width: 500 / 3 },
  { x: 150 + (500 / 3) * 2, width: 500 / 3 },
];

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>({
    rats: [],
    cats: [],
    score: 0,
    status: 'start',
    level: 1,
    activeRatIndex: 0,
  });

  const requestRef = useRef<number>(null);
  const keysPressed = useRef<Record<string, boolean>>({});
  const touchPos = useRef<Point | null>(null);
  const isTouching = useRef<boolean>(false);

  // Synthesized "Meow" sound using Web Audio API for maximum reliability
  const playStartSound = useCallback(async () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      // Meow-like frequency sweep
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.3);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (err) {
      console.error('Web Audio failed:', err);
    }
  }, []);

  const initGame = useCallback((level: number = 1, resetScore: boolean = true) => {
    const rats: Entity[] = [];
    const emojis = ['🐀', '🐁', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'];
    
    for (let i = 0; i < level; i++) {
      rats.push({
        id: `rat-${i + 1}`,
        x: 50,
        y: 100 + (i * 50) % (CANVAS_HEIGHT - 100),
        radius: RAT_RADIUS,
        speed: 3.5,
        state: EntityState.ACTIVE,
        color: '#94a3b8',
        emoji: emojis[i % emojis.length]
      });
    }

    const cats: Entity[] = [
      { id: 'cat-1', x: LANES[0].x + LANES[0].width / 2, y: 100, radius: CAT_RADIUS, speed: 3.5, state: EntityState.ACTIVE, color: '#f87171', emoji: '🐈' },
      { id: 'cat-2', x: LANES[1].x + LANES[1].width / 2, y: 250, radius: CAT_RADIUS, speed: 3.5, state: EntityState.ACTIVE, color: '#f87171', emoji: '🐈‍⬛' },
      { id: 'cat-3', x: LANES[2].x + LANES[2].width / 2, y: 400, radius: CAT_RADIUS, speed: 3.5, state: EntityState.ACTIVE, color: '#f87171', emoji: '🐱' },
    ];

    setGameState(prev => ({
      rats,
      cats,
      score: resetScore ? 0 : prev.score,
      status: 'playing' as const,
      level: level,
      activeRatIndex: 0,
    }));
  }, []);

  const handleStartGame = () => {
    playStartSound();
    initGame(1);
  };

  const handleRestart = () => {
    setGameState({
      rats: [],
      cats: [],
      score: 0,
      status: 'start',
      level: 1,
      activeRatIndex: 0,
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    keysPressed.current[e.key] = true;
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    keysPressed.current[e.key] = false;
  };

  const handleTouchStart = (dir: string) => {
    keysPressed.current[dir] = true;
  };

  const handleTouchEnd = (dir: string) => {
    keysPressed.current[dir] = false;
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleCanvasStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState.status !== 'playing') return;
    const coords = getCanvasCoords(e);
    if (coords) {
      touchPos.current = coords;
      isTouching.current = true;
    }
  };

  const handleCanvasMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isTouching.current || gameState.status !== 'playing') return;
    const coords = getCanvasCoords(e);
    if (coords) {
      touchPos.current = coords;
    }
  };

  const handleCanvasEnd = () => {
    isTouching.current = false;
    touchPos.current = null;
  };

  const update = useCallback(() => {
    if (gameState.status !== 'playing') return;

    setGameState((prev) => {
      const newRats = [...prev.rats];
      const newCats = [...prev.cats];
      let status = prev.status;
      let score = prev.score;

      // 1. Move Active Rat
      const activeIndex = prev.activeRatIndex;
      const currentRat = newRats[activeIndex];
      
      if (currentRat && currentRat.state === EntityState.ACTIVE) {
        let moved = false;
        
        // Keyboard controls
        if (keysPressed.current['ArrowUp'] || keysPressed.current['w']) { currentRat.y -= currentRat.speed; moved = true; }
        if (keysPressed.current['ArrowDown'] || keysPressed.current['s']) { currentRat.y += currentRat.speed; moved = true; }
        if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) { currentRat.x -= currentRat.speed; moved = true; }
        if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) { currentRat.x += currentRat.speed; moved = true; }

        // Touch/Mouse controls
        if (!moved && isTouching.current && touchPos.current) {
          const dx = touchPos.current.x - currentRat.x;
          const dy = touchPos.current.y - currentRat.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > 5) {
            const moveX = (dx / dist) * currentRat.speed;
            const moveY = (dy / dist) * currentRat.speed;
            
            currentRat.x += Math.abs(moveX) > Math.abs(dx) ? dx : moveX;
            currentRat.y += Math.abs(moveY) > Math.abs(dy) ? dy : moveY;
          }
        }

        // Boundary checks
        currentRat.x = Math.max(currentRat.radius, Math.min(CANVAS_WIDTH - currentRat.radius, currentRat.x));
        currentRat.y = Math.max(currentRat.radius, Math.min(CANVAS_HEIGHT - currentRat.radius, currentRat.y));

        // Check if reached Safe Zone
        if (currentRat.x > ZONES.SAFE.x) {
          currentRat.state = EntityState.SAFE;
          score += 100;
        }
      }

      // 2. Move Cats (AI Defenders)
      newCats.forEach((cat, index) => {
        const lane = LANES[index];
        
        // Find closest active rat that is currently in THIS cat's lane
        let targetRat: Entity | null = null;
        let minDist = Infinity;

        // Only target the currently active rat if it's in the lane
        if (currentRat && currentRat.state === EntityState.ACTIVE) {
          const isInLane = currentRat.x >= lane.x && currentRat.x <= lane.x + lane.width;
          if (isInLane) {
            minDist = Math.abs(currentRat.y - cat.y);
            targetRat = currentRat;
          }
        }

        if (targetRat) {
          // Chase rat vertically
          if (targetRat.y > cat.y) cat.y += cat.speed;
          else if (targetRat.y < cat.y) cat.y -= cat.speed;
          
          // Move towards rat horizontally BUT stay strictly within lane
          if (targetRat.x > cat.x) cat.x += cat.speed * 0.5;
          else if (targetRat.x < cat.x) cat.x -= cat.speed * 0.5;
        } else {
          // Patrol vertically
          if (!cat['direction']) cat['direction'] = 1;
          cat.y += cat.speed * 0.8 * cat['direction'];
          
          if (cat.y > CANVAS_HEIGHT - cat.radius || cat.y < cat.radius) {
            cat['direction'] *= -1;
          }
          
          // Return to center of lane horizontally when not chasing
          const centerX = lane.x + lane.width / 2;
          if (Math.abs(cat.x - centerX) > 2) {
            cat.x += (centerX > cat.x ? 1 : -1) * (cat.speed * 0.5);
          }
        }

        // STRICT Boundary checks for cats
        cat.y = Math.max(cat.radius, Math.min(CANVAS_HEIGHT - cat.radius, cat.y));
        cat.x = Math.max(lane.x + cat.radius, Math.min(lane.x + lane.width - cat.radius, cat.x));
      });

      // 3. Collision Detection (Only for active rat)
      if (currentRat && currentRat.state === EntityState.ACTIVE) {
        newCats.forEach(cat => {
          const dx = currentRat.x - cat.x;
          const dy = currentRat.y - cat.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < currentRat.radius + cat.radius) {
            currentRat.state = EntityState.CAUGHT;
            isTouching.current = false; // Reset touch on catch
            touchPos.current = null;
          }
        });
      }

      // 4. Handle Sequential Progression
      let activeRatIndex = prev.activeRatIndex;
      if (currentRat && currentRat.state !== EntityState.ACTIVE) {
        if (currentRat.state === EntityState.CAUGHT) {
          // Strict requirement: If any rat is caught, the level is lost
          status = 'lost';
        } else if (activeRatIndex < newRats.length - 1) {
          activeRatIndex++;
          // Reset touch for the next rat
          isTouching.current = false;
          touchPos.current = null;
        } else {
          // All rats have finished their turn and all were safe
          status = 'won';
        }
      }

      return { ...prev, rats: newRats, cats: newCats, status, score, activeRatIndex };
    });

    requestRef.current = requestAnimationFrame(update);
  }, [gameState.status]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update]);

  // Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Zones
    ctx.fillStyle = ZONES.START.color;
    ctx.fillRect(ZONES.START.x, 0, ZONES.START.width, CANVAS_HEIGHT);
    
    ctx.fillStyle = ZONES.MIDDLE.color;
    ctx.fillRect(ZONES.MIDDLE.x, 0, ZONES.MIDDLE.width, CANVAS_HEIGHT);
    
    ctx.fillStyle = ZONES.SAFE.color;
    ctx.fillRect(ZONES.SAFE.x, 0, ZONES.SAFE.width, CANVAS_HEIGHT);
    
    // Add glow to Safe Zone
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 4;
    ctx.strokeRect(ZONES.SAFE.x, 0, ZONES.SAFE.width, CANVAS_HEIGHT);

    // Draw Lane Dividers
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.setLineDash([5, 5]);
    LANES.forEach(lane => {
      ctx.beginPath();
      ctx.moveTo(lane.x, 0);
      ctx.lineTo(lane.x, CANVAS_HEIGHT);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Draw Zone Labels
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ZONES.START.label, ZONES.START.x + ZONES.START.width / 2, 30);
    ctx.fillText(ZONES.MIDDLE.label, ZONES.MIDDLE.x + ZONES.MIDDLE.width / 2, 30);
    ctx.fillText(ZONES.SAFE.label, ZONES.SAFE.x + ZONES.SAFE.width / 2, 30);

    // Draw Rats
    gameState.rats.forEach((rat, index) => {
      // Only draw rats that have already played or are currently playing
      if (index > gameState.activeRatIndex && rat.state === EntityState.ACTIVE) {
        return; // Don't draw rats waiting their turn
      }

      if (rat.state === EntityState.CAUGHT) {
        ctx.globalAlpha = 0.3;
      }
      
      ctx.font = `${rat.radius * 2}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rat.emoji, rat.x, rat.y);
      
      // Indicator for active rat
      if (index === gameState.activeRatIndex && rat.state === EntityState.ACTIVE) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rat.x, rat.y, rat.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.globalAlpha = 1.0;
    });

    // Draw Cats
    gameState.cats.forEach(cat => {
      ctx.font = `${cat.radius * 2}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cat.emoji, cat.x, cat.y);
    });

  }, [gameState]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4 font-sans">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 p-4 md:p-6 text-white border-b border-slate-800">
          <div className="flex flex-wrap gap-4 md:gap-8 items-center w-full justify-center md:justify-around max-w-5xl mx-auto">
            <div className="text-center group min-w-[80px]">
              <p className="text-[10px] md:text-xs uppercase tracking-widest text-slate-500 mb-1 font-bold">Level</p>
              <p className="text-2xl md:text-4xl font-mono font-black text-yellow-400 group-hover:scale-110 transition-transform">
                {gameState.status === 'start' ? '-' : gameState.level}
              </p>
            </div>
            
            <div className="text-center group relative min-w-[120px] md:min-w-[160px]">
              <p className="text-[10px] md:text-xs uppercase tracking-widest text-slate-500 mb-1 font-bold">Score</p>
              <div className="flex flex-col items-center">
                <motion.p 
                  key={gameState.score}
                  initial={{ scale: 1.2, color: '#60a5fa' }}
                  animate={{ scale: 1, color: '#60a5fa' }}
                  className="text-2xl md:text-4xl font-mono font-black text-blue-400 group-hover:scale-110 transition-transform"
                >
                  {gameState.score}
                </motion.p>
                {/* Score Progress Bar - More prominent */}
                <div className="w-24 md:w-40 h-2 md:h-3 bg-slate-800 rounded-full mt-2 overflow-hidden border border-slate-700 shadow-inner">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    initial={{ width: 0 }}
                    animate={{ width: gameState.rats.length > 0 ? `${(gameState.rats.filter(r => r.state === EntityState.SAFE).length / gameState.rats.length) * 100}%` : 0 }}
                    transition={{ type: 'spring', stiffness: 50 }}
                  />
                </div>
                <p className="text-[8px] md:text-[10px] text-slate-600 mt-1 uppercase font-bold tracking-tighter">Rats Safe Progress</p>
              </div>
            </div>

            <div className="text-center group min-w-[100px] md:min-w-[140px]">
              <p className="text-[10px] md:text-xs uppercase tracking-widest text-slate-500 mb-1 font-bold">Rat Turn</p>
              <div className="flex flex-col items-center">
                <p className="text-2xl md:text-4xl font-mono font-black text-purple-400 group-hover:scale-110 transition-transform">
                  {gameState.status === 'start' ? '- / -' : `${gameState.activeRatIndex + 1}`}
                  {gameState.status !== 'start' && <span className="text-slate-600 text-lg md:text-xl mx-1">/</span>}
                  {gameState.status !== 'start' && gameState.rats.length}
                </p>
                {/* Turn Progress Dots */}
                <div className="flex flex-wrap justify-center gap-1 mt-2 max-w-[120px] md:max-w-[200px]">
                  {gameState.rats.map((rat, i) => (
                    <div 
                      key={rat.id}
                      className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-colors ${
                        rat.state === EntityState.SAFE ? 'bg-green-500' : 
                        rat.state === EntityState.CAUGHT ? 'bg-red-500' : 
                        i === gameState.activeRatIndex ? 'bg-purple-500 animate-pulse' : 'bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div className="relative bg-slate-50 flex items-center justify-center p-4 overflow-x-auto">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onMouseDown={handleCanvasStart}
            onMouseMove={handleCanvasMove}
            onMouseUp={handleCanvasEnd}
            onMouseLeave={handleCanvasEnd}
            onTouchStart={handleCanvasStart}
            onTouchMove={handleCanvasMove}
            onTouchEnd={handleCanvasEnd}
            className="rounded-lg shadow-inner border border-slate-200 bg-white cursor-crosshair max-w-full h-auto touch-none"
          />

          {/* Overlays */}
          <AnimatePresence>
            {gameState.status === 'start' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center text-white p-8 text-center z-50"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="max-w-md"
                >
                  <h1 className="text-5xl font-black mb-2 tracking-tighter">CAT AND RAT ESCAPE</h1>
                  <p className="text-blue-400 font-medium text-lg mb-12 tracking-widest uppercase">Nigerian Playground Classic</p>
                  
                  <button
                    onClick={handleStartGame}
                    className="group relative px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-2xl transition-all hover:scale-110 active:scale-95 flex items-center gap-4 mx-auto shadow-2xl shadow-blue-600/30"
                  >
                    <Play fill="currentColor" size={28} />
                    START GAME
                  </button>
                </motion.div>
              </motion.div>
            )}

            {(gameState.status === 'won' || gameState.status === 'lost') && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center text-white p-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0.5, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="mb-6"
                >
                  {gameState.status === 'won' ? (
                    <div className="bg-green-500 p-6 rounded-full shadow-2xl shadow-green-500/20">
                      <Trophy size={80} />
                    </div>
                  ) : (
                    <div className="bg-red-500 p-6 rounded-full shadow-2xl shadow-red-500/20">
                      <RotateCcw size={80} />
                    </div>
                  )}
                </motion.div>
                
                <h2 className="text-5xl font-black mb-2 tracking-tight">
                  {gameState.status === 'won' ? 'VICTORY!' : 'CAUGHT!'}
                </h2>
                <p className="text-xl text-slate-400 mb-8">
                  {gameState.status === 'won' 
                    ? `Level ${gameState.level} Complete! All ${gameState.rats.length} rats are safe.` 
                    : `Level Failed! All rats must reach the safe zone to progress.`}
                </p>
                
                <div className="flex gap-4">
                  {gameState.status === 'won' ? (
                    <button
                      onClick={() => initGame(gameState.level + 1, false)}
                      className="px-8 py-3 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-500 transition-colors flex items-center gap-2"
                    >
                      <Play size={20} fill="currentColor" />
                      NEXT LEVEL
                    </button>
                  ) : (
                    <button
                      onClick={handleRestart}
                      className="px-8 py-3 bg-white text-slate-900 rounded-full font-bold hover:bg-slate-200 transition-colors flex items-center gap-2"
                    >
                      <RotateCcw size={20} />
                      RESTART
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
