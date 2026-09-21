# FairShare — Full Project Handoff / New-Chat Source of Truth

## 0. Read this first

This document is a detailed handoff for continuing the FairShare project in a new ChatGPT conversation without rebuilding the project context from zero.

Primary source used for this handoff:
- `FairShareLatest.zip` — the complete project archive supplied in the conversation.

The archive was unpacked and audited as a project-level codebase. Generated/dependency artifacts such as `backend/.venv`, caches, and installed package directories are not treated as application source. The archive contains 135 non-generated project files counted in the audit set, including approximately 27,626 lines across source, tests, migrations, documentation, configuration, and other text assets. The mobile `package-lock.json` is included in that count but is dependency metadata, not application logic.

IMPORTANT:
- Architecture work is intentionally being done on a `dev` branch. Do NOT reinterpret that as an accidental branch.
- The current architecture is the new FastAPI + SQLAlchemy + Alembic architecture.
- The old direct-Supabase/PostgREST application architecture is legacy/history and must not be reintroduced merely to recover performance.
- The next priority is performance of the new architecture, especially Group Details first load.
- Maps are NOT implemented in the current archive.
- Password reset deep-link behavior is NOT confirmed fixed in the current runtime; the code contains a recovery implementation, but previous device testing still returned to the last-opened Expo screen instead of opening Reset Password reliably.
- Do not claim that the documentation's old test-pass numbers represent the current ZIP without rerunning the tests. The current ZIP has test/documentation drift described later.

The user wants a production-oriented implementation, one sprint at a time, with complete replacement files rather than placeholder patches. Every future ZIP release is expected to be checked for complete implementations, valid imports/routes/dependencies, preserved working features, ordered migrations, safe RLS/data access, and explicit testing instructions before it is offered for download.

---

# 1. Product identity and product intent

## 1.1 Product

Name: **FairShare**

Tagline used in the project: **Split expenses. Share memories.**

Primary product purpose:
FairShare is a group expense-sharing mobile application, with trips/events as an important use case. Users can create groups, add members, record expenses, split them in different ways, calculate balances/debts, settle money owed, manage group roles/settings, and review historical activity.

The application is intended to become more than a basic Splitwise clone. The existing roadmap and prior project direction include trip/journey capabilities, multi-currency support, receipts, and map/route functionality.

## 1.2 Product priorities currently known

The current immediate product concern is not a missing financial feature. It is responsiveness.

The user specifically observed that under the new architecture a Group Details screen can take roughly 9–10 seconds before it is usable, whereas the previous architecture felt much faster. The explicit target is a quick, almost instantaneous user experience — a visible response in a fraction of a second or as close to that as the architecture permits — without reverting to insecure direct client database access.

Therefore:

**Sprint 6.0 should be performance-first.**

The goal is to make the current architecture feel as fast as the old architecture by removing duplicated network/auth/database work, reducing the initial payload, and using cache-first/background-refresh behavior.

---

# 2. Current high-level architecture

The current architecture is:

```text
React Native / Expo mobile app
        |
        | Supabase Auth session / bearer access token
        v
FastAPI HTTP API (/api/v1)
        |
        +--> Authentication / authorization
        |
        +--> Service layer (business rules)
        |
        +--> Repository layer (database queries)
        |
        v
SQLAlchemy ORM / sessions
        |
        v
PostgreSQL database

Supabase currently remains responsible for:
- Authentication
- PostgreSQL infrastructure / database hosting

Mobile app is intended to use the FastAPI API for application data/business operations.
```

The architecture documentation in the archive explicitly describes the mobile layer as responsible for presentation/navigation/form UX and optimistic/local calculations, FastAPI as the authenticated API/business-rule boundary, SQLAlchemy as the ORM/query layer, Alembic as schema migration management, Supabase Auth for identity, and PostgreSQL as the database/release contract.

## 2.1 Why the architecture was changed

The architecture was changed to prevent the mobile client from directly performing arbitrary database operations through legacy Supabase/PostgREST paths.

The new boundary is:

```text
Mobile -> FastAPI -> SQLAlchemy -> PostgreSQL
```

rather than:

```text
Mobile -> Supabase PostgREST / legacy RPC -> PostgreSQL
```

The new architecture is the one to optimize and finish.

---

# 3. Current repository structure

The important application structure in the ZIP is:

```text
FairShare/
├── .github/workflows/ci.yml
├── README.md
├── backend/
│   ├── .env.example
│   ├── README.md
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       ├── 0001_initial_schema.py
│   │       ├── 0002_revoke_legacy_postgrest_api.py
│   │       └── 0003_categories_and_api_db_context.py
│   ├── app/
│   │   ├── api/routes.py
│   │   ├── core/config.py
│   │   ├── core/database.py
│   │   ├── core/security.py
│   │   ├── main.py
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── schemas/
│   │   └── services/
│   ├── requirements.txt
│   └── tests/
├── database/
│   ├── README.md
│   └── legacy/
│       └── 001_init.sql ... 017_fix_roles_and_currency.sql
├── docs/
│   ├── ARCHITECTURE.md
│   ├── ARCHITECTURE_MIGRATION_CHECKLIST.md
│   ├── BLUEPRINT.md
│   ├── CHANGELOG.md
│   ├── END_TO_END_TESTING.md
│   ├── PROJECT_STATUS.md
│   ├── ROADMAP.md
│   └── SPRINT1.md
├── mobile/
│   ├── App.tsx
│   ├── app.json
│   ├── index.ts
│   ├── package.json
│   ├── package-lock.json
│   └── src/
│       ├── components/
│       ├── config/
│       ├── constants/
│       ├── navigation/
│       ├── screens/
│       ├── services/
│       ├── theme/
│       └── utils/
└── supabase/
    ├── README.md
    └── functions/invite-group-member/index.ts
```

`database/legacy/` is historical SQL. The canonical schema path in the current architecture is Alembic under `backend/alembic/versions/`.

---

# 4. Runtime stack and versions represented in the archive

## Mobile

- Expo SDK: approximately `57.0.24` as declared in `mobile/package.json`
- React: `19.2.3`
- React Native: `0.86.3`
- React Navigation 7
- `@supabase/supabase-js`
- AsyncStorage
- Expo Linking
- React Native Safe Area Context
- React Native Screens
- React Native Gesture Handler
- React Native Reanimated
- TypeScript

## Backend

- FastAPI
- Uvicorn
- SQLAlchemy
- PostgreSQL via psycopg
- Alembic
- Pydantic/Pydantic Settings
- httpx
- pytest

## Local environment choices already made during the project

- Node.js was moved to Node 22.22.0.
- npm is 10.9.4.
- Python 3.12.0 is the chosen backend Python version.
- Expo Go is used for device testing.
- Typical mobile launch command used by the project workflow:

```bash
npx expo start --clear
```

