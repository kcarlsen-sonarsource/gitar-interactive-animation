import * as THREE from 'three';
import { C, CSS } from '../lib/palette';
import { commentCard, glowSprite, label, logTexture } from '../lib/text';
import { clamp, easeOutBack, easeOutCubic, glowColor, rng, smoothstep } from '../lib/util';
import type { Chapter, Ctx } from '../lib/types';

type Status = 'pass' | 'fail' | 'flaky' | 'infra';
const COLS = 7;
const ROWS = 4;
const GAP = 2.2;
const PERIOD = 15;

const FAIL_NAMES = ['lint', 'clippy', 'test-rust-macos', 'test-rust-linux'];
const LOGS = [
  '$ cargo fmt --check',
  'Diff in gitar_status.rs at line 88',
  'error: this expression creates a reference which is',
  '  immediately dereferenced by the compiler',
  'warning: retrying job (runner lost connection) 1/3',
  'test header::renders_docs_link ... FAILED',
  "assertion `left == right` failed",
  '  left: "## Gitar"  right: "## Gitar Review"',
  'npm ERR! network timeout at registry.npmjs.org',
  'retry: e2e/checkout.spec.ts (flaky, 2/3 passed)',
  'test structured_links::count ... FAILED',
  'error[E0308]: mismatched types',
  'Downloading toolchain stable-aarch64-apple-darwin',
  'Process completed with exit code 101.',
  'warn: cache miss for ~/.cargo/registry',
  'thread main panicked at src/comment.rs:142:9',
];

