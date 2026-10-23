import {
  Ban,
  Check,
  Crosshair,
  Info,
  Keyboard,
  Lock,
  Monitor,
  Mouse,
  Music2,
  RotateCcw,
  ScanLine,
  Search,
  Workflow,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MouseIllustration } from '../components/MouseIllustration';
import { PageHeader } from '../components/PageHeader';
import { KeyCap, Modal } from '../components/ui';
import {
  bindingFromKeyCode,
  bindingKey,
  bindingKindLabel,
  bindingLabel,
  buildBinding,
  BUTTON_META,
  BUTTON_ORDER,
  defaultBindingFor,
  getFunctionCategories,
  type FunctionCategoryId,
} from '../functions';
import type { Binding, ButtonId, Profile } from '../types';
import type { MouseController } from '../hid/useMouseDevice';
import { cx } from '../utils';

interface KeyBindingsPageProps {
  profile: Profile;
  device: MouseController;
  onBind: (button: ButtonId, binding: Binding) => void;
  onReset: () => void;
  onNavigateMacros: () => void;
}

const CATEGORY_ICONS: Record<FunctionCategoryId, typeof Mouse> = {
  mouse: Mouse,
  keyboard: Keyboard,
  media: Music2,
  system: Monitor,
  dpi: Crosshair,
  macro: Workflow,
  disabled: Ban,
};

function categoryForBinding(binding: Binding): FunctionCategoryId {
  if (binding.kind === 'key') return 'keyboard';
  return binding.kind;
}

