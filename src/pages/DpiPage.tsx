import {
  Crosshair,
  Layers3,
  RotateCcw,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { type CSSProperties, useId, useState } from 'react';
import { DeviceWriteButton } from '../components/DeviceWriteButton';
import { PageHeader } from '../components/PageHeader';
import { Modal, Range, Toggle } from '../components/ui';
import {
  createDefaultDpi,
  DPI_COLORS,
  DPI_STAGE_COUNT,
  MAX_DPI,
  MIN_DPI,
} from '../defaults';
import type { MouseController } from '../hid/useMouseDevice';
import type { DpiSettings, DpiStage, Profile, ToastMessage } from '../types';
import { clamp, cx, hexToRgba } from '../utils';

interface DpiPageProps {
  profile: Profile;
  onChange: (dpi: DpiSettings) => void;
  device: MouseController;
  notify: (toast: Omit<ToastMessage, 'id'>) => void;
  onOpenDevice: () => void;
}

function snapDpi(value: number): number {
  return clamp(Math.round(value / 50) * 50, MIN_DPI, MAX_DPI);
}

function dpiToSlider(value: number): number {
  const ratio = Math.log(value / MIN_DPI) / Math.log(MAX_DPI / MIN_DPI);
  return Math.round(clamp(ratio, 0, 1) * 1000);
}

function sliderToDpi(value: number): number {
  const ratio = value / 1000;
  return snapDpi(MIN_DPI * Math.pow(MAX_DPI / MIN_DPI, ratio));
}

function DpiNumberInput({
  value,
  onCommit,
  label,
}: {
  value: number;
  onCommit: (next: number) => void;
  label: string;
}) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);

  const commit = () => {
    const parsed = Number(text);
    if (Number.isFinite(parsed)) {
      const next = snapDpi(parsed);
      onCommit(next);
      setText(String(next));
    } else {
      setText(String(value));
    }
    setEditing(false);
  };

  return (
    <input
      className="dpi-number-input"
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={editing ? text : value.toLocaleString('en-US')}
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
  );
}

