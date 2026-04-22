// RealTimeInsight PCM demo decoder.
//
// This module models the first real ingest slice:
// UDP bytes -> bitstream -> sync search -> 640x16b major frame -> CRC gate ->
// mapped channel samples. It is intentionally dependency-free so the current
// HTML prototype and Node tests can share the same decoder contract.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RTIPcm = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const DEFAULT_PROFILE = {
    syncPattern: 0xFE6B2840,
    syncWidthBits: 32,
    syncPlacement: 'trailing',
    frameWords: 640,
    wordBits: 16,
    crcWordIndex: 637,
    syncWordStartIndex: 638,
    frameCounterWords: [0, 1],
    subcommutationMaskBits: 4,
    crcInitial: 0xFFFF,
    crcXorOut: 0x0000,
  };

  function crc16Ccitt(bytes, initial = 0xFFFF, xorOut = 0x0000) {
    let crc = initial & 0xFFFF;
    for (const byte of bytes) {
      crc ^= (byte & 0xFF) << 8;
      for (let i = 0; i < 8; i++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
        crc &= 0xFFFF;
      }
    }
    return (crc ^ xorOut) & 0xFFFF;
  }

  function wordsToBytes(words, startWord = 0, endWordExclusive = words.length) {
    const bytes = new Uint8Array((endWordExclusive - startWord) * 2);
    let j = 0;
    for (let i = startWord; i < endWordExclusive; i++) {
      const w = words[i] & 0xFFFF;
      bytes[j++] = (w >>> 8) & 0xFF;
      bytes[j++] = w & 0xFF;
    }
    return bytes;
  }

  function bitsFromWords(words, wordBits = 16) {
    const bits = [];
    for (const word of words) {
      for (let bit = wordBits - 1; bit >= 0; bit--) {
        bits.push((word >>> bit) & 1);
      }
    }
    return bits;
  }

  function bitsToBytes(bits) {
    const bytes = new Uint8Array(Math.ceil(bits.length / 8));
    for (let i = 0; i < bits.length; i++) {
      bytes[i >> 3] |= (bits[i] & 1) << (7 - (i & 7));
    }
    return bytes;
  }

  function bitsFromBytes(bytes) {
    const bits = [];
    for (const byte of bytes) {
      for (let bit = 7; bit >= 0; bit--) bits.push((byte >>> bit) & 1);
    }
    return bits;
  }

  function readBits(bits, offset, width) {
    let value = 0;
    for (let i = 0; i < width; i++) value = (value << 1) | (bits[offset + i] || 0);
    return value >>> 0;
  }

  function findSyncOffsets(bits, pattern, width) {
    const offsets = [];
    const masked = pattern >>> (32 - Math.min(width, 32));
    for (let i = 0; i <= bits.length - width; i++) {
      if (readBits(bits, i, width) === masked) offsets.push(i);
    }
    return offsets;
  }

  function synthValue(channelId, counter) {
    const t = counter / 30;
    switch (channelId) {
      case 1001: return 28 + Math.sin(t * 0.7) * 0.45;
      case 1002: return 42 + Math.sin(t * 1.3) * 6 + Math.cos(t * 2.1) * 2;
      case 1205: {
        const spike = (counter % 96) - 52;
        return 207 + Math.sin(t) * 3 + 30 * Math.exp(-(spike * spike) / 30);
      }
      case 1206: return 204 + Math.sin(t + 0.4) * 2;
      case 2210: return Math.sin(t * 0.6) * 22;
      case 2211: return Math.cos(t * 0.45) * 8;
      case 2212: return ((counter * 3) % 360) - 180;
      case 5002: return -62 + Math.sin(t * 0.8) * 4;
      case 5003: return 18 + Math.cos(t * 0.6) * 3;
      default: return 0;
    }
  }

  function encodeSigned(value, scale, bits) {
    const max = 1 << (bits - 1);
    let raw = Math.round(value / scale);
    raw = Math.max(-max, Math.min(max - 1, raw));
    return raw < 0 ? ((1 << bits) + raw) & ((1 << bits) - 1) : raw;
  }

  function decodeSigned(raw, bits) {
    const sign = 1 << (bits - 1);
    return (raw & sign) ? raw - (1 << bits) : raw;
  }

  function createFrame(counter, profile = DEFAULT_PROFILE, options = {}) {
    const cfg = { ...DEFAULT_PROFILE, ...profile };
    const words = new Uint16Array(cfg.frameWords);
    words[0] = (counter >>> 16) & 0xFFFF;
    words[1] = counter & 0xFFFF;
    words[2] = ((counter & ((1 << cfg.subcommutationMaskBits) - 1)) << 8) | 0x5A;
    words[4] = Math.round(synthValue(1001, counter) / 0.004882) & 0xFFFF;
    words[5] = Math.round(synthValue(1002, counter) / 0.01) & 0xFFFF;
    words[8] = encodeSigned(synthValue(1205, counter) + 100, 0.25, 16);
    words[9] = encodeSigned(synthValue(1206, counter) + 100, 0.25, 16);
    words[10] = encodeSigned(synthValue(2210, counter), 0.01, 16);
    words[11] = encodeSigned(synthValue(2211, counter), 0.01, 16);
    words[12] = encodeSigned(synthValue(2212, counter), 0.01, 16);
    words[64] = encodeSigned(synthValue(5002, counter), 0.5, 16);
    words[65] = Math.round(synthValue(5003, counter) / 0.1) & 0xFFFF;

    const syncHi = (cfg.syncPattern >>> 16) & 0xFFFF;
    const syncLo = cfg.syncPattern & 0xFFFF;
    words[cfg.syncWordStartIndex] = syncHi;
    words[cfg.syncWordStartIndex + 1] = syncLo;
    words[cfg.crcWordIndex] = crc16Ccitt(wordsToBytes(words, 0, cfg.crcWordIndex), cfg.crcInitial, cfg.crcXorOut);
    if (options.corruptCrc) words[cfg.crcWordIndex] ^= 0x0001;
    return words;
  }

  function frameToBits(words, bitSlip = 0) {
    const bits = [];
    for (let i = 0; i < bitSlip; i++) bits.push(i & 1);
    bits.push(...bitsFromWords(words));
    return bits;
  }

  function decodeFrameWords(words, cfg) {
    const expectedCrc = crc16Ccitt(wordsToBytes(words, 0, cfg.crcWordIndex), cfg.crcInitial, cfg.crcXorOut);
    const storedCrc = words[cfg.crcWordIndex] & 0xFFFF;
    const frameCounter = (((words[0] & 0xFFFF) << 16) | (words[1] & 0xFFFF)) >>> 0;
    const subcommutation = frameCounter & ((1 << cfg.subcommutationMaskBits) - 1);
    const crcOk = expectedCrc === storedCrc;
    const qualityFlags = crcOk ? ['sync-lock', 'crc-ok'] : ['sync-lock', 'crc-fail'];
    return {
      words,
      frameCounter,
      subcommutation,
      crcOk,
      expectedCrc,
      storedCrc,
      qualityFlags,
      samples: crcOk ? extractSamples(words, frameCounter, subcommutation, qualityFlags) : [],
    };
  }

  function extractSamples(words, frameCounter, subcommutation, qualityFlags) {
    const at = (wordIndex) => words[wordIndex] & 0xFFFF;
    const timestamp = 182.2 + frameCounter / 30;
    return [
      { channelId: 8001, value: frameCounter, raw: frameCounter, timestamp, qualityFlags },
      { channelId: 8004, value: subcommutation, raw: subcommutation, timestamp, qualityFlags },
      { channelId: 8005, value: 0, raw: 0, timestamp, qualityFlags },
      { channelId: 8006, value: 1, raw: 1, timestamp, qualityFlags },
      { channelId: 1001, value: at(4) * 0.004882, raw: at(4), timestamp, qualityFlags },
      { channelId: 1002, value: at(5) * 0.01, raw: at(5), timestamp, qualityFlags },
      { channelId: 1205, value: decodeSigned(at(8), 16) * 0.25 - 100, raw: at(8), timestamp, qualityFlags },
      { channelId: 1206, value: decodeSigned(at(9), 16) * 0.25 - 100, raw: at(9), timestamp, qualityFlags },
      { channelId: 2210, value: decodeSigned(at(10), 16) * 0.01, raw: at(10), timestamp, qualityFlags },
      { channelId: 2211, value: decodeSigned(at(11), 16) * 0.01, raw: at(11), timestamp, qualityFlags },
      { channelId: 2212, value: decodeSigned(at(12), 16) * 0.01, raw: at(12), timestamp, qualityFlags },
      { channelId: 5002, value: decodeSigned(at(64), 16) * 0.5, raw: at(64), timestamp, qualityFlags },
      { channelId: 5003, value: at(65) * 0.1, raw: at(65), timestamp, qualityFlags },
    ];
  }

  function decodeBitstream(inputBits, profile = DEFAULT_PROFILE) {
    const cfg = { ...DEFAULT_PROFILE, ...profile };
    const bits = inputBits instanceof Uint8Array ? bitsFromBytes(inputBits) : inputBits;
    const frameBits = cfg.frameWords * cfg.wordBits;
    const syncOffsets = findSyncOffsets(bits, cfg.syncPattern, cfg.syncWidthBits);
    const frames = [];
    const badFrames = [];

    for (const syncOffset of syncOffsets) {
      const start = cfg.syncPlacement === 'trailing'
        ? syncOffset - (cfg.syncWordStartIndex * cfg.wordBits)
        : syncOffset;
      if (start < 0 || start + frameBits > bits.length) continue;
      const words = new Uint16Array(cfg.frameWords);
      for (let w = 0; w < cfg.frameWords; w++) {
        words[w] = readBits(bits, start + w * cfg.wordBits, cfg.wordBits) & 0xFFFF;
      }
      if (words[cfg.syncWordStartIndex] !== ((cfg.syncPattern >>> 16) & 0xFFFF)) continue;
      if (words[cfg.syncWordStartIndex + 1] !== (cfg.syncPattern & 0xFFFF)) continue;
      const decoded = decodeFrameWords(words, cfg);
      decoded.bitOffset = start;
      decoded.syncOffset = syncOffset;
      if (decoded.crcOk) frames.push(decoded);
      else badFrames.push(decoded);
    }

    return {
      frames,
      badFrames,
      stats: {
        syncMatches: syncOffsets.length,
        goodFrames: frames.length,
        badFrames: badFrames.length,
        displaySamples: frames.reduce((n, f) => n + f.samples.length, 0),
      },
    };
  }

  function createDemoStream(options = {}) {
    const cfg = { ...DEFAULT_PROFILE, ...options.profile };
    const slip = options.bitSlip ?? 5;
    const frames = [];
    const frameCount = options.frameCount ?? 256;
    for (let i = 0; i < frameCount; i++) {
      frames.push(createFrame(i, cfg, { corruptCrc: i > 0 && i % 37 === 0 }));
    }
    const bits = [];
    frames.forEach((frame, i) => bits.push(...frameToBits(frame, i === 0 ? slip : 0)));
    const decoded = decodeBitstream(bits, cfg);
    const samplesByCounter = decoded.frames.map((frame) => ({
      frameCounter: frame.frameCounter,
      subcommutation: frame.subcommutation,
      samples: frame.samples,
      qualityFlags: frame.qualityFlags,
    }));
    let cursor = 0;
    return {
      profile: cfg,
      bitSlip: slip,
      decoded,
      nextSample() {
        if (!samplesByCounter.length) return null;
        const sample = samplesByCounter[cursor % samplesByCounter.length];
        cursor += 1;
        return sample;
      },
      status() {
        return {
          locked: decoded.stats.goodFrames > 0,
          syncMatches: decoded.stats.syncMatches,
          goodFrames: decoded.stats.goodFrames,
          badFrames: decoded.stats.badFrames,
          crcFailRate: decoded.stats.badFrames / Math.max(1, decoded.stats.goodFrames + decoded.stats.badFrames),
          bitSlip: slip,
        };
      },
    };
  }

  return {
    DEFAULT_PROFILE,
    crc16Ccitt,
    bitsFromWords,
    bitsToBytes,
    bitsFromBytes,
    findSyncOffsets,
    createFrame,
    frameToBits,
    decodeBitstream,
    createDemoStream,
    decodeSigned,
  };
});
