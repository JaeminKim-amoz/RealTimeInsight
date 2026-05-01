/**
 * Attitude3DPanel (US-017d) — 3D oriented box driven by roll/pitch/yaw.
 *
 * Visual fidelity 1:1 with public/app/panels2.jsx Attitude3DPanel: R3F Canvas
 * inside a `panel-body adi` container, oriented mesh + roll/pitch/yaw readouts.
 *
 * Pure rotation math is extracted to `orientation.ts` so the wrapper stays
 * thin. R3F Canvas is mocked in tests so jsdom doesn't try to spin up WebGL.
 */

import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { synthesize } from '../../mock/synthesizer';
import type { PanelInstance } from '../../types/domain';
import { degToRad } from './orientation';

interface Attitude3DPanelProps {
  panel: PanelInstance;
  mode: 'live' | 'replay';
}

export function Attitude3DPanel({ panel, mode }: Attitude3DPanelProps) {
  void panel;
  void mode;

  // Slice 1: read latest synthesized RPY at mount time. Live frame-by-frame
  // updates land in slice 2 alongside the streamStore wiring.
  const t = Math.floor(Date.now() / 1000);
  const roll = synthesize(2210, t);
  const pitch = synthesize(2211, t);
  const yaw = synthesize(2212, t);

  const rotation = useMemo<[number, number, number]>(
    () => [degToRad(roll), degToRad(-yaw), degToRad(pitch)],
    [roll, pitch, yaw]
  );

  return (
    <div className="panel-body adi" style={{ position: 'relative' }}>
      <Canvas camera={{ position: [4.5, 2, 4.5], fov: 35 }}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 6, 3]} intensity={1.1} color="#ffd8a0" />
        <mesh rotation={rotation}>
          <boxGeometry args={[1.8, 0.3, 0.4]} />
          <meshStandardMaterial color="#8a7a5a" metalness={0.4} roughness={0.45} />
        </mesh>
      </Canvas>
      <div className="att-readout">
        <div>
          <span className="label">ROLL </span>
          {roll.toFixed(1)}°
        </div>
        <div>
          <span className="label">PITCH</span> {pitch.toFixed(1)}°
        </div>
        <div>
          <span className="label">YAW  </span>
          {Math.abs(yaw).toFixed(0)}°
        </div>
      </div>
    </div>
  );
}
