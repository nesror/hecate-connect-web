import { cx } from '../utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={cx('brand-mark', className)}
      viewBox="0 0 48 48"
      role="img"
      aria-label="HECATE Connect 网页版"
    >
      <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <path d="M24 4.5a19.5 19.5 0 0 1 16.9 9.8" />
        <path d="M44.2 24a19.5 19.5 0 0 1-9.8 16.9" />
        <path d="M24 43.5a19.5 19.5 0 0 1-16.9-9.8" />
        <path d="M3.8 24a19.5 19.5 0 0 1 9.8-16.9" />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M17.5 16.5v15" />
        <path d="M30.5 16.5v15" />
        <path d="M17.5 24h13" />
      </g>
    </svg>
  );
}

export function Brand() {
  return (
    <div className="brand">
      <BrandMark />
      <div className="brand-copy">
        <div className="brand-name">
          HECATE <span>Connect</span>
        </div>
        <div className="brand-subtitle">Web Configuration</div>
      </div>
      <span className="brand-badge">WEB</span>
    </div>
  );
}
