import * as p2 from 'p2-es';
import Phaser from 'phaser';

// ─── Coordinate conversion (p2 Y-up ↔ Phaser Y-down) ────────────────────

/** Pixels per p2 meter */
export const P2_SCALE = 50;

/** Phaser Y coordinate of the ground line (p2 y = 0) */
export const GROUND_Y_PHASER = 540;

/** Convert p2 world position → Phaser screen position */
export function p2ToPhaser(p2X: number, p2Y: number): { x: number; y: number } {
  return {
    x: p2X * P2_SCALE,
    y: GROUND_Y_PHASER - p2Y * P2_SCALE,
  };
}

/** Convert Phaser screen position → p2 world position */
export function phaserToP2(px: number, py: number): [number, number] {
  return [px / P2_SCALE, (GROUND_Y_PHASER - py) / P2_SCALE];
}

// ─── Collision group bitmasks ────────────────────────────────────────────

export const COL_PLAYER1 = 1 << 1;
export const COL_PLAYER2 = 1 << 2;
export const COL_GROUND  = 1 << 3;
export const COL_OTHER   = 1 << 4;

// ─── Ragdoll body dimensions (p2 meters — from p2-es ragdoll demo) ──────

const SHOULDERS_DISTANCE = 0.5;
const UPPER_ARM_LENGTH   = 0.4;
const LOWER_ARM_LENGTH   = 0.4;
const UPPER_ARM_SIZE     = 0.2;
const LOWER_ARM_SIZE     = 0.2;
const NECK_LENGTH        = 0.1;
const HEAD_RADIUS        = 0.25;
const UPPER_BODY_LENGTH  = 0.6;
const PELVIS_LENGTH      = 0.4;
const UPPER_LEG_LENGTH   = 0.5;
const UPPER_LEG_SIZE     = 0.2;
const LOWER_LEG_SIZE     = 0.2;
const LOWER_LEG_LENGTH   = 0.5;

// ─── Config interfaces ──────────────────────────────────────────────────

export interface JointLimits {
  neck: number;
  knee: number;
  hip: number;
  spine: number;
  shoulder: number;
  elbow: number;
}

export interface RagdollConfig {
  mass?: number;
  jointLimits?: Partial<JointLimits>;
  damping?: number;
  angularDamping?: number;
  jumpVelocity?: number;
  jumpCooldownMs?: number;
  moveForce?: number;
  maxHorizontalSpeed?: number;
  armLiftOnJump?: number;
}

const DEFAULT_JOINT_LIMITS: JointLimits = {
  neck: Math.PI / 8,
  knee: Math.PI / 8,
  hip: Math.PI / 8,
  spine: Math.PI / 8,
  shoulder: Math.PI / 3,
  elbow: Math.PI / 8,
};

// ─── Defaults ────────────────────────────────────────────────────────────

const DEFAULT_MASS              = 1;
const DEFAULT_DAMPING           = 0;
const DEFAULT_ANGULAR_DAMPING   = 0;
const DEFAULT_JUMP_VELOCITY     = 7;
const DEFAULT_JUMP_COOLDOWN_MS  = 400;
const DEFAULT_MOVE_FORCE        = 50;
const DEFAULT_MAX_HSPEED        = 5;
const DEFAULT_ARM_LIFT          = 0.8;
const GROUNDED_THRESHOLD        = 0.15;

// ─── Internal types ─────────────────────────────────────────────────────

interface RagdollPart {
  body: p2.Body;
  visual: Phaser.GameObjects.Shape;
  isCircle: boolean;
}

/** Visual depth per body part (head on top, legs behind torso) */
const DEPTH: Record<string, number> = {
  head: 10,
  upperBody: 5,
  pelvis: 5,
  upperArmL: 7, upperArmR: 7,
  lowerArmL: 6, lowerArmR: 6,
  upperLegL: 4, upperLegR: 4,
  lowerLegL: 3, lowerLegR: 3,
};

// ─── Ragdoll class ──────────────────────────────────────────────────────

export class Ragdoll {
  private scene: Phaser.Scene;
  private world: p2.World;
  private parts = new Map<string, RagdollPart>();
  private constraints: p2.RevoluteConstraint[] = [];
  private lastJumpTime = 0;