- Backend development is run with Uvicorn and the API has been tested locally on `127.0.0.1:8000`.
- A physical Expo device must reach the FastAPI service over the LAN, so `EXPO_PUBLIC_API_URL` must point at the machine's reachable LAN IP rather than `127.0.0.1` when testing from a phone.

---

# 5. Environment and secrets

The mobile app uses environment variables for:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
EXPO_PUBLIC_API_URL
```

The backend uses environment configuration for database and Supabase credentials.

The mobile Supabase publishable key is expected to exist in client configuration; server-only secrets must not be placed in mobile source or committed to Git.

The current architecture's security intent is:

- mobile receives a Supabase Auth access token
- mobile sends it as `Authorization: Bearer ...` to FastAPI
- FastAPI verifies/accepts the token and determines the current user
- database access happens on the server
- authorization is enforced server-side

Do not weaken this boundary to recover speed.

---

# 6. Authentication architecture and end-to-end flows

## 6.1 Supabase client setup

File: `mobile/src/config/supabase.ts`

The client is configured with AsyncStorage, persistent sessions, automatic token refresh, and `detectSessionInUrl: false`.

That means mobile owns the local authenticated session, while the server remains the data/API authority.

## 6.2 API authentication path

File: `mobile/src/services/apiClient.ts`

For every API request:

1. `assertApiConfigured()` gets the API base URL.
2. `supabase.auth.getSession()` is called.
3. The current access token is extracted.
4. The request is sent to FastAPI.
5. `Authorization: Bearer <access_token>` is added.
6. FastAPI processes the request.

Important performance implication:
Every API call currently asks Supabase client storage for the session, and every API call subsequently reaches FastAPI's authentication dependency.

## 6.3 FastAPI authentication path

File: `backend/app/core/security.py`

The current server-side path is approximately:

```text
Authorization header
 -> validate Bearer scheme
 -> extract access token
 -> call Supabase /auth/v1/user over HTTP
 -> construct CurrentUser
 -> look up/create local User row
 -> set database request user context
 -> route/service logic
```

The archive's current `get_current_user()` implementation uses synchronous `httpx` to call Supabase's Auth user endpoint. The timeout is configurable and defaults to 10 seconds.

This is one of the most important performance hotspots in the new architecture because multiple API calls made at the same time each repeat the remote Supabase user verification path.

## 6.4 Local User synchronization

The security layer contains `ensure_user` behavior that looks up the authenticated user in the local database and may insert/commit/refresh the user record.

For read-only calls, this can still introduce transaction/database work on every request.

Optimization target:

- avoid an unnecessary write/commit for an existing user
- avoid repeated work when the user is already known for the request
- eventually consider a secure cached/local JWT verification approach instead of a remote Supabase user lookup for every API call, after carefully preserving security

## 6.5 Sign-up flow

Mobile screen: `SignUpScreen`

Flow:

```text
Welcome
 -> Sign Up
 -> enter name/email/password/confirm password
 -> validate fields
 -> authService.signUp(...)
 -> Supabase creates/authenticates the account flow
 -> user receives verification email
 -> user can then log in
```

The application has real email/password authentication rather than a fake local login.

## 6.6 Login flow

Mobile screen: `LoginScreen`

Flow:

```text
Login screen
 -> email/password validation
 -> authService.signInWithPassword
 -> Supabase creates active session
 -> navigation stack resets to Home
```

Password fields use reusable `PasswordInput.tsx` with show/hide eye controls. This feature was explicitly tested previously and should be preserved.

## 6.7 Forgot password flow

Mobile screen: `ForgotPasswordScreen`

The screen calls Supabase password-reset email functionality and constructs a reset redirect/deep-link route.

The Supabase email has been observed to contain a redirect similar to:

```text
...redirect_to=exp://<device-ip>:8081/--/reset-password
```

## 6.8 Password reset status

Mobile screen: `ResetPasswordScreen`

`AppNavigator.tsx` contains:

- Expo Linking prefixes
- custom URL parsing
- query/hash parsing for tokens
- access-token/refresh-token session restoration
- code exchange support
- `PASSWORD_RECOVERY` auth listener
- ResetPassword navigation when recovery URLs are detected

However, previous real Expo Go testing still returned to the previously open Login/Home screen instead of reliably displaying the reset password screen.

Therefore:

**Password reset deep-link routing is unresolved/needs final device verification. Do not mark it as fixed just because the navigator contains recovery code.**

## 6.9 Accept invitation flow

Mobile screen: `AcceptInviteScreen`

The application supports invitation acceptance using a deep link route such as `accept-invite`.

The backend has a canonical invite endpoint under FastAPI. The old Supabase Edge Function still exists for compatibility but mobile is not intended to use it as the main invitation flow.

---

# 7. Navigation and screen map

File: `mobile/src/navigation/AppNavigator.tsx`

Current stack routes:

```text
Welcome
Login
SignUp
ForgotPassword
ResetPassword
AcceptInvite
Home
GroupDetails
AddExpense
ExpenseDetails
EditExpense
GroupHistory
GroupSettings
SettlementDetails
```

Important parameter routes:

```text
GroupDetails: { groupId?: string; groupName?: string }
AddExpense: { groupId?: string; groupName?: string }
ExpenseDetails: { expenseId?: string; groupId?: string }
EditExpense: { expenseId?: string; groupId?: string }
GroupHistory: { groupId?: string; groupName?: string }
GroupSettings: { groupId?: string; groupName?: string }
SettlementDetails: { settlementId?: string; groupId?: string }
```

The application uses both Expo-generated URLs and the custom `fairshare://` scheme.

---

# 8. Home screen workflow

File: `mobile/src/screens/home/HomeScreen.tsx`

## 8.1 Initial load

```text
Authenticated session
 -> Home mounts
 -> loadGroups()
 -> groupService.getGroups()
 -> GET /api/v1/groups
 -> API returns groups visible to current user
 -> FlatList renders GroupCard items
```

The Home screen currently has one main API call to load the group list, not six separate calls.

## 8.2 Group selection

```text
User taps GroupCard
 -> navigate('GroupDetails', { groupId, groupName })
```

## 8.3 Create Group

Home shows a create-group modal.

Flow:

```text
Home
 -> Create Group
 -> name/type/currency/description
 -> POST /api/v1/groups
 -> server validates and creates Group
 -> owner membership is created if it does not already exist
 -> response returns group
 -> Home reloads groups
 -> new group becomes visible
```

Supported group types in the backend:

```text
Trip
Home
Friends
Office
Other
```

Currency must be a 3-letter alphabetical code and is normalized uppercase.

---

# 9. Group model and membership model

## 9.1 Group fields

Current model fields include:

- `id`
- `owner_id`
- `name`
- `type`
- `currency`
- `description`
- `created_at`

## 9.2 GroupMember fields

Current membership concept includes:

- `id`
- `group_id`
- `user_id`
- `email`
- `role`
- `status`
- `created_at`

Roles currently supported:

```text
owner
admin
member
viewer
```

Membership statuses include active/pending.

Unique constraints prevent duplicate membership combinations.

