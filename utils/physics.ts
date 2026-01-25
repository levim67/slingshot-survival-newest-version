
import { Vector2 } from '../types';

export const add = (v1: Vector2, v2: Vector2): Vector2 => ({ x: v1.x + v2.x, y: v1.y + v2.y });
export const sub = (v1: Vector2, v2: Vector2): Vector2 => ({ x: v1.x - v2.x, y: v1.y - v2.y });
export const mult = (v: Vector2, s: number): Vector2 => ({ x: v.x * s, y: v.y * s });
export const div = (v: Vector2, s: number): Vector2 => ({ x: v.x / s, y: v.y / s });
export const mag = (v: Vector2): number => Math.sqrt(v.x * v.x + v.y * v.y);
export const normalize = (v: Vector2): Vector2 => {
  const m = mag(v);
  return m === 0 ? { x: 0, y: 0 } : div(v, m);
};
export const dist = (v1: Vector2, v2: Vector2): number => mag(sub(v1, v2));
export const dot = (v1: Vector2, v2: Vector2): number => v1.x * v2.x + v1.y * v2.y;

export const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

export const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

export const checkCollision = (p1: Vector2, r1: number, p2: Vector2, r2: number): boolean => {
  const d = dist(p1, p2);
  return d < r1 + r2;
};

// Check collision between a Line Segment (p1 to p2) and a Circle (c, r)
export const checkLineCircle = (p1: Vector2, p2: Vector2, c: Vector2, r: number): boolean => {
    const d = sub(p2, p1);
    const f = sub(p1, c);
    
    const a = dot(d, d);
    const b = 2 * dot(f, d);
    const e = dot(f, f) - r * r;

    let discriminant = b * b - 4 * a * e;
    if (discriminant < 0) return false;

    discriminant = Math.sqrt(discriminant);
    const t1 = (-b - discriminant) / (2 * a);
    const t2 = (-b + discriminant) / (2 * a);

    if (t1 >= 0 && t1 <= 1) return true;
    if (t2 >= 0 && t2 <= 1) return true;
    return false;
};

// Circle vs Rectangle (AABB)
export const checkCircleRect = (circlePos: Vector2, radius: number, rectPos: Vector2, rectSize: Vector2): { collision: boolean, normal: Vector2, depth: number } => {
    // Find the closest point on the rectangle to the circle center
    const closestX = clamp(circlePos.x, rectPos.x, rectPos.x + rectSize.x);
    const closestY = clamp(circlePos.y, rectPos.y, rectPos.y + rectSize.y);

    const distanceX = circlePos.x - closestX;
    const distanceY = circlePos.y - closestY;

    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    
    if (distanceSquared < (radius * radius)) {
        const d = Math.sqrt(distanceSquared);
        
        // Calculate normal
        let normal = { x: 0, y: 0 };
        if (d !== 0) {
            normal = { x: distanceX / d, y: distanceY / d };
        } else {
            // Circle center is inside rectangle, push out based on min axis
            const distToLeft = circlePos.x - rectPos.x;
            const distToRight = (rectPos.x + rectSize.x) - circlePos.x;
            const distToTop = circlePos.y - rectPos.y;
            const distToBottom = (rectPos.y + rectSize.y) - circlePos.y;
            
            const min = Math.min(distToLeft, distToRight, distToTop, distToBottom);
            if (min === distToTop) normal = { x: 0, y: -1 };
            else if (min === distToBottom) normal = { x: 0, y: 1 };
            else if (min === distToLeft) normal = { x: -1, y: 0 };
            else normal = { x: 1, y: 0 };
        }

        return { collision: true, normal, depth: radius - d };
    }

    return { collision: false, normal: {x:0, y:0}, depth: 0 };
};

// 2D Elastic Collision Resolution (Dynamic vs Dynamic)
export const resolveElasticCollision = (p1: Vector2, v1: Vector2, m1: number, p2: Vector2, v2: Vector2, m2: number, restitution: number = 0.8): { v1: Vector2, v2: Vector2 } => {
    const collisionNormal = normalize(sub(p1, p2));
    const relVel = sub(v1, v2);
    const velAlongNormal = dot(relVel, collisionNormal);

    // Do not resolve if velocities are separating
    if (velAlongNormal > 0) return { v1, v2 };

    let j = -(1 + restitution) * velAlongNormal;
    j /= (1 / m1 + 1 / m2);

    const impulse = mult(collisionNormal, j);
    
    const newV1 = add(v1, mult(impulse, 1 / m1));
    const newV2 = sub(v2, mult(impulse, 1 / m2));

    return { v1: newV1, v2: newV2 };
};

// Static Collision Resolution (Dynamic vs Static)
export const resolveStaticCollision = (v: Vector2, normal: Vector2, restitution: number = 0.5): Vector2 => {
    const velAlongNormal = dot(v, normal);
    if (velAlongNormal > 0) return v;

    const j = -(1 + restitution) * velAlongNormal;
    const impulse = mult(normal, j);
    return add(v, impulse);
};
