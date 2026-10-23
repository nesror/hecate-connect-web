import { keyboardHardwareUsage } from '../functions';
import type { Binding, ButtonId, DpiSettings, PerformanceSettings, Profile } from '../types';
import { clamp } from '../utils';

export const RAPOO_VENDOR_ID = 0x24ae;
export const RAPOO_PRODUCT_ID = 0x185a;
export const RAPOO_WIRED_PRODUCT_ID = 0x418a;
export const RAPOO_USAGE_PAGE = 0xff00;
export const RAPOO_USAGE = 0x0e;
export const RAPOO_REPORT_ID = 0xba;
export const RAPOO_REPORT_DATA_LENGTH = 31;
export const RAPOO_MAX_DPI_STAGES = 7;

const FRAME_HEADER = 7;
const UNLOCK_FRAME = [0xa5, 0xa3, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];

export const RAPOO_BANKS = {
  communication: 0x00,
  button: 0x06,
  system: 0x08,
} as const;

export const RAPOO_ADDR = {
  pollingRate: 0x80,
  lodHeight: 0x84,
  motionSync: 0x85,
  dpiTableX: 0x88,
  slotCount: 0x96,
  currentDpiIndex: 0x98,
  debounce: 0xc0,
  sleepTime: 0xc2,
  corrections: 0xc3,
  sensorAngle: 0xc4,
  glassMode: 0xc5,
  dpiTableY: 0xc8,
  ledLowBattery: 0xd8,
  wirelessStrategy: 0xd8,
} as const;

export const RAPOO_BUTTON_SLOTS: ReadonlyArray<{ button: ButtonId; addr: number }> = [
  { button: 'left', addr: 0x00 },
  { button: 'right', addr: 0x08 },
  { button: 'wheel', addr: 0x04 },
  { button: 'forward', addr: 0x14 },
  { button: 'back', addr: 0x18 },
  { button: 'dpi', addr: 0x34 },
];

const POLLING_CODE: Record<number, number> = {
  125: 0x08,
  250: 0x04,
  500: 0x02,
  1000: 0x01,
};

const MOUSE_FUNCTION_CODE = {
  left: 0x01,
  right: 0x02,
  middle: 0x04,
  back: 0x08,
  forward: 0x10,
} as const;

const DISABLED_FUNCTION_CODE = 0x07;

const MEDIA_CONSUMER_USAGE = {
  'media-select': 0x0183,
  'play-pause': 0x00cd,
  stop: 0x00b7,
  previous: 0x00b6,
  next: 0x00b5,
  'volume-down': 0x00ea,
  'volume-up': 0x00e9,
  mute: 0x00e2,
  'browser-home': 0x0223,
  'browser-refresh': 0x0227,
  'browser-stop': 0x0226,
  'browser-back': 0x0224,
  'browser-forward': 0x0225,
  favorites: 0x02fa,
  search: 0x0221,
  'my-computer': 0x0194,
  calculator: 0x0192,
  mail: 0x018a,
} as const;

export interface RapooCommand {
  label: string;
  bank: number;
  addr: number;
  data: number[];
}

export interface RapooDpiWrite {
  count: number;
  activeIndex: number;
  valuesX: number[];
  valuesY: number[];
}

export interface RapooPerformanceWrite {
  pollingRate: number;
  sensorHeight: number;
  buttonDelay: number;
  lineCorrection: boolean;
  rippleCorrection: boolean;
}

export interface RapooButtonWrite {
  button: ButtonId;
  label: string;
  written: boolean;
  reason?: string;
}

export interface RapooPlan {
  commands: RapooCommand[];
  dpi: RapooDpiWrite | null;
  performance: RapooPerformanceWrite | null;
  buttons: RapooButtonWrite[];
}

export interface RapooWriteSections {
  bindings: boolean;
  dpi: boolean;
  performance: boolean;
}

export function padFrame(bytes: readonly number[]): Uint8Array {
  if (bytes.length > RAPOO_REPORT_DATA_LENGTH) {
    throw new Error(`Rapoo 单帧不能超过 ${RAPOO_REPORT_DATA_LENGTH} 字节`);
  }
  const frame = new Uint8Array(RAPOO_REPORT_DATA_LENGTH);
  frame.set(bytes);
  return frame;
}

export function probeFrame(): Uint8Array {
  return padFrame([0xb0]);
}

export function unlockFrame(): Uint8Array {
  return padFrame(UNLOCK_FRAME);
}

export function writeFrame(bank: number, addr: number, data: readonly number[]): Uint8Array {
  const length = data.length;
  if (length > RAPOO_REPORT_DATA_LENGTH - FRAME_HEADER) {
    throw new Error(`Rapoo 写入数据不能超过 ${RAPOO_REPORT_DATA_LENGTH - FRAME_HEADER} 字节`);
  }
  return padFrame([
    0xa5,
    0xa5,
    length,
    addr & 0xff,
    bank & 0xff,
    0x00,
    0x00,
    ...data.map((byte) => byte & 0xff),
  ]);
}

export function readFrame(bank: number, addr: number, length = 1): Uint8Array {
  return padFrame([0xa5, 0xa4, length & 0xff, addr & 0xff, bank & 0xff, 0x00, 0x00, 0x00]);
}

function pollingCode(rate: number): number {
  return POLLING_CODE[rate] ?? POLLING_CODE[1000];
}

function lodCode(height: number): number {
  if (height === 1) return 0x01;
  if (height === 2) return 0x03;
  return 0x04;
}

function correctionByte(performance: PerformanceSettings): number {
  const linear = performance.lineCorrection ? 0 : 1;
  const ripple = performance.rippleCorrection ? 0 : 1;
  return linear | (ripple << 1);
}

