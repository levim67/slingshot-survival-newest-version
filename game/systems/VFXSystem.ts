
import { GameState, Vector2 } from '../../types';
import { add, mult, normalize, sub, mag, randomRange } from '../../utils/physics';
import * as audio from '../../utils/audio';

// ==========================================
// DEBRIS POOLING SYSTEM
// ==========================================
const MAX_ACTIVE_DEBRIS = 300;
const MAX_DEBRIS_PER_EXPLOSION = 12;

const getActiveDebrisCount = (state: GameState): number => {
    return state.world.entities.filter(e => (e.type === 'particle' && e.isDebris) || e.type === 'debris').length;
};

/**
 * Gets LOD level based on distance from player
 * 0 = close (full detail), 1 = medium, 2 = far (minimal)
 */
const getDistanceLOD = (state: GameState, pos: Vector2): number => {
    const d = Math.sqrt((state.player.position.x - pos.x) ** 2 + (state.player.position.y - pos.y) ** 2);
    if (d < 400) return 0; // Close - full detail
    if (d < 800) return 1; // Medium
    return 2; // Far - minimal
};

// ==========================================
// BALL BREAK EXPLOSION - CHUNKY BREAKUP
// ==========================================

/**
 * Spawns a chunky ball break explosion
 * Phase 1: Quick burst (0.08-0.15s)
 * Phase 2: Slow cascade (0.25-0.9s)
 * 
 * NO FLASH. NO SHOCKWAVE RING.
 */
export const spawnExplosion = (state: GameState, pos: Vector2, c1: string, c2: string, vel: Vector2) => {
    const currentDebris = getActiveDebrisCount(state);
    if (currentDebris > MAX_ACTIVE_DEBRIS) {
        // Fallback to simple burst if limit reached
        spawnDirectionalBurst(state, pos, { x: 0, y: -1 }, 5, 200);
        return;
    }

    const lod = getDistanceLOD(state, pos);

    // Reduce particle counts based on LOD and global budget
    const budgetRatio = Math.max(0.4, 1 - (currentDebris / MAX_ACTIVE_DEBRIS));

    // --- NO FLASH (removed) ---

    // --- PHASE 1: QUICK BURST - Large Chunks (curved wedges) ---
    // Massive increase in debris for better "spray"
    const largeChunkCount = lod === 2 ? 3 : (lod === 1 ? 5 : Math.floor(8 * budgetRatio));
    for (let i = 0; i < largeChunkCount; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(300, 600); // MUCH FASTER (was 200-400)

        state.world.entities.push({
            id: `debris_lg_${Math.random()}`,
            type: 'particle',
            isDebris: true,
            position: { ...pos },
            radius: randomRange(18, 28), // Larger
            color: c1,
            velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            lifeTime: randomRange(0.7, 1.2), // Longer life
            gravity: true,
            drag: 0.96, // LOWER DRAG (was 0.94) - flies further
            angularVelocity: randomRange(-15, 15),
            shape: 'wedge',
            rotation: randomRange(0, Math.PI * 2),
            scaleDecay: true
        });
    }

    // --- Medium Shards (triangles) ---
    const mediumShardCount = lod === 2 ? 4 : (lod === 1 ? 8 : Math.floor(14 * budgetRatio));
    for (let i = 0; i < mediumShardCount; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(200, 500); // Faster

        state.world.entities.push({
            id: `debris_md_${Math.random()}`,
            type: 'particle',
            isDebris: true,
            position: { ...pos },
            radius: randomRange(10, 18),
            color: Math.random() > 0.5 ? c1 : c2,
            velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            lifeTime: randomRange(0.6, 1.0),
            gravity: true,
            drag: 0.94, // Lower drag
            angularVelocity: randomRange(-20, 20),
            shape: 'triangle',
            rotation: randomRange(0, Math.PI * 2),
            scaleDecay: true
        });
    }

    // --- Small Chips (dots) - sparky look ---
    if (lod < 2 && budgetRatio > 0.4) {
        const smallChipCount = lod === 1 ? 4 : Math.floor(8 * budgetRatio);
        for (let i = 0; i < smallChipCount; i++) {
            const angle = randomRange(0, Math.PI * 2);
            const speed = randomRange(100, 300);

            state.world.entities.push({
                id: `debris_sm_${Math.random()}`,
                type: 'particle',
                isDebris: true,
                position: { ...pos },
                radius: randomRange(3, 6),
                color: c2,
                velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
                lifeTime: randomRange(0.4, 0.7),
                gravity: true,
                drag: 0.85,
                isSpark: true,
                shape: 'circle',
                scaleDecay: true
            });
        }
    }
};

