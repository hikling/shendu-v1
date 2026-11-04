// Verify the deployed image serves actual built JS/CSS, not just a healthy API.
import assert from 'node:assert/strict';

const base = new URL(process.argv[2] || 'http://127.0.0.1:3000');
async function resource(path, mime) {
  const url = new URL(path, base);
  assert.equal(url.origin, base.origin, 'UI assets must be served locally');
  const response = await fetch(url);
  assert.equal(response.status, 200, `${url.pathname} is missing`);
  assert.match(response.headers.get('content-type') || '', mime, `${url.pathname} has the wrong content type`);
  const body = await response.text();
  assert.ok(body.length > 0, `${url.pathname} is empty`);
  return body;
}
const health = await resource('/healthz', /application\/json/);
assert.equal(JSON.parse(health).ok, true);
const html = await resource('/', /text\/html/);
const styles = [...html.matchAll(/<link\b[^>]*href="([^"]+\.css(?:\?[^"]*)?)"/g)].map(match => match[1]);
const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+\.js(?:\?[^"]*)?)"/g)].map(match => match[1]);
assert.ok(styles.some(path => path.startsWith('/ui/')), 'HTML must load the built component styles');
assert.ok(scripts.length, 'HTML must load the app module');
for (const path of styles) await resource(path, /text\/css/);
let bridgeFound = false;
for (const path of scripts) {
  const script = await resource(path, /javascript/);
  for (const match of script.matchAll(/from\s*['"]([^'"]*\/ui\/[^'"]+\.js(?:\?[^'"]*)?)['"]/g)) {
    await resource(new URL(match[1], new URL(path, base)).href, /javascript/);
    bridgeFound = true;
  }
}
assert.ok(bridgeFound, 'App must import the built component runtime');
console.log('Health, HTML, app module and local shadcn JS/CSS passed.');