function DpiChart({
  dpi,
  selectedStage,
  onSelectStage,
}: {
  dpi: DpiSettings;
  selectedStage: number;
  onSelectStage: (index: number) => void;
}) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const width = 780;
  const height = 244;
  const padding = { left: 58, right: 22, top: 24, bottom: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const logMin = Math.log(MIN_DPI);
  const logMax = Math.log(MAX_DPI);

  const xFor = (index: number) => padding.left + (index * plotWidth) / (DPI_STAGE_COUNT - 1);
  const yFor = (value: number) =>
    padding.top + (1 - (Math.log(clamp(value, MIN_DPI, MAX_DPI)) - logMin) / (logMax - logMin)) * plotHeight;

  const points = dpi.stages.map((stage, index) => ({
    x: xFor(index),
    y: yFor(stage.dpiX),
    stage,
    index,
  }));
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L${xFor(DPI_STAGE_COUNT - 1)} ${padding.top + plotHeight} L${points[0].x} ${
    padding.top + plotHeight
  } Z`;

  const ticks = [400, 1600, 6400, 26000];
  const selected = points[selectedStage] ?? points[2];
  const active = points[dpi.activeStage] ?? points[2];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="dpi-chart"
      role="img"
      aria-label="七档 DPI 曲线图"
    >
      <defs>
        <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(46, 230, 197, 0.28)" />
          <stop offset="100%" stopColor="rgba(46, 230, 197, 0)" />
        </linearGradient>
        <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#41b7ff" />
          <stop offset="52%" stopColor="#2ee6c5" />
          <stop offset="100%" stopColor="#c3ffe9" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {ticks.map((tick) => {
        const y = yFor(tick);
        return (
          <g key={tick}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="rgba(184, 255, 245, 0.075)"
              strokeDasharray="3 5"
            />
            <text x={padding.left - 10} y={y + 3.5} textAnchor="end" className="chart-axis-label">
              {tick >= 1000 ? `${tick / 1000}K` : tick}
            </text>
          </g>
        );
      })}

      <line
        x1={selected.x}
        y1={padding.top}
        x2={selected.x}
        y2={padding.top + plotHeight}
        stroke="rgba(46, 230, 197, 0.24)"
        strokeDasharray="4 5"
      />
      <line
        x1={padding.left}
        y1={selected.y}
        x2={width - padding.right}
        y2={selected.y}
        stroke={hexToRgba(selected.stage.color, 0.2)}
        strokeDasharray="2 6"
      />

      <path d={areaPath} fill={`url(#${id}-area)`} />
      <path
        d={linePath}
        fill="none"
        stroke={`url(#${id}-line)`}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {points.map((point) => {
        const isSelected = point.index === selectedStage;
        const isActive = point.index === dpi.activeStage;
        return (
          <g
            key={point.index}
            className="chart-point"
            onClick={() => onSelectStage(point.index)}
            role="button"
            tabIndex={0}
            aria-label={`选择第 ${point.index + 1} 档 ${point.stage.dpiX} DPI`}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectStage(point.index);
              }
            }}
          >
            {isSelected && (
              <circle
                cx={point.x}
                cy={point.y}
                r="13"
                fill={hexToRgba(point.stage.color, 0.12)}
                stroke={hexToRgba(point.stage.color, 0.3)}
              />
            )}
            <circle
              cx={point.x}
              cy={point.y}
              r={isSelected ? 5.5 : 4}
              fill={point.stage.enabled ? point.stage.color : '#223034'}
              stroke={point.stage.enabled ? 'rgba(5, 14, 16, 0.9)' : 'rgba(174, 205, 201, 0.3)'}
              strokeWidth="2"
              filter={isSelected ? `url(#${id}-glow)` : undefined}
            />
            {isActive && (
              <circle
                cx={point.x}
                cy={point.y}
                r="10"
                fill="none"
                stroke="rgba(255, 255, 255, 0.26)"
                strokeWidth="1"
              />
            )}
            <text
              x={point.x}
              y={height - 12}
              textAnchor="middle"
              className={cx('chart-stage-label', isSelected && 'is-selected', isActive && 'is-active')}
            >
              {point.index + 1}
            </text>
          </g>
        );
      })}

      <g className="chart-tooltip" aria-hidden="true">
        <rect
          x={clamp(selected.x - 48, padding.left, width - padding.right - 96)}
          y={Math.max(6, selected.y - 42)}
          width="96"
          height="28"
          rx="8"
          fill="rgba(6, 15, 17, 0.92)"
          stroke="rgba(46, 230, 197, 0.18)"
        />
        <text
          x={clamp(selected.x, padding.left + 48, width - padding.right - 48)}
          y={Math.max(24, selected.y - 23)}
          textAnchor="middle"
          className="chart-tooltip-text"
        >
          {selected.stage.dpiX.toLocaleString('en-US')} DPI
        </text>
      </g>

      <circle cx={active.x} cy={height - 26} r="2.2" className="chart-active-marker" />
    </svg>
  );
}

