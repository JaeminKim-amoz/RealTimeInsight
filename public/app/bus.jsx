// Live telemetry bus — central 30Hz simulated data stream with ring buffers per channel.
// This is the single source of truth for all live data. Panels subscribe and read.

const BUS_HZ = 30;
const BUS_BUFFER_SEC = 60;       // keep last 60s of samples
const BUS_BUFFER_LEN = BUS_HZ * BUS_BUFFER_SEC; // 1800 samples per channel

// Derived aircraft state (attitude, position) — shared across ADI, Map, Trajectory panels
const DERIVED_CHANNELS = [2210, 2211, 2212, 2213, 2214, 2215, 3501, 3502, 3503, 1001, 1002, 1205, 1206, 5001, 5002, 5003, 6101];

class TelemetryBus {
  constructor() {
    this.buffers = {};          // channelId -> Float32Array ring buffer
    this.ts = new Float64Array(BUS_BUFFER_LEN); // shared timebase (t = seconds since mission start)
    this.head = 0;              // next write index
    this.filled = 0;            // how many samples valid
    this.simT = 182.200;        // simulated mission time
    this.running = false;
    this.listeners = new Set(); // notified on each sample pushed
    this.alarms = [];           // queue of alarm events
    this.alarmListeners = new Set();
    this.rate = 1.0;            // playback rate multiplier
    this.mode = 'live';         // 'live' or 'replay'
    this.replayCursor = 182.340;

    // initialize buffers
    DERIVED_CHANNELS.forEach(id => {
      this.buffers[id] = new Float32Array(BUS_BUFFER_LEN);
    });

    this._lastStep = performance.now();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._lastStep = performance.now();
    this._tick();
  }

  stop() { this.running = false; }

  setRate(r) { this.rate = r; }
  setMode(m) { this.mode = m; }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  subscribeAlarms(fn) { this.alarmListeners.add(fn); return () => this.alarmListeners.delete(fn); }

  _tick() {
    if (!this.running) return;
    const now = performance.now();
    const dt = (now - this._lastStep) / 1000;
    const samplesToEmit = Math.floor(dt * BUS_HZ * this.rate);
    if (samplesToEmit > 0) {
      for (let i = 0; i < Math.min(samplesToEmit, 10); i++) {
        this._emitSample();
      }
      this._lastStep = now - ((dt * BUS_HZ * this.rate - samplesToEmit) / (BUS_HZ * this.rate)) * 1000;
      this.listeners.forEach(fn => fn(this));
    }
    requestAnimationFrame(() => this._tick());
  }

  _emitSample() {
    const t = this.simT;
    this.ts[this.head] = t;

    // synthesize each channel as a function of simulated time
    for (const id of DERIVED_CHANNELS) {
      this.buffers[id][this.head] = this._sampleFor(id, t);
    }

    // alarm trigger: hydraulic spike at t ≈ 182.340
    const spikeT = 182.340;
    if (Math.abs(t - spikeT) < 0.033 && this.simT > spikeT - 0.03 && !this._alarmFired) {
      this._alarmFired = true;
      const alarm = {
        t, code: 'HYD.SPIKE', sev: 'warn',
        msg: 'Hydraulic pressure 1 exceeded 230 PSI',
        ch: 1205, ts: Date.now()
      };
      this.alarms.unshift(alarm);
      if (this.alarms.length > 20) this.alarms.length = 20;
      this.alarmListeners.forEach(fn => fn(alarm));
    }

    this.head = (this.head + 1) % BUS_BUFFER_LEN;
    this.filled = Math.min(this.filled + 1, BUS_BUFFER_LEN);
    this.simT += 1 / BUS_HZ;
  }

