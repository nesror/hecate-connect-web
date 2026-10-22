import { BUTTON_META } from '../functions';
import type { Binding, ButtonId, Profile } from '../types';
import {
  assignmentAt,
  assignmentForBinding,
  buildPacket,
  BUTTON_SLOTS,
  CHUNK_SIZE,
  COMMAND,
  COMMAND_TIMEOUT_MS,
  commandLabel,
  HANDSHAKE_READY,
  HEADER_LENGTH,
  isErrorStatus,
  MAX_KEYS,
  parseHeader,
  parseResponse,
  PROFILE_BLOCK_LENGTH,
  REPORT_DATA_LENGTH,
  REPORT_ID,
  setAssignment,
  type DeviceHeader,
  type HidResponse,
} from './protocol';
import {
  applyDpiToBlock,
  applyPerformanceToBlock,
  changedOffsets,
  decodeProfileBlock,
  pollingIndex,
  type DeviceSettings,
} from './profileCodec';

export interface HidCollectionSummary {
  usagePage: number;
  usage: number;
  type: number;
  inputReportIds: number[];
  outputReportIds: number[];
  featureReportIds: number[];
}

export interface HidDescriptor {
  vendorId: number;
  productId: number;
  productName: string;
  manufacturerName: string;
  serialNumber: string;
  collections: HidCollectionSummary[];
  inputReportIds: number[];
  outputReportIds: number[];
  featureReportIds: number[];
}

export interface CommandTrace {
  command: number;
  status: number;
  length: number;
  offset: number;
  checksumValid: boolean;
}

export interface ProbeResult {
  ok: boolean;
  handshake: CommandTrace;
  enter: CommandTrace;
  header: {
    raw: Uint8Array;
    parsed: DeviceHeader;
    traces: CommandTrace[];
  };
  keymap: {
    raw: Uint8Array;
    traces: CommandTrace[];
  } | null;
  profile: {
    index: number;
    raw: Uint8Array;
    settings: DeviceSettings;
    traces: CommandTrace[];
  } | null;
  commit: CommandTrace | null;
  warnings: string[];
  probedAt: string;
}

export interface SkippedSlot {
  button: ButtonId;
  slot: number;
  label: string;
  reason: string;
}

export interface KeymapWriteResult {
  before: Uint8Array;
  after: Uint8Array;
  changedSlots: number[];
  skipped: SkippedSlot[];
}

export interface ProfileBlockWriteResult {
  index: number;
  offset: number;
  before: Uint8Array;
  after: Uint8Array;
  changedOffsets: number[];
}

export interface WriteSections {
  bindings: boolean;
  dpi: boolean;
  performance: boolean;
}

export interface WriteResult {
  header: {
    raw: Uint8Array;
    parsed: DeviceHeader;
  };
  keymap: KeymapWriteResult | null;
  block: ProfileBlockWriteResult | null;
  polling: { index: number; rate: number } | null;
  traces: CommandTrace[];
  commit: CommandTrace;
  verification: ProbeResult | null;
  verificationError: string | null;
  verified: boolean | null;
  warnings: string[];
}

interface PendingResponse {
  command: number;
  timer: number;
  resolve: (response: HidResponse) => void;
  reject: (error: Error) => void;
}

const EMPTY_CHUNK = new Uint8Array(0);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.name && error.name !== 'Error' ? `${error.name}: ${error.message}` : error.message;
  }
  return String(error);
}

function flattenCollections(
  source: readonly HIDCollectionInfo[],
  target: HIDCollectionInfo[] = [],
): HIDCollectionInfo[] {
  for (const collection of source) {
    target.push(collection);
    if (collection.children?.length) flattenCollections(collection.children, target);
  }
  return target;
}

function collectReportIds(
  collections: HIDCollectionInfo[],
  key: 'inputReports' | 'outputReports' | 'featureReports',
): number[] {
  const ids = new Set<number>();
  for (const collection of collections) {
    for (const report of collection[key] ?? []) ids.add(report.reportId);
  }
  return [...ids].sort((left, right) => left - right);
}

function trace(response: HidResponse): CommandTrace {
  return {
    command: response.command,
    status: response.status,
    length: response.length,
    offset: response.offset,
    checksumValid: response.checksumValid,
  };
}

