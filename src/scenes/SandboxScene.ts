import Phaser from 'phaser';
import { Ragdoll } from '../entities/Ragdoll';
import type { RagdollConfig, StabilizationConfig } from '../entities/Ragdoll';
import {
  type SandboxConfig,
  DEFAULT_SANDBOX_CONFIG,
  PRESETS_STORAGE_KEY,
  type SavedPreset,
} from '../types/sandboxConfig';

const GAME_W = 800;
const GAME_H = 600;
const GROUND_Y = 540;
/** Тонкий слой поверхности между игроком и панелью настроек (заметный на фоне неба) */
const FLOOR_THICKNESS = 24;
const WALL_THICKNESS = 30;
/** Тёмно-зелёный, контрастный к градиенту неба */
const COLOR_FLOOR = 0x3d5c3d;
const COLOR_SKY_TOP = 0x4a90d9;
const COLOR_SKY_BOTTOM = 0x87ceeb;
const COLOR_PLAYER = 0x3377ee;

export class SandboxScene extends Phaser.Scene {
  private ragdoll!: Ragdoll;
  private config: SandboxConfig = { ...DEFAULT_SANDBOX_CONFIG };
  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'SandboxScene' });
  }

  create(): void {
    // Sandbox: 40% высоты — игровая зона (с полом), 30% — панель регуляторов
    const gameContainer = document.getElementById('game-container');
    const panelArea = document.getElementById('panel-area');
    const panel = document.getElementById('controls-panel');
    if (gameContainer) gameContainer.style.height = '40vh';
    if (panelArea) {
      panelArea.style.height = '30vh';
      panelArea.style.display = 'block';
    }
    if (panel) panel.style.display = 'flex';

    this.drawBackground();
    this.createFloorAndWalls();
    this.createRagdoll();
    this.setupControls();
    this.buildControlPanel();
    this.addControlHints();
    this.createBackButton();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.scale.getParentBounds();
        this.scale.refresh();
      });
    });

    this.events.once('shutdown', () => {
      const gc = document.getElementById('game-container');
      const pa = document.getElementById('panel-area');
      const p = document.getElementById('controls-panel');
      if (gc) gc.style.height = '';
      if (pa) {
        pa.style.height = '';
        pa.style.display = 'none';
      }
      if (p) {
        p.innerHTML = '';
        p.style.display = 'none';
      }
    });
  }

  private drawBackground(): void {
    const sky = this.add.graphics().setDepth(-10);
    const steps = 20;
    const stepH = GROUND_Y / steps;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const color = this.lerpColor(COLOR_SKY_TOP, COLOR_SKY_BOTTOM, t);
      sky.fillStyle(color, 1);
      sky.fillRect(0, i * stepH, GAME_W, stepH + 1);
    }
  }

  private createFloorAndWalls(): void {
    const floorCenterY = GROUND_Y + FLOOR_THICKNESS / 2;
    this.add.rectangle(GAME_W / 2, floorCenterY, GAME_W, FLOOR_THICKNESS, COLOR_FLOOR).setDepth(0);
    // Чёткая верхняя граница пола — видимая линия между игроком и панелью
    this.add.rectangle(GAME_W / 2, GROUND_Y, GAME_W, 4, 0x2d4a2d).setDepth(0.5);
    this.matter.add.rectangle(GAME_W / 2, floorCenterY, GAME_W, FLOOR_THICKNESS, {
      isStatic: true,
      friction: 0.8,
      label: 'floor',
    });
    this.matter.add.rectangle(-WALL_THICKNESS / 2, GAME_H / 2, WALL_THICKNESS, GAME_H, { isStatic: true, label: 'wallLeft' });
    this.matter.add.rectangle(GAME_W + WALL_THICKNESS / 2, GAME_H / 2, WALL_THICKNESS, GAME_H, { isStatic: true, label: 'wallRight' });
  }

  private createRagdoll(): void {
    const c = this.config;
    this.ragdoll = new Ragdoll(this, GAME_W / 2, GROUND_Y, COLOR_PLAYER, -1, {
      withPelvis: true,
      frictionAirTorso: c.frictionAirTorso,
      frictionAirLimbs: c.frictionAirLimbs,
      density: c.density,
      densityTorso: c.densityTorso,
      densityLimbs: c.densityLimbs,
      friction: c.friction,
      frictionStatic: c.frictionStatic,
      restitution: c.restitution,
      footRestitution: c.footRestitution,
      angularDamping: c.angularDamping,
      maxVerticalSpeed: c.maxVerticalSpeed,
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
    });
  }

  private setupControls(): void {
    const kb = this.input.keyboard!;
    this.keyLeft = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyUp = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
  }

  private createBackButton(): void {
    const x = GAME_W - 100;
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

  private addControlHints(): void {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '13px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    };
    this.add.text(16, 16, '↑ — прыжок (один раз) | ← → ↑ ↓ — импульс торсу', style).setDepth(20).setAlpha(0.8);
  }

  private applyConfigToWorld(): void {
    const engine = this.matter.world.engine;
    engine.world.gravity.x = this.config.gravityX;
    engine.world.gravity.y = this.config.gravityY;
    engine.positionIterations = this.config.positionIterations;
    engine.velocityIterations = this.config.velocityIterations;
    engine.constraintIterations = this.config.constraintIterations;
  }

  private getStabilizationConfig(): StabilizationConfig {
    const c = this.config;
    return {
      multiplier: c.stabilizationMultiplier,
      torsoKp: c.stabilizationTorsoKp,
      torsoKd: c.stabilizationTorsoKd,
      headKp: c.stabilizationHeadKp,
      headKd: c.stabilizationHeadKd,
      legKp: c.stabilizationLegKp,
      legKd: c.stabilizationLegKd,
      armKp: c.stabilizationArmKp,
      armKd: c.stabilizationArmKd,
      enforceStrength: c.enforceStructureStrength,
    };
  }

  private applyConfigToRagdoll(): void {
    const c = this.config;
    this.ragdoll.applyConfig({
      frictionAirTorso: c.frictionAirTorso,
      frictionAirLimbs: c.frictionAirLimbs,
      density: c.density,
      densityTorso: c.densityTorso,
      densityLimbs: c.densityLimbs,
      friction: c.friction,
      frictionStatic: c.frictionStatic,
      restitution: c.restitution,
      footRestitution: c.footRestitution,
      angularDamping: c.angularDamping,
      maxVerticalSpeed: c.maxVerticalSpeed,
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
    });
  }

  private handleInput(): void {
    const c = this.config;
    const strength = c.impulseStrength;
    const hScale = c.horizontalImpulseScale;
    const vScale = c.verticalImpulseScale;

    if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
      this.ragdoll.applyJump(c.jumpVelocity, c.armLiftOnJump, c.jumpCooldownMs);
    }
    if (this.keyLeft.isDown) this.ragdoll.applyTorsoImpulse({ x: -strength * hScale, y: 0 });
    if (this.keyRight.isDown) this.ragdoll.applyTorsoImpulse({ x: strength * hScale, y: 0 });
    if (this.keyUp.isDown) this.ragdoll.applyTorsoImpulse({ x: 0, y: -strength * vScale });
    if (this.keyDown.isDown) this.ragdoll.applyTorsoImpulse({ x: 0, y: strength * vScale });
  }

  update(): void {
    this.applyConfigToWorld();
    this.applyConfigToRagdoll();
    this.handleInput();
    this.ragdoll.update(this.getStabilizationConfig());
  }

  private lerpColor(a: number, b: number, t: number): number {
    const r = Math.round(((a >> 16) & 0xff) + (((b >> 16) & 0xff) - ((a >> 16) & 0xff)) * t);
    const g = Math.round(((a >> 8) & 0xff) + (((b >> 8) & 0xff) - ((a >> 8) & 0xff)) * t);
    const bl = Math.round((a & 0xff) + ((b & 0xff) - (a & 0xff)) * t);
    return (r << 16) | (g << 8) | bl;
  }

  // ─── Панель ползунков и пресеты ─────────────────────────────────────

  private buildControlPanel(): void {
    const panel = document.getElementById('controls-panel');
    if (!panel) return;
    panel.innerHTML = '';

    const addSlider = (
      parent: HTMLElement,
      label: string,
      key: keyof SandboxConfig,
      min: number,
      max: number,
      step: number,
      description: string,
      format?: (v: number) => string,
    ) => {
      const group = document.createElement('div');
      group.className = 'control-group';
      group.title = description;
      const val = Number(this.config[key]) as number;
      const valueSpan = document.createElement('span');
      valueSpan.textContent = format ? format(val) : val.toFixed(2);
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(val);
      input.title = description;
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        this.config[key] = v;
        valueSpan.textContent = format ? format(v) : v.toFixed(2);
      });
      const row = document.createElement('div');
      row.className = 'control-row';
      row.appendChild(input);
      row.appendChild(valueSpan);
      const lbl = document.createElement('label');
      lbl.textContent = label;
      lbl.title = description;
      group.appendChild(lbl);
      group.appendChild(row);
      const desc = document.createElement('span');
      desc.className = 'control-desc';
      desc.textContent = description;
      group.appendChild(desc);
      parent.appendChild(group);
    };

    addSlider(panel, 'Гравитация X', 'gravityX', -4, 4, 0.05,
      'Горизонтальная составляющая гравитации. Отрицательные значения тянут влево, положительные — вправо.');
    addSlider(panel, 'Гравитация Y', 'gravityY', -4, 4, 0.05,
      'Вертикальная гравитация. Чем больше — сильнее притяжение вниз; меньше — слабее или «луна».');
    addSlider(panel, 'Импульс стрелок', 'impulseStrength', 0.05, 6, 0.05,
      'Сила импульса к торсу при удержании стрелок. Влияет на разгон и «дотягивание» в воздухе.');
    addSlider(panel, 'Скорость прыжка', 'jumpVelocity', 5, 25, 0.5,
      'Начальная скорость вверх при нажатии ↑. Отвечает за высоту прыжка.');
    addSlider(panel, 'Подъём рук при прыжке', 'armLiftOnJump', 0, 2, 0.05,
      'Множитель подъёма рук при прыжке. 0 — руки не поднимать, 1 — примерно как торс.');
    addSlider(panel, 'Кулдаун прыжка (мс)', 'jumpCooldownMs', 100, 800, 50,
      'Минимальная пауза между прыжками в миллисекундах. Защита от спама.',
      (v) => String(Math.round(v)));
    addSlider(panel, 'Масштаб импульса ↔', 'horizontalImpulseScale', 0, 3, 0.05,
      'Множитель горизонтального импульса от стрелок влево/вправо. 1 — как сейчас.');
    addSlider(panel, 'Масштаб импульса ↕', 'verticalImpulseScale', 0, 3, 0.05,
      'Множитель вертикального импульса при удержании ↑/↓. Влияет на «дотягивание» в прыжке.');
    addSlider(panel, 'Торс (вода) frictionAir', 'frictionAirTorso', 0, 1.2, 0.01,
      'Сопротивление воздуха для торса и таза («под водой»). Выше — торс быстрее гасит скорость.');
    addSlider(panel, 'Конечности (воздух) frictionAir', 'frictionAirLimbs', 0, 0.5, 0.005,
      'Сопротивление воздуха для головы и конечностей. Ниже — руки/ноги свободнее движутся.');
    addSlider(panel, 'Плотность (базовая)', 'density', 0.0002, 0.02, 0.0002,
      'Базовая плотность частей тела. Выше — тяжелее, инерционнее.');
    addSlider(panel, 'Плотность торса', 'densityTorso', 0.0005, 0.02, 0.0005,
      'Плотность только торса и таза. Масса корпуса.');
    addSlider(panel, 'Плотность конечностей', 'densityLimbs', 0.0002, 0.015, 0.0002,
      'Плотность головы и конечностей. Можно сделать руки/ноги легче торса.');
    addSlider(panel, 'Макс. верт. скорость', 'maxVerticalSpeed', 0, 30, 0.5,
      'Ограничение вертикальной скорости (0 = без ограничения). Более предсказуемый прыжок.',
      (v) => v === 0 ? 'выкл' : v.toFixed(1));
    addSlider(panel, 'Угловое демпфирование', 'angularDamping', 0, 0.3, 0.01,
      'Демпфирование угловой скорости всех частей. Уменьшает раскачку и «вертлявость».');
    addSlider(panel, 'Упругость стоп', 'footRestitution', 0, 1, 0.05,
      'Упругость только стоп. Отскок от пола при приземлении.');
    addSlider(panel, 'Трение', 'friction', 0, 2, 0.05,
      'Трение при скольжении по поверхностям. Влияет на сцепление с полом.');
    addSlider(panel, 'Трение статич.', 'frictionStatic', 0, 3, 0.05,
      'Трение покоя. Выше — сложнее сдвинуть с места.');
    addSlider(panel, 'Restitution', 'restitution', 0, 1.5, 0.02,
      'Упругость отскока при столкновениях (кроме стоп). Выше — более «резиновый» отскок.');
    addSlider(panel, 'Стабилизация множитель', 'stabilizationMultiplier', 0, 2.5, 0.02,
      'Общая сила PD-стабилизации позы. 0 — отключить, рагдолл «рассыпается».');
    addSlider(panel, 'Стаб. торс Kp', 'stabilizationTorsoKp', 0, 2, 0.02,
      'Жёсткость выравнивания торса по вертикали.');
    addSlider(panel, 'Стаб. торс Kd', 'stabilizationTorsoKd', 0, 1.5, 0.02,
      'Демпфирование вращения торса.');
    addSlider(panel, 'Стаб. голова Kp', 'stabilizationHeadKp', 0, 2, 0.02,
      'Жёсткость выравнивания головы по вертикали.');
    addSlider(panel, 'Стаб. голова Kd', 'stabilizationHeadKd', 0, 1.5, 0.02,
      'Демпфирование вращения головы.');
    addSlider(panel, 'Стаб. ноги Kp', 'stabilizationLegKp', 0, 2, 0.02,
      'Жёсткость выравнивания ног по вертикали.');
    addSlider(panel, 'Стаб. ноги Kd', 'stabilizationLegKd', 0, 1.5, 0.02,
      'Демпфирование вращения ног.');
    addSlider(panel, 'Стаб. руки Kp', 'stabilizationArmKp', 0, 1, 0.02,
      'Жёсткость выравнивания рук по вертикали.');
    addSlider(panel, 'Стаб. руки Kd', 'stabilizationArmKd', 0, 1.5, 0.02,
      'Демпфирование вращения рук.');
    addSlider(panel, 'Enforce strength', 'enforceStructureStrength', 0, 0.1, 0.001,
      'Сила притяжения «скелетных» частей к целевым позициям относительно торса; против схлопывания.');
    addSlider(panel, 'Position iter', 'positionIterations', 1, 40, 1,
      'Число итераций решателя Matter.js (позиция). Больше — точнее, тяжелее по CPU.',
      (v) => String(Math.round(v)));
    addSlider(panel, 'Velocity iter', 'velocityIterations', 1, 40, 1,
      'Число итераций решателя (скорость). Больше — стабильнее.',
      (v) => String(Math.round(v)));
    addSlider(panel, 'Constraint iter', 'constraintIterations', 1, 40, 1,
      'Число итераций решателя (связи). Больше — суставы жёстче.',
      (v) => String(Math.round(v)));

    const presetsGroup = document.createElement('div');
    presetsGroup.className = 'control-group';
    presetsGroup.style.minWidth = '180px';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Сохранить пресет';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Имя пресета';
    nameInput.style.width = '100%';
    nameInput.style.marginTop = '4px';
    nameInput.style.padding = '4px';
    nameInput.style.background = '#3a3a3a';
    nameInput.style.color = '#eee';
    nameInput.style.border = '1px solid #555';
    nameInput.style.borderRadius = '4px';
    const loadSelect = document.createElement('select');
    loadSelect.innerHTML = '<option value="">— Загрузить —</option>';
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Загрузить';

    const refreshPresetList = () => {
      const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
      const list: SavedPreset[] = raw ? JSON.parse(raw) : [];
      loadSelect.innerHTML = '<option value="">— Загрузить —</option>';
      list.forEach((p, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = p.name;
        loadSelect.appendChild(opt);
      });
    };
    refreshPresetList();

    saveBtn.addEventListener('click', () => {
      const name = nameInput.value.trim() || 'Preset ' + Date.now();
      const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
      const list: SavedPreset[] = raw ? JSON.parse(raw) : [];
      list.push({ name, config: { ...this.config } });
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(list));
      refreshPresetList();
      nameInput.value = '';
    });

    loadBtn.addEventListener('click', () => {
      const idx = loadSelect.value;
      if (idx === '') return;
      const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
      const list: SavedPreset[] = raw ? JSON.parse(raw) : [];
      const preset = list[parseInt(idx, 10)];
      if (preset) {
        this.config = { ...DEFAULT_SANDBOX_CONFIG, ...preset.config };
        this.refreshPanelValues(panel);
      }
    });

    presetsGroup.appendChild(document.createElement('label')).textContent = 'Пресеты';
    presetsGroup.appendChild(saveBtn);
    presetsGroup.appendChild(nameInput);
    const loadRow = document.createElement('div');
    loadRow.className = 'control-row';
    loadRow.style.marginTop = '4px';
    loadRow.appendChild(loadSelect);
    loadRow.appendChild(loadBtn);
    presetsGroup.appendChild(loadRow);
    panel.appendChild(presetsGroup);
  }

  /** Обновить значения ползунков по this.config (после загрузки пресета) */
  private refreshPanelValues(panel: HTMLElement): void {
    const inputs = panel.querySelectorAll('input[type="range"]');
    const spans = panel.querySelectorAll('.control-row span');
    const keys: (keyof SandboxConfig)[] = [
      'gravityX', 'gravityY', 'impulseStrength', 'jumpVelocity', 'armLiftOnJump', 'jumpCooldownMs',
      'horizontalImpulseScale', 'verticalImpulseScale', 'frictionAirTorso', 'frictionAirLimbs',
      'density', 'densityTorso', 'densityLimbs', 'maxVerticalSpeed', 'angularDamping', 'footRestitution',
      'friction', 'frictionStatic', 'restitution', 'stabilizationMultiplier',
      'stabilizationTorsoKp', 'stabilizationTorsoKd', 'stabilizationHeadKp', 'stabilizationHeadKd',
      'stabilizationLegKp', 'stabilizationLegKd', 'stabilizationArmKp', 'stabilizationArmKd',
      'enforceStructureStrength', 'positionIterations', 'velocityIterations', 'constraintIterations',
    ];
    keys.forEach((key, i) => {
      const input = inputs[i] as HTMLInputElement | undefined;
      const span = spans[i] as HTMLElement | undefined;
      if (!input || !span) return;
      const v = Number(this.config[key]);
      input.value = String(v);
      if (key === 'jumpCooldownMs') span.textContent = String(Math.round(v));
      else if (key === 'maxVerticalSpeed') span.textContent = v === 0 ? 'выкл' : v.toFixed(1);
      else if (key.includes('Iteration') || key === 'positionIterations' || key === 'velocityIterations' || key === 'constraintIterations') span.textContent = String(Math.round(v));
      else span.textContent = v.toFixed(2);
    });
  }
}
