import Phaser from 'phaser';
import * as p2 from 'p2-es';
import {
  Ragdoll,
  type RagdollConfig,
  P2_SCALE,
  COL_PLAYER1, COL_GROUND, COL_OTHER,
} from '../entities/Ragdoll';
import {
  type SandboxConfig,
  DEFAULT_SANDBOX_CONFIG,
  PRESETS_BASE_URL,
  deg2rad,
  type PresetsManifest,
  type SavedPreset,
} from '../types/sandboxConfig';

// ─── Layout (Phaser pixels) ─────────────────────────────────────────────

const GAME_W = 800;
const GAME_H = 600;
const GROUND_Y = 540;
const FLOOR_THICKNESS = 24;
const WALL_THICKNESS = 30;

const COLOR_FLOOR      = 0x3d5c3d;
const COLOR_SKY_TOP    = 0x4a90d9;
const COLOR_SKY_BOTTOM = 0x87ceeb;
const COLOR_PLAYER     = 0x3377ee;

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

// ─── SandboxScene ────────────────────────────────────────────────────────

export class SandboxScene extends Phaser.Scene {
  private p2World!: p2.World;
  private ragdoll!: Ragdoll;
  private config: SandboxConfig = { ...DEFAULT_SANDBOX_CONFIG };

  private keyLeft!:  Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;
  private keyUp!:    Phaser.Input.Keyboard.Key;
  private keyDown!:  Phaser.Input.Keyboard.Key;

  constructor() { super({ key: 'SandboxScene' }); }

