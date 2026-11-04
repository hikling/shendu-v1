import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, join, parse} from 'node:path';
import {fileURLToPath} from 'node:url';

const sourceNotice = fileURLToPath(new URL('../ui/components/ui/LICENSE.md', import.meta.url));
// The 2.3.8 npm tarball omits its upstream LICENSE file.
const supplementalNotices = new Map([
  ['react-remove-scroll-bar@2.3.8', fileURLToPath(new URL('../ui/licenses/react-remove-scroll-bar.txt', import.meta.url))],
]);

// Include licenses for packages actually bundled, including transitive Radix utilities.
export function uiLicenses() {
  return {
    name: 'shendu-ui-licenses',
    generateBundle() {
      const packages = new Map();
      for (const id of this.getModuleIds()) {
        if (!id.includes('node_modules') || id.startsWith('\0')) continue;
        let directory = dirname(id.split('?')[0]);
        while (directory !== parse(directory).root) {
          const manifest = join(directory, 'package.json');
          if (existsSync(manifest)) {
            const meta = JSON.parse(readFileSync(manifest, 'utf8'));
            if (meta.name) packages.set(`${meta.name}@${meta.version}`, {directory, meta});
            break;
          }
          directory = dirname(directory);
        }
      }
      const notices = ['shadcn/ui\n' + readFileSync(sourceNotice, 'utf8')];
      const missing = [];
      for (const [name, {directory, meta}] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
        const licenses = readdirSync(directory).filter(file => /^(licen[sc]e(?:[.-]|$)|copying)/i.test(file));
        const text = licenses.map(file => readFileSync(join(directory, file), 'utf8')).join('\n') ||
          (supplementalNotices.has(name) ? readFileSync(supplementalNotices.get(name), 'utf8') : '');
        if (!text) missing.push(name);
        notices.push(`${name} (${meta.license || 'see notice'})\n\n${text}`);
      }
      if (missing.length) this.error(`Missing bundled licenses: ${missing.join(', ')}; review before publishing.`);
      this.emitFile({type: 'asset', fileName: 'licenses.txt', source: notices.join('\n\n' + '='.repeat(72) + '\n\n')});
    },
  };
}
