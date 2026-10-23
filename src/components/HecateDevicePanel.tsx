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
import { bindingLabel, BUTTON_META } from '../functions';
import type { MouseController } from '../hid/useMouseDevice';
import type { CommandTrace, WriteResult } from '../hid/HecateHid';
import type { DeviceSettings } from '../hid/profileCodec';
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

interface HecateDevicePanelProps {
  open: boolean;
  onClose: () => void;
  device: MouseController;
  profile: Profile;
  onApplyBindings: (bindings: Record<ButtonId, Binding>) => void;
  onApplyDeviceSettings: (settings: DeviceSettings) => void;
  notify: (toast: Omit<ToastMessage, 'id'>) => void;
}

function byteHex(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;
}

function traceTone(trace: CommandTrace | null | undefined): string {
  if (!trace) return 'is-muted';
  return isErrorStatus(trace.status) ? 'is-bad' : 'is-ok';
}

function statusCopy(device: MouseController): {
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
          : '按键表、DPI 与性能配置已通过 WebHID 读取；写入操作需要你勾选确认后才会执行。',
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
    detail: '网页会先读取设备头、按键表与配置块，只有在你确认后才会写入按键、DPI 与性能设置。',
  };
}

export function HecateDevicePanel({
  open,
  onClose,
  device,
  profile,
  onApplyBindings,
  onApplyDeviceSettings,
  notify,
}: HecateDevicePanelProps) {
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
  const profileProbe = device.probe?.profile ?? null;
  const settings = profileProbe?.settings ?? null;
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
  const canReadBindings = connected && deviceBindings !== null && !device.busy;
  const canReadSettings = connected && profileProbe !== null && !device.busy;
  const canWrite = connected && keymap !== null && confirmed && !device.busy;

  const handleReadBindings = () => {
    if (!deviceBindings) return;
    const next = { ...profile.bindings };
    let read = 0;
    for (const { button } of BUTTON_SLOTS) {
      const binding = deviceBindings[button];
      if (!binding) continue;
      next[button] = binding;
      read += 1;
    }
    onApplyBindings(next);
    notify({
      tone: read > 0 ? 'success' : 'error',
      title: read > 0 ? '已从鼠标读取按键' : '未能识别设备按键',
      detail:
        read > 0
          ? `${read} 个按键已读取${read < BUTTON_SLOTS.length ? '，其余保留当前配置' : ''}，设置会保存到本机浏览器。`
          : '设备返回的按键代码不在已解析的协议表中。',
    });
  };

  const handleReadSettings = () => {
    if (!profileProbe) return;
    onApplyDeviceSettings(profileProbe.settings);
    notify({
      tone: 'success',
      title: '已读取 DPI 与性能设置',
      detail: 'DPI 档位、档位颜色、回报率、LOD、去抖与传感器修正已同步到当前配置。',
    });
  };

  const handleWrite = async () => {
    if (!canWrite) return;
    try {
      const sections = profileProbe
        ? { bindings: true, dpi: true, performance: true }
        : { bindings: true, dpi: false, performance: false };
      const outcome = await device.writeProfile(profile, sections);
      if (outcome.family !== 'hecate') return;
      const result = outcome.hecate;
      setLastWrite(result);
      setConfirmed(false);
      const skipped = result.keymap?.skipped.length ?? 0;
      notify({
        tone: result.verified === true ? 'success' : 'info',
        title:
          result.verified === true
            ? profileProbe
              ? '按键、DPI 与性能已写入并验证'
              : '按键已写入并验证'
            : '写入流程结束',
        detail:
          result.verified === true
            ? skipped > 0
              ? `设备回读一致；${skipped} 个宏或未映射按键保留了设备原功能。`
              : profileProbe
                ? '设备回读值与目标一致。'
                : '设备回读值与目标一致；本次未写入 DPI 与性能配置块。'
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
        ...(device.probe.profile?.traces ?? []),
        ...(device.probe.commit ? [device.probe.commit] : []),
      ].some((trace) => !trace.checksumValid),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="设备连接"
      description="通过 WebHID 读取和写入 HECATE G3M PRO 的按键、DPI、回报率与传感器设置。"
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
              <span
                className={`device-chip ${
                  device.probe.profile
                    ? traceTone(device.probe.profile.traces.at(-1))
                    : 'is-muted'
                }`}
              >
                配置块 0x05 ·{' '}
                {device.probe.profile ? `${device.probe.profile.raw.length} B` : '未读取'}
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
              <summary>查看设备头、按键表与配置块原始数据</summary>
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
              {device.probe.profile && (
                <div className="device-raw-block">
                  <span>
                    PROFILE #{device.probe.profile.index + 1} ·{' '}
                    {device.probe.profile.raw.length} BYTES
                  </span>
                  <code>{formatHex(device.probe.profile.raw)}</code>
                </div>
              )}
            </details>
          </div>
        )}

        {connected && settings && (
          <>
            <div className="device-info-grid">
              <div className="device-info-item">
                <span>配置文件</span>
                <strong>
                  #{profileProbe!.index + 1} ·{' '}
                  {settings.dpi.stages.filter((stage) => stage.enabled).length} / 7 档启用
                </strong>
              </div>
              <div className="device-info-item">
                <span>当前 DPI</span>
                <strong>
                  档位 {settings.dpi.activeStage + 1} ·{' '}
                  {settings.dpi.stages[settings.dpi.activeStage]?.dpiX.toLocaleString('en-US')} DPI
                </strong>
              </div>
              <div className="device-info-item">
                <span>回报率</span>
                <strong>{settings.pollingRate.toLocaleString('en-US')} Hz</strong>
              </div>
              <div className="device-info-item">
                <span>LOD / 去抖</span>
                <strong>
                  {settings.sensorHeight} mm · {settings.buttonDelay} ms
                </strong>
              </div>
              <div className="device-info-item">
                <span>传感器修正</span>
                <strong>
                  {settings.lineCorrection || settings.rippleCorrection
                    ? [settings.lineCorrection && '直线', settings.rippleCorrection && '波纹']
                        .filter(Boolean)
                        .join(' + ')
                    : '原始输入'}
                </strong>
              </div>
            </div>
            <div className="device-actions">
              <button
                type="button"
                className="ghost-button small"
                disabled={!canReadSettings}
                onClick={handleReadSettings}
              >
                读取 DPI / 性能到当前配置
              </button>
            </div>
          </>
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
                disabled={!canReadBindings || device.busy}
                onClick={handleReadBindings}
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
                          <span className="device-row-note">
                            {row.binding.kind === 'macro' ? '宏 · 保留原功能' : '保留原功能'}
                          </span>
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
                  <strong>{profileProbe ? '写入按键、DPI 与性能设置' : '写入 6 个按键映射'}</strong>
                  <p>
                    写入槽位 0–5，其余 {Math.max(0, keyCount - 6)} 个设备按键槽位保持读取到的原值。
                    {profileProbe
                      ? ' 同时写入 84 字节板载配置块：DPI 档位与颜色、回报率、LOD、去抖与传感器修正。'
                      : ' 本次未读取到配置块，只写入按键映射。'}
                    写入后会重新读取设备进行回读验证。
                  </p>
                </div>
              </div>

              {unsupported.length > 0 && (
                <div className="inline-note is-warning">
                  <AlertTriangle size={15} />
                  <div>
                    以下按键使用宏或没有官方协议代码，写入时会保留设备上的原功能：
                    {unsupported.map((row) => ` ${BUTTON_META[row.button].label}`).join('、')}。
                  </div>
                </div>
              )}

              <label className="device-confirm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={device.busy}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  我确认要把当前配置写入鼠标板载配置。写入过程中请勿拔下鼠标。
                </span>
              </label>

              <button
                type="button"
                className="primary-button full"
                disabled={!canWrite}
                onClick={() => void handleWrite()}
              >
                {device.busy ? <RefreshCw size={15} className="is-spinning" /> : <Zap size={15} />}
                {device.busy
                  ? '正在与设备通信…'
                  : profileProbe
                    ? '写入按键、DPI 与性能'
                    : '写入按键映射'}
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
                    已发送 {lastWrite.traces.length} 个数据包并提交（0x02 状态{' '}
                    {byteHex(lastWrite.commit.status)}）。
                    {lastWrite.polling
                      ? ` 回报率已即时应用为 ${lastWrite.polling.rate} Hz。`
                      : ''}
                  </div>
                  {lastWrite.keymap && (
                    <div>
                      按键：
                      {lastWrite.keymap.changedSlots.length > 0
                        ? `变更槽位 ${lastWrite.keymap.changedSlots.join(', ')}`
                        : '无变化（与设备现有值一致）'}
                      。
                      {lastWrite.keymap.skipped.length > 0 &&
                        ` 保留设备原功能：${lastWrite.keymap.skipped
                          .map((item) => item.label)
                          .join('、')}。`}
                    </div>
                  )}
                  {lastWrite.block && (
                    <div>
                      配置块 #{lastWrite.block.index + 1}：
                      {lastWrite.block.changedOffsets.length > 0
                        ? `已更新 ${lastWrite.block.changedOffsets.length} 个字节`
                        : '无变化（与设备现有值一致）'}
                      。
                    </div>
                  )}
                  {lastWrite.warnings.length > 0 && <div>{lastWrite.warnings.join('；')}。</div>}
                  <div>
                    回读验证：
                    {lastWrite.verified === true
                      ? '一致'
                      : lastWrite.verified === false
                        ? '不一致，请重新连接后核对，避免重复写入'
                        : lastWrite.verificationError
                          ? `失败（${lastWrite.verificationError}）`
                          : '设备未返回可验证的数据'}
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
          协议来自对官方驱动的静态分析。可写入：6 个按键、DPI 档位与颜色、当前档位、回报率、LOD、去抖与直线/波纹修正。
          宏仍只保存在浏览器中，不会写入硬件。
        </div>
      </div>
    </Modal>
  );
}
