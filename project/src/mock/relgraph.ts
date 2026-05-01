/**
 * Mock relation graph fixture ported from public/app/data.jsx RELGRAPH constant.
 *
 * Spec §13.3 (knowledge flow / relation graph). Slice-1 scope: a single
 * canonical anomaly anchor with 10 nodes + 9 edges centered on the hydraulic
 * pressure spike observation.
 */

import type { RelationGraph } from '../types/domain';

export const RELGRAPH: RelationGraph = {
  root: 'obs-1205',
  nodes: [
    { id: 'obs-1205', kind: 'observation', label: 'Hyd Press. Spike', score: 0.93 },
    { id: 'ch-1002', kind: 'channel', label: 'Bus Current', score: 0.86 },
    { id: 'ch-1001', kind: 'channel', label: 'Bus Voltage', score: 0.74 },
    { id: 'ch-1007', kind: 'alarm', label: 'PDU BIT fault', score: 0.72 },
    { id: 'ch-1210', kind: 'channel', label: 'Hyd Bypass Valve', score: 0.58 },
    { id: 'ch-2215', kind: 'channel', label: 'Accel Z', score: 0.41 },
    { id: 'ch-1206', kind: 'channel', label: 'Hyd Press. B', score: 0.38 },
    { id: 'crc-2a', kind: 'crc-cluster', label: 'CRC burst 0x2A', score: 0.35 },
    { id: 'vid-1', kind: 'video-event', label: 'Video discontinuity', score: 0.22 },
    { id: 'rec-1', kind: 'recommendation', label: 'Compare to run 0918', score: 0.30 },
  ],
  edges: [
    { s: 'obs-1205', t: 'ch-1002', kind: 'temporal-lead', w: 0.86, verified: true, why: '120 ms lead' },
    { s: 'ch-1002', t: 'ch-1001', kind: 'formula-dependency', w: 0.74, verified: true, why: 'P = V·I bridge' },
    { s: 'obs-1205', t: 'ch-1007', kind: 'shared-frame', w: 0.72, verified: true, why: 'same frame 0x2A' },
    { s: 'obs-1205', t: 'ch-1210', kind: 'shared-subsystem', w: 0.58, verified: false, why: 'hyd system' },
    { s: 'ch-1210', t: 'ch-1206', kind: 'correlation', w: 0.38, verified: false, why: 'r=0.38' },
    { s: 'obs-1205', t: 'ch-2215', kind: 'correlation', w: 0.41, verified: false, why: 'weak r=0.41' },
    { s: 'obs-1205', t: 'crc-2a', kind: 'shared-frame', w: 0.35, verified: true, why: 'frame 0x2A CRC cluster' },
    { s: 'ch-1001', t: 'vid-1', kind: 'video-alignment', w: 0.22, verified: false, why: 't+1.1s' },
    { s: 'obs-1205', t: 'rec-1', kind: 'operator-bookmark', w: 0.30, verified: true, why: 'prior run' },
  ],
};
