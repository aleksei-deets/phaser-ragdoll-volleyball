import Phaser from 'phaser';

// ─── Интерфейсы ───────────────────────────────────────────────────────

interface BodyPartDef {
  name: string;
  type: 'circle' | 'rect';
  /** Смещение от центра торса (в стоящей позе) */
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  depth: number;
  /** Этот элемент — «скелетный» (голова, торс, ноги)? Если да — позиционно стабилизируется */
  structural: boolean;
}

interface JointDef {
  partA: string;
  partB: string;
  pointA: { x: number; y: number };
  pointB: { x: number; y: number };
  stiffness: number;
  angularStiffness?: number;
  damping?: number;
}

interface RagdollPart {
  body: MatterJS.BodyType;
  visual: Phaser.GameObjects.Shape;
}

// ─── Размеры частей тела ──────────────────────────────────────────────

const HEAD_R = 14;
const TORSO_W = 24;
const TORSO_H = 44;
const U_ARM_W = 9;
const U_ARM_H = 24;
const L_ARM_W = 8;
const L_ARM_H = 22;
const U_LEG_W = 12;
const U_LEG_H = 30;
const L_LEG_W = 11;
const L_LEG_H = 28;

/** Расстояние от центра торса до подошв */
const LEGS_TOTAL = TORSO_H / 2 + U_LEG_H + L_LEG_H;

// ─── Схема частей тела ────────────────────────────────────────────────

const ARM_OFFSET_X = TORSO_W / 2 + U_ARM_W / 2 + 1;

const BODY_PARTS: BodyPartDef[] = [
  // Голова
  { name: 'head', type: 'circle',
    offsetX: 0, offsetY: -(TORSO_H / 2 + 2 + HEAD_R),
    width: HEAD_R, height: HEAD_R, depth: 10, structural: true },

  // Торс
  { name: 'torso', type: 'rect',
    offsetX: 0, offsetY: 0,
    width: TORSO_W, height: TORSO_H, depth: 5, structural: true },

  // Руки — НЕ structural (позиционирование через constraints),
  // рендерятся поверх торса
  { name: 'upperArmL', type: 'rect',
    offsetX: -ARM_OFFSET_X, offsetY: -TORSO_H / 2 + U_ARM_H / 2 + 4,
    width: U_ARM_W, height: U_ARM_H, depth: 7, structural: false },
  { name: 'upperArmR', type: 'rect',
    offsetX: ARM_OFFSET_X, offsetY: -TORSO_H / 2 + U_ARM_H / 2 + 4,
    width: U_ARM_W, height: U_ARM_H, depth: 7, structural: false },
  { name: 'lowerArmL', type: 'rect',
    offsetX: -ARM_OFFSET_X, offsetY: -TORSO_H / 2 + U_ARM_H + L_ARM_H / 2 + 4,
    width: L_ARM_W, height: L_ARM_H, depth: 6, structural: false },
  { name: 'lowerArmR', type: 'rect',
    offsetX: ARM_OFFSET_X, offsetY: -TORSO_H / 2 + U_ARM_H + L_ARM_H / 2 + 4,
    width: L_ARM_W, height: L_ARM_H, depth: 6, structural: false },

  // Ноги — structural
  { name: 'upperLegL', type: 'rect',
    offsetX: -7, offsetY: TORSO_H / 2 + U_LEG_H / 2,
    width: U_LEG_W, height: U_LEG_H, depth: 4, structural: true },
  { name: 'upperLegR', type: 'rect',
    offsetX: 7, offsetY: TORSO_H / 2 + U_LEG_H / 2,
    width: U_LEG_W, height: U_LEG_H, depth: 4, structural: true },
  { name: 'lowerLegL', type: 'rect',
    offsetX: -7, offsetY: TORSO_H / 2 + U_LEG_H + L_LEG_H / 2,
    width: L_LEG_W, height: L_LEG_H, depth: 1, structural: true },
  { name: 'lowerLegR', type: 'rect',
    offsetX: 7, offsetY: TORSO_H / 2 + U_LEG_H + L_LEG_H / 2,
    width: L_LEG_W, height: L_LEG_H, depth: 1, structural: true },
];

