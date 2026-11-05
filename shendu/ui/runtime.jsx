import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Button} from './components/ui/button.jsx';
import {Input} from './components/ui/input.jsx';
import {Textarea} from './components/ui/textarea.jsx';
import {NativeSelect} from './components/ui/native-select.jsx';
import {RadioGroup,RadioGroupItem} from './components/ui/radio-group.jsx';
import {Label} from './components/ui/label.jsx';
import {Badge} from './components/ui/badge.jsx';
import {Card} from './components/ui/card.jsx';
import {Table} from './components/ui/table.jsx';
import {Progress} from './components/ui/progress.jsx';
import {Skeleton} from './components/ui/skeleton.jsx';
import {Separator} from './components/ui/separator.jsx';
import {Alert} from './components/ui/alert.jsx';
import {Checkbox} from './components/ui/checkbox.jsx';
import './choice-controls.css';

// One registry owns primitive islands and behavior-rich surfaces, including their
// portals. Legacy writers must dispose a region BEFORE replacing its contents.
const roots = new Map();
let nextMount = 0;

function within(container, entry) {
  return container === entry.container || container.contains(entry.container) ||
    (entry.owner && (container === entry.owner || container.contains(entry.owner)));
}

export function disposeUi(container) {
  if (!container) return;
  const entries = [...roots.values()].filter(entry => within(container, entry));
  // Nested raw-content islands must disappear before the containing React root.
  entries.sort((a, b) => a.container.contains(b.container) ? 1 : b.container.contains(a.container) ? -1 : b.order - a.order);
  for (const entry of entries) {
    if (!roots.has(entry.container)) continue;
    roots.delete(entry.container);
    flushSync(() => entry.root.unmount());
  }
}

export function mountComponent(container, element, {owner = container} = {}) {
  if (!container) throw new TypeError('A UI mount container is required');
  let current = roots.get(container);
  if (current) {
    // If raw descendants were enhanced, mount a fresh outer tree after cleanup.
    // Merely re-rendering the same __html string would otherwise leave their
    // emptied hosts in place because React correctly sees unchanged raw HTML.
    if ([...roots.values()].some(child => child !== current && within(container, child))) {
      disposeUi(container);
      current = null;
    }
  }
  if (current) {
    flushSync(() => current.root.render(element));
  } else {
    const entry = {container, owner, root: createRoot(container), order: ++nextMount};
    roots.set(container, entry);
    flushSync(() => entry.root.render(element));
  }
  return {
    update(nextElement) { return mountComponent(container, nextElement, {owner}); },
    dispose() { disposeUi(container); },
  };
}

const propNames = {
  class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly',
  maxlength: 'maxLength', minlength: 'minLength', autocomplete: 'autoComplete',
  autofocus: 'autoFocus', colspan: 'colSpan', rowspan: 'rowSpan',
  inputmode: 'inputMode', spellcheck: 'spellCheck', formnovalidate: 'formNoValidate',
  novalidate: 'noValidate', formaction: 'formAction', formmethod: 'formMethod',
  formenctype: 'formEncType', formtarget: 'formTarget', acceptcharset: 'acceptCharset',
};
const booleanProps = new Set(['disabled', 'required', 'readOnly', 'multiple', 'autoFocus', 'hidden', 'formNoValidate', 'noValidate']);

function propsOf(node) {
  const props = {};
  for (const {name, value} of node.attributes) {
    if (name === 'style' || name === 'value' || name === 'checked' || name === 'selected' || /^on/i.test(name)) continue;
    const key = propNames[name] || name;
    props[key] = booleanProps.has(key) ? true : value;
  }
  if (node.style.length) {
    props.style = {};
    for (const key of Array.from(node.style)) {
      const reactKey = key.startsWith('--') ? key : key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      props.style[reactKey] = node.style.getPropertyValue(key);
    }
  }
  props.className = `sd-ui ${props.className || ''}`.trim();
  props['data-ui-component'] = '';
  return props;
}

function raw(node) { return {dangerouslySetInnerHTML: {__html: node.innerHTML}}; }

