import type {
  Binding,
  ButtonId,
  DpiFunctionId,
  Macro,
  MediaFunctionId,
  MouseFunctionId,
  SystemFunctionId,
} from './types';

export type FunctionCategoryId = 'mouse' | 'keyboard' | 'media' | 'system' | 'dpi' | 'macro' | 'disabled';

export interface FunctionOption {
  id: string;
  label: string;
}

export interface FunctionGroup {
  id: string;
  label: string;
  options: FunctionOption[];
}

export interface FunctionCategory {
  id: FunctionCategoryId;
  label: string;
  description: string;
  groups: FunctionGroup[];
}

export const BUTTON_ORDER: ButtonId[] = ['left', 'right', 'wheel', 'forward', 'back', 'dpi'];

export const BUTTON_META: Record<
  ButtonId,
  { label: string; shortLabel: string; description: string; index: number }
> = {
  left: { label: '左键', shortLabel: '左键', description: '鼠标主按键', index: 1 },
  right: { label: '右键', shortLabel: '右键', description: '鼠标副按键', index: 2 },
  wheel: { label: '滚轮中键', shortLabel: '滚轮', description: '滚轮按下动作', index: 3 },
  forward: { label: '侧键 · 前进', shortLabel: '前进', description: '左侧靠近前端的侧键', index: 4 },
  back: { label: '侧键 · 后退', shortLabel: '后退', description: '左侧靠近后端的侧键', index: 5 },
  dpi: { label: 'DPI 键', shortLabel: 'DPI', description: '滚轮后方的 DPI 切换键', index: 6 },
};

const MOUSE_VENDOR: Record<MouseFunctionId, number> = {
  left: 0x100100,
  right: 0x100200,
  middle: 0x100400,
  back: 0x100801,
  forward: 0x101001,
};

const MEDIA_VENDOR: Record<MediaFunctionId, number> = {
  'media-select': 0x308301,
  'play-pause': 0x30cd00,
  stop: 0x30b700,
  previous: 0x30b600,
  next: 0x30b500,
  'volume-down': 0x30ea00,
  'volume-up': 0x30e900,
  mute: 0x30e200,
  'browser-home': 0x302302,
  'browser-refresh': 0x302702,
  'browser-stop': 0x302602,
  'browser-back': 0x302402,
  'browser-forward': 0x302502,
  favorites: 0x302a02,
  search: 0x302102,
  'my-computer': 0x309401,
  calculator: 0x309201,
  mail: 0x308a01,
};

const SYSTEM_VENDOR: Record<SystemFunctionId, number> = {
  power: 0x400100,
  sleep: 0x400200,
  wake: 0x400400,
};

const DPI_VENDOR: Record<DpiFunctionId, number> = {
  up: 0x130100,
  down: 0x130200,
  cycle: 0x130300,
};

const MOUSE_OPTIONS: FunctionOption[] = [
  { id: 'left', label: '左键单击' },
  { id: 'right', label: '右键单击' },
  { id: 'middle', label: '中键单击' },
  { id: 'back', label: '后退' },
  { id: 'forward', label: '前进' },
];

const MEDIA_OPTIONS: FunctionOption[] = [
  { id: 'media-select', label: '媒体选择' },
  { id: 'play-pause', label: '播放 / 暂停' },
  { id: 'stop', label: '停止播放' },
  { id: 'previous', label: '上一曲' },
  { id: 'next', label: '下一曲' },
  { id: 'volume-down', label: '音量 −' },
  { id: 'volume-up', label: '音量 +' },
  { id: 'mute', label: '静音' },
  { id: 'browser-home', label: '浏览器主页' },
  { id: 'browser-refresh', label: '刷新网页' },
  { id: 'browser-stop', label: '停止载入' },
  { id: 'browser-back', label: '浏览器后退' },
  { id: 'browser-forward', label: '浏览器前进' },
  { id: 'favorites', label: '收藏夹' },
  { id: 'search', label: '搜索' },
  { id: 'my-computer', label: '我的电脑' },
  { id: 'calculator', label: '计算器' },
  { id: 'mail', label: '邮件' },
];

