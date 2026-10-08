import * as THREE from 'three';
import { C, CSS } from '../lib/palette';
import { glowSprite, label } from '../lib/text';
import { fract, glowColor, rng } from '../lib/util';
import type { Chapter, Ctx } from '../lib/types';

const R = 7;
const PROBES = 40;

export async function enterpriseChapter(_ctx: Ctx): Promise<Chapter> {
  const group = new THREE.Group();
  const r = rng(81);

  // shield: geodesic wireframe + faint fresnel skin
  const shieldGeo = new THREE.IcosahedronGeometry(R, 3);
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(shieldGeo),
    new THREE.LineBasicMaterial({ color: glowColor(C.blueBright, 1.4), transparent: true, opacity: 0.22 }),
  );
  const skinMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uHits: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, 0, -10)) } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vP; varying vec3 vV;
      void main() {
        vN = normalize(normalMatrix * normal);
        vP = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec4 uHits[6];
      varying vec3 vN; varying vec3 vP; varying vec3 vV;
      void main() {
        float fres = pow(1.0 - abs(dot(vN, vV)), 2.5);
        float hex = 0.0;
        float ripple = 0.0;
        for (int i = 0; i < 6; i++) {
          float age = uTime - uHits[i].w;
          float d = distance(normalize(vP), normalize(uHits[i].xyz));
          ripple += smoothstep(0.08, 0.0, abs(d - age * 1.2)) * exp(-age * 2.5) * step(0.0, age);
          hex += exp(-d * 22.0) * exp(-age * 3.5) * step(0.0, age);
        }
        vec3 col = vec3(0.07, 0.43, 0.83) * fres * 1.4 + vec3(0.5, 0.85, 1.0) * (ripple * 1.0 + hex * 0.45);
        gl_FragColor = vec4(col, clamp(fres * 0.6 + ripple + hex, 0.0, 1.0));
      }`,
  });
  const skin = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 64), skinMat);
  const shield = new THREE.Group();
  shield.add(wire, skin);
  group.add(shield);

  // the customer's code: a stack of glowing slabs inside
  const codeCore = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(2.6 - (i % 3) * 0.4, 0.12, 1.6),
      new THREE.MeshBasicMaterial({ color: glowColor(i % 4 === 0 ? C.green : C.sky, 1.8), transparent: true, opacity: 0.85 }),
    );
    slab.position.set((r() - 0.5) * 0.4, (i - 4) * 0.42, 0);
    codeCore.add(slab);
  }
  codeCore.add(glowSprite(C.sky, 9, 0.5));
  group.add(codeCore);
  const coreTag = label('your source code', { size: 0.55, color: CSS.white, dot: CSS.sky });
  coreTag.position.set(0, 2.9, 0);
  group.add(coreTag);

  // probes from outside that bounce off the shield (no retention, no training)
  const probes = Array.from({ length: PROBES }, () => {
    // approach from the sides (not along the view axis) so every bounce lands on the visible silhouette
    const th = r() * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(th), Math.sin(th) * 0.8, (r() - 0.5) * 0.35).normalize();
    const tangent = new THREE.Vector3(-dir.y, dir.x, 0).normalize().multiplyScalar(r() > 0.5 ? 0.7 : -0.7);
    const out = dir.clone().add(tangent).normalize();
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: glowColor(C.red, 3) }));
    group.add(m);
    return { dir, out, m, phase: r(), speed: 0.25 + r() * 0.2, hitSent: -1 };
  });
  let hitIdx = 0;

  // badges orbiting
  const BADGES = ['SOC 2 Type II', 'ISO 27001', 'GDPR', 'Zero Data Retention'];
  const badges = BADGES.map((b, i) =>
    label(b, { size: 0.66, color: CSS.green, dot: CSS.green, border: CSS.green + '77' }),
  );
  badges.forEach((b) => group.add(b));
  const claim = label('source code not retained  ·  never used for training', { size: 0.6, color: CSS.sky, dot: CSS.sky, border: CSS.sky + '66' });
  claim.position.set(0, -R - 1.5, 0);
  group.add(claim);

  const v = new THREE.Vector3();
  return {
    id: 'enterprise',
    group,
    cam: { pos: new THREE.Vector3(0, 2, 30), look: new THREE.Vector3(0, 0, 0) },
    update({ t, a }) {
      skinMat.uniforms.uTime.value = t;
      wire.rotation.y = t * 0.05;
      skin.rotation.y = t * 0.05;
      (wire.material as THREE.LineBasicMaterial).opacity = 0.22 * a;
      codeCore.rotation.y = t * 0.3;
      codeCore.children.forEach((c, i) => (c.position.x = Math.sin(t * 1.2 + i) * 0.15));
      coreTag.material.opacity = a;

      probes.forEach((p) => {
        const u = fract(t * p.speed + p.phase);
        const cycle = Math.floor(t * p.speed + p.phase);
        // approach from far away, touch the shield at u = 0.5, bounce back out
        // inbound along dir, deflected outward along a glancing reflection
        if (u < 0.5) v.copy(p.dir).multiplyScalar(18 - (u / 0.5) * (18 - R - 0.15));
        else v.copy(p.dir).multiplyScalar(R + 0.15).addScaledVector(p.out, ((u - 0.5) / 0.5) * 10);
        p.m.position.copy(v);
        p.m.scale.setScalar(u < 0.5 ? 1 : 1 - (u - 0.5) * 2);
        p.m.visible = a > 0.05;
        if (u >= 0.5 && p.hitSent !== cycle) {
          p.hitSent = cycle;
          const local = p.dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -skin.rotation.y);
          skinMat.uniforms.uHits.value[hitIdx % 6].set(local.x, local.y, local.z, t);
          hitIdx++;
        }
      });

      badges.forEach((b, i) => {
        const ang = (i / badges.length) * Math.PI * 2 + t * 0.15;
        b.position.set(Math.cos(ang) * (R + 1.4), Math.sin(ang * 2) * 1.0 + (i % 2 ? 2.6 : -2.6), Math.sin(ang) * (R + 2.4));
        b.material.opacity = a;
      });
      claim.material.opacity = a;
    },
  };
}
