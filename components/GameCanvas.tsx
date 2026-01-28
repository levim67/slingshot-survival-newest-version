import React, { useEffect, useRef } from 'react';
import { GameStateStatus, Upgrades, GameState, Vector2 } from '../types';
import { mag, normalize, sub, mult } from '../utils/physics';
import * as audio from '../utils/audio';
import { updateGame, createLavaParticle, spawnDirectionalBurst, initializeWorld } from '../game/Engine';
import { renderGame } from '../game/Renderer';
import { BOSS_SPAWN_INTERVAL, BALL_DEFINITIONS } from '../utils/constants';

// Spike images from public folder - use BASE_URL for correct path in production
const greenSpikeImg = `${import.meta.env.BASE_URL}green_spike.png`;
const redSpikeImg = `${import.meta.env.BASE_URL}red_spike.png`;

interface GameCanvasProps {
  status: GameStateStatus;
  gameId: number;
  upgrades: Upgrades;
  autoBounceLevel: number;
  onGameOver: (score: number) => void;
  onUpdateStats: (health: number, score: number, distance: number, multiplier: number) => void;
  onUpdateHUD: (unlocked: boolean, cooldownRemaining: number, isActive: boolean, timeAlive: number, bossHealth: number, maxBossHealth: number) => void;
  triggerAutoBounce: number;
  skin: string;
  baseZoom: number;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ status, gameId, upgrades, autoBounceLevel, onGameOver, onUpdateStats, onUpdateHUD, triggerAutoBounce, baseZoom }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const noiseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const lastTriggerRef = useRef<number>(0);

  // Game State Root
  const gameState = useRef<GameState>({
    player: { position: { x: 0, y: 479 }, velocity: { x: 0, y: 0 }, radius: 20, health: 100, mass: 1.5, onGround: false, trail: [] },
    camera: { position: { x: 0, y: 400 }, zoom: baseZoom, shake: 0 },
    input: { isDragging: false, startPos: { x: 0, y: 0 }, currentPos: { x: 0, y: 0 }, pointerId: -1 },
    world: { entities: [], platforms: [], lavaParticles: [], lavaOffset: 0 },
    worldGen: { nextRightX: 800, nextLeftX: -800 },
    combo: { multiplier: 1, timer: 0 },
    time: { scale: 1.0, lastFrame: 0, aliveDuration: 0 },
    boss: { nextSpawnTime: BOSS_SPAWN_INTERVAL, active: false, lastHealth: 0, maxHealth: 1, cycleCount: 0 },
    visuals: { aimLerp: 0, time: 0 },
    utility: { autoBounceState: 'OFF', activeTimer: 0, charge: 0, targetSearchTimer: 0, currentTargetId: null, missileTimer: 0, fireballTimer: 0, bombTimer: 0, lastHudUpdate: { unlocked: false, charge: -1, active: false, time: -1, bossHp: -1 } },
    score: 0, distanceRecord: 0,
  });

  // Init Noise Pattern
  useEffect(() => {
    if (!noiseCanvasRef.current) {
      const nc = document.createElement('canvas'); nc.width = 256; nc.height = 256;
      const ctx = nc.getContext('2d');
      if (ctx) {
        const idata = ctx.createImageData(256, 256); const buffer32 = new Uint32Array(idata.data.buffer);
        for (let i = 0; i < buffer32.length; i++) { const v = Math.random() * 20; buffer32[i] = (255 << 24) | (v << 16) | (v << 8) | v; }
        ctx.putImageData(idata, 0, 0); noiseCanvasRef.current = nc;
      }
    }
  }, []);

  // Preload Images - Use URL-resolved paths for spikes
  useEffect(() => {
    // Manually map spike IDs to resolved URLs
    const spikeImages: Record<string, string> = {
      'spike_normal': greenSpikeImg,
      'spike_super': redSpikeImg
    };

    Object.entries(spikeImages).forEach(([key, src]) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Required for cross-origin images to render on canvas!
      img.onload = () => console.log(`[IMG] Loaded: ${key} from ${src}`);
      img.onerror = (e) => console.error(`[IMG] FAILED: ${key} from ${src}`, e);
      img.src = src;
      imagesRef.current[key] = img;
    });
  }, []);

  // Resize
  useEffect(() => {
    const handleResize = () => { if (canvasRef.current) { canvasRef.current.width = window.innerWidth; canvasRef.current.height = window.innerHeight; } };
    window.addEventListener('resize', handleResize); handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset / Init on gameId change
  useEffect(() => {
    if (gameId > 0 && status === GameStateStatus.PLAYING) {
      const state = gameState.current;
      // Reset logic
      state.player = { position: { x: 0, y: 479 }, velocity: { x: 0, y: 0 }, radius: 20, health: upgrades.maxHealth, mass: 1.5, onGround: false, trail: [] };
      state.score = 0;
      state.distanceRecord = 0;
      state.combo = { multiplier: 1, timer: 0 };
      state.time.aliveDuration = 0;
      state.boss = { nextSpawnTime: BOSS_SPAWN_INTERVAL, active: false, lastHealth: 0, maxHealth: 1, cycleCount: 0 };
      state.camera.zoom = baseZoom;
      state.camera.position = { x: 0, y: 400 };
      state.utility = { autoBounceState: 'OFF', activeTimer: 0, charge: 0, targetSearchTimer: 0, currentTargetId: null, missileTimer: 0, fireballTimer: 0, bombTimer: 0, lastHudUpdate: { unlocked: false, charge: -1, active: false, time: -1, bossHp: -1 } };
      lastTriggerRef.current = triggerAutoBounce;

      // Full World Re-Init
      initializeWorld(state);
    }
  }, [gameId, upgrades.maxHealth, baseZoom]);

  // Main Loop
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    let animationFrameId: number;
    let noisePattern: CanvasPattern | null = null;

    const loop = (timestamp: number) => {
      // If paused, just render last frame but don't update
      if (status !== GameStateStatus.PLAYING) {
        if (status === GameStateStatus.PAUSED || status === GameStateStatus.GAME_OVER) {
          // Optional: Render one last frame or keep rendering loop for "frozen" effect
          // We can allow rendering to continue to show particle decays/idle animations even if game is "over" visually, 
          // but 'updateGame' shouldn't run.
          if (status === GameStateStatus.PAUSED) renderGame(ctx, canvas, gameState.current, upgrades, baseZoom, noisePattern, imagesRef.current);
        }
        animationFrameId = requestAnimationFrame(loop);
        return;
      }

      if (!noisePattern && noiseCanvasRef.current) noisePattern = ctx.createPattern(noiseCanvasRef.current, 'repeat');

      const state = gameState.current;
      let dt = (timestamp - state.time.lastFrame) / 1000;
      state.time.lastFrame = timestamp;
      if (dt > 0.05) dt = 0.05; // Cap dt

      // Input Trigger for AutoBounce
      if (triggerAutoBounce > lastTriggerRef.current) {
        lastTriggerRef.current = triggerAutoBounce;
        if (state.utility.autoBounceState === 'OFF' && autoBounceLevel >= 1 && state.utility.charge >= 1.0) {
          state.utility.autoBounceState = 'ACTIVE';
          state.utility.activeTimer = 2.0 + (5.0 - 2.0) * ((autoBounceLevel - 1) / 8);
          state.input.isDragging = false;
          audio.playSFX('charge');
        }
      }

      // Logic Step
      updateGame(state, dt, upgrades, { onGameOver, onUpdateStats, onUpdateHUD });

      // Render Step
      renderGame(ctx, canvas, state, upgrades, baseZoom, noisePattern, imagesRef.current);

      animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);

    // Input Handling
    const handleDown = (x: number, y: number, id: number) => {
      if (gameState.current.player.health <= 0 || gameState.current.utility.autoBounceState === 'ACTIVE' || status !== GameStateStatus.PLAYING) return;
      gameState.current.input.isDragging = true;
      gameState.current.input.pointerId = id;
      gameState.current.input.startPos = { x, y };
      gameState.current.input.currentPos = { x, y };
    };
    const handleMove = (x: number, y: number, id: number) => {
      if (gameState.current.input.isDragging && gameState.current.input.pointerId === id) gameState.current.input.currentPos = { x, y };
    };
    const handleUp = (id: number) => {
      const input = gameState.current.input;
      if (input.isDragging && input.pointerId === id) {
        input.isDragging = false;
        const dragVec = sub(input.startPos, input.currentPos);
        const dragMag = Math.min(mag(dragVec), 300);
        if (dragMag > 10) {
          const dir = normalize(dragVec);
          const force = dragMag * 5.0 * upgrades.speedMultiplier;
          gameState.current.player.velocity = mult(dir, force);
          gameState.current.player.health -= 6;
          audio.playSFX('launch');
          spawnDirectionalBurst(gameState.current, gameState.current.player.position, mult(dir, -1), Math.floor(dragMag / 3), dragMag * 2);
        }
      }
    };

    const onMouseDown = (e: MouseEvent) => handleDown(e.clientX, e.clientY, 1);
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY, 1);
    const onMouseUp = (e: MouseEvent) => handleUp(1);
    const onTouchStart = (e: TouchEvent) => handleDown(e.changedTouches[0].clientX, e.changedTouches[0].clientY, e.changedTouches[0].identifier);
    const onTouchMove = (e: TouchEvent) => { if (gameState.current.input.isDragging) e.preventDefault(); handleMove(e.changedTouches[0].clientX, e.changedTouches[0].clientY, e.changedTouches[0].identifier); };
    const onTouchEnd = (e: TouchEvent) => { if (gameState.current.input.isDragging) e.preventDefault(); handleUp(e.changedTouches[0].identifier); };

    canvas.addEventListener('mousedown', onMouseDown); window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false }); window.addEventListener('touchmove', onTouchMove, { passive: false }); window.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart); window.removeEventListener('touchmove', onTouchMove); window.removeEventListener('touchend', onTouchEnd);
    };
  }, [status, upgrades, autoBounceLevel, onUpdateHUD, triggerAutoBounce, baseZoom, gameId]);

  return <canvas ref={canvasRef} className={`absolute top-0 left-0 w-full h-full cursor-crosshair`} />;
};

export default GameCanvas;
