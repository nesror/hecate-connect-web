import {
  AlertTriangle,
  Info,
  RefreshCw,
  ShieldAlert,
  Usb,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { bindingKindLabel, bindingLabel, BUTTON_META } from '../functions';
import {
  buildRapooPlan,
  RAPOO_BANKS,
  RAPOO_REPORT_ID,
  type RapooWriteSections,
} from '../hid/rapooProtocol';
import type { MouseController, RapooWriteOutcome } from '../hid/useMouseDevice';
import type { Profile, ToastMessage } from '../types';
import { Modal } from './ui';

interface RapooDevicePanelProps {
  open: boolean;
  onClose: () => void;
  device: MouseController;
  profile: Profile;
  notify: (toast: Omit<ToastMessage, 'id'>) => void;
}

const ALL_SECTIONS: RapooWriteSections = {
  bindings: true,
  dpi: true,
  performance: true,
};

function byteHex(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;
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
      detail: '请在浏览器弹出的 HID 设备列表中选择 Rapoo 接收器（通常显示为 “Rapoo Gaming Device”）。',
    };
  }
  if (device.phase === 'connecting') {
    return {
      tone: 'is-busy',
      title: '正在打开接收器',
      detail: '正在打开 0xBA 输出报告并发送探测与解锁帧。',
    };
  }
  if (device.phase === 'connected') {
    return {
      tone: 'is-online',
      title: device.busy ? '正在与接收器通信' : 'Rapoo 接收器已连接 · 仅发送模式',
      detail:
        '输出报告 0xBA 可用。接收器没有浏览器可读的配置回读通道，发出的设置无法在网页中确认是否生效。',
    };
  }
  if (device.phase === 'error') {
    return {
      tone: 'is-error',
      title: '连接异常',
      detail: device.error ?? '接收器握手失败。请重新插拔接收器，并确认官方驱动没有占用设备。',
    };
  }
  return {
    tone: 'is-offline',
    title: '尚未连接 Rapoo 接收器',
    detail: '把 2.4G 接收器插入 USB 口并打开鼠标，然后点击“连接设备”。',
  };
}