  // Configurable runtime parameters
  private mass: number;
  private jointLimits: JointLimits;
  private jumpVelocity: number;
  private jumpCooldownMs: number;
  private moveForce: number;
  private maxHorizontalSpeed: number;
  private armLiftOnJump: number;

  /**
   * @param world          shared p2 World
   * @param x              center X in p2 metres (e.g. 2 for Phaser 200 px)
   * @param color          fill colour for Phaser shapes
   * @param collisionGroup bitmask for this ragdoll's shapes
   * @param collisionMask  bitmask of groups this ragdoll collides with
   * @param scene          Phaser Scene used to create visuals
   * @param config         optional tuning parameters
   */
  constructor(
    world: p2.World,
    x: number,
    color: number,
    collisionGroup: number,
    collisionMask: number,
    scene: Phaser.Scene,
    config?: RagdollConfig,
  ) {
    this.world = world;
    this.scene = scene;

    this.mass             = config?.mass ?? DEFAULT_MASS;
    this.jointLimits      = { ...DEFAULT_JOINT_LIMITS, ...config?.jointLimits };
    this.jumpVelocity     = config?.jumpVelocity ?? DEFAULT_JUMP_VELOCITY;
    this.jumpCooldownMs   = config?.jumpCooldownMs ?? DEFAULT_JUMP_COOLDOWN_MS;
    this.moveForce        = config?.moveForce ?? DEFAULT_MOVE_FORCE;
    this.maxHorizontalSpeed = config?.maxHorizontalSpeed ?? DEFAULT_MAX_HSPEED;
    this.armLiftOnJump    = config?.armLiftOnJump ?? DEFAULT_ARM_LIFT;

    const damping        = config?.damping ?? DEFAULT_DAMPING;
    const angularDamping = config?.angularDamping ?? DEFAULT_ANGULAR_DAMPING;

    this.createBodies(x, color, collisionGroup, collisionMask, damping, angularDamping);
    this.createJoints();
  }

  // ─── Body creation ──────────────────────────────────────────────────