// ==========================================
// BOMB FIERY EXPLOSION
// ==========================================

/**
 * Spawns a fiery bomb explosion
 * Orange/yellow core, embers, NO flash, NO shockwave
 */
export const spawnFieryExplosion = (state: GameState, pos: Vector2, intensity: number = 1.0) => {
    const currentDebris = getActiveDebrisCount(state);
    const budgetRatio = Math.max(0.3, 1 - (currentDebris / MAX_ACTIVE_DEBRIS));

    // --- Fiery Core Glow (brief orange expansion) ---
    state.world.entities.push({
        id: `fire_core_${Math.random()}`,
        type: 'particle',
        position: { ...pos },
        radius: 40 * intensity,
        color: '#ff6b00',
        lifeTime: 0.15,
        scaleDecay: false, // Expand then fade
        shape: 'circle'
    });

    // --- Flame Burst (fast expansion) ---
    const flameCount = Math.floor(8 * budgetRatio * intensity);
    for (let i = 0; i < flameCount; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(200, 400);

        state.world.entities.push({
            id: `flame_${Math.random()}`,
            type: 'particle',
            isDebris: true,
            position: { ...pos },
            radius: randomRange(15, 30),
            color: Math.random() > 0.5 ? '#ff8c00' : '#ffa500',
            velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed - 50 },
            lifeTime: randomRange(0.2, 0.4),
            drag: 0.9,
            shape: 'circle',
            scaleDecay: true
        });
    }

    // --- Embers (gravity falling) ---
    const emberCount = Math.floor(12 * budgetRatio * intensity);
    for (let i = 0; i < emberCount; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(100, 300);

        state.world.entities.push({
            id: `ember_${Math.random()}`,
            type: 'particle',
            isDebris: true,
            position: { ...pos },
            radius: randomRange(2, 5),
            color: Math.random() > 0.3 ? '#ffcc00' : '#ff4500',
            velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed - 100 },
            lifeTime: randomRange(0.4, 0.8),
            gravity: true,
            drag: 0.95,
            isSpark: true,
            scaleDecay: true
        });
    }

    // --- Light Smoke (very subtle, fades quickly) ---
    if (budgetRatio > 0.6) {
        for (let i = 0; i < 3; i++) {
            state.world.entities.push({
                id: `smoke_${Math.random()}`,
                type: 'particle',
                position: add(pos, { x: randomRange(-20, 20), y: randomRange(-20, 20) }),
                velocity: { x: randomRange(-30, 30), y: randomRange(-80, -40) },
                radius: randomRange(20, 35),
                color: '#333333',
                lifeTime: randomRange(0.3, 0.5),
                shape: 'smoke',
                drag: 0.98
            });
        }
    }
};

// ==========================================
// EXISTING UTILITIES (kept unchanged)
// ==========================================

/**
 * Spawns directional particle burst (for launches, impacts)
 */
export const spawnDirectionalBurst = (state: GameState, pos: Vector2, dir: Vector2, count: number, forceMagnitude: number = 100) => {
    if (state.world.entities.length > 1200) return;

    const baseSpread = 0.3;
    const spread = baseSpread + (forceMagnitude / 300) * 0.5;
    const baseSpeed = 50;
    const speedScale = 2.0 + (forceMagnitude / 300) * 3.0;
    for (let i = 0; i < count; i++) {
        const angle = Math.atan2(dir.y, dir.x) + randomRange(-spread, spread);
        const speed = randomRange(baseSpeed, baseSpeed * 2) * speedScale;
        state.world.entities.push({
            id: Math.random().toString(), type: 'particle', position: { ...pos },
            radius: randomRange(3, 8), color: '#ffffff', velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            lifeTime: randomRange(0.4, 1.0), shape: 'square', rotation: randomRange(0, Math.PI * 2), angularVelocity: randomRange(-10, 10), drag: 0.92, gravity: false
        });
    }
};

/**
 * Generates jagged lightning points between two positions
 */
export const generateLightningPoints = (start: Vector2, end: Vector2): Vector2[] => {
    const points = [start];
    const segments = 8;
    const d = sub(end, start);
    const len = mag(d);
    const norm = normalize({ x: -d.y, y: d.x });
    for (let i = 1; i < segments; i++) {
        const t = i / segments;
        points.push(add(add(start, mult(d, t)), mult(norm, randomRange(-len * 0.15, len * 0.15))));
    }
    points.push(end);
    return points;
};

/**
 * Triggers chain lightning effect between nearby targets
 */