---

# 10. Server-side permission model

File: `backend/app/services/permissions.py`

Current conceptual permissions:

### Owner

- read group
- add/change money-related records
- manage members
- manage settings
- manage roles
- delete group

### Admin

- read group
- add/change money-related records
- manage members

### Member

- read group
- add/change money-related records

### Viewer

- read group

This is enforced in backend services, not trusted to mobile UI alone.

The mobile UI also hides or disables actions for roles that cannot perform them, but the server is the authoritative authorization boundary.

---

# 11. Group Details — the most important current workflow

File: `mobile/src/screens/group/GroupDetailsScreen.tsx`

Current size is roughly 1,193 lines.

Current tabs:

```text
Overview
Expenses
Balances
Members
Activity
```

## 11.1 Navigation into Group Details

```text
Home GroupCard
 -> GroupDetailsScreen receives groupId/groupName
 -> screen obtains/fetches current group state
```

## 11.2 Current Group Details initial-load implementation

The most important current code path is around `GroupDetailsScreen.tsx` lines 102–153.

The `load()` function currently runs six API calls in parallel:

```text
1. getGroupSettings(groupId)
2. getGroupMembers(groupId)
3. getGroupExpenses(groupId, 200, expenseCategory, expenseScope)
4. getGroupBalances(groupId)
5. getGroupDebts(groupId)
6. getGroupSettlements(groupId)
```

These are started through `Promise.all()`.

Important misconception to avoid:
`Promise.all()` means the six calls are concurrent. It does NOT mean the screen is fast. The screen still waits for the slowest call, and each call is carrying duplicated authentication/database work.

## 11.3 Why the user sees 9–10 seconds

There are several stacked causes.

### Cause A — six API requests for one screen

One user action causes six independent HTTP requests before the screen is considered loaded.

### Cause B — each request authenticates independently

`apiClient.ts` calls Supabase `getSession()` before every request.

FastAPI then runs its authentication dependency for every request.

The current server implementation calls Supabase `/auth/v1/user` over HTTP for every authenticated request.

Therefore one Group Details load effectively creates repeated identity-validation work:

```text
Mobile request #1 -> FastAPI -> Supabase auth verification
Mobile request #2 -> FastAPI -> Supabase auth verification
Mobile request #3 -> FastAPI -> Supabase auth verification
...
Mobile request #6 -> FastAPI -> Supabase auth verification
```

### Cause C — repeated user synchronization/database context setup

The backend authentication path also performs local user synchronization and database request-user context setup.

That work is repeated across the six calls.

### Cause D — balances and debts duplicate expensive calculations

`debt_service.py` currently does:

```python
balances = compute_balances(session, group_id, user_id)
direct = compute_pair_debts(session, group_id)
simplified = simplify_balances(balances)
```

`compute_balances()` loads group expenses, splits, settlements, active members, and users.

Then `compute_pair_debts()` loads expenses, splits, settlements, and users again.

So asking for both balances and debts causes the database to be read repeatedly.

### Cause E — Group Details asks for all of this before showing the screen

Even though Overview only needs a small subset, the current code waits for all six requests.

No cache-first rendering is currently implemented in Group Details.

### Cause F — no persistent query cache

The mobile services are plain API wrappers. There is no React Query/TanStack Query-style query cache, no SWR equivalent, and no purpose-built in-memory group snapshot cache in the current source.

### Cause G — focus reload every time

`useFocusEffect()` runs `load()` when Group Details gains focus.

The screen sets `loading` while that load is happening.

Therefore navigating away/back or returning to the group can trigger the same heavy load again.

### Cause H — expenses are requested up to 200 rows

The initial Group Details call asks for up to 200 expenses:

```text
getGroupExpenses(groupId, 200, ...)
```

That may be unnecessary for the first paint of Overview.

### Cause I — backend computations load full financial history

Balance/debt calculations currently load all group expenses, their splits, and settlements rather than calculating a tiny Overview summary first.

As the group grows, the cost grows with the financial history.

## 11.4 What the Overview actually needs

The visible Overview logic uses a compact subset such as:

- current user's balance
- current user's paid total
- current user's share/owed total
- a small number of top debts
- a small number of recent expenses

It does NOT need 200 expenses plus every member plus every settlement plus all balance/debt variants before first paint.

This is the strongest architectural opportunity for Sprint 6.0.

---

# 12. Current Group Details UI tabs

## Overview

Shows high-level group financial state and recent information.

Includes concepts such as:

- hero/current balance
- paid/share statistics
- top debt items
- recent expenses

The horizontal tab spacing issue that previously caused a very large gap was fixed by constraining the horizontal tab ScrollView:

```tsx
style={styles.tabsContainer}
```

with:

```ts
tabsContainer: {
  height: 56,
  flexGrow: 0,
  flexShrink: 0,
}
```

The user confirmed this UI issue was fixed. Preserve this behavior.

## Expenses

Supports:

- All group expenses
- Mine
- category filters

The current backend `expense_repository.list_expenses()` defines Mine as:

```text
payer == current user
OR
current user appears in the expense splits
```

This is the current source behavior and should be preserved.

## Balances

Shows member-level balances and supports the direct/simplified debt presentation.

## Members

Shows group members and member actions according to permissions.

## Activity

Shows expense and settlement activity/history.

---

# 13. Group member workflow

Files:
- `mobile/src/screens/group/GroupDetailsScreen.tsx`
- `mobile/src/components/AddMemberModal.tsx`
- `mobile/src/components/MemberCard.tsx`
- `mobile/src/services/memberService.ts`
- `backend/app/services/group_service.py`
- `backend/app/services/invite_service.py`

## 13.1 Member list

```text
Group Details
 -> Members tab
 -> GET /groups/{group_id}/members
 -> backend validates membership
 -> member rows loaded
 -> full_name values are joined from local User table where possible
```

## 13.2 Add/invite member

The mobile client sends the invite through FastAPI.

The backend invite service can:

- find an existing verified Auth user and invite them into the group
- create/use an invited auth account flow as supported by the current implementation
- create pending membership state
- send an invitation through Supabase Auth infrastructure

The accepted invitation path uses the mobile `AcceptInvite` deep-link screen.

## 13.3 Remove member

The backend enforces:

- caller must have member-management permission
- owner cannot be removed
- admins cannot remove owners or other admins
- a member with an outstanding financial balance cannot be removed

This balance-safety rule is intentionally important because deleting membership with unsettled money would corrupt the group accounting semantics.

## 13.4 Leave group

Rules include:

- owner cannot leave the group
- user must settle any outstanding balance before leaving
- active membership is then deleted

The intention is to stop orphaned/ambiguous financial obligations.

---

# 14. Group settings workflow

Mobile screen: `GroupSettingsScreen.tsx`

Features include:

- group name editing
- group type editing
- base currency editing
- description editing
- role administration
- leave group
- delete group

## 14.1 Currency locking rule

Once expenses or settlements exist, changing the base group currency is rejected.

