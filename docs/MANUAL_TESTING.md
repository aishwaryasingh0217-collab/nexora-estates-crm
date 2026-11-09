# Manual testing environment

The testing environment is a separate copy of the CRM on its own database. It has accounts for every role and 50 fictional leads. You run every test yourself and record the result in the **Testing Center**. Nothing in it runs a business workflow for you or marks a test as passed.

## 1. Set it up (once)

```bash
npm install
node scripts/testenv.js init      # creates .env.testenv from .env: database <DB_NAME>_testing, port 5050
npm run testenv:setup             # creates the test database, runs migrations, loads the test data
npm run testenv:start             # http://localhost:5050
```

- `.env.testenv` is private and ignored by git. Edit it if the test database needs a different name, user or port. Setup refuses to run when it points at the same database as `.env`.
- Setup also refuses a database that already holds real (non-test) data.
- Setup marks the company as `environment = TEST`. That turns on the Testing Center and the amber "TESTING ENVIRONMENT" banner. It also loads the 94-case checklist.
- Booking rule in the test environment: a booking needs approval only when its discount is above 2%.

## 2. What is loaded

| Data | Count | Where to see it |
|---|---|---|
| Test accounts (one per role, plus a second telecaller, field agent and partner) | 15 | Testing Center → Test accounts · [`docs/test-data/test_accounts.csv`](test-data/test_accounts.csv) |
| Test leads `TL-01` … `TL-50`, each with a scenario | 50 | Testing Center → Test leads · [`docs/test-data/test_leads.csv`](test-data/test_leads.csv) |
| Projects (Aurora, Cedar, Meridian), towers, 30 units, 2 partner firms, 2 campaigns | 40 | [`docs/test-data/test_records.csv`](test-data/test_records.csv) |
| Site visits in different states (assigned, scheduled, completed, missed, cancelled, requested) | 16 | Sales manager → Site visits |

- All accounts share the password **`Test@Nexora2026`**, unless you set `TEST_ACCOUNT_PASSWORD` in `.env.testenv` before setup.
- Every record is marked as test data: a `TEST` badge, names ending in `[TEST]`, emails on `example.test`, and phone numbers in the `555…` series. No real person can be called or messaged from this data.
- No bookings or payments are loaded. You create them during the workflow tests.
- The CSVs in `docs/test-data/` are generated from the definitions by `node database/test_env/write_reference_csv.js`. To get the data as it currently is in your test database, run `npm run testenv:export`; it writes to `test-env-output/`.

## 3. How to test

1. Sign in at `http://localhost:5050/#/login` with any test account.
2. Open the **Testing Center**:
   - Business-suite roles: use the portal switcher, or the avatar menu → Testing Center.
   - Telecallers, field agents and partners: open the workspace menu → Testing Center.
3. Open **Checklist**. Each case shows:
   - Test ID, portal, role and the account to sign in with
   - the page to start from and the exact steps
   - the test data to use
   - the expected result and where to verify it
4. Use one private window or browser profile per account. That way two roles can work side by side, for example a telecaller booking while the manager approves.
5. Record the result:
   - **Pass**, **Fail** or **Blocked**. Fail and Blocked need a description of what actually happened.
   - Attach screenshots: choose a file, drop it in, or paste with Ctrl/⌘ + V.
   - Use **Report a bug** for anything wrong. A bug can carry its own screenshots and is linked to the case.
6. To check who was notified and what changed, use **Notifications sent** (every notification in the environment, by recipient) and **Activity history** (the audit trail).
7. **Export results (CSV)** downloads every case with its status, actual result, remarks, tester and evidence count.

Cases that need an external service say so in their test data:
- Cloud telephony needs an Exotel account (see [TELEPHONY.md](TELEPHONY.md)).
- AI features need `ANTHROPIC_API_KEY` (see [AI_ASSISTANT.md](AI_ASSISTANT.md)).

When the service isn't configured, mark those cases **Blocked**.

Time-based checks run every 5 minutes on the server: overdue follow-up escalations, untouched leads, visit reminders and lapsed reservations. Some cases (SM-05, WF-08) ask you to wait for them.

## 4. Reset and clean up

```bash
npm run testenv:status            # what is in the test database
npm run testenv:reset             # remove test data and load a fresh copy (recorded results are kept)
npm run testenv:cleanup           # remove all test data (results and audit history kept)
node scripts/testenv.js cleanup --results   # also clear recorded results, evidence and bug reports
```

- The audit history is never deleted.
- When the checklist file (`backend/testing/testCases.js`) changes, the cases are updated on the next start. A case you already ran keeps its result, plus a note asking you to re-run it.
