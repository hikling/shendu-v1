# Mobile Chinese Songti

These are the unmodified WOFF2 variable subsets of **Noto Serif SC**, served by
Google Fonts as version `v36`, downloaded on 2026-11-17. The font is licensed
under the SIL Open Font License 1.1 in [OFL.txt](./OFL.txt).

- Official CSS: <https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@200..900&display=swap>
- Upstream source and license: <https://github.com/google/fonts/tree/main/ofl/notoserifsc>
- Binary origin: `https://fonts.gstatic.com/s/notoserifsc/v36/`.
- All 101 upstream WOFF2 subsets are retained (6,030,988 bytes in total), rather
  than restricting text to a fixed list of current titles. Their original
  Unicode ranges and variable weight range 200–900 remain in `songti-v1.css`.
- `manifest.json` records each original URL, local filename, size and SHA-256.
  Font binary bytes are unchanged. Only the CSS family alias (`Shendu Songti`)
  and URLs are localized to keep this use independent of installed fonts.

`mobile-ui.css` imports this stylesheet only for widths at or below 960px.
Browsers request the Unicode subsets needed by visible headings, cache them
normally and make no runtime requests to Google. Desktop heading families are
unchanged. Do not add a preload for the full set of Chinese subsets.
