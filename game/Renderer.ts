
import { GameState, Entity, LavaParticle, Upgrades } from '../types';
import { mag, normalize, add, mult, sub } from '../utils/physics';
import { LAVA_LEVEL, BALL_DEFINITIONS, GRAVITY } from '../utils/constants';

export const renderGame = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: GameState, upgrades: Upgrades, baseZoom: number, noisePattern: CanvasPattern | null) => {
    const { width, height } = canvas;

    // --- CAMERA LERP ---
    const targetCamX = state.player.position.x;
    let targetCamY = state.player.position.y - 100;
    state.camera.position.x += (targetCamX - state.camera.position.x) * 0.1;
    state.camera.position.y += (targetCamY - state.camera.position.y) * 0.1;

    // --- SETUP TRANSFORM ---
    const speedFactor = Math.min(mag(state.player.velocity) / 3000, 1.0);
    const dragFactor = state.input.isDragging ? 1.0 : 0.0;
    const targetZoomOffset = (speedFactor * 0.2) + (dragFactor * 0.15);
    const effectiveZoom = Math.max(0.3, baseZoom - targetZoomOffset);
    state.camera.zoom += (effectiveZoom - state.camera.zoom) * 0.1;
    const zoom = state.camera.zoom;

    const shakeX = (Math.random() - 0.5) * state.camera.shake;
    const shakeY = (Math.random() - 0.5) * state.camera.shake;

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // BG Color - Darker when dragging
    const isSlowMo = state.input.isDragging;
    ctx.fillStyle = isSlowMo ? '#000000' : '#020617';
    ctx.fillRect(0, 0, width, height);

    // Visual FX Layers
    if (state.camera.shake > 8) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.2, state.camera.shake / 100)})`;
        ctx.fillRect(0, 0, width, height);
    }
    if (state.utility.autoBounceState === 'ACTIVE') {
        const pulse = Math.sin(state.visuals.time * 20) * 0.05 + 0.1;
        ctx.fillStyle = `rgba(0, 255, 100, ${pulse})`;
        ctx.fillRect(0, 0, width, height);
    }
    if (noisePattern) {
        ctx.globalAlpha = 0.04; ctx.fillStyle = noisePattern; ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1.0;
    }

    // Slow Mo Vignette (Focus Effect)
    if (isSlowMo) {
        const grad = ctx.createRadialGradient(width / 2, height / 2, height / 4, width / 2, height / 2, height);
        grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.95)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
    }

    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-state.camera.position.x + shakeX, -state.camera.position.y + shakeY);

    // --- DRAW WORLD ---

    // Lava
    const gradient = ctx.createLinearGradient(0, LAVA_LEVEL, 0, LAVA_LEVEL + 800);
    gradient.addColorStop(0, '#ff4500'); gradient.addColorStop(0.2, '#8b0000'); gradient.addColorStop(1, '#000000');
    ctx.fillStyle = gradient; ctx.fillRect(state.camera.position.x - 2000, LAVA_LEVEL, 4000, 1000);

    ctx.globalCompositeOperation = 'lighter';
    state.world.lavaParticles.forEach((p: LavaParticle) => {
        ctx.fillStyle = p.type === 'bubble' ? '#ff8c00' : '#ffff00';
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';

    // Platforms
    ctx.fillStyle = '#FFFFFF';
    state.world.platforms.forEach(plat => {
        ctx.fillRect(plat.position.x, plat.position.y, plat.size.x, plat.size.y);
    });

    // Entities
    state.world.entities.forEach(e => {
        if (e.type === 'boss' && e.bossData) { renderBoss(ctx, e, state.visuals.time); return; }

        ctx.save();
        ctx.translate(e.position.x, e.position.y);
        if (e.rotation) ctx.rotate(e.rotation);

        if (e.type === 'bomb') {
            // VFX UPDATE: Improved bomb visibility
            const pulseTime = state.visuals.time * 8;
            const pulse = 0.8 + Math.sin(pulseTime) * 0.2;

            // Outer glow ring for visibility
            ctx.strokeStyle = '#ff6b00';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, e.radius + 4, 0, Math.PI * 2); ctx.stroke();

            // Main bomb body
            ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();

            // Highlight
            ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(-4, -4, e.radius * 0.35, 0, Math.PI * 2); ctx.fill();

            // Armed indicator - pulsing red/orange dot
            const armedColor = Math.sin(pulseTime * 2) > 0 ? '#ff4500' : '#ff8c00';
            ctx.fillStyle = armedColor;
            ctx.beginPath(); ctx.arc(0, 0, 5 * pulse, 0, Math.PI * 2); ctx.fill();

            // Fuse cap
            ctx.fillStyle = '#555'; ctx.fillRect(-3, -e.radius - 3, 6, 5);

            // Fuse with sparking effect
            ctx.strokeStyle = '#d4a574'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, -e.radius - 3); ctx.quadraticCurveTo(4, -e.radius - 8, 8, -e.radius - 6); ctx.stroke();

            // Spark at fuse tip
            if (Math.random() > 0.3) {
                ctx.fillStyle = '#ffff00';
                ctx.beginPath(); ctx.arc(8, -e.radius - 6, 2 + Math.random() * 2, 0, Math.PI * 2); ctx.fill();
            }
        }
        else if (e.type === 'super_missile' || e.type === 'mini_super_missile') {
            const isMini = e.type === 'mini_super_missile';
            // Untransform to draw trail in world space
            ctx.restore();

            // TRAIL
            if (e.trail && e.trail.length > 1) {
                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                // Outer Glow (Optimized: No blur for mini missiles)
                ctx.beginPath();
                ctx.moveTo(e.trail[0].x, e.trail[0].y);
                for (let i = 1; i < e.trail.length; i++) {
                    const t = e.trail[i];
                    // Add sine wobble
                    const wobble = Math.sin(state.visuals.time * 20 + i) * (isMini ? 2 : 5);
                    ctx.lineTo(t.x + wobble, t.y);
                }
                ctx.lineWidth = isMini ? 6 : 12;
                ctx.strokeStyle = isMini ? 'rgba(165, 243, 252, 0.2)' : 'rgba(34, 211, 238, 0.3)';
                // Only shadow on main missile
                if (!isMini) {
                    ctx.shadowColor = '#22d3ee';
                    ctx.shadowBlur = 10;
                }
                ctx.stroke();

                // Inner Core
                ctx.beginPath();
                ctx.moveTo(e.trail[0].x, e.trail[0].y);
                for (let i = 1; i < e.trail.length; i++) {
                    ctx.lineTo(e.trail[i].x, e.trail[i].y);
                }
                ctx.lineWidth = isMini ? 2 : 4;
                ctx.strokeStyle = '#fff';
                ctx.shadowBlur = 0;
                ctx.stroke();
                ctx.restore();
            }

            // Retransform for Body
            ctx.save();
            ctx.translate(e.position.x, e.position.y);
            if (e.rotation) ctx.rotate(e.rotation);

            // Orbitals (Main only)
            if (!isMini) {
                const time = state.visuals.time;
                for (let i = 0; i < 3; i++) {
                    const angle = time * 8 + (i * (Math.PI * 2 / 3));
                    const dist = 12;
                    const ox = Math.cos(angle) * dist;
                    const oy = Math.sin(angle) * dist;

                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.arc(ox, oy, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Spearhead Body
            // Reduced shadow blur
            ctx.shadowColor = '#22d3ee';
            ctx.shadowBlur = isMini ? 0 : 10;
            ctx.fillStyle = '#fff';

            ctx.beginPath();
            if (isMini) {
                ctx.moveTo(8, 0);
                ctx.lineTo(-4, 4);
                ctx.lineTo(-2, 0);
                ctx.lineTo(-4, -4);
            } else {
                ctx.moveTo(16, 0);
                ctx.lineTo(-8, 8);
                ctx.lineTo(-4, 0);
                ctx.lineTo(-8, -8);
            }
            ctx.closePath();
            ctx.fill();

            // Inner Neon
            ctx.fillStyle = isMini ? '#a5f3fc' : '#06b6d4';
            ctx.beginPath();
            if (isMini) {
                ctx.moveTo(4, 0); ctx.lineTo(-2, 2); ctx.lineTo(-2, -2);
            } else {
                ctx.moveTo(8, 0); ctx.lineTo(-4, 4); ctx.lineTo(-4, -4);
            }
            ctx.fill();
        }
        else if (e.type === 'missile' || e.type === 'friendly_missile' || e.type === 'fireball' || e.type === 'friendly_fireball' || e.type === 'acid_spit') {
            const isFire = e.type.includes('fireball'); const isAcid = e.type.includes('acid');
            if (isFire || isAcid) {
                ctx.fillStyle = isAcid ? '#a3e635' : '#f97316';
                // Removed shadow for projectiles, use layered drawing instead
                ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = isAcid ? '#ffffff' : '#ffff00'; ctx.beginPath(); ctx.arc(0, 0, e.radius * 0.6, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.fillStyle = e.type.includes('friendly') ? '#00ffff' : e.color;
                ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-8, 6); ctx.lineTo(-4, 0); ctx.lineTo(-8, -6); ctx.closePath(); ctx.fill();
            }
        }
        else if (e.type === 'ball' && e.ballDef) {
            const def = e.ballDef;
            if (def.id === 'missile_battery') {
                // --- MISSILE BATTERY TURRET ---
                // Base (Hexagon)
                ctx.fillStyle = '#374151'; // Dark Steel
                ctx.beginPath();
                const sides = 6;
                for (let i = 0; i < sides; i++) {
                    const angle = (i / sides) * Math.PI * 2;
                    const r = e.radius;
                    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
                }
                ctx.closePath();
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#6b7280';
                ctx.stroke();

                // Inner Detail lines
                ctx.beginPath();
                ctx.moveTo(-e.radius / 2, -e.radius / 2); ctx.lineTo(e.radius / 2, e.radius / 2);
                ctx.moveTo(e.radius / 2, -e.radius / 2); ctx.lineTo(-e.radius / 2, e.radius / 2);
                ctx.lineWidth = 1;
                ctx.strokeStyle = '#1f2937';
                ctx.stroke();

                // Rotating Turret Head
                ctx.save();
                // If it was tracking a player we'd rotate to them, but generic spin is okay for now
                // Actually, let's make it look "active"
                ctx.rotate(state.visuals.time * 1.5);

                // Turret Body
                ctx.fillStyle = '#1f2937'; // Almost black
                ctx.beginPath(); ctx.arc(0, 0, e.radius * 0.6, 0, Math.PI * 2); ctx.fill();

                // Cannon/Barrel
                ctx.fillStyle = '#9ca3af';
                ctx.fillRect(0, -6, e.radius * 0.8, 12);

                // Warning Light
                const charge = 1.0 - Math.min(1, (e.lastAttackTime || 0) / 2.0); // 0 to 1 based on reload
                if ((e.lastAttackTime || 0) < 1.0) {
                    // Blinking Red when about to fire
                    const blink = Math.sin(state.visuals.time * 20) > 0;
                    ctx.fillStyle = blink ? '#ef4444' : '#7f1d1d';
                    ctx.shadowColor = '#ef4444';
                    ctx.shadowBlur = blink ? 15 : 0;
                } else {
                    // Cooling down (Orange/Yellow)
                    ctx.fillStyle = '#f59e0b';
                    ctx.shadowBlur = 0;
                }
                ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0; // Reset

                ctx.restore();

            } else if (def.id === 'flame_enemy') {
                const p = 1 + Math.sin(state.visuals.time * 15) * 0.1; ctx.scale(p, p);
                // Reduced blur
                ctx.shadowColor = '#f97316'; ctx.shadowBlur = 15; ctx.fillStyle = '#ea580c'; ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(0, 0, e.radius * 0.6, 0, Math.PI * 2); ctx.fill();
            } else if (def.id === 'electric_enemy') {
                ctx.shadowColor = '#06b6d4'; ctx.shadowBlur = 15; ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = state.visuals.time * 5 + k; ctx.moveTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius); ctx.lineTo(Math.cos(a + 2) * 10, Math.sin(a + 2) * 10); } ctx.stroke();
                ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(0, 0, e.radius * 0.4, 0, Math.PI * 2); ctx.fill();
                // Charge line
                if (e.attackCharge && e.attackCharge > 0) {
                    ctx.restore(); ctx.save(); // untransform
                    const target = e.aimPosition || state.player.position;
                    ctx.beginPath(); ctx.moveTo(e.position.x, e.position.y); ctx.lineTo(target.x, target.y);
                    if (e.attackCharge <= 0.4) { ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 3; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 0; }
                    else { ctx.strokeStyle = 'rgba(255,0,0,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]); }
                    ctx.stroke();
                    ctx.restore(); ctx.save(); ctx.translate(e.position.x, e.position.y); // retransform
                }
            } else if (def.id === 'black_hole') {
                ctx.fillStyle = '#000'; ctx.shadowBlur = 20; ctx.shadowColor = '#9333ea'; ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0; ctx.rotate(state.visuals.time * 2); ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, e.radius + 15, e.radius + 5, 0, 0, Math.PI * 2); ctx.stroke();
            } else {
                // ===== SPIKES - REDESIGNED =====
                if (def.spikeStyle && def.spikeStyle !== 'none') {
                    const isSuper = def.spikeStyle === 'super';
                    const spikeCount = isSuper ? 16 : 8;
                    const rotSpeed = isSuper ? 3 : 1.5;
                    const pulse = 1 + Math.sin(state.visuals.time * 8) * 0.05;

                    ctx.save();
                    ctx.rotate(state.visuals.time * rotSpeed);
                    ctx.scale(pulse, pulse);

                    // Outer dangerous glow
                    ctx.shadowColor = isSuper ? '#ff2222' : '#22ff22';
                    ctx.shadowBlur = 12;

                    // Draw each spike individually for better look
                    for (let i = 0; i < spikeCount; i++) {
                        const baseAngle = (Math.PI * 2 * i) / spikeCount;
                        const spikeLength = isSuper ? e.radius * 1.6 : e.radius * 1.4;
                        const baseWidth = isSuper ? 0.15 : 0.2;

                        ctx.save();
                        ctx.rotate(baseAngle);

                        // Spike body (sharp triangle)
                        ctx.beginPath();
                        ctx.moveTo(spikeLength, 0); // Tip
                        ctx.lineTo(e.radius * 0.5, Math.tan(baseWidth) * e.radius * 0.5);
                        ctx.lineTo(e.radius * 0.5, -Math.tan(baseWidth) * e.radius * 0.5);
                        ctx.closePath();

                        // Gradient for spike
                        const grad = ctx.createLinearGradient(e.radius * 0.5, 0, spikeLength, 0);
                        if (isSuper) {
                            grad.addColorStop(0, '#8b0000');
                            grad.addColorStop(0.6, '#ff4444');
                            grad.addColorStop(1, '#ffffff');
                        } else {
                            grad.addColorStop(0, '#006400');
                            grad.addColorStop(0.6, '#44ff44');
                            grad.addColorStop(1, '#ffffff');
                        }
                        ctx.fillStyle = grad;
                        ctx.fill();

                        // Dark edge outline
                        ctx.strokeStyle = isSuper ? '#440000' : '#003300';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();

                        ctx.restore();
                    }

                    ctx.shadowBlur = 0;

                    // Core body (behind spikes but on top layer)
                    ctx.fillStyle = def.coreColor;
                    ctx.beginPath();
                    ctx.arc(0, 0, e.radius * 0.6, 0, Math.PI * 2);
                    ctx.fill();

                    // Inner highlight ring
                    ctx.strokeStyle = isSuper ? '#ff8888' : '#88ff88';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, e.radius * 0.4, 0, Math.PI * 2);
                    ctx.stroke();

                    // Center warning dot
                    ctx.fillStyle = isSuper ? '#ff0000' : '#00ff00';
                    ctx.beginPath();
                    ctx.arc(0, 0, e.radius * 0.15, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();
                }

                // MAIN BODY
                // OPTIMIZATION: Cap glow radius
                const glow = Math.min(def.glowRadius || 0, 15);
                ctx.shadowBlur = glow; ctx.shadowColor = def.glowColor; ctx.fillStyle = def.coreColor; ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(-e.radius * 0.3, -e.radius * 0.3, e.radius * 0.2, 0, Math.PI * 2); ctx.fill();

                if (def.symbol && def.symbol !== 'none') {
                    if (def.symbol === 'ARROW') {
                        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, -8); ctx.lineTo(-5, 8); ctx.fill(); ctx.fillRect(-15, -1.5, 10, 3);
                    } else {
                        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.font = `bold ${e.radius}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(def.symbol, 0, 2);
                    }
                }
            }
        }
        else if (e.type === 'particle' || e.type === 'shockwave' || e.type === 'lightning' || e.type === 'shockwave_ring') {
            // OPTIMIZATION: NO SHADOW BLUR FOR PARTICLES
            ctx.globalCompositeOperation = 'lighter';
            const alpha = Math.min(1, e.lifeTime || 1);
            if (e.type === 'lightning' && e.points) {
                const j = (v: number) => v + (Math.random() - 0.5) * 10;
                // Removed shadow from lightning, used brighter stroke
                ctx.strokeStyle = e.color || '#00ffff'; ctx.lineWidth = 6; ctx.globalAlpha = alpha * 0.6;
                ctx.beginPath(); ctx.moveTo(j(e.points[0].x - e.position.x), j(e.points[0].y - e.position.y)); for (let i = 1; i < e.points.length; i++)ctx.lineTo(j(e.points[i].x - e.position.x), j(e.points[i].y - e.position.y)); ctx.stroke();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.globalAlpha = alpha; ctx.stroke();
            } else if (e.type === 'shockwave') {
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.globalAlpha = Math.max(0, (e.lifeTime || 0) * 3); ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.stroke();
            } else if (e.type === 'shockwave_ring') {
                // Hollow Ring
                ctx.strokeStyle = e.color;
                ctx.lineWidth = 8;
                // No shadow blur
                ctx.globalAlpha = Math.max(0, (e.lifeTime || 0) * 3);
                ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.stroke();
            } else {
                ctx.globalAlpha = alpha; ctx.fillStyle = e.color;

                if (e.shape === 'triangle') {
                    ctx.beginPath();
                    ctx.moveTo(0, -e.radius);
                    ctx.lineTo(e.radius, e.radius);
                    ctx.lineTo(-e.radius, e.radius);
                    ctx.closePath();
                    ctx.fill();
                }
                else if (e.shape === 'smoke') { ctx.fillStyle = `rgba(50,50,50,${alpha * 0.5})`; ctx.globalCompositeOperation = 'source-over'; ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill(); }
                else if (e.isSpark) {
                    // Tiny sparks/charging dust
                    ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
                }
                else if (e.shape === 'square') {
                    // Big chunky debris
                    ctx.fillRect(-e.radius, -e.radius, e.radius * 2, e.radius * 2);
                }
                else if (e.shape === 'wedge') {
                    // Curved wedge - looks like a piece of a broken ball
                    ctx.beginPath();
                    ctx.arc(0, 0, e.radius, -0.5, 0.5);
                    ctx.lineTo(0, 0);
                    ctx.closePath();
                    ctx.fill();
                }
                else { ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill(); }
            }
            ctx.globalAlpha = 1.0; ctx.globalCompositeOperation = 'source-over';
        }
        else if (e.type === 'floating_text') {
            const t = 1 - ((e.lifeTime || 0) / 0.8); const s = 1.0 + Math.sin(t * Math.PI * 3) * Math.exp(-t * 3) * 0.5;
            ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.fillStyle = e.color; ctx.font = `900 ${e.radius * s}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(e.text || '', 0, 0);
        }

        ctx.restore();
    });

    // Auto Bounce Line
    if (state.utility.autoBounceState === 'ACTIVE' && state.utility.currentTargetId) {
        const t = state.world.entities.find(e => e.id === state.utility.currentTargetId);
        if (t) { ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(state.player.position.x, state.player.position.y); ctx.lineTo(t.position.x, t.position.y); ctx.stroke(); }
    }

    // Player
    const p = state.player;
    ctx.save(); ctx.translate(p.position.x, p.position.y);
    const pSpeed = mag(p.velocity);
    if (pSpeed > 100) { const a = Math.atan2(p.velocity.y, p.velocity.x); ctx.rotate(a); ctx.scale(1 + Math.min(pSpeed / 3000, 0.4), 1 - Math.min(pSpeed / 3000, 0.4) * 0.4); ctx.rotate(-a); }
    const pc = state.utility.autoBounceState === 'ACTIVE' ? '#00ff00' : '#06b6d4';
    ctx.fillStyle = pc; ctx.shadowBlur = 20; ctx.shadowColor = pc; ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(0, 0, p.radius * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Drag Line
    if (state.input.isDragging) {
        const dragVec = sub(state.input.startPos, state.input.currentPos);
        if (mag(dragVec) > 10) {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.setLineDash([10, 10]);
            const dir = normalize(dragVec);
            const end = add(state.player.position, mult(dir, Math.min(mag(dragVec), 200)));
            ctx.beginPath(); ctx.moveTo(state.player.position.x, state.player.position.y); ctx.lineTo(end.x, end.y); ctx.stroke(); ctx.setLineDash([]);
            // Sim trajectory
            ctx.fillStyle = '#fff';
            let simPos = { ...state.player.position }; let simVel = mult(dir, Math.min(mag(dragVec), 300) * 5 * upgrades.speedMultiplier);
            for (let i = 0; i < 15; i++) { simPos = add(simPos, mult(simVel, 0.05)); simVel.y += GRAVITY * 0.05; ctx.globalAlpha = 1 - (i / 15); ctx.beginPath(); ctx.arc(simPos.x, simPos.y, 4, 0, Math.PI * 2); ctx.fill(); }
            ctx.globalAlpha = 1;
        }
    }

    // --- OFF-SCREEN BOSS INDICATOR (Improved) ---
    if (state.boss.active) {
        // Find Boss Head or Main Body
        const boss = state.world.entities.find(e => e.type === 'boss' && (!e.bossData?.wormSegmentType || e.bossData.wormSegmentType === 'HEAD'));

        if (boss) {
            const vpW = width / zoom;
            const vpH = height / zoom;
            const relX = boss.position.x - state.camera.position.x;
            const relY = boss.position.y - state.camera.position.y;

            // Check if boss is actually off-screen (with margin)
            const margin = 100;
            const isOffScreen = Math.abs(relX) > (vpW / 2 - margin) || Math.abs(relY) > (vpH / 2 - margin);

            if (isOffScreen) {
                // Temporarily escape camera transform to draw fixed on screen overlay
                ctx.restore(); // Exit World Space

                ctx.save();
                ctx.translate(width / 2, height / 2); // Center of screen

                const angle = Math.atan2(relY, relX);
                // Clamp position to ellipse or box that fits on screen
                const clampX = width / 2 - 60;
                const clampY = height / 2 - 60;

                // Project vector to edge
                const tan = Math.tan(angle);
                let x = 0, y = 0;

                if (Math.abs(relX * clampY) > Math.abs(relY * clampX)) {
                    x = Math.sign(relX) * clampX;
                    y = x * Math.tan(angle);
                } else {
                    y = Math.sign(relY) * clampY;
                    x = y / Math.tan(angle);
                }

                ctx.translate(x, y);
                ctx.rotate(angle);

                // Draw Warning Arrow
                const pulse = 1.0 + Math.sin(state.visuals.time * 15) * 0.2;
                ctx.scale(pulse, pulse);

                ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 15;
                ctx.fillStyle = '#ef4444';

                ctx.beginPath();
                ctx.moveTo(20, 0);
                ctx.lineTo(-20, 20);
                ctx.lineTo(-20, -20);
                ctx.fill();

                // Skull/Icon inside
                ctx.fillStyle = '#000';
                ctx.beginPath(); ctx.arc(-10, 0, 8, 0, Math.PI * 2); ctx.fill();

                ctx.restore();

                return;
            }
        }
    }

    ctx.restore(); // End World Space
};

const renderBoss = (ctx: CanvasRenderingContext2D, boss: Entity, time: number) => {
    ctx.save(); ctx.translate(boss.position.x, boss.position.y); ctx.rotate(boss.rotation || 0);

    if (boss.bossData?.type === 'WORM_DEVOURER') {
        // ===== WORM DEVOURER - VFX UPGRADED =====
        const isHead = boss.bossData.wormSegmentType === 'HEAD';
        const isTail = boss.bossData.wormSegmentType === 'TAIL';
        const isHit = boss.bossData.invincibilityTimer > 0;

        // Armor plate base color
        const baseColor = isHit ? '#ffffff' : boss.color;
        if (isHit) ctx.globalAlpha = 0.6;

        // Armored segment body (hexagonal plates look)
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, boss.radius, boss.radius * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Armor plate lines (horizontal ridges)
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 2;
        for (let i = -2; i <= 2; i++) {
            const y = i * (boss.radius * 0.25);
            ctx.beginPath();
            ctx.moveTo(-boss.radius * 0.8, y);
            ctx.lineTo(boss.radius * 0.8, y);
            ctx.stroke();
        }

        // Spine ridge (top of segment)
        ctx.fillStyle = isHit ? '#cccccc' : '#2d5a27';
        ctx.beginPath();
        ctx.ellipse(0, -boss.radius * 0.6, boss.radius * 0.3, boss.radius * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Crackling energy between segments (body only)
        if (!isHead && !isTail && Math.random() > 0.7) {
            ctx.strokeStyle = '#88ff88';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-boss.radius, 0);
            for (let i = 0; i < 4; i++) {
                const x = -boss.radius + (i * boss.radius / 2);
                const y = (Math.random() - 0.5) * 10;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        if (isHead) {
            // Glowing eyes with tracking effect
            const eyePulse = 0.8 + Math.sin(time * 12) * 0.2;

            // Mandibles with energy glow
            ctx.fillStyle = '#eab308';
            const b = Math.sin(time * 10) * 10;
            ctx.beginPath(); ctx.moveTo(boss.radius * 0.5, boss.radius * 0.5); ctx.lineTo(boss.radius + 25, 25 + b); ctx.lineTo(boss.radius, 45); ctx.fill();
            ctx.beginPath(); ctx.moveTo(boss.radius * 0.5, -boss.radius * 0.5); ctx.lineTo(boss.radius + 25, -25 - b); ctx.lineTo(boss.radius, -45); ctx.fill();

            // Mandible energy tips
            ctx.fillStyle = '#ffff00';
            ctx.beginPath(); ctx.arc(boss.radius + 25, 25 + b, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(boss.radius + 25, -25 - b, 4, 0, Math.PI * 2); ctx.fill();

            // Eyes with glow
            ctx.fillStyle = '#ff0000';
            ctx.beginPath(); ctx.arc(15, -18, 10 * eyePulse, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(15, 18, 10 * eyePulse, 0, Math.PI * 2); ctx.fill();

            // Eye pupils (white core)
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(17, -18, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(17, 18, 4, 0, Math.PI * 2); ctx.fill();
        }

        if (isTail) {
            // Tail stinger
            ctx.fillStyle = '#65a30d';
            ctx.beginPath();
            ctx.moveTo(-boss.radius, 0);
            ctx.lineTo(-boss.radius - 25, -8);
            ctx.lineTo(-boss.radius - 35, 0);
            ctx.lineTo(-boss.radius - 25, 8);
            ctx.closePath();
            ctx.fill();
        }

        ctx.globalAlpha = 1;

    } else {
        // ===== CUBE OVERLORD - VFX UPGRADED =====
        const r = boss.radius;
        const bossState = boss.bossData!.state;
        const col = bossState === 'IDLE_VULNERABLE' ? '#4ade80' : bossState === 'ALIGNING' ? '#facc15' : '#ef4444';
        const scale = 1 + Math.sin(time * 5) * 0.03;
        ctx.scale(scale, scale);

        // Invincibility flash
        if (boss.bossData!.invincibilityTimer > 0) {
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }

        // === ROTATING HALO RINGS (cosmetic) ===
        ctx.save();
        ctx.rotate(time * 2);
        ctx.strokeStyle = `${col}44`; // Semi-transparent
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3, r * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.rotate(-time * 1.5);
        ctx.strokeStyle = `${col}33`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.4, r * 1.3, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();

        // === ORBITING PARTICLES (cosmetic) ===
        for (let i = 0; i < 4; i++) {
            const orbitAngle = time * 3 + (i * Math.PI / 2);
            const orbitDist = r * 1.1;
            const ox = Math.cos(orbitAngle) * orbitDist;
            const oy = Math.sin(orbitAngle) * orbitDist * 0.5;

            ctx.fillStyle = col;
            ctx.beginPath(); ctx.arc(ox, oy, 3, 0, Math.PI * 2); ctx.fill();
        }

        // Shooting telegraph
        if (bossState === 'SHOOTING') {
            ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(600, 0);
            ctx.strokeStyle = 'rgba(255,0,0,0.4)';
            ctx.lineWidth = 4;
            ctx.setLineDash([15, 15]); ctx.stroke(); ctx.setLineDash([]);
        }

        // === MAIN CUBE BODY ===
        // Outer edge glow
        ctx.strokeStyle = col;
        ctx.lineWidth = 6;
        ctx.strokeRect(-r, -r, r * 2, r * 2);

        // Inner dark core
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(-r + 8, -r + 8, r * 2 - 16, r * 2 - 16);

        // === EMISSIVE PANEL LINES ===
        ctx.strokeStyle = `${col}88`;
        ctx.lineWidth = 2;
        // Diagonal lines
        ctx.beginPath();
        ctx.moveTo(-r + 15, -r + 15); ctx.lineTo(-r + 30, -r + 30);
        ctx.moveTo(r - 15, -r + 15); ctx.lineTo(r - 30, -r + 30);
        ctx.moveTo(-r + 15, r - 15); ctx.lineTo(-r + 30, r - 30);
        ctx.moveTo(r - 15, r - 15); ctx.lineTo(r - 30, r - 30);
        ctx.stroke();

        // === PULSING CORE ===
        const corePulse = 0.3 + Math.sin(time * 8) * 0.1;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, r * corePulse, 0, Math.PI * 2); ctx.fill();

        // Core inner bright spot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, r * corePulse * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
};
