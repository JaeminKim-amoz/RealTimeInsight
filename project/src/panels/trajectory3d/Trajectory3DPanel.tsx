/**
 * Trajectory3DPanel (US-017e) — 3D track flythrough preview.
 *
 * Visual fidelity 1:1 with public/app/trajectory.jsx Trajectory3DPanel: R3F
 * Canvas inside a `panel-body trajectory3d` container, polyline geometry built
 * from TRACK_POINTS.
 *
 * Pure geometry math is extracted to `geometry.ts`. R3F Canvas is mocked in
 * tests so jsdom doesn't try to spin up WebGL.
 */

import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { TRACK_POINTS } from '../../mock/trackPoints';
import type { PanelInstance } from '../../types/domain';
import { buildTrackGeometry } from './geometry';

interface Trajectory3DPanelProps {
  panel: PanelInstance;
  mode: 'live' | 'replay';
}

export function Trajectory3DPanel({ panel, mode }: Trajectory3DPanelProps) {
  void panel;
  void mode;

  const positions = useMemo(() => buildTrackGeometry(TRACK_POINTS), []);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  return (
    <div className="panel-body trajectory3d" style={{ position: 'relative' }}>
      <Canvas camera={{ position: [0, 14, 30], fov: 45 }}>
        <ambientLight intensity={0.6} color="#3a3026" />
        <directionalLight position={[40, 60, 20]} intensity={0.9} color="#ffd8a0" />
        <gridHelper args={[160, 20, 0x3a2e1a, 0x2a2418]} position={[0, -8, 0]} />
        {/* eslint-disable-next-line react/no-unknown-property */}
        <line>
          <primitive object={geometry} attach="geometry" />
          <lineBasicMaterial color="#f0b44a" />
        </line>
      </Canvas>
      <div className="att-readout traj-readout">
        <div>
          <span className="label">TRACK </span>
          {TRACK_POINTS.length} pts
        </div>
      </div>
    </div>
  );
}
