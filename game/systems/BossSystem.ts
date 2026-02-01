
import { GameState, Entity, Upgrades, Vector2 } from '../../types';
import { add, sub, mult, mag, normalize, dist, randomRange } from '../../utils/physics';
import { GRAVITY, BALL_DEFINITIONS } from '../../utils/constants';
import * as audio from '../../utils/audio';
import { spawnFloatingText, addShake } from '../spawners/EffectSpawner';
import { spawnExplosion, spawnDirectionalBurst, spawnDebrisExplosion } from './VFXSystem';
import { spawnAcidSpit } from '../spawners/ProjectileSpawner';
import { killBoss } from '../spawners/BossSpawner';

/**
 * Updates Cube Overlord boss AI state machine
 */
export const updateCubeBossAI = (state: GameState, boss: Entity, dt: number) => {
    if (!boss.bossData) return;
    const data = boss.bossData;

    // Handle Cinematic Death - CHECK THIS FIRST
    if (data.state === 'DYING') {
        handleBossDeathSequence(state, boss, dt);
        return;
    }

    const toPlayer = sub(state.player.position, boss.position);
    const distToPlayer = mag(toPlayer);

    // OFF-SCREEN CATCHUP MECHANIC
    if (distToPlayer > 1500) {
        if (data.state === 'SHOOTING' || data.state === 'FIRE_NOVA' || data.state === 'LIGHTNING_STORM' || data.state === 'ALIGNING') {
            data.state = 'IDLE_VULNERABLE';
            data.stateTimer = 2.0;
        }
    }

    data.stateTimer -= dt;
    if (data.invincibilityTimer > 0) data.invincibilityTimer -= dt;

    switch (data.state) {
        case 'SPAWNING':
            boss.velocity = { x: 0, y: 20 };
            if (data.stateTimer <= 0) { data.state = 'ALIGNING'; data.stateTimer = 1.5; }
            break;
        case 'IDLE_VULNERABLE':
            const target = { x: state.player.position.x, y: state.player.position.y - 400 };
            const lerpFactor = distToPlayer > 1000 ? 5 : 2;
            const boost = distToPlayer > 2000 ? 10 : lerpFactor;

            boss.position.x += (target.x - boss.position.x) * boost * dt;
            boss.position.y += (target.y - boss.position.y) * boost * dt;
            boss.rotation = (boss.rotation || 0) + 1 * dt;
            if (data.stateTimer <= 0) { data.state = 'ALIGNING'; data.stateTimer = 1.0; audio.playSFX('charge', 0.8); }
            break;
        case 'ALIGNING':
            boss.velocity = { x: 0, y: 0 };
            boss.position.x += randomRange(-5, 5);
            boss.position.y += randomRange(-5, 5);
            if (data.stateTimer <= 0) {
                const r = Math.random();
                if (r < 0.25) { data.state = 'SHOOTING'; data.stateTimer = 1.2; }
                else if (r < 0.5) { data.state = 'DASHING'; data.stateTimer = 0.8; boss.velocity = mult(normalize(toPlayer), 2200); audio.playSFX('boss_roar', 1.0); }
                else if (r < 0.75) { data.state = 'LIGHTNING_STORM'; data.stateTimer = 0.5; data.subStage = 5; audio.playSFX('electric_charge', 1.0); }
                else { data.state = 'FIRE_NOVA'; data.stateTimer = 1.5; audio.playSFX('charge', 1.0); }
            }
            break;
        case 'DASHING':
            boss.rotation = (boss.rotation || 0) + 15 * dt;
            boss.position = add(boss.position, mult(boss.velocity || { x: 0, y: 0 }, dt));
            if (data.stateTimer <= 0) {
                boss.velocity = mult(boss.velocity || { x: 0, y: 0 }, 0.1);
                data.attackCounter++;
                if (data.attackCounter >= 4) { data.attackCounter = 0; data.state = 'IDLE_VULNERABLE'; data.stateTimer = 4.0; }
                else { data.state = 'ALIGNING'; data.stateTimer = 0.5; }
            }
            break;
        case 'SHOOTING':
            boss.rotation = Math.atan2(toPlayer.y, toPlayer.x);
            if (data.stateTimer <= 0) {
                for (let i = 0; i < 7; i++) {
                    const a = boss.rotation - 0.6 + (1.2 * (i / 6));
                    state.world.entities.push({
                        id: `boss_m_${Math.random()}`, type: 'missile', targetId: 'player',
                        position: { ...boss.position }, velocity: { x: Math.cos(a) * 700, y: Math.sin(a) * 700 },
                        radius: 15, color: '#ef4444', lifeTime: 6.0
                    });
                }
                audio.playSFX('launch', 1.0);
                spawnDirectionalBurst(state, boss.position, { x: Math.cos(boss.rotation), y: Math.sin(boss.rotation) }, 20, 300);
                data.attackCounter++;
                if (data.attackCounter >= 4) { data.attackCounter = 0; data.state = 'IDLE_VULNERABLE'; data.stateTimer = 4.0; }
                else { data.state = 'ALIGNING'; data.stateTimer = 0.8; }
            }
            break;
        case 'FIRE_NOVA':
            boss.rotation = (boss.rotation || 0) + 20 * dt;
            if (data.stateTimer <= 0) {
                for (let i = 0; i < 12; i++) {
                    const a = (Math.PI * 2 * i) / 12;
                    state.world.entities.push({
                        id: `boss_f_${Math.random()}`, type: 'fireball', targetId: 'player',
                        position: { ...boss.position }, velocity: { x: Math.cos(a) * 600, y: Math.sin(a) * 600 },
                        radius: 20, color: '#f97316', lifeTime: 5.0
                    });
                }
                audio.playSFX('fireball', 1.0);
                spawnExplosion(state, boss.position, '#f97316', '#fbbf24', { x: 0, y: 0 });
                data.attackCounter++;
                if (data.attackCounter >= 4) { data.attackCounter = 0; data.state = 'IDLE_VULNERABLE'; data.stateTimer = 4.0; }
                else { data.state = 'ALIGNING'; data.stateTimer = 0.8; }
            }
            break;
        case 'LIGHTNING_STORM':
            if (data.stateTimer <= 0) {
                if (data.subStage && data.subStage > 0) {
                    state.world.entities.push({
                        id: `boss_s_${Math.random()}`, type: 'ball',
                        ballType: 'electric_enemy', ballDef: BALL_DEFINITIONS['electric_enemy'],
                        position: { x: state.player.position.x + randomRange(-100, 100), y: state.player.position.y - 400 },
                        radius: 1, color: 'transparent', velocity: { x: 0, y: 0 },
                        attackCharge: 1.0, lifeTime: 2.0, aimPosition: state.player.position
                    });
                    data.subStage--; data.stateTimer = 0.4;
                } else {
                    data.attackCounter++;
                    if (data.attackCounter >= 4) { data.attackCounter = 0; data.state = 'IDLE_VULNERABLE'; data.stateTimer = 4.0; }
                    else { data.state = 'ALIGNING'; data.stateTimer = 0.8; }
                }
            }
            break;
    }
};

