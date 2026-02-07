import Phaser from 'phaser';
import { Ragdoll, type RagdollConfig } from '../entities/Ragdoll';
import {
  DEFAULT_SANDBOX_CONFIG,
  PRESETS_BASE_URL,
  type PresetsManifest,
  type SavedPreset,
  type SandboxConfig,
} from '../types/sandboxConfig';

// ─── Размеры и цвета площадки ──────────────────────────────────────────

const GAME_W = 800;
const GAME_H = 600;
const GROUND_Y = 540;
/** Высота пола увеличена на 10% под нижнюю панель пресетов */
const FLOOR_THICKNESS = 66;

const NET_X = GAME_W / 2;
const NET_HEIGHT = 180;
const NET_WIDTH = 6;
const NET_TOP_Y = GROUND_Y - NET_HEIGHT;

const WALL_THICKNESS = 30;

// Цвета
const COLOR_SAND = 0xd4a556;
const COLOR_SAND_DARK = 0xb8903f;
const COLOR_NET = 0xffffff;
const COLOR_NET_POLE = 0x888888;
const COLOR_LINE = 0xffffff;
const COLOR_SKY_TOP = 0x4a90d9;
const COLOR_SKY_BOTTOM = 0x87ceeb;
const COLOR_PLAYER1 = 0x3377ee;
const COLOR_PLAYER2 = 0xee4433;

// ─── Преобразование конфига песочницы в конфиг рагдолла ───────────────
// Мировые параметры (gravityX, gravityY, positionIterations, velocityIterations,
// constraintIterations) не входят в RagdollConfig — применяются к миру отдельно.

function sandboxConfigToRagdollConfig(c: SandboxConfig): RagdollConfig {
  return {
    frictionAirTorso: c.frictionAirTorso,
    frictionAirLimbs: c.frictionAirLimbs,
    density: c.density,
    densityTorso: c.densityTorso,
    densityLimbs: c.densityLimbs,
    friction: c.friction,
    frictionStatic: c.frictionStatic,
    restitution: c.restitution,
    footRestitution: c.footRestitution,
    stabilizationMultiplier: c.stabilizationMultiplier,
    stabilizationTorsoKp: c.stabilizationTorsoKp,
    stabilizationTorsoKd: c.stabilizationTorsoKd,
    stabilizationHeadKp: c.stabilizationHeadKp,
    stabilizationHeadKd: c.stabilizationHeadKd,
    stabilizationLegKp: c.stabilizationLegKp,
    stabilizationLegKd: c.stabilizationLegKd,
    stabilizationArmKp: c.stabilizationArmKp,
    stabilizationArmKd: c.stabilizationArmKd,
    enforceStructureStrength: c.enforceStructureStrength,
    maxVerticalSpeed: c.maxVerticalSpeed,
    angularDamping: c.angularDamping,
    jumpVelocity: c.jumpVelocity,
    jumpCooldownMs: c.jumpCooldownMs,
    moveForceScale: c.impulseStrength / DEFAULT_SANDBOX_CONFIG.impulseStrength,
    armLiftOnJump: c.armLiftOnJump,
  };
}

// ─── GameScene ────────────────────────────────────────────────────────

export class GameScene extends Phaser.Scene {
  private player1!: Ragdoll;
  private player2!: Ragdoll;

  /** Текущий конфиг пресета для каждого игрока (применяется каждый кадр) */
  private presetConfigP1!: SandboxConfig;
  private presetConfigP2!: SandboxConfig;

  // Клавиши управления
  private keyP1Left!: Phaser.Input.Keyboard.Key;
  private keyP1Right!: Phaser.Input.Keyboard.Key;
  private keyP1Up!: Phaser.Input.Keyboard.Key;

  private keyP2Left!: Phaser.Input.Keyboard.Key;
  private keyP2Right!: Phaser.Input.Keyboard.Key;
  private keyP2Up!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Игра: контейнер на оставшуюся высоту, снизу панель пресетов 10vh
    const gameContainer = document.getElementById('game-container');
    const panelArea = document.getElementById('panel-area');
    const controlsPanel = document.getElementById('controls-panel');
    const presetsPanel = document.getElementById('game-presets-panel');
    if (gameContainer) gameContainer.style.height = '';
    if (panelArea) {
      panelArea.style.display = 'block';
      panelArea.style.height = '12vh';
    }
    if (controlsPanel) controlsPanel.style.display = 'none';
    if (presetsPanel) presetsPanel.style.display = 'flex';
    requestAnimationFrame(() => {
      this.scale.getParentBounds();
      this.scale.refresh();
    });

