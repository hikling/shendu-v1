# Bug analysis: repeated mobile Songti fallback

## Cause

Implicit device-font assumption and a validation gap. The previous change removed a mobile sans-serif override and verified inheritance. It did not provide a Chinese serif binary, so a phone without Songti/SimSun/Noto Serif SC could still paint a Chinese sans-serif fallback. Static style assertions were insufficient evidence for actual glyph rendering.

## Correction and prevention

- Bundle licensed local CJK WOFF2 subsets and apply a distinct family to mobile titles/menu only. Preserve desktop fonts and heading geometry.
- Decode font files and inspect actual cmap/weight axes. Magic bytes alone miss truncated WOFF2 responses; all repaired downloads are hash-bound in the manifest.
- Verify real phone-width heading/menu appearance and desktop computed-family isolation, plus actual HTTP resource delivery.
- Updated frontend UI-quality and component guidelines, README and font provenance. This repository has no generated spec-template copy to synchronize.
