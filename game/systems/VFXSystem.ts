
import { GameState, Vector2 } from '../../types';
import { add, mult, normalize, sub, mag, randomRange } from '../../utils/physics';
import * as audio from '../../utils/audio';

/**
 * Spawns a firework-style explosion effect with flash, chunks, and sparks
 */
export const spawnExplosion = (state: GameState, pos: Vector2, c1: string, c2: string, vel: Vector2) => {
    const isCapped = state.world.entities.length > 1200;

    // 1. THE FLASH (Immediate bright expansion)
    state.world.entities.push({
        id: Math.random().toString(),
        type: 'particle',
        position: { ...pos },
        radius: 60,
        color: '#ffffff',
        lifeTime: 0.1,
        scaleDecay: true,
        shape: 'circle'
    });

    // 2. THE CHUNKS (Geometric debris)
    const chunkCount = isCapped ? 6 : 18;
    for (let i = 0; i < chunkCount; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(100, 500);
        const shapeType = Math.random() < 0.33 ? 'circle' : (Math.random() < 0.5 ? 'triangle' : 'square');

        state.world.entities.push({
            id: Math.random().toString(),
            type: 'particle',
            position: { ...pos },
            radius: randomRange(6, 15),
            color: Math.random() > 0.5 ? c1 : c2,
            velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            lifeTime: randomRange(0.6, 1.2),
            gravity: true,
            drag: 0.96,
            angularVelocity: randomRange(-10, 10),
            shape: shapeType,
            scaleDecay: true
        });
    }

    // 3. THE SPARKS (High speed trails)
    const sparkCount = isCapped ? 10 : 30;
    for (let i = 0; i < sparkCount; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(400, 1000);
        state.world.entities.push({
            id: Math.random().toString(),
            type: 'particle',
            position: { ...pos },
            radius: randomRange(2, 5),
            color: c2,
            velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            lifeTime: randomRange(0.3, 0.6),
            isSpark: true,
            drag: 0.9,
            gravity: true
        });
    }
};

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
            state.world.entities.push({
                id: `flash_${Math.random()}`, type: 'particle',
                position: nearest.position, radius: 40, color: '#ffffff', lifeTime: 0.1, isSpark: false
            });
            audio.playSFX('lightning', 0.6);
            destroyBallFn(state, nearest, entitiesToRemove, 'CHAIN');
            current = nearest.position;
            rem--;
        } else break;
    }
};