// ─── Описание суставов ────────────────────────────────────────────────

const JOINTS: JointDef[] = [
  // Шея
  { partA: 'head', partB: 'torso',
    pointA: { x: 0, y: HEAD_R }, pointB: { x: 0, y: -TORSO_H / 2 },
    stiffness: 1, angularStiffness: 0.5, damping: 0.1 },

  // Плечи — жёсткое крепление + сильное сопротивление вращению
  { partA: 'torso', partB: 'upperArmL',
    pointA: { x: -TORSO_W / 2, y: -TORSO_H / 2 + 4 }, pointB: { x: 0, y: -U_ARM_H / 2 },
    stiffness: 1, angularStiffness: 0.8, damping: 0.2 },
  { partA: 'torso', partB: 'upperArmR',
    pointA: { x: TORSO_W / 2, y: -TORSO_H / 2 + 4 }, pointB: { x: 0, y: -U_ARM_H / 2 },
    stiffness: 1, angularStiffness: 0.8, damping: 0.2 },

  // Локти — жёсткие + сопротивление вращению (не даёт предплечью отлетать)
  { partA: 'upperArmL', partB: 'lowerArmL',
    pointA: { x: 0, y: U_ARM_H / 2 }, pointB: { x: 0, y: -L_ARM_H / 2 },
    stiffness: 1, angularStiffness: 0.6, damping: 0.2 },
  { partA: 'upperArmR', partB: 'lowerArmR',
    pointA: { x: 0, y: U_ARM_H / 2 }, pointB: { x: 0, y: -L_ARM_H / 2 },
    stiffness: 1, angularStiffness: 0.6, damping: 0.2 },

  // Бёдра — максимально жёсткие
  { partA: 'torso', partB: 'upperLegL',
    pointA: { x: -7, y: TORSO_H / 2 }, pointB: { x: 0, y: -U_LEG_H / 2 },
    stiffness: 1, angularStiffness: 0.6, damping: 0.15 },
  { partA: 'torso', partB: 'upperLegR',
    pointA: { x: 7, y: TORSO_H / 2 }, pointB: { x: 0, y: -U_LEG_H / 2 },
    stiffness: 1, angularStiffness: 0.6, damping: 0.15 },

  // Колени — максимально жёсткие
  { partA: 'upperLegL', partB: 'lowerLegL',
    pointA: { x: 0, y: U_LEG_H / 2 }, pointB: { x: 0, y: -L_LEG_H / 2 },
    stiffness: 1, angularStiffness: 0.5, damping: 0.12 },
  { partA: 'upperLegR', partB: 'lowerLegR',
    pointA: { x: 0, y: U_LEG_H / 2 }, pointB: { x: 0, y: -L_LEG_H / 2 },
    stiffness: 1, angularStiffness: 0.5, damping: 0.12 },
];

// ─── Управление ───────────────────────────────────────────────────────

const MOVE_FORCE = 0.004;
const MAX_SPEED = 4;
const JUMP_VELOCITY = 9;
const GROUND_TOLERANCE = 8;

// ─── Класс Ragdoll ───────────────────────────────────────────────────