Backend check in `group_service.py` queries for existing `Expense` or `Settlement` rows and returns a conflict when financial activity already exists.

This prevents historical amounts from silently changing currency meaning.

## 14.2 Role management

Only the group owner can change another user's role.

The owner's own role cannot be replaced through the regular role-edit path.

---

# 15. Expense domain — current implemented functionality

Important files:

```text
mobile/src/screens/expense/AddExpenseScreen.tsx
mobile/src/screens/expense/EditExpenseScreen.tsx
mobile/src/screens/expense/ExpenseDetailsScreen.tsx
mobile/src/services/expenseService.ts
backend/app/services/expense_service.py
backend/app/services/split_calculator.py
backend/app/repositories/expense_repository.py
backend/app/models/expense.py
```

## 15.1 Expense fields/concepts

Current expense behavior includes:

- title/description-style name
- amount
- payer
- category
- split type
- participants/split members
- stored individual split values
- group currency
- created/updated state

Expense amount must be positive.

## 15.2 Expense categories

Current backend categories:

```text
Food
Fuel
Stay
Transport
Activities
Shopping
Bills
Other
```

The mobile app contains matching category constants.

## 15.3 Four split modes

The current application supports:

```text
Equal
Exact
Percentage
Shares
```

These are implemented both locally for immediate UI feedback and on the backend for authoritative validation/calculation.

### Equal

The total is split equally, with the rounding algorithm distributing cents using a largest-remainder style approach.

### Exact

Each selected participant gets a specific amount.

Validation requires the participant amounts to total exactly to the expense amount.

### Percentage

Each participant gets a percentage.

Validation requires the percentages to total exactly 100.

### Shares

Each participant gets a whole-number share count.

Validation requires positive whole-number shares.

The final money values are calculated server-side so the mobile device cannot be the sole authority for accounting correctness.

## 15.4 Add Expense workflow

```text
Group Details
 -> Add Expense
 -> fetch current user + active group members + group settings in parallel
 -> default payer = current user
 -> active participants selected
 -> user enters title/amount/category/split mode
 -> local calculation updates immediately
 -> user confirms
 -> mobile validates input
 -> POST /api/v1/groups/{group_id}/expenses
 -> backend validates permission/member state/split rules
 -> expense + splits committed
 -> Group Details can reload/revalidate
```

## 15.5 Edit Expense

```text
Expense Details
 -> Edit Expense
 -> load current user + group members + expense + group settings in parallel
 -> reconstruct split inputs
 -> user edits
 -> PUT expense
 -> server revalidates and persists
```

The current edit screen supports the same four split modes.

## 15.6 Delete Expense

Expense details expose deletion.

The backend has an authenticated delete path and uses the expense's group/user authorization rules.

This is important because deleting an expense changes balances/debts, so later screens should revalidate financial summaries.

---

# 16. Balance calculation workflow

Backend file: `backend/app/services/balance_service.py`

The current balance calculation concept is:

```text
For every expense:
    payer gets paid total

For every split:
    split participant gets owed total

For every settlement:
    sender gets sent amount
    receiver gets received amount

net balance = paid - owed + sent - received
```

For a participant:

- positive net means they are net owed money by the group
- negative net means they owe money to the group

The backend also loads active group members and financial users and attaches names/email/role information.

## Performance consequence

The implementation currently reads all expense rows, all relevant split rows, and all settlements for the group each time the balance calculation is requested.

That is acceptable as a straightforward first implementation but is not the right shape for instant loading at large scale or when multiple endpoints repeat it.

---

# 17. Debt calculation and simplification workflow

Backend file: `backend/app/services/debt_service.py`

Current endpoint response contains:

```text
direct
simplified
```

## Direct debts

`compute_pair_debts()` identifies obligations from split participants to the payer and offsets bilateral settlements.

## Simplified debts

`simplify_balances()` calculates transfers between debtors and creditors using the aggregate net balances.

## Important duplication

The current `get_group_debts()` function does all of this:

```text
compute_balances()
compute_pair_debts()
simplify_balances()
```

`compute_balances()` and `compute_pair_debts()` each independently load the underlying financial data.

Therefore a single Group Details load can compute/read the financial history multiple times.

**Sprint 6.0 must eliminate this duplication.**

Ideal target pattern:

```text
load group financial snapshot ONCE
   |
   +--> balances
   +--> direct debts
   +--> simplified debts
   +--> current user's summary
   +--> top debts for Overview
```

---

# 18. Settlement workflow

Mobile:
- `SettlementDetailsScreen.tsx`
- settlement service

Backend:
- `settlement_service.py`
- settlement repository
- route handlers

## 18.1 Creating a settlement

The user can settle a debt between two users.

Backend validates:

- parties exist in the group as required by the rules
- amount is positive
- `from_user` and `to_user` differ
- settlement does not violate the current computed financial state

Then the settlement is committed.

## 18.2 Editing settlement

Settlement Details supports editing existing settlement records.

## 18.3 Deleting settlement

Settlement Details can delete a settlement.

Deleting/creating/editing settlement records affects balance/debt calculations and therefore should invalidate or update cached group financial state once Sprint 6.0 caching is introduced.

---

# 19. History / activity

Backend route:

```text
GET /api/v1/groups/{group_id}/history
```

Query parameters:

```text
limit
category
scope
```

The current backend response contains:

```json
{
  "expenses": [...],
  "settlements": [...]
}
```

This endpoint already combines expenses and settlements, which is potentially useful for future Group Details Activity optimization.

Important current architecture observation:
The Group Details screen still makes a separate settlements request for its initial state and separately loads expenses. The existing combined history endpoint is therefore an optimization opportunity.

---

# 20. Current API surface

Backend route file: `backend/app/api/routes.py`

Current main API groups:

## Health

```text
GET /api/v1/health
```

## Authenticated current user

```text
GET /api/v1/me
```

## Groups

```text
GET    /api/v1/groups
POST   /api/v1/groups
GET    /api/v1/groups/{group_id}
PATCH  /api/v1/groups/{group_id}
GET    /api/v1/groups/{group_id}/settings
PATCH  /api/v1/groups/{group_id}/settings
POST   /api/v1/groups/{group_id}/leave
DELETE /api/v1/groups/{group_id}
```

## Members / invitations

```text
GET    /api/v1/groups/{group_id}/members
GET    /api/v1/groups/{group_id}/members/roles
GET    /api/v1/groups/{group_id}/invitation
POST   /api/v1/groups/{group_id}/members/invite
POST   /api/v1/groups/{group_id}/members/accept
DELETE /api/v1/groups/{group_id}/members/{member_id}
PATCH  /api/v1/groups/{group_id}/members/{user_id}/role
```

## Expenses

```text
GET    /api/v1/groups/{group_id}/expenses
POST   /api/v1/groups/{group_id}/expenses
GET    /api/v1/expenses/{expense_id}
PUT    /api/v1/expenses/{expense_id}
DELETE /api/v1/expenses/{expense_id}
```

