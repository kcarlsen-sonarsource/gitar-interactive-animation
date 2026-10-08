import * as THREE from 'three';
import { CSS, MONO, SANS } from './palette';

const DPR = 2;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeTexture(canvas: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

export interface LabelOpts {
  color?: string;
  bg?: string | null;
  border?: string | null;
  dot?: string | null;
  size?: number; // world height
  mono?: boolean;
  weight?: number;
  font?: number; // px font size on canvas
  padX?: number;
  opacity?: number;
}

/** A crisp pill label. Returns a Sprite (billboard) or Mesh. */
export function label(text: string, o: LabelOpts = {}): THREE.Sprite {
  const font = (o.font ?? 34) * DPR;
  const family = o.mono === false ? SANS : MONO;
  const weight = o.weight ?? 700;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = `${weight} ${font}px ${family}`;
  const padX = (o.padX ?? 22) * DPR;
  const dotW = o.dot ? font * 0.9 : 0;
  const tw = ctx.measureText(text).width;
  const h = Math.ceil(font * 1.9);
  const w = Math.ceil(tw + padX * 2 + dotW);
  c.width = w;
  c.height = h;
  ctx.font = `${weight} ${font}px ${family}`;
  if (o.bg !== null) {
    roundRect(ctx, DPR, DPR, w - 2 * DPR, h - 2 * DPR, h / 2.2);
    ctx.fillStyle = o.bg ?? 'rgba(8,14,24,0.82)';
    ctx.fill();
    if (o.border !== null) {
      ctx.lineWidth = 2 * DPR;
      ctx.strokeStyle = o.border ?? 'rgba(124,196,255,0.35)';
      ctx.stroke();
    }
  }
  if (o.dot) {
    ctx.fillStyle = o.dot;
    ctx.beginPath();
    ctx.arc(padX + font * 0.3, h / 2, font * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = o.color ?? CSS.white;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, padX + dotW, h / 2 + font * 0.04);
  const tex = makeTexture(c);
  const size = o.size ?? 0.8;
  const aspect = w / h;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: o.opacity ?? 1 });
  const s = new THREE.Sprite(mat);
  s.scale.set(size * aspect, size, 1);
  return s;
}

export type LineKind = 'ctx' | 'add' | 'del' | 'hl' | 'warn' | 'dim' | 'title';
export interface CodeLine {
  text: string;
  kind?: LineKind;
  n?: number | string;
}

export interface PanelOpts {
  title?: string;
  width?: number; // world width
  px?: number; // canvas width in css px
  lineH?: number;
  font?: number;
  accent?: string;
  badge?: { text: string; color: string };
  gutter?: boolean;
  bg?: string;
  /** Extra lines (e.g. a later redraw) to include when sizing the canvas. */
  measure?: CodeLine[];
}

