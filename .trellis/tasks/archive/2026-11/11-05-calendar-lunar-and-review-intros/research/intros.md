# Six review opening pools

## Implementation

- `shendu/public/review-intros.js` contains 12 distinct local openings per category (72 total). The content mixes concise original prose with public-domain classical excerpts; it has no fixed eight-character limit or remote content service.
- A category-specific shuffled bag is exhausted before reuse; the cycle boundary avoids repeating the previous selection. `enter(type)` selects a fresh accepted visit, while `current(type)` preserves its text across local redraws, saving and return to the intro.
- `app.js` selects inside the existing review navigator's `open` callback, after the unsaved/pending guard accepts navigation. Both daily and extended intros read through `quoteFor`; cancelled entries consume nothing. No record fields or payloads changed.
- Punctuation splitting preserves all text and punctuation at Chinese comma/full stop/question/exclamation/semicolon boundaries. Both intro templates use layout density and longest-phrase columns while retaining typewriter spans, accessible full text, Songti weight and category emphasis.
- Intro-scoped CSS keeps regular type at up to 80px and longer prose at up to 66px desktop/46px narrow, with a readable desktop minimum that permits phrase wrapping. Overview and writing canvases were not restyled.

## Validation

Passed locally:

```text
node --check public/app.js
node --check public/review-intros.js
node --test tests/review-intros.test.mjs tests/review-heading.test.mjs tests/review-navigation.test.mjs
13 tests, 13 passed
```

Tests cover six distinct pools, varied length, punctuation preservation, complete shuffled rounds, no immediate cross-round repetition, stable current text, actual guarded app entry binding and existing return navigation.

## Integration / browser follow-up

Parent owns cache versions, native syntax-check module list, docs/spec synchronization, production build and browser acceptance. Check longest prose and four-phrase classical openings on desktop and 320/390/820px, especially button visibility and illustration overlap. There are no image or content-service requests and no schema/save/verification-rule changes.
