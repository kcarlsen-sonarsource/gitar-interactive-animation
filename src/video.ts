import { CSS, MONO, SANS } from './lib/palette';
import { smootherstep, smoothstep } from './lib/util';

/**
 * Booth-loop timeline: seconds the camera dwells on each chapter. Tuned so each chapter's
 * signature animation plays through once (scan → findings → comment, CI converge, fix lands,
 * three CI laps → green), with ~2.6s cinematic flights in between.
 */
export const HOLDS = [7, 9, 10.5, 10, 9.5, 11, 8, 7.5, 8, 8, 9];
export const FLIGHT = 2.6;
const LEAD = 1.3; // chapter animations start this long before the camera arrives

export interface Timeline {
  duration: number;
  /** Camera chapter coordinate at time T. */
  coord(T: number): number;
  /** Chapter-local "since" for chapter j at time T. */
  since(j: number, T: number): number;
  /** Index of chapter on screen and copy opacity 0..1. */
  copy(T: number): { j: number; o: number };
}

export function timeline(): Timeline {
  const starts: number[] = [];
  let acc = 0;
  HOLDS.forEach((h, i) => {
    starts.push(acc);
    acc += h + (i < HOLDS.length - 1 ? FLIGHT : 0);
  });
  const duration = acc;
  return {
    duration,
    coord(T) {
      for (let i = 0; i < HOLDS.length; i++) {
        const holdEnd = starts[i] + HOLDS[i];
        if (T < holdEnd) return i;
        if (i < HOLDS.length - 1 && T < holdEnd + FLIGHT) return i + smootherstep((T - holdEnd) / FLIGHT);
      }
      return HOLDS.length - 1;
    },
    since(j, T) {
      return j === 0 ? T : Math.max(0, T - (starts[j] - LEAD));
    },
    copy(T) {
      for (let i = 0; i < HOLDS.length; i++) {
        const end = starts[i] + HOLDS[i];
        if (T < end + FLIGHT / 2 || i === HOLDS.length - 1) {
          const inT = i === 0 ? 1.4 : starts[i] + 0.15;
          const o = smoothstep(inT, inT + 0.8, T) * (1 - smoothstep(end - 0.2, end + 0.5, T));
          return { j: i, o: i === HOLDS.length - 1 ? smoothstep(inT, inT + 0.8, T) : o };
        }
      }
      return { j: 0, o: 0 };
    },
  };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: 'left' | 'center' = 'left') {
  const chars = [...text];
  const w = chars.reduce((s, c) => s + ctx.measureText(c).width + spacing, -spacing);
  let cx = align === 'center' ? x - w / 2 : x;
  for (const c of chars) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + spacing;
  }
  return w;
}