  private createBodies(
    x: number,
    color: number,
    colGroup: number,
    colMask: number,
    damping: number,
    angDamping: number,
  ): void {
    const m = this.mass;

    // Shapes (collision settings applied after creation)
    const headShape       = new p2.Circle({ radius: HEAD_RADIUS });
    const upperBodyShape  = new p2.Box({ width: SHOULDERS_DISTANCE, height: UPPER_BODY_LENGTH });
    const pelvisShape     = new p2.Box({ width: SHOULDERS_DISTANCE, height: PELVIS_LENGTH });
    const uArmShapeL      = new p2.Box({ width: UPPER_ARM_LENGTH, height: UPPER_ARM_SIZE });
    const uArmShapeR      = new p2.Box({ width: UPPER_ARM_LENGTH, height: UPPER_ARM_SIZE });
    const lArmShapeL      = new p2.Box({ width: LOWER_ARM_LENGTH, height: LOWER_ARM_SIZE });
    const lArmShapeR      = new p2.Box({ width: LOWER_ARM_LENGTH, height: LOWER_ARM_SIZE });
    const uLegShapeL      = new p2.Box({ width: UPPER_LEG_SIZE, height: UPPER_LEG_LENGTH });
    const uLegShapeR      = new p2.Box({ width: UPPER_LEG_SIZE, height: UPPER_LEG_LENGTH });
    const lLegShapeL      = new p2.Box({ width: LOWER_LEG_SIZE, height: LOWER_LEG_LENGTH });
    const lLegShapeR      = new p2.Box({ width: LOWER_LEG_SIZE, height: LOWER_LEG_LENGTH });

    for (const s of [
      headShape, upperBodyShape, pelvisShape,
      uArmShapeL, uArmShapeR, lArmShapeL, lArmShapeR,
      uLegShapeL, uLegShapeR, lLegShapeL, lLegShapeR,
    ]) {
      s.collisionGroup = colGroup;
      s.collisionMask  = colMask;
    }

    // Helper alias
    const add = (
      name: string,
      shape: p2.Shape,
      pos: [number, number],
      circle: boolean,
    ) => this.addBody(name, shape, pos, m, damping, angDamping, color, circle);

    // ── Lower legs (feet at y ≈ 0) ───────────────────────────────────
    const lLL = add('lowerLegL', lLegShapeL,
      [x - SHOULDERS_DISTANCE / 2, LOWER_LEG_LENGTH / 2], false);
    const lRL = add('lowerLegR', lLegShapeR,
      [x + SHOULDERS_DISTANCE / 2, LOWER_LEG_LENGTH / 2], false);

    // ── Upper legs ───────────────────────────────────────────────────
    add('upperLegL', uLegShapeL,
      [x - SHOULDERS_DISTANCE / 2,
       lLL.position[1] + LOWER_LEG_LENGTH / 2 + UPPER_LEG_LENGTH / 2], false);
    add('upperLegR', uLegShapeR,
      [x + SHOULDERS_DISTANCE / 2,
       lRL.position[1] + LOWER_LEG_LENGTH / 2 + UPPER_LEG_LENGTH / 2], false);

    // ── Pelvis ───────────────────────────────────────────────────────
    const ulL = this.parts.get('upperLegL')!.body;
    const pel = add('pelvis', pelvisShape,
      [x, ulL.position[1] + UPPER_LEG_LENGTH / 2 + PELVIS_LENGTH / 2], false);

    // ── Upper body ───────────────────────────────────────────────────
    const ub = add('upperBody', upperBodyShape,
      [x, pel.position[1] + PELVIS_LENGTH / 2 + UPPER_BODY_LENGTH / 2], false);

    // ── Head ─────────────────────────────────────────────────────────
    add('head', headShape,
      [x, ub.position[1] + UPPER_BODY_LENGTH / 2 + HEAD_RADIUS + NECK_LENGTH], true);

    // ── Upper arms ───────────────────────────────────────────────────
    const armY = ub.position[1] + UPPER_BODY_LENGTH / 2;
    const uAL = add('upperArmL', uArmShapeL,
      [x - SHOULDERS_DISTANCE / 2 - UPPER_ARM_LENGTH / 2, armY], false);
    const uAR = add('upperArmR', uArmShapeR,
      [x + SHOULDERS_DISTANCE / 2 + UPPER_ARM_LENGTH / 2, armY], false);

    // ── Lower arms ───────────────────────────────────────────────────
    add('lowerArmL', lArmShapeL,
      [uAL.position[0] - LOWER_ARM_LENGTH / 2 - UPPER_ARM_LENGTH / 2,
       uAL.position[1]], false);
    add('lowerArmR', lArmShapeR,
      [uAR.position[0] + LOWER_ARM_LENGTH / 2 + UPPER_ARM_LENGTH / 2,
       uAR.position[1]], false);
  }

  /** Create a single p2 body + Phaser visual and register it. */
  private addBody(
    name: string,
    shape: p2.Shape,
    position: [number, number],
    mass: number,
    damping: number,
    angularDamping: number,
    color: number,
    isCircle: boolean,
  ): p2.Body {
    const body = new p2.Body({ mass, position: [...position], damping, angularDamping });
    body.addShape(shape);
    this.world.addBody(body);

    // Phaser visual
    const scr = p2ToPhaser(position[0], position[1]);
    let visual: Phaser.GameObjects.Shape;
    if (isCircle) {
      const r = (shape as p2.Circle).radius * P2_SCALE;
      visual = this.scene.add.circle(scr.x, scr.y, r, color);
    } else {
      const box = shape as p2.Box;
      visual = this.scene.add.rectangle(
        scr.x, scr.y,
        box.width * P2_SCALE,
        box.height * P2_SCALE,
        color,
      );
    }
    visual.setStrokeStyle(1.5, darkenColor(color, 0.3));
    visual.setDepth(DEPTH[name] ?? 5);

    this.parts.set(name, { body, visual, isCircle });
    return body;
  }

  // ─── Joint creation ─────────────────────────────────────────────────