export async function ciChapter(_ctx: Ctx): Promise<Chapter> {
  const group = new THREE.Group();
  const r = rng(31);

  // statuses: 4 real failures, 3 flaky, 2 infra noise, rest pass
  const statuses: Status[] = Array(COLS * ROWS).fill('pass');
  const pick = (n: number, s: Status) => {
    let k = 0;
    while (k < n) {
      const i = Math.floor(r() * statuses.length);
      if (statuses[i] === 'pass') {
        statuses[i] = s;
        k++;
      }
    }
  };
  pick(4, 'fail');
  pick(3, 'flaky');
  pick(2, 'infra');

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(COLS * GAP + 1.6, 0.3, ROWS * GAP + 1.6),
    new THREE.MeshStandardMaterial({ color: 0x0b111c, metalness: 0.8, roughness: 0.4 }),
  );
  plate.position.y = -0.15;
  const plateEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(plate.geometry),
    new THREE.LineBasicMaterial({ color: glowColor(C.blueBright, 1.4), transparent: true, opacity: 0.5 }),
  );
  plate.add(plateEdge);
  const stage = new THREE.Group();
  stage.position.set(0, -4.5, 0);
  stage.rotation.y = -0.5;
  stage.add(plate);
  group.add(stage);
  const keyLight = new THREE.PointLight(C.sky, 60, 40, 2);
  keyLight.position.set(-4, 8, 8);
  stage.add(keyLight, new THREE.AmbientLight(0x334466, 0.6));

  const colorOf: Record<Status, number> = { pass: C.green, fail: C.red, flaky: C.amber, infra: C.violet };
  const pillars = statuses.map((st, i) => {
    const cx = (i % COLS) - (COLS - 1) / 2;
    const cz = Math.floor(i / COLS) - (ROWS - 1) / 2;
    const h = st === 'fail' ? 3.2 + r() * 1.5 : 1.2 + r() * 2.4;
    const geo = new THREE.BoxGeometry(1.25, 1, 1.25);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x101826,
      emissive: new THREE.Color(C.blue),
      emissiveIntensity: 0.4,
      metalness: 0.3,
      roughness: 0.5,
      transparent: true,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(cx * GAP, 0, cz * GAP);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.08, 1.3),
      new THREE.MeshBasicMaterial({ color: glowColor(colorOf[st], 2.5), transparent: true }),
    );
    cap.position.y = 1;
    m.add(cap);
    m.userData = { st, h, delay: r() * 0.9, mat, cap };
    stage.add(m);
    return m;
  });

  // labels for every non-passing job
  let fi = 0;
  const tags = pillars.map((p) => {
    const st = p.userData.st as Status;
    if (st === 'pass') return null;
    const txt = st === 'fail' ? FAIL_NAMES[fi++] : st === 'flaky' ? 'flaky · retried' : 'infra noise';
    const css = st === 'fail' ? CSS.red : st === 'flaky' ? CSS.amber : CSS.violet;
    const l = label(txt, { size: 0.5, color: css, dot: css, border: css + '77' });
    stage.add(l);
    return l;
  });

  // root cause node
  const root = new THREE.Group();
  root.position.set(0, 8.2, 0);
  const rootCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshBasicMaterial({ color: glowColor(C.red, 3) }));
  const rootShell = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.6, 0),
    new THREE.MeshBasicMaterial({ color: glowColor(C.red, 1.5), wireframe: true, transparent: true, opacity: 0.6 }),
  );
  root.add(rootCore, rootShell, glowSprite(C.red, 7, 0.7));
  stage.add(root);
  const rootTag = label('4 failures → 1 root cause', { size: 0.62, color: CSS.white, dot: CSS.red, border: 'rgba(255,77,94,0.6)' });
  rootTag.position.set(0, 10.3, 0);
  stage.add(rootTag);

  const card = commentCard({
    tag: { text: 'ci analysis', color: CSS.red },
    body: [
      'Issue: comment header changed from a constant to',
      'a function and the default docs link was removed.',
      '',
      'Root cause · 4 jobs failed: lint (formatting), clippy',
      '(3 warnings), test-rust-macos + test-rust-linux',
      '(assertions on the old header format).',
    ],
    footer: 'flaky e2e retried · runner timeout ignored',
    width: 7.8,
    accent: 'rgba(255,77,94,0.6)',
  });
  card.position.set(6.6, 7.6, 0);
  card.rotation.y = -0.25;
  group.add(card);

  // beams from each real failure to the root cause
  const fails = pillars.filter((p) => p.userData.st === 'fail');
  const beams = fails.map((p) => {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: glowColor(C.red, 2.5), transparent: true }));
    stage.add(line);
    const packet = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), new THREE.MeshBasicMaterial({ color: glowColor(C.red, 4) }));
    stage.add(packet);
    return { p, line, packet };
  });

  // scrolling log curtains
  const logs = [-1, 0, 1].map((k) => {
    const tex = logTexture(LOGS.slice(k + 1).concat(LOGS), { rows: 48 });
    tex.repeat.set(1, 0.5);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 18),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    m.position.set(k * 9.5 + 3, 3, -10 - Math.abs(k) * 2);
    m.rotation.y = -k * 0.25;
    group.add(m);
    return { m, tex, speed: 0.025 + (k + 1) * 0.01 };
  });

  const tmp = new THREE.Vector3();
  const passC = new THREE.Color(C.green);
  const statusC = new THREE.Color();
  return {
    id: 'ci',
    group,
    cam: { pos: new THREE.Vector3(2, 6, 30), look: new THREE.Vector3(1, 1.5, 0) },
    update({ t, a, since }) {
      const lt = since % PERIOD;
      const reset = smoothstep(PERIOD - 0.8, PERIOD, lt);
      const resolve = smoothstep(2.0, 3.2, lt); // statuses appear
      const classify = smoothstep(3.8, 5.0, lt); // noise sinks
      const converge = smoothstep(5.2, 6.6, lt); // root cause
      stage.rotation.y = -0.5 + Math.sin(t * 0.2) * 0.08;

      pillars.forEach((p, i) => {
        const ud = p.userData as { st: Status; h: number; delay: number; mat: THREE.MeshStandardMaterial; cap: THREE.Mesh };
        const rise = easeOutBack(clamp((lt - ud.delay) / 1.2)) * (1 - reset);
        let h = ud.h;
        const isNoise = ud.st === 'flaky' || ud.st === 'infra';
        if (isNoise) h = ud.h * (1 - classify * 0.75);
        p.scale.set(1, Math.max(0.01, h * rise), 1);
        const running = 0.4 + 0.3 * Math.sin(t * 6 + i * 0.7);
        statusC.set(colorOf[ud.st]);
        if (ud.st === 'pass') statusC.copy(passC);
        ud.mat.emissive.set(C.blue).lerp(statusC, resolve);
        let glow = running * (1 - resolve) + resolve * (ud.st === 'pass' ? 0.25 : 0.9);
        if (ud.st === 'flaky') glow *= 0.6 + 0.4 * Math.sign(Math.sin(t * 13 + i));
        if (ud.st === 'fail') glow *= 1 + 0.5 * Math.sin(t * 5);
        if (isNoise) glow *= 1 - classify * 0.7;
        ud.mat.emissiveIntensity = glow;
        ud.mat.opacity = isNoise ? 1 - classify * 0.5 : 1;
        (ud.cap.material as THREE.MeshBasicMaterial).opacity = resolve * (isNoise ? 1 - classify * 0.6 : 1);
        ud.cap.scale.y = 1 / Math.max(0.01, h * rise);
        const tag = tags[i];
        if (tag) {
          tag.position.set(p.position.x, h * rise + 0.9, p.position.z);
          const show = ud.st === 'fail' ? resolve * (1 - converge * 0.35) : classify;
          tag.material.opacity = show * a * (1 - reset);
          tag.visible = show > 0.01;
        }
      });

      const rootK = easeOutBack(clamp((lt - 5.6) / 1.0)) * (1 - reset);
      root.scale.setScalar(Math.max(0.001, rootK));
      rootCore.rotation.set(t * 1.2, t * 0.8, 0);
      rootShell.rotation.set(-t * 0.5, t * 0.9, 0);
      rootTag.material.opacity = rootK * a;
      beams.forEach((b, bi) => {
        const ud = b.p.userData as { h: number };
        const from = tmp.set(b.p.position.x, ud.h, b.p.position.z);
        const pos = b.line.geometry.attributes.position as THREE.BufferAttribute;
        const k = easeOutCubic(clamp((converge - bi * 0.1) * 1.4));
        pos.setXYZ(0, from.x, from.y, from.z);
        pos.setXYZ(1, from.x + (root.position.x - from.x) * k, from.y + (root.position.y - from.y) * k, from.z + (root.position.z - from.z) * k);
        pos.needsUpdate = true;
        (b.line.material as THREE.LineBasicMaterial).opacity = (k > 0 ? 0.8 : 0) * (1 - reset);
        const u = (t * 0.8 + bi * 0.25) % 1;
        b.packet.visible = k >= 1 && reset < 0.5;
        b.packet.position.lerpVectors(from, root.position, u);
      });
      const cardK = easeOutCubic(clamp((lt - 6.6) / 0.9)) * (1 - reset);
      (card.material as THREE.MeshBasicMaterial).opacity = cardK * a;
      card.position.y = 7.6 + (1 - cardK) * -1.5;
      card.visible = cardK > 0.01;
      logs.forEach((l) => {
        l.tex.offset.y = -t * l.speed;
        (l.m.material as THREE.MeshBasicMaterial).opacity = 0.3 * a;
      });
    },
  };
}
