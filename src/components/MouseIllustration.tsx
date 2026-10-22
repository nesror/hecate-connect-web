import { type KeyboardEvent, useId } from 'react';
import type { ButtonId } from '../types';
import { BUTTON_META, BUTTON_ORDER } from '../functions';
import { cx, hexToRgba } from '../utils';

interface MouseIllustrationProps {
  selected?: ButtonId | null;
  onSelect?: (button: ButtonId) => void;
  glowColor?: string;
  glow?: boolean;
  indicatorEffect?: 'solid' | 'breath';
  className?: string;
  showBadges?: boolean;
}

const BODY_PATH =
  'M180 26C225 26 264 40 283 68C303 98 314 152 315 212C316 276 307 336 291 384C274 434 237 490 210 512C198 522 190 528 180 528C170 528 162 522 150 512C123 490 86 434 69 384C53 336 44 276 45 212C46 152 57 98 77 68C96 40 135 26 180 26Z';

const LEFT_BUTTON =
  'M180 30C136 30 98 44 80 72C61 102 50 154 50 210C50 230 62 244 86 249C113 254 146 257 176 258C179 258 180 256 180 252Z';

const RIGHT_BUTTON =
  'M180 30C224 30 262 44 280 72C299 102 310 154 310 210C310 230 298 244 274 249C247 254 214 257 184 258C181 258 180 256 180 252Z';

const FORWARD_BUTTON = 'M38 256H74V310H38C27 310 21 302 21 290V278C21 265 27 256 38 256Z';
const BACK_BUTTON = 'M36 318H72V372H36C25 372 19 364 19 351V339C19 326 25 318 36 318Z';

const BADGE_POSITIONS: Record<ButtonId, { x: number; y: number }> = {
  left: { x: 96, y: 186 },
  right: { x: 264, y: 186 },
  wheel: { x: 211, y: 100 },
  forward: { x: 56, y: 283 },
  back: { x: 54, y: 345 },
  dpi: { x: 214, y: 211 },
};

