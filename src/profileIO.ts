import { createDefaultBindings, keyLabel, bindingFromVendorCode, vendorCodeForBinding } from './functions';
import {
  createDefaultDpi,
  createDefaultPerformance,
  createDefaultProfile,
  DPI_STAGE_COUNT,
  MAX_DPI,
  MIN_DPI,
} from './defaults';
import type {
  Binding,
  ButtonId,
  DpiStage,
  Macro,
  MacroAction,
  PollingRate,
  Profile,
} from './types';
import { BUTTON_ORDER } from './functions';
import { clamp, clone, hexToRgb, rgbToHex, uid } from './utils';

export interface BackupFile {
  format: 'hecate-connect-web';
  version: 1;
  exportedAt: string;
  profile: Profile;
}

export interface ImportResult {
  profile: Profile;
  source: 'web' | 'vendor';
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeBinding(value: unknown, fallback: Binding): Binding {
  if (!isRecord(value)) return fallback;
  const kind = value.kind;
  if (kind === 'disabled') return { kind: 'disabled' };
  if (kind === 'macro' && typeof value.macroId === 'string') {
    return { kind: 'macro', macroId: value.macroId };
  }
  if (kind === 'key' && typeof value.code === 'string') {
    return {
      kind: 'key',
      code: value.code,
      label: typeof value.label === 'string' ? value.label : keyLabel(value.code),
    };
  }
  if (
    (kind === 'mouse' || kind === 'media' || kind === 'system' || kind === 'dpi') &&
    typeof value.id === 'string' &&
    typeof value.label === 'string'
  ) {
    return { kind, id: value.id, label: value.label } as Binding;
  }
  return fallback;
}

function normalizeStage(value: unknown, fallback: DpiStage): DpiStage {
  if (!isRecord(value)) return fallback;
  const readDpi = (input: unknown, fallbackValue: number) => {
    const number = Number(input);
    return Number.isFinite(number) ? clamp(Math.round(number / 50) * 50, MIN_DPI, MAX_DPI) : fallbackValue;
  };
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : fallback.enabled,
    dpiX: readDpi(value.dpiX, fallback.dpiX),
    dpiY: readDpi(value.dpiY, fallback.dpiY),
    color: isHexColor(value.color) ? value.color : fallback.color,
  };
}

function normalizeMacroAction(value: unknown): MacroAction | null {
  if (!isRecord(value)) return null;
  const delay = clamp(Number(value.delay) || 0, 0, 60000);
  if (value.type === 'key' && typeof value.code === 'string') {
    return {
      id: typeof value.id === 'string' ? value.id : uid(),
      type: 'key',
      code: value.code,
      label: typeof value.label === 'string' ? value.label : keyLabel(value.code),
      event: value.event === 'up' ? 'up' : 'down',
      delay,
    };
  }
  if (value.type === 'mouse' && typeof value.button === 'string' && BUTTON_ORDER.includes(value.button as ButtonId)) {
    return {
      id: typeof value.id === 'string' ? value.id : uid(),
      type: 'mouse',
      button: value.button as ButtonId,
      event: value.event === 'up' ? 'up' : 'down',
      delay,
    };
  }
  if (value.type === 'delay') {
    return {
      id: typeof value.id === 'string' ? value.id : uid(),
      type: 'delay',
      delay: delay || 50,
    };
  }
  return null;
}

function normalizeMacro(value: unknown): Macro | null {
  if (!isRecord(value)) return null;
  const actions = Array.isArray(value.actions)
    ? value.actions.map(normalizeMacroAction).filter((action): action is MacroAction => action !== null)
    : [];
  return {
    id: typeof value.id === 'string' ? value.id : uid(),
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : '未命名宏',
    actions,
    repeat: clamp(Number(value.repeat) || 1, 1, 99),
    stopMode: value.stopMode === 'release' ? 'release' : 'once',
  };
}

