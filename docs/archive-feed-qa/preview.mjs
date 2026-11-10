// Read-only visual fixture: renders the production ledger helper and styles.
// Run from the repository root: node docs/archive-feed-qa/preview.mjs
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
const publicRoot=resolve('shendu/public'),source=readFileSync(resolve(publicRoot,'app.js'),'utf8');
const start=source.indexOf('function historyArchiveArt('),end=source.indexOf('\nfunction renderHistory(',start);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const art=new Function('esc',`${source.slice(start,end)}; return historyArchiveArt;`)(esc);
const types={'.css':'text/css','.webp':'image/webp','.png':'image/png','.js':'text/javascript'};
createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){
    const raw=Number(url.searchParams.get('count')??1000),count=Number.isSafeInteger(raw)&&raw>=0?raw:0;
    res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');
    res.end(`<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><title>历史计数隔离验收</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/history-archive.css"><style>body{padding:20px}main{max-width:1352px;margin:auto}form{margin:20px auto;display:flex;gap:10px;flex-wrap:wrap;max-width:700px}input{width:140px}button{padding:8px}</style><body><main><form><label for="count">演示记录数</label><input id="count" name="count" type="number" min="0" value="${count}"><button>查看排版</button></form><section class="history-page"><header class="history-hero"><div class="history-hero-copy"><h1 id="history-title">历史复盘</h1><p class="history-hero-note">把写下的事实，留成往前的线索。</p><div class="history-hero-actions"><button class="history-write">写今天的复盘 ↗</button></div></div>${art(count)}</header></section></main></body></html>`);return;
  }
  const file=resolve(publicRoot,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(publicRoot+sep)||!existsSync(file)){res.statusCode=404;res.end();return}
  res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(readFileSync(file));
}).listen(43162,'127.0.0.1',()=>console.log('Ledger visual fixture: http://127.0.0.1:43162'));
