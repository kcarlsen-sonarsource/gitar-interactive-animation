import * as THREE from 'three';
import { C, CSS } from '../lib/palette';
import { codePanel, commentCard, glowSprite, label, type CodeLine } from '../lib/text';
import { clamp, easeOutBack, easeOutCubic, glowColor, rng, smoothstep } from '../lib/util';
import type { Chapter, Ctx } from '../lib/types';

const LINES: CodeLine[] = [
  { n: 12, text: "import { cache } from '../lib/cache';" },
  { n: 13, text: '' },
  { n: 14, text: 'export async function fetchPR(id: string) {' },
  { n: 15, text: 'const url = `${API}/pr/${id}?token=${TOKEN}`;', kind: 'add' },
  { n: 16, text: 'const res = await fetch(url);', kind: 'add' },
  { n: 17, text: 'const data = await res.json();', kind: 'add' },
  { n: 18, text: 'if (!res.ok) throw data.error;', kind: 'add' },
  { n: 19, text: 'cache.set(id, data);', kind: 'add' },
  { n: 20, text: 'return data.items.map(toRow);', kind: 'add' },
  { n: 21, text: '}' },
  { n: 22, text: '' },
  { n: 23, text: 'export function PRList({ ids }: Props) {' },
  { n: 24, text: 'const rows = ids.map(fetchPR);', kind: 'add' },
  { n: 25, text: 'return <Table rows={rows} />;', kind: 'add' },
  { n: 26, text: '}' },
];

const FINDINGS = [
  { line: 3, sev: 'critical', kind: 'security', text: 'token leaked in URL', color: C.red, css: CSS.red },
  { line: 6, sev: 'important', kind: 'bug', text: 'unhandled throw crashes view', color: C.amber, css: CSS.amber },
  { line: 12, sev: 'important', kind: 'bug', text: 'promises rendered as rows', color: C.amber, css: CSS.amber },
];

const PERIOD = 15;

