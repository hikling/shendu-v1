import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import {fileURLToPath,URL} from 'node:url';
import {uiLicenses} from './scripts/ui-licenses.mjs';
export default defineConfig({
 publicDir:false,
 define:{'process.env.NODE_ENV':'"production"'},
 plugins:[tailwindcss(),uiLicenses()],
 resolve:{alias:{'@':fileURLToPath(new URL('./ui',import.meta.url))}},
 build:{
  outDir:'public/ui',emptyOutDir:true,minify:true,
  lib:{entry:'ui/entry.jsx',formats:['es'],fileName:()=> 'shadcn.js',cssFileName:'shadcn'},
  target:'es2022',sourcemap:false,
  rolldownOptions:{onLog(level,warning,report){
   // This is a browser-only entry; RSC boundary directives have no runtime role.
   if(warning.code==='MODULE_LEVEL_DIRECTIVE' && warning.message.includes('use client')) return;
   report(level,warning);
  }}
 }
});
