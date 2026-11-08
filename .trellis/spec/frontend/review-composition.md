# Six-review composition

Applies to the daily and five extended review templates in `public/app.js` and their shared `public/styles.css`.

Six-review composition: `.daily-art-flow` uses a shared grid row for the active copy and its single inert artwork. `.daily-editor-content` groups heading, error, mounted panes and hint; `.daily-editor` keeps DOM ancestry/hidden semantics through `display:contents`, and its footer occupies a separate bottom row. Center the artwork against this group, never a fixed top offset or the entire viewport/footer. Preserve alternating sides and the common reading boundary. Intro copy/art move together through lower whitespace; phones show content first, centered smaller art next, footer last. Do not duplicate illustration trees, move React-owned controls, measure positions in JavaScript, or remount inputs when switching prompts. Check short action fields, tall text/calendar/locked afterwords, long quotes and 320/390/820/1100/1440/1920px widths; decorations must remain inert and within the viewport.

## Verification

Run `npm run check`, `npm run build` and the existing tests after a template change. Render real six-type intros and representative left/right short-input, long-text, paired, inline-calendar and locked-afterword screens. Desktop copy/art bounding-box centers should coincide; neither should intersect the footer. On phones content, art and footer must have non-overlapping rows with no horizontal overflow. Compare artwork pseudo-elements as well as image bounds. Keep a value while switching back/next, save/reload it, and verify locked textareas remain readonly and keyboard-scrollable while other mutating controls remain disabled.

Wrong: absolute `top:132px` or centering against viewport/footer leaves art disconnected from short or tall content. Correct: assign both art and `.daily-editor-content` to grid row2 with `align-self:center`; footer uses its own row. Preserve `.daily-editor[hidden]` display suppression when using `display:contents`.


All six review writing textareas (including action/paired contingency/metric/decision title/diary) use styles.css --review-writing-height:200px. Keep height/min/max equal, resize:none and overflow-y:auto. Do not add per-question heights or scrollHeight sizing; verify short and long values compute to the same height at desktop and phone widths. Completion afterword belongs to the actual last prompt, even when journal or all ordinary questions are removed, and exposes guarded history/actions navigation.
