import Phaser from 'phaser';
import * as p2 from 'p2-es';
import {
  Ragdoll,
  type RagdollConfig,
  P2_SCALE,
  COL_PLAYER1, COL_PLAYER2, COL_GROUND, COL_OTHER,
} from '../entities/Ragdoll';
import {
  DEFAULT_SANDBOX_CONFIG,
  PRESETS_BASE_URL,
  deg2rad,
  type PresetsManifest,
  type SavedPreset,
  type SandboxConfig,
} from '../types/sandboxConfig';

// ─── Layout constants (Phaser pixels) ────────────────────────────────────

const GAME_W = 800;
const GROUND_Y = 540;
const FLOOR_THICKNESS = 66;

const NET_X = GAME_W / 2;
const NET_HEIGHT = 180;
const NET_WIDTH = 6;
const NET_TOP_Y = GROUND_Y - NET_HEIGHT;
const WALL_THICKNESS = 30;

// ─── Colours ─────────────────────────────────────────────────────────────

const COLOR_SAND       = 0xd4a556;
const COLOR_SAND_DARK  = 0xb8903f;
const COLOR_NET        = 0xffffff;
const COLOR_NET_POLE   = 0x888888;
const COLOR_LINE       = 0xffffff;
const COLOR_SKY_TOP    = 0x4a90d9;
const COLOR_SKY_BOTTOM = 0x87ceeb;
const COLOR_PLAYER1    = 0x3377ee;
const COLOR_PLAYER2    = 0xee4433;

// ─── SandboxConfig → RagdollConfig ───────────────────────────────────────

function toRagdollConfig(c: SandboxConfig): RagdollConfig {
  return {
    mass: c.bodyMass,
    jointLimits: {
      neck:     deg2rad(c.jointLimitNeck),
      knee:     deg2rad(c.jointLimitKnee),
      hip:      deg2rad(c.jointLimitHip),
      spine:    deg2rad(c.jointLimitSpine),
      shoulder: deg2rad(c.jointLimitShoulder),
      elbow:    deg2rad(c.jointLimitElbow),
    },
    damping:            c.damping,
    angularDamping:     c.angularDamping,
    jumpVelocity:       c.jumpVelocity,
    jumpCooldownMs:     c.jumpCooldownMs,
    moveForce:          c.moveForce,
    maxHorizontalSpeed: c.maxHorizontalSpeed,
    armLiftOnJump:      c.armLiftOnJump,
  };
}

// ─── GameScene ────────────────────────────────────────────────────────────

export class GameScene extends Phaser.Scene {
  private p2World!: p2.World;
  private player1!: Ragdoll;
  private player2!: Ragdoll;

  private presetConfigP1!: SandboxConfig;
  private presetConfigP2!: SandboxConfig;

  private keyP1Left!:  Phaser.Input.Keyboard.Key;
  private keyP1Right!: Phaser.Input.Keyboard.Key;
  private keyP1Up!:    Phaser.Input.Keyboard.Key;

  private keyP2Left!:  Phaser.Input.Keyboard.Key;
  private keyP2Right!: Phaser.Input.Keyboard.Key;
  private keyP2Up!:    Phaser.Input.Keyboard.Key;

  constructor() { super({ key: 'GameScene' }); }

  create(): void {
    // ── UI layout ─────────────────────────────────────────────────
    this.layoutPanels();

    // ── p2 world ──────────────────────────────────────────────────
    this.initP2World();

    // ── Phaser visuals (rendering only) ───────────────────────────
    this.drawBackground();
    this.drawCourtVisuals();

    // ── Players ───────────────────────────────────────────────────
    this.createPlayers();
    this.presetConfigP1 = { ...DEFAULT_SANDBOX_CONFIG };
    this.presetConfigP2 = { ...DEFAULT_SANDBOX_CONFIG };

    this.setupControls();
    this.buildPresetPanel();
    this.addControlHints();
    this.createBackButton();

    this.events.once('shutdown', () => {
      const pa = document.getElementById('panel-area');
      const pp = document.getElementById('game-presets-panel');
      if (pa) { pa.style.display = 'none'; pa.style.height = ''; }
      if (pp) { pp.style.display = 'none'; pp.innerHTML = ''; }
    });
  }

