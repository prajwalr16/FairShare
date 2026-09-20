# End-to-End Verification Matrix

| Area | Local verification | CI verification |
|---|---|---|
| Python compilation | Passed | Passed |
| Backend API tests | 19 passed, 1 intentional migration marker skip | PostgreSQL + SQLite jobs |
| All split types | Covered by API + split-calculator tests | Yes |
| Payer selection | Covered by API tests | Yes |
| Expense edit/delete | Covered by API tests | Yes |
| Balances/debts | Covered by API tests | Yes |
| Settlement create/edit/delete | Covered by API tests | Yes |
| Group roles/viewer restrictions | Covered by API tests | Yes |
| Currency lock | Covered by API tests | Yes |
| Invitation contract | Covered with mocked Supabase Admin API | Yes |
| Alembic revision chain | Passed | Fresh PostgreSQL migration + second upgrade |
| Mobile TS/TSX transpilation | 40 files passed | `tsc --noEmit` after npm install |
| Mobile local import resolution | Passed | npm install + TypeScript check |
| Expo runtime | Not available in this execution environment | Run in device/development workflow |
| Live Supabase Auth | Not called with production credentials | Requires deployment credentials/config |