export function normalizeProfile(input: unknown, fallbackName = '配置文件'): Profile | null {
  if (!isRecord(input)) return null;
  const base = createDefaultProfile(fallbackName);
  const rawBindings = isRecord(input.bindings) ? input.bindings : {};
  const fallbackBindings = createDefaultBindings();
  const bindings = Object.fromEntries(
    BUTTON_ORDER.map((button) => [
      button,
      normalizeBinding(rawBindings[button], fallbackBindings[button]),
    ]),
  ) as Record<ButtonId, Binding>;

  const rawDpi = isRecord(input.dpi) ? input.dpi : {};
  const defaultDpi = createDefaultDpi();
  const rawStages = Array.isArray(rawDpi.stages) ? rawDpi.stages : [];
  const stages = Array.from({ length: DPI_STAGE_COUNT }, (_, index) =>
    normalizeStage(rawStages[index], defaultDpi.stages[index]),
  );
  if (!stages.some((stage) => stage.enabled)) stages[0].enabled = true;

  const rawIndicator = isRecord(rawDpi.indicator) ? rawDpi.indicator : {};
  const dpi = {
    stages,
    activeStage: clamp(Number(rawDpi.activeStage) || defaultDpi.activeStage, 0, DPI_STAGE_COUNT - 1),
    xYLinked: typeof rawDpi.xYLinked === 'boolean' ? rawDpi.xYLinked : defaultDpi.xYLinked,
    indicator: {
      enabled: typeof rawIndicator.enabled === 'boolean' ? rawIndicator.enabled : defaultDpi.indicator.enabled,
      brightness: clamp(Number(rawIndicator.brightness) || defaultDpi.indicator.brightness, 0, 100),
      effect: rawIndicator.effect === 'breath' ? ('breath' as const) : ('solid' as const),
    },
  };

  const rawPerf = isRecord(input.performance) ? input.performance : {};
  const defaultPerf = createDefaultPerformance();
  const polling = [125, 250, 500, 1000].includes(Number(rawPerf.pollingRate))
    ? (Number(rawPerf.pollingRate) as PollingRate)
    : defaultPerf.pollingRate;
  const performance = {
    pollingRate: polling,
    lineCorrection:
      typeof rawPerf.lineCorrection === 'boolean' ? rawPerf.lineCorrection : defaultPerf.lineCorrection,
    rippleCorrection:
      typeof rawPerf.rippleCorrection === 'boolean'
        ? rawPerf.rippleCorrection
        : defaultPerf.rippleCorrection,
    sensorHeight: [1, 2, 3].includes(Number(rawPerf.sensorHeight))
      ? (Number(rawPerf.sensorHeight) as 1 | 2 | 3)
      : defaultPerf.sensorHeight,
    buttonDelay: [4, 6, 8, 10, 12].includes(Number(rawPerf.buttonDelay))
      ? Number(rawPerf.buttonDelay)
      : defaultPerf.buttonDelay,
    pointerSpeed: clamp(Number(rawPerf.pointerSpeed) || defaultPerf.pointerSpeed, 1, 11),
    enhancePrecision:
      typeof rawPerf.enhancePrecision === 'boolean'
        ? rawPerf.enhancePrecision
        : defaultPerf.enhancePrecision,
    scrollSpeed: clamp(Number(rawPerf.scrollSpeed) || defaultPerf.scrollSpeed, 1, 3),
    scrollFullPage:
      typeof rawPerf.scrollFullPage === 'boolean' ? rawPerf.scrollFullPage : defaultPerf.scrollFullPage,
    doubleClickSpeed: clamp(Number(rawPerf.doubleClickSpeed) || defaultPerf.doubleClickSpeed, 1, 11),
  };

  const macros = Array.isArray(input.macros)
    ? input.macros.map(normalizeMacro).filter((macro): macro is Macro => macro !== null)
    : [];

  const now = new Date().toISOString();
  return {
    id: typeof input.id === 'string' && input.id ? input.id : uid(),
    name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : fallbackName,
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : now,
    bindings,
    dpi,
    performance,
    macros,
  };
}

export function createBackup(profile: Profile): BackupFile {
  return {
    format: 'hecate-connect-web',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: clone(profile),
  };
}

function rateToVendorIndex(rate: PollingRate): number {
  return { 125: 0, 250: 1, 500: 2, 1000: 3 }[rate];
}

function stageToVendor(stage: DpiStage) {
  const { r, g, b } = hexToRgb(stage.color);
  return {
    StageActive: stage.enabled ? 1 : 0,
    StageColorB: b,
    StageColorG: g,
    StageColorR: r,
    StageDPIX: stage.dpiX,
    StageDPIY: stage.dpiY,
    StageIndex: 2,
    StageXY: 0,
  };
}

