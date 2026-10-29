import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyCalendarModel,dailyCalendarKeyDate,dailyCalendarDateLabel} from '../public/daily-calendar.js';

const minimum='2026-10-29';

test('opening an empty calendar does not select a value and starts at the first available day',()=>{
  const model=dailyCalendarModel('',minimum);
  assert.equal(model.selected,'');assert.equal(model.month,'2026-10');assert.equal(model.tabDate,minimum);
  assert.deepEqual(model.cells.filter(cell=>cell&&!cell.disabled).map(cell=>cell.date),[minimum,'2026-10-30','2026-10-31']);
  assert.equal(model.previous,false);assert.equal(model.next,true);assert.equal(model.cells.length,42);
  assert.equal(model.cells.findIndex(cell=>cell?.date==='2026-10-01'),3,'Monday-first placement for Thursday');
});

test('a future category minimum is selectable but is not mislabeled as today',()=>{
  const model=dailyCalendarModel('','2026-11-02','',false,'','2026-10-29');
  assert.equal(model.month,'2026-11');assert.equal(model.tabDate,'2026-11-02');
  assert.equal(model.cells.find(cell=>cell?.date==='2026-11-02')?.today,false);
  assert.equal(model.cells.some(cell=>cell?.today),false);
});

test('month browsing preserves the actual selected value instead of choosing the first day',()=>{
  const model=dailyCalendarModel('2026-11-05',minimum,'2026-12');
  assert.equal(model.selected,'2026-11-05');assert.equal(model.month,'2026-12');assert.equal(model.tabDate,'2026-12-01');
  assert.equal(model.cells.some(cell=>cell?.selected),false);
  assert.equal(dailyCalendarModel('',minimum,'not-a-month').month,'2026-10');
});

test('date values accepted through string validation stay canonical when old data is not a string',()=>{
  const value=['2026-11-05'],model=dailyCalendarModel(value,minimum);
  assert.equal(model.selected,'2026-11-05');assert.equal(model.month,'2026-11');assert.equal(model.tabDate,'2026-11-05');
  assert.equal(model.cells.find(cell=>cell?.selected)?.date,'2026-11-05');
  assert.deepEqual(value,['2026-11-05'],'normalizing display data does not mutate the original record');
});

test('expired editable draft dates reveal a usable current month without rewriting the value',()=>{
  const model=dailyCalendarModel('2026-09-15',minimum);
  assert.equal(model.selected,'2026-09-15');assert.equal(model.month,'2026-10');assert.equal(model.tabDate,minimum);
  assert.equal(dailyCalendarModel('',minimum,'2026-09').month,'2026-10');
});

test('locked history shows its original month and selected date with every control noneditable',()=>{
  const model=dailyCalendarModel('2024-02-29',minimum,'',true);
  assert.equal(model.month,'2024-02');assert.equal(model.tabDate,'');assert.equal(model.previous,false);assert.equal(model.next,false);
  assert.equal(model.cells.filter(Boolean).length,29);assert.ok(model.cells.filter(Boolean).every(cell=>cell.disabled));
  assert.equal(model.cells.find(cell=>cell?.selected)?.date,'2024-02-29');
});

test('month cells follow Gregorian leap years and reject impossible saved dates',()=>{
  assert.equal(dailyCalendarModel('',minimum,'2028-02').cells.filter(Boolean).length,29);
  assert.equal(dailyCalendarModel('',minimum,'2100-02').cells.filter(Boolean).length,28);
  assert.equal(dailyCalendarModel('2026-02-30',minimum).selected,'');
  assert.equal(dailyCalendarModel('2026-13-01',minimum).month,'2026-10');
});

test('arrow and week-boundary keys cross months but never move before the minimum',()=>{
  assert.equal(dailyCalendarKeyDate(minimum,'ArrowLeft',minimum),minimum);
  assert.equal(dailyCalendarKeyDate(minimum,'ArrowUp',minimum),minimum);
  assert.equal(dailyCalendarKeyDate('2026-10-31','ArrowRight',minimum),'2026-11-01');
  assert.equal(dailyCalendarKeyDate('2026-11-01','Home',minimum),minimum);
  assert.equal(dailyCalendarKeyDate(minimum,'End',minimum),'2026-11-01');
  assert.equal(dailyCalendarKeyDate('2026-11-01','ArrowDown',minimum),'2026-11-08');
});

test('Page navigation keeps the day where possible and clamps at month end and calendar limits',()=>{
  assert.equal(dailyCalendarKeyDate('2028-01-31','PageDown',minimum),'2028-02-29');
  assert.equal(dailyCalendarKeyDate('2027-03-31','PageUp',minimum),'2027-02-28');
  assert.equal(dailyCalendarKeyDate('2028-02-29','PageDown',minimum,true),'2029-02-28');
  assert.equal(dailyCalendarKeyDate('2026-12-31','PageDown',minimum),'2027-01-31');
  assert.equal(dailyCalendarKeyDate(minimum,'PageUp',minimum),minimum);
  assert.equal(dailyCalendarKeyDate('9999-12-31','PageDown',minimum),'9999-12-31');
  assert.equal(dailyCalendarModel('',minimum,'9999-12').next,false);
});

test('selection labels use full Chinese weekdays and non-navigation keys keep native behavior',()=>{
  assert.equal(dailyCalendarDateLabel('2026-11-01'),'2026年11月1日 星期日');
  assert.equal(dailyCalendarDateLabel(''),'未选择验证日期');
  for(const key of ['Tab','Enter',' ','Escape'])assert.equal(dailyCalendarKeyDate(minimum,key,minimum),null);
  assert.equal(dailyCalendarKeyDate('not-a-date','ArrowDown',minimum),null);
});
