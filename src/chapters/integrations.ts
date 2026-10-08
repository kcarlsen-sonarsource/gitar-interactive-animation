import * as THREE from 'three';
import { C, CSS } from '../lib/palette';
import { glowSprite, label } from '../lib/text';
import { fract, glowColor } from '../lib/util';
import { buildWordmark } from './hero';
import type { Chapter, Ctx } from '../lib/types';

const PLATFORMS = [
  { name: 'GitHub', kind: 'code' },
  { name: 'GitLab', kind: 'code' },
  { name: 'Bitbucket', kind: 'code' },
  { name: 'Azure DevOps', kind: 'code' },
  { name: 'CircleCI', kind: 'ci' },
  { name: 'Buildkite', kind: 'ci' },
  { name: 'Bitrise', kind: 'ci' },
  { name: 'Jenkins', kind: 'ci' },
  { name: 'TeamCity', kind: 'ci' },
  { name: 'Harness', kind: 'ci' },
  { name: 'Jira', kind: 'work' },
  { name: 'Linear', kind: 'work' },
  { name: 'Slack', kind: 'work' },
];
const KIND_COLOR: Record<string, { hex: number; css: string }> = {
  code: { hex: C.blueBright, css: CSS.sky },
  ci: { hex: C.green, css: CSS.green },
  work: { hex: C.violet, css: CSS.violet },
};

export async function integrationsChapter(ctx: Ctx): Promise<Chapter> {
  const group = new THREE.Group();

  // core: the wordmark inside a glass shell
  const core = new THREE.Group();
  const wm = buildWordmark(ctx.env, 5.2, 5);
  core.add(wm.root);
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.6, 2),
    new THREE.MeshBasicMaterial({ color: glowColor(C.blueBright, 1.2), wireframe: true, transparent: true, opacity: 0.22 }),
  );
  core.add(shell, glowSprite(C.blue, 18, 0.55));
  const light = new THREE.PointLight(C.sky, 50, 30, 2);
  light.position.set(0, 3, 6);
  core.add(light);
  group.add(core);

  // three tilted orbits, grouped by role
  const orbits = [
    { kind: 'code', radius: 7.5, tilt: new THREE.Euler(0.55, 0.2, 0.55), speed: 0.12 },
    { kind: 'ci', radius: 10.5, tilt: new THREE.Euler(1.08, 0.15, -0.12), speed: -0.07 },
    { kind: 'work', radius: 12.5, tilt: new THREE.Euler(0.35, -0.5, -1.0), speed: 0.05 },
  ];
  const nodes: { sprite: THREE.Sprite; orbit: number; phase: number; color: number; line: THREE.Line; packets: THREE.Mesh[] }[] = [];
  orbits.forEach((o, oi) => {
    const g = new THREE.Group();
    g.rotation.copy(o.tilt);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(o.radius, 0.025, 6, 220),
      new THREE.MeshBasicMaterial({ color: glowColor(KIND_COLOR[o.kind].hex, 1.3), transparent: true, opacity: 0.35 }),
    );
    g.add(ring);
    group.add(g);
    o.tilt = g.rotation;
    const items = PLATFORMS.filter((p) => p.kind === o.kind);
    items.forEach((p, i) => {
      const col = KIND_COLOR[p.kind];
      const sprite = label(p.name, { size: 0.8, color: CSS.white, dot: col.css, border: col.css + '88', font: 30 }) as THREE.Sprite;
      group.add(sprite);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color: glowColor(col.hex, 1.4), transparent: true, opacity: 0.35 }),
      );
      group.add(line);
      const packets = [0, 1].map((k) => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 10, 10),
          new THREE.MeshBasicMaterial({ color: glowColor(k === 0 ? col.hex : C.white, 3.5) }),
        );
        group.add(m);
        return m;
      });
      nodes.push({ sprite, orbit: oi, phase: (i / items.length) * Math.PI * 2 + oi * 0.9, color: col.hex, line, packets });
    });
  });

  const legend = [
    label('code hosts', { size: 0.7, color: CSS.sky, dot: CSS.sky, bg: null, border: null }),
    label('ci systems', { size: 0.7, color: CSS.green, dot: CSS.green, bg: null, border: null }),
    label('work & chat', { size: 0.7, color: CSS.violet, dot: CSS.violet, bg: null, border: null }),
  ];
  legend.forEach((l, i) => {
    l.position.set((i - 1) * 5.2, -11.5, 2);
    group.add(l);
  });

  const v = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  return {
    id: 'integrations',
    group,
    cam: { pos: new THREE.Vector3(0, 3, 37), look: new THREE.Vector3(0, -1, 0) },
    update({ t, a }) {
      core.rotation.y = Math.sin(t * 0.4) * 0.5;
      shell.rotation.set(t * 0.1, t * 0.15, 0);
      nodes.forEach((n, ni) => {
        const o = orbits[n.orbit];
        const ang = n.phase + t * o.speed;
        v.set(Math.cos(ang) * o.radius, Math.sin(ang) * o.radius, 0);
        m4.makeRotationFromEuler(o.tilt);
        v.applyMatrix4(m4);
        n.sprite.position.copy(v);
        n.sprite.material.opacity = a;
        const pos = n.line.geometry.attributes.position as THREE.BufferAttribute;
        pos.setXYZ(0, v.x, v.y, v.z);
        pos.setXYZ(1, 0, 0, 0);
        pos.needsUpdate = true;
        (n.line.material as THREE.LineBasicMaterial).opacity = 0.3 * a;
        // inbound: events & logs; outbound: fixes & status
        const u1 = fract(t * 0.5 + ni * 0.23);
        n.packets[0].position.copy(v).multiplyScalar(1 - u1);
        const u2 = fract(t * 0.35 + ni * 0.41);
        n.packets[1].position.copy(v).multiplyScalar(u2);
        n.packets.forEach((p) => (p.visible = a > 0.05));
      });
      legend.forEach((l) => (l.material.opacity = a));
    },
  };
}
