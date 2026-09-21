# FairShare — Trip/Journey Foundation

This package contains the complete local replacement/addition files for the Trip/Journey foundation sprint.

## Existing files to replace

- backend/app/models/__init__.py
- backend/app/main.py
- backend/tests/test_migrations_metadata.py
- mobile/src/navigation/AppNavigator.tsx
- mobile/src/screens/home/HomeScreen.tsx

## New files to add

- backend/app/models/trip.py
- backend/app/schemas/trip.py
- backend/app/services/trip_service.py
- backend/app/api/trip_routes.py
- backend/alembic/versions/0004_trip_journey_foundation.py
- backend/tests/test_trip_api.py
- mobile/src/services/tripService.ts
- mobile/src/screens/group/TripDetailsScreen.tsx

## What this sprint implements

- One Trip/Journey record per Trip group.
- Trip dates, timezone, and notes.
- Ordered itinerary stops.
- Start / stop / destination semantics.
- Optional address and latitude/longitude storage for future map integration.
- Add, edit, delete, and reorder itinerary stops.
- Group-role authorization through the existing FastAPI permission boundary.
- PostgreSQL migration with new tables, constraints, indexes, and client-facing privilege revocation.
- Mobile Journey screen and a Plan Journey entry point for Trip groups.

## Intentionally not included yet

Maps, place search, routing, route polylines, distance/duration calculation, and journey replay are intentionally deferred until this domain foundation is validated.

## Validation performed here

- Backend replacement/new Python files: py_compile passed.
- New mobile/replaced mobile files: TypeScript/TSX transpile parsing passed.
- Full project pytest and full mobile `npx tsc --noEmit` must be run in the user's complete FairShare checkout after copying these files.
