import * as THREE from 'three';
import { C, CSS } from '../lib/palette';
import { glowSprite, label } from '../lib/text';
import { clamp, easeInOutCubic, fract, glowColor, rng, smoothstep } from '../lib/util';
import type { Chapter, Ctx } from '../lib/types';

const AGENTS = 6;
const CARDS = 1500;

export async function problemChapter(_ctx: Ctx): Promise<Chapter> {
  const group = new THREE.Group();
  const r = rng(11);
  const agentColors = [C.blueBright, C.cyan, C.violet, C.sky, C.blueBright, C.cyan];

  // --- coding agents ---
  const agents: THREE.Group[] = [];
  for (let i = 0; i < AGENTS; i++) {
    const g = new THREE.Group();
    const y = 9 - i * 3.6;
    g.position.set(-13.5 + (i % 2) * 2, y * 0.8, (r() - 0.5) * 5);
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.8, 0),
      new THREE.MeshBasicMaterial({ color: glowColor(agentColors[i], 2.4) }),
    );
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.5, 1),
      new THREE.MeshBasicMaterial({ color: glowColor(agentColors[i], 1.2), wireframe: true, transparent: true, opacity: 0.35 }),
    );
    g.add(core, shell, glowSprite(agentColors[i], 4, 0.4));
    g.userData = { core, shell };
    agents.push(g);
    group.add(g);
  }
  const agentsLabel = label('coding agents', { size: 0.9, color: CSS.sky, dot: CSS.cyan });
  agentsLabel.position.set(-12.5, 10.4, 0);
  group.add(agentsLabel);

  // --- the gate: a narrow slot into "human review" ---
  const GATE_X = 6.5;
  const GAP = 1.1;
  const slabMat = new THREE.MeshStandardMaterial({ color: 0x0d1420, metalness: 0.7, roughness: 0.35 });
  const edgeMat = new THREE.MeshBasicMaterial({ color: glowColor(C.red, 2.2) });
  const gate = new THREE.Group();
  for (const s of [1, -1]) {
    const h = 12;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, 10), slabMat);
    slab.position.set(GATE_X, s * (GAP / 2 + h / 2), 0);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 10.05), edgeMat);
    edge.position.set(GATE_X, s * (GAP / 2), 0);
    gate.add(slab, edge);
  }
  const gateLight = new THREE.PointLight(C.red, 120, 30, 2);
  gateLight.position.set(GATE_X - 3, 0, 4);
  gate.add(gateLight);
  const redGlow = glowSprite(C.red, 16, 0.35);
  redGlow.position.set(GATE_X + 0.5, 0, 0);
  gate.add(redGlow);
  group.add(gate);
  const gateLabel = label('human review queue', { size: 0.85, color: CSS.red, dot: CSS.red, border: 'rgba(255,77,94,0.5)' });
  gateLabel.position.set(GATE_X, 8.4, 5.5);
  group.add(gateLabel);
  const shipLabel = label('shipped', { size: 0.7, color: CSS.green, dot: CSS.green, border: 'rgba(46,229,157,0.45)' });
  shipLabel.position.set(GATE_X + 5.5, 1.6, 0);
  group.add(shipLabel);

  // --- PR cards ---
  const cardGeo = new THREE.BoxGeometry(0.95, 0.6, 0.06);
  const cardMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const cards = new THREE.InstancedMesh(cardGeo, cardMat, CARDS);
  cards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(cards);
  type Card = { agent: number; phase: number; speed: number; slot: THREE.Vector3; passes: boolean; spin: number };
  const meta: Card[] = [];
  for (let i = 0; i < CARDS; i++) {
    // funnel slot: dense near the gate, widening backwards
    const back = Math.pow(r(), 0.75) * 10;
    const x = GATE_X - 1.2 - back;
    const rad = 0.5 + back * 0.5;
    const th = r() * Math.PI * 2;
    const rr = Math.sqrt(r()) * rad;
    meta.push({
      agent: i % AGENTS,
      phase: r(),
      speed: 0.6 + r() * 0.8,
      slot: new THREE.Vector3(x, Math.sin(th) * rr, Math.cos(th) * rr * 0.9),
      passes: i % 37 === 0,
      spin: (r() - 0.5) * 2,
    });
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const col = new THREE.Color();
  const cAgent = new THREE.Color();
  const cAmber = new THREE.Color(C.amber).multiplyScalar(0.55);
  const cRed = new THREE.Color(C.red).multiplyScalar(0.6);
  const cGreen = new THREE.Color(C.green).multiplyScalar(2.4);
  const start = new THREE.Vector3();
  const ctrl = new THREE.Vector3();
  const counterEl = document.getElementById('queue-count');
  let lastCount = -1;

  return {
    id: 'problem',
    group,
    cam: { pos: new THREE.Vector3(-3, 3, 42), look: new THREE.Vector3(-3, 0.5, 0) },
    update({ t, a, since }) {
      const fill = clamp(since * 0.22 + 0.08); // pile grows the longer you watch
      const visible = Math.floor(CARDS * fill);
      agents.forEach((g, i) => {
        const ud = g.userData as { core: THREE.Mesh; shell: THREE.Mesh };
        const pulse = Math.pow(fract(t * 1.6 + i * 0.37), 6);
        ud.core.scale.setScalar(1 + pulse * 0.5);
        ud.shell.rotation.set(t * 0.4 + i, t * 0.6, 0);
      });
      for (let i = 0; i < CARDS; i++) {
        const c = meta[i];
        if (i >= visible) {
          m4.makeScale(0, 0, 0);
          cards.setMatrixAt(i, m4);
          continue;
        }
        const u = fract(t * 0.045 * c.speed + c.phase);
        start.copy(agents[c.agent].position);
        cAgent.set(agentColors[c.agent]).multiplyScalar(0.75);
        let scale = 1;
        if (u < 0.28) {
          // flying from the agent into the funnel
          const k = easeInOutCubic(u / 0.28);
          ctrl.set((start.x + c.slot.x) / 2, start.y + 4, (start.z + c.slot.z) / 2 + 3);
          const k1 = 1 - k;
          p.set(
            k1 * k1 * start.x + 2 * k1 * k * ctrl.x + k * k * c.slot.x,
            k1 * k1 * start.y + 2 * k1 * k * ctrl.y + k * k * c.slot.y,
            k1 * k1 * start.z + 2 * k1 * k * ctrl.z + k * k * c.slot.z,
          );
          scale = smoothstep(0, 0.04, u);
          e.set(t * c.spin * 2, t * c.spin * 3, 0);
          col.copy(cAgent);
        } else if (c.passes && u > 0.62) {
          // the rare PR that makes it through the slot
          const k = (u - 0.62) / 0.38;
          const k2 = easeInOutCubic(clamp(k * 2.2));
          p.set(c.slot.x + (GATE_X + 0.2 - c.slot.x) * k2, c.slot.y * (1 - k2), c.slot.z * (1 - k2));
          if (k > 0.45) p.x = GATE_X + 0.2 + (k - 0.45) * 30;
          e.set(0, 0, 0);
          col.copy(cGreen);
          scale = 1 - smoothstep(0.85, 1, k);
        } else {
          // stuck waiting: jitter, get stale (amber → red)
          const wait = (u - 0.28) / 0.72;
          p.copy(c.slot);
          p.x += Math.sin(t * 3 + i) * 0.04;
          p.y += Math.sin(t * 2.3 + i * 1.3) * 0.05;
          e.set(Math.sin(i) * 0.4, Math.cos(i * 1.7) * 0.6, Math.sin(i * 2.1) * 0.3);
          if (wait < 0.5) col.copy(cAgent).lerp(cAmber, wait * 2);
          else col.copy(cAmber).lerp(cRed, (wait - 0.5) * 2);
          scale = 1 - smoothstep(0.96, 1, wait);
        }
        q.setFromEuler(e);
        s.setScalar(scale * (0.4 + a * 0.6));
        m4.compose(p, q, s);
        cards.setMatrixAt(i, m4);
        cards.setColorAt(i, col);
      }
      cards.instanceMatrix.needsUpdate = true;
      if (cards.instanceColor) cards.instanceColor.needsUpdate = true;
      gateLight.intensity = 80 + 60 * Math.sin(t * 5) * Math.sin(t * 1.3);
      (edgeMat.color as THREE.Color).setHex(C.red).multiplyScalar(1.6 + Math.sin(t * 6) * 0.6);
      if (counterEl && a > 0.2) {
        const n = Math.floor(visible * 0.86);
        if (n !== lastCount) {
          counterEl.textContent = n.toLocaleString('en-US');
          lastCount = n;
        }
      }
    },
  };
}
