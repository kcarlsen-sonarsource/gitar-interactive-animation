import * as THREE from 'three';
import { C, CSS } from '../lib/palette';
import { glowSprite, label } from '../lib/text';
import { fx } from '../lib/fx';
import { clamp, easeOutBack, easeOutCubic, glowColor, rng, smoothstep } from '../lib/util';
import type { Chapter, Ctx } from '../lib/types';

const SEG = 28;
const R = 7.5;
const LAP = 2.4;
const LAPS = 3;
const PERIOD = 14;

export async function greenChapter(_ctx: Ctx): Promise<Chapter> {
  const group = new THREE.Group();
  const r = rng(51);
  const ringRoot = new THREE.Group();
  group.add(ringRoot);

  // each check fails until a given lap (0 = passes first time)
  const passLap = Array.from({ length: SEG }, () => {
    const v = r();
    return v < 0.55 ? 0 : v < 0.85 ? 1 : 2;
  });
  const segGeo = new THREE.BoxGeometry(1.2, 0.5, 0.5);
  const segs = Array.from({ length: SEG }, (_, i) => {
    const ang = (i / SEG) * Math.PI * 2 + Math.PI / 2;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const m = new THREE.Mesh(segGeo, mat);
    m.position.set(Math.cos(ang) * R, Math.sin(ang) * R, 0);
    m.rotation.z = ang + Math.PI / 2;
    ringRoot.add(m);
    return { m, mat, ang };
  });
  const track = new THREE.Mesh(
    new THREE.TorusGeometry(R, 0.04, 8, 200),
    new THREE.MeshBasicMaterial({ color: glowColor(C.blue, 1.4), transparent: true, opacity: 0.5 }),
  );
  ringRoot.add(track);
  const outer = new THREE.Mesh(
    new THREE.TorusGeometry(R + 1.3, 0.02, 8, 200),
    new THREE.MeshBasicMaterial({ color: glowColor(C.sky, 1.2), transparent: true, opacity: 0.3 }),
  );
  ringRoot.add(outer);

  // runner head
  const head = new THREE.Group();
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), new THREE.MeshBasicMaterial({ color: glowColor(C.white, 3) })));
  head.add(glowSprite(C.cyan, 4, 1));
  ringRoot.add(head);
  // comet trail
  const TR = 40;
  const trail = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: glowColor(C.cyan, 2.5), transparent: true, opacity: 0.8 }), TR);
  ringRoot.add(trail);

  // centre: spinner while running, check mark when green
  const spinner = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.12, 12, 80, Math.PI * 1.4),
    new THREE.MeshBasicMaterial({ color: glowColor(C.blueBright, 2.4) }),
  );
  group.add(spinner);
  const ciTag = label('ci · running', { size: 0.6, color: CSS.sky, bg: null, border: null, weight: 400 });
  group.add(ciTag);

  const shape = new THREE.Shape();
  shape.moveTo(-2.2, 0.1);
  shape.lineTo(-0.7, -1.4);
  shape.lineTo(2.4, 1.7);
  shape.lineTo(1.8, 2.3);
  shape.lineTo(-0.7, -0.2);
  shape.lineTo(-1.6, 0.7);
  shape.closePath();
  const checkGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3 });
  checkGeo.center();
  const check = new THREE.Mesh(checkGeo, new THREE.MeshBasicMaterial({ color: glowColor(C.green, 1.25) }));
  group.add(check);
  const checkGlow = glowSprite(C.green, 14, 0.3);
  group.add(checkGlow);

  const shock = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 96),
    new THREE.MeshBasicMaterial({ color: glowColor(C.green, 3), transparent: true, side: THREE.DoubleSide, depthWrite: false }),
  );
  group.add(shock);

  const doneTag = label('all checks passed · committed on green', { size: 0.62, color: CSS.green, dot: CSS.green, border: 'rgba(46,229,157,0.5)' });
  doneTag.position.set(0, -R - 2.2, 0);
  group.add(doneTag);
  const iterTags = [0, 1, 2].map((i) => {
    const l = label(`iteration ${i + 1} of ${LAPS}`, { size: 0.7, color: CSS.sky, dot: CSS.cyan });
    l.position.set(0, R + 2.1, 0);
    group.add(l);
    return l;
  });

  const iterEl = document.getElementById('iter-count');
  const iterLabel = document.getElementById('iter-label');
  let lastIter = '';
  let flashed = false;
  let lastLt = 0;
  const red = new THREE.Color(C.red).multiplyScalar(1.15);
  const grn = new THREE.Color(C.green).multiplyScalar(0.85);
  const idle = new THREE.Color(C.grey).multiplyScalar(1.2);
  const m4 = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const one = new THREE.Vector3();
  const qI = new THREE.Quaternion();

  return {
    id: 'green',
    group,
    cam: { pos: new THREE.Vector3(0, 0.5, 30), look: new THREE.Vector3(0, -0.5, 0) },
    update({ t, a, since }) {
      const lt = since % PERIOD;
      if (lt < lastLt) flashed = false;
      lastLt = lt;
      const reset = smoothstep(PERIOD - 0.8, PERIOD, lt);
      const run = clamp((lt - 0.6) / (LAP * LAPS));
      const lapF = run * LAPS; // 0..3
      const lap = Math.min(LAPS - 1, Math.floor(lapF));
      const lapFrac = lapF - Math.floor(lapF);
      const done = run >= 1;
      const headAng = Math.PI / 2 - lapF * Math.PI * 2;
      ringRoot.rotation.set(Math.sin(t * 0.3) * 0.15, Math.sin(t * 0.25) * 0.25, 0);

      segs.forEach((sg, i) => {
        // the angle the head has travelled past this segment in the current lap
        const segPos = ((Math.PI / 2 - sg.ang) / (Math.PI * 2) + 1) % 1; // 0..1 along lap
        const visited = done ? LAPS : Math.floor(lapF) + (lapFrac > segPos ? 1 : 0);
        const lapSeen = visited - 1;
        let c: THREE.Color;
        if (visited === 0) c = idle;
        else c = passLap[i] <= lapSeen ? grn : red;
        sg.mat.color.copy(c);
        const nearHead = Math.abs(((segPos - lapFrac + 1.5) % 1) - 0.5) < 0.03 && !done;
        sg.m.scale.setScalar(nearHead ? 1.5 : 1);
      });
      head.visible = !done && run > 0;
      head.position.set(Math.cos(headAng) * R, Math.sin(headAng) * R, 0.3);
      for (let i = 0; i < TR; i++) {
        const ang = headAng + i * 0.035;
        const sc = run > 0 && !done ? (1 - i / TR) * 1.2 : 0;
        v.set(Math.cos(ang) * R, Math.sin(ang) * R, 0.3);
        m4.compose(v, qI, one.setScalar(sc));
        trail.setMatrixAt(i, m4);
      }
      trail.instanceMatrix.needsUpdate = true;

      // centre states
      const doneT = done ? lt - (0.6 + LAP * LAPS) : -1;
      if (done && !flashed) {
        flashed = true;
        if (a > 0.6) fx.trigger(0.35, 0.6);
      }
      spinner.rotation.z = -t * 4;
      spinner.scale.setScalar(Math.max(0.001, (done ? 1 - clamp(doneT * 4) : 1) * (1 - reset)));
      ciTag.material.opacity = (done ? 0 : 1) * a;
      ciTag.position.set(0, -3.3, 0);
      const ck = done ? easeOutBack(clamp(doneT / 0.7)) : 0;
      check.scale.setScalar(Math.max(0.001, ck * (1 - reset)));
      check.rotation.y = Math.sin(t * 1.2) * 0.35;
      checkGlow.material.opacity = 0.55 * ck * a * (1 - reset);
      const sk = done ? clamp(doneT / 1.4) : 0;
      shock.scale.setScalar(1 + easeOutCubic(sk) * 16);
      (shock.material as THREE.MeshBasicMaterial).opacity = (sk > 0 && sk < 1 ? 1 - sk : 0) * a;
      doneTag.material.opacity = clamp(doneT * 2) * a * (1 - reset);
      track.material.color.set(done ? C.green : C.blue).multiplyScalar(1.4);
      iterTags.forEach((l, i) => {
        l.material.opacity = (i === lap && run > 0 && !done ? 1 : 0) * a;
      });

      if (iterEl && iterLabel && a > 0.3) {
        const txt = done ? 'green ✓' : run > 0 ? `iteration ${lap + 1}` : 'iteration 1';
        if (txt !== lastIter) {
          lastIter = txt;
          iterEl.textContent = txt;
          iterEl.style.color = done ? CSS.green : CSS.white;
          iterLabel.textContent = done ? 'all checks passed · committed on green' : 'gitar fixing & re-running ci…';
        }
      }
    },
  };
}
