import Phaser from 'phaser';

// ─── Интерфейсы ───────────────────────────────────────────────────────

interface BodyPartDef {
  name: string;
  type: 'circle' | 'rect';
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  depth: number;
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

/** Конфиг рагдолла для песочницы: трение среды, плотность, стабилизация и т.д. */
export interface RagdollConfig {
  withPelvis?: boolean;
  frictionAirTorso?: number;
  frictionAirLimbs?: number;
  density?: number;
  friction?: number;
  frictionStatic?: number;
  restitution?: number;
  /** Множитель силы стабилизации 0..1 (0 = выкл) */
  stabilizationMultiplier?: number;
  /** PD: kp для торса */
  stabilizationTorsoKp?: number;
  stabilizationTorsoKd?: number;
  stabilizationHeadKp?: number;
  stabilizationHeadKd?: number;
  stabilizationLegKp?: number;
  stabilizationLegKd?: number;
  stabilizationArmKp?: number;
  stabilizationArmKd?: number;
  /** Сила позиционной коррекции structural частей */
  enforceStructureStrength?: number;
  densityTorso?: number;
  densityLimbs?: number;
  footRestitution?: number;
  angularDamping?: number;
  maxVerticalSpeed?: number;
}

/** Конфиг стабилизации, передаётся в update() каждый кадр */
export interface StabilizationConfig {
  multiplier?: number;
  torsoKp?: number;
  torsoKd?: number;
  headKp?: number;
  headKd?: number;
  legKp?: number;
  legKd?: number;
  armKp?: number;
  armKd?: number;
  enforceStrength?: number;
}

// ─── Размеры частей тела ──────────────────────────────────────────────

const HEAD_R = 14;
const TORSO_W = 24;
const TORSO_H = 44;
const PELVIS_W = 20;
const PELVIS_H = 12;
const U_ARM_W = 9;
const U_ARM_H = 24;
const L_ARM_W = 8;
const L_ARM_H = 22;
const U_LEG_W = 12;
const U_LEG_H = 30;
const L_LEG_W = 11;
const L_LEG_H = 28;

/** Без таза: расстояние от центра торса до подошв */
const LEGS_TOTAL_NO_PELVIS = TORSO_H / 2 + U_LEG_H + L_LEG_H;
/** С тазом */
const LEGS_TOTAL_WITH_PELVIS = TORSO_H / 2 + PELVIS_H + U_LEG_H + L_LEG_H;

const ARM_OFFSET_X = TORSO_W / 2 + U_ARM_W / 2 + 1;

// ─── Схема частей тела (без таза) ─────────────────────────────────────

function getBodyPartsNoPelvis(): BodyPartDef[] {
  return [
    { name: 'head', type: 'circle',
      offsetX: 0, offsetY: -(TORSO_H / 2 + 2 + HEAD_R),
      width: HEAD_R, height: HEAD_R, depth: 10, structural: true },
    { name: 'torso', type: 'rect',
      offsetX: 0, offsetY: 0,
      width: TORSO_W, height: TORSO_H, depth: 5, structural: true },
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
}

function getBodyPartsWithPelvis(): BodyPartDef[] {
  const pelvisOffsetY = TORSO_H / 2 + PELVIS_H / 2;
  const upperLegOffsetY = TORSO_H / 2 + PELVIS_H + U_LEG_H / 2;
  const lowerLegOffsetY = TORSO_H / 2 + PELVIS_H + U_LEG_H + L_LEG_H / 2;
  return [
    { name: 'head', type: 'circle',
      offsetX: 0, offsetY: -(TORSO_H / 2 + 2 + HEAD_R),
      width: HEAD_R, height: HEAD_R, depth: 10, structural: true },
    { name: 'torso', type: 'rect',
      offsetX: 0, offsetY: 0,
      width: TORSO_W, height: TORSO_H, depth: 5, structural: true },
    { name: 'pelvis', type: 'rect',
      offsetX: 0, offsetY: pelvisOffsetY,
      width: PELVIS_W, height: PELVIS_H, depth: 4.5, structural: true },
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
    { name: 'upperLegL', type: 'rect',
      offsetX: -7, offsetY: upperLegOffsetY,
      width: U_LEG_W, height: U_LEG_H, depth: 4, structural: true },
    { name: 'upperLegR', type: 'rect',
      offsetX: 7, offsetY: upperLegOffsetY,
      width: U_LEG_W, height: U_LEG_H, depth: 4, structural: true },
    { name: 'lowerLegL', type: 'rect',
      offsetX: -7, offsetY: lowerLegOffsetY,
      width: L_LEG_W, height: L_LEG_H, depth: 1, structural: true },
    { name: 'lowerLegR', type: 'rect',
      offsetX: 7, offsetY: lowerLegOffsetY,
      width: L_LEG_W, height: L_LEG_H, depth: 1, structural: true },
  ];
}

// ─── Суставы ───────────────────────────────────────────────────────────

function getJointsNoPelvis(): JointDef[] {
  return [
    { partA: 'head', partB: 'torso',
      pointA: { x: 0, y: HEAD_R }, pointB: { x: 0, y: -TORSO_H / 2 },
      stiffness: 1, angularStiffness: 0.5, damping: 0.1 },
    { partA: 'torso', partB: 'upperArmL',
      pointA: { x: -TORSO_W / 2, y: -TORSO_H / 2 + 4 }, pointB: { x: 0, y: -U_ARM_H / 2 },
      stiffness: 1, angularStiffness: 0.8, damping: 0.2 },
    { partA: 'torso', partB: 'upperArmR',
      pointA: { x: TORSO_W / 2, y: -TORSO_H / 2 + 4 }, pointB: { x: 0, y: -U_ARM_H / 2 },
      stiffness: 1, angularStiffness: 0.8, damping: 0.2 },
    { partA: 'upperArmL', partB: 'lowerArmL',
      pointA: { x: 0, y: U_ARM_H / 2 }, pointB: { x: 0, y: -L_ARM_H / 2 },
      stiffness: 1, angularStiffness: 0.6, damping: 0.2 },
    { partA: 'upperArmR', partB: 'lowerArmR',
      pointA: { x: 0, y: U_ARM_H / 2 }, pointB: { x: 0, y: -L_ARM_H / 2 },
      stiffness: 1, angularStiffness: 0.6, damping: 0.2 },
    { partA: 'torso', partB: 'upperLegL',
      pointA: { x: -7, y: TORSO_H / 2 }, pointB: { x: 0, y: -U_LEG_H / 2 },
      stiffness: 1, angularStiffness: 0.6, damping: 0.15 },
    { partA: 'torso', partB: 'upperLegR',
      pointA: { x: 7, y: TORSO_H / 2 }, pointB: { x: 0, y: -U_LEG_H / 2 },
      stiffness: 1, angularStiffness: 0.6, damping: 0.15 },
    { partA: 'upperLegL', partB: 'lowerLegL',
      pointA: { x: 0, y: U_LEG_H / 2 }, pointB: { x: 0, y: -L_LEG_H / 2 },
      stiffness: 1, angularStiffness: 0.5, damping: 0.12 },
    { partA: 'upperLegR', partB: 'lowerLegR',
      pointA: { x: 0, y: U_LEG_H / 2 }, pointB: { x: 0, y: -L_LEG_H / 2 },
      stiffness: 1, angularStiffness: 0.5, damping: 0.12 },
  ];
}

function getJointsWithPelvis(): JointDef[] {
  const pelvisOffsetY = TORSO_H / 2 + PELVIS_H / 2;
  return [
    { partA: 'head', partB: 'torso',
      pointA: { x: 0, y: HEAD_R }, pointB: { x: 0, y: -TORSO_H / 2 },
      stiffness: 1, angularStiffness: 0.5, damping: 0.1 },
    { partA: 'torso', partB: 'upperArmL',
      pointA: { x: -TORSO_W / 2, y: -TORSO_H / 2 + 4 }, pointB: { x: 0, y: -U_ARM_H / 2 },
      stiffness: 1, angularStiffness: 0.8, damping: 0.2 },
    { partA: 'torso', partB: 'upperArmR',
      pointA: { x: TORSO_W / 2, y: -TORSO_H / 2 + 4 }, pointB: { x: 0, y: -U_ARM_H / 2 },
      stiffness: 1, angularStiffness: 0.8, damping: 0.2 },
    { partA: 'upperArmL', partB: 'lowerArmL',
      pointA: { x: 0, y: U_ARM_H / 2 }, pointB: { x: 0, y: -L_ARM_H / 2 },
      stiffness: 1, angularStiffness: 0.6, damping: 0.2 },
    { partA: 'upperArmR', partB: 'lowerArmR',
      pointA: { x: 0, y: U_ARM_H / 2 }, pointB: { x: 0, y: -L_ARM_H / 2 },
      stiffness: 1, angularStiffness: 0.6, damping: 0.2 },
    { partA: 'torso', partB: 'pelvis',
      pointA: { x: 0, y: TORSO_H / 2 }, pointB: { x: 0, y: -PELVIS_H / 2 },
      stiffness: 1, angularStiffness: 0.7, damping: 0.15 },
    { partA: 'pelvis', partB: 'upperLegL',
      pointA: { x: -7, y: PELVIS_H / 2 }, pointB: { x: 0, y: -U_LEG_H / 2 },
      stiffness: 1, angularStiffness: 0.6, damping: 0.15 },
    { partA: 'pelvis', partB: 'upperLegR',
      pointA: { x: 7, y: PELVIS_H / 2 }, pointB: { x: 0, y: -U_LEG_H / 2 },
      stiffness: 1, angularStiffness: 0.6, damping: 0.15 },
    { partA: 'upperLegL', partB: 'lowerLegL',
      pointA: { x: 0, y: U_LEG_H / 2 }, pointB: { x: 0, y: -L_LEG_H / 2 },
      stiffness: 1, angularStiffness: 0.5, damping: 0.12 },
    { partA: 'upperLegR', partB: 'lowerLegR',
      pointA: { x: 0, y: U_LEG_H / 2 }, pointB: { x: 0, y: -L_LEG_H / 2 },
      stiffness: 1, angularStiffness: 0.5, damping: 0.12 },
  ];
}

// ─── Управление (дефолты для GameScene) ────────────────────────────────

const MOVE_FORCE = 0.004;
const MAX_SPEED = 4;
const JUMP_VELOCITY = 9;
const GROUND_TOLERANCE = 8;

const DEFAULT_STAB: Required<StabilizationConfig> = {
  multiplier: 1,
  torsoKp: 0.5,
  torsoKd: 0.6,
  headKp: 0.3,
  headKd: 0.5,
  legKp: 0.25,
  legKd: 0.5,
  armKp: 0.15,
  armKd: 0.5,
  enforceStrength: 0.015,
};

// ─── Класс Ragdoll ───────────────────────────────────────────────────

export class Ragdoll {
  private scene: Phaser.Scene;
  private mb: MatterJS.BodyFactory;
  private parts = new Map<string, RagdollPart>();
  private constraints: MatterJS.ConstraintType[] = [];
  private groundY: number;
  private lastJumpTime = 0;
  private withPelvis: boolean;
  private bodyPartDefs: BodyPartDef[];
  private stabilizationConfig: Required<StabilizationConfig> = { ...DEFAULT_STAB };
  private maxVerticalSpeed = 0;
  private angularDamping = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    color: number,
    collisionGroup: number,
    config?: RagdollConfig,
  ) {
    this.scene = scene;
    this.mb = scene.matter.body;
    this.groundY = groundY;
    this.withPelvis = config?.withPelvis ?? false;
    this.bodyPartDefs = this.withPelvis ? getBodyPartsWithPelvis() : getBodyPartsNoPelvis();

    const legsTotal = this.withPelvis ? LEGS_TOTAL_WITH_PELVIS : LEGS_TOTAL_NO_PELVIS;
    const torsoY = groundY - legsTotal;

    const frictionAirTorso = config?.frictionAirTorso ?? 0.25;
    const frictionAirLimbs = config?.frictionAirLimbs ?? 0.03;
    const density = config?.density ?? 0.002;
    const densityTorso = config?.densityTorso ?? density;
    const densityLimbs = config?.densityLimbs ?? density;
    const friction = config?.friction ?? 0.4;
    const frictionStatic = config?.frictionStatic ?? 0.6;
    const restitution = config?.restitution ?? 0.05;
    const footRestitution = config?.footRestitution ?? restitution;
    this.maxVerticalSpeed = config?.maxVerticalSpeed ?? 0;
    this.angularDamping = config?.angularDamping ?? 0;

    if (config?.stabilizationMultiplier !== undefined) this.stabilizationConfig.multiplier = config.stabilizationMultiplier;
    if (config?.stabilizationTorsoKp !== undefined) this.stabilizationConfig.torsoKp = config.stabilizationTorsoKp;
    if (config?.stabilizationTorsoKd !== undefined) this.stabilizationConfig.torsoKd = config.stabilizationTorsoKd;
    if (config?.stabilizationHeadKp !== undefined) this.stabilizationConfig.headKp = config.stabilizationHeadKp;
    if (config?.stabilizationHeadKd !== undefined) this.stabilizationConfig.headKd = config.stabilizationHeadKd;
    if (config?.stabilizationLegKp !== undefined) this.stabilizationConfig.legKp = config.stabilizationLegKp;
    if (config?.stabilizationLegKd !== undefined) this.stabilizationConfig.legKd = config.stabilizationLegKd;
    if (config?.stabilizationArmKp !== undefined) this.stabilizationConfig.armKp = config.stabilizationArmKp;
    if (config?.stabilizationArmKd !== undefined) this.stabilizationConfig.armKd = config.stabilizationArmKd;
    if (config?.enforceStructureStrength !== undefined) this.stabilizationConfig.enforceStrength = config.enforceStructureStrength;

    this.createParts(x, torsoY, color, collisionGroup, {
      frictionAirTorso,
      frictionAirLimbs,
      densityTorso,
      densityLimbs,
      friction,
      frictionStatic,
      restitution,
      footRestitution,
    });
    this.createConstraints();
  }

  private createParts(
    x: number,
    y: number,
    color: number,
    group: number,
    opts: {
      frictionAirTorso: number;
      frictionAirLimbs: number;
      densityTorso: number;
      densityLimbs: number;
      friction: number;
      frictionStatic: number;
      restitution: number;
      footRestitution: number;
    },
  ): void {
    const waterParts = new Set(['torso', 'pelvis']);
    const base: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      collisionFilter: { group },
      friction: opts.friction,
      frictionStatic: opts.frictionStatic,
      frictionAir: opts.frictionAirLimbs,
      restitution: opts.restitution,
      density: opts.densityLimbs,
    };

    const footOpts: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      ...base,
      friction: 1.0,
      frictionStatic: 1.2,
      density: opts.densityLimbs * 1.5,
      restitution: opts.footRestitution,
    };

