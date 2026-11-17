import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installCalendarTimezoneSpoof} from './helpers/calendar-timezone.cjs';
import {verificationMinimum} from '../public/verification-policy.js';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const dom=new JSDOM('<!doctype html><body><button id="origin">打开</button><div id="surface"></div><div id="calendar"></div></body>',{url:'http://localhost'});
const win=dom.window;
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','HTMLButtonElement','HTMLFormElement','Element','DocumentFragment','Node','NodeFilter','Event','CustomEvent','KeyboardEvent','MouseEvent','MutationObserver','getComputedStyle','FormData'])globalThis[name]=win[name];
Object.defineProperty(globalThis,'navigator',{value:win.navigator,configurable:true});
globalThis.requestAnimationFrame=callback=>setTimeout(callback,0);globalThis.cancelAnimationFrame=clearTimeout;
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
win.HTMLElement.prototype.scrollIntoView=function(){};
const ui=await import('../public/ui/shadcn.js');
const surface=document.getElementById('surface'),calendar=document.getElementById('calendar');
const notifications=document.createElement('div');notifications.id='notifications';document.body.append(notifications);ui.initializeToasts(notifications);
const settle=()=>new Promise(resolve=>setTimeout(resolve,30));

test('finance month menu browses without committing, keeps controls mounted and commits once per real change',async()=>{
  const changes=[];let alive=true;
  const control=ui.showFinanceMonthPicker(calendar,{value:'2026-11',today:'2026-11-16',isCurrent:()=>alive,onChange:month=>changes.push(month)});
  const trigger=calendar.querySelector('[aria-haspopup="menu"]'),next=calendar.querySelector('[aria-label="下个月"]');
  trigger.focus();trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));await settle();
  assert.ok(document.querySelector('.finance-period-menu'));assert.deepEqual(changes,[]);
  document.querySelector('[aria-label="下一年"]').click();await settle();assert.deepEqual(changes,[]);assert.ok(document.querySelector('[aria-label="2027年2月"]'));assert.equal(calendar.querySelector('[aria-haspopup="menu"]'),trigger);
  document.querySelector('[aria-label="2027年2月"]').click();await settle();assert.deepEqual(changes,['2027-02']);assert.equal(document.querySelector('.finance-period-menu'),null);assert.equal(document.activeElement,trigger);
  next.click();await settle();assert.deepEqual(changes,['2027-02','2027-03']);assert.equal(calendar.querySelector('[aria-label="下个月"]'),next);
  control.setValue('2026-12');assert.deepEqual(changes,['2027-02','2027-03']);next.click();await settle();assert.equal(changes.at(-1),'2027-01');
  control.setDisabled(true);next.click();assert.equal(changes.length,3);control.setDisabled(false);alive=false;next.click();trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));await settle();assert.equal(changes.length,3);assert.equal(document.querySelector('.finance-period-menu'),null);
  control.dispose();assert.equal(calendar.children.length,0);
});

test('finance month menu closes without selecting and prevents unsupported year boundaries',async()=>{
  const changes=[],control=ui.showFinanceMonthPicker(calendar,{value:'2026-11',today:'2026-11-16',onChange:value=>changes.push(value)});
  const trigger=calendar.querySelector('[aria-haspopup="menu"]'),previous=calendar.querySelector('[aria-label="上个月"]'),next=calendar.querySelector('[aria-label="下个月"]');
  const open=async()=>{trigger.focus();trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));await settle()};
  await open();document.querySelector('[aria-label="2026年11月"]').click();await settle();
  assert.deepEqual(changes,[]);assert.equal(document.querySelector('.finance-period-menu'),null);assert.equal(document.activeElement,trigger);
  await open();document.querySelector('[aria-label="上一年"]').click();await settle();
  document.querySelector('.finance-period-menu').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();
  assert.deepEqual(changes,[]);assert.equal(document.querySelector('.finance-period-menu'),null);assert.equal(document.activeElement,trigger);
  control.setValue('0001-01');assert.equal(previous.disabled,true);previous.click();assert.deepEqual(changes,[]);
  await open();assert.equal(document.querySelector('[aria-label="上一年"]').getAttribute('aria-disabled'),'true');
  control.setDisabled(true);await settle();assert.equal(document.querySelector('.finance-period-menu'),null);control.setDisabled(false);
  control.setValue('9999-12');assert.equal(next.disabled,true);next.click();assert.deepEqual(changes,[]);
  control.setValue('0000-01');assert.ok(trigger.textContent.replace(/\s/g,'').includes('9999年12月'));
  await open();document.querySelector('.finance-period-today').click();await settle();assert.deepEqual(changes,['2026-11']);
  control.dispose();
});

