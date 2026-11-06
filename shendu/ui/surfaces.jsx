import * as React from 'react';
import {flushSync} from 'react-dom';
import {zhCN} from 'date-fns/locale';
import {toast as sonnerToast} from 'sonner';
import {Button} from './components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './components/ui/dialog';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel} from './components/ui/dropdown-menu';
import {Calendar,CalendarDayButton} from './components/ui/calendar';
import {Toaster} from './components/ui/sonner';
import {mountComponent,enhanceUi,disposeUi} from './runtime';
import {lunarMonthLabels} from './lunar-calendar';
import './surfaces.css';
import './stage.css';

// Date-only business values are converted with local fields, never UTC offsets.
export function calendarDate(value){const [y,m,d]=String(value||'').split('-').map(Number);return y&&m&&d?new Date(y,m-1,d,12):undefined}
export function calendarValue(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
const monthDate=value=>calendarDate(`${value}-01`);
const raw=html=>({__html:html});
const dialogBodies=new WeakMap();
function clearDialog(container){for(const body of dialogBodies.get(container)||[])disposeUi(body);dialogBodies.delete(container);disposeUi(container);container.replaceChildren()}
export function dismissDialog(container){clearDialog(container)}
export function prepareDialogContainer(container){
  if(container.children.length)return container;
  // A parent Radix Dialog snapshots existing siblings for hideOthers. A fresh
  // body-level mount for each visit avoids portaling a child into that hidden
  // snapshot ancestor; copying/removing aria-hidden would fight Radix ownership.
  clearDialog(container);const fresh=document.createElement('div');fresh.id=container.id;fresh.className=container.className;container.replaceWith(fresh);return fresh;
}

/** The raw body is deliberately opaque to React. Business form bindings remain native. */
export function showDialog(container,{html,className='',title='慎独',description='',canClose=()=>true,onClose=()=>{},returnFocus}){
  clearDialog(container);
  mountComponent(container,<Dialog open onOpenChange={open=>{if(!open&&canClose())onClose()}}>
    <DialogContent container={container} className={`sd-surface sd-dialog modal ${className}`} overlayClassName="sd-surface sd-dialog-overlay modal-backdrop" showCloseButton={false}
      onOpenAutoFocus={event=>event.preventDefault()}
      onCloseAutoFocus={event=>event.preventDefault()}
      onEscapeKeyDown={event=>{if(!canClose())event.preventDefault()}}
      onInteractOutside={event=>{if(!canClose())event.preventDefault()}}>
      <DialogTitle className="sr-only">{title}</DialogTitle>
      <DialogDescription className="sr-only">{description||'在此完成设置或确认操作。'}</DialogDescription>
      <div data-legacy-dialog-body dangerouslySetInnerHTML={raw(html)}/>
    </DialogContent>
  </Dialog>);
  const body=container.querySelector('[data-legacy-dialog-body]');
  dialogBodies.set(container,[body]);enhanceUi(body);
  body.querySelector('.modal-head h2')?.setAttribute('aria-hidden','true');
  body.querySelector('.modal-head p')?.setAttribute('aria-hidden','true');
  return body;
}

function MenuSurface({trigger,items,label,className,controls}){
  const [open,setOpen]=React.useState(false);controls.close=restore=>{flushSync(()=>setOpen(false));if(restore)controls.trigger?.focus()};
  return <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
    <DropdownMenuTrigger asChild><Button {...trigger.props} ref={node=>{controls.trigger=node}} className={trigger.className} variant="ghost" dangerouslySetInnerHTML={raw(trigger.html)}/></DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={10} className={`sd-surface sd-menu ${className||''}`} onCloseAutoFocus={event=>{event.preventDefault();if(!document.querySelector('[data-slot="dialog-content"]')&&controls.trigger?.isConnected)controls.trigger.focus({preventScroll:true})}}>
      {label&&<DropdownMenuLabel className="header-menu-caption">{label}</DropdownMenuLabel>}
      {items.map((item,index)=><DropdownMenuItem key={index} className={`header-menu-item ${item.className||''}`} onSelect={event=>{event.preventDefault();controls.close(false);controls.trigger?.focus({preventScroll:true});item.onSelect()}} aria-current={item.current?'page':undefined} dangerouslySetInnerHTML={raw(item.html)}/>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}
export function showMenu(container,options){const controls={};mountComponent(container,<MenuSurface {...options} controls={controls}/>);return controls}

const calendarLabels={labelDayButton:(date,modifiers)=>`${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日 星期${'日一二三四五六'[date.getDay()]}${modifiers.today?'，今天':''}${modifiers.selected?'，已选择':''}`,labelNext:()=>'下个月',labelPrevious:()=>'上个月',labelGrid:date=>`${date.getFullYear()}年${date.getMonth()+1}月`,labelWeekday:date=>`星期${'日一二三四五六'[date.getDay()]}`};
function DateCalendar({value,month,minimum,locked,today,onSelect,onMonthChange,canSelect=()=>true}){
  const [visible,setVisible]=React.useState(monthDate(month)),[selected,setSelected]=React.useState(calendarDate(value));
  const Day=React.useCallback(function VerificationDay(props){return <CalendarDayButton {...props} className="daily-calendar-day" data-verify-day={calendarValue(props.day.date)} aria-pressed={!!props.modifiers.selected}/>},[]);
  const choose=date=>{if(!date||locked||!canSelect()||calendarValue(date)<minimum)return;setSelected(date);onSelect(calendarValue(date))};
  return <div className="sd-surface sd-calendar sd-verification-calendar">
    <Calendar mode="single" required month={visible} selected={selected} onMonthChange={date=>{if(locked)return;setVisible(date);onMonthChange?.(calendarValue(date).slice(0,7))}} onSelect={choose} locale={zhCN} weekStartsOn={1} fixedWeeks showOutsideDays={false} today={calendarDate(today)} disabled={date=>locked||calendarValue(date)<minimum} disableNavigation={locked} startMonth={locked?undefined:monthDate(minimum.slice(0,7))} endMonth={new Date(9999,11,1)} components={{DayButton:Day}} labels={calendarLabels} formatters={{formatCaption:date=>`${date.getFullYear()} 年 ${date.getMonth()+1} 月`,formatWeekdayName:date=>'一二三四五六日'[(date.getDay()+6)%7]}}/>
    <div className="daily-calendar-foot"><span className="daily-calendar-help">{locked?'日期已锁定':minimum===today?'可选择今天及以后的日期':`最早 ${minimum.replace(/-/g,' / ')}`}</span><Button type="button" variant="ghost" className="daily-calendar-today" data-verify-today disabled={locked} onClick={()=>{const date=calendarDate(minimum);setVisible(monthDate(minimum.slice(0,7)));onMonthChange?.(minimum.slice(0,7));choose(date)}}>{minimum===today?'今天':'最早可选'}</Button></div>
  </div>;
}
export function showVerificationCalendar(container,options){mountComponent(container,<DateCalendar key={`${options.value}|${options.month}|${options.locked}`} {...options}/>)}

function StageCaptionLabel({children,className,...props}){
  const match=/^(\d{4}) 年 (\d{1,2}) 月$/.exec(String(children));
  return <span {...props} className={`${className||''} stage-month-caption`}>{match?<><span className="stage-month-number" aria-hidden>{match[2].padStart(2,'0')}<small>月</small></span><span className="sr-only">{children}</span></>:children}</span>;
}
function StageCalendar({month,today,records,statusLabels,onMonthChange,onSelect}){
  const [visible,setVisible]=React.useState(monthDate(month));
  const displayed=calendarValue(visible).slice(0,7),almanac=React.useMemo(()=>lunarMonthLabels(displayed),[displayed]);
  const byDate=new Map();for(const record of records)if(!byDate.has(record.period))byDate.set(record.period,record);
  const Day=React.useCallback(function StageDay(props){
    const value=calendarValue(props.day.date),record=byDate.get(value),status=record?.status||'',mark={verified:'✓',completed:'●',draft:'—'}[status]||'',lunar=almanac.get(value);
    return <CalendarDayButton {...props} className={`stage-day ${status?'stage-day-'+status:''} ${value===today?'stage-day-today':''} ${lunar?.solarTerm?'stage-day-term':''}`} data-calendar-date={value} data-calendar-record={record?.id} data-solar-term={lunar?.solarTerm||undefined} aria-label={`${props.day.date.getFullYear()}年${props.day.date.getMonth()+1}月${props.day.date.getDate()}日 星期${'日一二三四五六'[props.day.date.getDay()]}，${value===today?'今天，':''}${record?statusLabels[status]:'无记录'}${lunar?`，${lunar.fullLabel}`:''}`}><span className="stage-day-number" aria-hidden>{props.day.date.getDate()}</span><span className="stage-day-lunar" aria-hidden>{lunar?.label}</span>{mark&&<span className="stage-day-mark" aria-hidden>{mark}</span>}</CalendarDayButton>;
  },[records,statusLabels,today,almanac]);
  const finished=records.filter(record=>record.period.startsWith(displayed)&&record.status!=='draft').length;
  return <div className="sd-surface sd-calendar stage-calendar">
    <header className="calendar-paper-heading"><p className="workspace-kicker">一日一页 · 慢慢积累</p><p className="calendar-paper-note">有记录的日子，随时翻开。</p><h2 id="calendar-paper-title">每日足迹</h2><div className="stage-calendar-legend" aria-label="日历状态说明"><span><i className="stage-legend-today" aria-hidden/>今天</span><span><i className="stage-legend-draft" aria-hidden>—</i>草稿</span><span><i className="stage-legend-completed" aria-hidden>●</i>已完成</span><span><i className="stage-legend-verified" aria-hidden>✓</i>已验证</span></div></header>
    <div className="stage-calendar-body"><p className="stage-calendar-year" aria-label={`${visible.getFullYear()}年`}><span>{visible.getFullYear()}</span><small>年</small></p><Calendar mode="single" month={visible} onMonthChange={date=>{setVisible(date);onMonthChange(calendarValue(date).slice(0,7))}} onSelect={date=>{if(date)onSelect(calendarValue(date),byDate.get(calendarValue(date)))}} today={calendarDate(today)} locale={zhCN} weekStartsOn={1} fixedWeeks showOutsideDays={false} disabled={date=>calendarValue(date)!==today&&!byDate.has(calendarValue(date))} components={{DayButton:Day,CaptionLabel:StageCaptionLabel}} labels={calendarLabels} formatters={{formatCaption:date=>`${date.getFullYear()} 年 ${date.getMonth()+1} 月`,formatWeekdayName:date=>'一二三四五六日'[(date.getDay()+6)%7]}}/></div>
    <div className="stage-calendar-foot"><p>本月已完成 <strong>{finished}</strong> 天复盘</p><Button type="button" variant="ghost" className="stage-return-month" disabled={displayed===today.slice(0,7)} onClick={()=>{const date=monthDate(today.slice(0,7));setVisible(date);onMonthChange(today.slice(0,7))}}>回到本月 <span aria-hidden>↗</span></Button></div>
  </div>;
}
export function showStageCalendar(container,options){mountComponent(container,<StageCalendar {...options}/>)}
export function initializeToasts(container){
  // Mount the existing live region before any Dialog hideOthers snapshot.
  if(!container.querySelector('[data-sonner-toaster]'))mountComponent(container,<div className="sd-surface"><Toaster position="bottom-right" containerAriaLabel="通知" closeButton duration={3200} toastOptions={{className:'sd-toast',closeButtonAriaLabel:'关闭通知'}}/></div>);
}
export function showToast(container,message,kind='success'){
  initializeToasts(container);
  (sonnerToast[kind]||sonnerToast)(String(message));
}
