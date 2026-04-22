const assert = require('assert');
const pcm = require('../../app/pcm.js');

function concatBits(parts) {
  const out = [];
  for (const part of parts) out.push(...part);
  return out;
}

const profile = {
  syncPattern: 0xFE6B2840,
  syncPlacement: 'trailing',
  frameWords: 640,
  wordBits: 16,
  crcWordIndex: 637,
  syncWordStartIndex: 638,
  subcommutationMaskBits: 4,
};

const good0 = pcm.createFrame(0x12340, profile);
const good1 = pcm.createFrame(0x12341, profile);
const bad2 = pcm.createFrame(0x12342, profile, { corruptCrc: true });
const bits = concatBits([
  pcm.frameToBits(good0, 5),
  pcm.frameToBits(good1, 0),
  pcm.frameToBits(bad2, 0),
]);

const decoded = pcm.decodeBitstream(bits, profile);

assert.strictEqual(decoded.stats.syncMatches, 3, 'finds all trailing sync patterns');
assert.strictEqual(decoded.stats.goodFrames, 2, 'keeps only CRC-valid frames for display');
assert.strictEqual(decoded.stats.badFrames, 1, 'retains CRC failures in diagnostics');
assert.strictEqual(decoded.frames[0].bitOffset, 5, 'recovers non-byte-aligned bit slip');
assert.strictEqual(decoded.frames[0].frameCounter, 0x12340, 'reconstructs 32-bit frame counter');
assert.strictEqual(decoded.frames[1].subcommutation, 0x1, 'uses low counter bits for subcommutation');

const hyd = decoded.frames[0].samples.find((s) => s.channelId === 1205);
assert.ok(hyd, 'extracts hydraulic channel sample');
assert.ok(hyd.qualityFlags.includes('crc-ok'), 'display samples carry quality flags');

const demo = pcm.createDemoStream({ bitSlip: 7, frameCount: 40, profile });
const status = demo.status();
assert.ok(status.locked, 'demo stream reports sync lock');
assert.ok(status.goodFrames > 0, 'demo stream has displayable frames');
assert.strictEqual(status.bitSlip, 7, 'demo stream reports configured bit slip');

console.log('PCM decoder tests passed:', {
  syncMatches: decoded.stats.syncMatches,
  goodFrames: decoded.stats.goodFrames,
  badFrames: decoded.stats.badFrames,
  firstBitOffset: decoded.frames[0].bitOffset,
  firstCounter: decoded.frames[0].frameCounter,
});
