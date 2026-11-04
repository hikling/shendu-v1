import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

// Exercise the real native heading owner; these nodes intentionally stay outside React.
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function owner(name,next){
  const start=source.indexOf(`function ${name}(`),end=source.indexOf(`\nfunction ${next}(`,start);
  assert.ok(start>=0&&end>start,`${name} owner exists`);return source.slice(start,end);
}
function headingFixture(){
  const dom=new JSDOM('<h2></h2>'),document=dom.window.document;
  const render=new Function('document',`${owner('dailyIntroLines','dailyReviewHtml')}\n${owner('setReviewPromptHeading','setDailyPromptHeading')}\nreturn setReviewPromptHeading;`)(document);
  return {heading:document.querySelector('h2'),render};
}

test('review heading keeps each comma-delimited phrase together without losing punctuation or emphasis',()=>{
  const {heading,render}=headingFixture(),text='财务秩序，今天做了什么？';
  render(heading,text,'财务秩序');
  assert.deepEqual([...heading.children].map(row=>row.textContent),['财务秩序，','今天做了什么？']);
  assert.equal(heading.textContent,text);
  assert.equal(heading.querySelector('.daily-title-emphasis').textContent,'财务秩序');
});

test('shared heading handles all review punctuation and emphasis crossing a line boundary',()=>{
  const {heading,render}=headingFixture(),text='回看事实，调整行动。接着走。';
  render(heading,text,'事实，调整');
  assert.deepEqual([...heading.children].map(row=>row.textContent),['回看事实，','调整行动。','接着走。']);
  assert.equal(heading.textContent,text);
  assert.equal([...heading.querySelectorAll('.daily-title-emphasis')].map(node=>node.textContent).join(''),'事实，调整');
});

test('legacy values and missing emphasis remain safe text, including HTML-like metric names',()=>{
  const {heading,render}=headingFixture(),text='<img src=x onerror=alert(1)>，今天怎样？';
  render(heading,text,'<img src=x onerror=alert(1)>');
  assert.equal(heading.textContent,text);assert.equal(heading.querySelector('img'),null);
  render(heading,42,'missing');assert.equal(heading.textContent,'42');
  render(heading,null);assert.equal(heading.textContent,'');assert.equal(heading.children.length,0);
});