  create(): void {
    this.layoutPanels();
    this.initP2World();
    this.drawBackground();
    this.drawFloor();
    this.createRagdoll();
    this.setupControls();
    this.buildControlPanel();
    this.addControlHints();
    this.createBackButton();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => { this.scale.getParentBounds(); this.scale.refresh(); });
    });

    this.events.once('shutdown', () => {
      const gc = document.getElementById('game-container');
      const pa = document.getElementById('panel-area');
      const cp = document.getElementById('controls-panel');
      if (gc) gc.style.height = '';
      if (pa) { pa.style.height = ''; pa.style.display = 'none'; }
      if (cp) { cp.innerHTML = ''; cp.style.display = 'none'; }
    });
  }

  // ─── Layout ─────────────────────────────────────────────────────────

  private layoutPanels(): void {
    const gc = document.getElementById('game-container');
    const pa = document.getElementById('panel-area');
    const cp = document.getElementById('controls-panel');
    if (gc) gc.style.height = '40vh';
    if (pa) { pa.style.height = '30vh'; pa.style.display = 'block'; }
    if (cp) cp.style.display = 'flex';
  }

  // ─── p2 world ───────────────────────────────────────────────────────

  private initP2World(): void {
    const c = this.config;
    this.p2World = new p2.World({ gravity: [c.gravityX, c.gravityY] });
    const solver = this.p2World.solver as p2.GSSolver;
    solver.iterations = c.solverIterations;
    solver.tolerance  = c.solverTolerance;
    this.p2World.defaultContactMaterial.friction    = c.friction;
    this.p2World.defaultContactMaterial.restitution = c.restitution;

    const mask = COL_PLAYER1 | COL_OTHER;

    // Floor plane at y = 0
    const floor = new p2.Body({ position: [0, 0] });
    const fs = new p2.Plane();
    fs.collisionGroup = COL_GROUND;
    fs.collisionMask  = mask;
    floor.addShape(fs);
    this.p2World.addBody(floor);

    // Side walls
    const wallH = 10;
    const wallW = WALL_THICKNESS / P2_SCALE;
    const gameW = GAME_W / P2_SCALE;
    for (const posX of [-wallW / 2, gameW + wallW / 2]) {
      const wall = new p2.Body({ position: [posX, wallH / 2] });
      const ws = new p2.Box({ width: wallW, height: wallH });
      ws.collisionGroup = COL_GROUND;
      ws.collisionMask  = mask;
      wall.addShape(ws);
      this.p2World.addBody(wall);
    }
  }

  // ─── Phaser visuals ─────────────────────────────────────────────────

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

  private drawFloor(): void {
    const fcY = GROUND_Y + FLOOR_THICKNESS / 2;
    this.add.rectangle(GAME_W / 2, fcY, GAME_W, FLOOR_THICKNESS, COLOR_FLOOR).setDepth(0);
    this.add.rectangle(GAME_W / 2, GROUND_Y, GAME_W, 4, 0x2d4a2d).setDepth(0.5);
  }

  // ─── Ragdoll ────────────────────────────────────────────────────────

  private createRagdoll(): void {
    const cfg = toRagdollConfig(this.config);
    const mask = COL_GROUND | COL_OTHER;
    // Center of the scene in p2 coords: 400px / 50 = 8
    this.ragdoll = new Ragdoll(this.p2World, 8, COLOR_PLAYER, COL_PLAYER1, mask, this, cfg);
  }

  // ─── Controls ───────────────────────────────────────────────────────

  private setupControls(): void {
    const kb = this.input.keyboard!;
    this.keyLeft  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyUp    = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
  }

  private handleInput(): void {
    const c = this.config;
    const str = c.impulseStrength;
    const hS  = c.horizontalImpulseScale;
    const vS  = c.verticalImpulseScale;

    // Jump on first press
    if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
      this.ragdoll.applyJump(c.jumpVelocity, c.armLiftOnJump, c.jumpCooldownMs);
    }

    // Continuous impulse (p2 Y-up: positive = up)
    if (this.keyLeft.isDown)  this.ragdoll.applyTorsoImpulse({ x: -str * hS, y: 0 });
    if (this.keyRight.isDown) this.ragdoll.applyTorsoImpulse({ x:  str * hS, y: 0 });
    if (this.keyUp.isDown)    this.ragdoll.applyTorsoImpulse({ x: 0, y:  str * vS });
    if (this.keyDown.isDown)  this.ragdoll.applyTorsoImpulse({ x: 0, y: -str * vS });
  }

  // ─── World config sync ──────────────────────────────────────────────

  private applyConfigToWorld(): void {
    this.p2World.gravity[0] = this.config.gravityX;
    this.p2World.gravity[1] = this.config.gravityY;
    const solver = this.p2World.solver as p2.GSSolver;
    solver.iterations = this.config.solverIterations;
    solver.tolerance  = this.config.solverTolerance;
    this.p2World.defaultContactMaterial.friction    = this.config.friction;
    this.p2World.defaultContactMaterial.restitution = this.config.restitution;
  }

  private applyConfigToRagdoll(): void {
    this.ragdoll.applyConfig(toRagdollConfig(this.config));
  }

  // ─── Back button ────────────────────────────────────────────────────

  private createBackButton(): void {
    const x = GAME_W - 100, y = 16, w = 180, h = 28;
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
    this.add.text(16, 16, '↑ — прыжок | ← → ↑ ↓ — импульс', s).setDepth(20).setAlpha(0.8);
  }

  // ─── Game loop ──────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    this.applyConfigToWorld();
    this.applyConfigToRagdoll();
    this.handleInput();
    this.p2World.step(1 / 60, delta / 1000, 10);
    this.ragdoll.update();
  }

  // ─── Slider panel ──────────────────────────────────────────────────

  private buildControlPanel(): void {
    const panel = document.getElementById('controls-panel');
    if (!panel) return;
    panel.innerHTML = '';

    const slider = (
      label: string,
      key: keyof SandboxConfig,
      min: number,
      max: number,
      step: number,
      desc: string,
      fmt?: (v: number) => string,
    ) => {
      const group = document.createElement('div');
      group.className = 'control-group';
      group.title = desc;

      const val = Number(this.config[key]);
      const span = document.createElement('span');
      span.textContent = fmt ? fmt(val) : val.toFixed(2);

      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(min); input.max = String(max);
      input.step = String(step); input.value = String(val);
      input.title = desc;
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        (this.config as unknown as Record<string, number>)[key] = v;
        span.textContent = fmt ? fmt(v) : v.toFixed(2);
      });

      const row = document.createElement('div');
      row.className = 'control-row';
      row.appendChild(input);
      row.appendChild(span);

      const lbl = document.createElement('label');
      lbl.textContent = label; lbl.title = desc;
      group.appendChild(lbl);
      group.appendChild(row);

      const d = document.createElement('span');
      d.className = 'control-desc'; d.textContent = desc;
      group.appendChild(d);
      panel!.appendChild(group);
    };

    const intFmt = (v: number) => String(Math.round(v));
    const degFmt = (v: number) => `${Math.round(v)}°`;

    // ── World ──────────────────────────────────────
    slider('Гравитация',          'gravityY',          -20, 0,   0.5,
      'Сила гравитации (p2: отрицательная = вниз). -10 — земная.');

    // ── Mass ───────────────────────────────────────
    slider('Масса тел',           'bodyMass',           0.1, 10, 0.1,
      'Масса каждой части тела рагдолла.');

    // ── Joint limits (degrees) ─────────────────────
    slider('Шея (лимит)',         'jointLimitNeck',      5,  90,  1,
      'Максимальный угол отклонения в шейном суставе.',   degFmt);
    slider('Колени (лимит)',      'jointLimitKnee',      5,  90,  1,
      'Максимальный угол отклонения в коленях.',          degFmt);
    slider('Бёдра (лимит)',       'jointLimitHip',       5,  90,  1,
      'Максимальный угол отклонения в тазобедренных.',    degFmt);
    slider('Плечи (лимит)',       'jointLimitShoulder',  10, 180, 1,
      'Максимальный угол отклонения в плечах.',           degFmt);

    // ── Contact ────────────────────────────────────
    slider('Трение',              'friction',            0,  5,   0.1,
      'Трение контактных материалов (рагдолл ↔ пол).');
    slider('Упругость',           'restitution',         0,  1,   0.05,
      'Упругость контактов. 0 — без отскока, 1 — идеальный отскок.');

    // ── Movement ───────────────────────────────────
    slider('Сила прыжка',        'jumpVelocity',         1,  30,  0.5,
      'Начальная скорость вверх при прыжке.');
    slider('Сила движения',      'moveForce',            10, 500, 10,
      'Сила горизонтального движения.',                   intFmt);

    // ── Presets ────────────────────────────────────
    this.buildPresetBlock(panel);
  }

  // ─── Presets block ──────────────────────────────────────────────────

  private buildPresetBlock(panel: HTMLElement): void {
    const group = document.createElement('div');
    group.className = 'control-group';
    group.style.minWidth = '180px';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Сохранить пресет';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Имя пресета';
    Object.assign(nameInput.style, {
      width: '100%', marginTop: '4px', padding: '4px',
      background: '#3a3a3a', color: '#eee', border: '1px solid #555', borderRadius: '4px',
    });

    const loadSelect = document.createElement('select');
    loadSelect.innerHTML = '<option value="">— Загрузить —</option>';

    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Загрузить';

    const refreshList = async () => {
      try {
        const res = await fetch(`${PRESETS_BASE_URL}/manifest.json`);
        if (!res.ok) return;
        const m: PresetsManifest = await res.json();
        loadSelect.innerHTML = '<option value="">— Загрузить —</option>';
        for (const p of m.presets) {
          const o = document.createElement('option');
          o.value = p.file; o.textContent = p.name;
          loadSelect.appendChild(o);
        }
      } catch {
        loadSelect.innerHTML = '<option value="">— Загрузить —</option>';
      }
    };
    void refreshList();

    saveBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim() || `Preset ${Date.now()}`;
      const preset: SavedPreset = { name, config: { ...this.config } };
      try {
        const res = await fetch('/__presets__/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(preset),
        });
        if (res.ok) { await refreshList(); nameInput.value = ''; return; }
      } catch { /* fallback to download */ }
      const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || 'preset'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      nameInput.value = '';
    });

    loadBtn.addEventListener('click', async () => {
      if (!loadSelect.value) return;
      try {
        const res = await fetch(`${PRESETS_BASE_URL}/${loadSelect.value}`);
        if (!res.ok) return;
        const preset: SavedPreset = await res.json();
        if (preset?.config) {
          this.config = { ...DEFAULT_SANDBOX_CONFIG, ...preset.config };
          this.refreshPanelValues(panel);
        }
      } catch { /* ignore */ }
    });

    group.appendChild(document.createElement('label')).textContent = 'Пресеты';
    group.appendChild(saveBtn);
    group.appendChild(nameInput);

    const loadRow = document.createElement('div');
    loadRow.className = 'control-row';
    loadRow.style.marginTop = '4px';
    loadRow.appendChild(loadSelect);
    loadRow.appendChild(loadBtn);
    group.appendChild(loadRow);
    panel.appendChild(group);
  }

  // ─── Refresh slider values after preset load ───────────────────────

  private refreshPanelValues(panel: HTMLElement): void {
    const inputs = panel.querySelectorAll<HTMLInputElement>('input[type="range"]');
    const spans  = panel.querySelectorAll<HTMLSpanElement>('.control-row span');

    // Must match the order of slider() calls in buildControlPanel
    const keys: (keyof SandboxConfig)[] = [
      'gravityY',
      'bodyMass',
      'jointLimitNeck', 'jointLimitKnee', 'jointLimitHip', 'jointLimitShoulder',
      'friction', 'restitution',
      'jumpVelocity', 'moveForce',
    ];

    const intKeys = new Set<string>(['moveForce']);
    const degKeys = new Set<string>([
      'jointLimitNeck', 'jointLimitKnee', 'jointLimitHip', 'jointLimitShoulder',
    ]);

    keys.forEach((key, i) => {
      const inp  = inputs[i];
      const span = spans[i];
      if (!inp || !span) return;
      const v = Number(this.config[key]);
      inp.value = String(v);
      if (intKeys.has(key))       span.textContent = String(Math.round(v));
      else if (degKeys.has(key))  span.textContent = `${Math.round(v)}°`;
      else                        span.textContent = v.toFixed(2);
    });
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