export function createVendorConfig(profile: Profile) {
  const activeColor = hexToRgb(profile.dpi.stages[profile.dpi.activeStage]?.color ?? '#2ee6c5');
  const keyList = BUTTON_ORDER.map((button) => {
      const assignment = vendorCodeForBinding(profile.bindings[button]) ?? 0xa00000;
    return { Assignment: assignment, DefaultAssignment: assignment };
  });
  while (keyList.length < 59) {
    keyList.push({ Assignment: 10485760, DefaultAssignment: 10485760 });
  }

  return {
    AppLink: false,
    AppName: '',
    AppPath: '',
    Device: [
      null,
      {
        AudioLightInfo: {
          '7ColorFlags': 1,
          AudioMode: 0,
          BkColorB: 0,
          BkColorG: 0,
          BkColorR: 0,
          ColorTypeFlags: 1,
          FgColorB: 0,
          FgColorG: 0,
          FgColorR: 0,
        },
        CorrectInfo: null,
        DPIStages: {
          StageActive: 1,
          StageCount: 0,
          StageDPIs: profile.dpi.stages.map(stageToVendor),
        },
        DeviceBasicInfo: {
          DevciesChipmodel: 'VS11M17A',
          DeviceNUMInfo: 'hecate_g3m_pro_web',
          DeviceName: 'mouse',
          DeviceType: 'mouse',
          PID: 4103,
          SensorModel: 0,
          VID: 3141,
        },
        KeyList: keyList,
        LightInfo: {
          Blue: activeColor.b,
          CustomGroup: 0,
          Fx: profile.dpi.indicator.effect === 'breath' ? 1 : 0,
          Green: activeColor.g,
          Light: profile.dpi.indicator.enabled ? 4 : 0,
          MultiColor: true,
          OldLedmode: 0,
          Red: activeColor.r,
          SelectItem: profile.dpi.activeStage,
          Speed: 2,
          ZZCCLedMode: 0,
        },
        LightList: null,
        MacroInfo: null,
        ProfessionalInfo: {
          angle_set: 0,
          delay_time: profile.performance.buttonDelay,
          line_correct: profile.performance.lineCorrection ? 1 : 0,
          sensor_height: profile.performance.sensorHeight - 1,
          wave_correct: profile.performance.rippleCorrection ? 1 : 0,
        },
        ReportStages: {
          StageActive: rateToVendorIndex(profile.performance.pollingRate),
        },
        SystemStages: {
          DoubleClickTime: profile.performance.doubleClickSpeed,
          MouseSpeed: profile.performance.pointerSpeed,
          PointerPrecision: profile.performance.enhancePrecision ? 1 : 0,
          ScorllPage: profile.performance.scrollFullPage ? 1 : 0,
          WheelScorlllinse: profile.performance.scrollSpeed,
        },
      },
    ],
    GameImagePath: '',
    SynchroLight: {
      LightInfo: {
        Blue: 0,
        Green: 0,
        Light: 3,
        MultiColor: false,
        Red: 255,
        SelectItem: 0,
        Speed: 2,
      },
      deviceinfo: Array.from({ length: 6 }, () => ({ SynchroFlags: false })),
    },
    WebConfig: {
      format: 'hecate-connect-web',
      version: 1,
      profile,
    },
    game_mode: '',
    game_uuid: '',
    profileUUID: profile.id,
    profilename: profile.name,
  };
}

function colorFromVendor(red: unknown, green: unknown, blue: unknown, fallback: string): string {
  const r = clamp(Number(red) || 0, 0, 255);
  const g = clamp(Number(green) || 0, 0, 255);
  const b = clamp(Number(blue) || 0, 0, 255);
  if (r + g + b === 0) return fallback;
  return rgbToHex(r, g, b);
}