  // ─── Panels layout ─────────────────────────────────────────────────

  private layoutPanels(): void {
    const gc = document.getElementById('game-container');
    const pa = document.getElementById('panel-area');
    const cp = document.getElementById('controls-panel');
    const pp = document.getElementById('game-presets-panel');
    if (gc) gc.style.height = '';
    if (pa) { pa.style.display = 'block'; pa.style.height = '12vh'; }
    if (cp) cp.style.display = 'none';
    if (pp) pp.style.display = 'flex';
    requestAnimationFrame(() => { this.scale.getParentBounds(); this.scale.refresh(); });
  }

  // ─── p2 world creation ─────────────────────────────────────────────

  private initP2World(): void {
    const cfg = DEFAULT_SANDBOX_CONFIG;
    this.p2World = new p2.World({ gravity: [cfg.gravityX, cfg.gravityY] });
    const solver = this.p2World.solver as p2.GSSolver;
    solver.iterations = cfg.solverIterations;
    solver.tolerance  = cfg.solverTolerance;

    this.p2World.defaultContactMaterial.friction    = cfg.friction;
    this.p2World.defaultContactMaterial.restitution = cfg.restitution;

    const groundMask = COL_PLAYER1 | COL_PLAYER2 | COL_OTHER;

    // Floor (infinite plane, surface at y = 0)
    const floor = new p2.Body({ position: [0, 0] });
    const floorShape = new p2.Plane();
    floorShape.collisionGroup = COL_GROUND;
    floorShape.collisionMask  = groundMask;
    floor.addShape(floorShape);
    this.p2World.addBody(floor);

    // Side walls
    const wallH = 10;
    const wallW = WALL_THICKNESS / P2_SCALE;
    const gameW = GAME_W / P2_SCALE;

    for (const posX of [-wallW / 2, gameW + wallW / 2]) {
      const wall = new p2.Body({ position: [posX, wallH / 2] });
      const ws = new p2.Box({ width: wallW, height: wallH });
      ws.collisionGroup = COL_GROUND;
      ws.collisionMask  = groundMask;
      wall.addShape(ws);
      this.p2World.addBody(wall);
    }

    // Net
    const netH = NET_HEIGHT / P2_SCALE;
    const netW = NET_WIDTH  / P2_SCALE;
    const netX = NET_X / P2_SCALE;
    const netBody = new p2.Body({ position: [netX, netH / 2] });
    const ns = new p2.Box({ width: netW, height: netH });
    ns.collisionGroup = COL_GROUND;
    ns.collisionMask  = groundMask;
    netBody.addShape(ns);
    this.p2World.addBody(netBody);
  }

  // ─── Background & court visuals (Phaser-only) ──────────────────────

