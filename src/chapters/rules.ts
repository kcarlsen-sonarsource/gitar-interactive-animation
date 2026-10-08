import * as THREE from 'three';
import { C, CSS } from '../lib/palette';
import { codePanel, glowSprite, label } from '../lib/text';
import { clamp, fract, glowColor, rng, smoothstep } from '../lib/util';
import type { Chapter, Ctx } from '../lib/types';

const RULES = [
  { file: 'security.md', lines: ['# Block on critical security', 'Never approve or merge while a', 'critical security finding is open.'], color: CSS.red },
  { file: 'fixes.md', lines: ['# What Gitar may fix', 'Lint, formatting, type errors and', 'failing tests: fix and commit.'], color: CSS.green },
  { file: 'escalate.md', lines: ['# Escalate to a human', 'Changes under auth/ or billing/', 'need a code owner. Do not fix.'], color: CSS.amber },
  { file: 'approve.md', lines: ['# Auto-approve', 'Docs-only PRs may be approved', 'once CI is green.'], color: CSS.sky },
  { file: 'brand.md', lines: ['# Brand consistency', 'Ensure consistent brand metadata', 'across all pages and apps.'], color: CSS.violet },
  { file: 'tests.md', lines: ['# Test coverage', 'Every new API endpoint ships', 'with an integration test.'], color: CSS.cyan },
];
const LANE_LEN = 46;
const PRS = 16;