const SYSTEM_OPTIONS: FunctionOption[] = [
  { id: 'power', label: '关机' },
  { id: 'sleep', label: '睡眠' },
  { id: 'wake', label: '唤醒' },
];

const DPI_OPTIONS: FunctionOption[] = [
  { id: 'up', label: 'DPI +' },
  { id: 'down', label: 'DPI −' },
  { id: 'cycle', label: 'DPI 循环' },
];

interface KeyboardOption extends FunctionOption {
  usage?: number;
  modifier?: number;
}

interface KeyboardGroup {
  id: string;
  label: string;
  options: KeyboardOption[];
}

const LETTER_USAGE = 0x04;
const DIGIT_USAGE = 0x1e;

const KEYBOARD_GROUPS: KeyboardGroup[] = [
  {
    id: 'letters',
    label: '字母',
    options: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter, index) => ({
      id: `Key${letter}`,
      label: letter,
      usage: LETTER_USAGE + index,
    })),
  },
  {
    id: 'digits',
    label: '数字',
    options: '1234567890'.split('').map((digit, index) => ({
      id: `Digit${digit}`,
      label: digit,
      usage: DIGIT_USAGE + index,
    })),
  },
  {
    id: 'function',
    label: '功能键',
    options: Array.from({ length: 12 }, (_, index) => ({
      id: `F${index + 1}`,
      label: `F${index + 1}`,
      usage: 0x3a + index,
    })),
  },
  {
    id: 'control',
    label: '控制键',
    options: [
      { id: 'Escape', label: 'Esc', usage: 0x29 },
      { id: 'Tab', label: 'Tab', usage: 0x2b },
      { id: 'CapsLock', label: 'Caps', usage: 0x39 },
      { id: 'Space', label: 'Space', usage: 0x2c },
      { id: 'Enter', label: 'Enter', usage: 0x28 },
      { id: 'Backspace', label: 'Backspace', usage: 0x2a },
      { id: 'Delete', label: 'Delete', usage: 0x4c },
      { id: 'Insert', label: 'Insert', usage: 0x49 },
      { id: 'Home', label: 'Home', usage: 0x4a },
      { id: 'End', label: 'End', usage: 0x4d },
      { id: 'PageUp', label: 'PgUp', usage: 0x4b },
      { id: 'PageDown', label: 'PgDn', usage: 0x4e },
      { id: 'ArrowUp', label: '↑', usage: 0x52 },
      { id: 'ArrowDown', label: '↓', usage: 0x51 },
      { id: 'ArrowLeft', label: '←', usage: 0x50 },
      { id: 'ArrowRight', label: '→', usage: 0x4f },
      { id: 'PrintScreen', label: 'PrtSc', usage: 0x46 },
      { id: 'ScrollLock', label: 'ScrLk', usage: 0x47 },
      { id: 'Pause', label: 'Pause', usage: 0x48 },
      { id: 'ContextMenu', label: 'Menu', usage: 0x65 },
    ],
  },
  {
    id: 'modifiers',
    label: '修饰键',
    options: [
      { id: 'ControlLeft', label: 'Ctrl L', modifier: 0x0100 },
      { id: 'ShiftLeft', label: 'Shift L', modifier: 0x0200 },
      { id: 'AltLeft', label: 'Alt L', modifier: 0x0400 },
      { id: 'MetaLeft', label: 'Win L', modifier: 0x0800 },
      { id: 'ControlRight', label: 'Ctrl R', modifier: 0x1000 },
      { id: 'ShiftRight', label: 'Shift R', modifier: 0x2000 },
      { id: 'AltRight', label: 'Alt R', modifier: 0x4000 },
      { id: 'MetaRight', label: 'Win R', modifier: 0x8000 },
    ],
  },
  {
    id: 'symbols',
    label: '符号',
    options: [
      { id: 'Minus', label: '-', usage: 0x2d },
      { id: 'Equal', label: '=', usage: 0x2e },
      { id: 'BracketLeft', label: '[', usage: 0x2f },
      { id: 'BracketRight', label: ']', usage: 0x30 },
      { id: 'Backslash', label: '\\', usage: 0x31 },
      { id: 'IntlHash', label: '# / ~', usage: 0x32 },
      { id: 'Semicolon', label: ';', usage: 0x33 },
      { id: 'Quote', label: "'", usage: 0x34 },
      { id: 'Backquote', label: '`', usage: 0x35 },
      { id: 'Comma', label: ',', usage: 0x36 },
      { id: 'Period', label: '.', usage: 0x37 },
      { id: 'Slash', label: '/', usage: 0x38 },
      { id: 'IntlBackslash', label: '\\ (ISO)', usage: 0x64 },
    ],
  },
  {
    id: 'numpad',
    label: '数字键盘',
    options: [
      { id: 'NumLock', label: 'Num', usage: 0x53 },
      { id: 'NumpadDivide', label: 'Num /', usage: 0x54 },
      { id: 'NumpadMultiply', label: 'Num *', usage: 0x55 },
      { id: 'NumpadSubtract', label: 'Num −', usage: 0x56 },
      { id: 'NumpadAdd', label: 'Num +', usage: 0x57 },
      { id: 'NumpadEnter', label: 'Num Enter', usage: 0x58 },
      { id: 'Numpad1', label: 'Num 1', usage: 0x59 },
      { id: 'Numpad2', label: 'Num 2', usage: 0x5a },
      { id: 'Numpad3', label: 'Num 3', usage: 0x5b },
      { id: 'Numpad4', label: 'Num 4', usage: 0x5c },
      { id: 'Numpad5', label: 'Num 5', usage: 0x5d },
      { id: 'Numpad6', label: 'Num 6', usage: 0x5e },
      { id: 'Numpad7', label: 'Num 7', usage: 0x5f },
      { id: 'Numpad8', label: 'Num 8', usage: 0x60 },
      { id: 'Numpad9', label: 'Num 9', usage: 0x61 },
      { id: 'Numpad0', label: 'Num 0', usage: 0x62 },
      { id: 'NumpadDecimal', label: 'Num .', usage: 0x63 },
      { id: 'NumpadComma', label: 'Num ,', usage: 0x85 },
    ],
  },
  {
    id: 'international',
    label: '国际键',
    options: [
      { id: 'IntlRo', label: 'ろ', usage: 0x87 },
      { id: 'KanaMode', label: 'かな', usage: 0x88 },
      { id: 'IntlYen', label: '¥', usage: 0x89 },
      { id: 'Convert', label: '変換', usage: 0x8a },
      { id: 'NonConvert', label: '無変換', usage: 0x8b },
      { id: 'Lang1', label: '한/영', usage: 0x90 },
      { id: 'Lang2', label: '한자', usage: 0x91 },
    ],
  },
];

