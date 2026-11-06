# Validation

Local `npm run check` and `npm test` passed (Vite production build and all 179 tests). Source changes only add native content wrappers and layout/cache revisions; no input IDs/order, render/bind logic, server, payload, date policy, assets, overview or deployment-script changes. No implementation-mirroring tests added for this layout change.

Rendered the real application through an isolated synthetic account/database at localhost ports3196/3197 using the supported in-app browser. Checked all six intros and first prompts at1440x900; all six intros at320x740; additional daily short action, left reflection, paired contingency, calendar and journal, weekly left phase, and monthly wide canvas at390/820/1100/1280/1920 widths. 37 geometry samples: no horizontal overflow or broken visible images, desktop art/content centers within0.008px. Phone copy starts before the illustration (intro top119px at320), with centered inert artwork and footer after content. Visual screenshots confirmed form/art separation and footer placement. Screenshot and geometry are ignored local QA artifacts under `shendu/tmp/composition-qa/`.

Entered sleep7.5, traversed next/back without losing it, saved/reloaded it; entered reflection/action/paired contingency and selected the date through the real calendar, saved/reloaded. Completed only the isolated daily fixture through its API and reopened it: original values and disabled read-only controls retained, save buttons absent. Weekly first two answers saved after crossing to the left-side phase. No production site/accounts/data accessed.

README and deployment recovery instructions checked against the current bootstrap, installer and updater: existing checkout is not fetched by bootstrap; explicit fast-forward before retry is necessary. `&&` stops before invoking an old installer if pull fails. Preserve configuration/data/master key/backups/Caddy volumes; running sites use the latest downloaded updater. No screenshots added to README and no deployment-time guarantee.

Remote CI, immutable image publication and anonymous download deployment smoke: pending source push.
