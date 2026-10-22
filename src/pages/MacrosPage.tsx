import {
  ArrowDown,
  ArrowUp,
  Check,
  Info,
  Keyboard,
  ListPlus,
  Mouse,
  Play,
  Plus,
  Repeat,
  Square,
  Timer,
  Trash2,
  Workflow,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Modal, Segmented } from '../components/ui';
import {
  BUTTON_META,
  BUTTON_ORDER,
  keyLabel,
} from '../functions';
import type {
  ButtonId,
  Macro,
  MacroAction,
  Profile,
} from '../types';
import { clamp, cx, uid } from '../utils';

interface MacrosPageProps {
  profile: Profile;
  onChange: (macros: Macro[]) => void;
  onDeleteMacro: (macroId: string) => void;
  onAssignMacro: (button: ButtonId, macroId: string) => void;
}

const MAX_RECORD_ACTIONS = 240;

function actionTitle(action: MacroAction): string {
  if (action.type === 'delay') return `延迟 ${action.delay} ms`;
  if (action.type === 'key') return action.label;
  return BUTTON_META[action.button].label;
}

function actionCaption(action: MacroAction): string {
  if (action.type === 'delay') return '等待一段时间后执行下一步';
  if (action.type === 'key') {
    return `${action.event === 'down' ? '按下' : '松开'} · ${action.code}`;
  }
  return `${action.event === 'down' ? '按下' : '松开'} · 鼠标按键`;
}

