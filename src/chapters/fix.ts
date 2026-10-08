import * as THREE from 'three';
import { C, CSS } from '../lib/palette';
import { codePanel, commentCard, glowSprite, label, type CodeLine } from '../lib/text';
import { fx } from '../lib/fx';
import { clamp, easeInOutCubic, easeOutBack, easeOutCubic, glowColor, rng, smoothstep } from '../lib/util';
import type { Chapter, Ctx } from '../lib/types';

const BEFORE: CodeLine[] = [
  { n: 38, text: 'export function PRView({ id }: Props) {' },
  { n: 39, text: 'const data = usePR(id);' },
  { n: 40, text: 'if (data.error) {' },
  { n: 41, text: 'throw data.error;', kind: 'del' },
  { n: 42, text: '}' },
  { n: 43, text: 'return <Component data={data} />;' },
  { n: 44, text: '}' },
];
const AFTER: CodeLine[] = [
  { n: 38, text: 'export function PRView({ id }: Props) {' },
  { n: 39, text: 'const data = usePR(id);' },
  { n: 40, text: 'return (' },
  { n: 41, text: '<ErrorBoundary fallback={<Msg />}>', kind: 'add' },
  { n: 42, text: '  <Component data={data} />', kind: 'add' },
  { n: 43, text: '</ErrorBoundary>', kind: 'add' },
  { n: 44, text: ');' },
];
const PERIOD = 13;
const BAD_LINE = 3;

