import {parseMoneyExpression} from './finance-domain.js?v=1.0.0-audit1';

const array=value=>Array.isArray(value)?value:[];
const validAmount=value=>Number.isSafeInteger(value)&&value>0;
const validReceiptId=value=>typeof value==='string'&&value.length>0&&value.trim()===value;

// receiptIds is the caller's saved-image allowlist, not proof of storage readiness.
// The UI must reject an unstored upload before invoking this pure association step.
// OCR matching never proves payment settlement or replaces explicit confirmation.
export function matchFinanceReceipts(rows=[],result={}){
  const sourceRows=array(rows),ids=[...new Set(array(result?.receiptIds).filter(validReceiptId))];
  const groups=new Map(ids.map((id,index)=>[id,{id,index,amounts:new Set(),duplicate:false}]));

  for(const candidate of array(result?.candidates)){
    const candidateIds=[...new Set(array(candidate?.receiptIds))].filter(id=>groups.has(id));
    for(const id of candidateIds)if(candidate.duplicate===true)groups.get(id).duplicate=true;
    if(candidate?.kind!=='expense')continue;
    let amount;
    try{amount=parseMoneyExpression(candidate.expression)}catch{continue}
    if(!validAmount(amount))continue;
    for(const id of candidateIds)groups.get(id).amounts.add(amount);
  }

  const receipts=[...groups.values()].map(group=>({...group,amounts:[...group.amounts].sort((a,b)=>a-b)}));
  const used=new Set(array(result?.usedReceiptIds).filter(id=>groups.has(id)));
  const manualForRow=sourceRows.map(row=>{
    const manual=[...new Set(array(row?.receiptIds).filter(id=>groups.has(id)))].filter(id=>!used.has(id));
    manual.forEach(id=>used.add(id));
    return manual;
  });
  const amountReceipts=new Map(),rowCounts=new Map(),receiptCounts=new Map();
  for(const receipt of receipts){
    if(used.has(receipt.id))continue;
    for(const amount of receipt.amounts){
      if(!amountReceipts.has(amount))amountReceipts.set(amount,[]);
      amountReceipts.get(amount).push(receipt.id);
    }
  }
  sourceRows.forEach(row=>{
    if(validAmount(row?.amountCents))rowCounts.set(row.amountCents,(rowCounts.get(row.amountCents)||0)+1);
    for(const id of amountReceipts.get(row?.amountCents)||[])receiptCounts.set(id,(receiptCounts.get(id)||0)+1);
  });

  const matchedRows=sourceRows.map((row,index)=>{
    const manual=manualForRow[index];
    if(manual.length)return {...row,receiptIds:manual,matchReason:'manual'};
    if(!validAmount(row?.amountCents))return {...row,receiptIds:[],matchReason:'invalid-amount'};
    if(rowCounts.get(row.amountCents)!==1)return {...row,receiptIds:[],matchReason:'duplicate-row-amount'};
    const matches=amountReceipts.get(row.amountCents)||[];
    if(matches.length===1&&receiptCounts.get(matches[0])===1){
      used.add(matches[0]);return {...row,receiptIds:[matches[0]],matchReason:'amount'};
    }
    if(matches.length===1)return {...row,receiptIds:[],matchReason:'multiple-rows'};
    if(matches.length>1)return {...row,receiptIds:[],matchReason:'multiple-receipts'};
    return {...row,receiptIds:[],matchReason:amountReceipts.size?'amount-mismatch':'unrecognized-amount'};
  });
  return {rows:matchedRows,receipts,unmatchedReceiptIds:ids.filter(id=>!used.has(id))};
}
