
import { GameState, Upgrades, Vector2 } from '../../types';
import { add, mult, normalize, randomRange, clamp } from '../../utils/physics';
import { GRAVITY } from '../../utils/constants';
import * as audio from '../../utils/audio';
import { spawnExplosion } from '../systems/VFXSystem';
import { spawnShockwaveRing } from './EffectSpawner';

/**
 * Spawns a friendly homing missile (or super missile if paragon unlocked)
 */
export const spawnFriendlyMissile = (state: GameState, pos?: Vector2, upgrades?: Upgrades) => {
    // PARAGON OVERRIDE
    if (upgrades && upgrades.unlockParagonSuperMissile) {
        spawnSuperMissile(state, pos);
        return;
    }

    const spawnPos = pos ? { ...pos } : { ...state.player.position };
    if (!pos) spawnPos.y -= 50;
    state.world.entities.push({
        id: `friend_m_${Math.random()}`, type: 'friendly_missile',
        position: spawnPos, velocity: { x: randomRange(-200, 200), y: -400 },
        radius: 10, color: '#00ffff', lifeTime: 4.0
    });
    spawnExplosion(state, spawnPos, '#00ffff', '#ffffff', { x: 0, y: -100 });
    audio.playSFX('missile');
};

/**
 * Spawns a super missile (paragon upgrade)
 */
export const spawnSuperMissile = (state: GameState, pos?: Vector2) => {
    const spawnPos = pos ? { ...pos } : { ...state.player.position };
    if (!pos) spawnPos.y -= 50;

    state.world.entities.push({
        id: `super_m_${Math.random()}`,
        type: 'super_missile',
        position: spawnPos,
        velocity: { x: randomRange(-300, 300), y: -500 },
        radius: 16,
        color: '#22d3ee',
        lifeTime: 6.0,
        trail: []
    });

    if (state.world.entities.length < 1200) {
        spawnShockwaveRing(state, spawnPos, 80, '#22d3ee');
    }
    audio.playSFX('super_launch');
};

/**
 * Spawns mini missiles when super missile splits
 */
export const spawnSuperMissileSplit = (state: GameState, pos: Vector2, count: number) => {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const vel = { x: Math.cos(angle) * 600, y: Math.sin(angle) * 600 };
        state.world.entities.push({
            id: `mini_super_m_${Math.random()}`,
            type: 'mini_super_missile',
            position: { ...pos },
            velocity: vel,
            radius: 8,
            color: '#a5f3fc',
            lifeTime: 2.0,
            trail: []
        });
    }
    audio.playSFX('mini_launch');
};

/**
 * Spawns a friendly bomb that arcs toward target
 */
export const spawnFriendlyBomb = (state: GameState, targetPos: Vector2) => {
    const spawnPos = { x: state.player.position.x, y: state.player.position.y - 20 };
    const dx = targetPos.x - spawnPos.x;
    const dy = targetPos.y - spawnPos.y;

    const distance = Math.abs(dx);
    const time = clamp(distance / 600, 0.6, 1.2);

    const vx = dx / time;
    const vy = (dy - 0.5 * GRAVITY * time * time) / time;

    state.world.entities.push({
        id: `bomb_${Math.random()}`, type: 'bomb', position: spawnPos,
        velocity: { x: vx, y: vy }, radius: 14, color: '#000000',
        lifeTime: time + 0.5,
        rotation: 0
    });
    audio.playSFX('bomb_throw', 0.6);
};

/**
 * Spawns a friendly fireball
 */
export const spawnFriendlyFireball = (state: GameState) => {
    const spawnPos = { x: state.player.position.x, y: state.player.position.y - 80 };
    state.world.entities.push({
        id: `friend_f_${Math.random()}`, type: 'friendly_fireball',
        position: spawnPos, velocity: { x: randomRange(-100, 100), y: -600 },
        radius: 18, color: '#f97316', lifeTime: 5.0
    });
    spawnExplosion(state, spawnPos, '#f97316', '#fbbf24', { x: 0, y: -100 });
    audio.playSFX('fireball');
};

/**
 * Spawns acid spit from worm boss
 */
export const spawnAcidSpit = (state: GameState, pos: Vector2, targetPos: Vector2) => {
    state.world.entities.push({
        id: `acid_${Math.random()}`,
        type: 'acid_spit',
        targetId: 'player',
        position: { ...pos },
        velocity: { x: 0, y: 0 },
        radius: 12,
        color: '#a3e635',
        lifeTime: 5.0
    });
};
