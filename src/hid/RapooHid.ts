import { BUTTON_META } from '../functions';
import type { Profile } from '../types';
import { describeHidDevice, type HidDescriptor } from './descriptor';
import {
  buildRapooPlan,
  probeFrame,
  RAPOO_REPORT_DATA_LENGTH,
  RAPOO_REPORT_ID,
  unlockFrame,
  writeFrame,
  type RapooButtonWrite,
  type RapooDpiWrite,
  type RapooPerformanceWrite,
  type RapooPlan,
  type RapooWriteSections,
} from './rapooProtocol';

const COMMAND_GAP_MS = 14;
const HANDSHAKE_GAP_MS = 40;

export interface RapooSession {
  reportId: number;
  openedAt: string;
  probeFrames: number;
}

export interface RapooProbe {
  reportId: number;
  probeFrames: number;
  probedAt: string;
}

export interface RapooWriteResult {
  family: 'rapoo';
  verified: null;
  verificationError: null;
  reportId: number;
  frames: number;
  dpi: RapooDpiWrite | null;
  performance: RapooPerformanceWrite | null;
  buttons: RapooButtonWrite[];
  warnings: string[];
  sentAt: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.name && error.name !== 'Error' ? `${error.name}: ${error.message}` : error.message;
  }
  return String(error);
}

function isLengthError(error: unknown): boolean {
  return /length|size|长度|大小/i.test(errorMessage(error));
}

export class RapooHid {
  readonly device: HIDDevice;
  readonly reportId: number;

  private reportDataLength = RAPOO_REPORT_DATA_LENGTH;

  constructor(device: HIDDevice, reportId = RAPOO_REPORT_ID) {
    this.device = device;
    this.reportId = reportId;
  }

  get descriptor(): HidDescriptor {
    return describeHidDevice(this.device);
  }

  async open(): Promise<RapooSession> {
    if (!this.device.opened) await this.device.open();

    await this.send(probeFrame());
    await delay(HANDSHAKE_GAP_MS);
    await this.send(unlockFrame());
    await delay(HANDSHAKE_GAP_MS);

    return {
      reportId: this.reportId,
      openedAt: new Date().toISOString(),
      probeFrames: 2,
    };
  }

  async close(): Promise<void> {
    if (!this.device.opened) return;
    try {
      await this.device.close();
    } catch {
      // 设备可能已经拔出，关闭失败不需要继续抛错。
    }
  }

  async probe(): Promise<RapooProbe> {
    await this.send(probeFrame());
    await delay(HANDSHAKE_GAP_MS);
    await this.send(unlockFrame());
    await delay(HANDSHAKE_GAP_MS);
    return {
      reportId: this.reportId,
      probeFrames: 2,
      probedAt: new Date().toISOString(),
    };
  }

  async writeProfile(
    profile: Profile,
    sections: RapooWriteSections = { bindings: true, dpi: true, performance: true },
  ): Promise<RapooWriteResult> {
    if (!this.device.opened) throw new Error('Rapoo 接收器尚未打开');
    if (!sections.bindings && !sections.dpi && !sections.performance) {
      throw new Error('没有选择要写入的设置。');
    }

    const plan: RapooPlan = buildRapooPlan(profile, sections, BUTTON_META);

    if (plan.commands.length === 0) {
      return {
        family: 'rapoo',
        verified: null,
        verificationError: null,
        reportId: this.reportId,
        frames: 0,
        dpi: plan.dpi,
        performance: plan.performance,
        buttons: plan.buttons,
        warnings: [
          '当前配置中没有可通过 Rapoo 协议写入的按键；宏、系统动作与 DPI +/− 仍保留设备原值。',
        ],
        sentAt: new Date().toISOString(),
      };
    }

    await this.send(unlockFrame());
    await delay(HANDSHAKE_GAP_MS);

    let sent = 0;
    try {
      for (const command of plan.commands) {
        const frame = writeFrame(command.bank, command.addr, command.data);
        await this.send(frame);
        sent += 1;
        await delay(COMMAND_GAP_MS);
      }
    } catch (error) {
      throw new Error(
        `发送“${
          plan.commands[sent]?.label ?? '配置帧'
        }”失败：${errorMessage(error)}。已发送 ${sent} / ${plan.commands.length} 个配置帧；浏览器无法回读，请重新连接后核对。`,
      );
    }

    const skipped = plan.buttons.filter((item) => !item.written);
    const warnings = [
      'Rapoo 接收器没有浏览器可读的配置回读通道，以上帧仅确认已交给浏览器发送，无法确认设备是否接受。',
    ];
    if (skipped.length > 0) {
      warnings.push(
        `${skipped.length} 个按键未写入，设备上对应按键保持原值：${skipped
          .map((item) => `${item.label}（${item.reason}）`)
          .join('；')}。`,
      );
    }
    warnings.push(
      'Rapoo 地址与编码来自公开逆向资料和官方驱动静态分析，尚未在 VT9PRO 上逐项验证；若设置异常，请退出本页面并使用官方驱动恢复。',
    );

    return {
      family: 'rapoo',
      verified: null,
      verificationError: null,
      reportId: this.reportId,
      frames: sent,
      dpi: plan.dpi,
      performance: plan.performance,
      buttons: plan.buttons,
      warnings,
      sentAt: new Date().toISOString(),
    };
  }

  private async send(frame: Uint8Array): Promise<void> {
    if (!this.device.opened) throw new Error('Rapoo 接收器尚未打开');
    try {
      await this.device.sendReport(this.reportId, frame);
    } catch (error) {
      if (frame.byteLength !== this.reportDataLength || !isLengthError(error)) throw error;
      const padded = new Uint8Array(this.reportDataLength + 1);
      padded.set(frame);
      await this.device.sendReport(this.reportId, padded);
      this.reportDataLength += 1;
    }
  }
}