export class HidStatusError extends Error {
  readonly command: number;
  readonly status: number;

  constructor(command: number, status: number) {
    super(
      `设备拒绝${commandLabel(command)}，状态码 0x${status
        .toString(16)
        .toUpperCase()
        .padStart(2, '0')}`,
    );
    this.name = 'HidStatusError';
    this.command = command;
    this.status = status;
  }
}

class HidTimeoutError extends Error {
  constructor(command: number, offset: number, timeout: number) {
    super(`${commandLabel(command)}超时（偏移 ${offset}，${timeout} ms）`);
    this.name = 'HidTimeoutError';
  }
}

export class HecateHid {
  readonly device: HIDDevice;
  readonly reportId: number;

  private pending: PendingResponse | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(device: HIDDevice, reportId = REPORT_ID) {
    this.device = device;
    this.reportId = reportId;
  }

  get descriptor(): HidDescriptor {
    const collections = flattenCollections(this.device.collections ?? []);
    return {
      vendorId: this.device.vendorId,
      productId: this.device.productId,
      productName: this.device.productName,
      manufacturerName: this.device.manufacturerName,
      serialNumber: this.device.serialNumber,
      collections: collections.map((collection) => ({
        usagePage: collection.usagePage,
        usage: collection.usage,
        type: collection.type,
        inputReportIds: (collection.inputReports ?? []).map((report) => report.reportId),
        outputReportIds: (collection.outputReports ?? []).map((report) => report.reportId),
        featureReportIds: (collection.featureReports ?? []).map((report) => report.reportId),
      })),
      inputReportIds: collectReportIds(collections, 'inputReports'),
      outputReportIds: collectReportIds(collections, 'outputReports'),
      featureReportIds: collectReportIds(collections, 'featureReports'),
    };
  }

  async open(): Promise<void> {
    if (!this.device.opened) await this.device.open();
    this.device.oninputreport = this.handleInputReport;
  }

  async close(): Promise<void> {
    this.device.oninputreport = null;
    const pending = this.pending;
    this.pending = null;
    if (pending) {
      window.clearTimeout(pending.timer);
      pending.reject(new Error('设备连接已关闭'));
    }
    if (this.device.opened) {
      try {
        await this.device.close();
      } catch {
        // 设备可能已经被拔出，关闭失败无需继续处理。
      }
    }
  }

  probe(): Promise<ProbeResult> {
    return this.run(() => this.probeUnlocked());
  }

  writeProfile(
    profile: Profile,
    sections: WriteSections = { bindings: true, dpi: true, performance: true },
  ): Promise<WriteResult> {
    return this.run(() => this.writeProfileUnlocked(profile, sections));
  }

  private run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.chain.then(task, task);
    this.chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private handleInputReport = (event: HIDInputReportEvent): void => {
    if (event.reportId !== this.reportId) return;
    const view = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
    let raw = view.slice();
    if (raw.length === REPORT_DATA_LENGTH + 1 && raw[0] === this.reportId) {
      raw = raw.slice(1);
    }
    const response = parseResponse(raw);
    if (!response) return;
    const pending = this.pending;
    if (!pending || pending.command !== response.command) return;
    this.pending = null;
    window.clearTimeout(pending.timer);
    pending.resolve(response);
  };

  private async send(
    command: number,
    offset: number,
    chunk: Uint8Array,
    timeout = COMMAND_TIMEOUT_MS,
  ): Promise<HidResponse> {
    if (!this.device.opened) throw new Error('设备尚未打开');

    const packet = buildPacket(command, offset, chunk);
    let resolveResponse!: (response: HidResponse) => void;
    let rejectResponse!: (error: Error) => void;
    const responsePromise = new Promise<HidResponse>((resolve, reject) => {
      resolveResponse = resolve;
      rejectResponse = reject;
    });

    const timer = window.setTimeout(() => {
      if (this.pending?.timer !== timer) return;
      this.pending = null;
      rejectResponse(new HidTimeoutError(command, offset, timeout));
    }, timeout);

    this.pending = {
      command,
      timer,
      resolve: (response) => {
        window.clearTimeout(timer);
        resolveResponse(response);
      },
      reject: (error) => {
        window.clearTimeout(timer);
        rejectResponse(error);
      },
    };

    try {
      await this.device.sendReport(this.reportId, packet);
    } catch (error) {
      if (this.pending?.timer === timer) {
        this.pending = null;
        window.clearTimeout(timer);
        rejectResponse(new Error(`发送${commandLabel(command)}失败：${errorMessage(error)}`));
      }
    }

    return responsePromise;
  }

