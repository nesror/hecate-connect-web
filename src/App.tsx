import {
  AlertTriangle,
  ArrowRight,
  Check,
  Download,
  FileJson,
  HardDrive,
  Info,
  ShieldCheck,
  Upload,
  Usb,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BrandMark } from './components/Brand';
import { DeviceModal } from './components/DeviceModal';
import { Sidebar } from './components/Sidebar';
import { SpaceBackground } from './components/SpaceBackground';
import { TopBar } from './components/TopBar';
import { Modal, ToastViewport } from './components/ui';
import { createDefaultProfile, MODEL_INFO } from './defaults';
import {
  BUTTON_META,
  BUTTON_ORDER,
  createDefaultBindings,
  defaultBindingFor,
} from './functions';
import type { DeviceSettings } from './hid/profileCodec';
import { useMouseDevice } from './hid/useMouseDevice';
import { DpiPage } from './pages/DpiPage';
import { KeyBindingsPage } from './pages/KeyBindingsPage';
import { MacrosPage } from './pages/MacrosPage';
import { PerformancePage } from './pages/PerformancePage';
import {
  createBackup,
  createVendorConfig,
  parseImport,
  type ImportResult,
} from './profileIO';
import { loadStoredState, persistState } from './storage';
import type {
  Binding,
  ButtonId,
  DpiSettings,
  Macro,
  PageId,
  PerformanceSettings,
  Profile,
  StoredState,
  ToastMessage,
} from './types';
import {
  clone,
  downloadJson,
  readTextFile,
  safeFileName,
  uid,
} from './utils';

const PAGE_TITLES: Record<PageId, string> = {
  keys: '按键设定',
  dpi: 'DPI 设置',
  performance: '性能与校准',
  macros: '宏管理',
};

const POLLING_LABELS = { 125: '125 Hz', 250: '250 Hz', 500: '500 Hz', 1000: '1,000 Hz' } as const;