/**
 * Updates Triangle Architect AI
 */
export const updateTriangleBossAI = (state: GameState, boss: Entity, dt: number) => {
    if (!boss.bossData) return;
    const data = boss.bossData;
    const toPlayer = sub(state.player.position, boss.position);
    const distToPlayer = mag(toPlayer);

    // Handle Cinematic Death
    if (data.state === 'DYING') {
        handleBossDeathSequence(state, boss, dt);
        return;
    }

    data.stateTimer -= dt;
    if (data.invincibilityTimer > 0) data.invincibilityTimer -= dt;

    // Movement: Generally float near player but maintain distance
    if (data.state === 'IDLE_VULNERABLE' || data.state === 'PRE_FIGHT') {
        const pTarget = state.player.position;
        const hoverY = pTarget.y - 450 + Math.sin(state.visuals.time * 2) * 50;
        boss.position.x += (pTarget.x - boss.position.x) * 2 * dt;
        boss.position.y += (hoverY - boss.position.y) * 2 * dt;
        boss.rotation = (boss.rotation || 0) + 1 * dt;
    }

    switch (data.state) {
        case 'PRE_FIGHT':
            if (data.stateTimer <= 0) { data.state = 'CLOSING_WALLS'; data.stateTimer = 1.0; }
            break;

        case 'IDLE_VULNERABLE':
            // === CLEAR VULNERABILITY INDICATOR ===
            boss.color = '#22d3ee'; // Cyan glow - VULNERABLE color

            // Pulsing size effect when vulnerable
            boss.radius = 80 + Math.sin(state.visuals.time * 10) * 10;

            // Show "ATTACK NOW!" every second to remind player
            if (Math.floor(data.stateTimer * 2) !== Math.floor((data.stateTimer + 0.1) * 2) || data.stateTimer === state.boss.lastHealth / 1000) {
                spawnFloatingText(state, { x: boss.position.x, y: boss.position.y - 100 }, '⚔️ ATTACK NOW! ⚔️', '#00ff00');
            }

            if (data.stateTimer <= 0) {
                // Pick next attack
                const r = Math.random();
                if (r < 0.2) { data.state = 'CLOSING_WALLS'; data.stateTimer = 1.0; }
                else if (r < 0.4) { data.state = 'ARC_BARRAGE'; data.stateTimer = 0.5; data.attackCounter = 0; }
                else if (r < 0.6) { data.state = 'SPIRAL_LANCES'; data.stateTimer = 0.5; data.subStage = 20; }
                else if (r < 0.8) { data.state = 'MINE_FIELD'; data.stateTimer = 0.5; }
                else { data.state = 'MISSILE_STORM'; data.stateTimer = 0.5; data.subStage = 5; }

                boss.color = '#06b6d4'; // Armored color
                boss.radius = 80; // Reset radius
                audio.playSFX('charge', 0.8);
                spawnFloatingText(state, { x: boss.position.x, y: boss.position.y - 80 }, '🛡️ SHIELDED 🛡️', '#ff0000');
            }
            break;

        case 'CLOSING_WALLS':
            // Telegraph Phase
            boss.rotation = (boss.rotation || 0) + 10 * dt;
            if (data.stateTimer > 0) {
                // Warning lines could be spawned here once
                if (data.stateTimer > 0.9) spawnFloatingText(state, state.player.position, "⚠️ WALLS DETECTED ⚠️", '#ff0000');
            } else {
                // EXECUTE
                spawnClosingWalls(state, state.player.position);
                audio.playSFX('super_launch');
                data.state = 'IDLE_VULNERABLE'; // Vulnerable after big attack
                data.stateTimer = 2.5;
            }
            break;

        case 'ARC_BARRAGE':
            boss.rotation = Math.atan2(toPlayer.y, toPlayer.x);
            if (data.stateTimer <= 0) {
                spawnDirectionalBurst(state, boss.position, normalize(toPlayer), 8, 800);
                audio.playSFX('launch');
                data.attackCounter++;
                if (data.attackCounter > 2) {
                    data.state = 'IDLE_VULNERABLE'; data.stateTimer = 2.0;
                } else {
                    data.stateTimer = 0.6; // Fire again
                }
            }
            break;

        case 'SPIRAL_LANCES':
            boss.rotation = (boss.rotation || 0) + 5 * dt;
            if (data.stateTimer <= 0 && data.subStage && data.subStage > 0) {
                const angle = state.visuals.time * 3 + (data.subStage * 0.2);
                const v = { x: Math.cos(angle) * 700, y: Math.sin(angle) * 700 };
                state.world.entities.push({
                    id: `lance_${Math.random()}`, type: 'missile',
                    position: { ...boss.position }, velocity: v,
                    radius: 12, color: '#fcd34d', lifeTime: 5.0, targetId: 'player'
                });
                if (data.subStage % 3 === 0) audio.playSFX('mini_launch', 0.5);
                data.subStage--;
                data.stateTimer = 0.15;
            } else if (data.subStage === 0) {
                data.state = 'IDLE_VULNERABLE'; data.stateTimer = 2.0;
            }
            break;

        case 'MISSILE_STORM':
            if (data.stateTimer <= 0 && data.subStage && data.subStage > 0) {
                state.world.entities.push({
                    id: `storm_${Math.random()}`, type: 'missile', targetId: 'player',
                    position: add(boss.position, { x: randomRange(-100, 100), y: randomRange(-100, 100) }),
                    velocity: { x: randomRange(-200, 200), y: -600 },
                    radius: 15, color: '#ef4444', lifeTime: 8.0
                });
                audio.playSFX('launch', 0.8);
                data.subStage--;
                data.stateTimer = 0.3;
            } else if (data.subStage === 0) {
                data.state = 'IDLE_VULNERABLE'; data.stateTimer = 3.0; // Long vulnerable
            }
            break;

        case 'MINE_FIELD':
            if (data.stateTimer <= 0) {
                for (let i = 0; i < 5; i++) {
                    state.world.entities.push({
                        id: `mine_${Math.random()}`, type: 'bomb',
                        position: add(state.player.position, { x: randomRange(-600, 600), y: randomRange(-400, 400) }),
                        velocity: { x: 0, y: 0 },
                        radius: 20, color: '#f97316', lifeTime: 3.0,
                        ballDef: BALL_DEFINITIONS['red_common'] // Dummy def
                    });
                }
                audio.playSFX('bomb_throw');
                data.state = 'IDLE_VULNERABLE'; data.stateTimer = 2.0;
            }
            break;
    }
};