## Balances / debts

```text
GET /api/v1/groups/{group_id}/balances
GET /api/v1/groups/{group_id}/debts
```

## Settlements

```text
GET    /api/v1/groups/{group_id}/settlements
POST   /api/v1/groups/{group_id}/settlements
PUT    /api/v1/settlements/{settlement_id}
DELETE /api/v1/settlements/{settlement_id}
```

## History

```text
GET /api/v1/groups/{group_id}/history
```

Future optimization should NOT randomly create multiple new endpoints when an existing endpoint can be reused cleanly. For Sprint 6.0, an intentionally designed Group Overview/Bootstrap endpoint is justified because the current screen has a very clear multi-query bootstrap problem.

---

# 21. Current database architecture

Canonical database management:

```text
Alembic
 -> PostgreSQL
```

## Migration chain

```text
0001_initial_schema
    |
    v
0002_revoke_legacy_postgrest_api
    |
    v
0003_categories_and_api_db_context
```

## 21.1 0001 — initial/canonical schema adoption

Creates/adopts the core relational model including:

- users
- groups
- group_members
- expenses
- expense_splits
- settlements

The migration also includes compatibility/adoption logic for an existing database and adds required constraints/indexes/columns as part of the migration process.

## 21.2 0002 — revoke legacy PostgREST access

This migration removes/restricts legacy anon/authenticated access/execute paths so the mobile client cannot simply bypass the FastAPI security boundary using old Supabase database APIs.

This migration is central to the architecture migration.

## 21.3 0003 — categories and database context guards

Adds:

- `Expense.category`
- category check/index support
- private request-user context functions
- database guard logic/triggers intended to stop viewer write operations while preserving trusted backend writes

---

# 22. Legacy SQL status

The following historical migrations exist in `database/legacy/`:

```text
001_init.sql
002_groups.sql
003_groups_index.sql
004_group_members.sql
005_expenses.sql
006_expense_splits.sql
007_profiles_member_invitations.sql
008_equal_split.sql
009_advanced_splits.sql
010_balances.sql
011_settlements.sql
012_fix_settlement_balance_sign.sql
013_expense_edit_delete.sql
014_settlement_edit_delete.sql
015_group_settings.sql
016_group_roles_permissions.sql
017_fix_roles_and_currency.sql
```

These are historical context and should not be treated as the main migration mechanism for the new architecture.

---

# 23. Current backend security/data-boundary design

Security intentions currently present:

1. Mobile does not receive raw database credentials.
2. Mobile sends an authenticated bearer token.
3. FastAPI performs authentication.
4. FastAPI services enforce group/user permissions.
5. Database logic includes request-user context support.
6. Legacy direct PostgREST access is explicitly revoked by migration.
7. Viewer writes are further protected by database-level guard logic.
8. Group membership is checked server-side.
9. Balance-sensitive operations such as removing/leaving members are checked against current balances.

Optimization must keep these guarantees.

---

# 24. Existing mobile services

Current service files and responsibilities:

## `authService.ts`

- sign up
- sign in
- sign out
- forgot password
- current user/session helpers

## `groupService.ts`

- list groups
- create group
- read/update settings
- leave group
- delete group
- role-related operations

## `memberService.ts`

- list members
- invite
- pending invitation
- accept invitation
- remove member

## `expenseService.ts`

- list expenses
- create expense
- read expense
- update expense
- delete expense
- expense mapping/helpers

## `balanceService.ts`

- fetch group balances

## `debtService.ts`

- fetch direct/simplified debt response

Note: there is also a wrapper named `getGroupDebtRelationships` that carries parameters no longer needed by the current API shape. This is a small cleanup opportunity later; it is not the main performance issue.

## `settlementService.ts`

- list settlements
- create settlement
- update settlement
- delete settlement

## `apiClient.ts`

- get Supabase access token
- construct authenticated FastAPI request
- parse JSON/text errors
- support optional AbortSignal

The API client currently has no query cache, retry policy, or default timeout.

---

# 25. Current mobile screens and their responsibilities

## Authentication

### `WelcomeScreen`
Product introduction / entry point to login.

### `LoginScreen`
Email/password sign-in.

### `SignUpScreen`
New account registration.

### `ForgotPasswordScreen`
Send recovery email.

### `ResetPasswordScreen`
Set a new password after recovery.

### `AcceptInviteScreen`
Accept group invitation / update account state as supported.

## Home

### `HomeScreen`
List groups, create group, open group.

## Group

### `GroupDetailsScreen`
Main group hub: Overview, Expenses, Balances, Members, Activity.

### `GroupSettingsScreen`
Group metadata, currency, roles, leave/delete.

### `HistoryScreen`
Historical group activity.

### `SettlementDetailsScreen`
Settlement details, edit/delete.

## Expense

### `AddExpenseScreen`
Create expense with four split types.

### `ExpenseDetailsScreen`
View expense, navigate to edit, delete.

### `EditExpenseScreen`
Edit amount, payer, category, participants and splits.

---

# 26. Reusable mobile components

```text
AddMemberModal.tsx
AuthInput.tsx
CreateGroupModal.tsx
ExpenseCard.tsx
GroupCard.tsx
MemberCard.tsx
PasswordInput.tsx
SplitTypeSelector.tsx
```

Password visibility behavior is already working and should not be regressed.

---

# 27. Frontend calculation architecture

File: `mobile/src/utils/expenseCalculation.ts`

The mobile UI calculates split values immediately so the user gets instant feedback while filling an expense.

This is a UX optimization, not an authority boundary.

The backend recalculates/validates the split so stored accounting remains authoritative and secure.

This dual approach should remain:

```text
Mobile = immediate preview/validation
Backend = final authoritative calculation/validation
```

---

# 28. Current test situation in the supplied ZIP

This is an important handoff point because the documentation and actual current code are not fully synchronized.

The archive's `docs/END_TO_END_TESTING.md` describes an earlier successful test baseline, including many passing cases.

When the supplied ZIP was actually executed with the backend test suite, the current result was:

```text
13 failed
6 passed
1 skipped
```

The primary failure was the backend test environment running `set_database_user_context()` against SQLite. SQLite does not provide PostgreSQL's `set_config()` function.

There is also a migration metadata test failure because:

- actual Alembic head is `0003_categories_and_api_db_context`
- `backend/tests/test_migrations_metadata.py` still expects `0002_revoke_legacy_postgrest_api`

Therefore the handoff must preserve this distinction:

**The source archive contains the intended architecture implementation, but the current automated test suite needs to be realigned with migration 0003 and SQLite test behavior before declaring the new architecture's tests clean.**

This should be addressed as part of the engineering work, not hidden.

---

# 29. Current documentation drift / gaps

## `docs/BLUEPRINT.md`

Current file content is only a placeholder sentence about a blueprint placeholder for the release.

Therefore it is not a trustworthy source of detailed architecture information.

