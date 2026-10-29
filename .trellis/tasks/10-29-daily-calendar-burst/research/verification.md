# Verification

## Rendered browser acceptance

Real isolated SQLite service on127.0.0.1:3188 with synthetic records only. CUA browser at1280×900,390×844 and320×760; no user records or settings changed.

- Desktop date card352×351px versus baseline520×485.406px. Centered Songti month, round selected days, today outline/dot and quiet footer are legible in the actual screenshot. Card is335×347px at390 and272×347px at320; document has no horizontal overflow. Actual date target remains32×32px at320.
- Next month displays November; Today returns to October and explicitly selects today. ArrowRight then native Enter selects October30. Saving reports success, and the real test API confirms persisted verifyDate2026-10-30. After October31 selection an injected503 shows content-retained/retry status; retry succeeds. Re-entering the daily flow preserves the saved draft. An already-verified historical daily record retains its original selected date, with all34calendar controls disabled and none enabled.
- Native pointer positioning into the right calendar illustration produces16visible outward particles/ring. CSS reports0.9s and1iteration; after finishing the decoration is transparent. Leaving clears activation; reentry replays. Artwork remains pointer-events:none and the clean saved status remains unchanged. A date button receives the hit and does not trigger particles. The02left illustration also activates inside its own bounds; switching to cause clears activation.
- Via the synthetic account's actual theme UI, saved reduce-motion hides the burst and pointer entry does not activate it. The preference was restored. System reduce-motion, touch/coarse pointer, dragging and listener disposal were checked in source/stub tests, not claimed as native OS/touch emulation.
- docs/daily-calendar.png and docs/daily-art-burst.png are actual unretouched browser captures, converted JPEG-to-PNG only. The latter captures the short effect in flight.

## Quality and scope

- Independent trellis-check reviewed the entire diff; no actionable findings or source corrections. See source-review.md.
- npm run check PASS; existing daily-flow12 + daily-calendar9 PASS21/21. No API/storage/schema code changed, so focused local tests are appropriate; published CI runs the full suite.
- Actual extracted source equivalence/guard smokes PASS:18critical functions,5calendar templates, default overview particle markup, entry/reentry, controls/touch/drag/motion guards and listener cleanup. These are supplementary source checks, not browser substitutes.
- Premium strict audit remains17pre-existing findings, zero added by file/rule/message comparison; this is a delta check, not a clean strict-audit claim. DESIGN lint has0errors,7existing warnings and1informational result. git diff --check PASS.
- Overview layout/reel/category art, other five forms, daily model/business rules and illustration assets unchanged. README, DESIGN, UX contract and frontend specs synchronized.

## Publication

Work commit and exact-revision CI recorded after publication, before archive.