test('finance daily Calendar selects only the requested month and keeps dismissal, stale and disabled paths read-only',async()=>{
  let alive=true;const changes=[],control=ui.showFinanceDayPicker(calendar,{month:'2028-02',value:'2028-02-28',today:'2028-02-16',isCurrent:()=>alive,onChange:value=>changes.push(value)});
  const trigger=calendar.querySelector('button'),open=async()=>{trigger.click();await settle()};
  await open();const popup=document.querySelector('.finance-day-menu');assert.ok(popup.querySelector('[data-slot="calendar"]'));assert.deepEqual(changes,[]);
  assert.equal(popup.querySelectorAll('[data-slot="calendar"] button[data-day]').length,29);
  popup.querySelector('button[aria-label="2028-02-29"]').click();await settle();assert.deepEqual(changes,['2028-02-29']);assert.equal(document.activeElement,trigger);assert.equal(document.querySelector('.finance-day-menu'),null);
  control.setMonth('2026-11');control.setValue('2026-11-15');assert.deepEqual(changes,['2028-02-29']);assert.match(trigger.textContent,/11月15日/);
  control.setValue('2026-12-15');assert.match(trigger.textContent,/11月15日/);
  await open();document.querySelector('.finance-day-menu').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();assert.deepEqual(changes,['2028-02-29']);assert.equal(document.activeElement,trigger);
  control.setDisabled(true);await open();assert.equal(document.querySelector('.finance-day-menu'),null);control.setDisabled(false);
  alive=false;await open();assert.equal(document.querySelector('.finance-day-menu'),null);control.dispose();assert.equal(calendar.children.length,0);
});

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

