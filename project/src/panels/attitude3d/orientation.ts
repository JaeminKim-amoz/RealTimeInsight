/**
 * Attitude3D pure orientation math (US-017d).
 *
 * The R3F Canvas wrapper is mocked in jsdom; the actual rotation math lives
 * here as pure number-only fns to keep panel coverage ≥85% without launching
 * a real WebGL context.
 *
 * Rotation order matches public/app/trajectory.jsx Attitude3DPanel:
 *   intrinsic yaw (Y, sign flipped) → pitch (Z) → roll (X)
 */

const DEG = Math.PI / 180;

export function degToRad(deg: number): number {
  return deg * DEG;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Build a unit quaternion from roll/pitch/yaw (degrees). Order matches the
 * prototype's rotateY(-yaw) → rotateZ(pitch) → rotateX(roll) sequence.
 */
export function rpyToQuaternion(
  rollDeg: number,
  pitchDeg: number,
  yawDeg: number
): Quat {
  const r = degToRad(rollDeg) * 0.5;
  const p = degToRad(pitchDeg) * 0.5;
  const y = degToRad(-yawDeg) * 0.5;

  const cr = Math.cos(r);
  const sr = Math.sin(r);
  const cp = Math.cos(p);
  const sp = Math.sin(p);
  const cy = Math.cos(y);
  const sy = Math.sin(y);

  // Y (yaw) ∘ Z (pitch) ∘ X (roll) using shorthand multiplication
  const qx = cy * cp * sr + sy * sp * cr;
  const qy = sy * cp * cr - cy * sp * sr;
  const qz = cy * sp * cr + sy * cp * sr;
  const qw = cy * cp * cr - sy * sp * sr;
  return { x: qx, y: qy, z: qz, w: qw };
}

/**
 * Build a 4×4 row-major matrix from rpy (degrees). For zero input, returns
 * identity. Always affine — last row is [0,0,0,1].
 */
export function eulerToMatrix4(
  rollDeg: number,
  pitchDeg: number,
  yawDeg: number
): number[] {
  const r = degToRad(rollDeg);
  const p = degToRad(pitchDeg);
  const y = degToRad(-yawDeg);

  const cr = Math.cos(r);
  const sr = Math.sin(r);
  const cp = Math.cos(p);
  const sp = Math.sin(p);
  const cy = Math.cos(y);
  const sy = Math.sin(y);

  // Combined rotation Y(y) * Z(p) * X(r)
  const m00 = cy * cp;
  const m01 = -cy * sp * cr + sy * sr;
  const m02 = cy * sp * sr + sy * cr;
  const m10 = sp;
  const m11 = cp * cr;
  const m12 = -cp * sr;
  const m20 = -sy * cp;
  const m21 = sy * sp * cr + cy * sr;
  const m22 = -sy * sp * sr + cy * cr;

  return [
    m00, m01, m02, 0,
    m10, m11, m12, 0,
    m20, m21, m22, 0,
    0, 0, 0, 1,
  ];
}

/**
 * Apply rpy to an object's `rotation` field (Three.js Object3D-shaped target).
 * Mirrors prototype behavior:
 *   target.rotation.set(0,0,0); rotateY(-yaw); rotateZ(pitch); rotateX(roll)
 * which we approximate here as a direct assignment to {x:roll, y:-yaw, z:pitch}.
 */
export function applyRpyToObjectRotation(
  target: { rotation: { x: number; y: number; z: number } },
  rollDeg: number,
  pitchDeg: number,
  yawDeg: number
): void {
  target.rotation.x = degToRad(rollDeg);
  target.rotation.y = degToRad(-yawDeg);
  target.rotation.z = degToRad(pitchDeg);
}