## `docs/END_TO_END_TESTING.md`

The document describes a much healthier test result than the supplied ZIP currently produces locally. Treat it as an intended/earlier baseline, not as proof of the current test run.

## `backend/tests/test_migrations_metadata.py`

Must be updated to recognize the current Alembic head if that head is intentionally `0003`.

## SQLite test support

The current security/database-context implementation assumes PostgreSQL functionality in a path that is reached by the API tests. Either:

- make the test-only context setter safely bypass PostgreSQL-specific `set_config()` on SQLite while preserving production behavior, or
- provide a test fixture/database strategy that emulates the PostgreSQL function appropriately.

The correct solution should be chosen deliberately during test hardening.

---

# 30. CRITICAL PERFORMANCE DIAGNOSIS — exact current Group Details request chain

This section should be treated as the most important technical context for the next sprint.

Current mobile sequence:

```text
User taps group
       |
       v
GroupDetailsScreen
       |
       v
useFocusEffect()
       |
       v
setLoading(true)
       |
       v
load()
       |
       +--> getGroupSettings()
       |       |
       |       +--> apiRequest()
       |               |
       |               +--> supabase.auth.getSession()
       |               +--> fetch(FastAPI)
       |                       |
       |                       +--> get_current_user()
       |                       |       |
       |                       |       +--> Supabase /auth/v1/user HTTP call
       |                       |       +--> local User DB work
       |                       |       +--> DB user context setup
       |                       |
       |                       +--> group query
       |
       +--> getGroupMembers()
       |       |
       |       +--> same auth path
       |
       +--> getGroupExpenses(..., 200, category, scope)
       |       |
       |       +--> same auth path
       |
       +--> getGroupBalances()
       |       |
       |       +--> same auth path
       |       +--> all expenses
       |       +--> all splits
       |       +--> all settlements
       |       +--> members
       |       +--> users
       |
       +--> getGroupDebts()
       |       |
       |       +--> same auth path
       |       +--> compute_balances()
       |       |       +--> expenses/splits/settlements/users
       |       +--> compute_pair_debts()
       |               +--> expenses/splits/settlements/users again
       |
       +--> getGroupSettlements()
               |
               +--> same auth path
               +--> settlements query

Promise.all() waits for the slowest branch.
       |
       v
set state for all returned sections
       |
       v
setLoading(false)
       |
       v
screen feels available
```

This is why the screen can feel dramatically slower than the previous architecture even though the six calls are parallel.

---

# 31. Target Sprint 6.0 — Group Load Performance + Bootstrap Architecture

## 31.1 Sprint goal

**Make Group Details visibly useful immediately, without weakening the FastAPI security/data boundary.**

The user's mental model should change from:

```text
Tap group -> wait 9–10 seconds -> screen appears
```

to:

```text
Tap group -> group shell/Overview appears almost immediately
          -> fresh data revalidates in background
          -> detailed tabs fetch only when needed
```

The server should also stop doing duplicate financial work for one screen load.

## 31.2 The intention behind this sprint

The purpose is not merely to reduce milliseconds in random functions.

The underlying problem is architectural fan-out:

- too many calls
- repeated authentication
- repeated user setup
- repeated financial scans
- too much data fetched before first paint
- no cache-first UX

Sprint 6.0 should fix this as one coherent request/data-flow redesign.

---

# 32. Sprint 6.0 recommended target architecture

## 32.1 Introduce a Group Overview/Bootstrap API

Recommended endpoint shape:

```text
GET /api/v1/groups/{group_id}/overview
```

or an equivalent `/summary`/`/bootstrap` name.

The endpoint should return only what is required for the first Group Details screen paint.

Recommended payload concept:

```json
{
  "group": {
    "id": "...",
    "name": "...",
    "type": "Trip",
    "currency": "INR",
    "description": "..."
  },
  "membership": {
    "role": "member"
  },
  "current_user_summary": {
    "net_balance": 0,
    "total_paid": 0,
    "total_owed": 0
  },
  "top_debts": [],
  "recent_expenses": [],
  "recent_settlements": []
}
```

The final schema should use the existing schema conventions and avoid redundant fields.

The purpose is a small, stable payload designed for first paint.

## 32.2 Do NOT make Overview fetch everything

The Overview endpoint should not return 200 expenses or the complete member directory unless there is a concrete UI requirement for them.

Initial target:

- latest 5–20 expenses depending on UX needs
- top few relevant debts
- current user summary
- group metadata and role
- optionally recent settlements/activity needed for Overview

## 32.3 Lazy-load tabs

After Sprint 6.0 the Group Details data strategy should conceptually become:

```text
Group open
 -> Overview bootstrap only

User opens Expenses
 -> expense endpoint loads expense list/pagination

User opens Balances
 -> balance/debt endpoint loads financial summary

User opens Members
 -> member endpoint loads members

User opens Activity
 -> history endpoint loads combined activity
```

This makes initial response independent of the least-used tab.

---

# 33. Sprint 6.0 backend optimization details

## 33.1 Reuse one financial snapshot

Create a backend internal service/helper such as:

```text
load_group_financial_snapshot(...)
```

The exact name is flexible.

The important property is:

```text
load expenses once
load splits once
load settlements once
load required users/members once
        |
        +--> balances
        +--> pair debts
        +--> simplified debts
        +--> current-user summary
        +--> top debts
```

Do not have `compute_balances()` and `compute_pair_debts()` independently issue identical database scans when one request requires both.

## 33.2 Optimize authentication overhead

The highest-impact security path to review is:

```text
get_current_user()
```

Current implementation calls Supabase's `/auth/v1/user` for every authenticated API request.

Safe optimization sequence:

Phase A:
- avoid repeated remote verification inside the same logical request
- ensure the authenticated user object is only resolved once per FastAPI request
- avoid unnecessary local User commits/refreshes on read-only requests

Phase B, after tests and security validation:
- investigate local JWT verification with securely cached Supabase signing keys/JWKS if compatible with the authentication setup
- keep token expiry/signature/audience/issuer checks strict
- retain server-side authorization

Do not replace proper token verification with decoding-only JWT parsing.

## 33.3 Optimize User DB synchronization

`ensure_user` should not turn every read API request into a write transaction.

Desired behavior:

```text
User exists and data is current -> read only
User missing/stale -> upsert/update once
```

Exact staleness semantics can be chosen during implementation.

## 33.4 Optimize SQL queries/indexes

Review query patterns used by:

- group membership lookup
- group expense list ordered by `created_at`
- expense split lookup by expense IDs
- settlements by group ordered by created time
- group-member status/user membership

Useful index families to verify/add as needed include:

```text
expenses(group_id, created_at)
expense_splits(expense_id, user_id)
settlements(group_id, created_at)
group_members(group_id, status, user_id)
```

Do not blindly add every index. Check existing migration indexes and actual query plans first.

## 33.5 Use one transaction/session intelligently

The bootstrap operation should ideally use one DB session/transaction and load the required rows once.

