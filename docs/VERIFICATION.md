# Completion verification

Verified locally on 24 September 2026 with Node 26.0.0, npm 11.12.1, and Chromium. CI is configured for Node 22.

| Requirement                                         | Evidence                                                                                                                                                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React, TypeScript, Vite; complete local application | Typed source, locked dependencies, successful production build; E2E suite uses the built app, not the development server.                                                                                                                                     |
| Responsive control room                             | SVG city, four metrics, grid charts, event stream, response desk, hospitals, and timeline; screenshot tests verify no page overflow at 320, 390, 768, 1024, and 1920 pixels.                                                                                  |
| Deterministic step engine                           | `engine.test.ts` verifies repeated histories, seed variation, deterministic prefixes, input immutability, and snapshot independence.                                                                                                                          |
| Connected infrastructure                            | Rule tests cover grid cascade thresholds, district outages, road effects, hospital reserves, loss of power, warnings, and bounded metrics. Exact formulas are in the README and assumptions are available in the app Guide.                                   |
| Start, pause, reset, speed, replay                  | Main Chromium journey advances, changes speed, starts, pauses, seeks backward/forward, and resets.                                                                                                                                                            |
| Three real interventions                            | Unit tests verify timed repair and cascade prevention, road relief and hospital access, shelter growth and hospital demand; E2E dispatches all three and observes visible effects.                                                                            |
| Three distinct presets                              | Parameterized unit tests and browser preset switching; all four bundled JSON sample files validate and simulate successfully.                                                                                                                                 |
| Intervention comparison                             | Baseline and response run with the same seed; browser journey verifies projected grid coverage changes from 0% without a response to 100% with an early repair.                                                                                               |
| Sharing and import/export                           | JSON and URL unit round-trips; browser exports a file, reloads its shared link, resets, and imports the downloaded file. Malformed data is rejected without destroying the current plan.                                                                      |
| Extension documentation                             | `CONTRIBUTING.md` gives complete recipes for adding scenarios and event types, including examples and tests.                                                                                                                                                  |
| Accessible controls                                 | Keyboard activation of SVG assets, labeled controls, native modal dialogs, reduced motion, mobile asset selector; Axe scans pass on desktop, mobile, restoration dialog, and comparison.                                                                      |
| No external runtime dependency                      | Production E2E records zero third-party requests, disconnects the browser network, and verifies intervention, replay, and comparison continue to work.                                                                                                        |
| Product completeness                                | All controls have implemented behavior; import status, validation errors, resource constraints, no-decision empty state, and completed replay state are implemented. No TODO-only features remain.                                                            |
| Browser and visual review                           | Running app inspected in the in-app browser; dispatched restoration manually. Desktop, comparison, and mobile PNGs generated from the production app and reviewed. Fixed accessibility naming, overlapping map labels, and screenshot scroll/focus artifacts. |
| GitHub deliverables                                 | Source, lockfile, README with screenshots, MIT license, samples, CI workflow, contributor guide, and manual GitHub Pages workflow and instructions.                                                                                                           |

Passing commands:

```sh
npm run lint
npm run format:check
npm test                 # 40 tests across 3 files
npm run build
npm run test:e2e         # 6 Chromium tests; includes its own production build
```

`git diff --check` also passed. The E2E suite regenerates the three README screenshots.

Limitations: fictional and uncalibrated rules; six-hour horizon; fixed city topology; no automatic persistence or cross-version replay guarantee. Save via URL or JSON. Automated browser coverage uses Chromium; Axe checks are not a universal accessibility certification. Source workflows have been supplied, but GitHub-hosted CI and Pages deployment require pushing the repository and enabling Pages; no remote publication is claimed.
