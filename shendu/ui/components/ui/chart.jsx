import * as React from 'react';
import {ResponsiveContainer,Tooltip} from 'recharts';
import {cn} from '@/lib/utils';

// shadcn/ui Chart composition: one shared config context and Recharts surface.
// Adapted to the project's JavaScript component source and existing paper tokens.
const ChartContext=React.createContext(null);
function useChart(){const context=React.useContext(ChartContext);if(!context)throw new Error('Chart content must be used within ChartContainer');return context}
export function ChartContainer({id,className,children,config,...props}){
  const generated=React.useId(),chartId=`chart-${id||generated.replace(/:/g,'')}`;
  return <ChartContext.Provider value={{config}}><div data-slot="chart" data-chart={chartId} className={cn('flex aspect-square justify-center text-xs [&_.recharts-surface]:outline-none [&_.recharts-sector]:outline-none',className)} {...props}><ResponsiveContainer width="100%" height="100%" initialDimension={{width:280,height:230}} debounce={40}>{children}</ResponsiveContainer></div></ChartContext.Provider>;
}
export const ChartTooltip=Tooltip;
export function ChartTooltipContent({active,payload,label,className,formatter}){
  const {config}=useChart();
  if(!active||!payload?.length)return null;
  return <div className={cn('sd-surface finance-chart-tooltip',className)}>{label?<strong>{label}</strong>:null}{payload.map((item,index)=>{const setting=config[item.payload?.key]||{};return <div key={item.dataKey||index}><span className="finance-pie-dot" style={{background:setting.color||item.payload?.fill}} aria-hidden="true"/><span>{setting.label||item.name}</span><strong>{formatter?formatter(item.value,item.name):item.value}</strong></div>})}</div>;
}
