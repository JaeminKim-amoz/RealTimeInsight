/**
 * Browser-mode telemetry synthesizer. Ports public/app/bus.jsx 30Hz logic
 * (originally from public/app/data.jsx `gen` fn) to typed TS.
 *
 * Used by:
 *  - StripChart / Numeric / Discrete panels in `npm run dev` (browser dev) when
 *    bridge is in fallback mode (Tauri not running).
 *  - Phase-9 panel unit tests as a deterministic-ish data source.
 *
 * NOT used in `npm run tauri:dev` for channel #1001 — that path subscribes to
 * the real Rust UDP loopback feed (US-009..US-011). Per Critic C3, the
 * "Bridge offline" placeholder replaces this synth for #1001 in browser dev
 * to prevent silent fallback drift.
 */

/** Single-sample synthesizer, keyed by channel id and sample index t. */
export function synthesize(channelId: number, t: number): number {
  const seed = channelId * 1.37;
  const noise = () => (Math.random() - 0.5);
  switch (channelId) {
    case 1001: // bus voltage 28V
      return 28 + Math.sin(t * 0.08 + seed) * 0.3 + Math.sin(t * 0.03) * 0.5 + noise() * 0.15;
    case 1002: // bus current
      return 42 + Math.sin(t * 0.05) * 6 + Math.cos(t * 0.11) * 3 + noise() * 0.8;
    case 1205: { // hydraulic pressure A — has transient spike near (t % 220) ≈ 180
      let v = 207 + Math.sin(t * 0.04) * 2.5 + noise() * 1.2;
      if (Math.abs((t % 220) - 180) < 8) {
        v += 28 * Math.exp(-Math.pow((t % 220) - 180, 2) / 15);
      }
      return v;
    }
    case 1206: // hydraulic pressure B
      return 204 + Math.sin(t * 0.04 + 0.3) * 2 + noise() * 0.8;
    case 2210: // roll
      return Math.sin(t * 0.06) * 22 + Math.sin(t * 0.12) * 4;
    case 2211: // pitch
      return Math.cos(t * 0.05) * 8 + Math.sin(t * 0.14) * 2;
    case 2212: // yaw (sawtooth -180..180)
      return ((t * 0.8) % 360) - 180;
    case 2213:
      return Math.sin(t * 0.22) * 0.4 + noise() * 0.05;
    case 2214:
      return Math.cos(t * 0.2) * 0.3 + noise() * 0.05;
    case 2215:
      return 1 + Math.sin(t * 0.1) * 0.15 + noise() * 0.04;
    case 5002:
      return -62 + Math.sin(t * 0.03) * 4 + noise() * 2;
    case 5003:
      return 18 + Math.sin(t * 0.04) * 3 + noise();
    default:
      return Math.sin(t * 0.07 + seed) * 10 + Math.cos(t * 0.03 + seed * 2) * 3 + noise();
  }
}

/** Generates a contiguous series of n samples starting at sample-index t0. */
export function synthSeries(channelId: number, n: number, t0: number): number[] {
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    out[i] = synthesize(channelId, t0 + i);
  }
  return out;
}
