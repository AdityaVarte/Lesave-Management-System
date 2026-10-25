const http = require('http');

const postJson = (url, body, token) => {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: 'POST',
        headers,
      },
      (res) => {
        let respData = '';
        res.on('data', (chunk) => (respData += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(respData) });
          } catch (_) {
            resolve({ status: res.statusCode, raw: respData });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const runCases = async () => {
  console.log('Logging in as Rohan Sharma...');
  const loginRes = await postJson('http://localhost:5000/api/auth/login', {
    email: 'rohan@company.com',
    password: 'pass123',
  });

  const token = loginRes.body?.token;
  if (!token) {
    console.error('Failed to log in:', loginRes);
    process.exit(1);
  }
  console.log('Login successful.');

  const cases = [
    { id: 19, prompt: 'explain how carry forward usually works' },
    { id: 20, prompt: 'how many days of medical certificate are needed after 3 days' },
    { id: 21, prompt: 'which department had the most approved leaves this year and how many days' },
    { id: 23, prompt: 'I want casual leave on 2026-11-20 for a family function, please apply' },
    { id: 24, prompt: 'compile all my leaves into a portable document' },
  ];

  for (const c of cases) {
    console.log(`\n==================================================`);
    console.log(`CASE ${c.id}: "${c.prompt}"`);
    console.log(`==================================================`);

    try {
      const start = Date.now();
      const res = await postJson('http://localhost:5000/api/chatbot', { message: c.prompt }, token);
      const duration = Date.now() - start;

      console.log(`Status: ${res.status} (${duration}ms)`);
      if (res.body) {
        console.log(`Source: ${res.body.source}`);
        console.log(`Reply:\n${res.body.reply}`);
        if (res.body.pendingAction) console.log(`Pending Action:`, res.body.pendingAction.tool);
        if (res.body.file) console.log(`File:`, res.body.file.name);
      } else {
        console.log(`Raw response:`, res.raw);
      }
    } catch (err) {
      console.error(`Error in Case ${c.id}:`, err.message);
    }

    // Wait 12 seconds to respect Gemini 5 RPM rate limit
    console.log('Waiting 12s before next request...');
    await sleep(12000);
  }
};

runCases().catch(console.error);