  private createJoints(): void {
    const lim = this.jointLimits;
    const b = (n: string) => this.parts.get(n)!.body;

    // Neck
    this.revolute(b('head'), b('upperBody'),
      [0, -HEAD_RADIUS - NECK_LENGTH / 2], [0, UPPER_BODY_LENGTH / 2],
      lim.neck);

    // Knees
    this.revolute(b('lowerLegL'), b('upperLegL'),
      [0, LOWER_LEG_LENGTH / 2], [0, -UPPER_LEG_LENGTH / 2],
      lim.knee);
    this.revolute(b('lowerLegR'), b('upperLegR'),
      [0, LOWER_LEG_LENGTH / 2], [0, -UPPER_LEG_LENGTH / 2],
      lim.knee);

    // Hips
    this.revolute(b('upperLegL'), b('pelvis'),
      [0, UPPER_LEG_LENGTH / 2], [-SHOULDERS_DISTANCE / 2, -PELVIS_LENGTH / 2],
      lim.hip);
    this.revolute(b('upperLegR'), b('pelvis'),
      [0, UPPER_LEG_LENGTH / 2], [SHOULDERS_DISTANCE / 2, -PELVIS_LENGTH / 2],
      lim.hip);

    // Spine
    this.revolute(b('pelvis'), b('upperBody'),
      [0, PELVIS_LENGTH / 2], [0, -UPPER_BODY_LENGTH / 2],
      lim.spine);

    // Shoulders
    this.revolute(b('upperBody'), b('upperArmL'),
      [-SHOULDERS_DISTANCE / 2, UPPER_BODY_LENGTH / 2], [UPPER_ARM_LENGTH / 2, 0],
      lim.shoulder);
    this.revolute(b('upperBody'), b('upperArmR'),
      [SHOULDERS_DISTANCE / 2, UPPER_BODY_LENGTH / 2], [-UPPER_ARM_LENGTH / 2, 0],
      lim.shoulder);

    // Elbows
    this.revolute(b('lowerArmL'), b('upperArmL'),
      [LOWER_ARM_LENGTH / 2, 0], [-UPPER_ARM_LENGTH / 2, 0],
      lim.elbow);
    this.revolute(b('lowerArmR'), b('upperArmR'),
      [-LOWER_ARM_LENGTH / 2, 0], [UPPER_ARM_LENGTH / 2, 0],
      lim.elbow);
  }

  private revolute(
    bodyA: p2.Body,
    bodyB: p2.Body,
    pivotA: [number, number],
    pivotB: [number, number],
    halfLimit: number,
  ): void {
    const c = new p2.RevoluteConstraint(bodyA, bodyB, {
      localPivotA: pivotA,
      localPivotB: pivotB,
    });
    c.setLimits(-halfLimit, halfLimit);
    this.world.addConstraint(c);
    this.constraints.push(c);
  }

  // ─── Movement ─────────────────────────────────────────────────────

  moveHorizontal(direction: number): void {
    const ub = this.parts.get('upperBody')!.body;
    const vx = ub.velocity[0];
    if ((direction > 0 && vx < this.maxHorizontalSpeed) ||
        (direction < 0 && vx > -this.maxHorizontalSpeed)) {
      ub.applyForce([direction * this.moveForce, 0]);
    }
  }

  jump(): void {
    const now = this.scene.time.now;
    if (this.jumpCooldownMs > 0 && now - this.lastJumpTime < this.jumpCooldownMs) return;
    if (!this.isGrounded()) return;
    this.lastJumpTime = now;

    const v = this.jumpVelocity;
    for (const [, part] of this.parts) {
      part.body.velocity[1] = v; // positive Y = up in p2
    }

    if (this.armLiftOnJump > 0) {
      const lift = this.armLiftOnJump * v;
      for (const n of ['upperArmL', 'upperArmR', 'lowerArmL', 'lowerArmR']) {
        const p = this.parts.get(n);
        if (p) p.body.velocity[1] += lift;
      }
    }
  }

  /** Direct impulse to pelvis — used by SandboxScene arrows. */
  applyTorsoImpulse(delta: { x: number; y: number }): void {
    const pel = this.parts.get('pelvis')!.body;
    pel.velocity[0] += delta.x;
    pel.velocity[1] += delta.y; // caller must pass positive Y = up
  }

