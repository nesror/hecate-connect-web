import { type KeyboardEvent, useId } from 'react';
import type { ButtonId } from '../types';
import { BUTTON_META, BUTTON_ORDER } from '../functions';
import { cx } from '../utils';

interface MouseIllustrationProps {
  selected?: ButtonId | null;
  onSelect?: (button: ButtonId) => void;
  device?: 'hecate' | 'rapoo';
  buttons?: ButtonId[];
  className?: string;
  showBadges?: boolean;
}

const BODY_PATH =
  'M180 40 C198 40 209 41 218 45 C246 52 274 63 294 82 C305 94 309 125 310 158 ' +
  'C311 182 308 206 307 230 C306 252 304 274 304 296 C304 318 305 340 308 362 ' +
  'C311 384 313 406 311 428 C309 452 301 474 288 494 C270 518 242 535 208 542 ' +
  'C198 544 189 545 180 545 C171 545 162 544 152 542 C118 535 90 518 72 494 ' +
  'C59 474 51 452 49 428 C47 406 49 384 52 362 C55 340 56 318 56 296 ' +
  'C56 274 54 252 53 230 C52 206 49 182 50 158 C51 125 55 94 66 82 ' +
  'C86 63 114 52 142 45 C151 41 162 40 180 40 Z';

const LEFT_BUTTON =
  'M171 40 C159 40 150 41 142 45 C114 52 86 63 66 82 C55 94 51 125 50 158 ' +
  'C49 182 52 206 53 230 C54 242 55 248 56 254 C84 261 120 267 152 270 ' +
  'C161 271 171 272 180 272 L166 269 C160 266 157 261 157 254 L157 90 ' +
  'C157 70 163 52 171 40 Z';

const RIGHT_BUTTON =
  'M189 40 C201 40 210 41 218 45 C246 52 274 63 294 82 C305 94 309 125 310 158 ' +
  'C311 182 308 206 307 230 C306 242 305 248 304 254 C276 261 240 267 208 270 ' +
  'C199 271 189 272 180 272 L194 269 C200 266 203 261 203 254 L203 90 ' +
  'C203 70 197 52 189 40 Z';

const WHEEL_SHROUD =
  'M164 40 H196 V58 C196 68 200 76 203 84 V164 C203 180 195 190 186 194 ' +
  'H174 C165 190 157 180 157 164 V84 C160 76 164 68 164 58 Z';

const FORWARD_BUTTON =
  'M54 200 H66 C73 200 77 205 77 212 V238 C77 246 73 250 66 250 H52 ' +
  'C48 250 46 247 46 243 V208 C46 203 48 200 54 200 Z';

const BACK_BUTTON =
  'M56 268 H68 C75 268 79 273 79 280 V316 C79 324 75 328 68 328 H54 ' +
  'C50 328 48 325 48 321 V276 C48 271 50 268 56 268 Z';

const BADGE_POSITIONS: Record<ButtonId, { x: number; y: number }> = {
  left: { x: 104, y: 152 },
  right: { x: 256, y: 152 },
  wheel: { x: 226, y: 100 },
  forward: { x: 62, y: 225 },
  back: { x: 63, y: 298 },
  dpi: { x: 226, y: 214 },
  dpiUp: { x: 256, y: 276 },
  dpiDown: { x: 257, y: 336 },
};

