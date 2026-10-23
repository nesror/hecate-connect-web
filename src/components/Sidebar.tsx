import {
  Check,
  Copy,
  Crosshair,
  Download,
  Gauge,
  MoreHorizontal,
  Mouse,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Workflow,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BUTTON_ORDER } from '../functions';
import type { DeviceModelInfo } from '../hid/deviceModels';
import type { HidPhase } from '../hid/useMouseDevice';
import type { PageId, Profile } from '../types';
import { cx, formatDateTime } from '../utils';

interface SidebarProps {
  page: PageId;
  onNavigate: (page: PageId) => void;
  profiles: Profile[];
  activeId: string;
  onSelectProfile: (id: string) => void;
  onAddProfile: () => void;
  onRenameProfile: (profile: Profile) => void;
  onDuplicateProfile: (profile: Profile) => void;
  onDeleteProfile: (profile: Profile) => void;
  onExportProfile: (profile: Profile) => void;
  devicePhase: HidPhase;
  model: DeviceModelInfo;
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS: Array<{
  id: PageId;
  label: string;
  hint: string;
  icon: typeof Mouse;
}> = [
  { id: 'keys', label: '按键设定', hint: '6 键', icon: Mouse },
  { id: 'dpi', label: 'DPI 设置', hint: '7 档', icon: Crosshair },
  { id: 'performance', label: '性能与校准', hint: '', icon: Gauge },
  { id: 'macros', label: '宏管理', hint: '', icon: Workflow },
];

interface ProfileMenuState {
  id: string;
  top: number;
  left: number;
}

export function Sidebar({
  page,
  onNavigate,
  profiles,
  activeId,
  onSelectProfile,
  onAddProfile,
  onRenameProfile,
  onDuplicateProfile,
  onDeleteProfile,
  onExportProfile,
  devicePhase,
  model,
  open,
  onClose,
}: SidebarProps) {
  const [menu, setMenu] = useState<ProfileMenuState | null>(null);
  const activeProfile = profiles.find((profile) => profile.id === activeId);
  const menuProfile = menu ? profiles.find((profile) => profile.id === menu.id) : null;
  const deviceState =
    devicePhase === 'connected'
      ? model.verified
        ? { dot: 'is-online', label: '硬件已连接', tag: 'WebHID' }
        : { dot: 'is-online', label: 'Rapoo 已连接', tag: '仅发送' }
      : devicePhase === 'requesting' || devicePhase === 'connecting'
        ? { dot: 'is-busy', label: '正在连接', tag: '请稍候' }
        : devicePhase === 'error'
          ? { dot: 'is-error', label: '连接异常', tag: '诊断' }
          : devicePhase === 'unsupported'
            ? { dot: 'is-offline', label: '浏览器不支持', tag: '离线' }
            : { dot: 'is-offline', label: '设备未连接', tag: '离线配置' };

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [menu]);

  const openProfileMenu = (event: React.MouseEvent<HTMLButtonElement>, profile: Profile) => {
    event.stopPropagation();
    if (menu?.id === profile.id) {
      setMenu(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const width = 208;
    const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width));
    const estimatedHeight = 216;
    const top = Math.min(window.innerHeight - estimatedHeight - 12, rect.bottom + 8);
    setMenu({ id: profile.id, top, left });
  };

