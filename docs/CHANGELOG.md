# Changelog

## Production architecture baseline

- Added FastAPI application layer.
- Added SQLAlchemy models, repositories and services.
- Added Alembic canonical migration chain.
- Added Supabase access-token verification at the API boundary.
- Migrated mobile application data operations to REST APIs.
- Preserved Supabase Auth in the mobile client for authentication/session flows.
- Added categorized Group Details tabs: Overview, Expenses, Balances, Members and Activity.
- Added PostgreSQL migration and API integration job to GitHub Actions.
- Fixed invitation app-user upsert, member repository name collision and expense-update title validation.
- Removed deprecated React Native SafeAreaView usage from authentication screens.
