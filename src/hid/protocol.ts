import { bindingFromVendorCode, vendorCodeForBinding } from '../functions';
import type { Binding, ButtonId } from '../types';

export const REPORT_ID = 4;
export const REPORT_DATA_LENGTH = 63;
export const CHUNK_SIZE = 56;
export const HEADER_LENGTH = 34;
export const MAX_KEYS = 170;
export const DISABLED_ASSIGNMENT = 0xa00000;
export const COMMAND_TIMEOUT_MS = 2000;
export const PROFILE_BLOCK_LENGTH = 84;

export const COMMAND = {
  handshake: 0xaa,
  enterConfig: 0x01,
  commit: 0x02,
  readHeader: 0x03,
  readBlock: 0x05,
  writeBlock: 0x06,
  readKeymap: 0x07,
  writeKeymap: 0x09,
  dpiEnable: 0x28,
  pollingRate: 0x29,
} as const;

export const HANDSHAKE_READY = 0xff;

export const BUTTON_SLOTS: ReadonlyArray<{ button: ButtonId; slot: number }> = [
  { button: 'left', slot: 0 },
  { button: 'wheel', slot: 1 },
  { button: 'right', slot: 2 },
  { button: 'forward', slot: 3 },
  { button: 'back', slot: 4 },
  { button: 'dpi', slot: 5 },
];

const EMPTY_CHUNK = new Uint8Array(0);

export interface HidResponse {
  raw: Uint8Array;
  command: number;
  status: number;
  length: number;
  offset: number;
  payload: Uint8Array;
  checksumValid: boolean;
}

export interface DeviceHeader {
  keyCount: number;
  macroBlocks: number;
  macroBytes: number;
  dpiStep: number;
  dpiMaxIndex: number;
  dpiBase: number;
}

function checksum(packet: Uint8Array): number {
  let sum = 0;
  for (let index = 2; index < packet.length; index += 1) {
    sum = (sum + packet[index]) & 0xffff;
  }
  return sum;
}

/**
 * WebHID strips the report ID from the payload, so this builds the 63-byte
 * report body: checksum(2) + command + length + offset(2) + status + payload.
 */
export function buildPacket(
  command: number,
  offset = 0,
  chunk: Uint8Array = EMPTY_CHUNK,
): Uint8Array {
  if (!Number.isInteger(command) || command < 0 || command > 0xff) {
    throw new Error(`无效的命令码：${command}`);
  }
  if (!Number.isInteger(offset) || offset < 0 || offset > 0xffff) {
    throw new Error(`无效的偏移：${offset}`);
  }
  if (chunk.length > CHUNK_SIZE) {
    throw new Error(`单个数据块不能超过 ${CHUNK_SIZE} 字节`);
  }

  const packet = new Uint8Array(REPORT_DATA_LENGTH);
  packet[2] = command;
  packet[3] = chunk.length;
  packet[4] = offset & 0xff;
  packet[5] = (offset >>> 8) & 0xff;
  packet[6] = 0;
  packet.set(chunk, 7);

  const sum = checksum(packet);
  packet[0] = sum & 0xff;
  packet[1] = (sum >>> 8) & 0xff;
  return packet;
}

export function parseResponse(raw: Uint8Array): HidResponse | null {
  if (raw.length < 7) return null;
  const sum = checksum(raw);
  return {
    raw,
    command: raw[2],
    status: raw[6],
    length: raw[3],
    offset: raw[4] | (raw[5] << 8),
    payload: raw.slice(7),
    checksumValid: (raw[0] | (raw[1] << 8)) === sum,
  };
}

export function isErrorStatus(status: number): boolean {
  return status === 0xff || status === 0xfe;
}

export function parseHeader(raw: Uint8Array): DeviceHeader {
  const keyCount = raw[5] ?? 0;
  const macroBlocks = raw[6] ?? 0;
  const step = raw[11] ?? 0;
  const maxIndex = (raw[12] ?? 0) | ((raw[13] ?? 0) << 8);
  const base = (raw[14] ?? 0) | ((raw[15] ?? 0) << 8);
  return {
    keyCount,
    macroBlocks,
    macroBytes: macroBlocks * 128,
    dpiStep: step > 0 ? step : 50,
    dpiMaxIndex: maxIndex > 0 ? maxIndex : 519,
    dpiBase: base > 0 ? base : 50,
  };
}

export function assignmentAt(keymap: Uint8Array, slot: number): number | null {
  const offset = slot * 3;
  if (offset < 0 || offset + 2 >= keymap.length) return null;
  return (keymap[offset] << 16) | (keymap[offset + 1] << 8) | keymap[offset + 2];
}

export function setAssignment(keymap: Uint8Array, slot: number, code: number): void {
  const offset = slot * 3;
  if (offset < 0 || offset + 2 >= keymap.length) {
    throw new Error(`按键槽位 ${slot} 超出设备按键表范围`);
  }
  if (!Number.isInteger(code) || code < 0 || code > 0xffffff) {
    throw new Error(`按键代码 0x${code.toString(16)} 无法用 3 字节表示`);
  }
  keymap[offset] = (code >>> 16) & 0xff;
  keymap[offset + 1] = (code >>> 8) & 0xff;
  keymap[offset + 2] = code & 0xff;
}

export function assignmentForBinding(binding: Binding): number | null {
  if (binding.kind === 'disabled') return DISABLED_ASSIGNMENT;
  return vendorCodeForBinding(binding);
}

export function bindingForAssignment(code: number): Binding | null {
  if (code === DISABLED_ASSIGNMENT) return { kind: 'disabled' };
  return bindingFromVendorCode(code);
}

export function bindingsFromKeymap(
  keymap: Uint8Array,
): Record<ButtonId, Binding | null> | null {
  const result = {} as Record<ButtonId, Binding | null>;
  for (const { button, slot } of BUTTON_SLOTS) {
    const code = assignmentAt(keymap, slot);
    if (code === null) return null;
    result[button] = bindingForAssignment(code);
  }
  return result;
}

export function formatHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

export function formatCode(code: number): string {
  return `0x${code.toString(16).toUpperCase().padStart(6, '0')}`;
}

export function commandLabel(command: number): string {
  switch (command) {
    case COMMAND.handshake:
      return '设备握手';
    case COMMAND.enterConfig:
      return '进入配置模式';
    case COMMAND.commit:
      return '提交并退出';
    case COMMAND.readHeader:
      return '读取设备头';
    case COMMAND.readBlock:
      return '读取配置块';
    case COMMAND.writeBlock:
      return '写入配置块';
    case COMMAND.readKeymap:
      return '读取按键表';
    case COMMAND.writeKeymap:
      return '写入按键表';
    case COMMAND.dpiEnable:
      return '应用 DPI 设置';
    case COMMAND.pollingRate:
      return '应用回报率';
    default:
      return `命令 0x${command.toString(16).toUpperCase()}`;
  }
}
