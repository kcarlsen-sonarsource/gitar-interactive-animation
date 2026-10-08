import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import './style.css';

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createWorld } from './world';
import { createPost } from './post';
import { fx } from './lib/fx';
import { C } from './lib/palette';
import { clamp, damp, lerp, smootherstep, smoothstep } from './lib/util';
import { SPACING, type Chapter, type Ctx } from './lib/types';
import { createOverlay, timeline } from './video';

import { heroChapter } from './chapters/hero';
import { problemChapter } from './chapters/problem';
import { reviewChapter } from './chapters/review';
import { ciChapter } from './chapters/ci';
import { fixChapter } from './chapters/fix';
import { greenChapter } from './chapters/green';
import { rulesChapter } from './chapters/rules';
import { integrationsChapter } from './chapters/integrations';
import { analyticsChapter } from './chapters/analytics';
import { enterpriseChapter } from './chapters/enterprise';
import { shipChapter } from './chapters/ship';

const loaderBar = document.querySelector<HTMLSpanElement>('.loader-bar span')!;
const setLoad = (p: number) => (loaderBar.style.width = `${Math.round(p * 100)}%`);

async function boot() {
  setLoad(0.1);
  await Promise.all([
    document.fonts.load('400 32px "Space Mono"'),
    document.fonts.load('700 32px "Space Mono"'),
    document.fonts.load('400 32px Inter'),
    document.fonts.load('700 32px Inter'),
    document.fonts.load('italic 700 32px Inter'),
  ]).catch(() => undefined);
  setLoad(0.35);

  const canvas = document.querySelector<HTMLCanvasElement>('#gl')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const pr = Math.min(window.devicePixelRatio, 1.75);
  renderer.setPixelRatio(pr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(C.ink, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(C.ink, 0.0085);
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 900);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const ctx: Ctx = { scene, camera, renderer, env };
  const factories = [
    heroChapter,
    problemChapter,
    reviewChapter,
    ciChapter,
    fixChapter,
    greenChapter,
    rulesChapter,
    integrationsChapter,
    analyticsChapter,
    enterpriseChapter,
    shipChapter,
  ];
  const chapters: Chapter[] = [];
  for (let i = 0; i < factories.length; i++) {
    const ch = await factories[i](ctx);
    ch.group.position.z = -i * SPACING;
    scene.add(ch.group);
    chapters.push(ch);
    setLoad(0.35 + (0.55 * (i + 1)) / factories.length);
  }
  const N = chapters.length;
  const world = createWorld(scene, N * SPACING);
  const post = createPost(renderer, scene, camera);

  // Warm up shaders so the first scroll is not janky.
  renderer.compile(scene, camera);
  setLoad(1);

  // ---------- DOM wiring ----------
  const sections = [...document.querySelectorAll<HTMLElement>('#story section')];
  const nav = document.querySelector<HTMLElement>('.chapters')!;
  const navLinks = sections.map((s, i) => {
    const a = document.createElement('a');
    a.href = `#${s.id}`;
    a.textContent = s.dataset.title ?? s.id;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: i * window.innerHeight, behavior: 'smooth' });
    });
    nav.appendChild(a);
    return a;
  });
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => en.target.querySelector('.copy')?.classList.toggle('in', en.isIntersecting)),
    { threshold: 0.45 },
  );
  sections.forEach((s) => io.observe(s));
  const sides = sections.map((s) => (s.dataset.side === 'right' ? 1 : s.dataset.side === 'center' ? 0 : -1));
  const stageOrder = ['review', 'ci', 'fix', 'green', 'ship'];
  const stageEls = [...document.querySelectorAll<HTMLElement>('.stage-hud span')];
  const hint = document.getElementById('hint')!;
  document.getElementById('replay')!.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // ---------- input ----------
  const pointer = new THREE.Vector2();
  const pointerS = new THREE.Vector2();
  window.addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  });

  const onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === 0 || h === 0) return; // hidden/background tab: keep the last valid size
    renderer.setSize(w, h);
    post.setSize(w, h, pr);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);
  onResize();

  // ---------- camera choreography ----------
  const keyPos = chapters.map((ch) => ch.cam.pos.clone().add(ch.group.position));
  const keyLook = chapters.map((ch) => ch.cam.look.clone().add(ch.group.position));
  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const lookS = new THREE.Vector3().copy(keyLook[0]);
  let cur = 0; // smoothed chapter coordinate
  let side = sides[0];
  const enterTime = new Array(N).fill(-1);
  let focused = -1;

  /** Scroll → chapter coordinate, with dwell: camera holds while copy is readable, then flies. */
  const targetCoord = () => {
    // guard: a background tab can report innerHeight 0, and a NaN here would freeze the camera forever
    const f = window.innerHeight > 0 ? window.scrollY / window.innerHeight : 0;
    const i = Math.floor(f);
    const frac = f - i;
    return clamp(i + smootherstep((frac - 0.28) / 0.6), 0, N - 1);
  };
  cur = targetCoord();

  const clock = new THREE.Clock();
  let t = 0;
  document.getElementById('loader')!.classList.add('done');

  // Dev capture mode: freeze the camera on a chapter coordinate at a given chapter-local time.
  type Forced = { coord: number; since: number | ((j: number) => number); t?: number; dt?: number; fx?: boolean; w?: number; h?: number };
  let forced: Forced | null = null;
  let videoMode = false;

  const frame = (loopIt = true) => {
    if (loopIt && videoMode) return requestAnimationFrame(() => frame());
    const dt = forced ? (forced.dt ?? 1 / 60) : Math.min(clock.getDelta(), 1 / 20);
    t = forced ? (forced.t ?? (typeof forced.since === 'number' ? forced.since : 0) + 30) : t + dt;
    cur = forced ? forced.coord : clamp(lerp(cur, targetCoord(), damp(3.2, dt)), 0, N - 1);
    if (!Number.isFinite(cur)) cur = 0;
    const i0 = Math.floor(cur);
    const i1 = Math.min(i0 + 1, N - 1);    const k = cur - i0;

    // flight: interpolate keyframes and lift the camera in an arc between chapters
    tmpPos.lerpVectors(keyPos[i0], keyPos[i1], k);
    tmpLook.lerpVectors(keyLook[i0], keyLook[i1], k);
    // portrait / narrow screens: back the camera off so each scene still fits the frame
    const fit = Math.min(2.1, Math.max(1, Math.pow(1.45 / camera.aspect, 0.75)));
    if (fit > 1) tmpPos.sub(tmpLook).multiplyScalar(fit).add(tmpLook);
    const arc = Math.sin(Math.PI * k);
    tmpPos.y += arc * 10;
    tmpPos.x += arc * Math.sin(i0 * 1.7) * 6;

    if (forced) pointerS.set(0, 0), (fx.shake = 0), forced.fx || (fx.flash = 0);
    else pointerS.lerp(pointer, damp(2.5, dt));
    tmpPos.x += pointerS.x * 1.6;
    tmpPos.y += pointerS.y * 1.0;

    fx.shake = Math.max(0, fx.shake - dt * 1.6);
    const sh = fx.shake * fx.shake * 0.35;
    tmpPos.x += (Math.random() - 0.5) * sh;
    tmpPos.y += (Math.random() - 0.5) * sh;

    camera.position.copy(tmpPos);
    if (forced) lookS.copy(tmpLook);
    else lookS.lerp(tmpLook, damp(6, dt));
    camera.lookAt(lookS);

    // screen-space offset so 3D content sits opposite the copy
    const targetSide = lerp(sides[i0], sides[i1], smootherstep(k));
    side = forced ? targetSide : lerp(side, targetSide, damp(4, dt));
    const w = forced?.w ?? window.innerWidth;
    const h = forced?.h ?? window.innerHeight;
    if (w > 900) camera.setViewOffset(w, h, side * w * 0.17, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.2, w, h);

    // chapter updates
    const nowFocused = Math.round(cur);
    if (nowFocused !== focused) {
      focused = nowFocused;
      enterTime[focused] = t;
      navLinks.forEach((a, j) => a.classList.toggle('on', j === focused));
      const st = sections[focused].dataset.stage;
      const si = st ? stageOrder.indexOf(st) : focused === 0 ? -1 : focused >= N - 1 ? 99 : -1;
      const ii = focused === N - 1 ? stageOrder.length : si;
      stageEls.forEach((el, j) => {
        el.classList.toggle('on', j === ii);
        el.classList.toggle('done', j < ii || focused === N - 1);
      });
      hint.classList.toggle('hide', focused > 0);
    }
    for (let j = 0; j < N; j++) {
      const local = cur - j;
      const a = clamp(1 - Math.abs(local) * 1.15);
      const ch = chapters[j];
      const visible = local > -1.0 && local < 1.6;
      ch.group.visible = visible;
      if (!visible) continue;
      if (enterTime[j] < 0 && Math.abs(local) < 0.9) enterTime[j] = t;
      // collapse content once the camera has flown past it, so flights never clip through geometry
      const exit = local > 0 ? smootherstep((local - 0.04) / 0.32) : 0;
      const enter = local < 0 ? smootherstep((local + 1.0) / 0.5) : 1;
      ch.group.scale.setScalar(Math.max(0.001, (1 - exit) * enter));
      const since = forced
        ? typeof forced.since === 'number' ? forced.since : forced.since(j)
        : enterTime[j] < 0 ? 0 : t - enterTime[j];
      ch.update({ t, dt, a, local, since });
    }

    world.update(t, camera, pr);
    fx.flash = Math.max(0, fx.flash - dt * 1.4);
    post.finish.uniforms.uTime.value = t;
    post.finish.uniforms.uFlash.value = fx.flash * fx.flash;
    post.bloom.strength = 0.62 + fx.flash * 1.2;
    post.composer.render(dt);
    if (loopIt) requestAnimationFrame(() => frame());
  };
  requestAnimationFrame(() => frame());

  if (import.meta.env.DEV) {
    /**
     * Render the booth loop deterministically (1920×1080) and stream JPEG frames to .video/<name>/.
     * `still` renders a single frame at that second (for QA); otherwise renders [from, to).
     */
    const win = window as unknown as Record<string, unknown>;
    win.__video = async (o: { from?: number; to?: number; fps?: number; name?: string; still?: number } = {}) => {
      const W = 1920;
      const H = 1080;
      const fps = o.fps ?? 30;
      const name = o.name ?? 'booth';
      const tl = timeline();
      videoMode = true;
      renderer.setPixelRatio(1);
      renderer.setSize(W, H, false);
      post.setSize(W, H, 1);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      const logo = new Image();
      logo.src = '/gitar-wordmark.svg';
      await logo.decode();
      const overlay = createOverlay(sections, logo);
      const out = document.createElement('canvas');
      out.width = W;
      out.height = H;
      const o2 = out.getContext('2d')!;
      const first = o.still !== undefined ? Math.round(o.still * fps) : Math.round((o.from ?? 0) * fps);
      const last = o.still !== undefined ? first + 1 : Math.round((o.to ?? tl.duration) * fps);
      fx.flash = 0;
      win.__videoTotal = Math.round(tl.duration * fps);
      for (let f = first; f < last; f++) {
        const T = f / fps;
        forced = { coord: tl.coord(T), since: (j) => tl.since(j, T), t: T, dt: 1 / fps, fx: true, w: W, h: H };
        frame(false);
        o2.drawImage(canvas, 0, 0, W, H);
        const c = tl.copy(T);
        overlay(o2, W, H, c.j, c.o, 1);
        const fade = smoothstep(0, 0.9, T) * (1 - smoothstep(tl.duration - 1.1, tl.duration - 0.05, T));
        if (fade < 1) {
          o2.fillStyle = `rgba(4,6,10,${1 - fade})`;
          o2.fillRect(0, 0, W, H);
        }
        const data = out.toDataURL('image/jpeg', 0.93);
        await fetch(`/__frame?dir=${encodeURIComponent(name)}&i=${f}`, { method: 'POST', body: data });
        win.__videoProgress = f;
      }
      forced = null;
      videoMode = false;
      onResize();
      return { frames: last - first, duration: tl.duration };
    };

    /** Render a frozen frame (with the copy block outlined) and save it via the dev server. */
    (window as unknown as Record<string, unknown>).__capture = async (coord: number, since: number, name: string) => {
      forced = { coord, since };
      for (let i = 0; i < 3; i++) frame(false);
      const out = document.createElement('canvas');
      out.width = canvas.width;
      out.height = canvas.height;
      const o2 = out.getContext('2d')!;
      o2.drawImage(canvas, 0, 0);
      const sec = sections[Math.round(coord)];
      const copy = sec.querySelector('.copy');
      if (copy) {
        const sr = sec.getBoundingClientRect();
        const cr = copy.getBoundingClientRect();
        const s = canvas.width / window.innerWidth;
        o2.fillStyle = 'rgba(255,0,80,0.16)';
        o2.strokeStyle = 'rgba(255,0,80,0.8)';
        o2.lineWidth = 2;
        o2.fillRect(cr.left * s, (cr.top - sr.top) * s, cr.width * s, cr.height * s);
        o2.strokeRect(cr.left * s, (cr.top - sr.top) * s, cr.width * s, cr.height * s);
      }
      forced = null;
      const data = out.toDataURL('image/jpeg', 0.82);
      await fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: data });
      return name;
    };
  }
}

boot();