export function KeyBindingsPage({
  profile,
  device,
  onBind,
  onReset,
  onNavigateMacros,
}: KeyBindingsPageProps) {
  const rapoo = device.family === 'rapoo';
  const [selectedButton, setSelectedButton] = useState<ButtonId>('left');
  const [category, setCategory] = useState<FunctionCategoryId>('mouse');
  const [search, setSearch] = useState('');
  const [captureOpen, setCaptureOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedBinding = profile.bindings[selectedButton];
  const categories = useMemo(() => getFunctionCategories(profile.macros), [profile.macros]);
  const activeCategory = categories.find((item) => item.id === category) ?? categories[0];
  const selectedKey = bindingKey(selectedBinding);

  const selectButton = (button: ButtonId) => {
    setSelectedButton(button);
    setCategory(categoryForBinding(profile.bindings[button]));
    setSearch('');
    setNotice(null);
  };

  const applyBinding = (binding: Binding) => {
    if (selectedButton === 'left' && binding.kind === 'disabled') {
      setNotice('左键不能禁用；如需保留点击，请选择「鼠标功能 → 左键单击」。');
      return;
    }
    onBind(selectedButton, binding);
    setNotice(null);
  };

  useEffect(() => {
    if (!captureOpen) return;
    const handler = (event: globalThis.KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape') {
        setCaptureOpen(false);
        return;
      }
      const binding = bindingFromKeyCode(event.code);
      if (!binding) {
        setNotice(`「${event.code}」没有对应的官方协议代码，未更改当前按键。请从列表中手动选择。`);
        setCaptureOpen(false);
        return;
      }
      applyBinding(binding);
      setCategory(categoryForBinding(binding));
      setCaptureOpen(false);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  });

  const visibleGroups = useMemo(() => {
    if (category !== 'keyboard' || !search.trim()) return activeCategory.groups;
    const query = search.trim().toLowerCase();
    return activeCategory.groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => option.label.toLowerCase().includes(query)),
      }))
      .filter((group) => group.options.length > 0);
  }, [activeCategory.groups, category, search]);

  return (
    <div className="page key-page">
      <PageHeader
        kicker="BUTTON REMAP · 6 KEYS"
        title="按键设定"
        description={
          rapoo
            ? '点击鼠标示意图上的编号，为 Rapoo VT9PRO 的 6 个物理按键分配功能。设备只发送鼠标、键盘、多媒体与 DPI 循环动作；宏与未确认功能仅保存在本机。'
            : '点击鼠标示意图上的编号，将 6 个物理按键映射为鼠标、键盘、宏或系统功能。'
        }
        actions={
          <button type="button" className="ghost-button" onClick={() => setResetOpen(true)}>
            <RotateCcw size={16} />
            恢复默认
          </button>
        }
      />

      <div className="keys-layout">
        <section className="panel mouse-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">DEVICE MAP</span>
              <h2>{device.model.shortName} 按键</h2>
            </div>
            <span className="panel-note">点击编号选择按键</span>
          </div>

          <div className="mouse-stage">
            <div className="mouse-halo" />
            <MouseIllustration
              device={rapoo ? 'rapoo' : 'hecate'}
              selected={selectedButton}
              onSelect={selectButton}
            />
          </div>

          <div className="key-legend">
            {BUTTON_ORDER.map((button) => {
              const meta = BUTTON_META[button];
              const binding = profile.bindings[button];
              return (
                <button
                  key={button}
                  type="button"
                  className={cx('legend-item', selectedButton === button && 'is-active')}
                  aria-pressed={selectedButton === button}
                  onClick={() => selectButton(button)}
                >
                  <span className="legend-number">{meta.index}</span>
                  <span className="legend-copy">
                    <strong>{meta.label}</strong>
                    <small>{bindingLabel(binding, profile.macros)}</small>
                  </span>
                  {selectedButton === button && <span className="legend-active-dot" />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel binding-panel">
          <div className="binding-heading">
            <div>
              <span className="section-kicker">ASSIGNMENT</span>
              <h2>按键功能</h2>
            </div>
            <div className="selected-key-chip">
              <span>{BUTTON_META[selectedButton].index}</span>
              {BUTTON_META[selectedButton].label}
            </div>
          </div>

          <div className="current-binding">
            <div className="binding-kind-icon">
              {(() => {
                const Icon = CATEGORY_ICONS[categoryForBinding(selectedBinding)];
                return <Icon size={20} />;
              })()}
            </div>
            <div className="binding-copy">
              <span>当前功能</span>
              <strong>{bindingLabel(selectedBinding, profile.macros)}</strong>
              <small>
                {bindingKindLabel(selectedBinding)} · {BUTTON_META[selectedButton].description}
              </small>
            </div>
            <button
              type="button"
              className="mini-action"
              onClick={() => applyBinding(defaultBindingFor(selectedButton))}
              title="恢复此按键的默认功能"
            >
              <RotateCcw size={14} />
              默认
            </button>
          </div>

          <div className="category-tabs" role="tablist" aria-label="功能类别">
            {categories.map((item) => {
              const Icon = CATEGORY_ICONS[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={category === item.id}
                  className={cx('category-tab', category === item.id && 'is-active')}
                  onClick={() => {
                    setCategory(item.id);
                    setSearch('');
                    setNotice(null);
                  }}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </div>

          {notice && (
            <div className="inline-note is-warning">
              <Info size={15} />
              {notice}
            </div>
          )}

          {category === 'keyboard' && (
            <div className="function-toolbar">
              <label className="search-field">
                <Search size={15} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索按键"
                  aria-label="搜索键盘按键"
                />
              </label>
              <button type="button" className="outline-button small" onClick={() => setCaptureOpen(true)}>
                <ScanLine size={15} />
                按下任意键
              </button>
            </div>
          )}

          <div className="function-scroll">
            {category === 'disabled' ? (
              <div className="function-empty">
                <div className="empty-icon">
                  <Ban size={24} />
                </div>
                <h3>{selectedButton === 'left' ? '左键不能禁用' : '关闭此按键的功能'}</h3>
                <p>
                  {selectedButton === 'left'
                    ? '为避免鼠标失去主点击功能，网页版与原驱动一样不允许禁用左键；但它仍可改键，需要点击时请选择「鼠标功能 → 左键单击」。'
                    : '禁用后按下该按键不会有任何动作，可随时重新分配功能。'}
                </p>
                {selectedButton !== 'left' && (
                  <button
                    type="button"
                    className={cx('danger-button', selectedBinding.kind === 'disabled' && 'is-active')}
                    onClick={() => applyBinding({ kind: 'disabled' })}
                  >
                    {selectedBinding.kind === 'disabled' ? <Check size={16} /> : <Ban size={16} />}
                    {selectedBinding.kind === 'disabled' ? '当前已禁用' : '禁用此按键'}
                  </button>
                )}
              </div>
            ) : category === 'macro' && profile.macros.length === 0 ? (
              <div className="function-empty">
                <div className="empty-icon">
                  <Workflow size={24} />
                </div>
                <h3>还没有可用宏</h3>
                <p>先在宏管理中录制一段按键序列，再将宏指派给鼠标按键。</p>
                <button type="button" className="primary-button small" onClick={onNavigateMacros}>
                  <Workflow size={15} />
                  前往宏管理
                </button>
              </div>
            ) : (
              <>
                {category !== 'keyboard' && (
                  <div className="function-group">
                    <div className="function-group-label">{activeCategory.description}</div>
                    <div
                      className={cx('option-grid', category === 'macro' && 'is-macro')}
                    >
                      {activeCategory.groups.flatMap((group) =>
                        group.options.map((option) => {
                          const binding = buildBinding(category, option.id, profile.macros);
                          const active = bindingKey(binding) === selectedKey;
                          const optionLabel = bindingLabel(binding, profile.macros);
                          const macro = profile.macros.find((item) => item.id === option.id);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={cx('function-option', active && 'is-active')}
                              aria-pressed={active}
                              onClick={() => applyBinding(binding)}
                            >
                              <span>{optionLabel}</span>
                              {macro && <small>{macro.actions.length} 个动作</small>}
                              {active && <Check size={14} />}
                            </button>
                          );
                        }),
                      )}
                    </div>
                  </div>
                )}
                {category === 'keyboard' &&
                  (visibleGroups.length ? (
                    visibleGroups.map((group) => (
                      <div key={group.id} className="function-group">
                        <div className="function-group-label">{group.label}</div>
                        <div className="option-grid is-keyboard">
                          {group.options.map((option) => {
                            const binding = buildBinding('keyboard', option.id, profile.macros);
                            const active = bindingKey(binding) === selectedKey;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                className={cx('key-option', active && 'is-active')}
                                aria-pressed={active}
                                aria-label={`绑定按键 ${option.label}`}
                                onClick={() => applyBinding(binding)}
                              >
                                <KeyCap>{option.label}</KeyCap>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="search-empty">没有找到匹配的按键</div>
                  ))}
                {category === 'macro' && profile.macros.length > 0 && (
                  <button type="button" className="text-link macro-link" onClick={onNavigateMacros}>
                    管理宏与录制动作
                  </button>
                )}
              </>
            )}
          </div>

          <div className="binding-footer">
            <Lock size={14} />
            <span>
              6 个按键均可改键，仅左键不能设为禁用。
              <span className="muted">
                {' '}
                {rapoo
                  ? '设备会发送鼠标、键盘、多媒体与 DPI 循环动作；宏、系统与 DPI +/− 动作不会写入，仅保存在本机配置中。'
                  : '键盘、多媒体与系统功能会在连接 HECATE 后写入板载配置；宏仅保存在本机配置中，不会写入设备。'}
              </span>
            </span>
          </div>
        </section>
      </div>

      <Modal
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        title="按下键盘按键"
        description={`正在为「${BUTTON_META[selectedButton].label}」捕获按键。按 Esc 取消。`}
        size="compact"
      >
        <div className="capture-stage">
          <div className="capture-pulse">
            <Keyboard size={30} />
          </div>
          <strong>等待按键输入…</strong>
          <span>按键会被直接写入当前配置文件</span>
        </div>
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="恢复默认按键？"
        description="当前配置文件中的 6 个按键将恢复为出厂功能，其他设置不受影响。"
        size="compact"
        footer={
          <>
            <button type="button" className="ghost-button" onClick={() => setResetOpen(false)}>
              取消
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                onReset();
                setResetOpen(false);
              }}
            >
              恢复默认
            </button>
          </>
        }
      />
    </div>
  );
}
