
import { GameState, Entity, BallTypeId, LavaParticle } from '../../types';
import { randomRange, checkCircleRect, dist } from '../../utils/physics';
import { LAVA_LEVEL, CHUNK_SIZE, GENERATION_BUFFER, BALL_DEFINITIONS } from '../../utils/constants';

/**
 * Creates a lava particle (bubble or spark)
 */
export const createLavaParticle = (xBase: number): LavaParticle => {
    const isSpark = Math.random() > 0.6;
    return {
        x: xBase + randomRange(-1000, 1000),
        y: LAVA_LEVEL + randomRange(0, 300),
        vx: randomRange(-20, 20),
        vy: isSpark ? randomRange(-150, -50) : randomRange(-40, -10),
        life: randomRange(0.5, 3.0),
        maxLife: randomRange(1.0, 4.0),
        type: isSpark ? 'spark' : 'bubble',
        size: isSpark ? randomRange(1, 3) : randomRange(4, 12)
    };
};

/**
 * Picks a random ball type based on weighted probabilities
 */
const pickBallType = (): BallTypeId => {
    const r = Math.random();
    // 55% Common Targets
    if (r < 0.55) return 'red_common';
    // 10% Gold
    if (r < 0.65) return 'gold_rare';
    // 10% Utility
    if (r < 0.75) return 'juice_refill';
    // Hazards
    if (r < 0.83) return 'spike_normal';
    if (r < 0.88) return 'spike_super';
    // Enemies
    if (r < 0.92) return 'missile_battery';
    if (r < 0.95) return 'flame_enemy';
    if (r < 0.98) return 'electric_enemy';
    // Special
    if (r < 0.99) return 'pink_launch';
    return 'cash_jackpot';
};

/**
 * Spawns entities in a horizontal chunk of the world
 */
export const spawnChunkEntities = (state: GameState, startX: number, endX: number) => {
    const count = Math.floor((endX - startX) / 20);
    const entitiesToAdd: Entity[] = [];

    for (let i = 0; i < count; i++) {
        const typeId = pickBallType();
        const def = BALL_DEFINITIONS[typeId];
        const r = def.radius;

        let valid = false;
        let pos = { x: 0, y: 0 };
        let attempts = 0;

        while (!valid && attempts < 50) {
            attempts++;
            pos = {
                x: startX + Math.random() * (endX - startX),
                y: randomRange(-4000, LAVA_LEVEL - 200)
            };

            // 1. Lava Check
            if (pos.y + r > LAVA_LEVEL - 50) continue;

            // 2. Platform Check
            let hitPlatform = false;
            for (const plat of state.world.platforms) {
                if (checkCircleRect(pos, r + 50, plat.position, plat.size).collision) {
                    hitPlatform = true;
                    break;
                }
            }
            if (hitPlatform) continue;

            // 3. Entity Overlap Check
            let hitEntity = false;
            for (const e of entitiesToAdd) {
                if (dist(pos, e.position) < r + e.radius + 30) {
                    hitEntity = true;
                    break;
                }
            }
            if (!hitEntity) {
                for (const e of state.world.entities) {
                    // OPTIMIZATION: Ignore particles (debris, trails)
                    if (e.type === 'particle' || e.type === 'floating_text' || e.type === 'shockwave') continue;

                    if (Math.abs(e.position.x - pos.x) < 200) {
                        if (dist(pos, e.position) < r + e.radius + 30) {
                            hitEntity = true;
                            break;
                        }
                    }
                }
            }
            if (hitEntity) continue;

            valid = true;
        }

        if (valid) {
            entitiesToAdd.push({
                id: `gen_${Math.random()}`,
                type: 'ball',
                ballType: typeId,
                ballDef: def,
                position: pos,
                radius: def.radius,
                color: def.coreColor,
                velocity: { x: 0, y: 0 },
                mass: def.mass,
                rotation: Math.random() * Math.PI * 2
            });
        }
    }
    state.world.entities.push(...entitiesToAdd);
};

/**
 * Updates procedural world generation based on player position
 */
export const updateWorldGeneration = (state: GameState) => {
    const buffer = GENERATION_BUFFER;
    if (state.player.position.x + buffer > state.worldGen.nextRightX) {
        spawnChunkEntities(state, state.worldGen.nextRightX, state.worldGen.nextRightX + CHUNK_SIZE);
        state.worldGen.nextRightX += CHUNK_SIZE;
    }
    if (state.player.position.x - buffer < state.worldGen.nextLeftX) {
        spawnChunkEntities(state, state.worldGen.nextLeftX - CHUNK_SIZE, state.worldGen.nextLeftX);
        state.worldGen.nextLeftX -= CHUNK_SIZE;
    }
};

/**
 * Initializes the world with starting platform and entities
 */
export const initializeWorld = (state: GameState) => {
    state.world.entities = [];
    state.world.platforms = [];
    state.world.lavaParticles = [];

    // Add Start Platform
    state.world.platforms.push({ id: 'start', position: { x: -400, y: 500 }, size: { x: 800, y: 1000 }, type: 'start' });

    // Add Initial Lava
    for (let i = 0; i < 80; i++) state.world.lavaParticles.push(createLavaParticle(0));

    // Spawn Initial Entities (Safe Zone -1000 to 1000)
    spawnChunkEntities(state, -1000, 1000);

    // Reset Gen Pointers
    state.worldGen.nextRightX = 1000;
    state.worldGen.nextLeftX = -1000;
};