## 33.6 Reduce payload size

Return only fields required by the consuming screen.

Avoid shipping full records with fields never rendered.

---

# 34. Sprint 6.0 mobile optimization details

## 34.1 Cache-first Group Details

Introduce a group snapshot cache, initially in memory.

Optionally persist recent snapshots using AsyncStorage after the basic behavior is proven.

Desired UX:

```text
Tap group
 -> if cached snapshot exists:
       render immediately
       start background refresh
 -> else:
       call overview endpoint
       render result
```

## 34.2 Never block an already-rendered group on refresh

Current behavior sets loading for every focus/load.

Desired behavior:

```text
first-ever load with no data -> show loading state
existing data present -> show data immediately + silent refresh indicator
```

## 34.3 Background refresh on focus

Instead of:

```text
focus -> blank/loading -> wait -> render
```

use:

```text
focus -> keep current state -> request refresh -> swap in fresh data
```

## 34.4 Add AbortSignal usage

`apiClient.ts` already supports `signal?: AbortSignal`.

Group Details should use an AbortController to prevent stale background requests from updating state after navigation or a subsequent request.

## 34.5 Avoid unnecessary full reloads after small mutations

After adding/editing/deleting an expense, the app should eventually update or invalidate only the affected group financial snapshot rather than refetching every section blindly.

For Sprint 6.0, simple invalidation/revalidation is acceptable. Full fine-grained cache mutation can be a later improvement.

---

# 35. Sprint 6.0 acceptance criteria

Do not call Sprint 6.0 complete until these are demonstrated.

## Functional

- Login still works.
- Home still loads groups.
- Group create still works.
- Group details still opens.
- Overview still shows correct user financial summary.
- Expenses still work.
- Expense filters still work.
- Members still work.
- Balances/debts still work.
- Settlements still work.
- Group settings still work.
- Permissions still work.

## Performance

Measure the actual time rather than relying only on visual impressions.

Capture at least:

```text
cold group open
warm/cached group open
backend bootstrap response time
number of HTTP requests for initial group open
number of database queries for bootstrap
```

Target architectural state:

```text
Initial Group Details -> one small bootstrap request
```

A final exact millisecond target should be measured on the user's real LAN/device environment. The primary goal is to make the first visible group state effectively immediate when cached and very fast even on a cold load.

## Regression

- no direct mobile PostgREST access
- no database credentials in mobile
- no security bypass to improve speed
- no duplicate navigation routes
- no Group Details tab-spacing regression
- PasswordInput show/hide remains working

---

# 36. What should NOT be the next sprint's main feature

The following are important, but they should not displace the immediate Group Details performance work:

- Maps
- receipts
- major visual redesign
- social/chat features
- broad notification systems
- complex offline synchronization

The app should first make its core group/accounting workflow responsive and stable under the new architecture.

---

# 37. Maps — when and why to implement them

## 37.1 Current status

There is no implemented map screen, map service, route model, or map dependency in the current archive.

The current group model already supports the `Trip` group type, and the roadmap contains a Trips version and a later Journey Mode concept. That means maps belong naturally to the trip/journey stage, not to the financial foundation stage.

## 37.2 Recommended timing

Recommended sequencing:

```text
Sprint 6.0
Group load performance + bootstrap/cache
        |
        v
6.x stabilization / data UX / pagination as needed
        |
        v
Trip/Journey foundation
        |
        v
Maps + route planning
```

Maps should start when the Trip/Journey domain model is ready.

Do not implement a map just because it is visually exciting while the core group screen still takes 9–10 seconds.

## 37.3 Intended map feature

The project direction previously described a route/planning feature where users can:

- create a trip route
- add a starting point
- add intermediate stops
- add a destination
- reorder stops
- save the route
- see approximate kilometres
- see approximate travel duration
- use an open map/navigation stack rather than building a proprietary maps service

The exact provider/library should be selected during the Trip/Journey sprint after current requirements are finalized.

## 37.4 Proposed map architecture

A future design can look like:

```text
Trip group
   |
   +--> Trip/Journey data
           |
           +--> stops
           +--> route geometry/metadata
           +--> total distance
           +--> estimated duration
           |
           v
     Map rendering layer
```

Important distinction:

The map should display and help edit route data. The backend should store the durable trip/route state. A route calculation provider or open routing service can calculate approximate distance/duration.

## 37.5 Map data to persist

A future database model should likely persist information such as:

- trip/group ID
- stop ID
- stop sequence
- latitude
- longitude
- user-facing place name/label
- optional note
- route distance metadata
- route duration metadata
- timestamps

Do not over-design the database before the Trip/Journey requirements are finalized.

---

# 38. Roadmap captured in the current documentation

The archive's roadmap lists these product stages:

```text
v0.1 Foundation
v0.2 Groups
v0.3 Trips
v0.4 Expenses
v0.5 Balances
v0.6 Simplify Debts
v0.7 Settlements
v0.8 Multi-Currency
v0.9 Receipts
v1.0 Splitwise Complete
v1.1 Journey Mode
```

This is the source-derived product roadmap.

The sprint-level performance plan below is an engineering sequencing decision for the current architecture, not a replacement of those product roadmap labels.

---

# 39. Features already implemented — consolidated checklist

## Authentication

- Welcome flow
- email/password sign-up
- email/password login
- persisted Supabase session
- sign-out
- forgot-password email
- reset password screen/code path
- invitation acceptance screen/deep-link path
- password visibility toggle

Status note: reset deep-link device behavior still needs final reliable verification.

## Groups

- create group
- list groups
- persistent groups
- group types
- base currency
- description
- group details
- group settings
- owner/admin/member/viewer roles
- group deletion
- leave group rules

## Members

- member list
- invite member
- invitation state
- accept invite
- remove member
- role changes
- role-based actions
- outstanding-balance protection for leaving/removing

## Expenses

- create expense
- expense detail
- edit expense
- delete expense
- payer selection
- category selection
- four split modes
- participants selection
- group currency handling
- server-side split validation
- local split preview/calculation
- expense filtering
- Mine scope

## Financial calculations

- total paid
- total owed/share
- net balances
- direct debts
- simplified debts
- settlement-aware balances

## Settlements

- settlement list
- create settlement
- settlement detail
- edit settlement
- delete settlement
- settlement validation against financial state

## Group activity

- Group Details Activity tab
- History screen
- combined backend history endpoint
- categories/scopes

## Security / architecture

- FastAPI API boundary
- bearer-token authentication
- server-side authorization
- SQLAlchemy repositories/services
- Alembic migrations
- legacy PostgREST revoke migration
- database request-user context mechanism
- viewer database write guards

## UI/UX already addressed

- password eye/eye-off control
- Group Details tab layout spacing fix
- Safe-area/navigation polish captured in architecture/changelog history

---

# 40. Features NOT implemented yet / future work

The following should be treated as future unless the code proves otherwise in a later archive:

## Trip/Journey feature family