  _sampleFor(id, t) {
    // Reuse the same synth recipe as gen() but as scalar
    const seed = id * 1.37;
    const r = (() => (Math.random() - 0.5));
    switch (id) {
      // Bus voltage / current
      case 1001: return 28 + Math.sin(t*2.5 + seed)*0.3 + Math.sin(t*0.9)*0.5 + r()*0.15;
      case 1002: return 42 + Math.sin(t*1.6)*6 + Math.cos(t*3.3)*3 + r()*0.8;
      // Hydraulic pressure (with spike at 182.340)
      case 1205: {
        let v = 207 + Math.sin(t*1.2)*2.5 + r()*1.2;
        const sp = t - 182.340;
        if (Math.abs(sp) < 0.15) v += 30 * Math.exp(-Math.pow(sp*6, 2));
        return v;
      }
      case 1206: return 204 + Math.sin(t*1.2 + 0.3)*2 + r()*0.8;
      // IMU / attitude — pitch/roll/yaw
      case 2210: // roll deg
        return Math.sin(t*0.6)*22 + Math.sin(t*1.3)*4;
      case 2211: // pitch deg
        return Math.cos(t*0.4)*8 + Math.sin(t*1.1)*1.5;
      case 2212: { // heading deg
        const h = ((t*12) % 360);
        return h > 180 ? h - 360 : h;
      }
      case 2213: return Math.sin(t*2.2)*0.4 + r()*0.05;  // ax g
      case 2214: return Math.cos(t*2.0)*0.3 + r()*0.05;  // ay g
      case 2215: return 1 + Math.sin(t*1.0)*0.15 + r()*0.04; // az g
      // GPS lat/lon/alt — a sortie track near Korea-ish coords
      case 3501: { // lat deg
        const base = 36.1234;
        return base + Math.sin(t*0.15) * 0.12 + t*0.0003;
      }
      case 3502: { // lon deg
        const base = 127.5432;
        return base + Math.cos(t*0.15) * 0.18 + t*0.00045;
      }
      case 3503: { // alt m
        return 3500 + Math.sin(t*0.2)*800 + t*2;
      }
      // Engine, temps
      case 5001: return 8200 + Math.sin(t*0.8)*120 + r()*18;
      case 5002: return 420 + Math.sin(t*0.7)*25 + r()*3;
      case 5003: return 78 + Math.sin(t*0.5)*4 + r()*0.5;
      case 6101: return -32 + Math.sin(t*0.3)*2 + r()*0.3;
      default: return 0;
    }
  }

  /**
   * Get the last N samples for a channel, oldest→newest, aligned with .ts timebase.
   * Returns { vals: Float32Array, ts: Float64Array, len } — len = min(N, filled).
   */
  snapshot(channelId, N = 600) {
    const buf = this.buffers[channelId];
    if (!buf) return { vals: new Float32Array(0), ts: new Float64Array(0), len: 0 };
    const len = Math.min(N, this.filled);
    const vals = new Float32Array(len);
    const ts = new Float64Array(len);
    // head points at next write; valid samples are [head-len, head) modulo buffer
    const start = (this.head - len + BUS_BUFFER_LEN) % BUS_BUFFER_LEN;
    for (let i = 0; i < len; i++) {
      const src = (start + i) % BUS_BUFFER_LEN;
      vals[i] = buf[src];
      ts[i] = this.ts[src];
    }
    return { vals, ts, len };
  }

  /** Latest value for a channel (scalar) */
  latest(channelId) {
    const buf = this.buffers[channelId];
    if (!buf || this.filled === 0) return null;
    const idx = (this.head - 1 + BUS_BUFFER_LEN) % BUS_BUFFER_LEN;
    return buf[idx];
  }

  get currentTime() { return this.simT; }
}

const BUS = new TelemetryBus();
BUS.start();

// ============ React hook: subscribe to bus on RAF ============
// Returns a rev counter that increments every frame the bus ticks.
// Panels can call useBus() at top and it'll re-render on every new sample batch.
function useBus() {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    let last = 0;
    const unsub = BUS.subscribe(() => {
      const now = performance.now();
      if (now - last > 33) { // throttle to ~30 fps
        last = now;
        setRev(r => r + 1);
      }
    });
    return unsub;
  }, []);
  return rev;
}

function useLiveSnapshot(channelId, N = 600) {
  useBus();
  return BUS.snapshot(channelId, N);
}

function useLiveLatest(channelId) {
  useBus();
  return BUS.latest(channelId);
}

Object.assign(window, { BUS, TelemetryBus, useBus, useLiveSnapshot, useLiveLatest, BUS_HZ });