/**
 * Handles cinematic death: Shake, Explosions, Slow Mo
 * This is called every frame while boss is in DYING state
 */
/**
 * Handles cinematic death: Shake, then ONE BIG EXPLOSION
 * This is called every frame while boss is in DYING state
 */
export const handleBossDeathSequence = (state: GameState, boss: Entity, dt: number) => {
    if (!boss.bossData) return;

    // FREEZE the boss in place - no physics!
    // We force velocity to 0 and strictly control position
    boss.velocity = { x: 0, y: 0 };

    // Slow Mo - constant super slow
    state.time.scale = 0.15;
    addShake(state, 5);

    // dt is REAL TIME from requestAnimationFrame
    boss.bossData.stateTimer -= dt;

    // Visual effects - just shake and rotation, NO small explosions (User requested)
    boss.rotation = (boss.rotation || 0) + 15 * dt; // Slow rotation
    // Jitter position slightly for "instability"
    const jitter = 5;
    // We need to keep it at its death position, not drift. 
    // Since we don't store "deathPos", we just ensure we don't add cumulative velocity.
    // The jitter adds to current pos, so we should probably start from a fixed pos? 
    // But boss.position is modified directly. 
    // Better: Add random offset for rendering, but logic position stays? 
    // For now, simple jitter is fine as long as velocity is 0.
    boss.position.x += randomRange(-jitter, jitter) * dt * 60;
    boss.position.y += randomRange(-jitter, jitter) * dt * 60;

    // === DEATH TIMER COMPLETE (4 REAL SECONDS) ===
    if (boss.bossData.stateTimer <= 0) {
        // ONE BIG EXPLOSION as requested
        // ONE BIG EXPLOSION as requested
        // Use the new Premium system with large scale (2.5x)
        spawnDebrisExplosion(state, boss.position, '#ffd700', 2.5);

        // Keep the starburst for gameplay/visual impact if desired, or remove to match strict request.
        // User said "impacts work for everything", implying consistent visual style.
        // I'll keep the starburst "projectiles" if they do damage (spawnDirectionalBurst creates projectiles?), 
        // but looking at spawnDirectionalBurst signature it likely spawns particles.
        // Let's stick to JUST the new explosion to be safe and clean as requested ("remove shockwave", etc).

        // Actually, spawnDirectionalBurst spawns harmful projectiles in this game context? 
        // Checking usage: usually it's for visual bursts or boss attacks. 
        // If it's pure visual, I should remove it. 
        // If it's "shards that hurt player", maybe keep?
        // Given "satisfying physics based explosion... space gravity", I'll trust spawnDebrisExplosion to carry the visual weight.

        audio.playSFX('super_launch');
        audio.playSFX('break');

        // Reset time scale back to normal IMMEDIATELY - REMOVED
        // state.time.scale = 1.0; 
        // We let Engine.ts lerp it back naturally for a smooth "slow-mo explosion" effect

        // Finalize boss death - Removes entity
        killBoss(state, boss, { maxHealth: 100 } as Upgrades);
    }
};