function profileFromVendor(data: Record<string, unknown>): ImportResult {
  const warnings: string[] = [];
  const deviceList = Array.isArray(data.Device) ? data.Device : [];
  const device = deviceList.find(isRecord);
  if (!device) {
    throw new Error('这不是有效的 HECATE 配置文件：未找到设备数据');
  }
  const profile = createDefaultProfile(
    typeof data.profilename === 'string' && data.profilename.trim()
      ? data.profilename.trim()
      : '导入的 HECATE 配置',
  );
  profile.id = uid();
  profile.createdAt = new Date().toISOString();
  profile.updatedAt = profile.createdAt;

  const dpiData = isRecord(device.DPIStages) ? device.DPIStages : {};
  const vendorStages = Array.isArray(dpiData.StageDPIs) ? dpiData.StageDPIs : [];
  if (vendorStages.length) {
    for (let index = 0; index < DPI_STAGE_COUNT; index += 1) {
      const raw = vendorStages[index];
      if (!isRecord(raw)) continue;
      const fallback = profile.dpi.stages[index];
      const dpi = Number(raw.StageDPIY);
      profile.dpi.stages[index] = {
        enabled: raw.StageActive === undefined ? true : Number(raw.StageActive) === 1,
        dpiX: Number.isFinite(dpi) ? clamp(Math.round(dpi / 50) * 50, MIN_DPI, MAX_DPI) : fallback.dpiX,
        dpiY: Number.isFinite(dpi) ? clamp(Math.round(dpi / 50) * 50, MIN_DPI, MAX_DPI) : fallback.dpiY,
        color: colorFromVendor(raw.StageColorR, raw.StageColorG, raw.StageColorB, fallback.color),
      };
    }
    if (!profile.dpi.stages.some((stage) => stage.enabled)) profile.dpi.stages[0].enabled = true;
  } else {
    warnings.push('未找到 DPI 档位，已使用默认值。');
  }

  const report = isRecord(device.ReportStages) ? device.ReportStages : {};
  const rateIndex = clamp(Number(report.StageActive) || 3, 0, 3);
  profile.performance.pollingRate = ([125, 250, 500, 1000] as PollingRate[])[rateIndex];

  const professional = isRecord(device.ProfessionalInfo) ? device.ProfessionalInfo : {};
  profile.performance.lineCorrection = Number(professional.line_correct) === 1;
  profile.performance.rippleCorrection = Number(professional.wave_correct) === 1;
  const sensorHeight = clamp(Number(professional.sensor_height) || 0, 0, 2);
  profile.performance.sensorHeight = (sensorHeight + 1) as 1 | 2 | 3;
  const delay = Number(professional.delay_time);
  if ([4, 6, 8, 10, 12].includes(delay)) profile.performance.buttonDelay = delay;

  const system = isRecord(device.SystemStages) ? device.SystemStages : {};
  profile.performance.pointerSpeed = clamp(Number(system.MouseSpeed) || 6, 1, 11);
  profile.performance.scrollSpeed = clamp(Number(system.WheelScorlllinse) || 3, 1, 3);
  profile.performance.scrollFullPage = Number(system.ScorllPage) === 1;
  profile.performance.doubleClickSpeed = clamp(Number(system.DoubleClickTime) || 6, 1, 11);

  const keyList = Array.isArray(device.KeyList) ? device.KeyList : [];
  let unknownKeys = 0;
  BUTTON_ORDER.forEach((button, index) => {
    const raw = keyList[index];
    const code = isRecord(raw) ? Number(raw.Assignment) : NaN;
    if (!Number.isFinite(code)) return;
    const binding = bindingFromVendorCode(code);
    if (binding) {
      profile.bindings[button] = binding;
    } else if (code !== 10485760) {
      unknownKeys += 1;
    }
  });
  if (unknownKeys) {
    warnings.push(`${unknownKeys} 个自定义按键功能无法识别，已保留网页版默认值。`);
  }

  if (device.MacroInfo) {
    warnings.push('原驱动宏数据未导入，请重新录制。');
  }
  warnings.push('原驱动中的 DPI 编码已转换为标准 DPI 数值，建议核对各档位。');

  return { profile, source: 'vendor', warnings };
}

export function parseImport(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('文件不是有效的 JSON');
  }
  if (!isRecord(data)) throw new Error('配置文件内容无法识别');

  if (isRecord(data.WebConfig) && isRecord(data.WebConfig.profile)) {
    const profile = normalizeProfile(data.WebConfig.profile, '导入的配置');
    if (profile) return { profile, source: 'web', warnings: [] };
  }
  if (isRecord(data.profile)) {
    const profile = normalizeProfile(data.profile, '导入的配置');
    if (profile) return { profile, source: 'web', warnings: [] };
  }
  if (Array.isArray(data.Device)) {
    return profileFromVendor(data);
  }
  const direct = normalizeProfile(data, '导入的配置');
  if (direct && isRecord(data.bindings)) {
    return { profile: direct, source: 'web', warnings: [] };
  }
  throw new Error('无法识别的配置文件格式');
}