const KEYBOARD_INDEX = new Map<string, KeyboardOption>();
for (const group of KEYBOARD_GROUPS) {
  for (const option of group.options) KEYBOARD_INDEX.set(option.id, option);
}

const KEY_LABELS: Record<string, string> = Object.fromEntries(
  [...KEYBOARD_INDEX.values()].map((option) => [option.id, option.label]),
);

export function keyLabel(code: string): string {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

function keyboardVendorCode(option: KeyboardOption): number {
  if (option.modifier !== undefined) return 0x200000 | option.modifier;
  return 0x200000 | (option.usage ?? 0);
}

const CAPTURE_MEDIA: Record<string, MediaFunctionId> = {
  MediaPlayPause: 'play-pause',
  MediaStop: 'stop',
  MediaTrackPrevious: 'previous',
  MediaTrackNext: 'next',
  AudioVolumeUp: 'volume-up',
  AudioVolumeDown: 'volume-down',
  AudioVolumeMute: 'mute',
  BrowserHome: 'browser-home',
  BrowserRefresh: 'browser-refresh',
  BrowserStop: 'browser-stop',
  BrowserBack: 'browser-back',
  BrowserForward: 'browser-forward',
  BrowserFavorites: 'favorites',
  BrowserSearch: 'search',
  LaunchMail: 'mail',
};

const CAPTURE_SYSTEM: Record<string, SystemFunctionId> = {
  Power: 'power',
  Sleep: 'sleep',
  WakeUp: 'wake',
};

export function bindingFromKeyCode(code: string): Binding | null {
  const option = KEYBOARD_INDEX.get(code);
  if (option) return { kind: 'key', code, label: option.label };
  const media = CAPTURE_MEDIA[code];
  if (media) return buildBinding('media', media, []);
  const system = CAPTURE_SYSTEM[code];
  if (system) return buildBinding('system', system, []);
  return null;
}

function optionLabel(options: FunctionOption[], id: string): string {
  return options.find((option) => option.id === id)?.label ?? id;
}

export function buildBinding(
  category: FunctionCategoryId,
  id: string,
  macros: Macro[],
): Binding {
  switch (category) {
    case 'mouse':
      return { kind: 'mouse', id: id as MouseFunctionId, label: optionLabel(MOUSE_OPTIONS, id) };
    case 'keyboard':
      return { kind: 'key', code: id, label: keyLabel(id) };
    case 'media':
      return { kind: 'media', id: id as MediaFunctionId, label: optionLabel(MEDIA_OPTIONS, id) };
    case 'system':
      return { kind: 'system', id: id as SystemFunctionId, label: optionLabel(SYSTEM_OPTIONS, id) };
    case 'dpi':
      return { kind: 'dpi', id: id as DpiFunctionId, label: optionLabel(DPI_OPTIONS, id) };
    case 'macro':
      return { kind: 'macro', macroId: id };
    case 'disabled':
      return { kind: 'disabled' };
  }
}

export function bindingKey(binding: Binding): string {
  switch (binding.kind) {
    case 'macro':
      return `macro:${binding.macroId}`;
    case 'disabled':
      return 'disabled';
    case 'key':
      return `key:${binding.code}`;
    default:
      return `${binding.kind}:${binding.id}`;
  }
}

export function bindingLabel(binding: Binding, macros: Macro[]): string {
  if (binding.kind === 'macro') {
    const macro = macros.find((item) => item.id === binding.macroId);
    return macro ? `宏 · ${macro.name}` : '宏（已删除）';
  }
  if (binding.kind === 'disabled') return '未分配';
  return binding.label;
}

export function bindingKindLabel(binding: Binding): string {
  switch (binding.kind) {
    case 'mouse':
      return '鼠标功能';
    case 'key':
      return '键盘按键';
    case 'media':
      return '多媒体';
    case 'system':
      return '系统功能';
    case 'dpi':
      return 'DPI 控制';
    case 'macro':
      return '宏';
    case 'disabled':
      return '未分配';
  }
}

export function getFunctionCategories(macros: Macro[]): FunctionCategory[] {
  const macroOptions: FunctionOption[] = macros.map((macro) => ({
    id: macro.id,
    label: macro.name,
  }));

  return [
    {
      id: 'mouse',
      label: '鼠标功能',
      description: '标准鼠标点击动作',
      groups: [{ id: 'mouse', label: '鼠标动作', options: MOUSE_OPTIONS }],
    },
    {
      id: 'keyboard',
      label: '键盘按键',
      description: '将鼠标按键映射为键盘按键',
      groups: KEYBOARD_GROUPS.map((group) => ({
        id: group.id,
        label: group.label,
        options: group.options.map((option) => ({ id: option.id, label: option.label })),
      })),
    },
    {
      id: 'media',
      label: '多媒体 / 浏览器',
      description: '媒体控制、音量和浏览器快捷键',
      groups: [{ id: 'media', label: '媒体与浏览器', options: MEDIA_OPTIONS }],
    },
    {
      id: 'system',
      label: '系统',
      description: '电源与睡眠控制',
      groups: [{ id: 'system', label: '电源操作', options: SYSTEM_OPTIONS }],
    },
    {
      id: 'dpi',
      label: 'DPI',
      description: '在 DPI 档位之间切换',
      groups: [{ id: 'dpi', label: 'DPI 控制', options: DPI_OPTIONS }],
    },
    {
      id: 'macro',
      label: '宏',
      description: macros.length ? '播放已经录制的宏' : '尚未创建宏',
      groups: [{ id: 'macro', label: '宏列表', options: macroOptions }],
    },
    {
      id: 'disabled',
      label: '禁用',
      description: '关闭该按键的功能',
      groups: [],
    },
  ];
}

export function defaultBindingFor(button: ButtonId): Binding {
  switch (button) {
    case 'left':
      return buildBinding('mouse', 'left', []);
    case 'right':
      return buildBinding('mouse', 'right', []);
    case 'wheel':
      return buildBinding('mouse', 'middle', []);
    case 'forward':
      return buildBinding('mouse', 'forward', []);
    case 'back':
      return buildBinding('mouse', 'back', []);
    case 'dpi':
      return buildBinding('dpi', 'cycle', []);
  }
}

export function createDefaultBindings(): Record<ButtonId, Binding> {
  return {
    left: defaultBindingFor('left'),
    right: defaultBindingFor('right'),
    wheel: defaultBindingFor('wheel'),
    forward: defaultBindingFor('forward'),
    back: defaultBindingFor('back'),
    dpi: defaultBindingFor('dpi'),
  };
}

export const VENDOR_ASSIGNMENTS: Record<string, number> = {};

const VENDOR_REVERSE = new Map<number, Binding>();

function registerVendor(binding: Binding, code: number): void {
  VENDOR_ASSIGNMENTS[bindingKey(binding)] = code;
  if (!VENDOR_REVERSE.has(code)) VENDOR_REVERSE.set(code, binding);
}

for (const option of MOUSE_OPTIONS) {
  registerVendor(buildBinding('mouse', option.id, []), MOUSE_VENDOR[option.id as MouseFunctionId]);
}
for (const option of MEDIA_OPTIONS) {
  registerVendor(buildBinding('media', option.id, []), MEDIA_VENDOR[option.id as MediaFunctionId]);
}
for (const option of SYSTEM_OPTIONS) {
  registerVendor(buildBinding('system', option.id, []), SYSTEM_VENDOR[option.id as SystemFunctionId]);
}
for (const option of DPI_OPTIONS) {
  registerVendor(buildBinding('dpi', option.id, []), DPI_VENDOR[option.id as DpiFunctionId]);
}
for (const group of KEYBOARD_GROUPS) {
  for (const option of group.options) {
    registerVendor(
      { kind: 'key', code: option.id, label: option.label },
      keyboardVendorCode(option),
    );
  }
}

export function vendorCodeForBinding(binding: Binding): number | null {
  if (binding.kind === 'disabled') return 0xa00000;
  return VENDOR_ASSIGNMENTS[bindingKey(binding)] ?? null;
}

export function bindingFromVendorCode(code: number): Binding | null {
  if (code === 0xa00000) return { kind: 'disabled' };
  const binding = VENDOR_REVERSE.get(code);
  return binding ? { ...binding } : null;
}

export const POLLING_OPTIONS: Array<{ value: 125 | 250 | 500 | 1000; label: string; latency: string }> = [
  { value: 125, label: '125 Hz', latency: '8.0 ms' },
  { value: 250, label: '250 Hz', latency: '4.0 ms' },
  { value: 500, label: '500 Hz', latency: '2.0 ms' },
  { value: 1000, label: '1000 Hz', latency: '1.0 ms' },
];