const spawnClosingWalls = (state: GameState, center: Vector2) => {
    const gapIndex = Math.floor(Math.random() * 4); // 0=Top, 1=Right, 2=Bottom, 3=Left
    const dist = 1200;
    const speed = 600;
    const thickness = 100;
    const length = 2000;

    // 0: Top Wall (moves Down)
    if (gapIndex !== 0) {
        state.world.entities.push({
            id: `wall_top_${Math.random()}`, type: 'wall',
            position: { x: center.x, y: center.y - dist },
            velocity: { x: 0, y: speed },
            width: length, height: thickness, radius: thickness / 2,
            color: '#ef4444', lifeTime: 5.0
        });
    }
    // 1: Right Wall (moves Left)
    if (gapIndex !== 1) {
        state.world.entities.push({
            id: `wall_right_${Math.random()}`, type: 'wall',
            position: { x: center.x + dist, y: center.y },
            velocity: { x: -speed, y: 0 },
            width: thickness, height: length, radius: thickness / 2,
            color: '#ef4444', lifeTime: 5.0
        });
    }
    // 2: Bottom Wall (moves Up)
    if (gapIndex !== 2) {
        state.world.entities.push({
            id: `wall_bot_${Math.random()}`, type: 'wall',
            position: { x: center.x, y: center.y + dist },
            velocity: { x: 0, y: -speed },
            width: length, height: thickness, radius: thickness / 2,
            color: '#ef4444', lifeTime: 5.0
        });
    }
    // 3: Left Wall (moves Right)
    if (gapIndex !== 3) {
        state.world.entities.push({
            id: `wall_left_${Math.random()}`, type: 'wall',
            position: { x: center.x - dist, y: center.y },
            velocity: { x: speed, y: 0 },
            width: thickness, height: length, radius: thickness / 2,
            color: '#ef4444', lifeTime: 5.0
        });
    }
    spawnFloatingText(state, center, "WALLS CLOSING!", '#ff0000');
};

