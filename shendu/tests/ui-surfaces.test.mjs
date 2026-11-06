import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

const dom=new JSDOM('<!doctype html><body><button id="origin">打开</button><div id="surface"></div><div id="calendar"></div></body>',{url:'http://localhost'});
const win=dom.window;
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','HTMLButtonElement','HTMLFormElement','Element','Node','NodeFilter','Event','CustomEvent','KeyboardEvent','MouseEvent','MutationObserver','getComputedStyle','FormData'])globalThis[name]=win[name];
Object.defineProperty(globalThis,'navigator',{value:win.navigator,configurable:true});
globalThis.requestAnimationFrame=callback=>setTimeout(callback,0);globalThis.cancelAnimationFrame=clearTimeout;
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
win.HTMLElement.prototype.scrollIntoView=function(){};
const ui=await import('../public/ui/shadcn.js');
const surface=document.getElementById('surface'),calendar=document.getElementById('calendar');
const notifications=document.createElement('div');notifications.id='notifications';document.body.append(notifications);ui.initializeToasts(notifications);
const settle=()=>new Promise(resolve=>setTimeout(resolve,30));

test('real Dialog enhances opaque form fields and disposes nested roots before replacement',async()=>{
  const origin=document.getElementById('origin');origin.focus();let closed=0;
  const options={html:'<div class="modal-head"><h2>测试弹窗</h2><p>说明</p></div><form><label for="answer">回答</label><input id="answer" name="answer" value="原答案"></form>',title:'测试弹窗',description:'说明',returnFocus:origin,onClose:()=>closed++};
  ui.showDialog(surface,options);await settle();
  assert.ok(surface.querySelector('[data-slot="dialog-content"]'));
  const input=surface.querySelector('#answer');assert.ok(input.hasAttribute('data-ui-component'));assert.equal(input.dataset.slot,'input');input.value='已修改';
  assert.equal(new FormData(input.form).get('answer'),'已修改');
  ui.showDialog(surface,{...options,html:'<div class="modal-head"><h2>另一个设置</h2></div><input id="other" value="下一页">'});
  assert.equal(surface.querySelector('#answer'),null);assert.equal(surface.querySelector('#other').value,'下一页');
  ui.dismissDialog(surface);await settle();assert.equal(document.querySelector('[data-slot="dialog-content"]'),null);assert.equal(surface.childElementCount,0);assert.equal(closed,0);
});

test('verification Calendar has six weeks, preserves date-only values and does not select on browse',async()=>{
  const selections=[],months=[];
  ui.showVerificationCalendar(calendar,{value:'2026-11-14',month:'2026-11',minimum:'2026-11-11',locked:false,today:'2026-11-04',onSelect:value=>selections.push(value),onMonthChange:value=>months.push(value)});
  await settle();assert.equal(calendar.querySelectorAll('.rdp-week').length,6);assert.equal(calendar.querySelectorAll('[data-verify-day][tabindex="0"]').length,1);
  assert.equal(calendar.querySelectorAll('button.rdp-day').length,0,'day controls must not inherit the table-cell layout identity');
  assert.equal(calendar.querySelectorAll('button.rdp-day_button').length,30);
  assert.equal(calendar.querySelector('[data-verify-day="2026-11-10"]').disabled,true);
  calendar.querySelector('[data-verify-day="2026-11-14"]').click();await settle();assert.deepEqual(selections,['2026-11-14']);
  calendar.querySelector('[aria-label="下个月"]').click();await settle();assert.equal(months.at(-1),'2026-12');assert.equal(selections.length,1);
  calendar.querySelector('[data-verify-today]').click();await settle();assert.equal(selections.at(-1),'2026-11-11');
  ui.disposeUi(calendar);calendar.replaceChildren();
  ui.showVerificationCalendar(calendar,{value:'2026-10-01',month:'2026-10',minimum:'2026-11-11',locked:true,today:'2026-11-04',onSelect:()=>assert.fail('readonly selection'),onMonthChange:()=>assert.fail('readonly browse')});
  await settle();assert.ok([...calendar.querySelectorAll('[data-verify-day]')].every(button=>button.disabled));
  assert.ok(calendar.querySelector('[data-verify-day="2026-10-01"]').dataset.selectedSingle==='true');
  ui.disposeUi(calendar);calendar.replaceChildren();
});

