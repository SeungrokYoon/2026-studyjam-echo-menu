# Frame analysis cadence bug fix

RequestFeedback: true

## Problem

The camera analysis loop starts a new `/api/analyze-frame` request every second. It does not wait for the previous request or for spoken guidance to finish. Because `speak()` cancels the active browser utterance before starting another one, rapid analysis-driven state changes can interrupt the preceding guidance.

## Proposed change

1. Add a named frame-analysis interval constant and increase the cadence from 1 second to 4 seconds.
2. Prevent a new frame request while the previous `/api/analyze-frame` request is still in flight.
3. Add a contributor image picker that accepts 1–10 menu-board images per submission and reports the selected count accessibly.
4. Validate the same image-count and payload limits on the server, then retain the uploaded images with the contribution record.
5. Keep the existing spatial-audio coordinate formula and multi-touch gesture mapping unchanged.
6. Update README and the frontend/backend architecture documentation so the documented behavior matches runtime behavior.
7. Redeploy the verified build to the existing Google Cloud Run `echo-menu-app` service and verify the live URL.

## Verification

1. Add a Playwright regression test that holds an analysis response open and proves that no second request starts concurrently.
2. Verify that analysis requests are spaced by the configured interval rather than every second.
3. Add Playwright coverage for a successful 10-image submission and rejection of an 11-image submission.
4. Run `pnpm typecheck`, the focused Playwright regression tests, `pnpm test:e2e`, and `pnpm build`.

## Approval gate

Approved by the user on 2026-07-16.
