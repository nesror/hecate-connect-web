export type PageId = 'keys' | 'dpi' | 'performance' | 'lighting' | 'macros';

export type ButtonId = 'left' | 'right' | 'wheel' | 'back' | 'forward' | 'dpi';

export type MouseFunctionId =
  | 'left'
  | 'right'
  | 'middle'
  | 'back'
  | 'forward'
  | 'double-click'
  | 'scroll-up'
  | 'scroll-down';

export type MediaFunctionId =
  | 'play-pause'
  | 'stop'
  | 'previous'
  | 'next'
  | 'volume-up'
  | 'volume-down'
  | 'mute';

export type SystemFunctionId =
  | 'lock'
  | 'sleep'
  | 'calculator'
  | 'mail'
  | 'browser-home'
  | 'browser-back'
  | 'browser-forward'
  | 'browser-refresh'
  | 'search'
  | 'my-computer'
  | 'copy'
  | 'paste'
  | 'cut'
  | 'undo'
  | 'select-all'
  | 'save';

export type DpiFunctionId = 'up' | 'down' | 'cycle';

export type Binding =
  | { kind: 'mouse'; id: MouseFunctionId; label: string }
  | { kind: 'key'; code: string; label: string }
  | { kind: 'media'; id: MediaFunctionId; label: string }
  | { kind: 'system'; id: SystemFunctionId; label: string }
  | { kind: 'dpi'; id: DpiFunctionId; label: string }
  | { kind: 'macro'; macroId: string }
  | { kind: 'disabled' };

export interface DpiStage {
  enabled: boolean;
  dpiX: number;
  dpiY: number;
  color: string;
}

export interface IndicatorSettings {
  enabled: boolean;
  brightness: number;
  effect: 'solid' | 'breath';
}

export interface DpiSettings {
  stages: DpiStage[];
  activeStage: number;
  xYLinked: boolean;
  indicator: IndicatorSettings;
}

export type PollingRate = 125 | 250 | 500 | 1000;

export interface PerformanceSettings {
  pollingRate: PollingRate;
  lineCorrection: boolean;
  rippleCorrection: boolean;
  angleSnap: boolean;
  sensorHeight: 1 | 2;
  buttonDelay: number;
  pointerSpeed: number;
  enhancePrecision: boolean;
  scrollSpeed: number;
  scrollFullPage: boolean;
  doubleClickSpeed: number;
}

export interface MacroKeyAction {
  id: string;
  type: 'key';
  code: string;
  label: string;
  event: 'down' | 'up';
  delay: number;
}

export interface MacroMouseAction {
  id: string;
  type: 'mouse';
  button: ButtonId;
  event: 'down' | 'up';
  delay: number;
}

export interface MacroDelayAction {
  id: string;
  type: 'delay';
  delay: number;
}

export type MacroAction = MacroKeyAction | MacroMouseAction | MacroDelayAction;

export interface Macro {
  id: string;
  name: string;
  actions: MacroAction[];
  repeat: number;
  stopMode: 'once' | 'release';
}

export interface Profile {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  bindings: Record<ButtonId, Binding>;
  dpi: DpiSettings;
  performance: PerformanceSettings;
  macros: Macro[];
}

export interface StoredState {
  version: 1;
  profiles: Profile[];
  activeId: string;
}

export interface ToastMessage {
  id: string;
  tone: 'success' | 'error' | 'info';
  title: string;
  detail?: string;
}