test('stage Calendar preserves original record identity and only today or recorded days are actionable',async()=>{
  const selected=[],months=[],records=[{id:'original-id',period:'2026-11-02',status:'verified'},{id:'later-duplicate',period:'2026-11-02',status:'draft'},{id:'draft-id',period:'2026-11-01',status:'draft'},{id:'completed-id',period:'2026-11-05',status:'completed'}];
  ui.showStageCalendar(calendar,{month:'2026-11',today:'2026-11-04',records,statusLabels:{verified:'已验证',completed:'已完成',draft:'草稿'},onMonthChange:value=>months.push(value),onSelect:(date,record)=>selected.push({date,id:record?.id})});
  await settle();assert.equal(calendar.querySelectorAll('.rdp-week').length,6);
  assert.ok([...calendar.querySelectorAll('.rdp-week')].every(row=>row.children.length===7));
  assert.equal(calendar.querySelectorAll('.stage-day-lunar').length,30);
  assert.equal(calendar.querySelector('[data-calendar-date="2026-11-07"] .stage-day-lunar').textContent,'立冬');
  assert.equal(calendar.querySelector('[data-calendar-date="2026-11-22"]').dataset.solarTerm,'小雪');
  assert.match(calendar.querySelector('[data-calendar-date="2026-11-07"]').getAttribute('aria-label'),/农历丙午年九月廿九，立冬/);
  assert.equal(calendar.querySelectorAll('[data-outside="true"] button').length,0,'outside-month cells stay empty, not stray dates');
  assert.equal(calendar.querySelectorAll('.rdp-day').length,0,'stage cells do not inherit the shared native-table class');
  assert.equal(calendar.querySelectorAll('.stage-calendar-cell[role="gridcell"]').length,42);
  assert.equal(calendar.querySelectorAll('table,thead,tbody,tr,td,th').length,0,'stage uses explicit semantic div slots throughout');
  assert.equal(calendar.querySelectorAll('[role="columnheader"]').length,7);
  assert.equal(calendar.querySelectorAll('button.rdp-day_button').length,30);
  const stageRoot=calendar.querySelector('.stage-calendar'),legend=stageRoot.querySelector('.stage-calendar-legend'),picker=stageRoot.querySelector('[data-slot="calendar"]');
  assert.equal(stageRoot.firstElementChild.querySelector('.stage-calendar-legend'),legend,'status legend shares the calendar heading rather than a detached lower toolbar');
  assert.equal(stageRoot.firstElementChild.querySelector('#calendar-paper-title').textContent,'每日足迹');
  assert.ok(legend.compareDocumentPosition(picker)&Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(calendar.querySelector('.stage-month-number').textContent,'11月');assert.equal(calendar.querySelector('.stage-calendar-year').textContent,'2026年');
  assert.equal(calendar.querySelector('.stage-month-caption .stage-calendar-year'),null,'year is independent of the centered month caption');
  assert.equal(calendar.querySelector('.stage-month-caption .sr-only').textContent,'2026 年 11 月','caption retains the full date for assistive technology');
  assert.ok(calendar.querySelector('[data-calendar-date="2026-11-01"]').classList.contains('stage-day-draft'));assert.ok(calendar.querySelector('[data-calendar-date="2026-11-05"]').classList.contains('stage-day-completed'));
  assert.equal(calendar.querySelector('[data-calendar-date="2026-11-03"]').disabled,true);
  calendar.querySelector('[data-calendar-date="2026-11-03"]').click();assert.equal(selected.length,0);
  const record=calendar.querySelector('[data-calendar-date="2026-11-02"]');assert.equal(record.dataset.calendarRecord,'original-id');assert.ok(record.textContent.includes('✓'));record.click();await settle();assert.deepEqual(selected,[{date:'2026-11-02',id:'original-id'}]);
  assert.match(record.getAttribute('aria-label'),/2026年11月2日 星期一，已验证/);
  calendar.querySelector('[data-calendar-date="2026-11-04"]').click();await settle();assert.equal(selected.at(-1).date,'2026-11-04');assert.equal(selected.at(-1).id,undefined);
  calendar.querySelector('[aria-label="下个月"]').click();await settle();assert.equal(months.at(-1),'2026-12');assert.equal(selected.length,2);assert.equal(calendar.querySelectorAll('.rdp-week').length,6);assert.equal(calendar.querySelector('.stage-month-number').textContent,'12月');
  calendar.querySelector('.stage-return-month').click();await settle();assert.equal(months.at(-1),'2026-11');assert.equal(selected.length,2);assert.equal(calendar.querySelector('.stage-return-month').disabled,true);assert.equal(calendar.querySelector('[data-calendar-date="2026-11-02"]').dataset.calendarRecord,'original-id');
  ui.disposeUi(calendar);calendar.replaceChildren();
});

test('empty stage months keep one date button per civil day across six-week and year transitions',async()=>{
  const months=[],selections=[];
  ui.showStageCalendar(calendar,{month:'2026-11',today:'2026-11-05',records:[],statusLabels:{verified:'已验证',completed:'已完成',draft:'草稿'},onMonthChange:value=>months.push(value),onSelect:value=>selections.push(value)});
  const inspect=(month,total)=>{
    const rows=[...calendar.querySelectorAll('.rdp-weeks .rdp-week')],cells=rows.flatMap(row=>[...row.children]),buttons=[...calendar.querySelectorAll('[data-calendar-date]')];
    assert.equal(rows.length,6);assert.ok(rows.every(row=>row.children.length===7));
    assert.equal(cells.length,42);assert.equal(buttons.length,total);assert.equal(new Set(buttons.map(button=>button.dataset.calendarDate)).size,total);
    assert.ok(buttons.every(button=>button.dataset.calendarDate.startsWith(month)&&button.classList.contains('rdp-day_button')&&!button.classList.contains('rdp-day')));
    assert.ok(cells.filter(cell=>cell.dataset.hidden==='true').every(cell=>cell.textContent===''&&!cell.querySelector('button')),'all outside-month cells are structurally empty');
    assert.equal(buttons.filter(button=>button.querySelector('.stage-day-number').textContent==='1').length,1,'day one exists only once even without an opaque record background');
    assert.equal(calendar.querySelector('.stage-calendar-year').textContent,`${month.slice(0,4)}年`,'separate year follows year-boundary navigation');
  };
  await settle();inspect('2026-11',30);
  const next=calendar.querySelector('[aria-label="下个月"]');next.focus();
  next.click();await settle();inspect('2026-12',31);assert.equal(document.activeElement,next);
  next.click();await settle();inspect('2027-01',31);assert.equal(document.activeElement,next);
  calendar.querySelector('[aria-label="上个月"]').click();await settle();inspect('2026-12',31);
  calendar.querySelector('.stage-return-month').click();await settle();inspect('2026-11',30);
  assert.deepEqual(months,['2026-12','2027-01','2026-12','2026-11']);assert.deepEqual(selections,[]);
});

test('stage cells explicitly retain their civil weekday column for all month starts and leap-year transitions',async()=>{
  const cases=[['2026-06',30,1],['2026-09',30,2],['2026-04',30,3],['2026-01',31,4],['2026-05',31,5],['2026-08',31,6],['2026-11',30,7],['2026-12',31,2],['2027-01',31,5],['2027-02',28,1],['2028-02',29,2]];
  for(const [month,total,firstColumn] of cases){
    ui.showStageCalendar(calendar,{month,today:'2026-11-05',records:[],statusLabels:{verified:'已验证',completed:'已完成',draft:'草稿'},onMonthChange:()=>{},onSelect:()=>assert.fail('layout does not select dates')});
    await settle();
    const grid=calendar.querySelector('[role="grid"]'),groups=[...grid.children],rows=[...grid.querySelectorAll('.rdp-week')],cells=rows.flatMap(row=>[...row.children]),buttons=[...grid.querySelectorAll('[data-calendar-date]')];
    assert.equal(grid.tagName,'DIV');assert.equal(grid.getAttribute('aria-colcount'),'7');assert.equal(grid.getAttribute('aria-label'),`${month.slice(0,4)}年${Number(month.slice(5))}月`);
    assert.equal(groups.length,2);assert.ok(groups.every(group=>group.getAttribute('role')==='rowgroup'));
    assert.equal(grid.querySelectorAll('[role="columnheader"]').length,7);assert.equal(rows.length,6);assert.equal(cells.length,42);assert.equal(buttons.length,total);
    assert.ok(rows.every(row=>row.getAttribute('role')==='row'&&row.children.length===7));
    assert.ok(cells.every(cell=>cell.tagName==='DIV'&&cell.getAttribute('role')==='gridcell'&&cell.classList.contains('stage-calendar-cell')));
    assert.equal(grid.querySelectorAll('table,thead,tbody,tr,td,th,[scope],[modifiers],[week]').length,0,'private slot props never leak invalid table/business attributes');
    buttons.forEach((button,index)=>{
      assert.equal(button.dataset.calendarDate,`${month}-${String(index+1).padStart(2,'0')}`);
      assert.equal(button.parentElement.style.gridColumnStart,String((firstColumn+index-1)%7+1),`${button.dataset.calendarDate} occupies its actual weekday independently of empty cells`);
      assert.equal(button.parentElement.getAttribute('aria-colindex'),String((firstColumn+index-1)%7+1),`${button.dataset.calendarDate} exposes its real weekday column even with leading hidden cells`);
    });
    assert.ok(cells.filter(cell=>cell.dataset.hidden==='true').every(cell=>cell.textContent===''&&!cell.querySelector('button')),'outside-month cells reserve semantics without content');
    ui.disposeUi(calendar);calendar.replaceChildren();
  }
});

test('controlled calendar month browsing preserves navigation nodes and keyboard focus',async()=>{
  for(const type of ['stage','verification']){
    const months=[],selections=[];
    if(type==='stage')ui.showStageCalendar(calendar,{month:'2026-11',today:'2026-11-04',records:[],statusLabels:{verified:'已验证',completed:'已完成',draft:'草稿'},onMonthChange:value=>months.push(value),onSelect:value=>selections.push(value)});
    else ui.showVerificationCalendar(calendar,{value:'2026-11-14',month:'2026-11',minimum:'2026-11-11',locked:false,today:'2026-11-04',onMonthChange:value=>months.push(value),onSelect:value=>selections.push(value)});
    await settle();
    const root=calendar.querySelector('[data-slot="calendar"]'),next=calendar.querySelector('[aria-label="下个月"]'),previous=calendar.querySelector('[aria-label="上个月"]');
    next.focus();next.click();await settle();
    assert.equal(months.at(-1),'2026-12',`${type} advances one month`);
    assert.ok(calendar.querySelector('[data-slot="calendar"]')===root,`${type} keeps the DayPicker root`);
    assert.ok(calendar.querySelector('[aria-label="下个月"]')===next,`${type} keeps its next button`);
    assert.ok(calendar.querySelector('[aria-label="上个月"]')===previous,`${type} keeps its previous button`);
    assert.ok(document.activeElement===next,`${type} retains focus on the activated button`);
    next.click();await settle();assert.equal(months.at(-1),'2027-01');assert.equal(document.activeElement,next);
    previous.focus();previous.click();await settle();assert.equal(months.at(-1),'2026-12');assert.equal(document.activeElement,previous);
    assert.deepEqual(selections,[],`${type} month browsing never selects a date`);
    ui.disposeUi(calendar);calendar.replaceChildren();
  }
});

test('DropdownMenu keyboard opening and item selection have one interaction owner',async()=>{
  let selected=0;
  ui.showMenu(surface,{trigger:{html:'账户菜单',className:'header-account-trigger',props:{type:'button','aria-label':'账户菜单'}},label:'我的空间',items:[{html:'设置',onSelect:()=>{selected++;assert.equal(document.activeElement.getAttribute('aria-label'),'账户菜单')}}]});
  const trigger=surface.querySelector('[data-slot="dropdown-menu-trigger"]');
  trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));await settle();
  const menu=document.querySelector('[role="menu"]');assert.ok(menu);assert.equal(trigger.getAttribute('aria-expanded'),'true');
  menu.querySelector('[role="menuitem"]').click();await settle();assert.equal(selected,1);assert.equal(document.querySelector('[role="menu"]'),null);
});