export async function reviewChapter(_ctx: Ctx): Promise<Chapter> {
  const group = new THREE.Group();
  const panel = codePanel(LINES, {
    title: 'src/api/pull-requests.ts',
    width: 13,
    badge: { text: 'gitar · reviewing', color: CSS.sky },
  });
  const panelRoot = new THREE.Group();
  panelRoot.add(panel.mesh);
  panelRoot.rotation.y = 0.12;
  panelRoot.position.x = 2.4;
  group.add(panelRoot);

  const backGlow = glowSprite(C.blue, 34, 0.25);
  backGlow.position.z = -4;
  group.add(backGlow);

  // --- scanner ---
  const scanner = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.PlaneGeometry(panel.width + 1.2, 0.05),
    new THREE.MeshBasicMaterial({ color: glowColor(C.cyan, 4), transparent: true }),
  );
  const wash = new THREE.Mesh(
    new THREE.PlaneGeometry(panel.width + 1.2, 2.2),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
      fragmentShader:
        'varying vec2 vUv; void main(){ float a = pow(vUv.y, 3.0) * (1.0 - pow(abs(vUv.x-0.5)*2.0, 6.0)); gl_FragColor = vec4(0.24,0.55,1.0, a*0.5);} ',
    }),
  );
  wash.position.y = 1.1;
  scanner.add(beam, wash);
  scanner.position.z = 0.15;
  panelRoot.add(scanner);

  // --- noise: speculative nitpicks that never reach the PR ---
  const NOISE = 520;
  const r = rng(21);
  const noise = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.11, 0),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
    NOISE,
  );
  const nmeta = Array.from({ length: NOISE }, () => ({
    p: new THREE.Vector3((r() - 0.5) * (panel.width + 3), (r() - 0.5) * (panel.height + 1), 0.4 + r() * 4.5),
    v: new THREE.Vector3((r() - 0.5) * 3, (r() - 0.5) * 3, 2 + r() * 4),
    spin: r() * 6,
  }));
  panelRoot.add(noise);
  const noiseLabel = label('noise filtered', { size: 0.62, color: CSS.mist, dot: CSS.grey, border: 'rgba(154,167,184,0.3)' });
  noiseLabel.position.set(-panel.width / 2 + 1.6, panel.height / 2 + 1.1, 1.5);
  panelRoot.add(noiseLabel);

  // --- findings ---
  const findings = FINDINGS.map((f) => {
    const g = new THREE.Group();
    const y = panel.lineY(f.line);
    const bar = new THREE.Mesh(
      new THREE.PlaneGeometry(panel.width - 0.2, (panel.height / LINES.length) * 0.82),
      new THREE.MeshBasicMaterial({ color: glowColor(f.color, 1.3), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    bar.position.set(0, y, 0.05);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), new THREE.MeshBasicMaterial({ color: glowColor(f.color, 3.5) }));
    dot.position.set(-panel.width / 2 - 0.45, y, 0.2);
    dot.add(glowSprite(f.color, 1.8, 0.9));
    const tag = label(`${f.sev} · ${f.kind}`, { size: 0.55, color: f.css, dot: f.css, border: f.css + '88' });
    // severity tags live in the gutter, right-aligned against their dot, so they never cover code
    const gutterX = -panel.width / 2 - 0.85;
    tag.position.set(gutterX - tag.scale.x / 2, y + 0.24, 0.2);
    const sub = label(f.text, { size: 0.42, color: CSS.white, bg: 'rgba(8,14,24,0.9)', border: null, weight: 400 });
    sub.position.set(gutterX - sub.scale.x / 2, y - 0.3, 0.2);
    tag.userData.base = tag.scale.clone();
    g.add(bar, dot, tag, sub);
    g.userData = { y, bar, tag, sub, dot };
    panelRoot.add(g);
    return g;
  });

  // --- one consolidated comment ---
  const card = commentCard({
    tag: { text: '3 findings', color: CSS.red },
    body: [
      'Code Review · 1 critical, 2 important',
      '',
      '● Security: token is interpolated into the URL',
      '● Bug: raw throw bypasses the ErrorBoundary',
      '● Bug: fetchPR returns promises, not rows',
    ],
    footer: '⟶ one consolidated comment · inline only where it matters',
    width: 8.4,
  });
  const cardP = (card.geometry as THREE.PlaneGeometry).parameters;
  const cardX = -panel.width / 2 + cardP.width / 2;
  card.position.set(cardX, -panel.height / 2 - cardP.height / 2 - 0.35, 0.3);
  panelRoot.add(card);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const col = new THREE.Color();
  const grey = new THREE.Color(C.grey).multiplyScalar(1.6);
  const flashC = new THREE.Color(C.cyan).multiplyScalar(3);
  const top = panel.height / 2 + 0.3;
  const bottom = -panel.height / 2 - 0.3;

  return {
    id: 'review',
    group,
    cam: { pos: new THREE.Vector3(1, 1.2, 27), look: new THREE.Vector3(0, -1.4, 0) },
    update({ t, a, since }) {
      const lt = since % PERIOD;
      const reset = smoothstep(PERIOD - 0.8, PERIOD, lt);
      const appear = easeOutCubic(clamp(lt / 1.0));
      panelRoot.position.y = (1 - appear) * -2 + Math.sin(t * 0.7) * 0.15;
      panelRoot.rotation.y = 0.12 + Math.sin(t * 0.3) * 0.05;
      (panel.mesh.material as THREE.MeshBasicMaterial).opacity = a;

      // scanner sweep between 1.2s and 4.8s
      const sweep = clamp((lt - 1.2) / 3.6);
      const scanY = top + (bottom - top) * sweep;
      scanner.position.y = scanY;
      scanner.visible = sweep > 0 && sweep < 1;

      for (let i = 0; i < NOISE; i++) {
        const n = nmeta[i];
        const passed = sweep > 0 && n.p.y > scanY ? 1 : 0;
        // time since the scanner crossed this particle
        const crossT = passed ? (lt - 1.2 - ((top - n.p.y) / (top - bottom)) * 3.6) : 0;
        const k = clamp(crossT / 0.9);
        p.copy(n.p).addScaledVector(n.v, easeOutCubic(k));
        p.y += Math.sin(t * 1.5 + i) * 0.06;
        e.set(t * n.spin, t * n.spin * 0.7, 0);
        q.setFromEuler(e);
        const sc = (1 - k) * appear * (1 - reset) * (1 + (k > 0 && k < 0.25 ? 1.6 : 0));
        s.setScalar(Math.max(0, sc));
        m4.compose(p, q, s);
        noise.setMatrixAt(i, m4);
        col.copy(grey).lerp(flashC, k > 0 ? 1 - k : 0);
        noise.setColorAt(i, col);
      }
      noise.instanceMatrix.needsUpdate = true;
      if (noise.instanceColor) noise.instanceColor.needsUpdate = true;
      noiseLabel.visible = sweep > 0.15;
      (noiseLabel.material as THREE.SpriteMaterial).opacity = smoothstep(0.15, 0.4, sweep) * (1 - reset) * a;

      findings.forEach((g, fi) => {
        const ud = g.userData as { y: number; bar: THREE.Mesh; tag: THREE.Sprite; sub: THREE.Sprite; dot: THREE.Mesh };
        const hitAt = 1.2 + ((top - ud.y) / (top - bottom)) * 3.6;
        const k = easeOutBack(clamp((lt - hitAt) / 0.6)) * (1 - reset);
        const pulse = 0.22 + 0.12 * Math.sin(t * 4 + fi);
        (ud.bar.material as THREE.MeshBasicMaterial).opacity = clamp(k) * pulse * a;
        ud.dot.scale.setScalar(Math.max(0.001, k));
        const pop = 0.7 + 0.3 * Math.max(0, k);
        ud.tag.scale.copy(ud.tag.userData.base as THREE.Vector3).multiplyScalar(pop);
        ud.tag.material.opacity = clamp(k) * a;
        ud.sub.material.opacity = clamp(k) * a;
      });

      const cardK = easeOutCubic(clamp((lt - 5.4) / 1.0)) * (1 - reset);
      card.position.x = cardX - (1 - cardK) * 6;
      (card.material as THREE.MeshBasicMaterial).opacity = cardK * a;
      card.visible = cardK > 0.01;
      backGlow.material.opacity = 0.22 * a;
    },
  };
}
