import { createDefaultBindings } from './functions';
import type { DpiSettings, PerformanceSettings, Profile } from './types';
import { uid } from './utils';

export const MIN_DPI = 50;
export const MAX_DPI = 26000;
export const DPI_STEP = 50;
export const DPI_STAGE_COUNT = 7;

export const DPI_COLORS = [
  '#ff4d5e',
  '#4d8dff',
  '#3ddc97',
  '#2ee6c5',
  '#ffd166',
  '#c77dff',
  '#f1f5f9',
];

export const DEFAULT_DPI_VALUES = [400, 800, 1600, 3200, 6400, 12800, 26000];

export const MODEL_INFO = {
  name: 'HECATE G3M PRO',
  shortName: 'G3M PRO',
  sensor: 'PAW3395',
  type: '三模无线游戏鼠标',
  maxDpi: '26,000 DPI',
  polling: '1,000 Hz',
  buttons: '5 个可编程按键',
  weight: '63 g',
};

export function createDefaultDpi(): DpiSettings {
  return {
    stages: DEFAULT_DPI_VALUES.map((dpi, index) => ({
      enabled: true,
      dpiX: dpi,
      dpiY: dpi,
      color: DPI_COLORS[index],
    })),
    activeStage: 2,
    xYLinked: true,
    indicator: {
      enabled: true,
      brightness: 70,
      effect: 'solid',
    },
  };
}

export function createDefaultPerformance(): PerformanceSettings {
  return {
    pollingRate: 1000,
    lineCorrection: false,
    rippleCorrection: false,
    angleSnap: false,
    sensorHeight: 1,
    buttonDelay: 4,
    pointerSpeed: 6,
    enhancePrecision: false,
    scrollSpeed: 3,
    scrollFullPage: false,
    doubleClickSpeed: 6,
  };
}

export function createDefaultProfile(name = '配置文件 1'): Profile {
  const now = new Date().toISOString();
  return {
    id: uid(),
    name,
    createdAt: now,
    updatedAt: now,
    bindings: createDefaultBindings(),
    dpi: createDefaultDpi(),
    performance: createDefaultPerformance(),
    macros: [],
  };
}

export const BUTTON_DELAY_OPTIONS = [4, 6, 8, 10, 12];
