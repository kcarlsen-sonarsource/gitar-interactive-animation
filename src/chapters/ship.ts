import * as THREE from 'three';
import { C } from '../lib/palette';
import { glowSprite } from '../lib/text';
import { fract, glowColor, rng } from '../lib/util';
import type { Chapter, Ctx } from '../lib/types';

const STREAKS = 900;
const CARDS = 150;
const DEPTH = 200;

/** Finale: verified PRs streaming through a portal at full agentic velocity. */
export async function shipChapter(_ctx: Ctx): Promise<Chapter> {
  const group = new THREE.Group();
  const r = rng(91);

  // warp streaks (line segments in a cylinder)
  const pos = new Float32Array(STREAKS * 6);
  const meta = Array.from({ length: STREAKS }, () => {
    const ang = r() * Math.PI * 2;
    const rad = 9 + Math.pow(r(), 0.6) * 26;
    return { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, phase: r(), len: 2 + r() * 6, speed: 0.3 + r() * 0.5 };
  });
  const col = new Float32Array(STREAKS * 6);
  const pal = [new THREE.Color(C.blueBright), new THREE.Color(C.sky), new THREE.Color(C.green), new THREE.Color(C.white)];
  meta.forEach((m, i) => {
    const c = pal[Math.floor(r() * (r() > 0.85 ? 4 : 2))].clone().multiplyScalar(1.6);
    col.set([c.r, c.g, c.b, c.r * 0.1, c.g * 0.1, c.b * 0.1], i * 6);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const streaks = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  group.add(streaks);

  // portal rings far away
  const portal = new THREE.Group();
  portal.position.z = -70;
  [16, 19, 23].forEach((rad, i) => {
    const t = new THREE.Mesh(
      new THREE.TorusGeometry(rad, 0.08 + i * 0.03, 8, 200),
      new THREE.MeshBasicMaterial({ color: glowColor(i === 0 ? C.green : C.blueBright, 2.2), transparent: true, opacity: 0.8 - i * 0.2 }),
    );
    portal.add(t);
  });
  portal.add(glowSprite(C.blue, 80, 0.5));
  group.add(portal);

  // verified PR cards flying out of the portal past the camera
  const cardMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.2, 0.75, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    CARDS,
  );
  const cmeta = Array.from({ length: CARDS }, () => {
    const ang = r() * Math.PI * 2;
    const rad = 13 + r() * 14;
    return { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, phase: r(), speed: 0.12 + r() * 0.12, spin: (r() - 0.5) * 3 };
  });
  const green = new THREE.Color(C.green).multiplyScalar(1.1);
  for (let i = 0; i < CARDS; i++) cardMesh.setColorAt(i, i % 5 === 0 ? new THREE.Color(C.sky).multiplyScalar(1.1) : green);
  group.add(cardMesh);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  return {
    id: 'ship',
    group,
    cam: { pos: new THREE.Vector3(0, 0, 30), look: new THREE.Vector3(0, 0, -40) },
    update({ t, a }) {
      const speed = 0.4 + a * 0.9;
      meta.forEach((m, i) => {
        const z = 30 - fract(t * m.speed * speed * 0.35 + m.phase) * DEPTH;
        const len = m.len * (0.5 + a * 1.8);
        pos.set([m.x, m.y, z + len, m.x, m.y, z], i * 6);
      });
      geo.attributes.position.needsUpdate = true;
      (streaks.material as THREE.LineBasicMaterial).opacity = 0.35 + a * 0.65;
      portal.rotation.z = t * 0.1;
      portal.children.forEach((c, i) => (c.rotation.z = t * (0.1 + i * 0.05) * (i % 2 ? -1 : 1)));
      for (let i = 0; i < CARDS; i++) {
        const c = cmeta[i];
        const u = fract(t * c.speed + c.phase);
        p.set(c.x, c.y, -80 + u * 115);
        e.set(t * c.spin * 0.3, t * c.spin * 0.4, 0);
        q.setFromEuler(e);
        s.setScalar(Math.min(1, u * 6) * a);
        m4.compose(p, q, s);
        cardMesh.setMatrixAt(i, m4);
      }
      cardMesh.instanceMatrix.needsUpdate = true;
    },
  };
}
