# Supabase integration

Supabase is retained as the current PostgreSQL and authentication provider.

`functions/invite-group-member` is retained for backwards compatibility with the already-deployed prototype function. The refactored mobile application does not invoke it. The canonical invitation flow is the FastAPI endpoint `POST /api/v1/groups/{group_id}/members/invite`, which calls the Supabase Auth admin API server-side and writes application data through SQLAlchemy.

Do not put Supabase secret/service-role credentials in the mobile project.