// The visible control is the genuine Radix/shadcn Checkbox. A native checkbox
// remains the form/change contract for legacy bindings and FormData. It has no
// visual or keyboard stop; the visible button forwards focus and checked state.
function NativeCheckbox({initial, nativeProps}) {
  const native = useRef(null);
  const visible = useRef(null);
  const [checked, setChecked] = useState(initial);
  useEffect(() => {
    const input = native.current;
    const sync = () => setChecked(input.checked);
    const reset = () => queueMicrotask(sync);
    input.addEventListener('change', sync);
    input.form?.addEventListener('reset', reset);
    return () => {
      input.removeEventListener('change', sync);
      input.form?.removeEventListener('reset', reset);
    };
  }, []);
  const label = nativeProps['aria-label'] || nativeProps.title || undefined;
  return <span data-ui-native="" className="sd-checkbox-adapter" style={{display: 'contents'}}>
    <input {...nativeProps} ref={native} type="checkbox" defaultChecked={initial}
      className={`sd-checkbox-native ${nativeProps.className || ''}`} tabIndex={-1}
      aria-hidden="true" onFocus={() => visible.current?.focus()}/>
    <Checkbox ref={visible} checked={checked} disabled={nativeProps.disabled}
      aria-label={label} aria-labelledby={nativeProps['aria-labelledby']}
      aria-describedby={nativeProps['aria-describedby']} aria-invalid={nativeProps['aria-invalid']}
      className="sd-ui sd-checkbox" data-ui-component="" data-ui-checkbox-for={nativeProps.id || nativeProps.name || ''}
      onCheckedChange={value => {
        const input = native.current;
        input.checked = value === true;
        setChecked(input.checked);
        input.dispatchEvent(new Event('input', {bubbles: true}));
        input.dispatchEvent(new Event('change', {bubbles: true}));
      }}/>
  </span>;
}

// Keep the real select as the legacy form/value contract, with one Radix
// RadioGroup as its visible interaction owner. No duplicate named radio fields.
function NativeChoices({initial, nativeProps, options, html}) {
  const native = useRef(null), group = useRef(null);
  const [value,setValue] = useState(initial);
  const [disabled,setDisabled] = useState(Boolean(nativeProps.disabled));
  const [invalid,setInvalid] = useState(nativeProps['aria-invalid'] === 'true');
  const focusChoice = () => {
    const target = group.current?.querySelector('[data-state="checked"]:not(:disabled)') || group.current?.querySelector('[role="radio"]:not(:disabled)');
    target?.focus();
  };
  useEffect(() => {
    const select = native.current;
    const sync = () => {setValue(select.value);setDisabled(select.matches(':disabled'));setInvalid(select.getAttribute('aria-invalid') === 'true');};
    const reset = () => queueMicrotask(sync);
    const fields = [];
    for(let parent = select.parentElement;parent;parent=parent.parentElement)if(parent.tagName === 'FIELDSET')fields.push(parent);
    // Observe native attribute changes only; roots/nodes never remount on edits.
    const attributes = new MutationObserver(sync);
    attributes.observe(select,{attributes:true,attributeFilter:['disabled','required','aria-invalid']});
    fields.forEach(field => attributes.observe(field,{attributes:true,attributeFilter:['disabled']}));
    select.addEventListener('input',sync);select.addEventListener('change',sync);
    select.form?.addEventListener('reset',reset);sync();
    return () => {attributes.disconnect();select.removeEventListener('input',sync);select.removeEventListener('change',sync);select.form?.removeEventListener('reset',reset);};
  },[]);
  return <span className="sd-choice" data-ui-native="">
    <select {...nativeProps} ref={native} defaultValue={initial} data-slot="native-select"
      className={`sd-choice-native ${nativeProps.className || ''}`} tabIndex={-1} aria-hidden="true"
      onFocus={focusChoice} onInvalid={event=>{event.preventDefault();setInvalid(true);focusChoice();}}
      dangerouslySetInnerHTML={{__html:html}}/>
    <RadioGroup ref={group} className="sd-choice-group" value={value} disabled={disabled} loop
      aria-label={nativeProps['aria-label']} aria-labelledby={nativeProps['aria-labelledby']}
      aria-describedby={nativeProps['aria-describedby']} aria-required={nativeProps.required || undefined}
      aria-invalid={invalid || undefined} data-ui-choice-for={nativeProps.id || nativeProps.name || ''}
      onValueChange={next=>{
        const select = native.current;
        if(select.matches(':disabled') || select.value === next)return;
        select.value=next;setValue(next);setInvalid(false);
        select.dispatchEvent(new Event('input',{bubbles:true}));
        select.dispatchEvent(new Event('change',{bubbles:true}));
      }}>
      {options.map((option,index)=><RadioGroupItem key={`${option.value}-${index}`} value={option.value}
        className="sd-choice-item" disabled={option.disabled} aria-label={option.label}>
        <span className="sd-choice-label">{option.label}</span>
      </RadioGroupItem>)}
    </RadioGroup>
  </span>;
}

