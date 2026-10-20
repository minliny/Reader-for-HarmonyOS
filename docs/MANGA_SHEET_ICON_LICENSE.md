# Manga sheet icon source and license

The manga reader sheet assets reuse the exact open-source icon components installed by the approved manga UI demo. No paths were drawn or edited by hand.

- Upstream package: `@radix-ui/react-icons@1.3.2`
- Package source: https://registry.npmjs.org/@radix-ui/react-icons/-/react-icons-1.3.2.tgz
- Locked npm integrity: `sha512-fyQIhGDhzfc9pK2kH6Pl9c4BDJGfMkPqkyIgYDthyNYoNg3wVhoJMMh19WS4Up/1KMPFVpNsT2q3WmXn2N1m6g==`
- Upstream package git head: `bde33b13aa5848555f5512ac12155930fb4beb7d`
- License: MIT, copyright (c) 2022 WorkOS
- Provenance: `evidence/2026-10-02-manga-ui-demo/package-lock.json` in the Reader workspace.
- Export method: `ReactDOMServer.renderToStaticMarkup(React.createElement(Icon, { color }))` using the installed demo dependencies.
- Modification: the upstream `color` prop supplies each fixed monochrome path fill; viewBox, paths, fill/clip rules, and geometry remain upstream output.
- Each file keeps the upstream `15 × 15` viewBox. The Harmony Image component sets the displayed size and selects a fixed-color SVG resource for the active theme/state; dynamic `Image.fillColor` is not used, following the project icon design contract.
- Choice controls: base muted `#756F69`, night muted `#ABA99F`, active `#FFFAF4`.
- Close/search: base muted `#756F69`, night muted `#ABA99F`.
- Locate/check and vertical sort accents: base accent `#425D45`, night accent `#B9CEB1`.
- Ordinary chapter disclosure uses upstream `ChevronRightIcon`, displayed at 13 vp, with base faint `#A39C90` / night faint `#767D71`. Volume group disclosure uses upstream `ChevronDownIcon`, displayed at 16 vp, with base muted `#756F69` / night muted `#ABA99F`. Collapse rotation is applied by the component and is not baked into the source paths.
- Trusted origin: `radix-component-derived`; these icons do not claim a Figma node or export.
- Canonical inputs: `docs/ui-design/svg-provenance/radix-icons/`, with upstream `#756F69` fill. `tools/svg-provenance.config.mjs` pins all ten source hashes, the package identity, and the full license hash; `tools/sync-svg-assets.mjs` permits only fixed fill recoloring with no path/viewBox mutation.
- Extraction receipt: `docs/ui-design/svg-provenance/radix-icons/SOURCE.json`, SHA-256 `4f2ef451772ca4bf6f3112be0c8d6ccf2dfb8f67548bbae4e337c2ca24958b22`. The receipt records the approved demo lock hash, installed upstream package code hashes, export method, and canonical source hashes. The two directory disclosure components were exported from the same installed package only after rechecking its recorded code and lock/license hashes; the original eight canonical inputs are unchanged.
- Upstream license input: `docs/ui-design/svg-provenance/radix-icons/LICENSE`, SHA-256 `0e80a2d229d2fd4fc7e8636142ec5d0ff0bc031f14c15b682e2ac01dfd5b5138`.

| Canonical source | SHA-256 |
| --- | --- |
| ViewVerticalIcon.svg | 8e684a111955015001600344eba570030dadac0211173dcf4fd474776c1c532a |
| ViewHorizontalIcon.svg | af807e15011aeec5f3d54ea141b21d475762892eb4d9c944a3a4b105a4a21712 |
| SunIcon.svg | ca6f9d89aca760da8f97d3130a6f9afaf851b78e161869858e71aae357f65fbb |
| MoonIcon.svg | 8f70f86ade7adcbc7eebc8248a9503c0c9982b88f3267363704497b8c6704b23 |
| Cross2Icon.svg | 1186d1a7398e930f758dfbe2e3c79b6dc80adc82389050a147058cf7b8cfc445 |
| MagnifyingGlassIcon.svg | 0b0ebc14abcd66b557be65cffa893381db6bfcfa382fb7fbb0006aa58e678500 |
| ReaderIcon.svg | f22fe12200f68f674c506f7557158e2df27c80af3e1304c3bf92e5e15621b613 |
| CheckIcon.svg | f63f6aa332d594e56bc30c76be129e1bbdd3caa53d62bffc74bb023cbead0daf |
| ChevronRightIcon.svg | 338fddda60c9c0fd042b1162be06373fe87d0f7414686e258a67a2c30dd9a34b |
| ChevronDownIcon.svg | 5a3b143885ce029882dc32d18350635b498d1b201bef641442902be27072a351 |

