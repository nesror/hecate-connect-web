import {
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  ShieldCheck,
  Usb,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  bindingLabel,
  BUTTON_META,
} from '../functions';
import type { HecateController } from '../hid/useHecateDevice';
import type { CommandTrace, WriteResult } from '../hid/HecateHid';
import {
  assignmentAt,
  assignmentForBinding,
  bindingForAssignment,
  bindingsFromKeymap,
  BUTTON_SLOTS,
  formatCode,
  formatHex,
  HANDSHAKE_READY,
  isErrorStatus,
} from '../hid/protocol';
import type { Binding, ButtonId, Profile, ToastMessage } from '../types';
import { Modal } from './ui';

interface DeviceModalProps {
  open: boolean;
  onClose: () => void;
  device: HecateController;
  profile: Profile;
  onApplyBindings: (bindings: Record<ButtonId, Binding>) => void;
  notify: (toast: Omit<ToastMessage, 'id'>) => void;
}

function byteHex(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;
}

function traceTone(trace: CommandTrace | null | undefined): string {
  if (!trace) return 'is-muted';
  return isErrorStatus(trace.status) ? 'is-bad' : 'is-ok';
}

function statusCopy(device: HecateController): {
  tone: string;
  title: string;
  detail: string;
} {
  if (device.phase === 'unsupported') {
    return {
      tone: 'is-offline',
      title: '当前浏览器不支持 WebHID',
      detail: '请使用桌面版 Chrome 或 Edge，通过 HTTPS 或 localhost 打开本页面。Safari 与 Firefox 暂不支持。',
    };
  }
  if (device.phase === 'requesting') {
    return {
      tone: 'is-busy',
      title: '正在选择设备',
      detail: '请在浏览器弹出的 HID 设备列表中选择 HECATE 鼠标。',
    };
  }
  if (device.phase === 'connecting') {
    return {
      tone: 'is-busy',
      title: '正在打开设备',
      detail: '正在建立 WebHID 连接，并执行进入配置模式与读取设备头的握手。',
    };
  }
  if (device.phase === 'connected') {
    const warnings = device.probe?.warnings.length ?? 0;
    return {
      tone: warnings > 0 ? 'is-warn' : 'is-online',
      title: device.busy ? '正在与设备通信' : warnings > 0 ? '硬件已连接 · 有警告' : '硬件已连接 · 握手成功',
      detail:
        warnings > 0
          ? `已读取设备数据，但存在 ${warnings} 条警告。请在下方诊断信息中确认。`
          : '按键表已通过 WebHID 读取；写入操作需要你勾选确认后才会执行。',
    };
  }
  if (device.phase === 'error') {
    return {
      tone: 'is-error',
      title: '连接异常',
      detail: device.error ?? '设备握手失败。请确认鼠标未被官方驱动占用，然后重试。',
    };
  }
  return {
    tone: 'is-offline',
    title: '尚未连接鼠标',
    detail: '网页会先读取设备头与按键表，只有在你确认后才会写入 5 个按键映射。',
  };
}