function DelayField({
  value,
  onCommit,
  label,
}: {
  value: number;
  onCommit: (next: number) => void;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value));

  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);

  const commit = () => {
    const parsed = Number(text);
    const next = Number.isFinite(parsed) ? clamp(Math.round(parsed), 0, 60000) : value;
    onCommit(next);
    setText(String(next));
    setEditing(false);
  };

  return (
    <label className="delay-field">
      <span>延迟</span>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={editing ? text : String(value)}
        onFocus={() => {
          setEditing(true);
          setText(String(value));
        }}
        onChange={(event) => {
          setEditing(true);
          setText(event.target.value.replace(/[^\d]/g, ''));
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      <span>ms</span>
    </label>
  );
}

function RepeatStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value));

  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);

  const commit = () => {
    const parsed = Number(text);
    const next = Number.isFinite(parsed) ? clamp(Math.round(parsed), 1, 99) : value;
    onChange(next);
    setText(String(next));
    setEditing(false);
  };

  return (
    <div className="number-stepper">
      <button
        type="button"
        aria-label="减少循环次数"
        onClick={() => onChange(clamp(value - 1, 1, 99))}
        disabled={value <= 1}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label="循环次数"
        value={editing ? text : String(value)}
        onFocus={() => {
          setEditing(true);
          setText(String(value));
        }}
        onChange={(event) => {
          setEditing(true);
          setText(event.target.value.replace(/[^\d]/g, ''));
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      <button
        type="button"
        aria-label="增加循环次数"
        onClick={() => onChange(clamp(value + 1, 1, 99))}
        disabled={value >= 99}
      >
        +
      </button>
      <span>次</span>
    </div>
  );
}

export function MacrosPage({
  profile,
  onChange,
  onDeleteMacro,
  onAssignMacro,
}: MacrosPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(profile.macros[0]?.id ?? null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordTarget, setRecordTarget] = useState<string | null>(null);
  const [draft, setDraft] = useState<MacroAction[]>([]);
  const [limitHit, setLimitHit] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Macro | null>(null);

  const draftRef = useRef<MacroAction[]>([]);
  const lastStampRef = useRef(0);
  const heldRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (selectedId && profile.macros.some((macro) => macro.id === selectedId)) return;
    setSelectedId(profile.macros[0]?.id ?? null);
  }, [profile.macros, selectedId]);

  const selectedMacro = profile.macros.find((macro) => macro.id === selectedId) ?? null;
  const assignedButtons = selectedMacro
    ? BUTTON_ORDER.filter((button) => {
        const binding = profile.bindings[button];
        return binding.kind === 'macro' && binding.macroId === selectedMacro.id;
      })
    : [];

  const deleteLinkedCount = deleteTarget
    ? BUTTON_ORDER.filter((button) => {
        const binding = profile.bindings[button];
        return binding.kind === 'macro' && binding.macroId === deleteTarget.id;
      }).length
    : 0;

  const totalDuration = selectedMacro
    ? selectedMacro.actions.reduce((sum, action) => sum + action.delay, 0)
    : 0;

  const updateMacro = (macroId: string, patch: Partial<Macro>) => {
    onChange(profile.macros.map((macro) => (macro.id === macroId ? { ...macro, ...patch } : macro)));
  };

  const updateSelected = (patch: Partial<Macro>) => {
    if (selectedMacro) updateMacro(selectedMacro.id, patch);
  };

  const addMacro = () => {
    const names = new Set(profile.macros.map((macro) => macro.name));
    let index = profile.macros.length + 1;
    while (names.has(`宏 ${index}`)) index += 1;
    const macro: Macro = {
      id: uid(),
      name: `宏 ${index}`,
      actions: [],
      repeat: 1,
      stopMode: 'once',
    };
    onChange([...profile.macros, macro]);
    setSelectedId(macro.id);
  };

  const addDelay = () => {
    if (!selectedMacro) return;
    updateSelected({
      actions: [...selectedMacro.actions, { id: uid(), type: 'delay', delay: 100 }],
    });
  };

  const addMouseClick = (button: ButtonId) => {
    if (!selectedMacro) return;
    updateSelected({
      actions: [
        ...selectedMacro.actions,
        { id: uid(), type: 'mouse', button, event: 'down', delay: 10 },
        { id: uid(), type: 'mouse', button, event: 'up', delay: 60 },
      ],
    });
  };

  const updateAction = (actionId: string, patch: Partial<MacroAction>) => {
    if (!selectedMacro) return;
    updateSelected({
      actions: selectedMacro.actions.map((action) =>
        action.id === actionId ? ({ ...action, ...patch } as MacroAction) : action,
      ),
    });
  };

  const removeAction = (actionId: string) => {
    if (!selectedMacro) return;
    updateSelected({ actions: selectedMacro.actions.filter((action) => action.id !== actionId) });
  };

  const moveAction = (index: number, delta: number) => {
    if (!selectedMacro) return;
    const target = index + delta;
    if (target < 0 || target >= selectedMacro.actions.length) return;
    const next = [...selectedMacro.actions];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    updateSelected({ actions: next });
  };

  const openRecord = () => {
    if (!selectedMacro) return;
    const base = selectedMacro.actions.slice(-MAX_RECORD_ACTIONS);
    draftRef.current = base;
    setDraft(base);
    setLimitHit(false);
    setRecordTarget(selectedMacro.id);
    heldRef.current = new Set();
    lastStampRef.current = performance.now();
    setElapsed(0);
    setRecordOpen(true);
  };

  const appendDraft = (action: MacroAction) => {
    if (draftRef.current.length >= MAX_RECORD_ACTIONS) {
      setLimitHit(true);
      return;
    }
    const next = [...draftRef.current, action];
    draftRef.current = next;
    setDraft(next);
  };

  const finishRecording = () => {
    if (recordTarget) {
      onChange(
        profile.macros.map((macro) =>
          macro.id === recordTarget ? { ...macro, actions: draftRef.current } : macro,
        ),
      );
    }
    setRecordOpen(false);
    setRecordTarget(null);
  };

  useEffect(() => {
    if (!recordOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        finishRecording();
        return;
      }
      if (event.repeat || heldRef.current.has(event.code)) return;
      heldRef.current.add(event.code);
      const now = performance.now();
      const delay = clamp(Math.round(now - lastStampRef.current), 0, 2000);
      lastStampRef.current = now;
      appendDraft({
        id: uid(),
        type: 'key',
        code: event.code,
        label: keyLabel(event.code),
        event: 'down',
        delay,
      });
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!heldRef.current.has(event.code)) return;
      heldRef.current.delete(event.code);
      const now = performance.now();
      const delay = clamp(Math.round(now - lastStampRef.current), 0, 2000);
      lastStampRef.current = now;
      appendDraft({
        id: uid(),
        type: 'key',
        code: event.code,
        label: keyLabel(event.code),
        event: 'up',
        delay,
      });
    };
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordOpen, recordTarget, profile.macros]);

  useEffect(() => {
    if (!recordOpen) return;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      setElapsed(performance.now() - startedAt);
    }, 120);
    return () => window.clearInterval(timer);
  }, [recordOpen]);

  const elapsedLabel = `${String(Math.floor(elapsed / 1000 / 60)).padStart(2, '0')}:${String(
    Math.floor((elapsed / 1000) % 60),
  ).padStart(2, '0')}.${String(Math.floor((elapsed % 1000) / 100))}`;

  return (
    <div className="page macros-page">
      <PageHeader
        kicker="MACRO ENGINE · LOCAL"
        title="宏管理"
        description="录制键盘序列、插入鼠标点击与延迟，并将宏指派给 5 个可编程按键。宏随配置文件保存在浏览器中。"
        actions={
          <button type="button" className="primary-button" onClick={addMacro}>
            <Plus size={16} />
            新建宏
          </button>
        }
      />

      <div className="macro-layout">
        <section className="panel macro-library">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">MACRO LIBRARY</span>
              <h2>宏列表</h2>
            </div>
            <span className="count-pill">{profile.macros.length}</span>
          </div>

          {profile.macros.length === 0 ? (
            <div className="macro-library-empty">
              <div className="empty-icon">
                <Workflow size={22} />
              </div>
              <strong>还没有宏</strong>
              <p>新建一个宏，然后录制你需要的按键序列。</p>
              <button type="button" className="outline-button small" onClick={addMacro}>
                <Plus size={14} />
                新建宏
              </button>
            </div>
          ) : (
            <div className="macro-list">
              {profile.macros.map((macro, index) => {
                const linked = BUTTON_ORDER.filter((button) => {
                  const binding = profile.bindings[button];
                  return binding.kind === 'macro' && binding.macroId === macro.id;
                });
                return (
                  <div
                    key={macro.id}
                    role="button"
                    tabIndex={0}
                    className={cx('macro-item', macro.id === selectedId && 'is-active')}
                    aria-current={macro.id === selectedId ? 'true' : undefined}
                    onClick={() => setSelectedId(macro.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedId(macro.id);
                      }
                    }}
                  >
                    <span className="macro-item-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="macro-item-copy">
                      <strong>{macro.name}</strong>
                      <small>
                        {macro.actions.length} 个动作 · {macro.repeat} 次
                      </small>
                    </span>
                    {linked.length > 0 && (
                      <span className="macro-linked" title={linked.map((button) => BUTTON_META[button].label).join('、')}>
                        {linked.length} 键
                      </span>
                    )}
                    <button
                      type="button"
                      className="macro-item-menu"
                      aria-label={`删除宏 ${macro.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget(macro);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="macro-library-tip">
            <Info size={14} />
            <span>网页版备份会包含宏；HECATE 兼容 JSON 暂不写入宏数据。</span>
          </div>
        </section>

        <section className="panel macro-editor">
          {selectedMacro ? (
            <>
              <div className="macro-editor-head">
                <div className="macro-name-field">
                  <span className="section-kicker">MACRO NAME</span>
                  <input
                    type="text"
                    value={selectedMacro.name}
                    aria-label="宏名称"
                    maxLength={28}
                    onChange={(event) => updateSelected({ name: event.target.value })}
                    onBlur={() => {
                      if (!selectedMacro.name.trim()) updateSelected({ name: '未命名宏' });
                    }}
                  />
                </div>
                <div className="macro-editor-stats">
                  <span>{selectedMacro.actions.length} 动作</span>
                  <span>{(totalDuration / 1000).toFixed(2)} s</span>
                  <span>循环 {selectedMacro.repeat} 次</span>
                </div>
                <button
                  type="button"
                  className="icon-button ghost danger-hover"
                  aria-label="删除当前宏"
                  title="删除当前宏"
                  onClick={() => setDeleteTarget(selectedMacro)}
                >
                  <Trash2 size={17} />
                </button>
              </div>

              <div className="macro-toolbar">
                <button type="button" className="primary-button small" onClick={openRecord}>
                  <Keyboard size={15} />
                  录制按键
                </button>
                <button type="button" className="outline-button small" onClick={addDelay}>
                  <Timer size={15} />
                  插入延迟
                </button>
                <div className="macro-mouse-insert">
                  <span>鼠标点击</span>
                  {BUTTON_ORDER.map((button) => (
                    <button
                      key={button}
                      type="button"
                      title={`插入${BUTTON_META[button].label}点击`}
                      onClick={() => addMouseClick(button)}
                    >
                      <Mouse size={12} />
                      {BUTTON_META[button].shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              {selectedMacro.actions.length === 0 ? (
                <div className="macro-empty-actions">
                  <div className="empty-icon">
                    <ListPlus size={24} />
                  </div>
                  <h3>动作序列为空</h3>
                  <p>按下「录制按键」捕获键盘输入，或手动插入延迟与鼠标点击。</p>
                  <button type="button" className="ghost-button small" onClick={openRecord}>
                    <Keyboard size={15} />
                    开始录制
                  </button>
                </div>
              ) : (
                <div className="macro-timeline">
                  {selectedMacro.actions.map((action, index) => {
                    const Icon =
                      action.type === 'key' ? Keyboard : action.type === 'mouse' ? Mouse : Timer;
                    return (
                      <div
                        key={action.id}
                        className={cx('macro-action', `is-${action.type}`)}
                      >
                        <span className="macro-action-index">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="macro-action-icon">
                          <Icon size={15} />
                        </span>
                        <span className="macro-action-copy">
                          <strong>{actionTitle(action)}</strong>
                          <small>{actionCaption(action)}</small>
                        </span>
                        {action.type !== 'delay' && (
                          <span className={cx('event-pill', action.event === 'up' && 'is-up')}>
                            {action.event === 'down' ? 'DOWN' : 'UP'}
                          </span>
                        )}
                        <DelayField
                          value={action.delay}
                          onCommit={(delay) => updateAction(action.id, { delay })}
                          label={`第 ${index + 1} 个动作的延迟`}
                        />
                        <div className="macro-action-tools">
                          <button
                            type="button"
                            aria-label="上移动作"
                            disabled={index === 0}
                            onClick={() => moveAction(index, -1)}
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            aria-label="下移动作"
                            disabled={index === selectedMacro.actions.length - 1}
                            onClick={() => moveAction(index, 1)}
                          >
                            <ArrowDown size={13} />
                          </button>
                          <button
                            type="button"
                            className="is-danger"
                            aria-label="删除动作"
                            onClick={() => removeAction(action.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="macro-settings">
                <div className="macro-setting">
                  <div className="macro-setting-label">
                    <Repeat size={16} />
                    <span>
                      <strong>循环次数</strong>
                      <small>执行完序列后的重复次数</small>
                    </span>
                  </div>
                  <RepeatStepper
                    value={selectedMacro.repeat}
                    onChange={(repeat) => updateSelected({ repeat })}
                  />
                </div>
                <div className="macro-setting">
                  <div className="macro-setting-label">
                    <Square size={15} />
                    <span>
                      <strong>停止方式</strong>
                      <small>如何结束正在执行的宏</small>
                    </span>
                  </div>
                  <Segmented
                    compact
                    options={[
                      { value: 'once', label: '执行完成', caption: '按次数结束' },
                      { value: 'release', label: '松开停止', caption: '松开触发键' },
                    ]}
                    value={selectedMacro.stopMode}
                    onChange={(value) =>
                      updateSelected({ stopMode: value as Macro['stopMode'] })
                    }
                    label="宏停止方式"
                  />
                </div>
              </div>

              <div className="macro-assign">
                <div className="control-label-row">
                  <span>指派到鼠标按键</span>
                  <small>点击按键即可绑定当前宏</small>
                </div>
                <div className="macro-assign-grid">
                  {BUTTON_ORDER.map((button) => {
                    const binding = profile.bindings[button];
                    const assigned = binding.kind === 'macro' && binding.macroId === selectedMacro.id;
                    return (
                      <button
                        key={button}
                        type="button"
                        className={cx('macro-assign-button', assigned && 'is-active')}
                        aria-pressed={assigned}
                        onClick={() => onAssignMacro(button, selectedMacro.id)}
                      >
                        <span>{BUTTON_META[button].index}</span>
                        <span>
                          <strong>{BUTTON_META[button].shortLabel}</strong>
                          <small>{assigned ? '当前已绑定' : '点击指派'}</small>
                        </span>
                        {assigned && <Check size={14} />}
                      </button>
                    );
                  })}
                </div>
                {assignedButtons.length > 0 && (
                  <div className="macro-assigned-note">
                    <Play size={13} />
                    已绑定到：{assignedButtons.map((button) => BUTTON_META[button].label).join('、')}
                  </div>
                )}
              </div>

              <div className="macro-editor-footer">
                <Info size={13} />
                <span>按下已绑定的鼠标按键即可执行宏；网页版无法在本机模拟执行。</span>
              </div>
            </>
          ) : (
            <div className="macro-editor-empty">
              <div className="empty-orbit">
                <Workflow size={30} />
              </div>
              <h3>选择一个宏开始编辑</h3>
              <p>在左侧选择已有宏，或新建一个宏来录制按键序列。</p>
              <button type="button" className="primary-button" onClick={addMacro}>
                <Plus size={16} />
                新建宏
              </button>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={recordOpen}
        onClose={finishRecording}
        title="录制宏"
        description="在录制过程中按下键盘按键，系统会记录按下与松开的顺序及间隔。按 Esc 结束录制。"
        size="wide"
        footer={
          <>
            <button type="button" className="ghost-button" onClick={() => setRecordOpen(false)}>
              放弃录制
            </button>
            <button type="button" className="primary-button" onClick={finishRecording}>
              <Check size={15} />
              完成录制
            </button>
          </>
        }
      >
        <div className="record-stage">
          <div className="record-status">
            <span className="record-live">
              <span className="record-dot" />
              正在录制
            </span>
            <span className="record-timer">{elapsedLabel}</span>
            <span className="record-count">{draft.length} / {MAX_RECORD_ACTIONS} 个动作</span>
          </div>

          <div className="record-pad">
            <div className="record-pulse">
              <Keyboard size={30} />
            </div>
            <strong>请按下键盘按键</strong>
            <span>支持组合键，每次按下与松开都会生成动作</span>
          </div>

          <div className="record-stream">
            {draft.length === 0 ? (
              <div className="record-stream-empty">等待第一个按键…</div>
            ) : (
              draft.slice(-10).map((action) => (
                <span
                  key={action.id}
                  className={cx('record-token', action.type === 'delay' && 'is-delay')}
                >
                  {action.type === 'key' && (
                    <>
                      <kbd>{action.label}</kbd>
                      <small>{action.event === 'down' ? '↓' : '↑'}</small>
                      <em>{action.delay}ms</em>
                    </>
                  )}
                  {action.type === 'mouse' && (
                    <>
                      <Mouse size={12} />
                      <small>{BUTTON_META[action.button].shortLabel}</small>
                      <em>{action.delay}ms</em>
                    </>
                  )}
                  {action.type === 'delay' && (
                    <>
                      <Timer size={12} />
                      <small>{action.delay}ms</small>
                    </>
                  )}
                </span>
              ))
            )}
          </div>

          {limitHit && (
            <div className="inline-note is-warning">
              <Info size={14} />
              已达到 {MAX_RECORD_ACTIONS} 个动作上限，请完成录制或精简序列。
            </div>
          )}

          <p className="record-tip">
            提示：默认会在现有动作后继续追加。录制时浏览器快捷键会被临时拦截。
          </p>
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="删除这个宏？"
        description={
          deleteTarget
            ? `「${deleteTarget.name}」及其 ${deleteTarget.actions.length} 个动作将被移除。${
                deleteLinkedCount > 0 ? '绑定它的按键会变为未分配，左键将恢复默认。' : ''
              }`
            : undefined
        }
        size="compact"
        tone="danger"
        footer={
          <>
            <button type="button" className="ghost-button" onClick={() => setDeleteTarget(null)}>
              取消
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={() => {
                if (!deleteTarget) return;
                onDeleteMacro(deleteTarget.id);
                if (selectedId === deleteTarget.id) setSelectedId(null);
                setDeleteTarget(null);
              }}
            >
              <Trash2 size={15} />
              删除宏
            </button>
          </>
        }
      />
    </div>
  );
}