/**
 * Updates Worm Devourer boss AI - Terraria Destroyer inspired!
 * Phases: WORM_CHASE -> WORM_RETREAT -> WORM_CHARGE -> repeat
 */
export const updateWormAI = (state: GameState, segments: Entity[], dt: number) => {
    const heads = segments.filter(e => e.bossData?.wormSegmentType === 'HEAD');

    heads.forEach(head => {
        if (!head.bossData) return;
        const data = head.bossData;

        // Handle DYING state for Head
        if (data.state === 'DYING') {
            handleBossDeathSequence(state, head, dt);
            return;
        }

        if (data.invincibilityTimer > 0) data.invincibilityTimer -= dt;
        data.stateTimer -= dt;

        const toPlayer = sub(state.player.position, head.position);
        const distToPlayer = mag(toPlayer);
        const awayFromPlayer = mult(normalize(toPlayer), -1);

        // STATE MACHINE
        switch (data.state) {
            case 'WORM_CHASE': {
                // Chase player with wave motion
                let moveSpeed = 1000;
                let turnSpeed = 5.0;

                // Rubber band catchup
                if (distToPlayer > 1500) { moveSpeed = 2500; turnSpeed = 10.0; }
                if (distToPlayer > 3000) { moveSpeed = 4000; turnSpeed = 15.0; }

                const wave = Math.sin(state.visuals.time * 3 + head.id.charCodeAt(0)) * 250;
                const idealDir = normalize(toPlayer);
                const desiredVel = mult(idealDir, moveSpeed);
                desiredVel.y += wave;

                const steer = turnSpeed * dt;
                const currentVel = head.velocity || { x: 0, y: 0 };
                head.velocity = {
                    x: currentVel.x + (desiredVel.x - currentVel.x) * steer,
                    y: currentVel.y + (desiredVel.y - currentVel.y) * steer
                };

                // Random acid spit during chase
                if (Math.random() < 0.05) spawnAcidSpit(state, head.position, state.player.position);

                // Transition to RETREAT after chase timer
                if (data.stateTimer <= 0) {
                    data.state = 'WORM_RETREAT' as any;
                    data.stateTimer = 1.5; // Retreat for 1.5 seconds
                    audio.playSFX('charge', 0.5);
                }
                break;
            }

            case 'WORM_RETREAT' as any: {
                // Fly AWAY from player quickly to build distance
                const retreatSpeed = 2000;
                const retreatDir = awayFromPlayer;
                head.velocity = mult(retreatDir, retreatSpeed);

                // Transition to CHARGE after getting distance
                if (data.stateTimer <= 0) {
                    data.state = 'WORM_CHARGE' as any;
                    data.stateTimer = 0.8; // Charge duration
                    audio.playSFX('boss_roar', 1.0);
                    addShake(state, 10);
                    spawnFloatingText(state, head.position, "!!!", '#ff0000');
                }
                break;
            }

            case 'WORM_CHARGE' as any: {
                // HIGH-SPEED dash directly at player!
                const chargeSpeed = 3500;
                const chargeDir = normalize(toPlayer);
                head.velocity = mult(chargeDir, chargeSpeed);

                // Spawn trail of acid during charge
                if (Math.random() < 0.15) spawnAcidSpit(state, head.position, state.player.position);

                // Transition back to CHASE
                if (data.stateTimer <= 0) {
                    data.state = 'WORM_CHASE';
                    data.stateTimer = randomRange(4, 7); // Random chase duration
                    data.attackCounter++;
                }
                break;
            }

            default:
                // Fallback to chase if unknown state
                data.state = 'WORM_CHASE';
                data.stateTimer = 5;
        }

        // Update position and rotation
        head.rotation = Math.atan2(head.velocity!.y, head.velocity!.x);
        head.position = add(head.position, mult(head.velocity!, dt));
    });

    // Freeze all if any head is dying
    if (heads.some(h => h.bossData?.state === 'DYING')) {
        segments.forEach(s => s.velocity = { x: 0, y: 0 });
        return;
    }

    // BODY SEGMENTS - Follow the chain
    const bodies = segments.filter(e => e.bossData?.wormSegmentType !== 'HEAD');
    bodies.forEach(seg => {
        if (!seg.bossData) return;
        if (seg.bossData.invincibilityTimer > 0) seg.bossData.invincibilityTimer -= dt;

        const leader = segments.find(e => e.id === seg.bossData?.wormPrevSegmentId);
        if (leader) {
            const d = dist(leader.position, seg.position);
            const followDist = 45; // Tighter spacing for long worm
            if (d > followDist) {
                const dir = normalize(sub(leader.position, seg.position));
                seg.position = add(seg.position, mult(dir, (d - followDist) * 12 * dt));
                seg.rotation = Math.atan2(dir.y, dir.x);
            }
        } else {
            // Orphaned segment (split worm) - Apply gravity
            seg.velocity = add(seg.velocity || { x: 0, y: 0 }, { x: 0, y: GRAVITY * dt });
            seg.position = add(seg.position, mult(seg.velocity || { x: 0, y: 0 }, dt));
        }

        // Body segments occasionally spit acid too
        if (Math.random() < 0.003) spawnAcidSpit(state, seg.position, state.player.position);
    });
};