export function DeviceModal({
  open,
  onClose,
  device,
  profile,
  onApplyBindings,
  notify,
}: DeviceModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [lastWrite, setLastWrite] = useState<WriteResult | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmed(false);
      setLastWrite(null);
    }
  }, [open]);

  const connected = device.phase === 'connected';
  const keymap = device.probe?.keymap?.raw ?? null;
  const keyCount = device.probe?.header.parsed.keyCount ?? 0;
  const status = statusCopy(device);
  const canRetry = device.phase === 'error' && device.descriptor !== null;

  const rows = BUTTON_SLOTS.map(({ button, slot }) => {
    const binding = profile.bindings[button];
    const desiredCode = assignmentForBinding(binding);
    const currentCode = keymap ? assignmentAt(keymap, slot) : null;
    const currentBinding = currentCode === null ? null : bindingForAssignment(currentCode);
    return { button, slot, binding, desiredCode, currentCode, currentBinding };
  });
  const unsupported = rows.filter((row) => row.desiredCode === null);

  const deviceBindings = keymap ? bindingsFromKeymap(keymap) : null;
  const canRead =
    connected &&
    deviceBindings !== null &&
    BUTTON_SLOTS.every(({ button }) => deviceBindings[button] !== null);
  const canWrite =
    connected &&
    keymap !== null &&
    unsupported.length === 0 &&
    confirmed &&
    !device.busy;

  const handleRead = () => {
    if (!deviceBindings) return;
    const next = {} as Record<ButtonId, Binding>;
    for (const { button } of BUTTON_SLOTS) {
      const binding = deviceBindings[button];
      if (!binding) return;
      next[button] = binding;
    }
    onApplyBindings(next);
    notify({
      tone: 'success',
      title: '已从鼠标读取按键',
      detail: '当前配置的 5 个按键已更新，设置会保存到本机浏览器。',
    });
  };

  const handleWrite = async () => {
    if (!canWrite) return;
    try {
      const result = await device.writeBindings(profile.bindings);
      setLastWrite(result);
      setConfirmed(false);
      notify({
        tone: result.verified === true ? 'success' : 'info',
        title: result.verified === true ? '按键已写入并验证' : '按键写入流程结束',
        detail:
          result.verified === true
            ? '设备回读值与目标一致。'
            : result.verified === false
              ? '写入命令完成，但回读值与目标不一致，请重新连接后核对。'
              : '写入命令已完成，但未能回读验证。',
      });
    } catch (error) {
      setLastWrite(null);
      notify({
        tone: 'error',
        title: '写入失败',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const anyChecksumMismatch = Boolean(
    device.probe &&
      [
        device.probe.handshake,
        device.probe.enter,
        ...device.probe.header.traces,
        ...(device.probe.keymap?.traces ?? []),
        ...(device.probe.commit ? [device.probe.commit] : []),
      ].some((trace) => !trace.checksumValid),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="设备连接"
      description="通过 WebHID 读取和写入 HECATE G3M PRO 的按键映射。"
      size="wide"
    >
      <div className="device-panel">
        <div className={`device-hero ${status.tone}`}>
          <span className="device-hero-icon">
            <Usb size={20} />
          </span>
          <div className="device-hero-copy">
            <strong>{status.title}</strong>
            <p>{status.detail}</p>
          </div>
          <div className="device-hero-actions">
            {connected || canRetry ? (
              <>
                {canRetry && (
                  <button
                    type="button"
                    className="outline-button small"
                    disabled={device.busy}
                    onClick={() => void device.refresh()}
                  >
                    <RefreshCw size={14} />
                    重试握手
                  </button>
                )}
                <button
                  type="button"
                  className="ghost-button small"
                  disabled={device.busy}
                  onClick={() => void device.disconnect()}
                >
                  断开
                </button>
              </>
            ) : (
              <button
                type="button"
                className="primary-button small"
                disabled={device.phase === 'unsupported' || device.busy}
                onClick={() => void device.connect()}
              >
                连接鼠标
              </button>
            )}
          </div>
        </div>

        {device.phase === 'error' && device.error && (
          <div className="inline-note is-warning">
            <AlertTriangle size={15} />
            {device.error}
          </div>
        )}

        {connected && device.error && (
          <div className="inline-note is-warning">
            <AlertTriangle size={15} />
            {device.error}
          </div>
        )}

        {!connected && (
          <>
            <ol className="device-guide">
              <li>
                <span>01</span>
                <div>
                  <strong>使用数据线连接鼠标</strong>
                  <p>建议切换到有线模式并保持开机，优先使用 USB-C 数据线而非仅充电线。</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>关闭官方桌面驱动</strong>
                  <p>退出 HECATE Connect，避免两个程序同时占用同一个 HID 设备。</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>在浏览器中选择设备</strong>
                  <p>点击「连接鼠标」，在 HID 设备列表中选择鼠标；首次连接需要授权。</p>
                </div>
              </li>
            </ol>

            {device.grantedCount > 0 && device.phase !== 'connecting' && device.phase !== 'requesting' && (
              <div className="device-actions">
                <button
                  type="button"
                  className="ghost-button small"
                  disabled={device.busy}
                  onClick={() => void device.connectGranted()}
                >
                  使用已授权设备（{device.grantedCount}）
                </button>
              </div>
            )}
          </>
        )}

        {device.descriptor && (
          <div className="device-info-grid">
            <div className="device-info-item">
              <span>设备</span>
              <strong>
                {device.descriptor.manufacturerName || '未知厂商'} ·{' '}
                {device.descriptor.productName || 'HID 设备'}
              </strong>
            </div>
            <div className="device-info-item">
              <span>VID / PID</span>
              <strong>
                0x{device.descriptor.vendorId.toString(16).toUpperCase().padStart(4, '0')} / 0x
                {device.descriptor.productId.toString(16).toUpperCase().padStart(4, '0')}
              </strong>
            </div>
            <div className="device-info-item">
              <span>输入报告 ID</span>
              <strong>{device.descriptor.inputReportIds.join(', ') || '—'}</strong>
            </div>
            <div className="device-info-item">
              <span>输出报告 ID</span>
              <strong>{device.descriptor.outputReportIds.join(', ') || '—'}</strong>
            </div>
            <div className="device-info-item">
              <span>HID 集合</span>
              <strong>{device.descriptor.collections.length} 个</strong>
            </div>
            <div className="device-info-item">
              <span>序列号</span>
              <strong>{device.descriptor.serialNumber || '—'}</strong>
            </div>
          </div>
        )}

        {device.probe && (
          <div className="device-diagnostics">
            <div className="device-diagnostics-head">
              <span className="section-kicker">PROTOCOL TRACE</span>
              <span>{new Date(device.probe.probedAt).toLocaleTimeString()}</span>
            </div>
            <div className="device-traces">
              <span
                className={`device-chip ${
                  device.probe.handshake.status === HANDSHAKE_READY ? 'is-ok' : 'is-bad'
                }`}
              >
                握手 0xAA · {byteHex(device.probe.handshake.status)}
              </span>
              <span className={`device-chip ${traceTone(device.probe.enter)}`}>
                进入配置 0x01 · {byteHex(device.probe.enter.status)}
              </span>
              <span className={`device-chip ${traceTone(device.probe.header.traces.at(-1))}`}>
                设备头 0x03 · {device.probe.header.raw.length} B · {keyCount} 键
              </span>
              <span
                className={`device-chip ${
                  device.probe.keymap
                    ? traceTone(device.probe.keymap.traces.at(-1))
                    : 'is-muted'
                }`}
              >
                按键表 0x07 · {device.probe.keymap ? `${device.probe.keymap.raw.length} B` : '未读取'}
              </span>
              <span className={`device-chip ${traceTone(device.probe.commit)}`}>
                提交 0x02 · {device.probe.commit ? byteHex(device.probe.commit.status) : '未确认'}
              </span>
              {anyChecksumMismatch && (
                <span className="device-chip is-warn">响应校验和不匹配</span>
              )}
            </div>

            {device.probe.warnings.length > 0 && (
              <div className="inline-note is-warning">
                <AlertTriangle size={15} />
                <div>
                  {device.probe.warnings.map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              </div>
            )}

            <details className="device-raw">
              <summary>查看设备头与按键表原始数据</summary>
              <div className="device-raw-block">
                <span>HEADER · {device.probe.header.raw.length} BYTES</span>
                <code>{formatHex(device.probe.header.raw)}</code>
              </div>
              {device.probe.keymap && (
                <div className="device-raw-block">
                  <span>KEYMAP · {device.probe.keymap.raw.length} BYTES</span>
                  <code>{formatHex(device.probe.keymap.raw)}</code>
                </div>
              )}
            </details>
          </div>
        )}

        {connected && keymap && (
          <>
            <div className="device-actions">
              <button
                type="button"
                className="outline-button small"
                disabled={device.busy}
                onClick={() => void device.refresh()}
              >
                <RefreshCw size={14} />
                重新读取设备
              </button>
              <button
                type="button"
                className="ghost-button small"
                disabled={!canRead || device.busy}
                onClick={handleRead}
              >
                从设备读取到当前配置
              </button>
            </div>

            <div className="device-table-wrap">
              <table className="device-table">
                <thead>
                  <tr>
                    <th>按键</th>
                    <th>槽位</th>
                    <th>设备当前</th>
                    <th>当前配置</th>
                    <th>写入后</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.button}>
                      <td>{BUTTON_META[row.button].label}</td>
                      <td>
                        <code>{row.slot}</code>
                      </td>
                      <td>
                        <code>{row.currentCode === null ? '—' : formatCode(row.currentCode)}</code>
                        <small>
                          {row.currentBinding
                            ? bindingLabel(row.currentBinding, [])
                            : row.currentCode === null
                              ? '未读取'
                              : '未识别功能'}
                        </small>
                      </td>
                      <td>
                        <code>{row.desiredCode === null ? '—' : formatCode(row.desiredCode)}</code>
                        <small>{bindingLabel(row.binding, profile.macros)}</small>
                      </td>
                      <td>
                        {row.desiredCode === null ? (
                          <span className="device-row-note">不支持写入</span>
                        ) : row.currentCode === row.desiredCode ? (
                          <span className="device-row-muted">不变</span>
                        ) : (
                          <span className="device-row-change">变更</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="device-write-box">
              <div className="device-write-head">
                <ShieldCheck size={17} />
                <div>
                  <strong>写入 5 个按键映射</strong>
                  <p>
                    写入槽位 0–4，其余 {Math.max(0, keyCount - 5)} 个设备按键槽位保持读取到的原值。
                    写入后会重新读取设备进行回读验证。
                  </p>
                </div>
              </div>

              {unsupported.length > 0 && (
                <div className="inline-note is-warning">
                  <AlertTriangle size={15} />
                  <div>
                    以下按键尚未映射到官方协议代码，写入会整体取消：
                    {unsupported.map((row) => ` ${BUTTON_META[row.button].label}`).join('、')}。
                  </div>
                </div>
              )}

              <label className="device-confirm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={device.busy || unsupported.length > 0}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  我确认要把当前配置中的 5 个按键映射写入鼠标板载配置。写入过程中请勿拔下鼠标。
                </span>
              </label>

              <button
                type="button"
                className="primary-button full"
                disabled={!canWrite}
                onClick={() => void handleWrite()}
              >
                {device.busy ? <RefreshCw size={15} className="is-spinning" /> : <Zap size={15} />}
                {device.busy ? '正在与设备通信…' : '写入按键映射'}
              </button>
            </div>

            {lastWrite && (
              <div
                className={`inline-note ${
                  lastWrite.verified === true ? '' : 'is-warning'
                }`}
              >
                {lastWrite.verified === true ? <CheckCircle2 size={15} /> : <Info size={15} />}
                <div>
                  <div>
                    已发送 {lastWrite.traces.length} 个数据块并提交（0x02 状态{' '}
                    {byteHex(lastWrite.commit.status)}）。
                  </div>
                  <div>
                    变更槽位：
                    {lastWrite.changedSlots.length > 0
                      ? lastWrite.changedSlots.join(', ')
                      : '无（与设备现有值一致）'}
                    。
                  </div>
                  <div>
                    回读验证：
                    {lastWrite.verified === true
                      ? '一致'
                      : lastWrite.verified === false
                        ? '不一致，请重新连接后核对，避免重复写入'
                        : lastWrite.verificationError
                          ? `失败（${lastWrite.verificationError}）`
                          : '设备未返回按键表'}
                    。
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!connected && device.descriptor && !device.probe && (
          <div className="device-empty">设备已打开，但尚未完成协议握手，无法读取按键表。</div>
        )}

        <details className="device-advanced">
          <summary>高级：协议报告 ID</summary>
          <div className="device-advanced-body">
            <label>
              报告 ID
              <input
                type="number"
                min={0}
                max={255}
                className="device-report-input"
                value={device.reportId}
                disabled={connected || device.phase === 'connecting' || device.phase === 'requesting'}
                onChange={(event) => device.setReportId(Number(event.target.value))}
              />
            </label>
            <span>官方驱动使用报告 ID 4。修改后需要断开并重新连接才能生效。</span>
          </div>
        </details>

        <div className="inline-note">
          <Info size={15} />
          协议来自对官方驱动的静态分析。目前只实现按键表读写；DPI、性能校准、灯效与宏仍只保存在浏览器中，不会写入硬件。
        </div>
      </div>
    </Modal>
  );
}
