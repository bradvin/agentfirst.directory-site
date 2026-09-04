# Homepage layout sketches

These are disposable layout explorations, not production components. All three keep the current visual system and use the same six records from the live API so the comparison is about hierarchy and layout rather than richer content.

## Head-to-head

| Dimension | Search-first editorial | Guided split | Directory workspace |
|---|---|---|---|
| Primary audience | Visitors with an existing need | First-time visitors | Repeat and power users |
| First action | Search or choose category | Choose a job/capability | Search or filter |
| Desktop density | Medium-high | Medium | High |
| Editorial explanation | Medium | High | Low |
| Taxonomy visibility | Medium | Low-medium | High |
| Mobile complexity | Low | Medium | Medium |
| Best quality | Most balanced | Best onboarding | Best at scale |
| Main risk | May feel conventional | Task labels can become subjective | May feel too much like admin UI |

## Recommendation

Start with **Search-first editorial**. It fixes the current hierarchy problem without changing the site's character or forcing a new task taxonomy. Borrow the sticky/filter density from **Directory workspace** only if the directory grows well beyond 38 tools.

## Screenshots

### Search-first editorial

- [Desktop](screenshots/search-first-editorial-desktop.png)
- [Mobile](screenshots/search-first-editorial-mobile.png)

### Guided split

- [Desktop](screenshots/guided-split-desktop.png)
- [Mobile](screenshots/guided-split-mobile.png)

### Directory workspace

- [Desktop](screenshots/directory-workspace-desktop.png)
- [Mobile](screenshots/directory-workspace-mobile.png)

## Verification

The three sketches were rendered in Chromium at 1440×1000 and 390×844. Each passed:

- no root horizontal overflow;
- six clickable real tool records;
- search interaction with exactly one result for `Pixel`;
- correct singular result feedback;
- no captured JavaScript page errors;
- zero automated axe-core accessibility violations in either viewport;
- responsive handling for the longest tool name and longest description in the 38-record live dataset;
- mobile category drawer open/close behavior in Directory workspace.

Machine-readable results: [screenshots/verification.json](screenshots/verification.json).

## Open locally

```bash
xdg-open sketches/001-search-first-editorial/index.html
xdg-open sketches/001-guided-split/index.html
xdg-open sketches/001-directory-workspace/index.html
```