/** A floating editor / diff panel rendered onto a canvas. */
export function codePanel(lines: CodeLine[], o: PanelOpts = {}) {
  const basePx = (o.px ?? 900) * DPR;
  const font = (o.font ?? 22) * DPR;
  // Grow the canvas (and the world width with it) so no line, title or badge is ever clipped.
  const mctx = document.createElement('canvas').getContext('2d')!;
  const textX = (o.gutter !== false ? 112 : 26) * DPR;
  let need = 0;
  for (const l of [...lines, ...(o.measure ?? [])]) {
    mctx.font = `${l.kind === 'title' ? 700 : 400} ${font}px ${l.kind === 'title' ? SANS : MONO}`;
    need = Math.max(need, textX + mctx.measureText(l.text).width + 40 * DPR);
  }
  if (o.title) {
    mctx.font = `700 ${18 * DPR}px ${MONO}`;
    let tw = 104 * DPR + mctx.measureText(o.title).width + 40 * DPR;
    if (o.badge) {
      mctx.font = `700 ${15 * DPR}px ${MONO}`;
      tw += mctx.measureText(o.badge.text).width + 50 * DPR;
    }
    need = Math.max(need, tw);
  }
  const pxW = Math.ceil(Math.max(basePx, need));
  const lineH = (o.lineH ?? 38) * DPR;
  const header = o.title ? 64 * DPR : 18 * DPR;
  const pxH = Math.ceil(header + lines.length * lineH + 26 * DPR);
  const c = document.createElement('canvas');
  c.width = pxW;
  c.height = pxH;
  const ctx = c.getContext('2d')!;
  const accent = o.accent ?? CSS.sky;

  const draw = (ls: CodeLine[] = lines) => {
    ctx.clearRect(0, 0, pxW, pxH);
    roundRect(ctx, 2 * DPR, 2 * DPR, pxW - 4 * DPR, pxH - 4 * DPR, 18 * DPR);
    ctx.fillStyle = o.bg ?? 'rgba(9,14,23,0.92)';
    ctx.fill();
    ctx.lineWidth = 2 * DPR;
    ctx.strokeStyle = 'rgba(124,196,255,0.28)';
    ctx.stroke();
    if (o.title) {
      ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => {
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(30 * DPR + i * 22 * DPR, 32 * DPR, 6 * DPR, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.font = `700 ${18 * DPR}px ${MONO}`;
      ctx.fillStyle = accent;
      ctx.textBaseline = 'middle';
      ctx.fillText(o.title, 104 * DPR, 33 * DPR);
      if (o.badge) {
        ctx.font = `700 ${15 * DPR}px ${MONO}`;
        const bw = ctx.measureText(o.badge.text).width + 28 * DPR;
        roundRect(ctx, pxW - bw - 22 * DPR, 16 * DPR, bw, 32 * DPR, 16 * DPR);
        ctx.fillStyle = o.badge.color + '26';
        ctx.fill();
        ctx.strokeStyle = o.badge.color;
        ctx.lineWidth = 1.5 * DPR;
        ctx.stroke();
        ctx.fillStyle = o.badge.color;
        ctx.fillText(o.badge.text, pxW - bw - 8 * DPR, 33 * DPR);
      }
      ctx.fillStyle = 'rgba(124,196,255,0.14)';
      ctx.fillRect(0, header - 2 * DPR, pxW, 2 * DPR);
    }
    ls.forEach((l, i) => {
      const y = header + 10 * DPR + i * lineH;
      const kind = l.kind ?? 'ctx';
      const tint: Record<LineKind, string | null> = {
        ctx: null,
        dim: null,
        title: null,
        add: 'rgba(46,229,157,0.13)',
        del: 'rgba(255,77,94,0.14)',
        hl: 'rgba(61,139,255,0.18)',
        warn: 'rgba(255,181,71,0.14)',
      };
      if (tint[kind]) {
        ctx.fillStyle = tint[kind]!;
        ctx.fillRect(6 * DPR, y, pxW - 12 * DPR, lineH);
        const bar: Record<string, string> = { add: CSS.green, del: CSS.red, hl: CSS.blueBright, warn: CSS.amber };
        ctx.fillStyle = bar[kind];
        ctx.fillRect(6 * DPR, y, 4 * DPR, lineH);
      }
      ctx.textBaseline = 'middle';
      const gutter = o.gutter !== false;
      let x = 26 * DPR;
      if (gutter) {
        ctx.font = `400 ${font * 0.82}px ${MONO}`;
        ctx.fillStyle = 'rgba(154,167,184,0.45)';
        ctx.fillText(String(l.n ?? ''), x, y + lineH / 2);
        x += 58 * DPR;
        const sign = kind === 'add' ? '+' : kind === 'del' ? '−' : ' ';
        ctx.fillStyle = kind === 'add' ? CSS.green : CSS.red;
        ctx.fillText(sign, x, y + lineH / 2);
        x += 28 * DPR;
      }
      const col: Record<LineKind, string> = {
        ctx: '#c9d4e3',
        dim: 'rgba(154,167,184,0.6)',
        add: '#b9f7dc',
        del: '#ffc2c8',
        hl: '#dbe9ff',
        warn: '#ffe0b0',
        title: CSS.white,
      };
      ctx.font = `${kind === 'title' ? 700 : 400} ${font}px ${kind === 'title' ? SANS : MONO}`;
      ctx.fillStyle = col[kind];
      ctx.fillText(l.text, x, y + lineH / 2);
    });
  };
  draw();
  const tex = makeTexture(c);
  const width = ((o.width ?? 12) * pxW) / basePx;
  const height = (width * pxH) / pxW;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  /** Returns the local Y (world units, panel-centred) of a given line's centre. */
  const lineY = (i: number) => height / 2 - ((header + 10 * DPR + i * lineH + lineH / 2) / pxH) * height;
  return {
    mesh,
    width,
    height,
    lineY,
    redraw(ls: CodeLine[]) {
      draw(ls);
      tex.needsUpdate = true;
    },
  };
}

export interface CardOpts {
  author?: string;
  tag?: { text: string; color: string };
  body: string[];
  width?: number;
  px?: number;
  accent?: string;
  footer?: string;
}

/** A "gitar bot" style comment card. */
export function commentCard(o: CardOpts) {
  const basePx = (o.px ?? 760) * DPR;
  const font = 21 * DPR;
  const lineH = 32 * DPR;
  const mctx = document.createElement('canvas').getContext('2d')!;
  mctx.font = `400 ${font}px ${SANS}`;
  let need = 0;
  for (const l of o.body) need = Math.max(need, 60 * DPR + mctx.measureText(l).width);
  if (o.footer) {
    mctx.font = `700 ${15 * DPR}px ${MONO}`;
    need = Math.max(need, 60 * DPR + mctx.measureText(o.footer).width);
  }
  const pxW = Math.ceil(Math.max(basePx, need));
  const pxH = Math.ceil(96 * DPR + o.body.length * lineH + (o.footer ? 54 * DPR : 22 * DPR));
  const c = document.createElement('canvas');
  c.width = pxW;
  c.height = pxH;
  const ctx = c.getContext('2d')!;
  roundRect(ctx, 2 * DPR, 2 * DPR, pxW - 4 * DPR, pxH - 4 * DPR, 18 * DPR);
  ctx.fillStyle = 'rgba(10,16,27,0.94)';
  ctx.fill();
  ctx.strokeStyle = o.accent ?? 'rgba(61,139,255,0.6)';
  ctx.lineWidth = 2.5 * DPR;
  ctx.stroke();
  // avatar
  const ax = 46 * DPR;
  const ay = 48 * DPR;
  const grd = ctx.createLinearGradient(ax - 22 * DPR, ay - 22 * DPR, ax + 22 * DPR, ay + 22 * DPR);
  grd.addColorStop(0, '#3d8bff');
  grd.addColorStop(1, '#126ED3');
  roundRect(ctx, ax - 22 * DPR, ay - 22 * DPR, 44 * DPR, 44 * DPR, 10 * DPR);
  ctx.fillStyle = grd;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `italic 700 ${26 * DPR}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('g', ax, ay + 1 * DPR);
  ctx.textAlign = 'left';
  ctx.font = `700 ${21 * DPR}px ${SANS}`;
  ctx.fillStyle = CSS.white;
  ctx.fillText(o.author ?? 'gitar', 84 * DPR, ay);
  const aw = ctx.measureText(o.author ?? 'gitar').width;
  ctx.font = `700 ${13 * DPR}px ${MONO}`;
  roundRect(ctx, 84 * DPR + aw + 12 * DPR, ay - 13 * DPR, 44 * DPR, 26 * DPR, 6 * DPR);
  ctx.strokeStyle = 'rgba(154,167,184,0.6)';
  ctx.lineWidth = 1.5 * DPR;
  ctx.stroke();
  ctx.fillStyle = CSS.mist;
  ctx.fillText('bot', 84 * DPR + aw + 20 * DPR, ay + 1 * DPR);
  if (o.tag) {
    ctx.font = `700 ${15 * DPR}px ${MONO}`;
    const tw = ctx.measureText(o.tag.text).width + 30 * DPR;
    roundRect(ctx, pxW - tw - 24 * DPR, ay - 17 * DPR, tw, 34 * DPR, 17 * DPR);
    ctx.fillStyle = o.tag.color + '22';
    ctx.fill();
    ctx.strokeStyle = o.tag.color;
    ctx.stroke();
    ctx.fillStyle = o.tag.color;
    ctx.fillText(o.tag.text, pxW - tw - 9 * DPR, ay + 1 * DPR);
  }
  ctx.font = `400 ${font}px ${SANS}`;
  ctx.fillStyle = '#c9d4e3';
  o.body.forEach((l, i) => ctx.fillText(l, 30 * DPR, 104 * DPR + i * lineH));
  if (o.footer) {
    ctx.font = `700 ${15 * DPR}px ${MONO}`;
    ctx.fillStyle = CSS.sky;
    ctx.fillText(o.footer, 30 * DPR, pxH - 30 * DPR);
  }
  const tex = makeTexture(c);
  const width = ((o.width ?? 8) * pxW) / basePx;
  const height = (width * pxH) / pxW;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
}

/** A tall scrolling texture of log lines (for CI chapter). */
export function logTexture(lines: string[], o: { px?: number; rows?: number } = {}) {
  const pxW = (o.px ?? 520) * DPR;
  const lineH = 24 * DPR;
  const rows = o.rows ?? 64;
  const c = document.createElement('canvas');
  c.width = pxW;
  c.height = rows * lineH;
  const ctx = c.getContext('2d')!;
  ctx.font = `400 ${15 * DPR}px ${MONO}`;
  ctx.textBaseline = 'middle';
  for (let i = 0; i < rows; i++) {
    const l = lines[i % lines.length];
    ctx.fillStyle = l.includes('error') || l.includes('FAIL')
      ? 'rgba(255,77,94,0.95)'
      : l.includes('warn') || l.includes('retry')
        ? 'rgba(255,181,71,0.85)'
        : 'rgba(124,196,255,0.55)';
    ctx.fillText(l, 12 * DPR, i * lineH + lineH / 2);
  }
  const tex = makeTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Soft radial glow sprite texture (shared). */
let glowTex: THREE.Texture | null = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export function glowSprite(color: number, size: number, opacity = 1) {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}
