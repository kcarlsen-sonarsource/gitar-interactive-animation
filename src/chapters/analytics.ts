import * as THREE from 'three';
import { C, CSS } from '../lib/palette';
import { glowSprite, label } from '../lib/text';
import { clamp, easeOutCubic, glowColor, smoothstep } from '../lib/util';
import type { Chapter, Ctx } from '../lib/types';

// Illustrative trend only: time-to-merge falls, Gitar's share of fix work rises.
const WEEKS = 12;
const TTM = [9.5, 9.1, 8.6, 7.4, 6.9, 5.8, 5.1, 4.6, 4.1, 3.6, 3.3, 3.0];
const FIX = [0.8, 1.4, 2.2, 3.1, 4.0, 4.8, 5.5, 6.1, 6.6, 7.0, 7.3, 7.5];
const FLAKE = [4.0, 3.9, 3.5, 3.2, 2.7, 2.4, 2.0, 1.8, 1.5, 1.3, 1.2, 1.1];

export async function analyticsChapter(_ctx: Ctx): Promise<Chapter> {
  const group = new THREE.Group();
  const chart = new THREE.Group();
  chart.position.set(-1, -5.5, 0);
  chart.rotation.set(0.1, 0.42, 0);
  group.add(chart);
  const W = 1.5;
  const x0 = (-(WEEKS - 1) * W) / 2;

  // base plate + grid
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(WEEKS * W + 1.5, 0.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x0b111c, metalness: 0.8, roughness: 0.4 }),
  );
  plate.position.y = -0.1;
  chart.add(plate);
  chart.add(new THREE.AmbientLight(0x334466, 0.8));
  const pl = new THREE.PointLight(C.sky, 60, 40, 2);
  pl.position.set(-6, 10, 8);
  chart.add(pl);
  for (let k = 1; k <= 4; k++) {
    const gl = new THREE.Mesh(
      new THREE.PlaneGeometry(WEEKS * W + 1.5, 0.02),
      new THREE.MeshBasicMaterial({ color: glowColor(C.blue, 1.5), transparent: true, opacity: 0.35 }),
    );
    gl.position.set(0, k * 2.5, -2.4);
    chart.add(gl);
  }

  // time-to-merge bars
  const bars = TTM.map((h, i) => {
    const geo = new THREE.BoxGeometry(0.9, 1, 0.9);
    geo.translate(0, 0.5, 0);
    const t = i / (WEEKS - 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0e1a2c,
      emissive: new THREE.Color(C.blue).lerp(new THREE.Color(C.sky), t),
      emissiveIntensity: 0.8,
      metalness: 0.2,
      roughness: 0.4,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x0 + i * W, 0, -0.6);
    m.userData.h = h;
    chart.add(m);
    return m;
  });

  // fix-rate tube (rising) and flake-rate tube (falling)
  const mkTube = (vals: number[], z: number, color: number, scale: number) => {
    const pts = vals.map((v, i) => new THREE.Vector3(x0 + i * W, v * scale, z));
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 200, 0.09, 8, false);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: glowColor(color, 3) }));
    chart.add(mesh);
    const dots = pts.map((p) => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 12), new THREE.MeshBasicMaterial({ color: glowColor(color, 3.5) }));
      d.position.copy(p);
      chart.add(d);
      return d;
    });
    const head = glowSprite(color, 2.5, 1);
    chart.add(head);
    return { mesh, geo, dots, curve, head, total: geo.index!.count };
  };
  const fix = mkTube(FIX, 1.2, C.green, 1.25);
  const flake = mkTube(FLAKE, 2.2, C.amber, 1.0);

  const kpis = [
    { text: 'time to merge ↓', color: CSS.sky, pos: new THREE.Vector3(x0 + 2.2, 11.2, -0.6) },
    { text: 'fixes absorbed by gitar ↑', color: CSS.green, pos: new THREE.Vector3(x0 + (WEEKS - 1) * W - 1.5, 11.0, 1.2) },
    { text: 'flake rate ↓', color: CSS.amber, pos: new THREE.Vector3(x0 + (WEEKS - 1) * W, 2.8, 2.2) },
  ].map((k) => {
    const l = label(k.text, { size: 0.6, color: k.color, dot: k.color, border: k.color + '77' });
    l.position.copy(k.pos);
    chart.add(l);
    return l;
  });
  const weekLabels = [0, 3, 7, 11].map((i) => {
    const l = label(i === 0 ? 'before gitar' : `week ${i + 1}`, { size: 0.42, color: CSS.mist, bg: null, border: null, weight: 400 });
    l.position.set(x0 + i * W, -0.8, 2.8);
    chart.add(l);
    return l;
  });

  return {
    id: 'analytics',
    group,
    cam: { pos: new THREE.Vector3(-1, 3, 33), look: new THREE.Vector3(-1, -0.5, 0) },
    update({ t, a, since }) {
      const build = clamp(since / 3.5);
      bars.forEach((b, i) => {
        const k = easeOutCubic(clamp(build * 1.6 - i * 0.05));
        b.scale.y = Math.max(0.01, (b.userData.h as number) * k);
        (b.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + 0.2 * Math.sin(t * 2 + i * 0.5);
      });
      for (const tube of [fix, flake]) {
        const k = smoothstep(0.25, 1, build);
        tube.geo.setDrawRange(0, Math.floor((tube.total * k) / 3) * 3);
        tube.dots.forEach((d, i) => d.scale.setScalar(k * (WEEKS - 1) >= i ? 1 : 0.001));
        tube.head.position.copy(tube.curve.getPoint(Math.max(0.001, k)));
        tube.head.material.opacity = a * (k > 0 ? 1 : 0);
      }
      kpis.forEach((l, i) => (l.material.opacity = smoothstep(0.4 + i * 0.15, 0.7 + i * 0.15, build) * a));
      weekLabels.forEach((l) => (l.material.opacity = a * 0.9));
      chart.rotation.y = 0.42 + Math.sin(t * 0.25) * 0.06;
    },
  };
}
