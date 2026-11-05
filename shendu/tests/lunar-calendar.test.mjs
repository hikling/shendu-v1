import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {lunarDateLabel,lunarMonthLabels} from '../ui/lunar-calendar.js';

test('Spring Festival and the preceding lunar year remain correct across solar and lunar new years',()=>{
  const first=lunarDateLabel('2026-02-17');
  assert.equal(first.year,2026);assert.equal(first.month,1);assert.equal(first.day,1);
  assert.equal(first.label,'正月');assert.equal(first.fullLabel,'农历丙午年正月初一');
  const eve=lunarDateLabel('2026-02-16');
  assert.equal(eve.year,2025);assert.equal(eve.month,12);assert.equal(eve.day,29);
  assert.equal(lunarDateLabel('2026-01-01').year,2025);
  assert.equal(lunarDateLabel('2027-02-06').fullLabel,'农历丁未年正月初一');
});

test('leap lunar months retain their marker and return to the ordinary next month',()=>{
  const leap=lunarDateLabel('2025-07-25');
  assert.equal(leap.month,-6);assert.equal(leap.day,1);assert.equal(leap.label,'闰六月');
  assert.match(leap.fullLabel,/闰六月初一/);
  const next=lunarDateLabel('2025-08-23');
  assert.equal(next.month,7);assert.equal(next.day,1);assert.equal(next.monthName,'七月');
  assert.equal(next.label,'处暑','a solar term also takes priority on a lunar first day');
});

test('exact civil-day solar terms take label priority without losing the full lunar date',()=>{
  for(const [date,term] of [['2026-02-04','立春'],['2026-04-05','清明'],['2026-11-07','立冬'],['2026-11-22','小雪'],['2026-12-22','冬至'],['2027-01-05','小寒']]){
    const result=lunarDateLabel(date);
    assert.equal(result.solarTerm,term,date);assert.equal(result.label,term,date);
    assert.match(result.fullLabel,/^农历.+年.+月.+，/);assert.ok(result.fullLabel.endsWith(term));
  }
  assert.equal(lunarDateLabel('2026-11-06').solarTerm,'');
  assert.equal(lunarDateLabel('2026-11-08').solarTerm,'');
});

test('a Gregorian month has one annotation per real day including leap day and all its solar terms',()=>{
  const leap=lunarMonthLabels('2028-02');assert.equal(leap.size,29);assert.ok(leap.has('2028-02-29'));assert.equal(leap.has('2028-03-01'),false);
  const november=lunarMonthLabels('2026-11');assert.equal(november.size,30);
  assert.deepEqual([...november.values()].filter(value=>value.solarTerm).map(value=>[value.date,value.solarTerm]),[['2026-11-07','立冬'],['2026-11-22','小雪']]);
  for(const invalid of ['','2026-02-29','2026-13-01','2026-11-31','2026-1-01',new Date(NaN)])assert.throws(()=>lunarDateLabel(invalid),RangeError);
});

test('annotations use explicit local calendar fields rather than timezone-sensitive ISO parsing',()=>{
  const path=new URL('../ui/lunar-calendar.js',import.meta.url).href;
  const source=`import {lunarDateLabel} from ${JSON.stringify(path)}; console.log(JSON.stringify([lunarDateLabel('2026-02-17'),lunarDateLabel(new Date(2026,1,17,0,30))]));`;
  let baseline;
  for(const timezone of ['Asia/Shanghai','America/Los_Angeles','Pacific/Kiritimati']){
    const result=spawnSync(process.execPath,['--input-type=module','-e',source],{env:{...process.env,TZ:timezone},encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const annotations=JSON.parse(result.stdout);
    assert.equal(annotations[0].date,'2026-02-17');assert.deepEqual(annotations[0],annotations[1]);
    baseline??=annotations;assert.deepEqual(annotations,baseline);
  }
});
