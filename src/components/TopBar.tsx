import {
  CheckCircle2,
  Download,
  Info,
  Menu,
  Upload,
} from 'lucide-react';
import type { HidPhase } from '../hid/useHecateDevice';
import { Brand } from './Brand';
import { cx, formatDateTime } from '../utils';

interface TopBarProps {
  savedAt: string | null;
  devicePhase: HidPhase;
  deviceBusy: boolean;
  onOpenDevice: () => void;
  onMenu: () => void;
  onExport: () => void;
  onImport: () => void;
  onAbout: () => void;
}

function deviceStatus(phase: HidPhase, busy: boolean): { label: string; tone: string; title: string } {
  switch (phase) {
    case 'connected':
      return busy
        ? {
            label: '通信中',
            tone: 'is-busy',
            title: '正在通过 WebHID 与鼠标通信',
          }
        : {
            label: '已连接',
            tone: 'is-online',
            title: '鼠标已通过 WebHID 连接，点击查看设备详情',
          };
    case 'requesting':
    case 'connecting':
      return {
        label: '连接中',
        tone: 'is-busy',
        title: '正在等待浏览器授权或打开 HID 设备',
      };
    case 'error':
      return {
        label: '连接异常',
        tone: 'is-error',
        title: '设备连接异常，点击查看诊断信息',
      };
    case 'unsupported':
      return {
        label: '不支持',
        tone: 'is-error',
        title: '当前浏览器不支持 WebHID，请使用桌面版 Chrome 或 Edge',
      };
    default:
      return {
        label: '未连接',
        tone: 'is-offline',
        title: '当前未连接鼠标，页面处于离线配置模式',
      };
  }
}

export function TopBar({
  savedAt,
  devicePhase,
  deviceBusy,
  onOpenDevice,
  onMenu,
  onExport,
  onImport,
  onAbout,
}: TopBarProps) {
  const status = deviceStatus(devicePhase, deviceBusy);

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <button type="button" className="icon-button ghost mobile-menu" onClick={onMenu} aria-label="打开菜单">
          <Menu size={20} />
        </button>
        <Brand />
      </div>
      <div className="topbar-actions">
        <button
          type="button"
          className="connection-pill"
          onClick={onOpenDevice}
          title={status.title}
          aria-label={`设备连接：${status.label}`}
        >
          <span className={cx('status-dot', status.tone)} />
          <span className="connection-name">G3M PRO</span>
          <span className="connection-state">{status.label}</span>
        </button>
        <div className="save-chip" title="配置会自动保存到本机浏览器">
          <CheckCircle2 size={15} />
          <span>{savedAt ? '已自动保存' : '正在保存'}</span>
          {savedAt && <small>{formatDateTime(savedAt)}</small>}
        </div>
        <div className="topbar-divider" />
        <button type="button" className="ghost-button hide-on-small" onClick={onImport}>
          <Upload size={16} />
          <span>导入</span>
        </button>
        <button
          type="button"
          className="outline-button"
          onClick={onExport}
          aria-label="导出配置"
          title="导出配置"
        >
          <Download size={16} />
          <span>导出配置</span>
        </button>
        <button type="button" className="icon-button ghost" onClick={onAbout} aria-label="关于网页版" title="关于网页版">
          <Info size={18} />
        </button>
      </div>
    </header>
  );
}
