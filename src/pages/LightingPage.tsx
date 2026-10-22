import {
  ArrowRight,
  Check,
  CircleDot,
  Info,
  Lightbulb,
  MousePointerClick,
  Palette,
  Power,
  RotateCcw,
  Waves,
} from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { MouseIllustration } from '../components/MouseIllustration';
import { PageHeader } from '../components/PageHeader';
import { Modal, Range, Segmented, Toggle } from '../components/ui';
import { createDefaultDpi, DPI_COLORS } from '../defaults';
import type { DpiSettings, Profile } from '../types';
import { clamp, cx } from '../utils';

interface LightingPageProps {
  profile: Profile;
  onChange: (dpi: DpiSettings) => void;
  onNavigateDpi: () => void;
}

export function LightingPage({ profile, onChange, onNavigateDpi }: LightingPageProps) {
  const dpi = profile.dpi;
  const [selectedStage, setSelectedStage] = useState(dpi.activeStage);
  const [resetOpen, setResetOpen] = useState(false);

  const stage = dpi.stages[selectedStage] ?? dpi.stages[0];
  const indicator = dpi.indicator;
  const glow = indicator.enabled;

  const updateIndicator = (patch: Partial<DpiSettings['indicator']>) => {
    onChange({ ...dpi, indicator: { ...indicator, ...patch } });
  };

  const updateColor = (color: string) => {
    onChange({
      ...dpi,
      stages: dpi.stages.map((item, index) =>
        index === selectedStage ? { ...item, color } : item,
      ),
    });
  };

  return (
    <div className="page lighting-page">
      <PageHeader
        kicker="LIGHTING · DPI INDICATOR"
        title="灯效"
        description="G3M PRO 的灯光位于滚轮后方，仅作为 DPI 档位指示灯使用。调整模式、亮度并为每个档位指定颜色。"
        actions={
          <button type="button" className="ghost-button" onClick={() => setResetOpen(true)}>
            <RotateCcw size={16} />
            恢复默认
          </button>
        }
      />

      <div className="lighting-layout">
        <section className="panel lighting-preview-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">LIVE PREVIEW</span>
              <h2>指示灯预览</h2>
            </div>
            <span className={cx('light-status', glow ? 'is-on' : 'is-off')}>
              <span />
              {glow ? '灯光开启' : '灯光关闭'}
            </span>
          </div>

          <div
            className={cx('mouse-stage', 'lighting-stage', glow && 'is-glowing')}
            style={{ '--glow-color': stage.color } as CSSProperties}
          >
            <div className="mouse-halo is-lighting" />
            <MouseIllustration
              glowColor={stage.color}
              glow={glow}
              indicatorEffect={indicator.effect}
              showBadges={false}
            />
            <div className="lighting-float-chip">
              <span className="lighting-chip-swatch" style={{ background: stage.color }} />
              <span>
                <small>档位 {selectedStage + 1}</small>
                <strong>{stage.dpiX.toLocaleString('en-US')} DPI</strong>
              </span>
              <span className="lighting-chip-brightness">
                {glow ? `${indicator.brightness}%` : 'OFF'}
              </span>
            </div>
          </div>

          <div className="lighting-stage-rail" aria-label="选择 DPI 档位颜色">
            {dpi.stages.map((item, index) => {
              const selected = index === selectedStage;
              const active = index === dpi.activeStage;
              return (
                <button
                  key={index}
                  type="button"
                  className={cx(
                    'light-stage-chip',
                    selected && 'is-selected',
                    active && 'is-active',
                    !item.enabled && 'is-disabled',
                  )}
                  aria-pressed={selected}
                  onClick={() => setSelectedStage(index)}
                >
                  <span className="light-stage-swatch" style={{ background: item.color }}>
                    {selected && <Check size={11} />}
                  </span>
                  <span>
                    <strong>{index + 1}</strong>
                    <small>{item.dpiX >= 1000 ? `${item.dpiX / 1000}K` : item.dpiX}</small>
                  </span>
                  {active && <i className="light-stage-current" title="当前 DPI 档位" />}
                </button>
              );
            })}
          </div>

          <p className="preview-disclaimer">
            <Info size={14} />
            预览仅为网页示意，实际亮度与色彩会因鼠标电量、灯光导光结构而略有差异。
          </p>
        </section>

        <section className="panel lighting-control-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">INDICATOR CONTROL</span>
              <h2>指示灯控制</h2>
            </div>
          </div>

          <div className="lighting-master">
            <span className={cx('lighting-master-icon', glow && 'is-on')}>
              <Power size={19} />
            </span>
            <div>
              <strong>DPI 指示灯</strong>
              <span>关闭后滚轮后方灯光完全熄灭，不影响 DPI 切换</span>
            </div>
            <Toggle
              checked={indicator.enabled}
              onChange={(next) => updateIndicator({ enabled: next })}
              label="DPI 指示灯"
            />
          </div>

          <div className="setting-block">
            <div className="control-label-row">
              <span>灯光模式</span>
              <small>呼吸效果会在当前档位颜色上渐亮渐暗</small>
            </div>
            <Segmented
              options={[
                { value: 'solid', label: '常亮', caption: '稳定显示' },
                { value: 'breath', label: '呼吸', caption: '缓慢明暗' },
              ]}
              value={indicator.effect}
              onChange={(value) => updateIndicator({ effect: value as 'solid' | 'breath' })}
              label="灯光模式"
            />
          </div>

          <div className="setting-block">
            <div className="control-label-row">
              <span>亮度</span>
              <div className="inline-value">
                <strong>{indicator.brightness}</strong>
                <small>%</small>
              </div>
            </div>
            <Range
              min={0}
              max={100}
              step={5}
              value={indicator.brightness}
              onChange={(value) => updateIndicator({ brightness: clamp(value, 0, 100) })}
              label="指示灯亮度"
              ariaValueText={`${indicator.brightness}%`}
            />
            <div className="range-scale">
              <span>柔和</span>
              <span>50%</span>
              <span>明亮</span>
            </div>
          </div>

          <div className="setting-divider" />

          <div className="setting-block">
            <div className="control-label-row">
              <span>档位颜色 · 档位 {selectedStage + 1}</span>
              <small>{stage.dpiX.toLocaleString('en-US')} DPI</small>
            </div>
            <div className="color-swatches">
              {DPI_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={cx('color-swatch', stage.color.toLowerCase() === color.toLowerCase() && 'is-active')}
                  style={{ background: color }}
                  aria-label={`将档位 ${selectedStage + 1} 设为 ${color}`}
                  aria-pressed={stage.color.toLowerCase() === color.toLowerCase()}
                  onClick={() => updateColor(color)}
                >
                  {stage.color.toLowerCase() === color.toLowerCase() && <Check size={13} />}
                </button>
              ))}
              <label className="custom-color" title="自定义颜色">
                <input
                  type="color"
                  value={stage.color}
                  aria-label={`自定义档位 ${selectedStage + 1} 的颜色`}
                  onChange={(event) => updateColor(event.target.value)}
                />
                <span style={{ background: stage.color }}>
                  <Palette size={12} />
                </span>
              </label>
            </div>
          </div>

          <button type="button" className="ghost-button full" onClick={onNavigateDpi}>
            在 DPI 设置中调整档位
            <ArrowRight size={15} />
          </button>
        </section>
      </div>

      <div className="feature-grid">
        <div className="feature-card">
          <span className="feature-icon">
            <CircleDot size={18} />
          </span>
          <div>
            <span className="section-kicker">SINGLE ZONE</span>
            <h3>单一指示灯</h3>
            <p>G3M PRO 没有分区 RGB 或底部灯带，网页版不会虚构不存在的灯效区域。</p>
          </div>
        </div>
        <div className="feature-card">
          <span className="feature-icon">
            <Waves size={18} />
          </span>
          <div>
            <span className="section-kicker">COLOR PER STAGE</span>
            <h3>颜色跟随档位</h3>
            <p>切换 DPI 时，指示灯会直接切换为该档位指定的颜色，便于盲操确认。</p>
          </div>
        </div>
        <div className="feature-card">
          <span className="feature-icon">
            <MousePointerClick size={18} />
          </span>
          <div>
            <span className="section-kicker">NO HARDWARE WRITE</span>
            <h3>仅预览与保存</h3>
            <p>灯光参数保存在浏览器配置中；网页无法实时控制鼠标 LED，请使用原生驱动应用。</p>
          </div>
        </div>
      </div>

      <section className="panel lighting-note">
        <span className="lighting-note-icon">
          <Lightbulb size={20} />
        </span>
        <div>
          <strong>关于 G3M PRO 灯光</strong>
          <p>
            该型号的灯光仅用于显示当前 DPI 档位，不包含音乐律动、屏幕拾色或流光灯效。为保证配置真实可用，
            网页版没有加入这些模拟功能。
          </p>
        </div>
      </section>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="恢复默认灯效？"
        description="指示灯将重新开启，恢复常亮模式与 70% 亮度。各档位颜色保持不变。"
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
                onChange({ ...dpi, indicator: createDefaultDpi().indicator });
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
