import {
  Activity,
  Check,
  Cpu,
  Gauge,
  Info,
  MousePointer2,
  MoveVertical,
  RotateCcw,
  Sparkles,
  Timer,
} from 'lucide-react';
import { useState } from 'react';
import { DeviceWriteButton } from '../components/DeviceWriteButton';
import { PageHeader } from '../components/PageHeader';
import { Modal, Range, Segmented, Toggle } from '../components/ui';
import { BUTTON_DELAY_OPTIONS, createDefaultPerformance, MODEL_INFO } from '../defaults';
import { POLLING_OPTIONS } from '../functions';
import type { HecateController } from '../hid/useHecateDevice';
import type { PerformanceSettings, PollingRate, Profile, ToastMessage } from '../types';
import { cx } from '../utils';

interface PerformancePageProps {
  profile: Profile;
  onChange: (performance: PerformanceSettings) => void;
  device: HecateController;
  notify: (toast: Omit<ToastMessage, 'id'>) => void;
  onOpenDevice: () => void;
}

const SCROLL_OPTIONS = [
  { value: 1, label: '1 行', caption: '精细' },
  { value: 2, label: '2 行', caption: '标准' },
  { value: 3, label: '3 行', caption: '快速' },
];

export function PerformancePage({
  profile,
  onChange,
  device,
  notify,
  onOpenDevice,
}: PerformancePageProps) {
  const performance = profile.performance;
  const [resetOpen, setResetOpen] = useState(false);

  const update = (patch: Partial<PerformanceSettings>) => {
    onChange({ ...performance, ...patch });
  };

  const polling =
    POLLING_OPTIONS.find((option) => option.value === performance.pollingRate) ?? POLLING_OPTIONS[3];
  const corrections = [performance.lineCorrection, performance.rippleCorrection].filter(
    Boolean,
  ).length;

  return (
    <div className="page performance-page">
      <PageHeader
        kicker="SENSOR · POLLING · RESPONSE"
        title="性能与校准"
        description="回报率、去抖、LOD 与直线/波纹修正可直接写入鼠标；Windows 指针、滚轮与双击速度属于系统设置，仅保存在本机配置。"
        actions={
          <>
            <DeviceWriteButton
              device={device}
              profile={profile}
              sections={{ bindings: false, dpi: false, performance: true }}
              title="性能设置"
              description="将回报率、去抖延时、静默高度与传感器修正写入鼠标板载配置，并即时应用回报率。"
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
            <Gauge size={18} />
          </div>
          <div>
            <span>USB 回报率</span>
            <strong>
              {performance.pollingRate.toLocaleString('en-US')}
              <small> Hz</small>
            </strong>
            <em>{polling.latency} 理论输入间隔</em>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Timer size={18} />
          </div>
          <div>
            <span>按键响应延时</span>
            <strong>
              {performance.buttonDelay}
              <small> ms</small>
            </strong>
            <em>去抖后触发延迟</em>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Cpu size={18} />
          </div>
          <div>
            <span>传感器</span>
            <strong className="is-text">{MODEL_INFO.sensor}</strong>
            <em>{MODEL_INFO.maxDpi} · 光学引擎</em>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Activity size={18} />
          </div>
          <div>
            <span>运动修正</span>
            <strong>
              {corrections}
              <small> / 2</small>
            </strong>
            <em>{corrections ? '已启用部分修正' : '原始输入，无修正'}</em>
          </div>
        </div>
      </div>

      <div className="performance-grid">
        <section className="panel polling-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">REPORT RATE</span>
              <h2>回报率</h2>
            </div>
            <span className="panel-note">USB 有线模式</span>
          </div>

          <div className="polling-hero">
            <div className="polling-readout">
              <span>REPORTS / SECOND</span>
              <strong>
                {performance.pollingRate.toLocaleString('en-US')}
                <small> Hz</small>
              </strong>
              <em>每次上报间隔约 {polling.latency}</em>
            </div>
            <div className="polling-bars" aria-hidden="true">
              {Array.from({ length: 30 }, (_, index) => (
                <i
                  key={index}
                  style={{
                    height: `${18 + Math.sin(index * 0.85) * 12 + (index % 4) * 9}%`,
                    animationDelay: `${index * 45}ms`,
                  }}
                />
              ))}
            </div>
          </div>

          <Segmented
            options={POLLING_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
              caption: option.latency,
            }))}
            value={performance.pollingRate}
            onChange={(value) => update({ pollingRate: value as PollingRate })}
            label="USB 回报率"
          />

          <div className="inline-note">
            <Info size={14} />
            回报率越高，延迟越低，但功耗也会增加。无线模式受接收器与电池状态影响，实际回报率可能低于设定值。
          </div>
        </section>

        <section className="panel response-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">CLICK RESPONSE</span>
              <h2>按键响应</h2>
            </div>
          </div>

          <div className="setting-block">
            <div className="control-label-row">
              <span>去抖延时</span>
              <small>越低触发越快</small>
            </div>
            <Segmented
              compact
              options={BUTTON_DELAY_OPTIONS.map((delay) => ({
                value: delay,
                label: `${delay} ms`,
              }))}
              value={performance.buttonDelay}
              onChange={(value) => update({ buttonDelay: Number(value) })}
              label="按键去抖延时"
            />
            <p className="setting-hint">
              数值过小可能让老化的微动产生双击，数值过大则手感变钝。建议保留 4–6 ms。
            </p>
          </div>

          <div className="setting-block">
            <div className="control-label-row">
              <span>静默高度 LOD</span>
              <small>抬升停止追踪的距离</small>
            </div>
            <div className="choice-cards">
              {([1, 2, 3] as const).map((height) => (
                <button
                  key={height}
                  type="button"
                  className={cx('choice-card', performance.sensorHeight === height && 'is-active')}
                  aria-pressed={performance.sensorHeight === height}
                  onClick={() => update({ sensorHeight: height })}
                >
                  <span className="choice-card-icon">
                    <MoveVertical size={17} />
                  </span>
                  <span>
                    <strong>{height} mm</strong>
                    <small>
                      {height === 1
                        ? '低抬升，快速复位'
                        : height === 2
                          ? '平衡容错与小幅度复位'
                          : '高容错，适合大幅甩枪'}
                    </small>
                  </span>
                  {performance.sensorHeight === height && <Check size={15} />}
                </button>
              ))}
            </div>
          </div>

          <div className="response-note">
            <Sparkles size={15} />
            <span>PAW3395 支持 1–3 mm 静默高度；连接鼠标后，LOD 会与去抖设置一起写入板载配置。</span>
          </div>
        </section>
      </div>

      <div className="performance-grid">
        <section className="panel calibration-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">SENSOR TUNING</span>
              <h2>传感器校准</h2>
            </div>
            <span className="panel-note">默认全部关闭</span>
          </div>

          <div className="calibration-list">
            <div className="calibration-row">
              <span className="calibration-icon">
                <Activity size={17} />
              </span>
              <div className="calibration-copy">
                <strong>直线修正</strong>
                <span>将接近水平的移动拉直为水平线，适合办公，不建议 FPS 使用。</span>
              </div>
              <Toggle
                checked={performance.lineCorrection}
                onChange={(next) => update({ lineCorrection: next })}
                label="直线修正"
              />
            </div>
            <div className="calibration-row">
              <span className="calibration-icon">
                <MousePointer2 size={17} />
              </span>
              <div className="calibration-copy">
                <strong>波纹修正</strong>
                <span>平滑低速移动中的细小抖动，会略微增加输入延迟。</span>
              </div>
              <Toggle
                checked={performance.rippleCorrection}
                onChange={(next) => update({ rippleCorrection: next })}
                label="波纹修正"
              />
            </div>
          </div>

          <div className="inline-note">
            保持两项关闭可以获得最原始的传感器输入。官方驱动的配置写入中角度捕捉始终为关闭，固件不提供该开关。
          </div>
        </section>

        <section className="panel system-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">WINDOWS POINTER</span>
              <h2>指针与滚轮</h2>
            </div>
            <span className="panel-note">Windows 系统设置</span>
          </div>

          <div className="inline-note">
            <Info size={14} />
            指针速度、滚轮行数与双击速度由 Windows 控制，网页无法写入鼠标固件，也不会自动修改系统设置；这些值仅随配置保存。
          </div>

          <div className="slider-setting">
            <div className="control-label-row">
              <span>指针移动速度</span>
              <div className="inline-value">
                <strong>{performance.pointerSpeed}</strong>
                <small>/ 11</small>
              </div>
            </div>
            <Range
              min={1}
              max={11}
              value={performance.pointerSpeed}
              onChange={(value) => update({ pointerSpeed: value })}
              label="指针移动速度"
              ariaValueText={`第 ${performance.pointerSpeed} 档`}
            />
            <div className="range-scale">
              <span>慢</span>
              <span>Windows 默认 6</span>
              <span>快</span>
            </div>
          </div>

          <div className="editor-switch-row">
            <div>
              <strong>提高指针精确度</strong>
              <span>开启 Windows 指针加速，会改变手感一致性</span>
            </div>
            <Toggle
              checked={performance.enhancePrecision}
              onChange={(next) => update({ enhancePrecision: next })}
              label="提高指针精确度"
            />
          </div>

          <div className="setting-divider" />

          <div className="setting-block is-compact">
            <div className="control-label-row">
              <span>垂直滚动行数</span>
              <small>每格滚轮</small>
            </div>
            <Segmented
              compact
              options={SCROLL_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
                caption: option.caption,
              }))}
              value={performance.scrollSpeed}
              onChange={(value) => update({ scrollSpeed: Number(value) })}
              label="垂直滚动行数"
            />
          </div>

          <div className="editor-switch-row">
            <div>
              <strong>一次滚动一屏</strong>
              <span>忽略上面的行数设置，每格滚动整页</span>
            </div>
            <Toggle
              checked={performance.scrollFullPage}
              onChange={(next) => update({ scrollFullPage: next })}
              label="一次滚动一屏"
            />
          </div>

          <div className="setting-divider" />

          <div className="slider-setting">
            <div className="control-label-row">
              <span>双击速度</span>
              <div className="inline-value">
                <strong>{performance.doubleClickSpeed}</strong>
                <small>/ 11</small>
              </div>
            </div>
            <Range
              min={1}
              max={11}
              value={performance.doubleClickSpeed}
              onChange={(value) => update({ doubleClickSpeed: value })}
              label="双击速度"
              ariaValueText={`第 ${performance.doubleClickSpeed} 档`}
            />
          </div>
        </section>
      </div>

      <section className="panel runtime-panel">
        <div className="runtime-copy">
          <span className="section-kicker">ONBOARD MEMORY</span>
          <h2>硬件写入范围</h2>
          <p>
            连接鼠标后，可把回报率、去抖、LOD 与直线/波纹修正写入板载配置，并即时应用回报率；
            写入完成后会自动回读核对。Windows 指针、滚轮与双击速度仍由系统管理。
          </p>
        </div>
        <div className="runtime-list">
          <div className="runtime-item is-ok">
            <Check size={15} />
            <span>回报率写入</span>
            <strong>可用</strong>
          </div>
          <div className="runtime-item is-ok">
            <Check size={15} />
            <span>LOD / 去抖 / 传感器修正</span>
            <strong>可用</strong>
          </div>
          <div className="runtime-item is-ok">
            <Check size={15} />
            <span>浏览器本地保存</span>
            <strong>可用</strong>
          </div>
          <div className="runtime-item">
            <Info size={15} />
            <span>Windows 指针与滚轮</span>
            <strong>系统设置</strong>
          </div>
          <div className="runtime-item">
            <Info size={15} />
            <span>实时回报率测试</span>
            <strong>未实现</strong>
          </div>
        </div>
      </section>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="恢复默认性能设置？"
        description="回报率、传感器校准、去抖延时与指针设置将恢复为出厂默认值。"
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
                onChange(createDefaultPerformance());
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
