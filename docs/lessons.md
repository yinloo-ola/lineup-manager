# Lessons

Generic, repeatable rules distilled from mistakes caught during development.

- **Never hard-code calendar dates in test fixtures to mean "the future".** A "future" start date time-bombs into a past one and silently flips the behavior under test (the format freeze made an authoring page uneditable; found 2026-10-25 with `2026-09-01`). Compute relative dates at run time (`now + 30d`) and keep hard-coded dates only where the past/present is what the test means.
- **Parallel Playwright workers each run their own `beforeAll`.** Provisioning shared accounts (an umpire, a manager) inside a spec's `beforeAll` races across workers — one creates the auth user, the other hits `email_exists`. One-time provisioning belongs in `global-setup`, which runs once per run.