  return (
    <>
      <div className={cx('sidebar-scrim', open && 'is-visible')} onClick={onClose} aria-hidden="true" />
      <aside className={cx('sidebar', open && 'is-open')} aria-label="配置导航">
        <button type="button" className="sidebar-close icon-button ghost" onClick={onClose} aria-label="关闭菜单">
          <X size={18} />
        </button>

        <section className="device-card">
          <div className="device-card-glow" />
          <div className="device-heading">
            <div className="device-orb">
              <Mouse size={22} />
            </div>
            <div className="device-title">
              <span>DEVICE</span>
              <h2>{model.shortName}</h2>
              <p>
                {model.sensor} · {model.connection}
              </p>
            </div>
          </div>
          <div className="device-status-row">
            <span className={`status-dot ${deviceState.dot}`} />
            <strong>{deviceState.label}</strong>
            <span className="offline-tag">{deviceState.tag}</span>
          </div>
          <div className="device-specs">
            <div>
              <span>最高 DPI</span>
              <strong>{model.maxDpi}</strong>
            </div>
            <div>
              <span>回报率</span>
              <strong>{model.polling}</strong>
            </div>
          </div>
        </section>

        <nav className="sidebar-nav" aria-label="页面导航">
          <div className="sidebar-label">设备配置</div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const selected = page === item.id;
            const hint =
              item.id === 'macros' && activeProfile?.macros.length
                ? `${activeProfile.macros.length}`
                : item.hint;
            return (
              <button
                key={item.id}
                type="button"
                className={cx('nav-item', selected && 'is-active')}
                aria-current={selected ? 'page' : undefined}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
              >
                <span className="nav-icon">
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <span className="nav-text">{item.label}</span>
                {hint && <span className="nav-hint">{hint}</span>}
              </button>
            );
          })}
        </nav>

        <section className="profile-section">
          <div className="profile-heading">
            <div className="sidebar-label">配置文件</div>
            <button
              type="button"
              className="mini-icon-button"
              onClick={onAddProfile}
              aria-label="新建配置文件"
              title="新建配置文件"
            >
              <Plus size={15} />
            </button>
          </div>
          <div className="profile-list">
            {profiles.map((profile, index) => {
              const selected = profile.id === activeId;
              return (
                <div
                  key={profile.id}
                  className={cx('profile-item', selected && 'is-active')}
                  role="button"
                  tabIndex={0}
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => {
                    onSelectProfile(profile.id);
                    onClose();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectProfile(profile.id);
                      onClose();
                    }
                  }}
                >
                  <span className="profile-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="profile-copy">
                    <strong>{profile.name}</strong>
                    <small>
                      {BUTTON_ORDER.length} 键 · {profile.macros.length} 宏
                    </small>
                  </span>
                  {selected && (
                    <span className="profile-check" aria-label="当前配置">
                      <Check size={13} />
                    </span>
                  )}
                  <button
                    type="button"
                    className="profile-menu-button"
                    aria-label={`${profile.name} 的更多操作`}
                    aria-haspopup="menu"
                    aria-expanded={menu?.id === profile.id}
                    onClick={(event) => openProfileMenu(event, profile)}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <div className="sidebar-footer">
          <div className="local-note">
            <ShieldCheck size={15} />
            <span>
              配置默认保存在本机浏览器
              <small>连接后可写入或发送按键、DPI 与性能，操作前需确认</small>
            </span>
          </div>
          <div className="sidebar-version">
            <span>WEB CONFIG v1.5</span>
            <span>非官方</span>
          </div>
        </div>
      </aside>

      {menu && menuProfile && createPortal(
        <>
          <div className="menu-scrim" onClick={() => setMenu(null)} />
          <div
            className="profile-menu is-floating"
            style={{ top: menu.top, left: menu.left }}
            role="menu"
            aria-label={`${menuProfile.name} 的操作`}
          >
            <div className="profile-menu-meta">更新于 {formatDateTime(menuProfile.updatedAt)}</div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(null);
                onRenameProfile(menuProfile);
              }}
            >
              <Pencil size={14} /> 重命名
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(null);
                onDuplicateProfile(menuProfile);
              }}
            >
              <Copy size={14} /> 复制配置
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(null);
                onExportProfile(menuProfile);
              }}
            >
              <Download size={14} /> 导出配置
            </button>
            <div className="menu-separator" />
            <button
              type="button"
              role="menuitem"
              className="is-danger"
              disabled={profiles.length <= 1}
              title={profiles.length <= 1 ? '至少保留一个配置文件' : undefined}
              onClick={() => {
                setMenu(null);
                onDeleteProfile(menuProfile);
              }}
            >
              <Trash2 size={14} /> 删除
            </button>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