export function DpiPage({
  profile,
  onChange,
  device,
  notify,
  onOpenDevice,
}: DpiPageProps) {
  const dpi = profile.dpi;
  const [selectedStage, setSelectedStage] = useState(dpi.activeStage);
  const [resetOpen, setResetOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const stage = dpi.stages[selectedStage] ?? dpi.stages[0];
  const activeStage = dpi.stages[dpi.activeStage] ?? dpi.stages[0];
  const enabledCount = dpi.stages.filter((item) => item.enabled).length;
  const maxEnabled = Math.max(...dpi.stages.filter((item) => item.enabled).map((item) => item.dpiX), MIN_DPI);
  const isCurrentStage = selectedStage === dpi.activeStage;
  const rapoo = device.family === 'rapoo';

  const updateStage = (index: number, patch: Partial<DpiStage>) => {
    onChange({
      ...dpi,
      stages: dpi.stages.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  };

  const updateDpiValue = (value: number, axis: 'x' | 'y' = 'x') => {
    const next = snapDpi(value);
    if (axis === 'x') {
      updateStage(selectedStage, dpi.xYLinked ? { dpiX: next, dpiY: next } : { dpiX: next });
    } else {
      updateStage(selectedStage, { dpiY: next });
    }
  };

  const toggleLinked = (next: boolean) => {
    onChange({
      ...dpi,
      xYLinked: next,
      stages: next
        ? dpi.stages.map((item) => ({ ...item, dpiY: item.dpiX }))
        : dpi.stages,
    });
  };

  const toggleEnabled = (next: boolean) => {
    if (!next && enabledCount <= 1) {
      setNote('至少需要保留一个启用的 DPI 档位。');
      return;
    }
    setNote(null);
    updateStage(selectedStage, { enabled: next });
    if (!next && selectedStage === dpi.activeStage) {
      const fallback = dpi.stages.findIndex((item, index) => item.enabled && index !== selectedStage);
      if (fallback >= 0) onChange({ ...dpi, activeStage: fallback });
    }
  };

  const setAsActive = () => {
    onChange({
      ...dpi,
      activeStage: selectedStage,
      stages: dpi.stages.map((item, index) =>
        index === selectedStage ? { ...item, enabled: true } : item,
      ),
    });
    setNote(null);
  };

  return (
    <div className="page dpi-page">
      <PageHeader
        kicker="SENSITIVITY · PAW3395"
        title="DPI 设置"
        description={
          rapoo
            ? '配置 7 个 DPI 档位与 X/Y 灵敏度。Rapoo 接收器只发送已启用档位的 DPI 数值与当前档位；档位颜色仅保存在本机。'
            : '配置 7 个 DPI 档位、X/Y 灵敏度与档位颜色。滚轮后方的 DPI 按键会在这些档位之间循环，连接鼠标后可将档位与颜色写入板载配置。'
        }
        actions={
          <>
            <DeviceWriteButton
              device={device}
              profile={profile}
              sections={{ bindings: false, dpi: true, performance: false }}
              title={rapoo ? 'DPI 档位' : 'DPI 与档位颜色'}
              description={
                rapoo
                  ? '将已启用的 DPI 档位、X/Y 灵敏度与当前档位发送到 Rapoo 接收器。接收器无法回读确认。'
                  : '将 7 个 DPI 档位、X/Y 灵敏度、当前档位与档位颜色写入鼠标板载配置。'
              }
              onOpenDevice={onOpenDevice}
              notify={notify}
            />
            <button type="button" className="ghost-button" onClick={() => setResetOpen(true)}>
              <RotateCcw size={16} />
              恢复默认
            </button>
          </>
        }
      />

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <Crosshair size={18} />
          </div>
          <div>
            <span>当前档位</span>
            <strong>
              {activeStage.dpiX.toLocaleString('en-US')}
              <small> DPI</small>
            </strong>
            <em>档位 {dpi.activeStage + 1} · {activeStage.enabled ? '已启用' : '已停用'}</em>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <TrendingUp size={18} />
          </div>
          <div>
            <span>最高可用</span>
            <strong>
              {maxEnabled.toLocaleString('en-US')}
              <small> DPI</small>
            </strong>
            <em>传感器上限 26,000</em>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Layers3 size={18} />
          </div>
          <div>
            <span>启用档位</span>
            <strong>
              {enabledCount}
              <small> / 7</small>
            </strong>
            <em>步进 50 DPI</em>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Zap size={18} />
          </div>
          <div>
            <span>当前回报率</span>
            <strong>
              {profile.performance.pollingRate.toLocaleString('en-US')}
              <small> Hz</small>
            </strong>
            <em>{profile.performance.pollingRate === 1000 ? '1.0 ms 延迟' : '可在性能页调整'}</em>
          </div>
        </div>
      </div>

      <div className="dpi-layout">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">SENSITIVITY CURVE</span>
              <h2>DPI 曲线</h2>
            </div>
            <div className="chart-legend">
              <span><i className="legend-dot is-active" />当前档位</span>
              <span><i className="legend-dot" />编辑中</span>
            </div>
          </div>
          <DpiChart dpi={dpi} selectedStage={selectedStage} onSelectStage={setSelectedStage} />
        </section>

        <section className="panel stage-editor">
          <div className="stage-editor-heading">
            <div>
              <span className="section-kicker">STAGE {String(selectedStage + 1).padStart(2, '0')}</span>
              <h2>档位 {selectedStage + 1}</h2>
            </div>
            <div className="stage-enable">
              <span>{stage.enabled ? '启用' : '停用'}</span>
              <Toggle
                checked={stage.enabled}
                onChange={toggleEnabled}
                label={`启用第 ${selectedStage + 1} 档 DPI`}
              />
            </div>
          </div>

          <div className="dpi-value-display" style={{ '--stage-color': stage.color } as CSSProperties}>
            <span className="stage-color-orb" />
            <DpiNumberInput
              value={stage.dpiX}
              onCommit={updateDpiValue}
              label={`第 ${selectedStage + 1} 档 DPI`}
            />
            <span className="dpi-unit">DPI</span>
          </div>

          <Range
            min={0}
            max={1000}
            step={1}
            value={dpiToSlider(stage.dpiX)}
            onChange={(value) => updateDpiValue(sliderToDpi(value))}
            label={`第 ${selectedStage + 1} 档 DPI 滑杆`}
            ariaValueText={`${stage.dpiX} DPI`}
          />
          <div className="range-scale">
            <span>{MIN_DPI}</span>
            <span>13,000</span>
            <span>{MAX_DPI.toLocaleString('en-US')}</span>
          </div>

          <div className="editor-switch-row">
            <div>
              <strong>X / Y 轴联动</strong>
              <span>关闭后可分别设置水平与垂直灵敏度</span>
            </div>
            <Toggle checked={dpi.xYLinked} onChange={toggleLinked} label="X / Y 轴联动" />
          </div>

          {!dpi.xYLinked && (
            <div className="xy-inputs">
              <label>
                <span>X 轴</span>
                <DpiNumberInput
                  value={stage.dpiX}
                  onCommit={(value) => updateDpiValue(value, 'x')}
                  label={`第 ${selectedStage + 1} 档 X 轴 DPI`}
                />
              </label>
              <label>
                <span>Y 轴</span>
                <DpiNumberInput
                  value={stage.dpiY}
                  onCommit={(value) => updateDpiValue(value, 'y')}
                  label={`第 ${selectedStage + 1} 档 Y 轴 DPI`}
                />
              </label>
            </div>
          )}

          {!rapoo && (
            <div className="color-control">
              <div className="control-label-row">
                <span>档位颜色</span>
                <small>作为 HECATE 的 DPI 指示灯颜色写入鼠标</small>
              </div>
              <div className="color-swatches">
                {DPI_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cx('color-swatch', stage.color.toLowerCase() === color.toLowerCase() && 'is-active')}
                    style={{ background: color }}
                    aria-label={`使用颜色 ${color}`}
                    aria-pressed={stage.color.toLowerCase() === color.toLowerCase()}
                    onClick={() => updateStage(selectedStage, { color })}
                  />
                ))}
                <label className="custom-color" title="自定义颜色">
                  <input
                    type="color"
                    value={stage.color}
                    aria-label="自定义档位颜色"
                    onChange={(event) => updateStage(selectedStage, { color: event.target.value })}
                  />
                  <span style={{ background: stage.color }} />
                </label>
              </div>
            </div>
          )}

          {note && <div className="inline-note is-warning">{note}</div>}

          <button
            type="button"
            className={cx('primary-button full', isCurrentStage && 'is-muted')}
            onClick={setAsActive}
            disabled={isCurrentStage && stage.enabled}
          >
            {isCurrentStage && stage.enabled ? '这是当前档位' : '设为当前档位'}
          </button>
        </section>
      </div>

      <section className="panel stage-rail-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">STAGE OVERVIEW</span>
            <h2>七个档位</h2>
          </div>
          <span className="panel-note">
            {rapoo ? '点击编辑档位' : '点击编辑 · 颜色对应指示灯'}
          </span>
        </div>
        <div className="stage-rail">
          {dpi.stages.map((item, index) => {
            const isActive = index === dpi.activeStage;
            const isSelected = index === selectedStage;
            return (
              <button
                key={index}
                type="button"
                className={cx(
                  'stage-card',
                  isSelected && 'is-selected',
                  isActive && 'is-active',
                  !item.enabled && 'is-disabled',
                )}
                aria-pressed={isSelected}
                onClick={() => setSelectedStage(index)}
              >
                <span className="stage-topline" style={{ background: item.color }} />
                <span className="stage-card-head">
                  <span className="stage-number">档位 {index + 1}</span>
                  {isActive && <span className="stage-current">当前</span>}
                </span>
                <strong>{item.dpiX.toLocaleString('en-US')}</strong>
                <span className="stage-card-foot">
                  <i style={{ background: item.color }} />
                  {item.enabled ? 'DPI' : '已停用'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="恢复默认 DPI 设置？"
        description="7 个档位与 X/Y 轴设置将恢复为默认值。"
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
                onChange(createDefaultDpi());
                setSelectedStage(2);
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