function selectLabel(node){
  const labels=[...(node.labels || [])];
  const fieldLabel=node.closest('.field')?.querySelector('label');
  if(!labels.length&&fieldLabel)labels.push(fieldLabel);
  return labels.map(label=>{const copy=label.cloneNode(true);copy.querySelectorAll('select,.select-chevron').forEach(child=>child.remove());return copy.textContent.trim();}).join(' ').replace(/\s+/g,' ') || node.title || '选择';
}

function componentFor(node) {
  const props = propsOf(node);
  const tag = node.tagName.toLowerCase();
  if (tag === 'button') {
    const variant = node.classList.contains('btn-danger') ? 'destructive' : node.classList.contains('btn-primary') ? 'default' : node.classList.contains('btn-soft') ? 'secondary' : 'ghost';
    return <Button {...props} variant={variant} className={`${props.className} h-auto whitespace-normal`} {...raw(node)}/>;
  }
  if (tag === 'input') {
    if (node.type === 'checkbox') {
      props.value = node.value;
      if (!props['aria-label'] && !props['aria-labelledby']) props['aria-label'] = [...(node.labels || [])].map(label => label.textContent.trim()).join(' ').replace(/\s+/g, ' ') || undefined;
      return <NativeCheckbox nativeProps={props} initial={node.checked}/>;
    }
    return <Input {...props} defaultValue={node.type === 'file' ? undefined : node.value}/>;
  }
  if (tag === 'textarea') return <Textarea {...props} defaultValue={node.value}/>;
  if (tag === 'select') {
    const selected = node.multiple ? [...node.selectedOptions].map(option => option.value) : node.value;
    // Multiple selects are already in-page lists, not dropdown popups. Preserve
    // their native multi-value contract (the application uses single selects).
    if(node.multiple)return <NativeSelect {...props} defaultValue={selected} {...raw(node)}/>;
    if(!props['aria-label']&&!props['aria-labelledby'])props['aria-label']=selectLabel(node);
    const options=[...node.options].map(option=>({value:option.value,label:option.label,disabled:option.disabled||option.parentElement?.disabled===true}));
    return <NativeChoices nativeProps={props} initial={selected} options={options} html={node.innerHTML}/>;
  }
  if (tag === 'label') return <Label {...props} {...raw(node)}/>;
  if (tag === 'table') return <Table {...props} {...raw(node)}/>;
  if (tag === 'hr') return <Separator {...props} decorative={!node.hasAttribute('aria-label')}/>;
  if (node.classList.contains('progress') || tag === 'progress') {
    const value = tag === 'progress' ? Number(node.value) / Number(node.max || 100) * 100 : Number.parseFloat(node.firstElementChild?.style.width || '0');
    return <Progress {...props} value={Math.max(0, Math.min(100, value))} aria-label={props['aria-label'] || '阶段进度'}/>;
  }
  if (node.classList.contains('skeleton')) return <Skeleton {...props} {...raw(node)}/>;
  if (node.matches('.badge,.status-chip,.history-status,.action-state')) return <Badge {...props} variant="outline" {...raw(node)}/>;
  if (node.matches('[role="alert"],.error-text')) return <Alert {...props} className={`${props.className} block p-0 border-0 shadow-none`} {...raw(node)}/>;
  return <Card {...props} as={tag} className={`${props.className} block gap-0 p-0`} {...raw(node)}/>;
}

const candidates = 'button,input:not([type="hidden"]):not([type="radio"]),textarea,select,label,table,hr,progress,.progress,.skeleton,.badge,.status-chip,.history-status,.action-state,[role="alert"],.error-text,.card,.auth-card,.action-archive-card';
const authored = '.overview-type-trigger,.overview-record-card,.header-brand,.daily-intro-title,.daily-prompt-heading';

function eligible(node) {
  return !node.hasAttribute('data-slot') && !node.hasAttribute('data-ui-component') &&
    !node.matches(authored) && !node.closest('[data-ui-native],[data-ui-skip]') &&
    !node.closest('.overview-reel-track');
}

export function enhanceUi(container) {
  if (!container) return;
  // Query afresh after every top-down replacement. Raw descendants inside Card
  // and Label are opaque to their parent root and receive independent islands.
  let node;
  while ((node = [...container.querySelectorAll(candidates)].find(eligible))) {
    const host = document.createElement('span');
    host.dataset.uiMount = '';
    host.className = 'sd-ui-host sd-surface';
    host.style.display = 'contents';
    const element = componentFor(node);
    node.replaceWith(host);
    mountComponent(host, element);
  }
}

export function renderMarkup(container, html) {
  if (!container) return;
  disposeUi(container);
  container.innerHTML = html;
  enhanceUi(container);
}
