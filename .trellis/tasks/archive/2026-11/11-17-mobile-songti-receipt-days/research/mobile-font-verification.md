# Mobile Songti verification

## Root cause and boundary

The previous fix restored CSS inheritance but no Chinese serif font binary was
present. Device-local names such as Songti SC, SimSun and Noto Serif SC therefore
did not establish that an Android browser could paint Chinese serif glyphs.

The fix supplies the actual Noto Serif SC variable WOFF2 subsets under the local
`assets/fonts/noto-serif-sc/` directory, aliased in CSS to `Shendu Songti`.
`mobile-ui.css` applies that face only at <=960px to semantic headings, review
intro text, the brand, menu labels and existing title-like Chinese elements.
Only `font-family` is changed; all existing font sizes, weights, line heights,
spacing, colors, desktop rules, arrows and behaviors are preserved.

## Source and validation

- Official Google Fonts CSS: `https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@200..900&display=swap`, upstream resource version `v36`.
- Original unmodified WOFF2 bytes and SIL OFL 1.1 are bundled locally, with URL,
  size and SHA-256 for every file in the asset manifest. No runtime external URLs
  remain in the localized stylesheet.
- All 101 WOFF2 files were decoded and parsed using FontTools 4.68.0 and Brotli
  1.2.1 installed only in ignored task-local inspection data. Actual `cmap` and
  `fvar` tables were read; the binary WOFF2 length header also matches each file.
- Total font binary size: 6,030,988 bytes. Actual cmap union: 13,666 characters,
  including 12,258 CJK Unified Ideographs. Weight axis: 200–900.
- All 84 different characters in the Chinese title/menu sample (six review
  types, overview motto, history, actions, finance, settings, account, backup,
  receipt and ledger actions) are present in actual glyph maps.
- Three initially truncated responses were detected by full WOFF2 decoding,
  re-downloaded, then all files were rechecked. File-signature checks alone
  would not have detected this problem.
- `git diff --check` passed.

Browser/device appearance and final build checks belong to the parent session.
Installed font names or a computed CSS family string alone are not sufficient
evidence of actual font loading.