| Resource | Upstream component | Fixed fill | SHA-256 |
| --- | --- | --- | --- |
| manga_sheet_vertical.svg | ViewVerticalIcon | #756F69 | 8e684a111955015001600344eba570030dadac0211173dcf4fd474776c1c532a |
| manga_sheet_vertical_theme_night.svg | ViewVerticalIcon | #ABA99F | e62236c9681db93292a7d88dd9dab620f2b8c6c9c4b7a0d47e4e0d8bde315e96 |
| manga_sheet_vertical_active.svg | ViewVerticalIcon | #FFFAF4 | 57f1735dee86c5097d153de863ab33393fba132e5594a36f7b563ef65b09045f |
| manga_sheet_horizontal.svg | ViewHorizontalIcon | #756F69 | af807e15011aeec5f3d54ea141b21d475762892eb4d9c944a3a4b105a4a21712 |
| manga_sheet_horizontal_theme_night.svg | ViewHorizontalIcon | #ABA99F | 54f5e1fc01cae647ce489dfa589fd8722189c426cd8dc7073f7d9d44d63dbe07 |
| manga_sheet_horizontal_active.svg | ViewHorizontalIcon | #FFFAF4 | 86ee9dd5ec89c1ceb782583607a9fac0afc7e997ad1b492347c6daa4e86ce91e |
| manga_sheet_sun.svg | SunIcon | #756F69 | ca6f9d89aca760da8f97d3130a6f9afaf851b78e161869858e71aae357f65fbb |
| manga_sheet_sun_theme_night.svg | SunIcon | #ABA99F | e941d30640a56e91e0b74d42eaa3343beefe12183f5a27e1988bebb231e3a405 |
| manga_sheet_sun_active.svg | SunIcon | #FFFAF4 | cbfc9c262b7673d5d17beb38d9fdbef27fda1a0b81efca7989d8b137e88d73da |
| manga_sheet_moon.svg | MoonIcon | #756F69 | 8f70f86ade7adcbc7eebc8248a9503c0c9982b88f3267363704497b8c6704b23 |
| manga_sheet_moon_theme_night.svg | MoonIcon | #ABA99F | 3d288b4ae2d33df25f5a32ab4f4b20f8b5712d4030d3306fbf3a91707395dd3d |
| manga_sheet_moon_active.svg | MoonIcon | #FFFAF4 | c48c58ce94e6545c6f691411f1439184160fec90c78c118376ea756138160870 |
| manga_sheet_close.svg | Cross2Icon | #756F69 | 1186d1a7398e930f758dfbe2e3c79b6dc80adc82389050a147058cf7b8cfc445 |
| manga_sheet_close_theme_night.svg | Cross2Icon | #ABA99F | c8eec9dac2ed3c49eaa30fa4103e6132840d9d9c4132c907fd50019e371cddb5 |
| manga_sheet_search.svg | MagnifyingGlassIcon | #756F69 | 0b0ebc14abcd66b557be65cffa893381db6bfcfa382fb7fbb0006aa58e678500 |
| manga_sheet_search_theme_night.svg | MagnifyingGlassIcon | #ABA99F | 756b162f7a2569000841df2881fcde327078671c30d57e691c36c5532ac61069 |
| manga_sheet_locate.svg | ReaderIcon | #425D45 | c5503276138b388c10131eb3205dd20c944501b5c3a459b81ee4976224aaf947 |
| manga_sheet_locate_theme_night.svg | ReaderIcon | #B9CEB1 | e0da325fb496669a7a2c1aa9d2ef07a13746da59b0fccb90e0fa2bbd2a581604 |
| manga_sheet_check.svg | CheckIcon | #425D45 | 42da8e6725bb0b45bbe9e390948aab11b96a3bbe52497ae915e65b2d1c0e40d9 |
| manga_sheet_check_theme_night.svg | CheckIcon | #B9CEB1 | 3cc4edd6372e496c902f0f537936a80f46dda0b0e068b931a8ad92911b242623 |
| manga_sheet_chevron_right.svg | ChevronRightIcon | #A39C90 | 743a5ece653975345a829062205b48bf9afb3df013053e6613cf0e82ca3f03e1 |
| manga_sheet_chevron_right_theme_night.svg | ChevronRightIcon | #767D71 | 7988cc59a0468e898c01b87e738aa264d634d4c1e789fb2b1bf43f32461e5ac1 |
| manga_sheet_chevron_down.svg | ChevronDownIcon | #756F69 | 5a3b143885ce029882dc32d18350635b498d1b201bef641442902be27072a351 |
| manga_sheet_chevron_down_theme_night.svg | ChevronDownIcon | #ABA99F | 4788d8df55cf61c17a191d3da5d0e0addf5e8deee055cc033eb13d636d647c8d |

## Upstream license (verbatim)

```text
MIT License

Copyright (c) 2022 WorkOS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
