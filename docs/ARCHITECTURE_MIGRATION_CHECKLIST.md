# Architecture Migration Checklist

1. Full codebase audit — complete.
2. FastAPI architecture — complete.
3. SQLAlchemy models/repositories — complete.
4. Alembic migration system — complete.
5. Supabase Auth integration — complete.
6. Groups/members APIs — complete.
7. Expenses/splits APIs — complete.
8. Balances/debts/settlements APIs — complete.
9. Group roles/permissions — complete.
10. Currency handling — complete for single group base currency; per-expense multi-currency remains a future feature.
11. Mobile API migration — complete for application data operations.
12. Obsolete direct Supabase business-data access — removed from mobile; legacy database functions are retained but client-facing execution privileges are revoked by migration.
13. End-to-end testing — application tests and static checks complete; fresh PostgreSQL migration/API execution is configured in CI because a live PostgreSQL server is not available in the packaging environment.
