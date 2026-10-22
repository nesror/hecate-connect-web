import { BUTTON_META } from '../functions';
import type { Binding, ButtonId } from '../types';
import {
  assignmentAt,
  assignmentForBinding,
  buildPacket,
  BUTTON_SLOTS,
  CHUNK_SIZE,
  COMMAND,
  COMMAND_TIMEOUT_MS,
  commandLabel,
  HEADER_LENGTH,
  isErrorStatus,
  MAX_KEYS,
  parseHeader,
  parseResponse,
  REPORT_DATA_LENGTH,
  REPORT_ID,
  setAssignment,
  type DeviceHeader,
  type HidResponse,
} from './protocol';

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
  commit: CommandTrace | null;
  warnings: string[];
  probedAt: string;
}

export interface WriteResult {
  header: {
    raw: Uint8Array;
    parsed: DeviceHeader;
  };
  before: Uint8Array;
  after: Uint8Array;
  changedSlots: number[];
  traces: CommandTrace[];
  commit: CommandTrace;
  verification: ProbeResult | null;
  verificationError: string | null;
  verified: boolean | null;
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

  writeBindings(bindings: Record<ButtonId, Binding>): Promise<WriteResult> {
    return this.run(() => this.writeBindingsUnlocked(bindings));
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

  private async readChunks(
    command: number,
    total: number,
  ): Promise<{ data: Uint8Array; traces: CommandTrace[] }> {
    const data = new Uint8Array(total);
    const traces: CommandTrace[] = [];

    for (let offset = 0; offset < total; offset += CHUNK_SIZE) {
      const length = Math.min(CHUNK_SIZE, total - offset);
      let response: HidResponse;
      try {
        response = await this.commandOk(command, offset, EMPTY_CHUNK);
      } catch (error) {
        if (!(error instanceof HidTimeoutError)) throw error;
        response = await this.commandOk(command, offset, EMPTY_CHUNK);
      }

      traces.push(trace(response));
      if (response.payload.length < length) {
        throw new Error(
          `${commandLabel(command)}返回的数据不足：需要 ${length} 字节，收到 ${response.payload.length} 字节`,
        );
      }
      data.set(response.payload.slice(0, length), offset);
    }

    return { data, traces };
  }

  private async writeChunks(command: number, data: Uint8Array): Promise<CommandTrace[]> {
    const traces: CommandTrace[] = [];
    for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
      const chunk = data.slice(offset, offset + CHUNK_SIZE);
      const response = await this.commandOk(command, offset, chunk);
      traces.push(trace(response));
    }
    return traces;
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
    const enter = await this.enterConfig();

    let headerRead: { data: Uint8Array; traces: CommandTrace[] };
    let keymapRead: { data: Uint8Array; traces: CommandTrace[] } | null = null;
    let header: DeviceHeader;

    try {
      headerRead = await this.readChunks(COMMAND.readHeader, HEADER_LENGTH);
      header = parseHeader(headerRead.data);

      if (header.keyCount < 5 || header.keyCount > MAX_KEYS) {
        warnings.push(`设备返回的按键数量为 ${header.keyCount}，超出可处理的 5–${MAX_KEYS} 范围。`);
      } else {
        keymapRead = await this.readChunks(COMMAND.readKeymap, header.keyCount * 3);
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
      commit,
      warnings,
      probedAt: new Date().toISOString(),
    };
  }

  private async writeBindingsUnlocked(bindings: Record<ButtonId, Binding>): Promise<WriteResult> {
    const planned = BUTTON_SLOTS.map(({ button, slot }) => ({
      button,
      slot,
      code: assignmentForBinding(bindings[button]),
    }));
    const unsupported = planned.filter((item) => item.code === null);
    if (unsupported.length > 0) {
      throw new Error(
        `以下按键尚未映射到官方协议代码，未写入任何数据：${unsupported
          .map((item) => BUTTON_META[item.button].label)
          .join('、')}`,
      );
    }

    await this.enterConfig();

    let headerRead: { data: Uint8Array; traces: CommandTrace[] };
    let keymapRead: { data: Uint8Array; traces: CommandTrace[] };
    let header: DeviceHeader;

    try {
      headerRead = await this.readChunks(COMMAND.readHeader, HEADER_LENGTH);
      header = parseHeader(headerRead.data);
      if (header.keyCount < 5 || header.keyCount > MAX_KEYS) {
        throw new Error(`设备按键数量异常（${header.keyCount}），已取消写入。`);
      }
      keymapRead = await this.readChunks(COMMAND.readKeymap, header.keyCount * 3);
    } catch (error) {
      try {
        await this.commit();
      } catch {
        // 尚未写入任何数据，尝试正常退出配置模式。
      }
      throw error;
    }

    const before = keymapRead.data.slice();
    const after = before.slice();
    for (const item of planned) setAssignment(after, item.slot, item.code as number);

    const changedSlots = planned
      .filter((item) => assignmentAt(before, item.slot) !== item.code)
      .map((item) => item.slot);

    let traces: CommandTrace[];
    try {
      traces = await this.writeChunks(COMMAND.writeKeymap, after);
    } catch (error) {
      throw new Error(
        `写入过程中断：${errorMessage(error)}。为避免提交不完整数据，已停止发送；请拔下并重新连接鼠标后重试。`,
      );
    }

    let commit: CommandTrace;
    try {
      commit = await this.commit();
    } catch (error) {
      throw new Error(
        `按键数据已发送，但提交命令失败：${errorMessage(
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
    if (verification?.keymap) {
      verified = planned.every(
        (item) => assignmentAt(verification!.keymap!.raw, item.slot) === item.code,
      );
    }

    return {
      header: {
        raw: headerRead.data,
        parsed: header,
      },
      before,
      after,
      changedSlots,
      traces,
      commit,
      verification,
      verificationError,
      verified,
    };
  }
}