  private drawBackground(): void {
    const sky = this.add.graphics().setDepth(-10);
    const steps = 20;
    const stepH = GROUND_Y / steps;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      sky.fillStyle(lerpColor(COLOR_SKY_TOP, COLOR_SKY_BOTTOM, t), 1);
      sky.fillRect(0, i * stepH, GAME_W, stepH + 1);
    }
  }

  private drawCourtVisuals(): void {
    const fcY = GROUND_Y + FLOOR_THICKNESS / 2;
    this.add.rectangle(GAME_W / 2, fcY, GAME_W, FLOOR_THICKNESS, COLOR_SAND).setDepth(0);
    this.add.rectangle(GAME_W / 2, GROUND_Y + 2, GAME_W, 4, COLOR_SAND_DARK).setDepth(0).setAlpha(0.5);

    // Net pole
    const pH = NET_HEIGHT + 10;
    this.add.rectangle(NET_X, GROUND_Y - pH / 2, 4, pH, COLOR_NET_POLE).setDepth(8);

    // Net surface
    const nv = this.add.rectangle(NET_X, GROUND_Y - NET_HEIGHT / 2, NET_WIDTH, NET_HEIGHT, COLOR_NET)
      .setDepth(7).setAlpha(0.85);
    nv.setStrokeStyle(1, 0xcccccc);

    const lg = this.add.graphics().setDepth(7);
    lg.lineStyle(1, 0xdddddd, 0.6);
    for (let ly = NET_TOP_Y; ly < GROUND_Y; ly += 12) {
      lg.beginPath();
      lg.moveTo(NET_X - NET_WIDTH / 2, ly);
      lg.lineTo(NET_X + NET_WIDTH / 2, ly);
      lg.strokePath();
    }
    this.add.rectangle(NET_X, NET_TOP_Y, NET_WIDTH + 4, 3, 0xffffff).setDepth(9);

    // Court lines
    const gfx = this.add.graphics().setDepth(1);
    const m = 30;
    gfx.lineStyle(2, COLOR_LINE, 0.6);
    gfx.beginPath(); gfx.moveTo(m, GROUND_Y); gfx.lineTo(GAME_W - m, GROUND_Y); gfx.strokePath();
    gfx.beginPath(); gfx.moveTo(m, GROUND_Y); gfx.lineTo(m, GROUND_Y - 4); gfx.strokePath();
    gfx.beginPath(); gfx.moveTo(GAME_W - m, GROUND_Y); gfx.lineTo(GAME_W - m, GROUND_Y - 4); gfx.strokePath();
    gfx.lineStyle(2, COLOR_LINE, 0.3);
    gfx.beginPath(); gfx.moveTo(NET_X, GROUND_Y); gfx.lineTo(NET_X, GROUND_Y - 4); gfx.strokePath();
  }

  // ─── Players ──────────────────────────────────────────────────────

  private createPlayers(): void {
    const cfg = toRagdollConfig(DEFAULT_SANDBOX_CONFIG);
    const p1Mask = COL_GROUND | COL_PLAYER2 | COL_OTHER;
    const p2Mask = COL_GROUND | COL_PLAYER1 | COL_OTHER;

    // p2 x = 4  → Phaser 200 px (left half)
    // p2 x = 12 → Phaser 600 px (right half)
    this.player1 = new Ragdoll(this.p2World, 4, COLOR_PLAYER1, COL_PLAYER1, p1Mask, this, cfg);
    this.player2 = new Ragdoll(this.p2World, 12, COLOR_PLAYER2, COL_PLAYER2, p2Mask, this, cfg);
  }

  // ─── Controls ─────────────────────────────────────────────────────

  private setupControls(): void {
    const kb = this.input.keyboard!;
    this.keyP1Left  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyP1Right = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyP1Up    = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);

    this.keyP2Left  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyP2Right = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyP2Up    = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
  }

  private handleInput(): void {
    if (this.keyP1Left.isDown)  this.player1.moveHorizontal(-1);
    if (this.keyP1Right.isDown) this.player1.moveHorizontal(1);
    if (Phaser.Input.Keyboard.JustDown(this.keyP1Up)) this.player1.jump();

    if (this.keyP2Left.isDown)  this.player2.moveHorizontal(-1);
    if (this.keyP2Right.isDown) this.player2.moveHorizontal(1);
    if (Phaser.Input.Keyboard.JustDown(this.keyP2Up)) this.player2.jump();
  }

  // ─── Preset panel (bottom 12 vh) ──────────────────────────────────

  private buildPresetPanel(): void {
    const panel = document.getElementById('game-presets-panel');
    if (!panel) return;
    panel.innerHTML = '';

    const addCell = (label: string) => {
      const cell = document.createElement('div');
      cell.className = 'preset-cell';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      const sel = document.createElement('select');
      sel.innerHTML = '<option value="">Загрузка…</option>';
      cell.appendChild(lbl);
      cell.appendChild(sel);
      panel.appendChild(cell);
      return sel;
    };

    const selP1 = addCell('Настройки игрока 1');
    const selP2 = addCell('Настройки игрока 2');

    const apply = async (
      sel: HTMLSelectElement,
      player: Ragdoll,
      set: (c: SandboxConfig) => void,
    ) => {
      if (!sel.value) return;
      try {
        const res = await fetch(`${PRESETS_BASE_URL}/${sel.value}`);
        if (!res.ok) return;
        const preset: SavedPreset = await res.json();
        if (preset?.config) {
          const full = { ...DEFAULT_SANDBOX_CONFIG, ...preset.config };
          player.applyConfig(toRagdollConfig(full));
          set(full);
        }
      } catch { /* ignore */ }
    };

    selP1.addEventListener('change', () =>
      apply(selP1, this.player1, c => { this.presetConfigP1 = c; }));
    selP2.addEventListener('change', () =>
      apply(selP2, this.player2, c => { this.presetConfigP2 = c; }));

    const fill = (sel: HTMLSelectElement, list: PresetsManifest['presets']) => {
      sel.innerHTML = '';
      if (!list.length) {
        const o = document.createElement('option');
        o.value = ''; o.textContent = '— Нет пресетов —';
        sel.appendChild(o);
        return;
      }
      for (const p of list) {
        const o = document.createElement('option');
        o.value = p.file; o.textContent = p.name;
        sel.appendChild(o);
      }
    };

    void (async () => {
      try {
        const res = await fetch(`${PRESETS_BASE_URL}/manifest.json`);
        if (!res.ok) return;
        const m: PresetsManifest = await res.json();
        fill(selP1, m.presets);
        fill(selP2, m.presets);
        if (m.presets.length) {
          selP1.value = m.presets[0].file;
          selP2.value = m.presets[0].file;
          await apply(selP1, this.player1, c => { this.presetConfigP1 = c; });
          await apply(selP2, this.player2, c => { this.presetConfigP2 = c; });
        }
      } catch {
        fill(selP1, []); fill(selP2, []);
      }
    })();
  }

  // ─── Back button ──────────────────────────────────────────────────

  private createBackButton(): void {
    const x = GAME_W / 2, y = 16, w = 180, h = 28;
    const bg = this.add.graphics().setDepth(50);
    const draw = (f: number, a: number) => {
      bg.clear(); bg.fillStyle(f, a);
      bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
    };
    draw(0x000000, 0.5);

    this.add.text(x, y, '← Главное меню', { fontSize: '13px', color: '#ffffff' })
      .setOrigin(0.5).setDepth(51);

    const zone = this.add.rectangle(x, y, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true }).setDepth(52);
    zone.on('pointerover', () => draw(0x333333, 0.8));
    zone.on('pointerout',  () => draw(0x000000, 0.5));
    zone.on('pointerdown', () => this.scene.start('MainMenuScene'));
  }

  private addControlHints(): void {
    const s: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '13px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    };
    this.add.text(16, 16, 'P1: W A D', s).setDepth(20).setAlpha(0.7);
    this.add.text(GAME_W - 16, 16, 'P2: ← ↑ →', s).setDepth(20).setAlpha(0.7).setOrigin(1, 0);
  }

  // ─── World config from preset ─────────────────────────────────────

  private applyWorldConfig(c: SandboxConfig): void {
    this.p2World.gravity[0] = c.gravityX;
    this.p2World.gravity[1] = c.gravityY;
    const solver = this.p2World.solver as p2.GSSolver;
    solver.iterations = c.solverIterations;
    solver.tolerance  = c.solverTolerance;
    this.p2World.defaultContactMaterial.friction    = c.friction;
    this.p2World.defaultContactMaterial.restitution = c.restitution;
  }

  // ─── Game loop ────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    this.applyWorldConfig(this.presetConfigP1);
    this.player1.applyConfig(toRagdollConfig(this.presetConfigP1));
    this.player2.applyConfig(toRagdollConfig(this.presetConfigP2));

    this.handleInput();

    this.p2World.step(1 / 60, delta / 1000, 10);

    this.player1.update();
    this.player2.update();
  }
}

// ─── Utility ────────────────────────────────────────────────────────────

function lerpColor(a: number, b: number, t: number): number {
  const rA = (a >> 16) & 0xff, gA = (a >> 8) & 0xff, bA = a & 0xff;
  const rB = (b >> 16) & 0xff, gB = (b >> 8) & 0xff, bB = b & 0xff;
  return (Math.round(rA + (rB - rA) * t) << 16) |
         (Math.round(gA + (gB - gA) * t) << 8)  |
          Math.round(bA + (bB - bA) * t);
}