/**
 * Handles the death of a worm segment
 */
export const handleWormSegmentDeath = (state: GameState, segment: Entity, entitiesToRemove: Set<string>, upgrades: Upgrades) => {
    spawnExplosion(state, segment.position, '#a3e635', '#3f6212', segment.velocity || { x: 0, y: 0 });
    audio.playSFX('break');
    entitiesToRemove.add(segment.id);

    const prevId = segment.bossData?.wormPrevSegmentId;
    const nextId = segment.bossData?.wormNextSegmentId;

    if (prevId) {
        const prev = state.world.entities.find(e => e.id === prevId);
        if (prev && prev.bossData) prev.bossData.wormNextSegmentId = nextId;
    }
    if (nextId) {
        const next = state.world.entities.find(e => e.id === nextId);
        if (next && next.bossData) {
            next.bossData.wormPrevSegmentId = prevId;
            if (segment.bossData?.wormSegmentType === 'HEAD') {
                next.bossData.wormSegmentType = 'HEAD';
                next.color = '#a3e635';
                next.radius = 60;
            }
        }
    }

    const remaining = state.world.entities.filter(e =>
        e.type === 'boss' && e.bossData?.type === 'WORM_DEVOURER' && !entitiesToRemove.has(e.id)
    );
    if (remaining.length <= 1) {
        killBoss(state, segment, upgrades);
        remaining.forEach(r => entitiesToRemove.add(r.id));
    }
};
