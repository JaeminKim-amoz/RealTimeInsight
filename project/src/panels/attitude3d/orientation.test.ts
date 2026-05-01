/**
 * Pure-math tests for Attitude3D orientation helpers (US-017d).
 *
 * Three.js scene wrapper is mocked in jsdom; the actual rotation math lives
 * here as pure number-only fns to keep panel coverage ≥80% without launching
 * a real WebGL context.
 */

import { describe, it, expect } from 'vitest';
import {
  rpyToQuaternion,
  eulerToMatrix4,
  degToRad,
  applyRpyToObjectRotation,
} from './orientation';

describe('panels/attitude3d/orientation degToRad', () => {
  it('converts 0° to 0', () => {
    expect(degToRad(0)).toBe(0);
  });
  it('converts 180° to π', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 5);
  });
  it('converts -90° to -π/2', () => {
    expect(degToRad(-90)).toBeCloseTo(-Math.PI / 2, 5);
  });
});

describe('panels/attitude3d/orientation rpyToQuaternion', () => {
  it('zero rpy returns identity quaternion (0,0,0,1)', () => {
    const q = rpyToQuaternion(0, 0, 0);
    expect(q.x).toBeCloseTo(0, 6);
    expect(q.y).toBeCloseTo(0, 6);
    expect(q.z).toBeCloseTo(0, 6);
    expect(q.w).toBeCloseTo(1, 6);
  });

  it('produces a unit quaternion for arbitrary inputs', () => {
    const q = rpyToQuaternion(15, 30, 45);
    const mag = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
    expect(mag).toBeCloseTo(1, 5);
  });

  it('roll-only rotation about X axis', () => {
    const q = rpyToQuaternion(90, 0, 0);
    expect(Math.abs(q.x)).toBeCloseTo(Math.SQRT1_2, 5);
    expect(q.y).toBeCloseTo(0, 5);
    expect(q.z).toBeCloseTo(0, 5);
  });

  it('yaw-only rotation about Y axis', () => {
    const q = rpyToQuaternion(0, 0, 90);
    expect(q.x).toBeCloseTo(0, 5);
    expect(Math.abs(q.y)).toBeCloseTo(Math.SQRT1_2, 5);
    expect(q.z).toBeCloseTo(0, 5);
  });
});

describe('panels/attitude3d/orientation eulerToMatrix4', () => {
  it('zero rpy returns identity row-major matrix', () => {
    const m = eulerToMatrix4(0, 0, 0);
    expect(m).toHaveLength(16);
    // Identity has 1s at positions 0, 5, 10, 15
    expect(m[0]).toBeCloseTo(1, 6);
    expect(m[5]).toBeCloseTo(1, 6);
    expect(m[10]).toBeCloseTo(1, 6);
    expect(m[15]).toBeCloseTo(1, 6);
    // Off-diagonal = 0
    expect(m[1]).toBeCloseTo(0, 6);
    expect(m[2]).toBeCloseTo(0, 6);
    expect(m[4]).toBeCloseTo(0, 6);
  });

  it('returns a 4x4 (length-16) matrix for non-trivial input', () => {
    const m = eulerToMatrix4(10, 20, 30);
    expect(m).toHaveLength(16);
  });

  it('last row remains [0, 0, 0, 1] (affine)', () => {
    const m = eulerToMatrix4(45, -22, 17);
    expect(m[12]).toBeCloseTo(0, 6);
    expect(m[13]).toBeCloseTo(0, 6);
    expect(m[14]).toBeCloseTo(0, 6);
    expect(m[15]).toBeCloseTo(1, 6);
  });
});

describe('panels/attitude3d/orientation applyRpyToObjectRotation', () => {
  it('writes rotation values onto the target object in radians', () => {
    const target = { rotation: { x: 0, y: 0, z: 0 } };
    applyRpyToObjectRotation(target, 90, 0, 0);
    expect(target.rotation.x).toBeCloseTo(Math.PI / 2, 5);
    expect(target.rotation.y).toBeCloseTo(0, 5);
    expect(target.rotation.z).toBeCloseTo(0, 5);
  });

  it('writes pitch onto z-axis (matches prototype rotation order)', () => {
    const target = { rotation: { x: 0, y: 0, z: 0 } };
    applyRpyToObjectRotation(target, 0, 30, 0);
    expect(target.rotation.z).toBeCloseTo(Math.PI / 6, 5);
  });

  it('writes yaw onto y-axis (matches prototype rotation order)', () => {
    const target = { rotation: { x: 0, y: 0, z: 0 } };
    applyRpyToObjectRotation(target, 0, 0, -45);
    // Yaw is applied as -yaw in prototype (rotateY(-yaw))
    expect(target.rotation.y).toBeCloseTo(Math.PI / 4, 5);
  });
});
