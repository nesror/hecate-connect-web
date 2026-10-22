import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  phase: number;
  speed: number;
  drift: number;
}

export function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let stars: Star[] = [];
    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let running = true;

    const createStars = () => {
      const count = Math.min(220, Math.round((width * height) / 9000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.5 + 0.25,
        alpha: Math.random() * 0.55 + 0.15,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.5 + 0.2,
        drift: Math.random() * 0.8 + 0.2,
      }));
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      createStars();
      draw(0);
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        const twinkle = reducedMotion.matches
          ? star.alpha
          : star.alpha * (0.6 + 0.4 * Math.sin(time * 0.0004 * star.speed + star.phase));
        const y = reducedMotion.matches ? star.y : star.y + Math.sin(time * 0.00006 * star.drift + star.phase) * 2;
        context.beginPath();
        context.arc(star.x, y, star.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(196, 246, 241, ${twinkle})`;
        if (star.radius > 1.25) {
          context.shadowColor = 'rgba(95, 245, 220, 0.5)';
          context.shadowBlur = 5;
        } else {
          context.shadowBlur = 0;
        }
        context.fill();
      }
      context.shadowBlur = 0;
    };

    const loop = (time: number) => {
      if (!running) return;
      draw(time);
      animationFrame = window.requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener('resize', resize);
    if (!reducedMotion.matches) {
      animationFrame = window.requestAnimationFrame(loop);
    }
    const onMotionChange = () => {
      cancelAnimationFrame(animationFrame);
      if (!reducedMotion.matches) {
        animationFrame = window.requestAnimationFrame(loop);
      } else {
        draw(0);
      }
    };
    reducedMotion.addEventListener('change', onMotionChange);

    return () => {
      running = false;
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      reducedMotion.removeEventListener('change', onMotionChange);
    };
  }, []);

  return (
    <div className="space-background" aria-hidden="true">
      <div className="nebula nebula-one" />
      <div className="nebula nebula-two" />
      <div className="nebula nebula-three" />
      <canvas ref={canvasRef} className="star-canvas" />
      <div className="space-grid" />
      <div className="space-vignette" />
    </div>
  );
}