function uniqueProfileName(profiles: Profile[], base: string): string {
  const names = new Set(profiles.map((profile) => profile.name));
  if (!names.has(base)) return base;
  let index = 2;
  while (names.has(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function App() {
  const [initialState] = useState<StoredState>(() => {
    const stored = loadStoredState();
    if (stored) return stored;
    const profile = createDefaultProfile();
    return { version: 1, profiles: [profile], activeId: profile.id };
  });

  const [profiles, setProfiles] = useState<Profile[]>(initialState.profiles);
  const [activeId, setActiveId] = useState(initialState.activeId);
  const [page, setPage] = useState<PageId>('keys');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const device = useMouseDevice();
  const [deviceOpen, setDeviceOpen] = useState(false);
  const rapooDevice = device.family === 'rapoo';

  const [aboutOpen, setAboutOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Profile | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [exportTarget, setExportTarget] = useState<Profile | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDragging, setImportDragging] = useState(false);

  const contentRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const storageWarningRef = useRef(false);

  const activeProfile = profiles.find((profile) => profile.id === activeId) ?? profiles[0];

  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = uid();
    setToasts((current) => [...current.slice(-2), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const ok = persistState(profiles, activeId);
      if (ok) {
        setSavedAt(new Date().toISOString());
        setSaving(false);
      } else {
        setSaving(false);
        if (!storageWarningRef.current) {
          storageWarningRef.current = true;
          pushToast({
            tone: 'error',
            title: '无法保存到浏览器',
            detail: '本地存储可能已满或被禁用，请先导出备份。',
          });
        }
      }
    }, 380);
    setSaving(true);
    return () => window.clearTimeout(timer);
  }, [profiles, activeId, pushToast]);

  useEffect(() => {
    document.title = `${PAGE_TITLES[page]} · HECATE Connect Web`;
    contentRef.current?.scrollTo({ top: 0 });
  }, [page, activeProfile.id]);

  const updateActive = (patch: Partial<Profile>) => {
    const now = new Date().toISOString();
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === activeId ? { ...profile, ...patch, updatedAt: now } : profile,
      ),
    );
  };

  const bindButton = (button: ButtonId, binding: Binding) => {
    updateActive({ bindings: { ...activeProfile.bindings, [button]: binding } });
  };

  const applyDeviceBindings = (bindings: Record<ButtonId, Binding>) => {
    updateActive({ bindings });
  };

  const applyDeviceSettings = (settings: DeviceSettings) => {
    updateActive({
      dpi: { ...settings.dpi, indicator: activeProfile.dpi.indicator },
      performance: {
        ...activeProfile.performance,
        pollingRate: settings.pollingRate,
        lineCorrection: settings.lineCorrection,
        rippleCorrection: settings.rippleCorrection,
        sensorHeight: settings.sensorHeight,
        buttonDelay: settings.buttonDelay,
      },
    });
  };

  const addProfile = () => {
    const name = uniqueProfileName(profiles, `配置文件 ${profiles.length + 1}`);
    const profile = createDefaultProfile(name);
    setProfiles((current) => [...current, profile]);
    setActiveId(profile.id);
    setSidebarOpen(false);
    pushToast({ tone: 'success', title: '已新建配置文件', detail: name });
  };

  const openRename = (profile: Profile) => {
    setRenameTarget(profile);
    setRenameValue(profile.name);
  };

  const submitRename = () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) {
      pushToast({ tone: 'error', title: '配置名称不能为空' });
      return;
    }
    if (profiles.some((profile) => profile.id !== renameTarget.id && profile.name === name)) {
      pushToast({ tone: 'error', title: '名称已存在', detail: '请换一个配置文件名称。' });
      return;
    }
    const now = new Date().toISOString();
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === renameTarget.id ? { ...profile, name, updatedAt: now } : profile,
      ),
    );
    pushToast({ tone: 'success', title: '配置已重命名', detail: name });
    setRenameTarget(null);
  };

  const duplicateProfile = (profile: Profile) => {
    const now = new Date().toISOString();
    const copy = clone(profile);
    copy.id = uid();
    copy.name = uniqueProfileName(profiles, `${profile.name} 副本`);
    copy.createdAt = now;
    copy.updatedAt = now;
    setProfiles((current) => [...current, copy]);
    setActiveId(copy.id);
    pushToast({ tone: 'success', title: '已复制配置文件', detail: copy.name });
  };

  const confirmDeleteProfile = () => {
    if (!deleteTarget || profiles.length <= 1) return;
    const remaining = profiles.filter((profile) => profile.id !== deleteTarget.id);
    setProfiles(remaining);
    if (activeId === deleteTarget.id) setActiveId(remaining[0].id);
    pushToast({ tone: 'info', title: '配置文件已删除', detail: deleteTarget.name });
    setDeleteTarget(null);
  };

  const openExport = (profile: Profile) => setExportTarget(profile);

  const exportBackup = (profile: Profile) => {
    downloadJson(`${safeFileName(profile.name)}.hecate-web.json`, createBackup(profile));
    pushToast({ tone: 'success', title: '备份已导出', detail: '包含全部页面设置与宏数据。' });
  };

  const exportVendor = (profile: Profile) => {
    downloadJson(`${safeFileName(profile.name)}.hecate-device.json`, createVendorConfig(profile));
    pushToast({
      tone: 'info',
      title: '兼容 JSON 已导出',
      detail: '实验性格式，未在真机上验证，且不含宏数据。',
    });
  };

  const changeMacros = (macros: Macro[]) => {
    updateActive({ macros });
  };

  const deleteMacro = (macroId: string) => {
    const affected = BUTTON_ORDER.filter((button) => {
      const binding = activeProfile.bindings[button];
      return binding.kind === 'macro' && binding.macroId === macroId;
    });
    const now = new Date().toISOString();
    setProfiles((current) =>
      current.map((profile) => {
        if (profile.id !== activeId) return profile;
        const bindings = { ...profile.bindings };
        affected.forEach((button) => {
          bindings[button] =
            button === 'left' ? defaultBindingFor('left') : ({ kind: 'disabled' } as Binding);
        });
        return {
          ...profile,
          bindings,
          macros: profile.macros.filter((macro) => macro.id !== macroId),
          updatedAt: now,
        };
      }),
    );
    pushToast({
      tone: 'info',
      title: '宏已删除',
      detail: affected.length
        ? `${affected.length} 个按键已解除绑定。`
        : '当前没有按键绑定此宏。',
    });
  };

  const assignMacro = (button: ButtonId, macroId: string) => {
    const macro = activeProfile.macros.find((item) => item.id === macroId);
    updateActive({
      bindings: { ...activeProfile.bindings, [button]: { kind: 'macro', macroId } },
    });
    pushToast({
      tone: 'success',
      title: '已指派宏',
      detail: `${macro?.name ?? '宏'} → ${BUTTON_META[button].label}`,
    });
  };

  const openImport = () => {
    setImportText('');
    setImportPreview(null);
    setImportError(null);
    setImportDragging(false);
    setImportOpen(true);
  };

  const closeImport = () => {
    setImportOpen(false);
    setImportText('');
    setImportPreview(null);
    setImportError(null);
    setImportDragging(false);
  };

  const parseImportText = (text: string) => {
    try {
      const result = parseImport(text);
      setImportPreview(result);
      setImportError(null);
      return result;
    } catch (error) {
      setImportPreview(null);
      setImportError(errorMessage(error));
      return null;
    }
  };

  const handleImportFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setImportError('文件超过 5 MB，请确认这是 HECATE 配置文件。');
      return;
    }
    try {
      const text = await readTextFile(file);
      setImportText(text);
      parseImportText(text);
    } catch (error) {
      setImportError(`无法读取文件：${errorMessage(error)}`);
    }
  };

  const confirmImport = () => {
    const result = importPreview ?? parseImportText(importText);
    if (!result) return;
    const now = new Date().toISOString();
    const incoming = clone(result.profile);
    incoming.id = uid();
    incoming.name = uniqueProfileName(profiles, incoming.name);
    incoming.createdAt = now;
    incoming.updatedAt = now;
    setProfiles((current) => [...current, incoming]);
    setActiveId(incoming.id);
    pushToast({
      tone: 'success',
      title: '配置已导入',
      detail: result.warnings.length
        ? `${incoming.name} · ${result.warnings.length} 条兼容性提示`
        : `${incoming.name} · ${result.source === 'vendor' ? 'HECATE 兼容配置' : '网页版备份'}`,
    });
    closeImport();
  };

  const resetBindings = () => {
    updateActive({ bindings: createDefaultBindings() });
    pushToast({ tone: 'success', title: '按键已恢复默认' });
  };

  const updateDpi = (dpi: DpiSettings) => updateActive({ dpi });
  const updatePerformance = (performance: PerformanceSettings) =>
    updateActive({ performance });

  const renderPage = () => {
    switch (page) {
      case 'keys':
        return (
          <KeyBindingsPage
            profile={activeProfile}
            device={device}
            onBind={bindButton}
            onReset={resetBindings}
            onNavigateMacros={() => setPage('macros')}
          />
        );
      case 'dpi':
        return (
          <DpiPage
            profile={activeProfile}
            onChange={updateDpi}
            device={device}
            notify={pushToast}
            onOpenDevice={() => setDeviceOpen(true)}
          />
        );
      case 'performance':
        return (
          <PerformancePage
            profile={activeProfile}
            onChange={updatePerformance}
            device={device}
            notify={pushToast}
            onOpenDevice={() => setDeviceOpen(true)}
          />
        );
      case 'macros':
        return (
          <MacrosPage
            profile={activeProfile}
            onChange={changeMacros}
            onDeleteMacro={deleteMacro}
            onAssignMacro={assignMacro}
          />
        );
    }
  };

  return (
    <div className="app-shell">
      <SpaceBackground />

      <Sidebar
        page={page}
        onNavigate={setPage}
        profiles={profiles}
        activeId={activeProfile.id}
        onSelectProfile={setActiveId}
        onAddProfile={addProfile}
        onRenameProfile={openRename}
        onDuplicateProfile={duplicateProfile}
        onDeleteProfile={setDeleteTarget}
        onExportProfile={openExport}
        devicePhase={device.phase}
        model={device.model}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="app-main">
        <TopBar
          savedAt={saving ? null : savedAt}
          devicePhase={device.phase}
          deviceBusy={device.busy}
          deviceName={device.family ? device.model.shortName : '鼠标'}
          onOpenDevice={() => setDeviceOpen(true)}
          onMenu={() => setSidebarOpen(true)}
          onExport={() => openExport(activeProfile)}
          onImport={openImport}
          onAbout={() => setAboutOpen(true)}
        />

        <main className="content" ref={contentRef}>
          <div className="content-inner">
            <div
              className={`offline-banner ${
                device.phase === 'connected'
                  ? 'is-online'
                  : device.phase === 'error'
                    ? 'is-error'
                    : ''
              }`}
            >
              <span className="offline-banner-icon">
                <Usb size={16} />
              </span>
              <div className="offline-banner-copy">
                <strong>
                  {device.phase === 'connected'
                    ? device.busy
                      ? '硬件通信中'
                      : `已连接 ${device.model.shortName}`
                    : device.phase === 'error'
                      ? '设备连接异常'
                      : '离线配置模式'}
                </strong>
                <span>
                  {device.phase === 'connected'
                    ? rapooDevice
                      ? '按键、DPI、回报率与传感器设置会以“发送”方式写入 Rapoo 设备；浏览器无法回读确认。宏仅保存在本地。'
                      : '按键、DPI、回报率与传感器设置可写入鼠标；宏仍只保存在本地。'
                    : device.phase === 'error'
                      ? (device.error ?? '设备连接异常，点击查看诊断信息。')
                      : '未连接设备。设置会保存到本机浏览器；连接 HECATE G3M PRO 或 Rapoo VT9PRO 后可写入或发送按键、DPI 与性能配置。'}
                </span>
              </div>
              <button type="button" onClick={() => setDeviceOpen(true)}>
                {device.phase === 'connected' ? '设备详情' : '连接设备'}
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="page-host" key={`${activeProfile.id}:${page}`}>
              {renderPage()}
            </div>

            <footer className="content-footer">
              <span>G3M PRO / VT9PRO · 网页配置工具</span>
              <span>非官方项目 · 数据默认仅存储于本机</span>
            </footer>
          </div>
        </main>
      </div>

      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />

      <DeviceModal
        open={deviceOpen}
        onClose={() => setDeviceOpen(false)}
        device={device}
        profile={activeProfile}
        onApplyBindings={applyDeviceBindings}
        onApplyDeviceSettings={applyDeviceSettings}
        notify={pushToast}
      />

      <Modal
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="重命名配置文件"
        description="名称仅用于区分浏览器中的配置文件。"
        size="compact"
        footer={
          <>
            <button type="button" className="ghost-button" onClick={() => setRenameTarget(null)}>
              取消
            </button>
            <button type="button" className="primary-button" onClick={submitRename}>
              保存名称
            </button>
          </>
        }
      >
        <label className="modal-input-label">
          <span>配置名称</span>
          <input
            type="text"
            data-autofocus
            value={renameValue}
            maxLength={28}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitRename();
              }
            }}
          />
        </label>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="删除配置文件？"
        description={
          deleteTarget
            ? `「${deleteTarget.name}」中的按键、DPI、性能与宏设置将被永久删除。此操作无法撤销。`
            : undefined
        }
        size="compact"
        tone="danger"
        footer={
          <>
            <button type="button" className="ghost-button" onClick={() => setDeleteTarget(null)}>
              取消
            </button>
            <button type="button" className="danger-button" onClick={confirmDeleteProfile}>
              删除配置
            </button>
          </>
        }
      >
        <div className="delete-summary">
          <AlertTriangle size={17} />
          <span>
            {deleteTarget
              ? `${deleteTarget.macros.length} 个宏 · ${POLLING_LABELS[deleteTarget.performance.pollingRate]} 回报率`
              : ''}
          </span>
        </div>
      </Modal>

      <Modal
        open={exportTarget !== null}
        onClose={() => setExportTarget(null)}
        title="导出配置"
        description={exportTarget ? `正在导出「${exportTarget.name}」。` : undefined}
        size="wide"
      >
        {exportTarget && (
          <div className="export-modal">
            <div className="export-profile">
              <div className="export-profile-mark">
                <BrandMark />
              </div>
              <div>
                <span>CONFIGURATION</span>
                <strong>{exportTarget.name}</strong>
                <small>
                  6 键 · 7 档 DPI · {exportTarget.macros.length} 个宏 ·{' '}
                  {POLLING_LABELS[exportTarget.performance.pollingRate]}
                </small>
              </div>
            </div>

            <div className="export-options">
              <div className="export-option">
                <span className="export-icon">
                  <HardDrive size={20} />
                </span>
                <div className="export-copy">
                  <div className="export-title-line">
                    <strong>网页版备份</strong>
                    <span className="tag-ok">推荐</span>
                  </div>
                  <p>完整保留全部设置、配置文件信息与宏数据，可再次导入网页版恢复。</p>
                </div>
                <button
                  type="button"
                  className="outline-button small"
                  onClick={() => exportBackup(exportTarget)}
                >
                  <Download size={14} />
                  下载
                </button>
              </div>

              <div className="export-option">
                <span className="export-icon">
                  <FileJson size={20} />
                </span>
                <div className="export-copy">
                  <div className="export-title-line">
                    <strong>HECATE 兼容 JSON</strong>
                    <span className="tag-warn">实验性</span>
                  </div>
                  <p>参考原生驱动数据结构生成，包含 59 键位与 DPI 档位。</p>
                </div>
                <button
                  type="button"
                  className="ghost-button small"
                  onClick={() => exportVendor(exportTarget)}
                >
                  <Download size={14} />
                  下载
                </button>
              </div>
            </div>

            <div className="inline-note is-warning">
              <AlertTriangle size={15} />
              HECATE 兼容 JSON 未经真机验证，不能保证可被原生驱动接受；该格式也不包含宏数据。重要配置请优先使用网页版备份。
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={importOpen}
        onClose={closeImport}
        title="导入配置"
        description="导入会创建一个新的配置文件，不会覆盖现有配置。"
        size="wide"
        footer={
          <>
            <button type="button" className="ghost-button" onClick={closeImport}>
              取消
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!importText.trim()}
              onClick={confirmImport}
            >
              <Upload size={15} />
              导入为新配置
            </button>
          </>
        }
      >
        <div className="import-modal">
          <div
            className={`import-drop${importDragging ? ' is-dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setImportDragging(true);
            }}
            onDragLeave={() => setImportDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setImportDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) void handleImportFile(file);
            }}
          >
            <span className="import-drop-icon">
              <Upload size={24} />
            </span>
            <strong>拖入 JSON 配置文件</strong>
            <span className="import-drop-or">或</span>
            <button type="button" className="outline-button small" onClick={() => fileInputRef.current?.click()}>
              选择文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImportFile(file);
                event.target.value = '';
              }}
            />
            <small>支持网页版备份或 HECATE 驱动导出的 JSON</small>
          </div>

          <label className="import-paste">
            <span>或粘贴 JSON 内容</span>
            <textarea
              rows={4}
              value={importText}
              placeholder='{ "format": "hecate-connect-web", ... }'
              onChange={(event) => {
                setImportText(event.target.value);
                setImportPreview(null);
                setImportError(null);
              }}
            />
          </label>
          <div className="import-parse-row">
            <button
              type="button"
              className="ghost-button small"
              disabled={!importText.trim()}
              onClick={() => parseImportText(importText)}
            >
              识别内容
            </button>
            {importPreview && (
              <span className="import-source">
                <Check size={13} />
                {importPreview.source === 'vendor' ? '识别为 HECATE 兼容配置' : '识别为网页版备份'}
              </span>
            )}
          </div>

          {importError && (
            <div className="inline-note is-warning">
              <AlertTriangle size={15} />
              {importError}
            </div>
          )}

          {importPreview && (
            <div className="import-preview">
              <div className="import-preview-head">
                <span className="import-preview-icon">
                  <Check size={16} />
                </span>
                <div>
                  <span>READY TO IMPORT</span>
                  <strong>{importPreview.profile.name}</strong>
                </div>
                <span className="import-preview-count">{importPreview.profile.macros.length} 宏</span>
              </div>
              <div className="import-chips">
                <span>6 个按键</span>
                <span>7 档 DPI</span>
                <span>{POLLING_LABELS[importPreview.profile.performance.pollingRate]}</span>
                <span>{importPreview.profile.dpi.stages.filter((stage) => stage.enabled).length} 个启用档位</span>
              </div>
              {importPreview.warnings.length > 0 && (
                <ul className="import-warnings">
                  {importPreview.warnings.map((warning) => (
                    <li key={warning}>
                      <Info size={13} />
                      {warning}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        title="关于网页版配置工具"
        size="wide"
      >
        <div className="about-modal">
          <div className="about-hero">
            <div className="about-mark">
              <BrandMark />
            </div>
            <div>
              <span className="section-kicker">UNOFFICIAL WEB CONFIG</span>
              <h2>HECATE Connect · Web</h2>
              <p>为 HECATE G3M PRO 与 Rapoo VT9PRO 制作的浏览器配置界面，复刻桌面驱动的交互与视觉语言。</p>
            </div>
            <span className="about-version">v1.5</span>
          </div>

          <div className="about-callout">
            <Usb size={19} />
            <div>
              <strong>WebHID 硬件连接（实验性）</strong>
              <p>
                使用桌面版 Chrome 或 Edge 连接鼠标后，网页可以读取并写入 HECATE G3M PRO 的 6 个按键映射
                （含滚轮后方的 DPI 键）、7 档 DPI 与档位颜色、当前档位、回报率、LOD、去抖与直线/波纹修正。
                握手、读取、写入与回读已在 G3M PRO（VID 320F / PID 706B）上验证。
              </p>
              <p>
                Rapoo VT9PRO 通过 0xBA 输出报告发送配置，2.4G 接收器（VID 24AE / PID 185A）与 USB 有线（PID
                418A）共用同一组协议地址。两种连接都不提供浏览器可读的回读通道，因此 Rapoo 写入属于实验性功能，网页只会显示“已发送”，不会声称验证成功。宏仍只保存在本地。
                协议来自对官方驱动的静态分析，尚未在所有固件版本上验证。
              </p>
            </div>
          </div>

          <div className="about-grid">
            <div className="about-item">
              <span><ShieldCheck size={17} /></span>
              <div>
                <strong>数据默认留在本机</strong>
                <p>使用 localStorage 自动保存，不连接服务器、不上传配置。只有你在设备面板或页面写入按钮中确认后，配置才会写入鼠标硬件或发送到 Rapoo 设备。</p>
              </div>
            </div>
            <div className="about-item">
              <span><HardDrive size={17} /></span>
              <div>
                <strong>两种导出格式</strong>
                <p>网页版备份可完整恢复；HECATE 兼容 JSON 为实验性格式，未经真机验证且不含宏。</p>
              </div>
            </div>
            <div className="about-item">
              <span><FileJson size={17} /></span>
              <div>
                <strong>兼容导入</strong>
                <p>可以读取网页版备份和原生驱动的部分配置结构，无法识别的按键映射会保留默认并给出提示。</p>
              </div>
            </div>
            <div className="about-item">
              <span><Info size={17} /></span>
              <div>
                <strong>关于本工具</strong>
                <p>
                  非官方项目，与 HECATE、漫步者、Rapoo、雷柏均无隶属关系。HECATE 机型基准为{' '}
                  {MODEL_INFO.sensor} · {MODEL_INFO.maxDpi} · {MODEL_INFO.polling}；Rapoo 支持为实验性，
                  无法回读验证。
                </p>
              </div>
            </div>
          </div>

          <div className="about-footer">
            <span>支持 HECATE G3M PRO / Rapoo VT9PRO</span>
            <span>配置存储键：hecate-connect-web:state:v1</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
