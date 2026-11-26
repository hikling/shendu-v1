import * as React from 'react';
import {Pie,PieChart} from 'recharts';
import {ChartContainer,ChartTooltip,ChartTooltipContent} from './components/ui/chart';
import {mountComponent,disposeUi} from './runtime';
import {formatFinanceMoney} from '../public/finance-domain';
import './finance-pie.css';

const categoryColors=new Map(Object.entries({
  food:'#2f8f79',transport:'#d4943f',shopping:'#5b89b8',housing:'#cf7267',
  health:'#79a86b',learning:'#8a79b8',entertainment:'#d48653',social:'#4ea3b0',
  salary:'#6d84c2','other-income':'#b97ea8'
}));
const palette=[...categoryColors.values()],neutralColor='#cbd3df';
function categoryColor(id){
  if(id==='__others'||id==='uncategorized')return neutralColor;
  if(categoryColors.has(id))return categoryColors.get(id);
  let hash=2166136261;for(const char of id)hash=Math.imul(hash^char.codePointAt(0),16777619);
  return palette[(hash>>>0)%palette.length];
}
const money=cents=>`¥${formatFinanceMoney(cents)}`;
function percentage(cents,total){return `${(cents/total*100).toLocaleString('zh-CN',{maximumFractionDigits:1})}%`}
export function financePieData(totals=[]){
  const categories=totals.filter(row=>Number.isSafeInteger(row.cents)&&row.cents>0).map(row=>({categoryId:String(row.categoryId),name:String(row.name||'待分类'),cents:row.cents,fill:categoryColor(String(row.categoryId))})).sort((a,b)=>b.cents-a.cents||a.categoryId.localeCompare(b.categoryId));
  const total=categories.reduce((sum,row)=>sum+row.cents,0),main=categories.length<=6?categories:categories.slice(0,5),remainder=categories.length<=6?[]:categories.slice(5);
  const slices=[...main,...(remainder.length?[{categoryId:'__others',name:'其他分类',cents:remainder.reduce((sum,row)=>sum+row.cents,0)}]:[])].map((row,index)=>({...row,key:`category${index}`,fill:categoryColor(row.categoryId),percentage:percentage(row.cents,total)}));
  return {categories,total,slices,remainder};
}
function FinancePie({totals=[],refundCents=0,netExpenseCents=0,title='分类花销',loading=false,error=''}){
  const {categories,total,slices,remainder}=financePieData(totals),config=Object.fromEntries(slices.map(row=>[row.key,{label:row.name,color:row.fill}]));
  const plotKey=slices.map(row=>`${row.categoryId}:${row.cents}`).join('|'),totalLabel=money(total);
  const listRow=row=> <li key={row.categoryId}><span className="finance-pie-dot" style={{background:row.fill||neutralColor}} aria-hidden="true"/><span className="finance-pie-category">{row.name}</span><strong>{money(row.cents)}</strong><span className="finance-pie-percent">{percentage(row.cents,total)}</span></li>;
  return <figure className="finance-pie-figure" aria-label={title} aria-busy={loading}>
    {loading?<p className="finance-pie-state" role="status">正在读取花销…</p>:error?<p className="finance-pie-state is-error" role="status">{error}</p>:<>
      {total>0?<div className="finance-pie-body"><div className="finance-pie-plot" key={plotKey}><ChartContainer config={config} className="finance-pie-chart" role="img" aria-label={`${title}，共${totalLabel}，${categories.length}个分类；分类金额及占比见下方`}><PieChart accessibilityLayer><ChartTooltip cursor={false} content={<ChartTooltipContent formatter={value=>money(value)}/>}/><Pie data={slices} dataKey="cents" nameKey="name" cx="50%" cy="50%" innerRadius="65%" outerRadius="91%" paddingAngle={slices.length>1?3:0} cornerRadius={slices.length>1?5:0} stroke="var(--workspace-canvas, #faf8f2)" strokeWidth={2} isAnimationActive={false}/></PieChart></ChartContainer><div className={`finance-pie-total${totalLabel.length>12?' is-long':''}`}><span>支出合计</span><strong>{totalLabel}</strong></div></div><div className="finance-pie-list-col"><ul className="finance-pie-legend" aria-label={`${title}分类金额和占比`}>{slices.map(listRow)}</ul>{remainder.length?<details className="finance-pie-breakdown"><summary>展开其他 {remainder.length} 个分类</summary><ul className="finance-pie-legend">{remainder.map(listRow)}</ul></details>:null}</div></div>:<div className="finance-pie-empty"><span aria-hidden="true"/><p>这段时间没有支出</p><small>{refundCents>0?'已收到的退款列在下方。':'记下花销后，这里会显示分类占比。'}</small></div>}
      <p className="finance-pie-note"><span>退款 <strong>{money(Math.max(0,refundCents))}</strong></span><span>净支出 <strong>{netExpenseCents<0?'−':''}{money(Math.abs(netExpenseCents))}</strong></span><small>饼图按实际支出分类，退款单独计算。</small></p>
    </>}
  </figure>;
}
export function showFinancePie(container,options){
  let value={...options};const render=()=>mountComponent(container,<FinancePie {...value}/>);render();
  return {setData(next){value={...value,...next};render()},dispose(){disposeUi(container)}};
}