  private async commandOk(
    command: number,
    offset: number,
    chunk: Uint8Array,
    timeout = COMMAND_TIMEOUT_MS,
  ): Promise<HidResponse> {
    const response = await this.send(command, offset, chunk, timeout);
    if (isErrorStatus(response.status)) throw new HidStatusError(command, response.status);
    return response;
  }

  private async readChunksAt(
    command: number,
    baseOffset: number,
    total: number,
  ): Promise<{ data: Uint8Array; traces: CommandTrace[] }> {
    const data = new Uint8Array(total);
    const traces: CommandTrace[] = [];

    for (let relative = 0; relative < total; relative += CHUNK_SIZE) {
      const length = Math.min(CHUNK_SIZE, total - relative);
      const offset = baseOffset + relative;
      const request = new Uint8Array(length);
      let response: HidResponse;
      try {
        response = await this.commandOk(command, offset, request);
      } catch (error) {
        if (!(error instanceof HidTimeoutError)) throw error;
        response = await this.commandOk(command, offset, request);
      }

      traces.push(trace(response));
      if (response.payload.length < length) {
        throw new Error(
          `${commandLabel(command)}返回的数据不足：需要 ${length} 字节，收到 ${response.payload.length} 字节`,
        );
      }
      data.set(response.payload.slice(0, length), relative);
    }

    return { data, traces };
  }

  private readChunks(command: number, total: number): Promise<{ data: Uint8Array; traces: CommandTrace[] }> {
    return this.readChunksAt(command, 0, total);
  }

  private async writeChunksAt(
    command: number,
    baseOffset: number,
    data: Uint8Array,
  ): Promise<CommandTrace[]> {
    const traces: CommandTrace[] = [];
    for (let relative = 0; relative < data.length; relative += CHUNK_SIZE) {
      const chunk = data.slice(relative, relative + CHUNK_SIZE);
      const response = await this.commandOk(command, baseOffset + relative, chunk);
      traces.push(trace(response));
    }
    return traces;
  }

  private writeChunks(command: number, data: Uint8Array): Promise<CommandTrace[]> {
    return this.writeChunksAt(command, 0, data);
  }

