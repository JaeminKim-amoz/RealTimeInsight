const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..');
const doc = fs.readFileSync(path.join(repo, 'runtime', 'performance-smoke.md'), 'utf8');

assert.ok(doc.includes('RUN_PERF_SMOKE=1 cargo test --release --test pcm_throughput_smoke'), 'documents PCM throughput command');
assert.ok(doc.includes('RUN_PERF_SMOKE=1 cargo test --release --test datagram_throughput_smoke'), 'documents datagram throughput command');
assert.ok(doc.includes('RUN_SOAK_SMOKE=1 cargo test --release --test datagram_soak_smoke'), 'documents datagram soak command');
assert.ok(doc.includes('RUN_MULTI_RATE_SOAK=1 cargo test --release --test multi_rate_soak_smoke'), 'documents multi-rate soak command');
assert.ok(doc.includes('30 Mbps'), 'documents 30 Mbps profile');
assert.ok(doc.includes('10/20/30 Mbps'), 'documents multi-rate soak profiles');
assert.ok(doc.includes('accepted 5832 frames'), 'documents 30 Mbps soak accepted frame evidence');
assert.ok(doc.includes('rejected 28 frames'), 'documents 30 Mbps soak rejected frame evidence');
assert.ok(doc.includes('about 385 ms'), 'documents 30 Mbps soak elapsed evidence');
assert.ok(doc.includes('accepted 1932 frames'), 'documents 10 Mbps multi-rate soak evidence');
assert.ok(doc.includes('accepted 3884 frames'), 'documents 20 Mbps multi-rate soak evidence');
assert.ok(doc.includes('accepted 5836 frames'), 'documents 30 Mbps multi-rate soak evidence');
assert.ok(doc.includes('WebGPU/wgpu-first'), 'documents CUDA policy');

console.log('Performance docs tests passed');