export function MouseIllustration({
  selected,
  onSelect,
  device = 'hecate',
  buttons = BUTTON_ORDER,
  className,
  showBadges = true,
}: MouseIllustrationProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const bodyGradient = `${id}-body`;
  const bodySheen = `${id}-sheen`;
  const bodyVignette = `${id}-vignette`;
  const buttonGradient = `${id}-button`;
  const buttonGradientRight = `${id}-button-right`;
  const stripGradient = `${id}-strip`;
  const wheelGradient = `${id}-wheel`;
  const dpiGradient = `${id}-dpi`;
  const tread = `${id}-tread`;
  const blur = `${id}-blur`;
  const bodyClip = `${id}-clip`;
  const wheelClip = `${id}-wheel-clip`;

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
      className={cx('mouse-illustration', device === 'rapoo' && 'is-rapoo', className)}
      role="img"
      aria-label={device === 'rapoo' ? 'Rapoo VT9PRO 鼠标按键示意图' : 'HECATE G3M PRO 鼠标按键示意图'}
    >
      <defs>
        <linearGradient id={bodyGradient} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#232829" />
          <stop offset="45%" stopColor="#121617" />
          <stop offset="100%" stopColor="#050708" />
        </linearGradient>
        <radialGradient id={bodySheen} cx="40%" cy="54%" r="62%">
          <stop offset="0%" stopColor="rgba(214, 238, 234, 0.13)" />
          <stop offset="45%" stopColor="rgba(180, 214, 210, 0.045)" />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
        </radialGradient>
        <radialGradient id={bodyVignette} cx="50%" cy="50%" r="62%">
          <stop offset="55%" stopColor="rgba(0, 0, 0, 0)" />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0.42)" />
        </radialGradient>
        <linearGradient id={buttonGradient} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#2a2f30" />
          <stop offset="52%" stopColor="#171b1c" />
          <stop offset="100%" stopColor="#0b0e0f" />
        </linearGradient>
        <linearGradient id={buttonGradientRight} x1="0.9" y1="0" x2="0.1" y2="1">
          <stop offset="0%" stopColor="#272c2d" />
          <stop offset="52%" stopColor="#161a1b" />
          <stop offset="100%" stopColor="#0a0d0e" />
        </linearGradient>
        <linearGradient id={stripGradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#222728" />
          <stop offset="70%" stopColor="#101415" />
          <stop offset="100%" stopColor="#0a0d0e" />
        </linearGradient>
        <linearGradient id={wheelGradient} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#070909" />
          <stop offset="28%" stopColor="#2b3031" />
          <stop offset="55%" stopColor="#141819" />
          <stop offset="100%" stopColor="#060808" />
        </linearGradient>
        <linearGradient id={dpiGradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2b3132" />
          <stop offset="55%" stopColor="#171c1d" />
          <stop offset="100%" stopColor="#0c0f10" />
        </linearGradient>
        <pattern id={tread} width="11" height="11" patternUnits="userSpaceOnUse">
          <path
            d="M0 0L11 11M11 0L0 11"
            stroke="rgba(206, 232, 228, 0.09)"
            strokeWidth="1.1"
          />
        </pattern>
        <filter id={blur} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <clipPath id={bodyClip}>
          <path d={BODY_PATH} />
        </clipPath>
        <clipPath id={wheelClip}>
          <rect x="167" y="76" width="26" height="88" rx="13" />
        </clipPath>
      </defs>

      <ellipse cx="180" cy="556" rx="108" ry="14" fill="rgba(0, 0, 0, 0.6)" filter={`url(#${blur})`} />

      <path
        d={BODY_PATH}
        fill={`url(#${bodyGradient})`}
        stroke="rgba(188, 219, 214, 0.11)"
        strokeWidth="1"
      />

      <g clipPath={`url(#${bodyClip})`}>
        <rect x="30" y="20" width="300" height="540" fill={`url(#${bodySheen})`} />
        <rect x="30" y="20" width="300" height="540" fill={`url(#${bodyVignette})`} />
        <path
          d="M74 312C104 286 142 278 180 278C218 278 256 286 286 312"
          fill="none"
          stroke="rgba(255, 255, 255, 0.035)"
          strokeWidth="2"
        />
        <path
          d="M84 486C116 509 148 519 180 521C212 519 244 509 276 486"
          fill="none"
          stroke="rgba(0, 0, 0, 0.4)"
          strokeWidth="12"
        />
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
          stroke="rgba(0, 0, 0, 0.72)"
          strokeWidth="1.2"
        />
        <path
          d="M142 46C112 54 82 68 64 88"
          fill="none"
          stroke="rgba(255, 255, 255, 0.055)"
          strokeWidth="1.4"
          strokeLinecap="round"
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
          stroke="rgba(0, 0, 0, 0.72)"
          strokeWidth="1.2"
        />
        <path
          d="M296 88C278 68 250 54 220 46"
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path d={RIGHT_BUTTON} className="zone-surface" />
      </g>

      <text
        x="296"
        y="152"
        transform="rotate(90 296 152)"
        textAnchor="middle"
        fill="rgba(230, 242, 239, 0.6)"
        fontFamily="'Segoe UI', 'Inter', system-ui, sans-serif"
        fontSize="9.5"
        fontWeight="600"
        letterSpacing="2.6"
      >
        {device === 'rapoo' ? 'RAPOO' : 'HECATE'}
      </text>

      <path
        d="M157 190 H203 V248 C203 258 196 266 186 270 L174 270 C164 266 157 258 157 248 Z"
        fill={`url(#${stripGradient})`}
        stroke="rgba(0, 0, 0, 0.6)"
        strokeWidth="1"
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
        <path
          d={WHEEL_SHROUD}
          fill={`url(#${stripGradient})`}
          stroke="rgba(0, 0, 0, 0.65)"
          strokeWidth="1.1"
        />
        <rect
          x="166"
          y="44"
          width="28"
          height="28"
          rx="5"
          fill="#080a0b"
          stroke="rgba(255, 255, 255, 0.055)"
          strokeWidth="1"
        />
        <rect
          x="162"
          y="70"
          width="36"
          height="104"
          rx="18"
          fill={`url(#${wheelGradient})`}
          stroke="rgba(0, 0, 0, 0.8)"
          strokeWidth="1.2"
        />
        <rect x="167" y="76" width="26" height="88" rx="13" fill="#090b0c" />
        <g clipPath={`url(#${wheelClip})`}>
          <rect x="167" y="76" width="26" height="88" fill={`url(#${tread})`} />
          <rect x="168" y="80" width="4" height="80" rx="2" fill="rgba(255, 255, 255, 0.05)" />
        </g>
        <rect
          x="157"
          y="40"
          width="46"
          height="156"
          rx="14"
          className="zone-surface"
        />
      </g>

      <path
        d="M177 236 H183 V260 C183 264 181.5 267 180 269 C178.5 267 177 264 177 260 Z"
        fill="rgba(0, 0, 0, 0.45)"
      />

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
          x="164"
          y="202"
          width="32"
          height="34"
          rx="9"
          fill={`url(#${dpiGradient})`}
          stroke="rgba(0, 0, 0, 0.75)"
          strokeWidth="1.1"
        />
        <path
          d="M169 206 H191"
          stroke="rgba(255, 255, 255, 0.09)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <g className="dpi-led">
          <circle cx="180" cy="280" r="3" fill="#0a0d0e" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="0.8" />
          <circle cx="180" cy="280" r="1.8" fill="#334345" />
        </g>
        <rect
          x="160"
          y="196"
          width="40"
          height="44"
          rx="12"
          className="zone-surface"
        />
      </g>

      <g
        className={cx(
          'mouse-zone',
          'zone-side',
          interactive && 'is-interactive',
          selected === 'forward' && 'is-selected',
        )}
        {...zoneProps('forward')}
      >
        <title>侧键 · 前进</title>
        <path
          d={FORWARD_BUTTON}
          fill={`url(#${buttonGradient})`}
          stroke="rgba(0, 0, 0, 0.78)"
          strokeWidth="1.1"
        />
        <path
          d="M70 206V244"
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <path d={FORWARD_BUTTON} className="zone-surface" />
      </g>

      <g
        className={cx(
          'mouse-zone',
          'zone-side',
          interactive && 'is-interactive',
          selected === 'back' && 'is-selected',
        )}
        {...zoneProps('back')}
      >
        <title>侧键 · 后退</title>
        <path
          d={BACK_BUTTON}
          fill={`url(#${buttonGradient})`}
          stroke="rgba(0, 0, 0, 0.78)"
          strokeWidth="1.1"
        />
        <path
          d="M72 274V322"
          stroke="rgba(255, 255, 255, 0.055)"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <path d={BACK_BUTTON} className="zone-surface" />
      </g>

      {device === 'rapoo' ? (
        <g className="mouse-wordmark" transform="translate(180 426)">
          <text
            textAnchor="middle"
            fill="rgba(212, 232, 227, 0.68)"
            fontFamily="'Segoe UI', 'Inter', system-ui, sans-serif"
            fontSize="17"
            fontWeight="700"
            letterSpacing="4.6"
          >
            RAPOO
          </text>
          <text
            y="16"
            textAnchor="middle"
            fill="rgba(150, 180, 176, 0.52)"
            fontFamily="'Segoe UI', 'Inter', system-ui, sans-serif"
            fontSize="7.5"
            fontWeight="600"
            letterSpacing="2.6"
          >
            VT9PRO
          </text>
        </g>
      ) : (
        <g className="mouse-logo" transform="translate(149 399) scale(1.3)">
          <g fill="none" stroke="rgba(212, 232, 227, 0.72)" strokeWidth="2.6" strokeLinecap="round">
            <path d="M24 4.5a19.5 19.5 0 0 1 16.9 9.8" />
            <path d="M44.2 24a19.5 19.5 0 0 1-9.8 16.9" />
            <path d="M24 43.5a19.5 19.5 0 0 1-16.9-9.8" />
            <path d="M3.8 24a19.5 19.5 0 0 1 9.8-16.9" />
          </g>
          <g fill="none" stroke="rgba(236, 248, 245, 0.9)" strokeWidth="3" strokeLinecap="round">
            <path d="M17.5 16.5v15" />
            <path d="M30.5 16.5v15" />
            <path d="M17.5 24h13" />
          </g>
        </g>
      )}

      {showBadges && (
        <g className="mouse-badges" aria-hidden="true">
          {buttons.map((button) => {
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