export async function fixChapter(_ctx: Ctx): Promise<Chapter> {
  const group = new THREE.Group();
  const r = rng(41);
  const panel = codePanel(BEFORE, { title: 'src/views/PRView.tsx', width: 12, measure: AFTER, badge: { text: '1 critical', color: CSS.red } });
  const panelRoot = new THREE.Group();
  panelRoot.position.set(-2, 1.6, 0);
  panelRoot.rotation.y = 0.1;
  panelRoot.add(panel.mesh);
  group.add(panelRoot);
  const badY = panel.lineY(BAD_LINE);

  // --- the Gitar agent orb ---
  const orb = new THREE.Group();
  const orbCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshBasicMaterial({ color: glowColor(C.blueBright, 1.6) }));
  const orbShell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.0, 1),
    new THREE.MeshBasicMaterial({ color: glowColor(C.sky, 1.4), wireframe: true, transparent: true, opacity: 0.45 }),
  );
  orb.add(orbCore, orbShell, glowSprite(C.blueBright, 3.2, 0.6));
  const orbLight = new THREE.PointLight(C.blueBright, 40, 20, 2);
  orb.add(orbLight);
  group.add(orb);
  const orbTag = label('gitar', { size: 0.55, color: CSS.sky, dot: CSS.blueBright });
  orb.add(orbTag);
  orbTag.position.set(0, 1.9, 0);

  // welding beam
  const beamGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 8, 1, true);
  beamGeo.translate(0, 0.5, 0);
  beamGeo.rotateX(Math.PI / 2);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: glowColor(C.cyan, 5), transparent: true }));
  group.add(beam);

  // sparks + shatter shards
  const SH = 260;
  const shards = new THREE.InstancedMesh(
    new THREE.TetrahedronGeometry(0.12, 0),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    SH,
  );
  const shardMeta = Array.from({ length: SH }, () => ({
    x: (r() - 0.5) * panel.width * 0.55 - panel.width * 0.12,
    v: new THREE.Vector3((r() - 0.5) * 6, (r() - 0.2) * 5, 1 + r() * 6),
    spin: r() * 8,
    red: r() > 0.25,
  }));
  panelRoot.add(shards);

  // --- supervision banner ---
  const policy = label('policy · may fix: bugs, lint, tests  ·  must escalate: auth/  ·  blocks: critical', {
    size: 0.5,
    color: CSS.mist,
    dot: CSS.green,
    weight: 400,
    border: 'rgba(46,229,157,0.35)',
  });
  policy.position.set(-2, 1.6 - panel.height / 2 - 7.3, 1);
  group.add(policy);

  // --- branch graph ---
  const branch = new THREE.Group();
  branch.position.set(-2, 1.6 - panel.height / 2 - 4.6, 1);
  group.add(branch);
  const lineMat = (c: number) => new THREE.LineBasicMaterial({ color: glowColor(c, 1.6), transparent: true, opacity: 0.8 });
  const mainPts = [new THREE.Vector3(-8, -1.4, 0), new THREE.Vector3(8, -1.4, 0)];
  branch.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(mainPts), lineMat(C.blue)));
  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(-6, -1.4, 0),
    new THREE.Vector3(-4.5, -1.4, 0),
    new THREE.Vector3(-4.5, 0.4, 0),
    new THREE.Vector3(-3, 0.4, 0),
  );
  const featPts = curve.getPoints(24).concat([new THREE.Vector3(6, 0.4, 0)]);
  branch.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(featPts), lineMat(C.sky)));
  const commitGeo = new THREE.SphereGeometry(0.22, 18, 18);
  const commits = [-2, 0, 2].map((x, i) => {
    const m = new THREE.Mesh(commitGeo, new THREE.MeshBasicMaterial({ color: glowColor(i === 1 ? C.red : C.sky, 2) }));
    m.position.set(x, 0.4, 0);
    branch.add(m);
    return m;
  });
  [-6, -3.5, 5].forEach((x) => {
    const m = new THREE.Mesh(commitGeo, new THREE.MeshBasicMaterial({ color: glowColor(C.blue, 2) }));
    m.position.set(x, -1.4, 0);
    branch.add(m);
  });
  const fixCommit = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 20), new THREE.MeshBasicMaterial({ color: glowColor(C.green, 3) }));
  fixCommit.position.set(4.2, 0.4, 0);
  fixCommit.add(glowSprite(C.green, 3, 0.9));
  branch.add(fixCommit);
  const fixTag = label('gitar: wrap PRView in ErrorBoundary', { size: 0.45, color: CSS.green, dot: CSS.green, border: 'rgba(46,229,157,0.45)' });
  fixTag.position.set(4.2, 1.35, 0);
  branch.add(fixTag);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.48, 40), new THREE.MeshBasicMaterial({ color: glowColor(C.green, 3), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  ring.position.copy(fixCommit.position);
  branch.add(ring);

  const card = commentCard({
    tag: { text: 'bug resolved', color: CSS.green },
    body: ['Resolved the crash by wrapping the component', 'in an ErrorBoundary with a fallback UI.'],
    footer: 'committed to feat/pr-view · within your rules',
    width: 7.2,
    accent: 'rgba(46,229,157,0.6)',
  });
  const cardW = (card.geometry as THREE.PlaneGeometry).parameters.width;
  const cardH = (card.geometry as THREE.PlaneGeometry).parameters.height;
  const cardX = -2 - panel.width / 2 + cardW / 2 + 0.3;
  card.position.set(cardX, 1.6 - panel.height / 2 - cardH / 2 - 0.35, 0.6);
  group.add(card);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const target = new THREE.Vector3();
  const redC = new THREE.Color(C.red).multiplyScalar(3);
  const cyanC = new THREE.Color(C.cyan).multiplyScalar(3);
  let fixed = false;
  let lastLt = 0;

  return {
    id: 'fix',
    group,
    cam: { pos: new THREE.Vector3(-1.5, 1, 28), look: new THREE.Vector3(-2, -0.9, 0) },
    update({ t, a, since }) {
      const lt = since % PERIOD;
      if (lt < lastLt) {
        panel.redraw(BEFORE);
        fixed = false;
      }
      lastLt = lt;
      const reset = smoothstep(PERIOD - 0.7, PERIOD, lt);
      const weld = clamp((lt - 1.6) / 2.2); // 1.6 → 3.8
      const SHATTER = 3.9;
      if (!fixed && lt > SHATTER) {
        panel.redraw(AFTER);
        fixed = true;
        if (a > 0.6) fx.trigger(0.18, 0.25);
      }
      panelRoot.position.y = 1.6 + Math.sin(t * 0.6) * 0.08;

      // orb travels in, hovers above the bad line, then retreats
      const arrive = easeInOutCubic(clamp(lt / 1.6));
      const leave = easeInOutCubic(clamp((lt - 4.6) / 1.4));
      orb.position.set(
        2.6 + (1 - arrive) * 8 + leave * 1.5,
        5.6 + Math.sin(t * 1.6) * 0.25 + (1 - arrive) * 3,
        3.5,
      );
      orbCore.rotation.set(t, t * 1.3, 0);
      orbShell.rotation.set(-t * 0.6, t * 0.4, 0);
      orbLight.intensity = 30 + (weld > 0 && weld < 1 ? 50 : 0);

      // beam from the orb to the bad line, sweeping across it
      panelRoot.updateMatrixWorld();
      const sweepX = -panel.width / 2 + 2.2 + weld * 5.5;
      target.set(sweepX, badY, 0.05);
      panelRoot.localToWorld(target);
      group.worldToLocal(target);
      const welding = weld > 0 && weld < 1;
      beam.visible = welding;
      if (welding) {
        beam.position.copy(orb.position);
        beam.lookAt(group.localToWorld(target.clone()));
        beam.scale.set(1 + Math.sin(t * 60) * 0.4, 1 + Math.sin(t * 60) * 0.4, orb.position.distanceTo(target));
      }

      // shards: sparks while welding, then the deleted line shatters outward
      for (let i = 0; i < SH; i++) {
        const sm = shardMeta[i];
        let scale = 0;
        if (welding && i < 60) {
          const u = (t * 2.5 + i * 0.137) % 1;
          p.set(sweepX + sm.v.x * u * 0.25, badY + sm.v.y * u * 0.3 - u * u * 1.5, 0.1 + sm.v.z * u * 0.2);
          scale = (1 - u) * 0.8;
          q.setFromEuler(e.set(t * sm.spin, t, 0));
          shards.setColorAt(i, cyanC);
        } else if (lt > SHATTER) {
          const k = clamp((lt - SHATTER) / 1.6);
          const ek = easeOutCubic(k);
          p.set(sm.x + sm.v.x * ek, badY + sm.v.y * ek - k * k * 3, 0.1 + sm.v.z * ek);
          scale = (1 - k) * 1.3;
          q.setFromEuler(e.set(t * sm.spin, t * sm.spin * 0.5, 0));
          shards.setColorAt(i, sm.red ? redC : cyanC);
        }
        s.setScalar(scale * (1 - reset));
        m4.compose(p, q, s);
        shards.setMatrixAt(i, m4);
      }
      shards.instanceMatrix.needsUpdate = true;
      if (shards.instanceColor) shards.instanceColor.needsUpdate = true;

      // commit lands on the branch
      const commitK = easeOutBack(clamp((lt - 4.6) / 0.8)) * (1 - reset);
      fixCommit.scale.setScalar(Math.max(0.001, commitK));
      fixTag.material.opacity = clamp(commitK) * a;
      const ringK = clamp((lt - 4.8) / 1.2);
      ring.scale.setScalar(1 + ringK * 4);
      (ring.material as THREE.MeshBasicMaterial).opacity = (1 - ringK) * (ringK > 0 ? 1 : 0) * a;
      ring.visible = ringK > 0 && ringK < 1;
      (commits[1].material as THREE.MeshBasicMaterial).color.set(lt > SHATTER && reset < 0.5 ? C.green : C.red).multiplyScalar(2);
      const cardK = easeOutCubic(clamp((lt - 5.2) / 0.9)) * (1 - reset);
      (card.material as THREE.MeshBasicMaterial).opacity = cardK * a;
      card.position.x = cardX - (1 - cardK) * 4;
      card.visible = cardK > 0.01;
      policy.material.opacity = a;
      (panel.mesh.material as THREE.MeshBasicMaterial).opacity = a;
    },
  };
}
