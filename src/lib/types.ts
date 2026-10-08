import type * as THREE from 'three';

export interface Ctx {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  env: THREE.Texture;
}

export interface FrameState {
  /** Seconds since start. */
  t: number;
  dt: number;
  /** 0..1 presence: 1 when the camera sits on this chapter. */
  a: number;
  /** Signed distance (in chapters) from the camera to this chapter. */
  local: number;
  /** Time (s) since this chapter last became the focused one. */
  since: number;
}

export interface Chapter {
  id: string;
  group: THREE.Group;
  /** Camera keyframe, relative to group origin. */
  cam: { pos: THREE.Vector3; look: THREE.Vector3 };
  update(f: FrameState): void;
}

export const SPACING = 140;