test('stage calendar survives inconsistent timezone getters and setters through autumn and year boundaries',async()=>{
  const originalZone=process.env.TZ;process.env.TZ='Asia/Shanghai';
  try{for(const mode of ['partial-setters','local-getters']){
    const restore=installCalendarTimezoneSpoof({mode,targetZone:'America/New_York'}),months=[],selections=[];
    try{
      const record={id:'autumn-original',period:'2025-11-02',status:'verified'};
      ui.showStageCalendar(calendar,{month:'2025-09',today:'2025-11-06',records:[record],statusLabels:{verified:'已验证'},onMonthChange:value=>months.push(value),onSelect:(date,record)=>selections.push({date,id:record?.id})});
      await settle();
      const root=calendar.querySelector('[data-slot="calendar"]'),next=calendar.querySelector('[aria-label="下个月"]');
      for(let index=0;index<29;index++){
        const y=2025+Math.floor((8+index)/12),m=(8+index)%12+1,month=`${y}-${String(m).padStart(2,'0')}`;
        const total=new Date(Date.UTC(y,m,0)).getUTCDate(),rows=[...calendar.querySelectorAll('.rdp-week')],buttons=[...calendar.querySelectorAll('[data-calendar-date]')];
        assert.equal(rows.length,6,`${mode} ${month}: exactly six weeks`);
        assert.ok(rows.every(row=>row.children.length===7),`${mode} ${month}: no duplicate/retained cells`);
        assert.equal(buttons.length,total,`${mode} ${month}: one button per civil day`);
        buttons.forEach((button,day)=>{
          assert.equal(button.dataset.calendarDate,`${month}-${String(day+1).padStart(2,'0')}`);
          assert.equal(button.querySelector('.stage-day-number').textContent,String(day+1));
          assert.ok(button.querySelector('.stage-day-lunar').textContent);
          const column=(new Date(Date.UTC(y,m-1,day+1)).getUTCDay()+6)%7+1;
          assert.equal(button.parentElement.style.gridColumnStart,String(column));
          assert.equal(rows.indexOf(button.closest('.rdp-week')),Math.floor(((new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7+day)/7));
        });
        if(month==='2025-11'){
          const button=calendar.querySelector('[data-calendar-date="2025-11-02"]');
          assert.equal(button.dataset.calendarRecord,record.id);assert.match(button.getAttribute('aria-label'),/星期日，已验证/);
          button.click();await settle();assert.deepEqual(selections,[{date:record.period,id:record.id}]);
        }
        next.focus();next.click();await settle();
        assert.equal(document.activeElement,next);assert.equal(calendar.querySelector('[data-slot="calendar"]'),root);
        assert.ok(buttons.every(button=>!button.isConnected),'old dates are removed on month change');
      }
      assert.equal(months.length,29);assert.equal(selections.length,1,'browsing never selects');
      calendar.querySelector('.stage-return-month').click();await settle();
      assert.equal(months.at(-1),'2025-11');assert.equal(calendar.querySelector('[data-calendar-date="2025-11-02"]').dataset.calendarRecord,record.id);
    }finally{ui.disposeUi(calendar);calendar.replaceChildren();restore()}
  }}finally{if(originalZone===undefined)delete process.env.TZ;else process.env.TZ=originalZone}
});

test('verification calendar retains civil dates under inconsistent timezone APIs',async()=>{
  const originalZone=process.env.TZ;process.env.TZ='Asia/Shanghai';
  try{for(const mode of ['partial-setters','local-getters','offset-only']){
    const restore=installCalendarTimezoneSpoof({mode,targetZone:'America/New_York'}),months=[],selections=[];
    try{
      ui.showVerificationCalendar(calendar,{value:'',month:'2025-09',minimum:'2025-09-10',today:'2025-09-10',locked:false,onMonthChange:value=>months.push(value),onSelect:value=>selections.push(value)});
      await settle();
      const root=calendar.querySelector('[data-slot="calendar"]'),next=calendar.querySelector('[aria-label="下个月"]'),previous=calendar.querySelector('[aria-label="上个月"]');
      assert.equal(calendar.querySelector('.rdp-month_grid').tagName,'TABLE','verification retains its ordinary DayPicker table');
      for(let index=0;index<30;index++){
        const y=2025+Math.floor((8+index)/12),m=(8+index)%12+1,month=`${y}-${String(m).padStart(2,'0')}`;
        const total=new Date(Date.UTC(y,m,0)).getUTCDate(),first=(new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7;
        const rows=[...calendar.querySelectorAll('.rdp-week')],buttons=[...calendar.querySelectorAll('[data-verify-day]')];
        assert.deepEqual([...calendar.querySelectorAll('.rdp-weekday')].map(day=>day.textContent),[...'一二三四五六日'],`${mode} ${month}: civil weekday labels`);
        assert.equal(rows.length,6,`${mode} ${month}: exactly six weeks`);
        assert.ok(rows.every(row=>row.children.length===7),`${mode} ${month}: exactly seven dates per week`);
        assert.equal(buttons.length,total,`${mode} ${month}: one button per real day`);
        assert.equal(calendar.querySelectorAll('[data-outside="true"] button').length,0,'outside cells stay empty');
        buttons.forEach((button,day)=>{
          const value=`${month}-${String(day+1).padStart(2,'0')}`;
          assert.equal(button.dataset.verifyDay,value);assert.equal(button.dataset.day,value,'day identity ignores spoofed Intl defaults');
          assert.equal(button.textContent,String(day+1));
          assert.equal([...button.parentElement.parentElement.children].indexOf(button.parentElement),(first+day)%7,`${value}: actual weekday cell`);
          assert.equal(rows.indexOf(button.closest('.rdp-week')),Math.floor((first+day)/7),`${value}: actual week`);
        });
        if(month==='2025-09'){
          assert.equal(buttons[8].disabled,true);buttons[8].click();await settle();assert.deepEqual(selections,[]);
          assert.equal(calendar.querySelector('[data-selected-single="true"]'),null,'empty value stays empty until selection');
        }
        if(month==='2025-11'){
          const button=calendar.querySelector('[data-verify-day="2025-11-02"]');button.click();await settle();
          assert.deepEqual(selections,['2025-11-02']);assert.equal(button.dataset.selectedSingle,'true');
          assert.match(button.getAttribute('aria-label'),/星期日，已选择/);
        }
        next.focus();next.click();await settle();
        assert.equal(document.activeElement,next);assert.equal(calendar.querySelector('[data-slot="calendar"]'),root);
        assert.equal(calendar.querySelector('[aria-label="上个月"]'),previous);
        assert.ok(buttons.every(button=>!button.isConnected),'old month dates are removed');
      }
      assert.equal(months.length,30);assert.deepEqual(selections,['2025-11-02'],'month browsing never selects');
      calendar.querySelector('[data-verify-today]').click();await settle();
      assert.equal(months.at(-1),'2025-09');assert.deepEqual(selections,['2025-11-02','2025-09-10']);
      assert.equal(calendar.querySelector('[data-verify-day="2025-09-10"]').dataset.selectedSingle,'true');
    }finally{ui.disposeUi(calendar);calendar.replaceChildren();restore()}
  }}finally{if(originalZone===undefined)delete process.env.TZ;else process.env.TZ=originalZone}
});

test('verification civil dates preserve six category minima, busy guards and locked leap-day history',async()=>{
  const originalZone=process.env.TZ;process.env.TZ='Asia/Shanghai';
  try{for(const mode of ['partial-setters','local-getters']){
    const restore=installCalendarTimezoneSpoof({mode,targetZone:'America/New_York'});
    try{
      for(const type of ['daily','weekly','monthly','quarterly','yearly','decision']){
        const today='2026-11-06',minimum=verificationMinimum(type,today),selections=[],months=[];let available=false;
        ui.showVerificationCalendar(calendar,{value:'',month:minimum.slice(0,7),minimum,today,locked:false,canSelect:()=>available,onMonthChange:value=>months.push(value),onSelect:value=>selections.push(value)});
        await settle();
        assert.equal(calendar.querySelector('[data-selected-single="true"]'),null,`${type}: empty value is not selected`);
        const days=[...calendar.querySelectorAll('[data-verify-day]')],earliest=calendar.querySelector(`[data-verify-day="${minimum}"]`);
        assert.ok(earliest);assert.equal(earliest.disabled,false);
        assert.ok(days.every(day=>day.disabled===(day.dataset.verifyDay<minimum)),`${type}: exact minimum boundary`);
        assert.deepEqual(days.filter(day=>day.closest('[data-today="true"]')).map(day=>day.dataset.verifyDay),today.slice(0,7)===minimum.slice(0,7)?[today]:[],`${type}: business today is distinct from minimum`);
        earliest.click();calendar.querySelector('[data-verify-today]').click();await settle();assert.deepEqual(selections,[],`${type}: busy owner refuses selection`);
        available=true;calendar.querySelector('[data-verify-today]').click();await settle();assert.deepEqual(selections,[minimum],`${type}: minimum jump retains canonical value`);
        assert.equal(calendar.querySelector(`[data-verify-day="${minimum}"]`).dataset.selectedSingle,'true');
        ui.disposeUi(calendar);calendar.replaceChildren();
      }
      ui.showVerificationCalendar(calendar,{value:'2024-02-29',month:'2024-02',minimum:'2026-11-06',today:'2026-11-06',locked:true,onMonthChange:()=>assert.fail('locked history cannot browse'),onSelect:()=>assert.fail('locked history cannot change date')});
      await settle();
      const days=[...calendar.querySelectorAll('[data-verify-day]')];assert.equal(days.length,29);
      assert.ok(days.every(day=>day.disabled));
      assert.equal(calendar.querySelector('[data-verify-day="2024-02-29"]').dataset.selectedSingle,'true','past locked leap-day selection remains visible');
      assert.equal(calendar.querySelector('[data-verify-today]').disabled,true);
      for(const button of calendar.querySelectorAll('[aria-label="上个月"],[aria-label="下个月"],[data-verify-day]'))button.click();
      await settle();assert.equal(calendar.querySelector('[role="grid"]').getAttribute('aria-label'),'2024年2月');
    }finally{ui.disposeUi(calendar);calendar.replaceChildren();restore()}
  }}finally{if(originalZone===undefined)delete process.env.TZ;else process.env.TZ=originalZone}
});

test('DropdownMenu keyboard opening and item selection have one interaction owner',async()=>{
  let selected=0;
  ui.showMenu(surface,{trigger:{html:'账户菜单',className:'header-account-trigger',props:{type:'button','aria-label':'账户菜单'}},label:'我的空间',items:[{html:'设置',onSelect:()=>{selected++;assert.equal(document.activeElement.getAttribute('aria-label'),'账户菜单')}}]});
  const trigger=surface.querySelector('[data-slot="dropdown-menu-trigger"]');
  trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));await settle();
  const menu=document.querySelector('[role="menu"]');assert.ok(menu);assert.equal(trigger.getAttribute('aria-expanded'),'true');
  menu.querySelector('[role="menuitem"]').click();await settle();assert.equal(selected,1);assert.equal(document.querySelector('[role="menu"]'),null);
});

