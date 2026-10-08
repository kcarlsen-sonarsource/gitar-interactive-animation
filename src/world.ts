import * as THREE from 'three';
import { C } from './lib/palette';
import { rng } from './lib/util';

/** Persistent environment: infinite grid floor, star dust, and the "main branch" light rail. */
export function createWorld(scene: THREE.Scene, length: number) {
  const group = new THREE.Group();
  scene.add(group);

  // --- Grid floor (shader, fades with distance) ---
  const floorGeo = new THREE.PlaneGeometry(600, length + 600, 1, 1);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uColor: { value: new THREE.Color(C.blue) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uCam; uniform vec3 uColor;
      varying vec3 vW;
      float grid(vec2 p, float s, float w) {
        vec2 g = abs(fract(p / s - 0.5) - 0.5) / fwidth(p / s);
        return 1.0 - min(min(g.x, g.y) / w, 1.0);
      }
      void main() {
        float d = length(vW.xz - uCam.xz);
        float fade = exp(-d * 0.012);
        float g1 = grid(vW.xz, 4.0, 1.0) * 0.35;
        float g2 = grid(vW.xz, 20.0, 1.2) * 0.6;
        // pulse lines travelling along -z (work flowing toward main)
        float pulse = smoothstep(0.92, 1.0, sin(vW.z * 0.08 + uTime * 2.2)) * grid(vW.xz, 20.0, 1.6);
        float a = (g1 + g2 + pulse * 1.5) * fade;
        vec3 col = uColor * (0.6 + pulse * 2.0);
        gl_FragColor = vec4(col, a * 0.55);
      }`,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, -14, -length / 2);
  floor.renderOrder = -10;
  group.add(floor);

  // --- Dust / stars ---
  const N = 5000;
  const r = rng(7);
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (r() - 0.5) * 260;
    pos[i * 3 + 1] = (r() - 0.3) * 140;
    pos[i * 3 + 2] = 80 - r() * (length + 200);
    seed[i] = r();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; uniform float uPx;
      varying float vA; varying float vS;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.2 + aSeed * 40.0) * 0.8;
        p.x += cos(uTime * 0.15 + aSeed * 30.0) * 0.8;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.55 + 0.45 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 90.0);
        vA = tw * smoothstep(260.0, 20.0, -mv.z);
        vS = aSeed;
        gl_PointSize = (1.0 + aSeed * 2.2) * uPx * (60.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA; varying float vS;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 col = mix(vec3(0.49, 0.77, 1.0), vec3(1.0), step(0.85, vS));
        gl_FragColor = vec4(col, a * vA * 0.8);
      }`,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.renderOrder = -8;
  group.add(dust);

  // --- Main branch rail: a glowing line along the whole journey ---
  const railMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec2 vUv;
      void main() { vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uCam; varying vec3 vW; varying vec2 vUv;
      void main() {
        float near = smoothstep(70.0, 18.0, abs(vW.z - uCam.z));
        float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
        float pk = pow(fract(-vW.z * 0.01 - uTime * 0.35), 18.0);
        vec3 col = vec3(0.07, 0.43, 0.83) * (0.5 + pk * 3.0);
        gl_FragColor = vec4(col, pow(edge, 2.0) * 0.6 * near);
      }`,
  });
  const rail = new THREE.Mesh(new THREE.PlaneGeometry(0.7, length + 400, 1, 1), railMat);
  rail.rotation.x = -Math.PI / 2;
  rail.position.set(0, -13.9, -length / 2);
  rail.renderOrder = -9; // always beneath scene content and labels
  group.add(rail);

  return {
    update(t: number, camera: THREE.Camera, px: number) {
      floorMat.uniforms.uTime.value = t;
      floorMat.uniforms.uCam.value.copy(camera.position);
      dustMat.uniforms.uTime.value = t;
      dustMat.uniforms.uPx.value = px;
      railMat.uniforms.uTime.value = t;
      railMat.uniforms.uCam.value.copy(camera.position);
    },
  };
}
