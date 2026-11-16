# Design and boundary

根因：默认select桥接到RadioGroup，不适合财务筛选/密集分类；hidden被按钮display覆盖；原单笔表单把分类、备注都作为主内容。更改行为所有者，而非缩小字号掩盖。

纸色/宋体/灰绿沿用现有规范。主签名为像账本速记的一块大输入纸面：逐行输入，底部合计，紧凑可校正的解析预览。每日只保留输入、合计、确认与次要截图/详细录入；财务用同一输入器，明细顶部单行搜索+紧凑筛选，日期分组清楚。保留原插画，无新增装饰口号。

Ownership: domain worker owns finance-domain.js, finance-ledger.mjs draft normalization, domain/API draft tests. UI worker owns finance-ui.js/finance.css/finance-ui.test.mjs. Root owns ui/runtime.jsx compact business variants, ui/surfaces.jsx/entry exports/month picker tests and CSS, app injection, docs/spec/cache versions and integration/browser QA. Do not revert others.

Contract: parseFinanceLines(text,{categories,kind='expense'}) -> {rows:[{line,expression,purpose,amountCents,categoryId}],errors:[{line,message}],totalCents}. Blank lines ignored; expression restricted existing decimal +/-; use whitespace delimiter. Draft adds text (max6000) while preserving legacy expression/purpose/categoryId/note/receiptIds. hasPendingFinanceDraft checks text too. Browser new text submissions use stable UUIDs per pending line; retries skip committed rows. No schema bump or new ledger API.

Root supplies options.showMonthPicker(host,{value,today,isCurrent,onChange}) returning {dispose,setValue,setDisabled}; UI mounts [data-finance-period] once instead of native type=month and guards onChange with alive/pending. Root extends canonical component bridge with data-finance-compact on selects inside finance surfaces, keeping real NativeSelect+FormData. Root [hidden] override scoped to finance surfaces.

No server storage/provider changes, cloud OCR, new currencies, banking or automatic entry commits. Manual simpler input still uses existing ledger endpoints, encrypted storage and activity.