test('mobile menu supports click-only activation and each touch or mouse tap toggles once',async()=>{
  let selected=0;
  ui.showMenu(surface,{clickActivation:true,trigger:{html:'<span>菜单</span>',className:'header-mobile-trigger',props:{type:'button','aria-label':'手机菜单'}},items:[{html:'历史复盘',onSelect:()=>selected++}]});
  const trigger=surface.querySelector('[data-slot="dropdown-menu-trigger"]'),icon=trigger.querySelector('span');
  const pointer=(target,type,pointerType)=>{const event=new MouseEvent(type,{button:0,ctrlKey:false,bubbles:true,cancelable:true});Object.defineProperty(event,'pointerType',{value:pointerType});target.dispatchEvent(event);return event};
  const isOpen=value=>{assert.equal(trigger.getAttribute('aria-expanded'),String(value));assert.equal(document.querySelectorAll('[role="menu"]').length,value?1:0)};
  trigger.click();await settle();isOpen(true);trigger.click();await settle();isOpen(false);
  for(const pointerType of ['touch','mouse']){
    pointer(icon,'pointerdown',pointerType);await settle();isOpen(false);
    pointer(icon,'pointerup',pointerType);icon.click();await settle();isOpen(true);
    pointer(icon,'pointerdown',pointerType);await settle();isOpen(true);
    pointer(icon,'pointerup',pointerType);icon.click();await settle();isOpen(false);
  }
  pointer(icon,'pointerdown','touch');pointer(icon,'pointercancel','touch');await settle();isOpen(false);
  trigger.click();await settle();isOpen(true);
  const outside=document.getElementById('origin');pointer(outside,'pointerdown','touch');outside.click();await settle();isOpen(false);
  trigger.click();await settle();document.querySelector('[role="menuitem"]').click();await settle();isOpen(false);assert.equal(selected,1);assert.equal(document.activeElement,trigger);
});

