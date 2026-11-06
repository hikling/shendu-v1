// Read-only browser acceptance against an authenticated synthetic fixture.
const {mkdir,writeFile}=require('node:fs/promises');
const {resolve}=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const baseUrl=process.argv[2]||'http://127.0.0.1:3192',baseline=process.argv.includes('--baseline'),out=__dirname;
const owner={id:'demo-owner',displayName:'慎独示例',username:'demo_owner',createdAt:'2026-10-26',role:'superadmin',status:'active'};
const members=[owner,{...owner,id:'demo-member',displayName:'认真记录的普通成员',username:'member_with_a_long_but_valid_username',role:'member'},{...owner,id:'demo-admin',displayName:'共同管理',username:'team_admin',role:'admin',status:'disabled'}];
async function visit(page,route){
  const labels={settings:'设置',backup:'数据备份',users:'账户管理',actions:'行动验证'};
  const direct=page.locator(`[data-nav="${route}"]`);
  for(const button of await direct.all())if(await button.isVisible()){await button.click();return}
  if(await page.locator('#menu-toggle').isVisible()){
    await page.locator('#menu-toggle').click();await page.getByRole('menuitem',{name:labels[route],exact:true}).click();
  }else{
    await page.locator('.header-account-trigger').click();await page.getByRole('menuitem',{name:labels[route],exact:true}).click();
  }
}
async function ready(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r})))})}
async function inspect(page,selector){return page.locator(selector).evaluate(root=>{
  const box=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom}};
  const measure=selector=>[...root.querySelectorAll(selector)].map(e=>({text:e.textContent?.trim(),font:parseFloat(getComputedStyle(e).fontSize),...box(e)}));
  const firstTextTop=e=>{const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode())if(node.textContent.trim()){const range=document.createRange();range.selectNodeContents(node);return range.getBoundingClientRect().top}return null};
  const textInside=e=>{const b=box(e),walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode())if(node.textContent.trim()){const range=document.createRange();range.selectNodeContents(node);for(const rect of range.getClientRects())if(rect.width&&(rect.x<b.x-1||rect.right>b.right+1))return false}return true};
  return{overflow:document.documentElement.scrollWidth>innerWidth,images:measure('img'),titles:measure('h3,strong'),copy:measure('small,p'),headers:measure('th'),cells:[...root.querySelectorAll('tbody tr')].map(row=>[...row.children].map(e=>({...box(e),firstTextTop:firstTextTop(e),textInside:textInside(e)}))),cards:[...root.querySelectorAll('.settings-menu-item')].map(e=>({box:box(e),art:box(e.querySelector('.workspace-setting-art')),copy:box(e.querySelector('.workspace-setting-copy'))}))};
})}
(async()=>{
 await mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),checks=[],errors=[];
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1100},locale:'zh-CN'}),page=await context.newPage();let role='superadmin',list='single',empty=false;
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text())});
  await page.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    assert.equal(request.method(),'GET','acceptance never mutates data');
    if(path==='/api/admin/users'){await route.fulfill({json:{registrationOpen:false,users:list==='single'?[owner]:members}});return}
    const response=await route.fetch();
    if(path==='/api/me'){const json=await response.json();json.user={...json.user,...owner,role};await route.fulfill({response,json});return}
    if(empty&&path==='/api/records'){const json=await response.json();json.records=[];await route.fulfill({response,json});return}
    if(empty&&path==='/api/stats'){const json=await response.json();for(const key of ['total','pending','weeklyDaily','completed'])if(key in json)json[key]=0;await route.fulfill({response,json});return}
    await route.fulfill({response});
  });
  async function open(route,width){await page.setViewportSize({width,height:1100});await page.goto(baseUrl,{waitUntil:'networkidle'});if(route!=='overview')await visit(page,route);await ready(page)}
  if(!baseline){
    await open('overview',1440);await page.setViewportSize({width:1440,height:1040});await page.mouse.move(0,0);
    await page.waitForFunction(()=>[...document.querySelectorAll('.overview-record-card')].filter(card=>{const b=card.getBoundingClientRect();return b.right>0&&b.left<innerWidth&&b.top<innerHeight}).length>=4);
    await page.screenshot({path:resolve(out,'overview-desktop.png'),fullPage:false,animations:'allow'});
  }
  const widths=baseline?[1280]:[1440,1280,1100,960,821,820,390,320];
  for(const width of widths){
    empty=true;await open('actions',width);await page.locator('.actions-empty').first().waitFor();
    const actions=await inspect(page,'.actions-page');assert.equal(actions.overflow,false);checks.push({route:'actions-empty',width,...actions});
    if([1280,320].includes(width))await page.locator('.actions-section-pending').screenshot({path:resolve(out,`${baseline?'before':'after'}-actions-${width}.png`)});
    empty=false;await open('settings',width);
    const settings=await inspect(page,'.workspace-settings-menu');assert.equal(settings.overflow,false);checks.push({route:'settings',width,...settings});
    const cards=page.locator('.workspace-settings-menu .settings-menu-item');assert.equal(await cards.count(),3);
    if(!baseline)for(const card of settings.cards){
      assert.ok(card.art.x>=card.box.x-1&&card.art.right<=card.box.right+1&&card.art.y>=card.box.y-1&&card.art.bottom<=card.box.bottom+1,'settings art remains inside card');
      assert.ok(card.copy.right<=card.art.x+1||card.art.right<=card.copy.x+1||card.copy.bottom<=card.art.y+1||card.art.bottom<=card.copy.y+1,'settings copy does not overlap art');
    }
    if([1280,320].includes(width))await page.locator('.workspace-settings-menu').screenshot({path:resolve(out,`${baseline?'before':'after'}-settings-${width}.png`)});
    // Real navigation from the enlarged card retains ordinary page semantics.
    await cards.first().click();await page.locator('.workspace-users').waitFor();assert.equal(await page.locator('[role="dialog"]').count(),0);
    for(const scenario of ['single','multiple']){
      list=scenario;await open('users',width);await page.locator('.users-table tbody tr').first().waitFor();
      const users=await inspect(page,'.users-table');assert.equal(users.overflow,false);checks.push({route:'users-'+scenario,width,...users});
      if(!baseline)for(const row of users.cells)for(const cell of row)assert.ok(cell.textInside,`account text stays inside its cell at ${width}px`);
      if(width>820){
        assert.equal(users.headers.length,6);for(const row of users.cells){assert.equal(row.length,6);row.forEach((cell,i)=>{assert.ok(Math.abs(cell.x-users.headers[i].x)<1,'header and cell share column');if(!baseline)assert.ok(Math.abs(cell.firstTextTop-row[0].firstTextTop)<9,'account row first lines align')})}
        if(!baseline)assert.ok(users.headers[5].w/users.headers.reduce((sum,h)=>sum+h.w,0)<.35,'operation column does not reserve excess space');
      }
      if([1280,320].includes(width))await page.locator('.users-card').screenshot({path:resolve(out,`${baseline?'before':'after'}-users-${scenario}-${width}.png`),style:'#site-header,#site-header *{visibility:hidden!important}'});
    }
    await open('backup',width);await page.locator('.workspace-personal-backup').waitFor();
    const backup=await inspect(page,'.workspace-backup');assert.equal(backup.overflow,false);checks.push({route:'backup',width,...backup});
    if(!baseline){
      const info=page.getByRole('heading',{name:'加密方式与账户归属',exact:true});assert.ok(await info.isVisible());
      assert.ok(await page.getByText('整包 PBKDF2-HMAC-SHA-256（600,000 次）与 AES-256-GCM 加密。远端只会收到加密整包。',{exact:true}).isVisible());
      assert.equal(await page.locator('.workspace-personal-backup details').count(),0);
    }
    if([1280,320].includes(width))await page.locator('.workspace-personal-backup').screenshot({path:resolve(out,`${baseline?'before':'after'}-backup-${width}.png`)});
  }
  if(!baseline){
    role='member';await open('users',820);assert.equal(await page.locator('.workspace-members').count(),0);assert.ok(await page.locator('#password-form').isVisible());
    await page.emulateMedia({reducedMotion:'reduce'});await open('settings',390);assert.equal((await inspect(page,'.workspace-settings-menu')).overflow,false);
  }
  assert.deepEqual(errors,[]);
  await writeFile(resolve(out,baseline?'baseline.json':'final-checks.json'),JSON.stringify({browser:browser.version(),checks,errors,passed:true},null,2));
  console.log(JSON.stringify({browser:browser.version(),baseline,checks:checks.length,errors,passed:true}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