/** Draws the chapter copy, brand mark, stage HUD and URL in the site's typography. */
export function createOverlay(sections: HTMLElement[], logo: HTMLImageElement) {
  const stages = ['review', 'diagnose', 'fix', 'verify', 'ship'];
  const stageKey = ['review', 'ci', 'fix', 'green', 'ship'];
  return (ctx: CanvasRenderingContext2D, W: number, H: number, j: number, o: number, fade: number) => {
    const sec = sections[j];
    const side = sec.dataset.side ?? 'left';
    const center = side === 'center';
    const eyebrow = sec.querySelector('.eyebrow')?.textContent?.trim() ?? '';
    const head = (sec.querySelector('h1, h2') as HTMLElement | null)?.innerText.trim() ?? '';
    const body = sec.querySelector('p:not(.kicker):not(.fine)')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const kicker = sec.querySelector('.kicker')?.textContent?.trim();
    const statNum = sec.querySelector('.stat-num')?.textContent?.trim();
    const statLabel = sec.querySelector('.stat-label')?.textContent?.trim();

    // --- chrome: brand, stage HUD, url ---
    ctx.save();
    ctx.globalAlpha = fade;
    const lh = 34;
    ctx.drawImage(logo, 56, 44, (logo.width / logo.height) * lh, lh);
    ctx.font = `400 13px ${MONO}`;
    ctx.fillStyle = CSS.mist;
    ctx.textBaseline = 'middle';
    spaced(ctx, 'BY SONAR', 56 + (logo.width / logo.height) * lh + 16, 64, 2.2);
    const activeStage = stageKey.indexOf(sec.dataset.stage ?? '');
    const isEnd = j === sections.length - 1;
    ctx.font = `400 13px ${MONO}`;
    const gap = 46;
    const widths = stages.map((s) => ctx.measureText(s.toUpperCase()).width + 2 * s.length);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (stages.length - 1);
    let x = W / 2 - total / 2;
    ctx.beginPath();
    ctx.roundRect(x - 24, 44, total + 48, 40, 20);
    ctx.fillStyle = 'rgba(6,10,17,0.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(124,196,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    stages.forEach((s, i) => {
      const on = i === activeStage && !isEnd;
      const done = i < activeStage || isEnd;
      ctx.fillStyle = on ? CSS.white : done ? CSS.green : 'rgba(154,167,184,0.5)';
      ctx.shadowColor = on ? 'rgba(61,139,255,0.9)' : 'transparent';
      ctx.shadowBlur = on ? 14 : 0;
      spaced(ctx, s.toUpperCase(), x, 64, 2);
      ctx.shadowBlur = 0;
      if (i < stages.length - 1) {
        ctx.fillStyle = 'rgba(124,196,255,0.25)';
        ctx.fillRect(x + widths[i] + 12, 64, gap - 24, 1);
      }
      x += widths[i] + gap;
    });
    ctx.font = `400 14px ${MONO}`;
    ctx.fillStyle = CSS.mist;
    ctx.textAlign = 'right';
    ctx.fillText('sonarsource.com/products/gitar', W - 56, H - 48);
    ctx.textAlign = 'left';
    ctx.restore();

    if (o <= 0.001) return;
    // --- copy block ---
    const maxW = center ? 1100 : j === 0 ? 860 : 600;
    const headSize = j === 0 ? 96 : center ? 132 : 62;
    ctx.save();
    ctx.globalAlpha = o * fade;
    ctx.font = `500 ${headSize}px ${SANS}`;
    const headLines = wrap(ctx, head, maxW);
    ctx.font = `400 21px ${SANS}`;
    const bodyLines = center ? [] : wrap(ctx, body, maxW - 20).slice(0, 5);
    const hasStat = !!statNum && !center;
    const blockH =
      40 + headLines.length * headSize * 1.04 + 26 + bodyLines.length * 33 + (hasStat ? 92 : 0) + (kicker && !center ? 40 : 0);
    const x0 = center ? W / 2 : side === 'right' ? W - 0.08 * W - maxW : 0.08 * W;
    let y = H / 2 - blockH / 2 + (j === 0 ? 10 : 0);
    // soft backdrop for legibility
    const bx = center ? W / 2 : x0 + maxW / 2;
    const g = ctx.createRadialGradient(bx, H / 2, 0, bx, H / 2, maxW * 0.85);
    g.addColorStop(0, 'rgba(4,6,10,0.72)');
    g.addColorStop(1, 'rgba(4,6,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(bx - maxW, H / 2 - maxW, maxW * 2, maxW * 2);

    const tx = center ? W / 2 : x0;
    ctx.textAlign = center ? 'center' : 'left';
    ctx.textBaseline = 'alphabetic';
    // eyebrow
    ctx.font = `400 14px ${MONO}`;
    ctx.fillStyle = CSS.sky;
    const ew = ctx.measureText(eyebrow.toUpperCase()).width + eyebrow.length * 2.4;
    const ex = center ? W / 2 - ew / 2 - 9 : tx;
    ctx.fillStyle = CSS.blueBright;
    ctx.shadowColor = CSS.blueBright;
    ctx.shadowBlur = 10;
    ctx.fillRect(ex, y + 2, 8, 8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = CSS.sky;
    ctx.textAlign = 'left';
    spaced(ctx, eyebrow.toUpperCase(), ex + 18, y + 11, 2.4);
    ctx.textAlign = center ? 'center' : 'left';
    y += 40 + headSize * 0.9;
    // headline (the "Ship." line gets the Gitar blue)
    ctx.font = `500 ${headSize}px ${SANS}`;
    ctx.letterSpacing = `${-headSize * 0.035}px`;
    headLines.forEach((l) => {
      const accent = /^ship\.?$/i.test(l.trim());
      ctx.fillStyle = accent ? CSS.blueBright : CSS.white;
      ctx.shadowColor = accent ? 'rgba(61,139,255,0.6)' : 'transparent';
      ctx.shadowBlur = accent ? 40 : 0;
      ctx.fillText(l, tx, y);
      y += headSize * 1.04;
    });
    ctx.shadowBlur = 0;
    ctx.letterSpacing = '0px';
    y += 4;
    ctx.font = `400 21px ${SANS}`;
    ctx.fillStyle = '#b9c4d3';
    bodyLines.forEach((l) => {
      ctx.fillText(l, tx, y);
      y += 33;
    });
    if (hasStat) {
      y += 16;
      ctx.fillStyle = 'rgba(124,196,255,0.18)';
      ctx.fillRect(tx, y, maxW - 40, 1);
      ctx.font = `400 38px ${MONO}`;
      ctx.fillStyle = statNum!.includes('✓') ? CSS.green : CSS.white;
      ctx.fillText(statNum!, tx, y + 54);
      const nw = ctx.measureText(statNum!).width;
      ctx.font = `400 13px ${MONO}`;
      ctx.fillStyle = CSS.mist;
      spaced(ctx, (statLabel ?? '').toUpperCase(), tx + nw + 20, y + 49, 2);
      ctx.fillStyle = 'rgba(124,196,255,0.18)';
      ctx.fillRect(tx, y + 76, maxW - 40, 1);
      y += 92;
    }
    if (kicker && !center) {
      y += 24;
      ctx.font = `400 15px ${MONO}`;
      ctx.fillStyle = CSS.amber;
      spaced(ctx, kicker.toUpperCase(), tx, y, 1.6);
    }
    if (center) {
      y += 30;
      ctx.font = `400 16px ${MONO}`;
      ctx.fillStyle = CSS.mist;
      spaced(ctx, 'INSTALL FREE  ·  14-DAY TRIAL  ·  SONARSOURCE.COM/PRODUCTS/GITAR', W / 2, y, 2.4, 'center');
    }
    ctx.restore();
  };
}

