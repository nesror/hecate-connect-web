import {
  CheckCircle2,
  Download,
  Info,
  Menu,
  Upload,
} from 'lucide-react';
import { Brand } from './Brand';
import { formatDateTime } from '../utils';

interface TopBarProps {
  savedAt: string | null;
  onMenu: () => void;
  onExport: () => void;
  onImport: () => void;
  onAbout: () => void;
}

export function TopBar({ savedAt, onMenu, onExport, onImport, onAbout }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <button type="button" className="icon-button ghost mobile-menu" onClick={onMenu} aria-label="打开菜单">
          <Menu size={20} />
        </button>
        <Brand />
      </div>
      <div className="topbar-actions">
        <div className="connection-pill" title="当前未检测到鼠标，页面处于离线配置模式">
          <span className="status-dot is-offline" />
          <span className="connection-name">G3M PRO</span>
          <span className="connection-state">未连接</span>
        </div>
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
