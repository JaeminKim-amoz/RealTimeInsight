const assert = require('assert');
const http = require('http');

if (process.env.RUN_OLLAMA_SMOKE !== '1') {
  console.log('Ollama Gemma4 smoke skipped; set RUN_OLLAMA_SMOKE=1 to run.');
  process.exit(0);
}

function postJson(path, payload, timeoutMs = 360000) {
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
    req.on('timeout', () => {
      req.destroy(new Error('Ollama request timed out'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  const started = Date.now();
  const response = await postJson('/api/chat', {
    model: 'gemma4:31b',
    messages: [
      {
        role: 'user',
      content: 'Return exactly: EVT-1 OK',
      },
    ],
    stream: false,
    options: {
      num_predict: 64,
      temperature: 0,
    },
  });

  const content = response.message?.content?.trim() || '';
  assert.strictEqual(content, 'EVT-1 OK');
  assert.ok(response.total_duration > 0, 'Ollama reports total_duration');

  console.log('Ollama Gemma4 smoke passed:', {
    content,
    elapsedMs: Date.now() - started,
    totalDurationNs: response.total_duration,
    thinkingLength: response.message?.thinking?.length || 0,
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