test('persistent and busy Dialog refuses Escape dismissal until the business guard permits it',async()=>{
  let allowed=false,closed=0;
  ui.showDialog(surface,{html:'<div class="modal-head"><h2>保存中</h2></div><input id="focus-target">',title:'保存中',canClose:()=>allowed,onClose:()=>closed++});await settle();
  surface.querySelector('#focus-target').focus();
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();assert.equal(closed,0);assert.ok(surface.querySelector('[role="dialog"]'));
  allowed=true;document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();assert.equal(closed,1);
});

test('fresh nested dialog visit avoids the parent hideOthers snapshot and restores parent access',async()=>{
  let child=document.createElement('div');child.id='nested-modal-root';document.body.append(child);
  ui.showDialog(surface,{html:'<div class="modal-head"><h2>父弹窗</h2></div><button id="open-child">编辑阶段</button>',title:'父弹窗'});await settle();
  assert.equal(child.getAttribute('aria-hidden'),'true');assert.equal(document.getElementById('origin').getAttribute('aria-hidden'),'true');
  const parent=surface.querySelector('[role="dialog"]'),trigger=surface.querySelector('#open-child');
  for(let visit=0;visit<2;visit++){
    trigger.focus();const old=child;child=ui.prepareDialogContainer(child);assert.notEqual(child,old);
    ui.showDialog(child,{html:'<div class="modal-head"><h2>阶段设置</h2></div><input name="stage">',title:'阶段设置',canClose:()=>visit===0});await settle();
    assert.equal(child.querySelector('[role="dialog"]').closest('[aria-hidden="true"]'),null);assert.ok(parent.closest('[aria-hidden="true"]'));
    ui.showToast(notifications,'弹窗内的首次通知','info');await settle();assert.equal(notifications.querySelector('[data-sonner-toaster]').closest('[aria-hidden="true"]'),null);
    ui.dismissDialog(child);await settle();assert.equal(parent.closest('[aria-hidden="true"]'),null);trigger.focus();assert.equal(document.activeElement,trigger);
  }
  child.remove();
});

test.afterEach(()=>{ui.dismissDialog(surface);ui.disposeUi(calendar);calendar.replaceChildren()});

test.after(()=>{ui.dismissDialog(surface);ui.disposeUi(calendar);ui.disposeUi(notifications);dom.window.close()});
