# Design boundary

The gap lives in shared styles: artwork uses absolute top offsets while writing content changes height. Use a shared grid row for the active writing group and illustration. A native editor-content wrapper groups heading, mounted panes, errors and hints; display:contents on the editor preserves its DOM ancestry and hidden state while the full-width footer occupies a separate grid row. Nothing React-owned is moved or remounted during navigation. Intro stays in the same content row with more lower whitespace, moving its copy and art upward together. Phones put intro/content before smaller centered artwork, then footer.

Only app.js template wrappers, shared review styles, index asset revisions, docs and the frontend layout contract change. Preserve control IDs, order, inputs, scene datasets and render/bind code. No server, image, palette, poem, overview, deployment-script or data changes. Rollback is the source commit; no migration.

Existing bootstrap intentionally does not update reused clones. Document fetching main before rerunning the installer for an interrupted old build; running sites use the latest downloaded updater. Do not erase local edits or data.