- dedicated trip planning model
- route/stops storage
- reorderable itinerary
- map rendering
- route calculation
- distance/duration display
- journey mode
- trip-specific location data

## Maps

- map screen
- map integration
- route polyline visualization
- waypoint selection
- navigation/route estimation

## Receipts

- receipt image upload
- receipt attachment to expense
- receipt viewing
- optional OCR/expense extraction later

## Multi-currency

The current group has a base currency and currency validation, but the broader roadmap's multi-currency feature is not the same thing as simply allowing a 3-letter group currency code.

A real multi-currency implementation still needs to define:

- transaction currency
- base/group currency
- conversion rate source/time
- who owns the FX conversion rule
- historical rate persistence
- rounding behavior
- settlement currency semantics

This should be a dedicated feature, not bolted into Sprint 6.0.

## Offline-first synchronization

Not currently implemented as a full conflict-resolving offline system.

Caching for faster reads should not automatically be described as full offline support.

---

# 41. Recommended sprint sequencing from this point

## Sprint 6.0 — Group Load Performance / Bootstrap

Intent:
Make the main group screen feel immediate under the new architecture.

Main work:

- Group Overview bootstrap endpoint
- one-request first paint
- financial snapshot reuse
- remove duplicate balance/debt database scans
- reduce authentication overhead
- avoid unnecessary user DB writes
- cache-first Group Details
- background refresh
- lazy tab loading
- request cancellation
- performance instrumentation
- API/query/index review
- update tests

## Sprint 6.1 — Data UX hardening

Intent:
Make larger groups stay fast after 6.0.

Possible work, based on actual 6.0 measurements:

- expense pagination
- activity pagination
- more efficient member loading
- reusable cache invalidation strategy
- better refresh indicators
- loading/error/empty states that do not destroy existing data
- backend query profiling

Do not automatically implement every item; choose based on measurements after Sprint 6.0.

## Sprint 6.2 / Trip foundation — Trip/Journey domain

Intent:
Turn the existing `Trip` group type into a real trip-oriented experience.

Possible work:

- trip metadata
- itinerary/stop data model
- ordered stops
- route entity
- trip-specific screens
- route storage APIs

## Next stage — Maps / Route planning

Intent:
Allow a user to visualize and plan the trip route on a map.

Possible work:

- map library/provider integration
- place search/selection
- start/waypoint/destination selection
- route calculation
- distance/duration
- saved route
- polyline rendering
- edit/reorder stops

## Later

- Multi-currency
- Receipts
- Journey Mode expansion
- other roadmap features

---

# 42. Very important architecture rules for the next chat

1. **Do not revert to direct Supabase/PostgREST data access just to make it faster.**

2. **Do not make mobile the authority for balances, debts, permissions, or stored split accounting.**

3. **Do keep local calculations for immediate expense entry UX.**

4. **Do not make the user wait for unrelated tabs to finish loading before Overview appears.**

5. **Do not solve the 9–10 second delay by hiding the spinner only. The request/data architecture must actually be optimized.**

6. **Do not duplicate heavy balance/debt database scans when one financial snapshot can produce all required outputs.**

7. **Do not introduce a map before the core group experience is responsive and stable.**

8. **Preserve existing password visibility and Group Details tab-spacing fixes.**

9. **Do not claim reset-password deep linking is solved until tested in real Expo Go/device flow.**

10. **Treat the FastAPI + SQLAlchemy + Alembic architecture as the current foundation.**

11. **The `dev` branch is intentional for the architecture work.**

12. **Keep production files complete. Do not send placeholder comments, patch-only files, malformed ZIPs, or instructions that require guessing where code belongs.**

---

# 43. Exact performance redesign in one picture

Current:

```text
Tap Group
   |
   +--> settings ----> auth ---> Supabase user ---> DB
   +--> members -----> auth ---> Supabase user ---> DB
   +--> expenses ----> auth ---> Supabase user ---> DB
   +--> balances ----> auth ---> Supabase user ---> DB
   |                     |
   |                     +--> all expenses/splits/settlements
   +--> debts ---------> auth ---> Supabase user ---> DB
   |                     |
   |                     +--> all expenses/splits/settlements AGAIN
   +--> settlements ---> auth ---> Supabase user ---> DB
   |
   v
Wait for slowest
   |
   v
Render
```

Target:

```text
Tap Group
   |
   v
GET /groups/{id}/overview
   |
   +--> authenticate once
   +--> authorize once
   +--> load group/role
   +--> load small recent financial data
   +--> load/reuse one financial snapshot
   +--> calculate current user summary + top debts
   |
   v
Render Overview immediately
   |
   +--> background refresh if cached
   |
   +--> user opens Expenses -> load expenses
   +--> user opens Balances -> load/reuse financial summary
   +--> user opens Members -> load members
   +--> user opens Activity -> load history
```

That is the main architectural transformation required to make the current implementation feel close to the old architecture's speed without bringing back the old security/data-access problems.

---

# 44. New-chat startup instruction

Paste this handoff file together with the latest project ZIP into the new chat.

The first task in the new chat should be:

```text
Read FairShare_Handoff_for_New_Chat.md completely and inspect the supplied current ZIP.
Treat the ZIP as the current code source and this Markdown as project/context source.
Do not restart the project explanation.
Do not re-propose the old direct-Supabase architecture.
Continue with Sprint 6.0: Group Load Performance + Bootstrap Architecture.
First verify the current ZIP against the performance findings in this document, especially:
- GroupDetailsScreen six-request Promise.all load
- apiClient session lookup per request
- backend Supabase /auth/v1/user verification per request
- ensure_user/database-context overhead
- duplicated balance/debt financial scans
- no cache-first Group Details behavior
- current Alembic/test mismatch
Then design and implement the smallest complete production-quality change that makes Group Details fast.
```

---

# 45. Final current-state summary

The FairShare project is no longer a simple client-to-Supabase prototype. The current ZIP represents a deliberate architectural migration to:

```text
React Native/Expo
        -> FastAPI
        -> SQLAlchemy
        -> PostgreSQL
with Supabase Auth for identity
```

The core financial product is already substantially implemented:

- authentication
- groups
- memberships/invitations
- roles/permissions
- expenses
- four split modes
- payer selection
- expense edit/delete
- categories
- balances
- direct debts
- simplified debts
- settlements
- group settings/currency rules
- history/activity

The current major engineering problem is **not lack of functionality**. It is **response time caused by the new architecture's request fan-out and duplicated backend work**.

The next engineering milestone is therefore:

**Sprint 6.0 — Group Load Performance + Bootstrap Architecture**

After that, the natural product expansion is:

```text
performance/data hardening
 -> Trip/Journey foundation
 -> Maps / route planning
 -> Multi-currency / receipts / later roadmap work
```

Maps are a future product stage. They are not part of the current implementation.

The key principle for the new chat is:

**Make the new architecture as fast as the old architecture by optimizing the architecture — do not bring back the old insecure data-access path.**

