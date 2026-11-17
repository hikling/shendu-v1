import * as React from 'react';
import {flushSync} from 'react-dom';
import {Button} from './components/ui/button';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from './components/ui/dropdown-menu';
import {Popover,PopoverTrigger,PopoverContent} from './components/ui/popover';
import {Calendar} from './components/ui/calendar';
import {calendarDate,calendarDateLibrary} from './calendar-date';
import {zhCN} from 'date-fns/locale';
import {ChevronLeftIcon,ChevronRightIcon,ChevronDownIcon,CalendarDaysIcon} from 'lucide-react';
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
    <Button className="finance-period-arrow" variant="ghost" type="button" aria-label="上个月" disabled={disabled||selected==='0001-01'} onClick={()=>step(-1)}><ChevronLeftIcon size={18} aria-hidden="true"/></Button>
    <DropdownMenu modal={false} open={open} onOpenChange={next=>{if(!next){setOpen(false);return}if(current()){setYear(parts.year);setOpen(true)}}}>
      <DropdownMenuTrigger asChild><Button ref={trigger} className="finance-period-trigger" variant="ghost" type="button" disabled={disabled} aria-label={`选择月份，当前${parts.year}年${parts.month}月`}><span>{parts.year}<small>年</small> {parts.month}<small>月</small></span><ChevronDownIcon size={15} aria-hidden="true"/></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="sd-surface finance-period-menu" onCloseAutoFocus={event=>{event.preventDefault();if(current()&&trigger.current?.isConnected)trigger.current.focus({preventScroll:true})}}>
        <div className="finance-period-year">
          <DropdownMenuItem aria-label="上一年" disabled={year===1} onSelect={event=>{event.preventDefault();if(current())setYear(value=>Math.max(1,value-1))}}><ChevronLeftIcon size={17} aria-hidden="true"/></DropdownMenuItem>
          <span aria-live="polite">{year}年</span>
          <DropdownMenuItem aria-label="下一年" disabled={year===9999} onSelect={event=>{event.preventDefault();if(current())setYear(value=>Math.min(9999,value+1))}}><ChevronRightIcon size={17} aria-hidden="true"/></DropdownMenuItem>
        </div>
        <div className="finance-period-months">{Array.from({length:12},(_,index)=>index+1).map(month=><DropdownMenuItem key={month} aria-label={`${year}年${month}月`} aria-current={selected===monthValue(year,month)?'date':undefined} onSelect={event=>{event.preventDefault();choose(monthValue(year,month))}}>{month}月</DropdownMenuItem>)}</div>
        <DropdownMenuItem className="finance-period-today" onSelect={event=>{event.preventDefault();choose(todayMonth)}}>回到本月</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Button className="finance-period-arrow" variant="ghost" type="button" aria-label="下个月" disabled={disabled||selected==='9999-12'} onClick={()=>step(1)}><ChevronRightIcon size={18} aria-hidden="true"/></Button>
  </div>;
}

const civilValue=date=>`${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function validDay(value){
  if(!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(value)))return false;
  const date=calendarDate(value);return date&&civilValue(date)===value;
}
function lastDay(month){const date=calendarDate(`${month}-01`);date.setMonth(date.getMonth()+1,0);return civilValue(date)}
function FinanceDayPicker({value,month,today,label='每日花销日期',isCurrent=()=>true,onChange,controls}){
  const [selected,setSelected]=React.useState(value),[visible,setVisible]=React.useState(month),[disabled,setDisabled]=React.useState(false),[open,setOpen]=React.useState(false),trigger=React.useRef(null);
  const current=()=>!disabled&&isCurrent(),dateLib=React.useMemo(()=>calendarDateLibrary(today),[today]);
  controls.setValue=next=>{if(!validDay(next)||next.slice(0,7)!==visible)return;flushSync(()=>setSelected(next))};
  controls.setMonth=next=>{if(!monthParts(next))return;flushSync(()=>{setVisible(next);setSelected(previous=>previous.slice(0,7)===next?previous:`${next}-01`);setOpen(false)})};
  controls.setDisabled=next=>flushSync(()=>{setDisabled(Boolean(next));if(next)setOpen(false)});
  const choose=date=>{if(!date||!current())return;const next=civilValue(date);if(next.slice(0,7)!==visible)return;setOpen(false);if(next===selected)return;setSelected(next);onChange(next)};
  return <Popover open={open} onOpenChange={next=>{if(!next||current())setOpen(next)}}>
    <PopoverTrigger asChild><Button ref={trigger} variant="ghost" type="button" className="finance-day-trigger" disabled={disabled} aria-label={`选择${label}，当前${selected}`}><CalendarDaysIcon size={16} aria-hidden="true"/><span>{Number(selected.slice(5,7))}月{Number(selected.slice(8))}日</span><ChevronDownIcon size={14} aria-hidden="true"/></Button></PopoverTrigger>
    <PopoverContent align="end" className="sd-surface finance-day-menu" onCloseAutoFocus={event=>{event.preventDefault();if(current()&&trigger.current?.isConnected)trigger.current.focus({preventScroll:true})}}>
      <Calendar mode="single" required autoFocus month={calendarDate(`${visible}-01`)} selected={calendarDate(selected)} today={calendarDate(today)} dateLib={dateLib} locale={zhCN} weekStartsOn={1} fixedWeeks showOutsideDays={false} hideNavigation startMonth={calendarDate(`${visible}-01`)} endMonth={calendarDate(lastDay(visible))} disabled={date=>disabled||civilValue(date).slice(0,7)!==visible} onSelect={choose} labels={{labelDayButton:(date,modifiers)=>`${civilValue(date)}${modifiers.selected?'，已选择':''}`,labelGrid:()=>`${visible}${label}`,labelWeekday:date=>`星期${'日一二三四五六'[date.getDay()]}`}} formatters={{formatCaption:date=>`${date.getFullYear()}年${date.getMonth()+1}月`,formatWeekdayName:date=>'一二三四五六日'[(date.getDay()+6)%7]}}/>
    </PopoverContent>
  </Popover>;
}

export function showFinanceDayPicker(container,options){
  if(!monthParts(options.month))throw new TypeError('Invalid finance month');
  const value=validDay(options.value)&&options.value.slice(0,7)===options.month?options.value:`${options.month}-01`,controls={};
  mountComponent(container,<FinanceDayPicker {...options} value={value} controls={controls} isCurrent={()=>container.isConnected&&(options.isCurrent?.()??true)}/>);
  return {setValue:value=>controls.setValue(value),setMonth:month=>controls.setMonth(month),setDisabled:value=>controls.setDisabled(value),dispose:()=>disposeUi(container)};
}

export function showFinanceMonthPicker(container,options){
  const value=monthParts(options.value)?options.value:String(options.today).slice(0,7);
  if(!monthParts(value))throw new TypeError('Invalid finance month');
  const controls={};mountComponent(container,<FinanceMonthPicker {...options} value={value} isCurrent={()=>container.isConnected&&(options.isCurrent?.()??true)} controls={controls}/>);
  return {setValue:value=>controls.setValue(value),setDisabled:value=>controls.setDisabled(value),dispose:()=>disposeUi(container)};
}