export function RapooDevicePanel({
  open,
  onClose,
  device,
  profile,
  notify,
}: RapooDevicePanelProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<RapooWriteOutcome | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmed(false);
      setLastOutcome(null);
    }
  }, [open]);

  const plan = useMemo(() => buildRapooPlan(profile, ALL_SECTIONS, BUTTON_META), [profile]);
  const connected = device.phase === 'connected';
  const status = statusCopy(device);
  const canRetry = device.phase === 'error' && device.descriptor !== null;
  const skippedButtons = plan.buttons.filter((item) => !item.written);
  const activeDpi = plan.dpi ? plan.dpi.valuesX[plan.dpi.activeIndex] ?? 0 : 0;
  const canWrite = connected && confirmed && !device.busy && plan.commands.length > 0;

  const handleWrite = async () => {
    if (!canWrite) return;
    try {
      const outcome = await device.writeProfile(profile, ALL_SECTIONS);
      if (outcome.family !== 'rapoo') return;
      setLastOutcome(outcome);
      setConfirmed(false);
      const skipped = outcome.rapoo.buttons.filter((item) => !item.written).length;
      notify({
        tone: 'info',
        title: outcome.frames > 0 ? '配置帧已发送' : '没有可发送的配置帧',
        detail:
          outcome.frames > 0
            ? `已发送 ${outcome.frames} 个配置帧；浏览器无法回读确认。${
                skipped > 0 ? ` ${skipped} 个按键保留设备原值。` : ''
              }`
            : outcome.rapoo.warnings[0] ?? '当前配置没有可通过 Rapoo 协议发送的项。',
      });
    } catch (error) {
      setLastOutcome(null);
      notify({
        tone: 'error',
        title: '发送失败',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rapoo 设备连接"
      description="通过 WebHID 向 Rapoo VT9PRO 接收器发送按键、DPI 与性能配置。接收器不支持配置回读，写入属于实验性功能。"
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
                <button
                  type="button"
                  className="outline-button small"
                  disabled={device.busy}
                  onClick={() => void device.refresh()}
                >
                  <RefreshCw size={14} />
                  重发握手
                </button>
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
                连接设备
              </button>
            )}
          </div>
        </div>

        {device.error && (
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
                  <strong>插入 2.4G 接收器并打开鼠标</strong>
                  <p>将 Rapoo 接收器直接插入电脑 USB 口，确认鼠标处于 2.4G 无线模式并有电。</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>关闭官方 RapooGameDev</strong>
                  <p>官方驱动会同时打开接收器的厂商接口；请先完全退出，避免端口被占用。</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>在浏览器中选择接收器</strong>
                  <p>
                    点击“连接设备”，选择 “Rapoo Gaming Device”（VID 24AE · Usage FF00:000E）。
                  </p>
                </div>
              </li>
            </ol>

            {device.grantedCount > 0 &&
              device.phase !== 'connecting' &&
              device.phase !== 'requesting' && (
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
              <span>输出报告 ID</span>
              <strong>{byteHex(RAPOO_REPORT_ID)} · 31 字节数据</strong>
            </div>
            <div className="device-info-item">
              <span>特性报告</span>
              <strong>
                {device.descriptor.featureReportIds.length > 0
                  ? device.descriptor.featureReportIds.join(', ')
                  : '无'}
              </strong>
            </div>
            <div className="device-info-item">
              <span>配置回读</span>
              <strong>浏览器不可用</strong>
            </div>
            <div className="device-info-item">
              <span>序列号</span>
              <strong>{device.descriptor.serialNumber || '—'}</strong>
            </div>
          </div>
        )}

        {connected && device.rapooProbe && (
          <div className="device-diagnostics">
            <div className="device-diagnostics-head">
              <span className="section-kicker">HANDSHAKE</span>
              <span>{new Date(device.rapooProbe.probedAt).toLocaleTimeString()}</span>
            </div>
            <div className="device-traces">
              <span className="device-chip is-ok">探测 0xB0 · 已发送</span>
              <span className="device-chip is-ok">解锁 0xA5 A3 · 已发送</span>
              <span className="device-chip is-ok">输出报告 0xBA · 31 B</span>
              <span className="device-chip is-warn">配置回读 · 不可用</span>
            </div>
            <div className="inline-note is-warning">
              <AlertTriangle size={15} />
              <div>
                接收器不会向浏览器返回配置数据。这里的“已发送”只代表帧已交给 WebHID，不能证明设备已接受或保存。
              </div>
            </div>
          </div>
        )}

        {connected && plan.dpi && (
          <>
            <div className="device-info-grid">
              <div className="device-info-item">
                <span>DPI 档位</span>
                <strong>
                  {plan.dpi.count} 档启用 · 当前第 {plan.dpi.activeIndex + 1} 档
                </strong>
              </div>
              <div className="device-info-item">
                <span>当前 DPI</span>
                <strong>{activeDpi.toLocaleString('en-US')} DPI</strong>
              </div>
              <div className="device-info-item">
                <span>回报率</span>
                <strong>{profile.performance.pollingRate.toLocaleString('en-US')} Hz</strong>
              </div>
              <div className="device-info-item">
                <span>LOD / 去抖</span>
                <strong>
                  {profile.performance.sensorHeight} mm · {profile.performance.buttonDelay} ms
                </strong>
              </div>
              <div className="device-info-item">
                <span>传感器修正</span>
                <strong>
                  {profile.performance.lineCorrection || profile.performance.rippleCorrection
                    ? [
                        profile.performance.lineCorrection && '直线',
                        profile.performance.rippleCorrection && '波纹',
                      ]
                        .filter(Boolean)
                        .join(' + ')
                    : '原始输入'}
                </strong>
              </div>
              <div className="device-info-item">
                <span>档位颜色</span>
                <strong>不写入（协议未确认）</strong>
              </div>
            </div>
            <div className="inline-note">
              <Info size={15} />
              DPI 只会发送已启用档位的 X/Y 数值与当前档位；档位颜色仅保存在本机配置。
            </div>
          </>
        )}

        {connected && (
          <>
            <div className="device-table-wrap">
              <table className="device-table">
                <thead>
                  <tr>
                    <th>按键</th>
                    <th>当前配置</th>
                    <th>发送能力</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.buttons.map((item) => {
                    const binding = profile.bindings[item.button];
                    return (
                      <tr key={item.button}>
                        <td>{BUTTON_META[item.button].label}</td>
                        <td>
                          <code>{bindingLabel(binding, profile.macros)}</code>
                          <small>{bindingKindLabel(binding)}</small>
                        </td>
                        <td>
                          <span className="device-row-note">
                            {item.written ? '发送 Rapoo 动作代码' : '保留设备原值'}
                          </span>
                          {!item.written && item.reason && <small>{item.reason}</small>}
                        </td>
                        <td>
                          {item.written ? (
                            <span className="device-row-change">可发送</span>
                          ) : (
                            <span className="device-row-muted">跳过</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="device-write-box">
              <div className="device-write-head">
                <ShieldAlert size={17} />
                <div>
                  <strong>发送按键、DPI 与性能设置</strong>
                  <p>
                    将 {plan.commands.length} 个配置帧发送到接收器：{plan.dpi?.count ?? 0} 档 DPI（不含颜色）、
                    回报率、LOD、去抖、传感器修正与 {plan.buttons.filter((item) => item.written).length}{' '}
                    个按键映射。Rapoo 接收器不支持回读，发送后无法确认设备是否接受。
                  </p>
                </div>
              </div>

              {skippedButtons.length > 0 && (
                <div className="inline-note is-warning">
                  <AlertTriangle size={15} />
                  <div>
                    以下按键没有确认的 Rapoo 动作代码，发送时保留设备原功能：
                    {skippedButtons.map((item) => ` ${item.label}`).join('、')}。
                  </div>
                </div>
              )}

              <label className="device-confirm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={device.busy || plan.commands.length === 0}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  我确认要把当前配置发送到 Rapoo 接收器。本操作无法回读验证，请勿在发送期间拔出接收器。
                </span>
              </label>

              <button
                type="button"
                className="primary-button full"
                disabled={!canWrite}
                onClick={() => void handleWrite()}
              >
                {device.busy ? <RefreshCw size={15} className="is-spinning" /> : <Zap size={15} />}
                {device.busy ? '正在发送配置帧…' : '发送配置到接收器'}
              </button>
            </div>

            {lastOutcome && (
              <div className="inline-note is-warning">
                <Info size={15} />
                <div>
                  <div>
                    已发送 {lastOutcome.frames} 个配置帧（输出报告 {byteHex(RAPOO_REPORT_ID)}）。
                    浏览器无法回读确认设备是否接受。
                  </div>
                  {lastOutcome.rapoo.dpi && (
                    <div>
                      DPI：{lastOutcome.rapoo.dpi.count} 档 · 当前第{' '}
                      {lastOutcome.rapoo.dpi.activeIndex + 1} 档 ·{' '}
                      {lastOutcome.rapoo.dpi.valuesX
                        .map((value) => value.toLocaleString('en-US'))
                        .join(' / ')}{' '}
                      DPI。
                    </div>
                  )}
                  <div>
                    按键：发送{' '}
                    {lastOutcome.rapoo.buttons.filter((item) => item.written).length} 个，保留{' '}
                    {lastOutcome.rapoo.buttons.filter((item) => !item.written).length} 个设备原值。
                  </div>
                  {lastOutcome.warnings.map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <details className="device-advanced">
          <summary>高级：Rapoo 协议信息</summary>
          <div className="device-advanced-body">
            <span>
              输出报告 ID {byteHex(RAPOO_REPORT_ID)}；配置集合 Usage FF00:000E；无特性报告。写入帧为 A5 A5 +
              长度 + 地址 + Bank + 数据，使用系统 Bank {byteHex(RAPOO_BANKS.system)}、按键 Bank{' '}
              {byteHex(RAPOO_BANKS.button)}。协议地址来自公开逆向资料与官方驱动静态分析，尚未在 VT9PRO
              上逐项验证。
            </span>
          </div>
        </details>

        <div className="inline-note is-warning">
          <AlertTriangle size={15} />
          <div>
            Rapoo 支持属于实验性功能，只能发送配置、无法回读验证。宏、系统电源动作与 DPI +/− 不会写入接收器；
            如果设置后行为异常，请退出本页面，使用官方 RapooGameDev 或接收器重置方式恢复。
          </div>
        </div>
      </div>
    </Modal>
  );
}