function u16le(value: number): number[] {
  const clamped = clamp(Math.round(value), 50, 26000);
  return [clamped & 0xff, (clamped >>> 8) & 0xff];
}

export function buildDpiPlan(dpi: DpiSettings): RapooDpiWrite {
  const stages = dpi.stages.slice(0, RAPOO_MAX_DPI_STAGES);
  const enabled: Array<{ stage: DpiSettings['stages'][number]; index: number }> = [];
  stages.forEach((stage, index) => {
    if (stage.enabled) enabled.push({ stage, index });
  });
  const used = enabled.length > 0 ? enabled : [{ stage: stages[0], index: 0 }];
  const active = used.find((item) => item.index === dpi.activeStage) ?? used[0];
  const valuesX = used.map((item) => clamp(Math.round(item.stage.dpiX), 50, 26000));
  const valuesY = dpi.xYLinked
    ? valuesX.slice()
    : used.map((item) => clamp(Math.round(item.stage.dpiY), 50, 26000));

  return {
    count: used.length,
    activeIndex: used.indexOf(active),
    valuesX,
    valuesY,
  };
}

export function rapooBindingBytes(binding: Binding): number[] | null {
  switch (binding.kind) {
    case 'disabled':
      return [0x03, 0x00, DISABLED_FUNCTION_CODE, 0x00];
    case 'mouse':
      return [0x03, 0x00, MOUSE_FUNCTION_CODE[binding.id], 0x00];
    case 'dpi':
      return binding.id === 'cycle' ? [0x08, 0x00, 0x03, 0x00] : null;
    case 'key': {
      const hardware = keyboardHardwareUsage(binding.code);
      if (!hardware) return null;
      if (hardware.modifier !== undefined) {
        return [0x02, (hardware.modifier >>> 8) & 0xff, 0x00, 0x00];
      }
      if (hardware.usage !== undefined && hardware.usage <= 0xff) {
        return [0x00, 0x00, hardware.usage, 0x00];
      }
      return null;
    }
    case 'media': {
      const usage = MEDIA_CONSUMER_USAGE[binding.id];
      if (usage === undefined) return null;
      return [0x04, 0x00, (usage >>> 8) & 0xff, usage & 0xff];
    }
    default:
      return null;
  }
}

function skipReason(binding: Binding): string {
  if (binding.kind === 'macro') return '宏未写入固件，保留设备原值';
  if (binding.kind === 'system') return 'Rapoo 的电源/睡眠动作代码尚未确认';
  if (binding.kind === 'dpi') return 'Rapoo 的 DPI +/− 动作代码尚未确认';
  return '该功能没有确认的 Rapoo 动作代码';
}

export function buildRapooPlan(
  profile: Profile,
  sections: RapooWriteSections,
  buttonMeta: Record<ButtonId, { label: string }>,
): RapooPlan {
  const commands: RapooCommand[] = [];
  let dpi: RapooDpiWrite | null = null;
  let performance: RapooPerformanceWrite | null = null;
  const buttons: RapooButtonWrite[] = [];

  if (sections.dpi) {
    dpi = buildDpiPlan(profile.dpi);
    commands.push(
      {
        label: 'DPI X 表',
        bank: RAPOO_BANKS.system,
        addr: RAPOO_ADDR.dpiTableX,
        data: dpi.valuesX.flatMap(u16le),
      },
      {
        label: 'DPI Y 表',
        bank: RAPOO_BANKS.system,
        addr: RAPOO_ADDR.dpiTableY,
        data: dpi.valuesY.flatMap(u16le),
      },
      {
        label: 'DPI 档位数量',
        bank: RAPOO_BANKS.system,
        addr: RAPOO_ADDR.slotCount,
        data: [dpi.count - 1],
      },
      {
        label: '当前 DPI 档位',
        bank: RAPOO_BANKS.system,
        addr: RAPOO_ADDR.currentDpiIndex,
        data: [dpi.activeIndex],
      },
    );
  }

  if (sections.performance) {
    const { sensorHeight, buttonDelay, pollingRate, lineCorrection, rippleCorrection } =
      profile.performance;
    performance = {
      pollingRate,
      sensorHeight,
      buttonDelay,
      lineCorrection,
      rippleCorrection,
    };
    commands.push(
      {
        label: '回报率',
        bank: RAPOO_BANKS.system,
        addr: RAPOO_ADDR.pollingRate,
        data: [pollingCode(pollingRate)],
      },
      {
        label: '静默高度',
        bank: RAPOO_BANKS.system,
        addr: RAPOO_ADDR.lodHeight,
        data: [lodCode(sensorHeight)],
      },
      {
        label: '去抖延时',
        bank: RAPOO_BANKS.system,
        addr: RAPOO_ADDR.debounce,
        data: [clamp(Math.round(buttonDelay), 0, 255)],
      },
      {
        label: '传感器修正',
        bank: RAPOO_BANKS.system,
        addr: RAPOO_ADDR.corrections,
        data: [correctionByte(profile.performance)],
      },
    );
  }

  if (sections.bindings) {
    for (const { button, addr } of RAPOO_BUTTON_SLOTS) {
      const binding = profile.bindings[button];
      const data = rapooBindingBytes(binding);
      buttons.push({
        button,
        label: buttonMeta[button].label,
        written: data !== null,
        reason: data === null ? skipReason(binding) : undefined,
      });
      if (data) {
        commands.push({
          label: `按键 ${buttonMeta[button].label}`,
          bank: RAPOO_BANKS.button,
          addr,
          data,
        });
      }
    }
  }

  return { commands, dpi, performance, buttons };
}
