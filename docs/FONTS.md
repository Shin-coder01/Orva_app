# Orva Fonts

Orva uses Noto Sans for English and Noto Sans Tamil for Tamil. Only these four static weights are loaded for each language:

| Weight | English | Tamil | Use |
| --- | --- | --- | --- |
| 400 | Regular | Regular | Body and input text |
| 500 | Medium | Medium | Labels and less-emphasized controls |
| 600 | SemiBold | SemiBold | Section titles and controls |
| 700 | Bold | Bold | Headings and brand text |

`App.tsx` imports each weight through its package subpath. Keep these specific imports rather than importing a package root: the root exports all styles, including unused weights and English italics, which would add their font assets to the export. Typography names and language mappings remain in `src/theme/typography.ts`.

The complete copyright and SIL Open Font License 1.1 notices copied from the installed font packages are in `docs/licenses/NotoSans-LICENSE_FONT.txt` and `docs/licenses/NotoSansTamil-LICENSE_FONT.txt`. Include both notices in release materials when distributing the fonts.

## Android Export Measurement

Measured with `npx expo export --platform android` by matching exported asset SHA-256 hashes against the installed package fonts. The figures cover raw font assets, not the complete APK or compressed download size.

| Export | Font assets | Raw font bytes | All exported assets | All asset bytes |
| --- | ---: | ---: | ---: | ---: |
| Before per-weight imports | 27 | 12,178,516 | 44 | 12,184,815 |
| After per-weight imports | 8 | 2,838,620 | 25 | 2,844,919 |

The export contains 19 fewer assets and 9,339,896 fewer raw asset bytes (about 8.91 MiB, or 76.7%). Font assets were identified by SHA-256 matching against the installed package files. The before measurement is the existing `dist/assets`; the after measurement is `.expo/font-optimization-export/assets`. These are asset-payload measurements only, not APK or Play Store download sizes.