    this.drawBackground();
    this.createCourt();
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
      if (pa) {
        pa.style.display = 'none';
        pa.style.height = '';
      }
      if (pp) {
        pp.style.display = 'none';
        pp.innerHTML = '';
      }
    });
  }

  // ─── Фон ───────────────────────────────────────────────────────────

  private drawBackground(): void {
    const sky = this.add.graphics();
    sky.setDepth(-10);

    const steps = 20;
    const stepH = GROUND_Y / steps;

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const color = lerpColor(COLOR_SKY_TOP, COLOR_SKY_BOTTOM, t);
      sky.fillStyle(color, 1);
      sky.fillRect(0, i * stepH, GAME_W, stepH + 1);
    }
  }

  // ─── Площадка ──────────────────────────────────────────────────────

  private createCourt(): void {
    this.createFloor();
    this.createNet();
    this.createWalls();
    this.drawCourtLines();
  }

  private createFloor(): void {
    const floorCenterY = GROUND_Y + FLOOR_THICKNESS / 2;

    this.add.rectangle(GAME_W / 2, floorCenterY, GAME_W, FLOOR_THICKNESS, COLOR_SAND)
      .setDepth(0);

    this.add.rectangle(GAME_W / 2, GROUND_Y + 2, GAME_W, 4, COLOR_SAND_DARK)
      .setDepth(0)
      .setAlpha(0.5);

    this.matter.add.rectangle(GAME_W / 2, floorCenterY, GAME_W, FLOOR_THICKNESS, {
      isStatic: true,
      friction: 0.8,
      label: 'floor',
    });
  }

  private createNet(): void {
    const netCenterY = GROUND_Y - NET_HEIGHT / 2;

    const poleWidth = 4;
    const poleHeight = NET_HEIGHT + 10;
    this.add.rectangle(NET_X, GROUND_Y - poleHeight / 2, poleWidth, poleHeight, COLOR_NET_POLE)
      .setDepth(8);

    const netVisual = this.add.rectangle(NET_X, netCenterY, NET_WIDTH, NET_HEIGHT, COLOR_NET)
      .setDepth(7)
      .setAlpha(0.85);
    netVisual.setStrokeStyle(1, 0xcccccc);

    const netLines = this.add.graphics().setDepth(7);
    netLines.lineStyle(1, 0xdddddd, 0.6);
    const lineSpacing = 12;
    for (let ly = NET_TOP_Y; ly < GROUND_Y; ly += lineSpacing) {
      netLines.beginPath();
      netLines.moveTo(NET_X - NET_WIDTH / 2, ly);
      netLines.lineTo(NET_X + NET_WIDTH / 2, ly);
      netLines.strokePath();
    }

    this.add.rectangle(NET_X, NET_TOP_Y, NET_WIDTH + 4, 3, 0xffffff)
      .setDepth(9);

    this.matter.add.rectangle(NET_X, netCenterY, NET_WIDTH, NET_HEIGHT, {
      isStatic: true,
      friction: 0.1,
      restitution: 0.3,
      label: 'net',
    });
  }

  private createWalls(): void {
    this.matter.add.rectangle(-WALL_THICKNESS / 2, GAME_H / 2, WALL_THICKNESS, GAME_H, {
      isStatic: true,
      label: 'wallLeft',
    });

    this.matter.add.rectangle(GAME_W + WALL_THICKNESS / 2, GAME_H / 2, WALL_THICKNESS, GAME_H, {
      isStatic: true,
      label: 'wallRight',
    });
  }

  private drawCourtLines(): void {
    const gfx = this.add.graphics().setDepth(1);
    const courtMargin = 30;

    gfx.lineStyle(2, COLOR_LINE, 0.6);

    gfx.beginPath();
    gfx.moveTo(courtMargin, GROUND_Y);
    gfx.lineTo(GAME_W - courtMargin, GROUND_Y);
    gfx.strokePath();

    gfx.beginPath();
    gfx.moveTo(courtMargin, GROUND_Y);
    gfx.lineTo(courtMargin, GROUND_Y - 4);
    gfx.strokePath();

    gfx.beginPath();
    gfx.moveTo(GAME_W - courtMargin, GROUND_Y);
    gfx.lineTo(GAME_W - courtMargin, GROUND_Y - 4);
    gfx.strokePath();

    gfx.lineStyle(2, COLOR_LINE, 0.3);
    gfx.beginPath();
    gfx.moveTo(NET_X, GROUND_Y);
    gfx.lineTo(NET_X, GROUND_Y - 4);
    gfx.strokePath();
  }

  // ─── Игроки ────────────────────────────────────────────────────────

  private createPlayers(): void {
    const defaultRagdollConfig = sandboxConfigToRagdollConfig(DEFAULT_SANDBOX_CONFIG);
    this.player1 = new Ragdoll(this, 200, GROUND_Y, COLOR_PLAYER1, -1, defaultRagdollConfig);
    this.player2 = new Ragdoll(this, 600, GROUND_Y, COLOR_PLAYER2, -2, defaultRagdollConfig);
  }

  // ─── Управление ────────────────────────────────────────────────────

  private setupControls(): void {
    const kb = this.input.keyboard!;

    // Игрок 1: W A D
    this.keyP1Left = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyP1Right = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyP1Up = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);

    // Игрок 2: стрелки
    this.keyP2Left = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyP2Right = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyP2Up = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
  }

  private handleInput(): void {
    // ─── Player 1 ───
    if (this.keyP1Left.isDown) this.player1.moveHorizontal(-1);
    if (this.keyP1Right.isDown) this.player1.moveHorizontal(1);
    if (Phaser.Input.Keyboard.JustDown(this.keyP1Up)) this.player1.jump();

    // ─── Player 2 ───
    if (this.keyP2Left.isDown) this.player2.moveHorizontal(-1);
    if (this.keyP2Right.isDown) this.player2.moveHorizontal(1);
    if (Phaser.Input.Keyboard.JustDown(this.keyP2Up)) this.player2.jump();
  }

  // ─── Нижняя панель выбора пресетов (10vh), селекты по центру зон игроков ─

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

    const selectP1 = addCell('Загрузить настройки для игрока 1');
    const selectP2 = addCell('Загрузить настройки для игрока 2');

    const applyPresetToPlayer = (player: Ragdoll, config: SandboxConfig): void => {
      player.applyConfig(sandboxConfigToRagdollConfig(config));
    };

    const onSelectChange = async (
      select: HTMLSelectElement,
      player: Ragdoll,
      setPresetConfig: (config: SandboxConfig) => void,
    ) => {
      const file = select.value;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/47129043-05d8-400f-9097-49e95bba1a31',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameScene.ts:onSelectChange',message:'onSelectChange called',data:{file,hasFile:!!file},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      if (!file) return;
      try {
        const url = `${PRESETS_BASE_URL}/${file}`;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/47129043-05d8-400f-9097-49e95bba1a31',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameScene.ts:beforeFetch',message:'before fetch',data:{url},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        const res = await fetch(url);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/47129043-05d8-400f-9097-49e95bba1a31',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameScene.ts:afterFetch',message:'after fetch',data:{ok:res.ok,status:res.status},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        if (!res.ok) return;
        const preset: SavedPreset = await res.json();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/47129043-05d8-400f-9097-49e95bba1a31',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameScene.ts:afterJson',message:'after json',data:{hasPreset:!!preset,hasConfig:!!(preset?.config)},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        if (preset?.config) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/47129043-05d8-400f-9097-49e95bba1a31',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameScene.ts:beforeApply',message:'calling applyPresetToPlayer',data:{},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          const fullConfig = { ...DEFAULT_SANDBOX_CONFIG, ...preset.config };
          applyPresetToPlayer(player, fullConfig);
          setPresetConfig(fullConfig);
        }
      } catch (e) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/47129043-05d8-400f-9097-49e95bba1a31',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameScene.ts:catch',message:'fetch/json error',data:{err:String(e)},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
        // #endregion
      }
    };

    const logChange = (
      which: string,
      select: HTMLSelectElement,
      player: Ragdoll,
      setPresetConfig: (config: SandboxConfig) => void,
    ) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/47129043-05d8-400f-9097-49e95bba1a31',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameScene.ts:change',message:'select change fired',data:{which,value:select.value},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      onSelectChange(select, player, setPresetConfig);
    };
    selectP1.addEventListener('change', () =>
      logChange('P1', selectP1, this.player1, (c) => {
        this.presetConfigP1 = c;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/47129043-05d8-400f-9097-49e95bba1a31',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameScene.ts:setPresetP1',message:'presetConfigP1 set',data:{jumpVelocity:c.jumpVelocity},timestamp:Date.now(),hypothesisId:'F'})}).catch(()=>{});
        // #endregion
      }));
    selectP2.addEventListener('change', () =>
      logChange('P2', selectP2, this.player2, (c) => {
        this.presetConfigP2 = c;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/47129043-05d8-400f-9097-49e95bba1a31',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GameScene.ts:setPresetP2',message:'presetConfigP2 set',data:{jumpVelocity:c.jumpVelocity},timestamp:Date.now(),hypothesisId:'F'})}).catch(()=>{});
        // #endregion
      }));

    const fillSelect = (sel: HTMLSelectElement, presets: PresetsManifest['presets']) => {
      sel.innerHTML = '';
      if (presets.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '— Нет пресетов —';
        sel.appendChild(opt);
        return;
      }
      for (const p of presets) {
        const opt = document.createElement('option');
        opt.value = p.file;
        opt.textContent = p.name;
        sel.appendChild(opt);
      }
    };

    const refreshPresetList = async () => {
      try {
        const res = await fetch(`${PRESETS_BASE_URL}/manifest.json`);
        if (!res.ok) return;
        const manifest: PresetsManifest = await res.json();
        fillSelect(selectP1, manifest.presets);
        fillSelect(selectP2, manifest.presets);
        // Сразу применить выбранный (первый) пресет к обоим игрокам
        if (manifest.presets.length > 0) {
          selectP1.value = manifest.presets[0].file;
          selectP2.value = manifest.presets[0].file;
          await onSelectChange(selectP1, this.player1, (c) => { this.presetConfigP1 = c; });
          await onSelectChange(selectP2, this.player2, (c) => { this.presetConfigP2 = c; });
        }
      } catch {
        const empty: PresetsManifest['presets'] = [];
        fillSelect(selectP1, empty);
        fillSelect(selectP2, empty);
        if (selectP1.options[0]) selectP1.options[0].textContent = '— Ошибка загрузки —';
        if (selectP2.options[0]) selectP2.options[0].textContent = '— Ошибка загрузки —';
      }
    };

    void refreshPresetList();
  }

  // ─── Кнопка «Назад в меню» ─────────────────────────────────────────

  private createBackButton(): void {
    const x = GAME_W / 2;
    const y = 16;
    const w = 180;
    const h = 28;

    const bg = this.add.graphics().setDepth(50);
    const drawBg = (fill: number, alpha: number) => {
      bg.clear();
      bg.fillStyle(fill, alpha);
      bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
    };
    drawBg(0x000000, 0.5);

    this.add
      .text(x, y, '← Главное меню', {
        fontSize: '13px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(51);

    const zone = this.add
      .rectangle(x, y, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(52);

    zone.on('pointerover', () => drawBg(0x333333, 0.8));
    zone.on('pointerout', () => drawBg(0x000000, 0.5));
    zone.on('pointerdown', () => this.scene.start('MainMenuScene'));
  }

  // ─── Подсказки управления ──────────────────────────────────────────

  private addControlHints(): void {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '13px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    };

    this.add.text(16, 16, 'P1: W A D', style).setDepth(20).setAlpha(0.7);
    this.add.text(GAME_W - 16, 16, 'P2: ← ↑ →', style).setDepth(20).setAlpha(0.7).setOrigin(1, 0);
  }

  /** Применить к миру гравитацию и итерации движка (общие для всех, берём из пресета P1) */
  private applyWorldConfig(config: SandboxConfig): void {
    const engine = this.matter.world.engine;
    engine.world.gravity.x = config.gravityX;
    engine.world.gravity.y = config.gravityY;
    engine.positionIterations = config.positionIterations;
    engine.velocityIterations = config.velocityIterations;
    engine.constraintIterations = config.constraintIterations;
  }

  // ─── Игровой цикл ─────────────────────────────────────────────────

  update(): void {
    this.applyWorldConfig(this.presetConfigP1);
    this.player1.applyConfig(sandboxConfigToRagdollConfig(this.presetConfigP1));
    this.player2.applyConfig(sandboxConfigToRagdollConfig(this.presetConfigP2));
    this.handleInput();
    this.player1.update();
    this.player2.update();
  }
}

// ─── Утилита: линейная интерполяция цвета ────────────────────────────

function lerpColor(colorA: number, colorB: number, t: number): number {
  const rA = (colorA >> 16) & 0xff;
  const gA = (colorA >> 8) & 0xff;
  const bA = colorA & 0xff;

  const rB = (colorB >> 16) & 0xff;
  const gB = (colorB >> 8) & 0xff;
  const bB = colorB & 0xff;

  const r = Math.round(rA + (rB - rA) * t);
  const g = Math.round(gA + (gB - gA) * t);
  const b = Math.round(bA + (bB - bA) * t);

  return (r << 16) | (g << 8) | b;
}
