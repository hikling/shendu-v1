import * as React from 'react';
import {flushSync} from 'react-dom';
import {Button} from './components/ui/button';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from './components/ui/dropdown-menu';
import {mountComponent,disposeUi} from './runtime';
import './finance-period.css';

function monthParts(value){
  const match=/^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(value||''));
  return match&&Number(match[1])>=1?{year:Number(match[1]),month:Number(match[2])}:null;
}
const monthValue=(year,month)=>`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}`;

function FinanceMonthPicker({value,today,isCurrent=()=>true,onChange,controls}){
  const [selected,setSelected]=React.useState(value),[year,setYear]=React.useState(monthParts(value).year),[open,setOpen]=React.useState(false),[disabled,setDisabled]=React.useState(false);
  const trigger=React.useRef(null),parts=monthParts(selected),current=()=>!disabled&&isCurrent();
  controls.setValue=next=>{const parsed=monthParts(next);if(!parsed)return;flushSync(()=>{setSelected(next);setYear(parsed.year)})};
  controls.setDisabled=next=>flushSync(()=>{setDisabled(Boolean(next));if(next)setOpen(false)});
  const choose=next=>{if(!current()||!monthParts(next))return;setOpen(false);if(next===selected)return;setSelected(next);setYear(monthParts(next).year);onChange(next)};
  const step=direction=>{const serial=(parts.year-1)*12+parts.month-1+direction;if(serial<0||serial>=9999*12)return;choose(monthValue(Math.floor(serial/12)+1,serial%12+1))};
  const todayMonth=String(today).slice(0,7);
  return <div className="finance-period-control sd-surface" role="group" aria-label="查看账目月份">
    <Button className="finance-period-arrow" variant="ghost" type="button" aria-label="上个月" disabled={disabled||selected==='0001-01'} onClick={()=>step(-1)}>‹</Button>
    <DropdownMenu modal={false} open={open} onOpenChange={next=>{if(!next){setOpen(false);return}if(current()){setYear(parts.year);setOpen(true)}}}>
      <DropdownMenuTrigger asChild><Button ref={trigger} className="finance-period-trigger" variant="ghost" type="button" disabled={disabled} aria-label={`选择月份，当前${parts.year}年${parts.month}月`}><span>{parts.year}年{parts.month}月</span><span aria-hidden="true">⌄</span></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="sd-surface finance-period-menu" onCloseAutoFocus={event=>{event.preventDefault();if(current()&&trigger.current?.isConnected)trigger.current.focus({preventScroll:true})}}>
        <div className="finance-period-year">
          <DropdownMenuItem aria-label="上一年" disabled={year===1} onSelect={event=>{event.preventDefault();if(current())setYear(value=>Math.max(1,value-1))}}>‹</DropdownMenuItem>
          <span aria-live="polite">{year}年</span>
          <DropdownMenuItem aria-label="下一年" disabled={year===9999} onSelect={event=>{event.preventDefault();if(current())setYear(value=>Math.min(9999,value+1))}}>›</DropdownMenuItem>
        </div>
        <div className="finance-period-months">{Array.from({length:12},(_,index)=>index+1).map(month=><DropdownMenuItem key={month} aria-label={`${year}年${month}月`} aria-current={selected===monthValue(year,month)?'date':undefined} onSelect={event=>{event.preventDefault();choose(monthValue(year,month))}}>{month}月</DropdownMenuItem>)}</div>
        <DropdownMenuItem className="finance-period-today" onSelect={event=>{event.preventDefault();choose(todayMonth)}}>回到本月</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Button className="finance-period-arrow" variant="ghost" type="button" aria-label="下个月" disabled={disabled||selected==='9999-12'} onClick={()=>step(1)}>›</Button>
  </div>;
}

export function showFinanceMonthPicker(container,options){
  const value=monthParts(options.value)?options.value:String(options.today).slice(0,7);
  if(!monthParts(value))throw new TypeError('Invalid finance month');
  const controls={};mountComponent(container,<FinanceMonthPicker {...options} value={value} isCurrent={()=>container.isConnected&&(options.isCurrent?.()??true)} controls={controls}/>);
  return {setValue:value=>controls.setValue(value),setDisabled:value=>controls.setDisabled(value),dispose:()=>disposeUi(container)};
}
