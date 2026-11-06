/**
 * npm test         → reset demo data, API suite, reset again
 * npm run test:all → the same plus the browser suite
 * The server must already be running (npm start). Works on macOS, Windows and Linux.
 */
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const base = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5001}`;
const node = (file) => spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit', env: { ...process.env, TEST_BASE_URL: base } }).status;

(async () => {
  try {
    const res = await fetch(`${base}/api/health`);
    if (!res.ok) throw new Error(`health check returned ${res.status}`);
  } catch (e) {
    console.error(`Server not reachable at ${base} (${e.message}). Start it with "npm start" or set TEST_BASE_URL.`);
    process.exit(2);
  }
  const suites = ['api.test.js', ...(process.argv.includes('--ui') ? ['ui.test.js'] : [])];
  let failed = 0;
  if (node('reset-demo.js') !== 0) process.exit(2);
  for (const suite of suites) {
    console.log(`\n=== ${suite} ===`);
    if (node(suite) !== 0) failed++;
  }
  node('reset-demo.js');
  process.exit(failed ? 1 : 0);
})();
