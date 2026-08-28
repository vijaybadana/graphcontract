# Design QA — compact collapsed panels

- Source visual truth: `/var/folders/hh/qw3l1bs51wgd0w27wj5k3kcm0000gn/T/TemporaryItems/NSIRD_screencaptureui_zew1xh/Screenshot 2026-08-28 at 8.17.38 PM.png`
- Implementation capture: `/var/folders/hh/qw3l1bs51wgd0w27wj5k3kcm0000gn/T/graphcontract-compact-panel-triggers.png`
- Viewport: 1440 × 900 CSS pixels at device scale 1
- State: both side panels collapsed
- Comparison: the source showed full-height collapsed rails; the implementation replaces them with 38.4 × 38.4 pixel floating square controls at x=12 (left) and x=1389.6 (right). The React Flow application expands to the full 1440-pixel viewport width.
- Focused region: top-left and top-right canvas corners; no additional crop was required because both controls are clearly visible in the full-view capture.

## Findings

- No actionable P0, P1, or P2 differences remain for the requested change.
- Typography, colors, canvas content, and panel styling remain unchanged.
- Directional carets use the project icon component and preserve accessible button labels.

## Interaction verification

- Collapsed both panels and confirmed the large rails disappear.
- Expanded both panels and confirmed the palette and inspector return.
- Confirmed collapsing and expanding panels preserves the existing React Flow viewport.
- Clean-session viewport matrix remained `matrix(0.439759, 0, 0, 0.439759, 77.1084, 237.012)` before collapse, while collapsed, and after expansion.
- Confirmed no browser console warnings or errors during the sequence.

## Comparison history

- Earlier P2: collapsed panels remained full-height and reserved canvas width.
- Fix: replaced each collapsed rail with an absolutely positioned square expand control inside the canvas container.
- Post-fix evidence: full-width canvas with two compact corner controls; both controls restore their respective panels.
- Earlier P2: panel visibility changes triggered an automatic `fitView()`, changing graph zoom and position.
- Fix: viewport fitting now responds only to explicit Fit actions and structural graph revisions, not container width changes.

final result: passed
