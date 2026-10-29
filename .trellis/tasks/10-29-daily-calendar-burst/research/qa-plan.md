# Focused QA

Baseline9dd4497 at1280×900: actual daily date card520×485.406px. Isolated3188 real SQLite fixture with synthetic current daily draft, original fields populated/date initially empty; no user data.

- After resize: measure desktop card width/height against baseline, inspect refinement visually and at390/320; day targets remain>=28px, current/selected/past/focus distinction clear.
- Pick day, today footer, next/previous month, Arrow/Page+Enter and save/reload; confirm no business-model changes, readonly and visible date error preserved.
- Inspect actual artwork bounds and native screenshot before pointer coordinates. Move into artwork through supported CUA native input, observe live particle animations/class and surrounding image. Source pointermove-only trigger distinguishes hover from click; no synthetic browser events or hidden state edits.
- Move to form/date controls and confirm no burst/hit interception; leave/re-enter retriggers once; stationary hover has no infinite loop. Prompt navigation clears active burst; saved reduceMotion and no-touch guards disable it. Verify left and right art scenes and narrow layout.
- Source review: default overviewBurst output remains identical, decorative DOM stays aria-hidden/nonfocusable/pointer-inert, fields/calendar/business functions and overview/reel unchanged. No new mirroring tests; syntax/existing21, audit delta/DESIGN lint.
- Refresh calendar screenshot; retain unchanged static daily views. README/docs/spec sync and exact-revision CI before finish-work.
