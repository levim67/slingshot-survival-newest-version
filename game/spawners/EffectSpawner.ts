
import { GameState, Entity, Vector2 } from '../../types';
import { add, mult, normalize, sub, mag, randomRange } from '../../utils/physics';

/**
 * Spawns floating text that rises and fades
 */
export const spawnFloatingText = (state: GameState, pos: Vector2, text: string, color: string) => {
    state.world.entities.push({
        id: `text_${Math.random()}`,
        type: 'floating_text',
        position: { ...pos },
        velocity: { x: 0, y: -100 },
        color: color,
        text: text,
        radius: 20,
        lifeTime: 0.8
    });
};

/**
 * Spawns a rapidly expanding shockwave ring effect
 */
export const spawnShockwaveRing = (state: GameState, pos: Vector2, radius: number, color: string) => {
    if (state.world.entities.length > 1200) return;

    state.world.entities.push({
        id: `shockwave_${Math.random()}`,
        type: 'shockwave_ring',
        position: { ...pos },
        radius: 10,
        color: color,
        lifeTime: 0.3,
        velocity: { x: 0, y: 0 }
    });
};

/**
 * Adds camera shake (capped at 50)
 */
export const addShake = (state: GameState, amount: number) => {
    state.camera.shake = Math.min(state.camera.shake + amount, 50);
};

/**
 * Finds the best target for auto-aim (missiles, auto-bounce)
 */
export const findBestTarget = (state: GameState): Entity | null => {
    let best: Entity | null = null;
    let minScore = -Infinity;

    const candidates = state.world.entities.filter(e =>
        (e.type === 'ball' && e.ballDef?.isTarget) ||
        (e.type === 'boss' && (e.bossData?.type === 'CUBE_OVERLORD' || e.bossData?.wormSegmentType === 'HEAD'))
    );

    for (const e of candidates) {
        const d = Math.sqrt((state.player.position.x - e.position.x) ** 2 + (state.player.position.y - e.position.y) ** 2);
        if (d > 1200) continue;

        let score = -d;
        if (e.type === 'boss') score += 2000;
        if (e.ballDef?.rarityTag === 'RARE' || e.ballDef?.rarityTag === 'VERY_RARE') score += 500;

        if (score > minScore) {
            minScore = score;
            best = e;
        }
    }
    return best;
};

/**
 * Finds the best target for bombs
 */
export const findBombTarget = (state: GameState): Vector2 | null => {
    const candidates = state.world.entities.filter(e =>
        (e.type === 'ball' && (e.ballDef?.isTarget || e.ballDef?.isHazard)) ||
        e.type === 'boss'
    );
    let best = null;
    let minDist = 800;

    for (const c of candidates) {
        const d = Math.sqrt((state.player.position.x - c.position.x) ** 2 + (state.player.position.y - c.position.y) ** 2);
        if (d < minDist) {
            minDist = d;
            best = c.position;
        }
    }
    return best;
};