export async function rulesChapter(_ctx: Ctx): Promise<Chapter> {
  const outer = new THREE.Group();
  const group = new THREE.Group();
  group.rotation.y = 0.34; // lane recedes away from the copy
  group.position.x = 2.2;
  outer.add(group);
  const r = rng(61);
  const cards = RULES.map((ru, i) => {
    const p = codePanel(
      [{ text: ru.lines[0], kind: 'title' }, { text: ru.lines[1], kind: 'ctx' }, { text: ru.lines[2], kind: 'ctx' }],
      { title: `.gitar/rules/${ru.file}`, width: 7.4, gutter: false, font: 24, lineH: 44, accent: ru.color },
    );
    const side = i % 2 === 0 ? -1 : 1;
    const z = 2 - Math.floor(i / 2) * 11 - (side > 0 ? 5 : 0);
    p.mesh.position.set(side * 5.6, 1.2 + (i % 3) * 0.3, z);
    p.mesh.rotation.y = -side * 0.55;
    const edge = new THREE.Mesh(
      new THREE.PlaneGeometry(p.width + 0.25, p.height + 0.25),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(ru.color).multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    edge.position.z = -0.02;
    p.mesh.add(edge);
    group.add(p.mesh);
    return { mesh: p.mesh, edge, z, color: ru.color };
  });

  // lane: two glowing guardrails
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, LANE_LEN + 12),
      new THREE.MeshBasicMaterial({ color: glowColor(C.blueBright, 1.3) }),
    );
    rail.position.set(s * 2.6, -2.5, -LANE_LEN / 2 + 8);
    group.add(rail);
    for (let k = 0; k < 14; k++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), new THREE.MeshBasicMaterial({ color: glowColor(C.blue, 1.5) }));
      post.position.set(s * 2.6, -3.1, 12 - k * 4);
      group.add(post);
    }
  }
  const laneFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, LANE_LEN + 12),
    new THREE.MeshBasicMaterial({ color: C.blue, transparent: true, opacity: 0.07, depthWrite: false }),
  );
  laneFloor.rotation.x = -Math.PI / 2;
  laneFloor.position.set(0, -3.6, -LANE_LEN / 2 + 8);
  group.add(laneFloor);

  // merge gate at the end of the lane
  const GATE_Z = -36;
  const gate = new THREE.Group();
  gate.position.z = GATE_Z;
  const frame = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.09, 8, 4, Math.PI * 2), new THREE.MeshBasicMaterial({ color: glowColor(C.green, 2.5) }));
  frame.rotation.z = Math.PI / 4;
  gate.add(frame, glowSprite(C.green, 12, 0.35));
  const gateTag = label('merge gate', { size: 0.7, color: CSS.green, dot: CSS.green, border: 'rgba(46,229,157,0.5)' });
  gateTag.position.y = 4.6;
  gate.add(gateTag);
  group.add(gate);

  // PRs flowing down the lane; ~1 in 4 is blocked by a rule
  const prGeo = new THREE.BoxGeometry(1.1, 0.7, 0.12);
  const prs = Array.from({ length: PRS }, (_, i) => {
    const blocked = i % 4 === 1;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const m = new THREE.Mesh(prGeo, mat);
    group.add(m);
    return { m, mat, phase: i / PRS, blocked, x: (r() - 0.5) * 2.2, y: -1.8 + r() * 1.2 };
  });
  const blockTag = label('blocks merge · critical security finding', { size: 0.5, color: CSS.red, dot: CSS.red, border: 'rgba(255,77,94,0.5)' });
  group.add(blockTag);

  const blue = new THREE.Color(C.sky).multiplyScalar(0.9);
  const green = new THREE.Color(C.green).multiplyScalar(1.5);
  const red = new THREE.Color(C.red).multiplyScalar(1.6);
  return {
    id: 'rules',
    group: outer,
    cam: { pos: new THREE.Vector3(0, 3.2, 21), look: new THREE.Vector3(0, -0.5, -8) },
    update({ t, a }) {
      cards.forEach((c) => ((c.edge.material as THREE.MeshBasicMaterial).opacity *= 0.9));
      let blockShown = 0;
      prs.forEach((p) => {
        const u = fract(t * 0.07 + p.phase);
        const z = 14 - u * (14 - GATE_Z + 4);
        let x = p.x * (1 - smoothstep(GATE_Z + 14, GATE_Z, z));
        let y = p.y + Math.sin(t * 2 + p.phase * 20) * 0.1;
        let scale = smoothstep(0, 0.05, u) * (1 - smoothstep(0.93, 1, u));
        const col = p.mat.color;
        const checked = z < GATE_Z + 10;
        if (p.blocked && z < -16) {
          // the security rule stops it: it halts, turns red and drops out
          const k = clamp((-16 - z) / 10);
          const zz = -16 - Math.min(2, k * 2);
          p.m.position.set(x + Math.sin(t * 40) * 0.05 * (1 - k), y - k * k * 4, zz);
          col.copy(red);
          scale *= 1 - k;
          if (k < 0.8) {
            blockShown = 1 - k;
            blockTag.position.set(x, y + 1.3, zz);
          }
          // the rule card responsible lights up
          (cards[0].edge.material as THREE.MeshBasicMaterial).opacity = Math.max((cards[0].edge.material as THREE.MeshBasicMaterial).opacity, 0.5 * (1 - k));
        } else {
          p.m.position.set(x, y, z);
          col.copy(blue).lerp(green, checked ? smoothstep(GATE_Z + 10, GATE_Z + 4, z) : 0);
        }
        p.m.rotation.set(Math.sin(t + p.phase * 9) * 0.2, Math.sin(t * 0.7 + p.phase * 5) * 0.3, 0);
        p.m.scale.setScalar(Math.max(0.001, scale));
        p.mat.opacity = a;
        // rule cards glow as PRs pass them
        cards.forEach((c) => {
          const d = Math.abs(c.z - p.m.position.z);
          if (d < 1.5) {
            const em = c.edge.material as THREE.MeshBasicMaterial;
            em.opacity = Math.max(em.opacity, 0.35 * (1 - d / 1.5));
          }
        });
      });
      blockTag.material.opacity = blockShown * a;
      blockTag.visible = blockShown > 0.01;
      frame.rotation.z = Math.PI / 4 + Math.sin(t) * 0.05;
      cards.forEach((c, i) => {
        c.mesh.position.y = 1.2 + (i % 3) * 0.3 + Math.sin(t * 0.8 + i) * 0.15;
        (c.mesh.material as THREE.MeshBasicMaterial).opacity = a;
      });
    },
  };
}