test('mobile menu retains Radix keyboard activation and desktop pointer activation stays unchanged',async()=>{
  for(const key of ['Enter',' ','ArrowDown']){
    ui.showMenu(surface,{clickActivation:true,trigger:{html:'菜单',props:{type:'button'}},items:[{html:'历史复盘',onSelect:()=>{}}]});
    const trigger=surface.querySelector('[data-slot="dropdown-menu-trigger"]');trigger.focus();
    const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});trigger.dispatchEvent(event);
    assert.equal(event.defaultPrevented,true,'Radix prevents the native keyboard-generated click');
    await settle();assert.equal(trigger.getAttribute('aria-expanded'),'true');assert.equal(document.querySelectorAll('[role="menu"]').length,1);
    document.querySelector('[role="menu"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();
    assert.equal(trigger.getAttribute('aria-expanded'),'false');assert.equal(document.activeElement,trigger);ui.disposeUi(surface);
  }
  ui.showMenu(surface,{trigger:{html:'账户菜单',props:{type:'button'}},items:[{html:'设置',onSelect:()=>{}}]});
  const trigger=surface.querySelector('[data-slot="dropdown-menu-trigger"]');
  trigger.dispatchEvent(new MouseEvent('pointerdown',{button:0,ctrlKey:false,bubbles:true,cancelable:true}));await settle();
  assert.equal(trigger.getAttribute('aria-expanded'),'true');trigger.click();await settle();assert.equal(trigger.getAttribute('aria-expanded'),'true');
});