export function MouseIllustration({
  selected,
  onSelect,
  glowColor = '#2ee6c5',
  glow = false,
  indicatorEffect = 'solid',
  className,
  showBadges = true,
}: MouseIllustrationProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const bodyGradient = `${id}-body`;
  const buttonGradient = `${id}-button`;
  const buttonGradientRight = `${id}-button-right`;
  const sideGradient = `${id}-side`;
  const shellShine = `${id}-shine`;
  const wheelGradient = `${id}-wheel`;
  const dpiGradient = `${id}-dpi`;
  const ledGlow = `${id}-led-glow`;
  const logoGradient = `${id}-logo`;
  const blur = `${id}-blur`;
  const bodyClip = `${id}-clip`;

  const interactive = typeof onSelect === 'function';

  const activate = (button: ButtonId) => {
    onSelect?.(button);
  };

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>, button: ButtonId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate(button);
    }
  };

  const zoneProps = (button: ButtonId) =>
    interactive
      ? {
          role: 'button' as const,
          tabIndex: 0,
          'aria-label': `${BUTTON_META[button].label}（第 ${BUTTON_META[button].index} 键）`,
          onClick: () => activate(button),
          onKeyDown: (event: KeyboardEvent<SVGGElement>) => handleKeyDown(event, button),
        }
      : {};

  return (
    <svg
      viewBox="0 0 360 570"
      className={cx('mouse-illustration', className)}
      role="img"
      aria-label="HECATE G3M Pro 鼠标按键示意图"
    >
      <defs>
        <linearGradient id={bodyGradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#263234" />
          <stop offset="42%" stopColor="#182124" />
          <stop offset="100%" stopColor="#0a1012" />
        </linearGradient>
        <linearGradient id={buttonGradient} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#354245" />
          <stop offset="48%" stopColor="#1c2629" />
          <stop offset="100%" stopColor="#101719" />
        </linearGradient>
        <linearGradient id={buttonGradientRight} x1="0.9" y1="0" x2="0.1" y2="1">
          <stop offset="0%" stopColor="#313d40" />
          <stop offset="50%" stopColor="#1a2326" />
          <stop offset="100%" stopColor="#0f1618" />
        </linearGradient>
        <linearGradient id={sideGradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#39474a" />
          <stop offset="100%" stopColor="#11191b" />
        </linearGradient>
        <radialGradient id={shellShine} cx="50%" cy="22%" r="72%">
          <stop offset="0%" stopColor="rgba(186, 255, 245, 0.16)" />
          <stop offset="42%" stopColor="rgba(130, 210, 200, 0.035)" />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
        </radialGradient>
        <linearGradient id={wheelGradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b484b" />
          <stop offset="48%" stopColor="#101719" />
          <stop offset="100%" stopColor="#283235" />
        </linearGradient>
        <linearGradient id={dpiGradient} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2f7f3f" />
          <stop offset="38%" stopColor="#8fe88a" />
          <stop offset="70%" stopColor="#57c463" />
          <stop offset="100%" stopColor="#276b36" />
        </linearGradient>
        <linearGradient id={logoGradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(235, 255, 251, 0.88)" />
          <stop offset="100%" stopColor="rgba(152, 191, 185, 0.38)" />
        </linearGradient>
        <filter id={blur} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <radialGradient id={ledGlow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={glowColor} stopOpacity="0.55" />
          <stop offset="55%" stopColor={glowColor} stopOpacity="0.12" />
          <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
        </radialGradient>
        <clipPath id={bodyClip}>
          <path d={BODY_PATH} />
        </clipPath>
      </defs>

      <ellipse cx="180" cy="540" rx="112" ry="16" fill="rgba(0, 0, 0, 0.62)" filter={`url(#${blur})`} />

      <path
        d={BODY_PATH}
        fill={`url(#${bodyGradient})`}
        stroke="rgba(199, 255, 244, 0.14)"
        strokeWidth="1.2"
      />

      <g clipPath={`url(#${bodyClip})`}>
        <rect x="30" y="20" width="300" height="520" fill={`url(#${shellShine})`} />
        <path
          d="M78 300C106 270 140 262 180 262C220 262 254 270 282 300"
          fill="none"
          stroke="rgba(202, 255, 246, 0.07)"
          strokeWidth="1.5"
        />
        <path
          d="M84 474C117 501 145 517 180 520C215 517 243 501 276 474"
          fill="none"
          stroke="rgba(0, 0, 0, 0.5)"
          strokeWidth="10"
        />
        <path
          d="M60 220C56 306 74 398 119 467C139 499 164 517 180 522"
          fill="none"
          stroke="rgba(0, 0, 0, 0.28)"
          strokeWidth="16"
        />
        <path
          d="M300 220C304 306 286 398 241 467C221 499 196 517 180 522"
          fill="none"
          stroke="rgba(0, 0, 0, 0.22)"
          strokeWidth="16"
        />
        {glow && (
          <circle cx="180" cy="58" r="132" fill={`url(#${ledGlow})`} className="mouse-glow-wash" />
        )}
      </g>

      <g
        className={cx(
          'mouse-zone',
          'zone-main',
          interactive && 'is-interactive',
          selected === 'left' && 'is-selected',
        )}
        {...zoneProps('left')}
      >
        <title>左键</title>
        <path
          d={LEFT_BUTTON}
          fill={`url(#${buttonGradient})`}
          stroke="rgba(255, 255, 255, 0.075)"
          strokeWidth="1"
        />
        <path d={LEFT_BUTTON} className="zone-surface" />
      </g>

      <g
        className={cx(
          'mouse-zone',
          'zone-main',
          interactive && 'is-interactive',
          selected === 'right' && 'is-selected',
        )}
        {...zoneProps('right')}
      >
        <title>右键</title>
        <path
          d={RIGHT_BUTTON}
          fill={`url(#${buttonGradientRight})`}
          stroke="rgba(255, 255, 255, 0.075)"
          strokeWidth="1"
        />
        <path d={RIGHT_BUTTON} className="zone-surface" />
      </g>

      <path
        d="M180 31V251"
        fill="none"
        stroke="rgba(2, 8, 9, 0.92)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M50 210C63 242 114 254 176 257M184 257C246 254 297 242 310 210"
        fill="none"
        stroke="rgba(2, 8, 9, 0.45)"
        strokeWidth="1.6"
      />

      <g
        className={cx(
          'mouse-zone',
          'zone-wheel',
          interactive && 'is-interactive',
          selected === 'wheel' && 'is-selected',
        )}
        {...zoneProps('wheel')}
      >
        <title>滚轮中键</title>
        <rect x="160" y="76" width="40" height="96" rx="20" fill={`url(#${wheelGradient})`} stroke="rgba(0,0,0,0.65)" strokeWidth="1.4" />
        <rect x="167" y="84" width="26" height="80" rx="13" fill="rgba(0, 0, 0, 0.26)" />
        {Array.from({ length: 10 }, (_, index) => (
          <line
            key={index}
            x1="167"
            y1={89 + index * 8}
            x2="193"
            y2={89 + index * 8}
            stroke="rgba(224, 255, 250, 0.09)"
            strokeWidth="1.2"
          />
        ))}
        <rect x="155" y="71" width="50" height="106" rx="25" className="zone-surface wheel-surface" />
      </g>

      <g
        className={cx(
          'mouse-zone',
          'zone-dpi',
          interactive && 'is-interactive',
          selected === 'dpi' && 'is-selected',
        )}
        {...zoneProps('dpi')}
      >
        <title>DPI 键</title>
        <rect
          x="160"
          y="178"
          width="40"
          height="64"
          rx="20"
          fill="#0a1113"
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth="1"
        />
        <rect
          x="167"
          y="184"
          width="26"
          height="46"
          rx="13"
          fill={`url(#${dpiGradient})`}
          stroke="rgba(0, 0, 0, 0.55)"
          strokeWidth="1.2"
        />
        <rect x="171" y="189" width="7" height="33" rx="3.5" fill="rgba(255, 255, 255, 0.22)" />
        <g className={cx('dpi-led', glow && indicatorEffect === 'breath' && 'is-breathing')}>
          {glow && <circle cx="180" cy="250" r="16" fill={hexToRgba(glowColor, 0.22)} />}
          <circle cx="180" cy="250" r="3.2" fill={glow ? glowColor : '#39494b'} />
          {glow && (
            <circle
              cx="180"
              cy="250"
              r="6.5"
              fill="none"
              stroke={hexToRgba(glowColor, 0.4)}
              strokeWidth="1.2"
            />
          )}
        </g>
        <rect x="160" y="178" width="40" height="64" rx="20" className="zone-surface" />
      </g>

      <g
        className={cx(
          'mouse-zone',
          'zone-side',
          interactive && 'is-interactive',
          selected === 'forward' && 'is-selected',
        )}
        transform="rotate(-6 56 283)"
        {...zoneProps('forward')}
      >
        <title>侧键 · 前进</title>
        <path
          d={FORWARD_BUTTON}
          fill={`url(#${sideGradient})`}
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="1.1"
        />
        <path d="M30 262H70" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1.2" />
        <path d={FORWARD_BUTTON} className="zone-surface" />
      </g>

      <g
        className={cx(
          'mouse-zone',
          'zone-side',
          interactive && 'is-interactive',
          selected === 'back' && 'is-selected',
        )}
        transform="rotate(4 53 345)"
        {...zoneProps('back')}
      >
        <title>侧键 · 后退</title>
        <path
          d={BACK_BUTTON}
          fill={`url(#${sideGradient})`}
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="1.1"
        />
        <path d="M28 324H68" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1.2" />
        <path d={BACK_BUTTON} className="zone-surface" />
      </g>

      <g className="mouse-logo" opacity="0.9">
        <circle
          cx="180"
          cy="424"
          r="30"
          fill="none"
          stroke={`url(#${logoGradient})`}
          strokeWidth="2.4"
          strokeDasharray="15 8"
          strokeLinecap="round"
        />
        <path
          d="M169 409V439M191 409V439M169 424H191"
          fill="none"
          stroke={`url(#${logoGradient})`}
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>

      <path
        d="M96 500C124 514 152 522 180 523C208 522 236 514 264 500"
        fill="none"
        stroke="rgba(196, 255, 244, 0.08)"
        strokeWidth="1.4"
      />

      {showBadges && (
        <g className="mouse-badges" aria-hidden="true">
          {BUTTON_ORDER.map((button) => {
            const position = BADGE_POSITIONS[button];
            const active = selected === button;
            return (
              <g key={button} className={cx('mouse-badge', active && 'is-active')}>
                <circle cx={position.x} cy={position.y} r="11" />
                <text x={position.x} y={position.y + 3.6} textAnchor="middle">
                  {BUTTON_META[button].index}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
