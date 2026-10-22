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

const MOUSE_OPTIONS: FunctionOption[] = [
  { id: 'left', label: '左键单击' },
  { id: 'right', label: '右键单击' },
  { id: 'middle', label: '中键单击' },
  { id: 'back', label: '后退' },
  { id: 'forward', label: '前进' },
  { id: 'double-click', label: '双击' },
  { id: 'scroll-up', label: '向上滚动' },
  { id: 'scroll-down', label: '向下滚动' },
];

const MEDIA_OPTIONS: FunctionOption[] = [
  { id: 'play-pause', label: '播放 / 暂停' },
  { id: 'stop', label: '停止播放' },
  { id: 'previous', label: '上一曲' },
  { id: 'next', label: '下一曲' },
  { id: 'volume-up', label: '音量 +' },
  { id: 'volume-down', label: '音量 −' },
  { id: 'mute', label: '静音' },
];

const SYSTEM_OPTIONS: FunctionOption[] = [
  { id: 'lock', label: '锁定电脑' },
  { id: 'sleep', label: '睡眠' },
  { id: 'calculator', label: '计算器' },
  { id: 'mail', label: '邮件' },
  { id: 'browser-home', label: '浏览器主页' },
  { id: 'browser-back', label: '浏览器后退' },
  { id: 'browser-forward', label: '浏览器前进' },
  { id: 'browser-refresh', label: '刷新网页' },
  { id: 'search', label: '搜索' },
  { id: 'my-computer', label: '我的电脑' },
  { id: 'copy', label: '复制' },
  { id: 'paste', label: '粘贴' },
  { id: 'cut', label: '剪切' },
  { id: 'undo', label: '撤销' },
  { id: 'select-all', label: '全选' },
  { id: 'save', label: '保存' },
];

const DPI_OPTIONS: FunctionOption[] = [
  { id: 'up', label: 'DPI +' },
  { id: 'down', label: 'DPI −' },
  { id: 'cycle', label: 'DPI 循环' },
];

const KEYBOARD_GROUPS: FunctionGroup[] = [
  {
    id: 'letters',
    label: '字母',
    options: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => ({
      id: `Key${letter}`,
      label: letter,
    })),
  },
  {
    id: 'digits',
    label: '数字',
    options: '0123456789'.split('').map((digit) => ({
      id: `Digit${digit}`,
      label: digit,
    })),
  },
  {
    id: 'function',
    label: '功能键',
    options: Array.from({ length: 12 }, (_, index) => ({
      id: `F${index + 1}`,
      label: `F${index + 1}`,
    })),
  },
  {
    id: 'control',
    label: '控制键',
    options: [
      { id: 'Escape', label: 'Esc' },
      { id: 'Tab', label: 'Tab' },
      { id: 'CapsLock', label: 'Caps' },
      { id: 'ShiftLeft', label: 'Shift' },
      { id: 'ControlLeft', label: 'Ctrl' },
      { id: 'AltLeft', label: 'Alt' },
      { id: 'MetaLeft', label: 'Win' },
      { id: 'Space', label: 'Space' },
      { id: 'Enter', label: 'Enter' },
      { id: 'Backspace', label: 'Backspace' },
      { id: 'Delete', label: 'Delete' },
      { id: 'Insert', label: 'Insert' },
      { id: 'Home', label: 'Home' },
      { id: 'End', label: 'End' },
      { id: 'PageUp', label: 'PgUp' },
      { id: 'PageDown', label: 'PgDn' },
      { id: 'ArrowUp', label: '↑' },
      { id: 'ArrowDown', label: '↓' },
      { id: 'ArrowLeft', label: '←' },
      { id: 'ArrowRight', label: '→' },
    ],
  },
  {
    id: 'symbols',
    label: '符号',
    options: [
      { id: 'Minus', label: '-' },
      { id: 'Equal', label: '=' },
      { id: 'BracketLeft', label: '[' },
      { id: 'BracketRight', label: ']' },
      { id: 'Backslash', label: '\\' },
      { id: 'Semicolon', label: ';' },
      { id: 'Quote', label: "'" },
      { id: 'Backquote', label: '`' },
      { id: 'Comma', label: ',' },
      { id: 'Period', label: '.' },
      { id: 'Slash', label: '/' },
    ],
  },
];

const KEY_LABELS: Record<string, string> = Object.fromEntries(
  KEYBOARD_GROUPS.flatMap((group) => group.options.map((option) => [option.id, option.label])),
);

export function keyLabel(code: string): string {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
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
  if (binding.kind === 'key') return binding.label;
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
      description: '标准鼠标点击与滚轮动作',
      groups: [{ id: 'mouse', label: '鼠标动作', options: MOUSE_OPTIONS }],
    },
    {
      id: 'keyboard',
      label: '键盘按键',
      description: '将鼠标按键映射为键盘按键',
      groups: KEYBOARD_GROUPS,
    },
    {
      id: 'media',
      label: '多媒体',
      description: '控制音乐与系统音量',
      groups: [{ id: 'media', label: '媒体控制', options: MEDIA_OPTIONS }],
    },
    {
      id: 'system',
      label: '系统功能',
      description: '快捷调用常用系统操作',
      groups: [{ id: 'system', label: '系统操作', options: SYSTEM_OPTIONS }],
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

export const VENDOR_ASSIGNMENTS: Record<string, number> = {
  'mouse:left': 1048832,
  'mouse:right': 1049088,
  'mouse:middle': 1049600,
  'mouse:forward': 1052673,
  'mouse:back': 1050625,
  'dpi:up': 1245440,
  'dpi:down': 1245696,
  'dpi:cycle': 1245952,
};

const VENDOR_REVERSE: Record<number, Binding> = {
  1048832: { kind: 'mouse', id: 'left', label: '左键单击' },
  1049088: { kind: 'mouse', id: 'right', label: '右键单击' },
  1049600: { kind: 'mouse', id: 'middle', label: '中键单击' },
  1052673: { kind: 'mouse', id: 'forward', label: '前进' },
  1050625: { kind: 'mouse', id: 'back', label: '后退' },
  1245440: { kind: 'dpi', id: 'up', label: 'DPI +' },
  1245696: { kind: 'dpi', id: 'down', label: 'DPI −' },
  1245952: { kind: 'dpi', id: 'cycle', label: 'DPI 循环' },
};

export function vendorCodeForBinding(binding: Binding): number {
  return VENDOR_ASSIGNMENTS[bindingKey(binding)] ?? 10485760;
}

export function bindingFromVendorCode(code: number): Binding | null {
  return VENDOR_REVERSE[code] ?? null;
}

export const POLLING_OPTIONS: Array<{ value: 125 | 250 | 500 | 1000; label: string; latency: string }> = [
  { value: 125, label: '125 Hz', latency: '8.0 ms' },
  { value: 250, label: '250 Hz', latency: '4.0 ms' },
  { value: 500, label: '500 Hz', latency: '2.0 ms' },
  { value: 1000, label: '1000 Hz', latency: '1.0 ms' },
];