    for (const def of this.bodyPartDefs) {
      const px = x + def.offsetX;
      const py = y + def.offsetY;
      const isFoot = def.name.startsWith('lowerLeg');
      const bodyOpts = isFoot ? footOpts : { ...base };
      if (waterParts.has(def.name)) {
        bodyOpts.frictionAir = opts.frictionAirTorso;
        bodyOpts.density = opts.densityTorso;
      }

      if (def.type === 'circle') {
        this.addCircle(def.name, px, py, def.width, color, def.depth, bodyOpts);
      } else {
        this.addRect(def.name, px, py, def.width, def.height, color, def.depth, bodyOpts);
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
    const joints = this.withPelvis ? getJointsWithPelvis() : getJointsNoPelvis();
    for (const j of joints) {
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

  /** Применить конфиг к уже созданному рагдоллу (frictionAir, density и т.д.) */
  applyConfig(config: Partial<RagdollConfig>): void {
    const waterParts = new Set(['torso', 'pelvis']);
    for (const [name, part] of this.parts) {
      const body = part.body as MatterJS.BodyType & { frictionAir?: number; density?: number; friction?: number; frictionStatic?: number; restitution?: number };
      if (config.frictionAirTorso !== undefined && waterParts.has(name)) {
        body.frictionAir = config.frictionAirTorso;
      }
      if (config.frictionAirLimbs !== undefined && !waterParts.has(name)) {
        body.frictionAir = config.frictionAirLimbs;
      }
      if (config.density !== undefined) {
        body.density = config.density;
        if (name.startsWith('lowerLeg')) body.density = config.density * 1.5;
      }
      if (config.densityTorso !== undefined && waterParts.has(name)) {
        body.density = config.densityTorso;
      }
      if (config.densityLimbs !== undefined && !waterParts.has(name)) {
        body.density = name.startsWith('lowerLeg') ? config.densityLimbs * 1.5 : config.densityLimbs;
      }
      if (config.footRestitution !== undefined && name.startsWith('lowerLeg')) {
        body.restitution = config.footRestitution;
      }
      if (config.friction !== undefined) body.friction = config.friction;
      if (config.frictionStatic !== undefined) body.frictionStatic = config.frictionStatic;
      if (config.restitution !== undefined && !name.startsWith('lowerLeg')) body.restitution = config.restitution;
    }
    if (config.angularDamping !== undefined) this.angularDamping = config.angularDamping;
    if (config.maxVerticalSpeed !== undefined) this.maxVerticalSpeed = config.maxVerticalSpeed;
    if (config.stabilizationMultiplier !== undefined) this.stabilizationConfig.multiplier = config.stabilizationMultiplier;
    if (config.stabilizationTorsoKp !== undefined) this.stabilizationConfig.torsoKp = config.stabilizationTorsoKp;
    if (config.stabilizationTorsoKd !== undefined) this.stabilizationConfig.torsoKd = config.stabilizationTorsoKd;
    if (config.stabilizationHeadKp !== undefined) this.stabilizationConfig.headKp = config.stabilizationHeadKp;
    if (config.stabilizationHeadKd !== undefined) this.stabilizationConfig.headKd = config.stabilizationHeadKd;
    if (config.stabilizationLegKp !== undefined) this.stabilizationConfig.legKp = config.stabilizationLegKp;
    if (config.stabilizationLegKd !== undefined) this.stabilizationConfig.legKd = config.stabilizationLegKd;
    if (config.stabilizationArmKp !== undefined) this.stabilizationConfig.armKp = config.stabilizationArmKp;
    if (config.stabilizationArmKd !== undefined) this.stabilizationConfig.armKd = config.stabilizationArmKd;
    if (config.enforceStructureStrength !== undefined) this.stabilizationConfig.enforceStrength = config.enforceStructureStrength;
  }

  /** Обновить конфиг стабилизации на лету (вызывается из SandboxScene каждый кадр при необходимости) */
  setStabilizationConfig(cfg: StabilizationConfig): void {
    if (cfg.multiplier !== undefined) this.stabilizationConfig.multiplier = cfg.multiplier;
    if (cfg.torsoKp !== undefined) this.stabilizationConfig.torsoKp = cfg.torsoKp;
    if (cfg.torsoKd !== undefined) this.stabilizationConfig.torsoKd = cfg.torsoKd;
    if (cfg.headKp !== undefined) this.stabilizationConfig.headKp = cfg.headKp;
    if (cfg.headKd !== undefined) this.stabilizationConfig.headKd = cfg.headKd;
    if (cfg.legKp !== undefined) this.stabilizationConfig.legKp = cfg.legKp;
    if (cfg.legKd !== undefined) this.stabilizationConfig.legKd = cfg.legKd;
    if (cfg.armKp !== undefined) this.stabilizationConfig.armKp = cfg.armKp;
    if (cfg.armKd !== undefined) this.stabilizationConfig.armKd = cfg.armKd;
    if (cfg.enforceStrength !== undefined) this.stabilizationConfig.enforceStrength = cfg.enforceStrength;
  }

  private stabilize(): void {
    const m = this.stabilizationConfig.multiplier;
    if (m <= 0) {
      this.syncVisuals();
      return;
    }
    const torso = this.parts.get('torso')!.body;
    const tkp = this.stabilizationConfig.torsoKp * m;
    const tkd = this.stabilizationConfig.torsoKd;
    this.keepUpright(torso, tkp, tkd);
    if (this.withPelvis) {
      this.keepUpright(this.parts.get('pelvis')!.body, tkp * 0.8, tkd);
    }
    this.keepUpright(this.parts.get('head')!.body, this.stabilizationConfig.headKp * m, this.stabilizationConfig.headKd);
    for (const name of ['upperLegL', 'upperLegR', 'lowerLegL', 'lowerLegR'] as const) {
      const p = this.parts.get(name);
      if (p) this.keepUpright(p.body, this.stabilizationConfig.legKp * m, this.stabilizationConfig.legKd);
    }
    for (const name of ['upperArmL', 'upperArmR'] as const) {
      const p = this.parts.get(name);
      if (p) this.keepUpright(p.body, this.stabilizationConfig.armKp * m, this.stabilizationConfig.armKd);
    }
    for (const name of ['lowerArmL', 'lowerArmR'] as const) {
      const p = this.parts.get(name);
      if (p) this.keepUpright(p.body, this.stabilizationConfig.armKp * 0.7 * m, this.stabilizationConfig.armKd);
    }
    this.enforceStructure(torso);
  }

  private keepUpright(body: MatterJS.BodyType, kp: number, kd: number): void {
    const correction = -body.angle * kp;
    const damped = body.angularVelocity * (1 - kd);
    this.mb.setAngularVelocity(body, damped + correction);
  }

  private enforceStructure(torso: MatterJS.BodyType): void {
    const ty = torso.position.y;
    const strength = this.stabilizationConfig.enforceStrength * this.stabilizationConfig.multiplier;
    for (const def of this.bodyPartDefs) {
      if (def.name === 'torso' || !def.structural) continue;
      const part = this.parts.get(def.name)!.body;
      const goalY = ty + def.offsetY;
      const dy = goalY - part.position.y;
      const absDy = Math.abs(dy);
      if (absDy < 2) continue;
      const s = Math.min(0.3, absDy * strength);
      this.mb.setVelocity(part, {
        x: part.velocity.x,
        y: part.velocity.y + dy * s,
      });
    }
  }

  moveHorizontal(direction: number): void {
    const torso = this.parts.get('torso')!.body;
    const velX = torso.velocity.x;
    if ((direction > 0 && velX < MAX_SPEED) || (direction < 0 && velX > -MAX_SPEED)) {
      this.mb.applyForce(torso, torso.position, { x: direction * MOVE_FORCE, y: 0 });
    }
  }

  /** Импульс к торсу (для песочницы: стрелки). forceX, forceY — приращение скорости или сила за кадр. */
  applyTorsoImpulse(velocityDelta: { x: number; y: number }): void {
    const torso = this.parts.get('torso')!.body;
    this.mb.setVelocity(torso, {
      x: torso.velocity.x + velocityDelta.x,
      y: torso.velocity.y + velocityDelta.y,
    });
  }

  /**
   * Прыжок: один раз задаёт торсу скорость вверх и поднимает руки.
   * @param upVelocity начальная скорость вверх (положительное число)
   * @param armLiftFactor множитель подъёма рук (0 = не поднимать)
   * @param cooldownMs минимальная пауза между прыжками (0 = без ограничения)
   * @returns true если прыжок выполнен, false если сработал кулдаун
   */
  applyJump(upVelocity: number, armLiftFactor: number, cooldownMs: number): boolean {
    const now = this.scene.time.now;
    if (cooldownMs > 0 && now - this.lastJumpTime < cooldownMs) return false;
    this.lastJumpTime = now;

    const torso = this.parts.get('torso')!.body;
    this.mb.setVelocity(torso, {
      x: torso.velocity.x,
      y: -upVelocity,
    });

    const armLift = armLiftFactor * upVelocity;
    for (const name of ['upperArmL', 'upperArmR', 'lowerArmL', 'lowerArmR'] as const) {
      const p = this.parts.get(name);
      if (!p) continue;
      const b = p.body;
      this.mb.setVelocity(b, {
        x: b.velocity.x,
        y: b.velocity.y - armLift,
      });
    }
    return true;
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

  update(stabilizationConfig?: StabilizationConfig): void {
    if (stabilizationConfig) this.setStabilizationConfig(stabilizationConfig);
    this.stabilize();
    if (this.angularDamping > 0) {
      for (const [, part] of this.parts) {
        const b = part.body;
        this.mb.setAngularVelocity(b, b.angularVelocity * (1 - this.angularDamping));
      }
    }
    if (this.maxVerticalSpeed > 0) {
      for (const [, part] of this.parts) {
        const b = part.body;
        const vy = Math.max(-this.maxVerticalSpeed, Math.min(this.maxVerticalSpeed, b.velocity.y));
        this.mb.setVelocity(b, { x: b.velocity.x, y: vy });
      }
    }
    this.syncVisuals();
  }

  private syncVisuals(): void {
    for (const [, part] of this.parts) {
      part.visual.setPosition(part.body.position.x, part.body.position.y);
      part.visual.setRotation(part.body.angle);
    }
  }

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

function darkenColor(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount)) | 0;
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount)) | 0;
  const b = Math.max(0, (color & 0xff) * (1 - amount)) | 0;
  return (r << 16) | (g << 8) | b;
}