export class Ragdoll {
  private scene: Phaser.Scene;
  private mb: MatterJS.BodyFactory;
  private parts = new Map<string, RagdollPart>();
  private constraints: MatterJS.ConstraintType[] = [];
  private groundY: number;
  private lastJumpTime = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    color: number,
    collisionGroup: number,
  ) {
    this.scene = scene;
    this.mb = scene.matter.body;
    this.groundY = groundY;

    const torsoY = groundY - LEGS_TOTAL;
    this.createParts(x, torsoY, color, collisionGroup);
    this.createConstraints();
  }

  // ─── Создание ───────────────────────────────────────────────────────

  private createParts(x: number, y: number, color: number, group: number): void {
    const base: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      collisionFilter: { group },
      friction: 0.4,
      frictionStatic: 0.6,
      frictionAir: 0.03,
      restitution: 0.05,
      density: 0.002,
    };

    const footOpts: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      ...base,
      friction: 1.0,
      frictionStatic: 1.2,
      density: 0.003,
    };

    for (const def of BODY_PARTS) {
      const px = x + def.offsetX;
      const py = y + def.offsetY;
      const isFoot = def.name.startsWith('lowerLeg');
      const opts = isFoot ? footOpts : base;

      if (def.type === 'circle') {
        this.addCircle(def.name, px, py, def.width, color, def.depth, opts);
      } else {
        this.addRect(def.name, px, py, def.width, def.height, color, def.depth, opts);
      }
    }
  }

  private addCircle(
    name: string, x: number, y: number, r: number,
    color: number, depth: number, opts: Phaser.Types.Physics.Matter.MatterBodyConfig,
  ): void {
    const body = this.scene.matter.add.circle(x, y, r, opts);
    const visual = this.scene.add.circle(x, y, r, color).setDepth(depth);
    visual.setStrokeStyle(1.5, darkenColor(color, 0.3));
    this.parts.set(name, { body, visual });
  }

  private addRect(
    name: string, x: number, y: number, w: number, h: number,
    color: number, depth: number, opts: Phaser.Types.Physics.Matter.MatterBodyConfig,
  ): void {
    const body = this.scene.matter.add.rectangle(x, y, w, h, opts);
    const visual = this.scene.add.rectangle(x, y, w, h, color).setDepth(depth);
    visual.setStrokeStyle(1.5, darkenColor(color, 0.3));
    this.parts.set(name, { body, visual });
  }

  private createConstraints(): void {
    for (const j of JOINTS) {
      const a = this.parts.get(j.partA);
      const b = this.parts.get(j.partB);
      if (!a || !b) continue;

      const c = this.scene.matter.add.constraint(
        a.body, b.body, 0, j.stiffness,
        { pointA: j.pointA, pointB: j.pointB,
          angularStiffness: j.angularStiffness, damping: j.damping ?? 0.05 },
      );
      this.constraints.push(c);
    }
  }

  // ─── Активная стабилизация (вызывается каждый кадр) ─────────────────
  //
  //  Два слоя:
  //  1) Угловая коррекция — PD-контроллер, стремящийся выставить
  //     «скелетные» части вертикально (angle → 0)
  //  2) Позиционная коррекция — толкает каждую скелетную часть
  //     к её целевой позиции относительно торса. Без этого constraints
  //     с stiffness < ∞ не могут противостоять гравитации, и части
  //     слипаются в кучу.
  //

  private stabilize(): void {
    const torso = this.parts.get('torso')!.body;

    // --- 1. Угловая стабилизация ---

    // Торс — самый жёсткий контроллер
    this.keepUpright(torso, 0.5, 0.6);

    // Голова
    this.keepUpright(this.parts.get('head')!.body, 0.3, 0.5);

    // Ноги
    for (const name of ['upperLegL', 'upperLegR', 'lowerLegL', 'lowerLegR'] as const) {
      this.keepUpright(this.parts.get(name)!.body, 0.25, 0.5);
    }

    // Руки — умеренная угловая коррекция (тянет к вертикали) + демпфирование.
    // Шейкинга не будет, т.к. positional enforcement для рук отключён —
    // нет конфликта между тремя системами.
    for (const name of ['upperArmL', 'upperArmR'] as const) {
      this.keepUpright(this.parts.get(name)!.body, 0.15, 0.5);
    }
    for (const name of ['lowerArmL', 'lowerArmR'] as const) {
      this.keepUpright(this.parts.get(name)!.body, 0.1, 0.4);
    }

    // --- 2. Позиционная стабилизация ---
    this.enforceStructure(torso);
  }

  /** PD-контроллер для вертикали одного тела */
  private keepUpright(body: MatterJS.BodyType, kp: number, kd: number): void {
    const correction = -body.angle * kp;
    const damped = body.angularVelocity * (1 - kd);
    this.mb.setAngularVelocity(body, damped + correction);
  }

  /**
   * Корректирует ТОЛЬКО вертикальную (Y) позицию structural-частей.
   *
   * Почему только Y:
   * - Гравитация — единственная постоянная внешняя сила, она вертикальная.
   *   Именно она вызывает «схлопывание» ragdoll. Constraints не справляются.
   * - Горизонтальное позиционирование прекрасно обеспечивают constraints
   *   (stiffness 1.0 + 14 iterations).
   * - Коррекция X создавала горизонтальный дрейф: setVelocity добавляет
   *   энергию без обратной реакции → через constraints тащит всё тело вбок.
   */
  private enforceStructure(torso: MatterJS.BodyType): void {
    const ty = torso.position.y;

    for (const def of BODY_PARTS) {
      if (def.name === 'torso' || !def.structural) continue;

      const part = this.parts.get(def.name)!.body;

      const goalY = ty + def.offsetY;
      const dy = goalY - part.position.y;
      const absDy = Math.abs(dy);

      if (absDy < 2) continue;

      const strength = Math.min(0.3, absDy * 0.015);

      this.mb.setVelocity(part, {
        x: part.velocity.x,             // X не трогаем!
        y: part.velocity.y + dy * strength,
      });
    }
  }

  // ─── Управление ────────────────────────────────────────────────────

  moveHorizontal(direction: number): void {
    const torso = this.parts.get('torso')!.body;
    const velX = torso.velocity.x;

    if ((direction > 0 && velX < MAX_SPEED) || (direction < 0 && velX > -MAX_SPEED)) {
      this.mb.applyForce(torso, torso.position, { x: direction * MOVE_FORCE, y: 0 });
    }
  }

  jump(): void {
    const now = this.scene.time.now;
    if (now - this.lastJumpTime < 400) return;
    if (!this.isGrounded()) return;

    this.lastJumpTime = now;

    for (const [, part] of this.parts) {
      this.mb.setVelocity(part.body, {
        x: part.body.velocity.x,
        y: -JUMP_VELOCITY,
      });
    }
  }

  isGrounded(): boolean {
    const lL = this.parts.get('lowerLegL')!.body;
    const lR = this.parts.get('lowerLegR')!.body;
    return lL.position.y + L_LEG_H / 2 >= this.groundY - GROUND_TOLERANCE
      || lR.position.y + L_LEG_H / 2 >= this.groundY - GROUND_TOLERANCE;
  }

  // ─── Игровой цикл ──────────────────────────────────────────────────

  update(): void {
    this.stabilize();
    this.syncVisuals();
  }

  private syncVisuals(): void {
    for (const [, part] of this.parts) {
      part.visual.setPosition(part.body.position.x, part.body.position.y);
      part.visual.setRotation(part.body.angle);
    }
  }

  // ─── API ────────────────────────────────────────────────────────────

  getTorso(): MatterJS.BodyType {
    return this.parts.get('torso')!.body;
  }

  destroy(): void {
    for (const c of this.constraints) this.scene.matter.world.removeConstraint(c);
    for (const [, p] of this.parts) {
      this.scene.matter.world.remove(p.body);
      p.visual.destroy();
    }
    this.parts.clear();
    this.constraints = [];
  }
}

// ─── Утилита ──────────────────────────────────────────────────────────

function darkenColor(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount)) | 0;
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount)) | 0;
  const b = Math.max(0, (color & 0xff) * (1 - amount)) | 0;
  return (r << 16) | (g << 8) | b;
}
