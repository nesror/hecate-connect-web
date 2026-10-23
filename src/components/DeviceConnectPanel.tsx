import { AlertTriangle, Info, RefreshCw, Usb } from 'lucide-react';
import type { MouseController } from '../hid/useMouseDevice';
import { Modal } from './ui';

interface DeviceConnectPanelProps {
  open: boolean;
  onClose: () => void;
  device: MouseController;
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
      detail: '请在 HID 设备列表中选择 HECATE 鼠标或 Rapoo 接收器。',
    };
  }
  if (device.phase === 'connecting') {
    return {
      tone: 'is-busy',
      title: '正在打开设备',
      detail:
        device.family === 'rapoo'
          ? '正在打开 Rapoo 接收器并发送探测与解锁帧。'
          : '正在建立 WebHID 连接并读取设备头。',
    };
  }
  if (device.phase === 'error') {
    return {
      tone: 'is-error',
      title: '连接异常',
      detail: device.error ?? '设备握手失败。请确认官方驱动没有占用设备，然后重试。',
    };
  }
  return {
    tone: 'is-offline',
    title: '连接你的鼠标',
    detail: '支持 HECATE G3M PRO 与 Rapoo VT9PRO 2.4G 接收器，两种设备可分别在同一个网页中连接。',
  };
}

export function DeviceConnectPanel({ open, onClose, device }: DeviceConnectPanelProps) {
  const status = statusCopy(device);
  const pending = device.phase === 'requesting' || device.phase === 'connecting';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="设备连接"
      description="通过 WebHID 连接已支持的鼠标。同一时间只会打开一个设备。"
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
            <button
              type="button"
              className="primary-button small"
              disabled={device.phase === 'unsupported' || pending || device.busy}
              onClick={() => void device.connect()}
            >
              {pending ? <RefreshCw size={14} className="is-spinning" /> : <Usb size={14} />}
              {pending ? '连接中…' : '连接设备'}
            </button>
          </div>
        </div>

        {device.error && (
          <div className="inline-note is-warning">
            <AlertTriangle size={15} />
            {device.error}
          </div>
        )}

        <div className="device-info-grid">
          <div className="device-info-item">
            <span>HECATE G3M PRO</span>
            <strong>读取 + 写入 + 回读验证</strong>
          </div>
          <div className="device-info-item">
            <span>Rapoo VT9PRO</span>
            <strong>仅发送 · 无法回读（实验性）</strong>
          </div>
          <div className="device-info-item">
            <span>HECATE 连接方式</span>
            <strong>USB 数据线或 2.4G 接收器</strong>
          </div>
          <div className="device-info-item">
            <span>Rapoo 连接方式</span>
            <strong>2.4G 接收器 · VID 24AE</strong>
          </div>
        </div>

        <ol className="device-guide">
          <li>
            <span>01</span>
            <div>
              <strong>准备设备</strong>
              <p>
                HECATE 建议使用 USB 数据线连接；Rapoo 请插入 2.4G 接收器并打开鼠标。两种设备都需要保持开机。
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>关闭官方桌面驱动</strong>
              <p>先退出 HECATE Connect 或 RapooGameDev，避免两个程序同时占用同一个 HID 设备。</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>在浏览器中选择设备</strong>
              <p>
                点击“连接设备”，在 HID 列表中选择鼠标。Rapoo 接收器通常显示为 “Rapoo Gaming
                Device”（VID 24AE · Usage FF00:000E）。
              </p>
            </div>
          </li>
        </ol>

        {device.grantedCount > 0 && !pending && (
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

        <div className="inline-note is-warning">
          <AlertTriangle size={15} />
          <div>
            Rapoo 接收器只提供写入报告通道，浏览器无法读取它的板载配置。Rapoo 写入属于实验性功能，发送后无法确认是否生效；
            HECATE G3M PRO 仍会在写入后自动回读验证。
          </div>
        </div>

        <div className="inline-note">
          <Info size={15} />
          未连接时所有页面仍可编辑配置。设置会自动保存到本机浏览器，只有连接设备并确认后才会写入或发送到硬件。
        </div>
      </div>
    </Modal>
  );
}
