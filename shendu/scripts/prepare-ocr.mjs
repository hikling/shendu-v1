// Copy pinned npm assets locally; no model downloads or external calls at runtime.
import {mkdir,copyFile,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'public','ocr');
await mkdir(join(out,'core'),{recursive:true});await mkdir(join(out,'lang'),{recursive:true});
const files=[
  ['tesseract.js/dist/tesseract.esm.min.js','tesseract.esm.min.js'],
  ['tesseract.js/dist/worker.min.js','worker.min.js'],
  ['tesseract.js/dist/worker.min.js.LICENSE.txt','worker.min.js.LICENSE.txt'],
  ['tesseract.js/dist/tesseract.min.js.LICENSE.txt','tesseract.min.js.LICENSE.txt'],
  ['@tesseract.js-data/chi_sim/package.json','lang/package-chi_sim.json'],
  ['@tesseract.js-data/eng/package.json','lang/package-eng.json'],
  ['tesseract.js/LICENSE.md','LICENSE-tesseract.txt'],
  ['tesseract.js-core/LICENSE','LICENSE-core.txt'],
  ['@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata.gz','lang/chi_sim.traineddata.gz'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz','lang/eng.traineddata.gz']
];
for(const name of await readdir(join(root,'node_modules','tesseract.js-core')))if(/\.wasm(?:\.js)?$/.test(name))files.push(['tesseract.js-core/'+name,'core/'+name]);
const manifest={engine:'tesseract.js@7.0.0',core:'tesseract.js-core@7.0.0',languages:'@tesseract.js-data/{chi_sim,eng}@1.0.0 (4.0.0_best_int)',files:[]};
for(const [source,target]of files){const path=join(out,target);await mkdir(dirname(path),{recursive:true});await copyFile(join(root,'node_modules',source),path);const bytes=await readFile(path);manifest.files.push({path:target,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})}
await writeFile(join(out,'NOTICE.txt'),'Local screenshot OCR: Tesseract.js 7.0.0 and Tesseract.js-core 7.0.0, Apache-2.0 (licenses included). Language packages @tesseract.js-data/chi_sim and eng 1.0.0 declare MIT in their included package metadata; the upstream trained-data repository https://github.com/naptha/tessdata carries Apache-2.0 (https://github.com/naptha/tessdata/blob/gh-pages/LICENSE; full Apache-2.0 terms are included in LICENSE-core.txt). Distributed trained-data files are unmodified. Bundled worker dependency notices are included in worker.min.js.LICENSE.txt and tesseract.min.js.LICENSE.txt. All workers, cores and trained data are served from this same site; screenshots are processed on the user device.\n');
await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Prepared ${files.length} local OCR assets.`);
