import { DPI_COLORS, DPI_STAGE_COUNT, MAX_DPI, MIN_DPI } from '../defaults';
import type { DpiSettings, PerformanceSettings, PollingRate } from '../types';
import { clamp, hexToRgb, rgbToHex } from '../utils';
import type { DeviceHeader } from './protocol';

const STAGE_TABLE_OFFSET = 14;
const STAGE_LENGTH = 9;
const OFFSET_POLLING = 11;
const OFFSET_ACTIVE_STAGE = 12;
const OFFSET_RESERVED = 77;
const OFFSET_LINE_CORRECTION = 78;
const OFFSET_BUTTON_DELAY = 79;
const OFFSET_SENSOR_HEIGHT = 80;
const OFFSET_ANGLE_SNAP = 81;
const OFFSET_RIPPLE_CORRECTION = 82;

const POLLING_RATES: PollingRate[] = [125, 250, 500, 1000];

export interface DeviceSettings {
  dpi: Omit<DpiSettings, 'indicator'>;
  pollingRate: PollingRate;
  lineCorrection: boolean;
  rippleCorrection: boolean;
  sensorHeight: 1 | 2 | 3;
  buttonDelay: number;
}

export function pollingIndex(rate: PollingRate): number {
  return POLLING_RATES.indexOf(rate);
}

function stageOffset(index: number): number {
  return STAGE_TABLE_OFFSET + index * STAGE_LENGTH;
}

export function decodeProfileBlock(raw: Uint8Array, header: DeviceHeader): DeviceSettings {
  const stages = Array.from({ length: DPI_STAGE_COUNT }, (_, index) => {
    const offset = stageOffset(index);
    const enabled = (raw[offset] ?? 1) === 1;
    const separateAxis = (raw[offset + 1] ?? 0) === 1;
    const xIndex = clamp((raw[offset + 2] ?? 0) | ((raw[offset + 3] ?? 0) << 8), 0, header.dpiMaxIndex);
    const yValue = (raw[offset + 4] ?? 0) | ((raw[offset + 5] ?? 0) << 8);
    const dpiX = clamp(header.dpiBase + xIndex * header.dpiStep, MIN_DPI, MAX_DPI);
    const dpiY = separateAxis ? clamp(yValue, MIN_DPI, MAX_DPI) : dpiX;
    const color = rgbToHex(raw[offset + 6] ?? 0, raw[offset + 7] ?? 0, raw[offset + 8] ?? 0);
    return {
      enabled,
      dpiX,
      dpiY,
      color: color === '#000000' ? DPI_COLORS[index] : color,
    };
  });

  const polling = POLLING_RATES[clamp(raw[OFFSET_POLLING] ?? 3, 0, 3)] ?? 1000;

  return {
    dpi: {
      stages,
      activeStage: clamp(raw[OFFSET_ACTIVE_STAGE] ?? 0, 0, DPI_STAGE_COUNT - 1),
      xYLinked: (raw[stageOffset(0) + 1] ?? 0) !== 1,
    },
    pollingRate: polling,
    lineCorrection: (raw[OFFSET_LINE_CORRECTION] ?? 0) === 1,
    rippleCorrection: (raw[OFFSET_RIPPLE_CORRECTION] ?? 0) === 1,
    sensorHeight: (clamp(raw[OFFSET_SENSOR_HEIGHT] ?? 0, 0, 2) + 1) as 1 | 2 | 3,
    buttonDelay: Math.round((raw[OFFSET_BUTTON_DELAY] ?? 0) / 10),
  };
}

export function applyDpiToBlock(block: Uint8Array, dpi: DpiSettings, header: DeviceHeader): void {
  block[OFFSET_ACTIVE_STAGE] = clamp(dpi.activeStage, 0, DPI_STAGE_COUNT - 1);

  dpi.stages.slice(0, DPI_STAGE_COUNT).forEach((stage, index) => {
    const offset = stageOffset(index);
    const xIndex = clamp(
      Math.round((stage.dpiX - header.dpiBase) / header.dpiStep),
      0,
      header.dpiMaxIndex,
    );
    const actualX = header.dpiBase + xIndex * header.dpiStep;
    const dpiY = dpi.xYLinked ? actualX : clamp(Math.round(stage.dpiY), MIN_DPI, MAX_DPI);
    const { r, g, b } = hexToRgb(stage.color);

    block[offset] = stage.enabled ? 1 : 0;
    block[offset + 1] = dpi.xYLinked ? 0 : 1;
    block[offset + 2] = xIndex & 0xff;
    block[offset + 3] = (xIndex >>> 8) & 0xff;
    block[offset + 4] = dpiY & 0xff;
    block[offset + 5] = (dpiY >>> 8) & 0xff;
    block[offset + 6] = r;
    block[offset + 7] = g;
    block[offset + 8] = b;
  });
}

export function applyPerformanceToBlock(block: Uint8Array, performance: PerformanceSettings): void {
  block[OFFSET_POLLING] = pollingIndex(performance.pollingRate);
  block[OFFSET_LINE_CORRECTION] = performance.lineCorrection ? 1 : 0;
  block[OFFSET_BUTTON_DELAY] = clamp(Math.round(performance.buttonDelay * 10), 0, 255);
  block[OFFSET_SENSOR_HEIGHT] = clamp(performance.sensorHeight - 1, 0, 2);
  block[OFFSET_RESERVED] = 0;
  block[OFFSET_ANGLE_SNAP] = 0;
  block[OFFSET_RIPPLE_CORRECTION] = performance.rippleCorrection ? 1 : 0;
}

export function changedOffsets(before: Uint8Array, after: Uint8Array): number[] {
  const offsets: number[] = [];
  const length = Math.min(before.length, after.length);
  for (let index = 0; index < length; index += 1) {
    if (before[index] !== after[index]) offsets.push(index);
  }
  return offsets;
}
