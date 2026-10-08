import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import wordmarkSvg from '../../public/gitar-wordmark.svg?raw';
import { C } from '../lib/palette';
import { glowSprite } from '../lib/text';
import { clamp, easeOutBack, easeOutCubic, glowColor, rng } from '../lib/util';
import type { Chapter, Ctx } from '../lib/types';

/** Build the extruded Gitar wordmark. Returns a group of per-letter meshes, centred, ~`width` wide. */
export function buildWordmark(env: THREE.Texture, width = 18, depth = 5) {
  const data = new SVGLoader().parse(wordmarkSvg);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xb9c6d8,
    metalness: 0.85,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMap: env,
    envMapIntensity: 0.55,
    emissive: new THREE.Color(C.blue),
    emissiveIntensity: 0.06,
  });
  const letters: THREE.Mesh[] = [];
  for (const p of data.paths) {
    const node = p.userData?.node as Element | undefined;
    if (node?.closest('clipPath, defs')) continue;
    const shapes = SVGLoader.createShapes(p);
    if (!shapes.length) continue;
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.6,
      bevelSize: 0.35,
      bevelSegments: 4,
      curveSegments: 18,
    });
    geo.computeBoundingBox();
    const center = new THREE.Vector3();
    geo.boundingBox!.getCenter(center);
    geo.translate(-center.x, -center.y, -center.z);
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(center);
    letters.push(m);
  }
  letters.sort((a, b) => a.position.x - b.position.x);
  const inner = new THREE.Group();
  letters.forEach((l) => inner.add(l));
  const box = new THREE.Box3().setFromObject(inner);
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  letters.forEach((l) => {
    l.position.sub(c);
    l.userData.home = l.position.clone();
  });
  const s = width / size.x;
  const root = new THREE.Group();
  inner.scale.set(s, -s, s); // SVG y is down
  root.add(inner);
  return { root, letters, material: mat };
}

export async function heroChapter(ctx: Ctx): Promise<Chapter> {
  const group = new THREE.Group();
  const wm = buildWordmark(ctx.env, 15, 6);
  const logo = new THREE.Group();
  logo.add(wm.root);
  group.add(logo);

  // lights that sweep across the chrome
  const key = new THREE.PointLight(C.blueBright, 90, 60, 2);
  key.position.set(-8, 6, 10);
  const rim = new THREE.PointLight(C.cyan, 60, 50, 2);
  rim.position.set(10, -4, 6);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(2, 5, 10);
  group.add(key, rim, fill);

  const halo = glowSprite(C.blue, 46, 0.3);
  halo.position.z = -8;
  group.add(halo);

  // Verification rings: each carries "PR" beads around the logo.
  const rings: THREE.Group[] = [];
  const r = rng(3);
  const ringDefs = [
    { radius: 10.5, tilt: [1.25, 0.15], color: C.blueBright, beads: 7 },
    { radius: 12.5, tilt: [1.05, -0.45], color: C.cyan, beads: 5 },
    { radius: 14.5, tilt: [1.45, 0.6], color: C.green, beads: 4 },
  ];
  for (const d of ringDefs) {
    const g = new THREE.Group();
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(d.radius, 0.03, 8, 220),
      new THREE.MeshBasicMaterial({ color: glowColor(d.color, 1.6), transparent: true, opacity: 0.6 }),
    );
    g.add(torus);
    // dashed tick marks
    const ticks = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.05, 0.4, 0.05),
      new THREE.MeshBasicMaterial({ color: glowColor(d.color, 1.2), transparent: true, opacity: 0.5 }),
      90,
    );
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      m4.makeRotationZ(a);
      m4.setPosition(Math.cos(a) * d.radius, Math.sin(a) * d.radius, 0);
      ticks.setMatrixAt(i, m4);
    }
    g.add(ticks);
    const beads: THREE.Mesh[] = [];
    for (let i = 0; i < d.beads; i++) {
      const bead = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 16, 16),
        new THREE.MeshBasicMaterial({ color: glowColor(d.color, 3) }),
      );
      bead.userData.phase = r() * Math.PI * 2;
      bead.userData.speed = 0.15 + r() * 0.25;
      const gl = glowSprite(d.color, 2.4, 0.8);
      bead.add(gl);
      g.add(bead);
      beads.push(bead);
    }
    g.userData = { beads, radius: d.radius, tilt: d.tilt };
    g.rotation.set(d.tilt[0], d.tilt[1], 0);
    rings.push(g);
    group.add(g);
  }

  // A soft orbiting particle cloud ("agentic volume")
  const P = 1600;
  const pos = new Float32Array(P * 3);
  for (let i = 0; i < P; i++) {
    const rad = 10 + r() * 16;
    const th = r() * Math.PI * 2;
    const ph = (r() - 0.5) * 0.9;
    pos[i * 3] = Math.cos(th) * rad;
    pos[i * 3 + 1] = Math.sin(ph) * rad * 0.5;
    pos[i * 3 + 2] = Math.sin(th) * rad;
  }
  const cloudGeo = new THREE.BufferGeometry();
  cloudGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const cloud = new THREE.Points(
    cloudGeo,
    new THREE.PointsMaterial({
      color: C.sky,
      size: 0.09,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(cloud);

  return {
    id: 'hero',
    group,
    cam: { pos: new THREE.Vector3(0, 2, 34), look: new THREE.Vector3(0, 0, 0) },
    update({ t, a, local }) {
      // letters assemble on load with a staggered spring
      wm.letters.forEach((l, i) => {
        const p = easeOutBack(clamp((t - 0.6 - i * 0.12) / 1.3));
        const home = l.userData.home as THREE.Vector3;
        l.position.set(home.x, home.y + (1 - p) * -40, home.z + (1 - p) * 20);
        l.rotation.x = (1 - p) * 2.4;
        l.rotation.y = Math.sin(t * 0.6 + i * 0.7) * 0.06;
      });
      const intro = easeOutCubic(clamp((t - 0.2) / 2.5));
      logo.rotation.y = Math.sin(t * 0.35) * 0.22 + local * 0.9;
      logo.rotation.x = Math.sin(t * 0.27) * 0.06 - local * 0.3;
      logo.position.y = Math.sin(t * 0.8) * 0.3;
      wm.material.emissiveIntensity = 0.05 + 0.04 * Math.sin(t * 2);
      key.position.set(Math.sin(t * 0.7) * 14, 5 + Math.cos(t * 0.5) * 3, 10);
      rim.position.set(Math.cos(t * 0.6) * 14, -4, 6 + Math.sin(t) * 4);
      rings.forEach((g, ri) => {
        const ud = g.userData as { beads: THREE.Mesh[]; radius: number; tilt: number[] };
        g.rotation.z = t * (0.05 + ri * 0.03) * (ri % 2 ? -1 : 1);
        const s = intro * (1 + local * 0.6);
        g.scale.setScalar(Math.max(0.001, s));
        ud.beads.forEach((b) => {
          const ang = b.userData.phase + t * b.userData.speed * 2;
          b.position.set(Math.cos(ang) * ud.radius, Math.sin(ang) * ud.radius, 0);
        });
      });
      cloud.rotation.y = t * 0.03;
      (cloud.material as THREE.PointsMaterial).opacity = 0.7 * intro * a;
      halo.material.opacity = 0.28 * a * intro;
    },
  };
}