  private async handshake(): Promise<CommandTrace> {
    let lastStatus: number | null = null;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      try {
        const response = await this.send(COMMAND.handshake, 0, EMPTY_CHUNK, 400);
        lastStatus = response.status;
        if (response.status === HANDSHAKE_READY) return trace(response);
      } catch (error) {
        if (!(error instanceof HidTimeoutError)) throw error;
      }
      await delay(50);
    }
    const status =
      lastStatus === null
        ? '无响应'
        : `0x${lastStatus.toString(16).toUpperCase().padStart(2, '0')}`;
    throw new Error(
      `设备未通过配置握手（0xAA），最后状态 ${status}。请确认鼠标处于 2.4G 或有线模式且未被官方驱动占用。`,
    );
  }

  private async enterConfig(): Promise<CommandTrace> {
    const response = await this.commandOk(COMMAND.enterConfig, 0, EMPTY_CHUNK, 2500);
    return trace(response);
  }

  private async commit(): Promise<CommandTrace> {
    await delay(20);
    const response = await this.commandOk(COMMAND.commit, 0, EMPTY_CHUNK, 2500);
    return trace(response);
  }

  private async probeUnlocked(): Promise<ProbeResult> {
    const warnings: string[] = [];
    const handshake = await this.handshake();
    const enter = await this.enterConfig();

    let headerRead: { data: Uint8Array; traces: CommandTrace[] };
    let keymapRead: { data: Uint8Array; traces: CommandTrace[] } | null = null;
    let profileRead: ProbeResult['profile'] = null;
    let header: DeviceHeader;

    try {
      headerRead = await this.readChunks(COMMAND.readHeader, HEADER_LENGTH);
      header = parseHeader(headerRead.data);

      const magicValid = headerRead.data[0] === 0xaa && headerRead.data[1] === 0x55;
      if (!magicValid || header.keyCount < 5 || header.keyCount > MAX_KEYS) {
        const magic = Array.from(headerRead.data.slice(0, 2), (byte) =>
          byte.toString(16).toUpperCase().padStart(2, '0'),
        ).join(' ');
        throw new Error(
          `设备返回的配置头无效（标识 ${magic}，按键数量 ${header.keyCount}），请重新连接后重试。`,
        );
      }
      keymapRead = await this.readChunks(COMMAND.readKeymap, header.keyCount * 3);

      try {
        const indexRead = await this.readChunksAt(COMMAND.readBlock, 0, 1);
        const index = indexRead.data[0] ?? 0;
        if (index > 15) {
          warnings.push(`设备返回的配置文件序号异常（${index}），未读取 DPI 与性能设置。`);
        } else {
          const blockRead = await this.readChunksAt(
            COMMAND.readBlock,
            index * PROFILE_BLOCK_LENGTH,
            PROFILE_BLOCK_LENGTH,
          );
          profileRead = {
            index,
            raw: blockRead.data,
            settings: decodeProfileBlock(blockRead.data, header),
            traces: [...indexRead.traces, ...blockRead.traces],
          };
        }
      } catch (error) {
        warnings.push(`读取 DPI 与性能配置块失败：${errorMessage(error)}`);
      }
    } catch (error) {
      try {
        await this.commit();
      } catch {
        // 读取失败时仍尝试退出配置模式，避免鼠标停留在配置状态。
      }
      throw error;
    }

    let commit: CommandTrace | null = null;
    try {
      commit = await this.commit();
    } catch (error) {
      warnings.push(`退出配置模式失败：${errorMessage(error)}`);
    }

    return {
      ok: true,
      handshake,
      enter,
      header: {
        raw: headerRead.data,
        parsed: header,
        traces: headerRead.traces,
      },
      keymap: keymapRead
        ? {
            raw: keymapRead.data,
            traces: keymapRead.traces,
          }
        : null,
      profile: profileRead,
      commit,
      warnings,
      probedAt: new Date().toISOString(),
    };
  }

  private async writeProfileUnlocked(profile: Profile, sections: WriteSections): Promise<WriteResult> {
    if (!sections.bindings && !sections.dpi && !sections.performance) {
      throw new Error('没有选择要写入的设置。');
    }

    const planned = sections.bindings
      ? BUTTON_SLOTS.map(({ button, slot }) => ({
          button,
          slot,
          label: BUTTON_META[button].label,
          code: assignmentForBinding(profile.bindings[button]),
        }))
      : [];
    const writable = planned.filter(
      (item): item is typeof item & { code: number } => item.code !== null,
    );

    await this.handshake();
    await this.enterConfig();

    let headerRead: { data: Uint8Array; traces: CommandTrace[] };
    let keymapRead: { data: Uint8Array; traces: CommandTrace[] } | null = null;
    let blockRead: { data: Uint8Array; traces: CommandTrace[] } | null = null;
    let profileIndex = 0;
    let header: DeviceHeader;

    try {
      headerRead = await this.readChunks(COMMAND.readHeader, HEADER_LENGTH);
      header = parseHeader(headerRead.data);
      if (header.keyCount < 5 || header.keyCount > MAX_KEYS) {
        throw new Error(`设备按键数量异常（${header.keyCount}），已取消写入。`);
      }
      if (sections.bindings) {
        keymapRead = await this.readChunks(COMMAND.readKeymap, header.keyCount * 3);
      }
      if (sections.dpi || sections.performance) {
        const indexRead = await this.readChunksAt(COMMAND.readBlock, 0, 1);
        profileIndex = indexRead.data[0] ?? 0;
        if (profileIndex > 15) {
          throw new Error(`设备返回的配置文件序号异常（${profileIndex}），已取消写入。`);
        }
        blockRead = await this.readChunksAt(
          COMMAND.readBlock,
          profileIndex * PROFILE_BLOCK_LENGTH,
          PROFILE_BLOCK_LENGTH,
        );
      }
    } catch (error) {
      try {
        await this.commit();
      } catch {
        // 尚未写入任何数据，尝试正常退出配置模式。
      }
      throw error;
    }

    let keymap: KeymapWriteResult | null = null;
    if (keymapRead) {
      const before = keymapRead.data.slice();
      const after = before.slice();
      for (const item of writable) setAssignment(after, item.slot, item.code);
      const skipped: SkippedSlot[] = planned
        .filter((item) => item.code === null)
        .map((item) => ({
          button: item.button,
          slot: item.slot,
          label: item.label,
          reason:
            profile.bindings[item.button].kind === 'macro'
              ? '宏尚未写入固件，设备保留该按键原有功能'
              : '该功能没有可用的官方协议代码',
        }));
      keymap = {
        before,
        after,
        changedSlots: writable
          .filter((item) => assignmentAt(before, item.slot) !== item.code)
          .map((item) => item.slot),
        skipped,
      };
    }

    let block: ProfileBlockWriteResult | null = null;
    if (blockRead) {
      const before = blockRead.data.slice();
      const after = before.slice();
      if (sections.dpi) applyDpiToBlock(after, profile.dpi, header);
      if (sections.performance) applyPerformanceToBlock(after, profile.performance);
      block = {
        index: profileIndex,
        offset: profileIndex * PROFILE_BLOCK_LENGTH,
        before,
        after,
        changedOffsets: changedOffsets(before, after),
      };
    }

    const warnings: string[] = [];
    const traces: CommandTrace[] = [];

    if (keymap && keymap.changedSlots.length > 0) {
      try {
        traces.push(...(await this.writeChunks(COMMAND.writeKeymap, keymap.after)));
      } catch (error) {
        throw new Error(
          `写入按键表过程中断：${errorMessage(
            error,
          )}。为避免提交不完整数据，已停止发送；请拔下并重新连接鼠标后重试。`,
        );
      }
    }

    if (block && block.changedOffsets.length > 0) {
      try {
        traces.push(...(await this.writeChunksAt(COMMAND.writeBlock, block.offset, block.after)));
      } catch (error) {
        throw new Error(
          `写入 DPI / 性能配置块过程中断：${errorMessage(
            error,
          )}。数据尚未提交；请拔下并重新连接鼠标后重试。`,
        );
      }
    }

    let polling: WriteResult['polling'] = null;
    if (sections.performance) {
      const index = pollingIndex(profile.performance.pollingRate);
      try {
        const response = await this.commandOk(
          COMMAND.pollingRate,
          0,
          new Uint8Array([Math.max(0, index)]),
        );
        traces.push(trace(response));
        polling = { index, rate: profile.performance.pollingRate };
      } catch (error) {
        warnings.push(
          `回报率即时应用失败：${errorMessage(error)}。配置块中已包含回报率设置，重新连接后仍然生效。`,
        );
      }
    }

    let commit: CommandTrace;
    try {
      commit = await this.commit();
    } catch (error) {
      throw new Error(
        `设置已发送，但提交命令失败：${errorMessage(
          error,
        )}。请断开鼠标重新连接，并使用“重新读取”确认设备状态。`,
      );
    }

    await delay(500);

    let verification: ProbeResult | null = null;
    let verificationError: string | null = null;
    try {
      verification = await this.probeUnlocked();
    } catch (error) {
      verificationError = errorMessage(error);
    }

    let verified: boolean | null = null;
    if (verification) {
      const checks: boolean[] = [];
      if (keymap) {
        const raw = verification.keymap?.raw ?? null;
        checks.push(
          raw !== null &&
            writable.every((item) => assignmentAt(raw, item.slot) === item.code),
        );
      }
      if (block) {
        const raw = verification.profile?.raw ?? null;
        checks.push(
          raw !== null &&
            block.changedOffsets.every((offset) => raw[offset] === block.after[offset]),
        );
      }
      if (sections.performance) {
        checks.push(
          verification.profile?.settings.pollingRate === profile.performance.pollingRate,
        );
      }
      verified = checks.every(Boolean);
    }

    return {
      header: {
        raw: headerRead.data,
        parsed: header,
      },
      keymap,
      block,
      polling,
      traces,
      commit,
      verification,
      verificationError,
      verified,
      warnings,
    };
  }
}