  /** Parameterised jump for SandboxScene. */
  applyJump(upVelocity: number, armLiftFactor: number, cooldownMs: number): boolean {
    const now = this.scene.time.now;
    if (cooldownMs > 0 && now - this.lastJumpTime < cooldownMs) return false;
    this.lastJumpTime = now;

    for (const [, part] of this.parts) {
      part.body.velocity[1] = upVelocity;
    }

    if (armLiftFactor > 0) {
      const lift = armLiftFactor * upVelocity;
      for (const n of ['upperArmL', 'upperArmR', 'lowerArmL', 'lowerArmR']) {
        const p = this.parts.get(n);
        if (p) p.body.velocity[1] += lift;
      }
    }
    return true;
  }

  isGrounded(): boolean {
    const lL = this.parts.get('lowerLegL')!.body;
    const lR = this.parts.get('lowerLegR')!.body;
    const bottomL = lL.position[1] - LOWER_LEG_LENGTH / 2;
    const bottomR = lR.position[1] - LOWER_LEG_LENGTH / 2;
    return bottomL < GROUNDED_THRESHOLD || bottomR < GROUNDED_THRESHOLD;
  }

  // ─── Per-frame update ─────────────────────────────────────────────

  update(): void {
    this.syncVisuals();
  }

  private syncVisuals(): void {
    for (const [, part] of this.parts) {
      const scr = p2ToPhaser(part.body.position[0], part.body.position[1]);
      part.visual.setPosition(scr.x, scr.y);
      part.visual.setRotation(-part.body.angle); // p2 CCW → Phaser CW
    }
  }

  // ─── Runtime config ───────────────────────────────────────────────

  applyConfig(config: Partial<RagdollConfig>): void {
    if (config.mass !== undefined) {
      this.mass = config.mass;
      for (const [, part] of this.parts) {
        part.body.mass = config.mass;
        part.body.updateMassProperties();
      }
    }
    if (config.damping !== undefined) {
      for (const [, part] of this.parts) part.body.damping = config.damping!;
    }
    if (config.angularDamping !== undefined) {
      for (const [, part] of this.parts) part.body.angularDamping = config.angularDamping!;
    }
    if (config.jointLimits) {
      Object.assign(this.jointLimits, config.jointLimits);
      this.applyJointLimits();
    }
    if (config.jumpVelocity !== undefined) this.jumpVelocity = config.jumpVelocity;
    if (config.jumpCooldownMs !== undefined) this.jumpCooldownMs = config.jumpCooldownMs;
    if (config.moveForce !== undefined) this.moveForce = config.moveForce;
    if (config.maxHorizontalSpeed !== undefined) this.maxHorizontalSpeed = config.maxHorizontalSpeed;
    if (config.armLiftOnJump !== undefined) this.armLiftOnJump = config.armLiftOnJump;
  }

  /**
   * Push current jointLimits into every RevoluteConstraint.
   * Order must match createJoints(): neck, kneeL, kneeR, hipL, hipR,
   * spine, shoulderL, shoulderR, elbowL, elbowR.
   */
  private applyJointLimits(): void {
    const l = this.jointLimits;
    const limits = [
      l.neck, l.knee, l.knee, l.hip, l.hip,
      l.spine, l.shoulder, l.shoulder, l.elbow, l.elbow,
    ];
    for (let i = 0; i < limits.length && i < this.constraints.length; i++) {
      this.constraints[i].setLimits(-limits[i], limits[i]);
    }
  }

  getPelvis(): p2.Body { return this.parts.get('pelvis')!.body; }
  getUpperBody(): p2.Body { return this.parts.get('upperBody')!.body; }

  // ─── Cleanup ──────────────────────────────────────────────────────

  destroy(): void {
    for (const c of this.constraints) this.world.removeConstraint(c);
    for (const [, p] of this.parts) {
      this.world.removeBody(p.body);
      p.visual.destroy();
    }
    this.parts.clear();
    this.constraints = [];
  }
}

// ─── Utility ────────────────────────────────────────────────────────────

function darkenColor(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount)) | 0;
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount)) | 0;
  const b = Math.max(0, (color & 0xff) * (1 - amount)) | 0;
  return (r << 16) | (g << 8) | b;
}
