/**
 * A short fingerprint of everything that shapes the demo database: the migrations and the seed scripts.
 * The demo server rebuilds the demo when this changes, so a deploy with new seeds shows up straight away.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function demoFingerprint() {
  const files = [
    ...fs.readdirSync(path.join(__dirname, 'migrations')).filter((f) => f.endsWith('.sql')).map((f) => `migrations/${f}`),
    ...fs.readdirSync(__dirname).filter((f) => /^seed_.*\.js$/.test(f) || f === 'demo_reset.js')
  ].sort();
  const hash = crypto.createHash('sha1');
  for (const f of files) {
    hash.update(f);
    hash.update(fs.readFileSync(path.join(__dirname, f)));
  }
  return hash.digest('hex').slice(0, 16);
};