test('real mobile header binding retains single guarded navigation and safely rebinds after rendering',async()=>{
  const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),state={dirty:false,saving:false,reauthOpen:false},routes=[],notices=[];
  const modal=document.createElement('div');modal.id='modal-root';document.body.append(modal);
  const header=`<div class="header-account-menu" data-ui-native><button data-menu-trigger aria-label="账户菜单">账户</button><div id="account-menu"><button class="account-fixture-item" data-nav="settings">设置</button></div></div><button id="menu-toggle" class="header-mobile-trigger" data-ui-native><span></span><span></span><span></span></button><nav id="mobile-nav" data-ui-native><button class="header-link active" data-nav="history" aria-current="page">历史复盘</button><button data-nav="settings">设置</button></nav>`;
  const context={document,state,showMenu:ui.showMenu,disposeUi:ui.disposeUi,$:(selector,root=document)=>root?.querySelector(selector),$$:(selector,root=document)=>[...root.querySelectorAll(selector)],navigate:route=>routes.push(route),openSettings:()=>assert.fail('settings should use its normal route'),toast:message=>notices.push(message),openModal:html=>{modal.innerHTML=html},closeModal:()=>modal.replaceChildren()};
  const bind=runInNewContext(source.slice(source.indexOf('function attemptNavigate('),source.indexOf('function bindCalendar('))+source.slice(source.indexOf('let headerMenuControls=[];'),source.indexOf('function bindCommon('))+';bindHeaderMenus',context);
  try{
    for(let visit=0;visit<2;visit++){
      ui.renderMarkup(surface,header);bind();const trigger=surface.querySelector('#menu-toggle');assert.ok(trigger.hasAttribute('data-slot'));
      const choose=async()=>{trigger.click();await settle();const menu=document.querySelector('[role="menu"]');assert.ok(menu);const items=[...menu.querySelectorAll('[role="menuitem"]')];assert.deepEqual(items.map(item=>item.textContent),['历史复盘','设置']);assert.equal(items[0].getAttribute('aria-current'),'page');assert.equal(items[1].hasAttribute('aria-current'),false);assert.equal(menu.querySelector('.header-link'),null,'mobile row descriptors cannot inherit desktop navigation presentation');items[0].click();await settle();assert.equal(document.querySelector('[role="menu"]'),null)};
      state.saving=true;await choose();assert.equal(routes.length,visit*2);assert.ok(notices.length);state.saving=false;
      state.dirty=true;await choose();assert.equal(routes.length,visit*2);assert.match(modal.textContent,/未保存内容/);
      modal.querySelector('#discard-change').click();assert.equal(state.dirty,false);assert.equal(routes.length,visit*2+1);
      await choose();assert.equal(routes.length,visit*2+2);assert.equal(routes.at(-1),'history');
      surface.querySelector('[aria-label="账户菜单"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));await settle();assert.ok(document.querySelector('[role="menuitem"].account-fixture-item'),'desktop account descriptors retain their original classes');document.querySelector('[role="menu"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();
    }
  }finally{ui.disposeUi(surface);modal.remove()}
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
