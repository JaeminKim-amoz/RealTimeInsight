#!/usr/bin/env node
const http = require('http');

const enabled = process.env.RUN_OLLAMA_SMOKE === '1';
if (!enabled) {
  console.log('Ollama evidence smoke skipped; set RUN_OLLAMA_SMOKE=1 to run.');
  process.exit(0);
}

function postJson(path, payload, timeoutMs = 240000) {
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: 11434,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }
        resolve(JSON.parse(data));
      });
    });
    req.on('timeout', () => req.destroy(new Error('Ollama request timed out')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const prompt = [
    'Do not think step by step.',
    'Return only this exact sentence:',
    'EVT-1 and CH-1002 show the hydraulic pressure spike followed a bus current transient.',
    '',
    'The sentence must include EVT-1 and CH-1002 exactly.',
    'Evidence:',
    '- EVT-1: Hydraulic pressure spike = +28 bar',
    '- CH-1002: Bus current transient = 120 ms lead',
  ].join('\n');
  const started = Date.now();
  const response = await postJson('/api/chat', {
    model: 'gemma4:31b',
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    options: { num_predict: 384, temperature: 0 },
  });
  const answer = response.message?.content?.trim() || '';
  const required = ['EVT-1', 'CH-1002'];
  const missing = required.filter((citation) => !answer.includes(citation));
  if (missing.length) {
    throw new Error(`Ollama answer missing citations ${missing.join(', ')}: ${answer}`);
  }
  console.log('Ollama evidence smoke passed:', {
    elapsedMs: Date.now() - started,
    totalDurationNs: response.total_duration,
    answer,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
