## 1. Tests (TDD — write first)

- [ ] 1.1 Write test: single event fires after debounce window (not immediately)
- [ ] 1.2 Write test: burst of events within window fires callback exactly once
- [ ] 1.3 Write test: events separated by more than window fire independently (two callbacks)
- [ ] 1.4 Write test: dispose cancels pending debounce timer (no callback after dispose)
- [ ] 1.5 Confirm all new tests fail (red)

## 2. Implementation

- [ ] 2.1 Add optional `debounceMs` parameter (default 80) to `DataSource` constructor
- [ ] 2.2 Replace direct `for (const cb of this.callbacks) cb()` with debounce logic: `clearTimeout` + `setTimeout`
- [ ] 2.3 Store pending timer reference; clear it in `dispose()`
- [ ] 2.4 Confirm all tests pass (green)

## 3. Verify

- [ ] 3.1 Run full broadcaster test suite — no regressions
- [ ] 3.2 Run full server + web test suite — no regressions