export const triggerChainLightning = (
    state: GameState,
    startPos: Vector2,
    chainCount: number,
    entitiesToRemove: Set<string>,
    destroyBallFn: (state: GameState, entity: any, entitiesToRemove: Set<string>, cause: string) => void
) => {
    let current = startPos;
    let rem = Math.min(20, Math.floor(chainCount));
    const visited = new Set<string>();
    while (rem > 0) {
        let nearest = null;
        let minD = Infinity;
        for (const e of state.world.entities) {
            if (e.invulnerableTime && e.invulnerableTime > 0) continue;
            if (e.type === 'ball' && e.ballDef?.isTarget && !entitiesToRemove.has(e.id) && !visited.has(e.id)) {
                const d = Math.sqrt((current.x - e.position.x) ** 2 + (current.y - e.position.y) ** 2);
                if (d < 500 && d < minD) { minD = d; nearest = e; }
            }
        }
        if (nearest) {
            visited.add(nearest.id);
            entitiesToRemove.add(nearest.id);
            state.world.entities.push({
                id: `lightning_${Math.random()}`, type: 'lightning',
                points: generateLightningPoints(current, nearest.position),
                lifeTime: 0.3, position: current, radius: 0, color: '#00ffff'
            });
            // NO FLASH for chain lightning hits
            audio.playSFX('lightning', 0.6);
            destroyBallFn(state, nearest, entitiesToRemove, 'CHAIN');
            current = nearest.position;
            rem--;
        } else break;
    }
};

const generateShardShape = (radius: number): Vector2[] => {
    const points: Vector2[] = [];
    const count = Math.floor(randomRange(5, 8)); // 5-8 vertices for jagged look
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        // Randomize radius for jaggedness (0.5 to 1.0 of max radius)
        const r = radius * randomRange(0.5, 1.0);
        points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    return points;
};

/**
 * Spawns a procedural "Space Burst" explosion
 * Clean, solid shards, firework-like expansion, zero-g float
 */
export const spawnDebrisExplosion = (
    state: GameState,
    pos: Vector2,
    baseColor: string,
    scale: number = 1.0 // Multiplier for size (e.g. 2.5 for bosses)
) => {
    // Check global limits
    if (getActiveDebrisCount(state) > MAX_ACTIVE_DEBRIS) {
        spawnExplosion(state, pos, baseColor, baseColor, { x: 0, y: 0 });
        return;
    }

    // 1. PROCEDURAL SHARDS (The main event)
    const count = Math.floor(18 * scale); // More shards for larger explosions
    for (let i = 0; i < count; i++) {
        const angle = randomRange(0, Math.PI * 2);
        // High initial burst speed - smooth "firework" expansion
        // REDUCED SPEED to prevent "teleporting" look
        const speed = randomRange(150, 500) * (0.8 + Math.random() * 0.4);

        // Randomize size
        const baseSize = Math.random() > 0.7 ? randomRange(20, 35) : randomRange(10, 18);
        const size = baseSize * scale;

        state.world.entities.push({
            id: `shard_${Math.random()}`,
            type: 'debris',
            position: { ...pos },
            velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            radius: size,
            rotation: randomRange(0, Math.PI * 2),
            angularVelocity: randomRange(-4, 4), // Slower rotation
            lifeTime: randomRange(2.0, 3.5), // Long life for float
            gravity: false,
            drag: 0.96, // Burst -> Stop -> Float
            shape: 'shard',
            points: generateShardShape(size),
            color: baseColor,
            scaleDecay: true,
            scale: 1.0
        });
    }

    // 2. SPARKS (High speed gold streaks)
    const sparkCount = Math.floor(40 * scale);
    for (let i = 0; i < sparkCount; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(600, 1400); // Faster than debris
        state.world.entities.push({
            id: `spark_${Math.random()}`,
            type: 'particle',
            position: { ...pos },
            radius: randomRange(2, 4) * scale,
            color: '#fbbf24', // Amber/Yellow (Firework feel)
            velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            lifeTime: randomRange(0.5, 0.9),
            shape: 'square',
            drag: 0.88,
            gravity: false,
            scaleDecay: true,
            isSpark: true
        });
    }

    // 3. SMOKE (Volumetric background clouds)
    const smokeCount = Math.floor(12 * scale);
    for (let i = 0; i < smokeCount; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(50, 200);
        state.world.entities.push({
            id: `smoke_${Math.random()}`,
            type: 'particle',
            position: { ...pos },
            radius: randomRange(30, 60) * scale,
            color: '#555555', // Neutral grey
            velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            lifeTime: randomRange(2.0, 3.0), // Lingers properly
            shape: 'smoke',
            drag: 0.92,
            gravity: false,
            scaleDecay: true
        });
    }
};
