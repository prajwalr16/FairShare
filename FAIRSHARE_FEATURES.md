# FairShare — Complete Master Feature List & Capability Catalog

> **Application Name:** FairShare  
> **Tagline:** *Split expenses. Share memories.*  
> **Live Web App:** [https://fairshare-url.expo.app](https://fairshare-url.expo.app)  
> **Backend API:** [https://fairshare-api-q7hd.onrender.com/api/v1](https://fairshare-api-q7hd.onrender.com/api/v1)  
> **Repository:** [https://github.com/prajwalr16/FairShare](https://github.com/prajwalr16/FairShare)  
> **Design Theme:** Obsidian Luxury Dark Aesthetic (`#06090F`, `#0E1524`, `#00E5FF`, `#10B981`, `#F97316`, `#FF4B72`)

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [User Authentication & Profile Management](#2-user-authentication--profile-management)
3. [Group Management & Social Collaboration](#3-group-management--social-collaboration)
4. [Expense Management & Calculation Engine](#4-expense-management--calculation-engine)
5. [Tax, Tip & Additional Charge Distribution](#5-tax-tip--additional-charge-distribution)
6. [1-Tap UPI Settlement & Payment QR Engine](#6-1-tap-upi-settlement--payment-qr-engine)
7. [Debt Simplification & Financial Ledger](#7-debt-simplification--financial-ledger)
8. [Statement Exports & Financial Reporting](#8-statement-exports--financial-reporting)
9. [Trip & Journey Planning Engine](#9-trip--journey-planning-engine)
10. [Interactive Road Mapping & Navigation (MapLibre + OpenFreeMap)](#10-interactive-road-mapping--navigation-maplibre--openfreemap)
11. [Offline-First Architecture & Real-Time Sync](#11-offline-first-architecture--real-time-sync)
12. [Tactile Haptics & Premium Mobile Micro-Interactions](#12-tactile-haptics--premium-mobile-micro-interactions)
13. [Zero-Cost Push Notification Engine](#13-zero-cost-push-notification-engine)
14. [Production Security, Rate Limiting & Hardening](#14-production-security-rate-limiting--hardening)
15. [24/7 Keep-Alive & Cloud Reliability Integrations](#15-247-keep-alive--cloud-reliability-integrations)
16. [Comprehensive Test Suite & CI/CD Pipeline](#16-comprehensive-test-suite--cicd-pipeline)

---

## 1. Executive Summary

FairShare is a modern, high-performance, full-stack expense sharing and trip planning platform. Built with **React Native / Expo** on the frontend, **FastAPI + SQLAlchemy + Alembic** on the backend, and **PostgreSQL (Supabase)** for storage and identity, it bridges financial tracking with itinerary mapping. 

Unlike conventional expense calculators, FairShare includes day-by-day road trip mapping, 1-tap instant Indian UPI settlements with camera-scannable QR codes, PDF/CSV export statements, automated tax/tip distribution, offline data resilience, and 24/7 warm-cloud infrastructure.

---

## 2. User Authentication & Profile Management

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **Email & Password Authentication** | Secure user registration and login backed by Supabase Auth with JWT token validation. | Handled via `mobile/src/services/authService.ts` and validated by FastAPI `backend/app/core/security.py`. |
| **Session Persistence & Auto-Refresh** | Automatic JWT token refresh in the background; prevents users from being randomly logged out during active use. | Monitored via `onAuthStateChange` in `mobile/src/services/apiClient.ts`. |
| **Automatic 401 Session Eviction** | Graceful local sign-out if an authorization token is invalidated or expired. | Clean cache purge and redirect to Welcome screen. |
| **Forgot & Reset Password Flows** | Complete password recovery pipeline with secure one-time recovery links and deep link routing. | Native deep-link schema `fairshare://reset-password` handled in `AppNavigator.tsx`. |
| **Profile Management** | View and edit user display name, phone number, and avatar initials. | Screen: `ProfileScreen.tsx`, Service: `profileService.ts`. |
| **Brand Identity** | Custom SVG-rendered brand typography and glowing cyan FS logo mark with responsive scaling. | Component: `mobile/src/components/BrandLogo.tsx`. |

---

## 3. Group Management & Social Collaboration

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **Multi-Category Group Creation** | Create dedicated groups for specific life situations: **Trip**, **Home / Flatmates**, **Couple**, **Event**, or **Other**. | Modal: `CreateGroupModal.tsx`, Backend: `POST /api/v1/groups`. |
| **Luxury "New Group" Action Hierarchy** | Replaced the cramped, tiny button formerly tucked inside the financial hero card with an ergonomic, multi-entry design:<br>1. **Section Action Pill:** A dedicated `[ + New Group ]` glass pill button right in the "YOUR GROUPS" section header next to the group count.<br>2. **Top Header Quick Action:** A sleek `[ + Group ]` cyan pill in the top navigation bar.<br>3. **Permanent Floating Action Pill:** A solid cyan `#00E5FF` extended luxury pill (`[ +  New Group ]`) permanently docked at the bottom right/center with haptic feedback, depth shadow, and spring scale animation. | Screen: `HomeScreen.tsx`, Haptics: `haptics.ts`. |
| **Bulk Quick-Add Members** | Add multiple members at once using comma-separated or newline text (e.g. `Rahul, Sneha, Rohan, Amit`) directly during group creation or from the group details screen. Completely eliminates Supabase SMTP email limits. | Endpoints: `POST /api/v1/groups/{id}/members/batch`, Utilities: `memberOnboarding.ts`. |
| **Virtual / Placeholder Members** | Organizers can add friends with just a name (email/phone optional). Creates shadow records in the database so placeholders can be assigned expenses, included in splits, and tracked in balances immediately. | Model: `GroupMember.is_placeholder`, `display_name`, Migration: `0010_placeholder_members.py`. |
| **Smart Auto-Match & One-Tap Claim** | When invited friends open `/join?group=...`, the app checks for unclaimed placeholders. Users can auto-match by email or tap *"Which member are you?"* chips (`[ Rahul ] [ Sneha ] [ Join as new ]`) to atomically claim past expenses and debts. | Screen: `AcceptInviteScreen.tsx`, Backend: `POST /api/v1/groups/{id}/members/accept` with `claim_member_id`. |
| **Virtual Member Visual Indicators** | Distinctive cyan/purple pill badge (`Virtual • Unclaimed`) on member cards indicating participants who have not yet claimed their account. | Component: `MemberCard.tsx`. |
| **Multi-Currency Support** | Configure custom default group currencies: **INR (₹)**, **USD ($)**, **EUR (€)**, **GBP (£)**, etc. | Currency formatting with symbol resolution in `currency.ts`. |
| **Smart Invite Links & Deep Linking** | Generate unique invite links (`https://fairshare-url.expo.app/join?group=...`) to share with friends. | Native sharing dialog via `shareInvite.ts` (WhatsApp, SMS, Telegram, Clipboard). |
| **Role-Based Membership** | Group creators are assigned `Admin` privileges; other participants are assigned `Member` or `Viewer` roles. | Enforced in `backend/app/services/permissions.py`. |
| **Member Management & Removal** | Add existing users or new friends by name or email address; remove members safely with outstanding balance verification. | Component: `AddMemberModal.tsx`, Service: `memberService.ts`. |
| **Group Settings & Deletion** | Rename groups, switch default currencies, leave groups, or delete groups with database cascade safety. | Screen: `GroupSettingsScreen.tsx`, Cascade safe in `test_group_delete_cascade.py`. |

---

## 4. Expense Management & Calculation Engine

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **Full Expense Lifecycle** | Add, edit, view details, and delete group expenses with instantaneous balance recalculation. | Screens: `AddExpenseScreen.tsx`, `EditExpenseScreen.tsx`, `ExpenseDetailsScreen.tsx`. |
| **Expense Edit Tracking & Audit Trail** | When an expense is modified, it receives an amber/cyan `Edited` badge across the group ledger and activity feed. Inside the Expense Details screen, members can view the exact edit audit trail: original vs updated amount (`~~Original: ₹1,200~~ → New: ₹1,500`) and the exact timestamp the change occurred. | Migration: `0011_expense_previous_amount.py`, Model: `Expense.previous_amount`, Screen: `ExpenseDetailsScreen.tsx`, Component: `ExpenseCard.tsx`. |
| **1-Tap Expense Duplication** | One-tap `[ ⧉ Duplicate ]` action situated inside the Expense Details screen header. Instantly opens `AddExpenseScreen` pre-populated with `[Title] (Copy)`, original amount, category, split type, payer, location, and customized participant splits. Keeps the main feed clutter-free while saving time on recurring group expenses. | Screen: `ExpenseDetailsScreen.tsx` $\rightarrow$ `AddExpenseScreen.tsx`. |
| **Manual Multi-Currency Converter** | Integrated offline exchange rate calculator inside `AddExpenseScreen`. Users can select foreign currencies (**USD**, **EUR**, **GBP**, **THB**, **AED**, **SGD**, **JPY**) and specify their own manual exchange rate (e.g. 500 THB @ 2.45 = ₹1,225 INR). Completely eliminates third-party currency API dependencies for total data privacy, zero tracking, and airtight app safety. | Screen: `AddExpenseScreen.tsx`. |
| **Flexible Single & Multi-Payer** | Record expenses paid by a single individual or split payments across multiple people who contributed varying amounts ("Multiple People Paid" mode) with live contribution balance validation against the total bill and proportional participant split generation. | Modal: `PaidByPickerModal.tsx`, Screen: `AddExpenseScreen.tsx`. |
| **In-Group Live Expense Search** | Real-time text search inside the group expense ledger filtering instantly across expense titles, notes, categories, payer names, or amounts with clear icon action. | Screen: `GroupDetailsScreen.tsx`. |
| **4 Advanced Split Modes** | **1. Equally:** Divides expense evenly among selected members.<br>**2. Unequally:** Exact currency amounts per participant.<br>**3. Percentage (%):** Custom percentages summing to 100%.<br>**4. Shares (Units):** Ratio-based shares (e.g. 2 shares for couples). | Logic: `expenseCalculation.ts`, Verified by 6 automated unit tests in `expenseCalculation.test.ts`. |
| **Paisa / Cent Remainder Algorithm** | Solves the mathematical odd-cent division dilemma (e.g., ₹100 split 3 ways $\rightarrow$ ₹33.34, ₹33.33, ₹33.33) using the largest-remainder method. | Guarantees that the sum of split items strictly equals the expense total to the exact decimal. |
| **Categorization & Icons** | Categorize expenses into Food & Dining, Travel & Transport, Accommodation, Groceries, Entertainment, Utilities, or Other. | High-contrast category chips with dedicated icon glyphs. |
| **Receipt Attachments** | Attach receipt or bill image URLs to expenses with image preview cards. | Card preview in `AddExpenseScreen.tsx` and `ExpenseDetailsScreen.tsx`. |
| **Location Geocoding & Tagging** | Tag where an expense occurred with autocomplete place search powered by OpenStreetMap Nominatim. | Component: `ExpenseLocationPicker.tsx`, Service: `placeService.ts`. |
| **Cross-Platform Date/Time Picker** | Choose transaction timestamps via native spinners on iOS/Android, and native `<input type="datetime-local">` overlay on Web. | Component: `ExpenseDatePicker.tsx`. |

---

## 5. Tax, Tip & Additional Charge Distribution

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **Proportional Tax / Tip Distribution** | When a bill has extra charges (GST, restaurant service tax, delivery fees, driver tips), users enter base subtotal and tax/tip total. | Algorithm: `calculateProportionalAdditionalCharges()` in `mobile/src/utils/expenseCalculation.ts`. |
| **Fair Weighted Allocation** | Automatically distributes additional charges across participants proportionally based on their personal meal or item costs using largest-remainder cent rounding. | Prevents individuals with cheaper orders from subsidizing the tax/tip of expensive orders. Tested in `expenseCalculation.test.ts`. |
| **Interactive UI Calculator** | Live preview showing exact breakdown: Subtotal + Extra Charges = Grand Total. | Integrated into `AddExpenseScreen.tsx`. |

---

## 6. 1-Tap UPI Settlement & Payment QR Engine

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **1-Tap UPI Deep Linking** | On mobile devices, tapping "Pay with UPI" directly launches installed UPI apps (Google Pay, PhonePe, Paytm, BHIM, etc.) with pre-filled details. | Handled via `openUpiApp()` in `mobile/src/utils/upi.ts`. |
| **Direct 1-Tap App Launcher Pills** | Dedicated 1-tap launcher pills for specific popular payment apps: **Google Pay** (`tez://upi/pay?...`), **PhonePe** (`phonepe://pay?...`), **Paytm** (`paytmmp://pay?...`), and **Any UPI App** (`upi://pay?...`). | Handled via `openDirectUpiApp()` in `mobile/src/utils/upi.ts` and `mobile/src/components/SettleUpModal.tsx`. |
| **WhatsApp Payment Reminder Nudge** | One-tap `[ 💬 Remind ]` button that opens WhatsApp (`https://wa.me/?text=...`) with polite, pre-composed reminder text specifying the exact pending amount, payee name, and direct one-tap payment link. | Utility: `buildWhatsAppReminder()` in `mobile/src/utils/upiScheme.ts`, tested in `upiScheme.test.ts`. |
| **NPCI Compliant URI Generator** | Formats valid UPI links adhering to the official National Payments Corporation of India (NPCI) specification: `upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...`. | Implemented and verified in `mobile/src/utils/upiScheme.ts`. |
| **Strict VPA Validation** | Rejects invalid or dummy placeholder handles (e.g. `member@upi`) and enforces valid bank virtual payment addresses (`username@bank`). | Function: `isValidUpiId()`, tested in `upiScheme.test.ts`. |
| **Quick Bank Handle Autocomplete** | Tap-to-complete bank chips (`@okhdfcbank`, `@okaxis`, `@oksbi`, `@paytm`, `@ybl`, `@icici`) for fast 1-tap handle selection. | Interactive horizontal scroll in `SettleUpModal.tsx`. |
| **ISO Quiet-Zone Payment QR Code** | Generates high-resolution QR codes with the mandatory 4-module white quiet zone (`margin=4`) for instant camera scanner detection. | Generated via `getUpiQrCodeUrl()`, tested in `upiScheme.test.ts`. |
| **Dual-Provider QR Redundancy** | Automatic fallback to `quickchart.io` if the primary `qrserver.com` endpoint experiences network hiccups or ISP filtering. | Fallback handler: `getUpiQrCodeFallbackUrl()`. |
| **Persistent Payee VPA Memory** | Remembers a friend's UPI ID in local device storage (`AsyncStorage`) after the first settlement so you never have to re-enter it. | Storage key: `fairshare:upi_vpa:${payeeKey}` in `SettleUpModal.tsx`. |
| **Settlement Ledger Recording** | Recording a settlement updates debt ledgers, zeroes out balances, and posts an audit record in the group activity feed. | Backend: `POST /api/v1/groups/{id}/settlements`. |

---

## 7. Debt Simplification & Financial Ledger

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **Real-Time Group Balances** | Instant calculation of each member's net balance: positive amounts (Emerald Green `#10B981` — owed money) and negative amounts (Coral `#FF4B72` — owes money). | Service: `balanceService.ts`, Backend: `balance_service.py`. |
| **Greedy Debt Simplification** | Reduces complex multi-party debts into the minimum possible number of direct peer-to-peer payments (e.g. turning 12 confusing debts into 3 simple transfers). | Backend algorithm in `backend/app/services/debt_service.py`. |
| **Home Dashboard Balance HUD** | Floating top banner on the home screen aggregating your overall net financial position across all combined groups. | Component in `mobile/src/screens/home/HomeScreen.tsx`. |
| **Visual Category Spending Analytics & Proportion Bar** | Luxury visual breakdown showing total group expenditure, multi-color horizontal segmented proportion bar, individual category spending sums and percentages, and one-tap category filtering. | Component & analytics calculation in `GroupDetailsScreen.tsx`. |
| **Paid-By Member Filter** | Filter the entire group expense feed by a specific person to audit exactly what they paid for. | Segmented filter chips in `GroupDetailsScreen.tsx`. |
| **Luxury Skeleton Shimmer Loaders** | Replaced spinner wheels on the Home screen and Group Details screen with high-end pulsating animated gradient shimmer placeholders (`SkeletonLoader.tsx`) matching luxury dark cards. | Component: `SkeletonLoader.tsx`, integrated in `HomeScreen.tsx` and `GroupDetailsScreen.tsx`. |
| **Group Activity History Audit** | Chronological timeline feed showing every created expense, edit, deletion, settlement, and member addition. | Screen: `HistoryScreen.tsx`, Backend: `GET /api/v1/groups/{id}/history`. |

---

## 8. Statement Exports & Financial Reporting

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **Printable Styled PDF Statements** | Generates an executive, luxury-branded printable account statement with group summary, total expenses, member debts, and full itemized ledger. | Formatted HTML generator in `mobile/src/utils/statementExport.ts`. |
| **Browser Print & Mobile PDF Download** | Triggers native browser print dialog (`window.print()`) on web and provides shareable exports on mobile devices. | Modal: `ExportStatementModal.tsx`. |
| **CSV Spreadsheet Export** | Exports complete group financials into a clean `.csv` file formatted for Microsoft Excel, Google Sheets, or Apple Numbers. Tested for quote escaping, column alignment, and sorting. | Formatting: `statementFormatter.ts`, Verified in `statementFormatter.test.ts`. |

---

## 9. Trip & Journey Planning Engine

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **Trip Window & Dates** | Configure start date, end date, trip timezone, and journey notes for any trip-type group. | Screen: `TripDetailsScreen.tsx`, Backend: `backend/app/services/trip_service.py`. |
| **Cross-Platform Date Picker** | Native calendar popups on iOS and Android, plus invisible HTML5 `<input type="date">` overlay on Web. | Shared date utility: `mobile/src/utils/tripDates.ts`. |
| **Dynamic Day Count Calculator** | Automatically computes trip length (e.g., "5 Days") with leap-year and cross-month support. | Verified by unit tests in `tripDates.test.ts`. |
| **Day-by-Day Itinerary Builder** | Organize journey stops by day number (`Day 1`, `Day 2`, `Day 3`...). | Stored in `backend/app/models/trip.py` via migration `0005_trip_day_number.py`. |
| **Multi-Type Journey Stops** | Add three semantic stop types: **Start Point** (Teal `#0EA5A4`), **Intermediate Stop** (Blue `#2563EB`), and **Destination** (Orange `#F97316`). | Screen: `TripDetailsScreen.tsx`. |
| **Context-Aware Journey Save Architecture** | Completely eliminated the disruptive "Save journey changes" button that formerly divided the travel window dates from the day itinerary in the middle of the screen. Implemented automatic `isDirty` state tracking: trips flow seamlessly into the day itinerary when clean. When dates or details are modified, changes can be saved via:<br>1. **Top Header Action:** Glowing cyan `[ Save ]` action in the navigation header.<br>2. **Inline Date Card Chip:** Subtle `[ Save ]` chip right inside the Dates card header.<br>3. **Floating Bottom Dock Bar:** An elevated floating bar (`Unsaved journey changes • [ Save ]`) docked at the bottom of the screen. Initial setups feature a dedicated `[ Create Journey Plan ]` action. | Screen: `TripDetailsScreen.tsx`, Haptics: `haptics.ts`. |
| **Smart Stop-Type Guard & Validation** | Prevents duplicate `start` or `destination` stops across the entire trip. For Day 2 and subsequent days, automatically defaults stop type to `stop`. If a starting or destination stop already exists, locks the option with clear badge indicators (e.g. `(D1)`) and displays an inline error alert banner explaining the restriction. | Client validation & error banner in `TripDetailsScreen.tsx`, Backend 409 conflict guard in `trip_service.py`. |
| **Stop Reordering & Sequence** | Drag, drop, or re-sequence stops within any day or across the trip. | Backend: `PUT /api/v1/groups/{id}/trip/stops/reorder`. |
| **Interactive Map Location Picker** | Luxury dark UI modal with MapLibre vector map, debounced live search (320ms), instant clear button, category filter chips (`All`, `Attractions`, `Stays`, `Food`, `Transit`), popular quick destinations (`Goa`, `Manali`, `Ladakh`, etc.), recent selection history cached locally, animated pulsing radar pin, and smooth `easeTo` camera transitions. | Component: `TripLocationPickerModal.tsx`. |
| **Instant Map Pin Drop on Location Selection** | Selecting any search result or recent place immediately moves the camera and drops the pulsing cyan radar marker at the exact coordinates on the map without requiring the modal to be closed or reopened. Implemented dual-channel bridge synchronization: unwraps `__RNWV_HOST_MESSAGE__` postMessages and invokes `window.setMarker(lng, lat, true)` via JavaScript injection. | Component: `TripLocationPickerModal.tsx`. |
| **Expandable Itinerary Day Accordion (>3 Stops)** | In `GroupDetailsScreen.tsx` (Journey tab), eliminated the hard-coded `.slice(0, 3)` truncation that concealed stops beyond the 3rd. Days with >3 places now feature an interactive luxury pill button `[ +X more places ▾ ]` which expands in-place into `[ Show less ▴ ]`, displaying all stops with sequence badges, stop types, and full addresses. Trips with >3 days also feature a `[ Show all X days ▾ ]` toggle. | Screen: `GroupDetailsScreen.tsx`, Verified by tests in `tripDates.test.ts`. |
| **Universal Bulletproof Stop Deletion** | Fixed an issue where Web users could not delete trip stops because React Native Web's `Alert.alert` drops action button callbacks. Replaced with a custom themed in-app confirmation modal (`Remove Stop?`), optimistic local state updates for 0ms visual feedback, automatic route cache invalidation, and added a direct `[ Delete this stop ]` action inside the Edit Stop modal. | Screen: `TripDetailsScreen.tsx`, Backend: `DELETE /api/v1/groups/{id}/trip/stops/{stop_id}`. |
| **Trip Target Budget & Dynamic HUD** | Set an overall trip spending cap directly in `TripDetailsScreen`. `GroupDetailsScreen` features a luxury budget HUD with a 3-stage dynamic progress gauge: Cyan (`#00E5FF`) for <80% usage, Amber (`#F59E0B`) for 80–100% usage, and high-visibility Red (`#EF4444`) with an over-budget alert when spending exceeds the target limit. | Migration: `0012_trip_checklists.py` (`trips.budget`), Screens: `TripDetailsScreen.tsx`, `GroupDetailsScreen.tsx`. |
| **Categorized Packing & Shared Gear Checklist Engine** | Comprehensive trip checklist system supporting both **Personal Packing** and **Group Gear** with zero clutter:<br>• **Independent Personal Ticks:** Every traveler has their own private checkmark status for shared packing items via dedicated table `trip_checklist_user_status`. Checking an item marks it packed only for you without affecting friends.<br>• **100% Hidden Private Items:** Users can add personal items marked `[ 🔒 Private to Me ]`, which are strictly filtered at the database level (`created_by == :user_id`) so other group members cannot see them.<br>• **Group Gear & 1-Tap Claim:** Shared group equipment (Tents, First Aid, Speakers, Board Games) shows who volunteered or is assigned to bring it, with 1-tap `[ Claim ]` and group-wide packed status.<br>• **8 Rich Categories:** Items are organized into Clothing, Toiletries, Electronics, Documents, Medical, Gear, Food, and General with dedicated icon glyphs.<br>• **5 Pre-Loaded Template Starter Packs:** 1-Tap starter catalogs for Beach, Mountain / Hiking, Road Trip, Weekend Getaway, and International.<br>• **Selective / Category Batch Import:** Users can import entire packs, filter by specific categories, or selectively pick individual checklist items with live selection counters.<br>• **Suitcase Progress HUD:** Top visual progress card with animated luggage glyph, progress gauge, completion percentage, and active/packed count metrics. | Models: `TripChecklist`, `TripChecklistUserStatus`, Migration: `0012_trip_checklists.py`, Backend: `checklist_service.py`, Mobile: `ChecklistView.tsx`, `ChecklistImportModal.tsx`, `AddChecklistItemModal.tsx`. |

---

## 10. Interactive Road Mapping & Navigation (MapLibre + OpenFreeMap)

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **High-Performance Vector Map** | Embedded vector map using MapLibre GL JS and OpenFreeMap's crystal-clear Liberty vector style. | Screen: `TripMapScreen.tsx`. |
| **Universal WebView Bridge** | Single unified map renderer supporting both Web (custom `<iframe>` bridge) and Native mobile (`react-native-webview`). | Components: `UniversalWebView.web.tsx`, `UniversalWebView.native.tsx`. |
| **Real Driving Road Geometry** | Automatically calculates turn-by-turn driving routes between consecutive stops using OpenRouteService / OSRM with straight-line fallback. | Backend: `backend/app/services/route_service.py`. |
| **Dynamic Day Scope Filtering** | Switch between viewing the "Whole Trip" route or zooming into specific days (`Day 1`, `Day 2`) with camera re-fitting. | Filter chips in `TripMapScreen.tsx`. |
| **Stable HTML Memoization** | HTML and WebView sources are memoized with stop-hashes so state changes (routing spinners, day toggles) never destroy or reload the iframe. | Implemented via React `useMemo` in `TripMapScreen.tsx`. |
| **Local Indian Edge CDN** | MapLibre scripts and styles are delivered from `cdn.jsdelivr.net` with local edge POPs in Mumbai and Chennai for sub-200ms loading. | Configured with `<link rel="preconnect">` and `<link rel="dns-prefetch">`. |
| **Disk & DOM Caching** | Vector tiles, fonts, and sprite glyphs are cached on device disk to eliminate repeat network downloads. | Enabled via `cacheEnabled={true}` and `domStorageEnabled={true}`. |
| **Hybrid & Semantic Place Search** | Multi-stage geocoding pipeline with fuzzy typo tolerance (`find_spelling_suggestion`), automated query relaxation, curated destination index (150+ aliases/destinations), category icon mapping (`lodging`, `food`, `transit`, `attraction`, `city`), and clean hierarchical subtitle generation. Suggests *"Did you mean [Corrected Place]?"* for typos like `benglore` $\rightarrow$ `Bengaluru` or `manli` $\rightarrow$ `Manali`. | Backend: `backend/app/services/place_service.py`, Schema: `backend/app/schemas/place.py`. |

---

## 11. Offline-First Architecture & Real-Time Sync

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **Two-Tier Storage Cache** | Tier 1: In-memory hot cache for instant 0ms access.<br>Tier 2: Persistent device storage (`AsyncStorage` on native, `localStorage` on web). | Implemented in `mobile/src/services/offlineStorage.ts`. |
| **Instant Cache Hydration** | Groups, balances, trips, and map stops load instantly on app boot without waiting for server network responses. | Background network sync updates data silently. |
| **Offline Mutation Queue** | Actions taken while disconnected from the internet (e.g. on flights or remote trips) are queued and replayed when connection returns. | Managed via `mobile/src/services/offlineQueue.ts`. |
| **Offline Visual Status Banner** | Subtle top banner indicating *"You are offline • Changes will sync when reconnected"*. | Component: `OfflineStatusBar.tsx`. |
| **Supabase Realtime WebSockets** | Group overview and balances auto-update via WebSocket subscriptions when any other group member adds an expense or settlement. | Service: `mobile/src/services/realtimeService.ts`. |

---

## 12. Tactile Haptics & Premium Mobile Micro-Interactions

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **Contextual Haptic Feedback** | Tactile vibration feedback on iOS and Android devices powered by `expo-haptics`. | Utility: `mobile/src/utils/haptics.ts`. |
| **Selection / Tap Haptics** | Light haptic tick on tab selection, currency chip switching, and day filtering. | Function: `hapticSelection()`. |
| **Action Haptics** | Medium haptic thump on modal launches and 1-tap UPI triggers. | Function: `hapticMedium()`. |
| **Success Haptics** | Double haptic pulse when an expense is saved or a settlement is recorded. | Function: `hapticSuccess()`. |
| **Warning Haptics** | Sharp warning vibration on form validation errors or negative balances. | Function: `hapticWarning()`. |

---

## 13. Zero-Cost Push Notification Engine

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **Expo Push Notification Service** | Sends instant push alerts to members' phones when an expense or settlement is created. | Backend: `backend/app/services/notification_service.py`. |
| **Device Push Token Registration** | Automatically registers physical device Expo push tokens upon login. | Backend: `POST /api/v1/notifications/push-token`. |
| **Multi-Device Dispatch** | Broadcasts notifications to all group members except the user who initiated the action. | High-efficiency async batching. |

---

## 14. Production Security, Rate Limiting & Hardening

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **API Rate Limiting (`slowapi`)** | Token-bucket rate limiting protecting public and authenticated endpoints from abuse and DDoS. | Configured in `backend/app/core/rate_limit.py`. |
| **HTTP 429 Too Many Requests** | Structured JSON error with `Retry-After` header when rate limits are exceeded. | Exception handler in `backend/app/main.py`. |
| **OWASP Security Headers** | Injected on every HTTP response:<br>• `X-Content-Type-Options: nosniff`<br>• `X-Frame-Options: DENY`<br>• `X-XSS-Protection: 1; mode=block`<br>• `Strict-Transport-Security: max-age=31536000; includeSubDomains`<br>• `Referrer-Policy: strict-origin-when-cross-origin` | Middleware in `backend/app/main.py`. |
| **Server Response Timing** | `X-Response-Time-Ms` header included on every API response for latency tracking. | Middleware in `backend/app/main.py`. |
| **JWKS Cache Warming** | Pre-fetches and caches Supabase Auth public keys on server startup to eliminate JWT verification latency on the first request. | Function: `warm_jwks_cache()` in `backend/app/core/security.py`. |
| **Auth & Rate Limit Diagnosis Engine** | Translates cryptic Supabase Auth errors (`Email rate limit exceeded`, `over_email_send_rate_limit`, 60-second cooldowns, 429 Too Many Requests, user already exists) into human-friendly diagnoses. Explicitly informs the user why the hourly rate limit occurred, assures them that their placeholder account is already tracking expenses, and provides practical next steps. | Utility: `mobile/src/utils/authErrors.ts`, Verified in `authErrors.test.ts`, Integrated in `StatusBanner.tsx`, `SignUpScreen.tsx`, `LoginScreen.tsx`, `ForgotPasswordScreen.tsx`, `ResetPasswordScreen.tsx`, and `AcceptInviteScreen.tsx`. |
| **Universal API Error Translation Engine** | Centralized translation layer converting raw FastAPI status codes (401, 403, 404, 409, 422, 429, 500) and network disconnects into polite, actionable English messages. Flattens complex Pydantic 422 validation arrays into clean, natural sentences (e.g. *"Field Name: Message"* instead of `[object Object]`). | Backend: `RequestValidationError` & `HTTPException` handlers in `backend/app/main.py`; Mobile: `cleanApiErrorMessage()` in `mobile/src/services/apiClient.ts`. |
| **In-Modal Inline Validation Banners** | Modal workflows (`CreateGroupModal.tsx`, `AddMemberModal.tsx`, `SettleUpModal.tsx`, `ExportStatementModal.tsx`) feature high-contrast inline red error banners. Completely eliminates silent form rejections and intrusive popup alerts, keeping forms open with actionable guidance. | Component banners: `CreateGroupModal.tsx`, `AddMemberModal.tsx`, `SettleUpModal.tsx`, `ExportStatementModal.tsx`. |

---

## 15. 24/7 Keep-Alive & Cloud Reliability Integrations

| Feature | Description | Implementation Details |
| :--- | :--- | :--- |
| **Dedicated Dual Health Route** | Specialized health check endpoint: `GET /api/v1/health?db=1`. Responds with `{"status":"healthy","database":"active"}`. | Route in `backend/app/api/routes.py`. |
| **UptimeRobot 24/7 Cloud Monitor** | External automated monitor pinging the API every 5 minutes around the clock. | **Eliminates Render's 15-minute free tier sleep timeout (no 50s cold boot freeze).** |
| **Supabase 7-Day Inactivity Prevention** | The `?db=1` query parameter executes `SELECT 1` on PostgreSQL during health checks, permanently preventing Supabase from pausing after 7 days. | Monitored 24/7 at `fairshare-api-q7hd.onrender.com/api/v1/health?db=1`. |
| **GitHub Actions Keep-Alive Cron** | Redundant automated workflow `.github/workflows/keep_alive.yml` scheduled every 2 days to ping the health endpoint. | Continuous backup keep-alive mechanism. |
| **Client-Side Eager Warm-Up** | The web and mobile apps dispatch a non-blocking background ping to `/health?db=1` the instant the app starts up. | Initiated on module load in `mobile/src/services/apiClient.ts`. |

---

## 16. Comprehensive Test Suite & CI/CD Pipeline

| Test Suite | Scope & Coverage | Status |
| :--- | :--- | :--- |
| **Backend Pytest Suite** (`backend/tests/`) | **75 Automated Tests Passing (1 skipped):**<br>• Core FairShare API routes (20 tests)<br>• Database cascade deletion (1 test)<br>• Migration metadata verification (1 test)<br>• Checklist API, privacy isolation, group assignment & shared ticks (3 tests)<br>• Expense edit tracking & previous amount audit trail (1 test)<br>• Trip target budget creation, retrieval & patch updates (1 test)<br>• Placeholder members, batch onboarding & claim transfers (3 tests)<br>• Performance & latency routes (2 tests)<br>• Place geocoding API with fuzzy spelling & curated fallback (4 tests)<br>• Production hardening & rate limiting (2 tests)<br>• Route API & geometry caching (14 tests)<br>• Route strategy & individual legs (10 tests)<br>• JWT authentication security (2 tests)<br>• Financial split calculator logic (6 tests)<br>• Trip planning & stop lifecycle (5 tests) | **75 Passed, 0 Failed** |
| **Mobile Unit Test Suite** (`mobile/src/utils/*.test.ts`) | **59 Automated Unit Tests Passing across 9 Suites:**<br>• `authErrors.test.ts`: Supabase hourly email rate limits, 60s cooldowns, user already exists, invalid credentials, cold-start timeouts (6 tests)<br>• `checklistTemplates.test.ts`: 5 starter pack catalogs, metadata completeness, unique item IDs across packs, valid categories & scopes, personal & group gear distributions, icon/color mappings (6 tests)<br>• `currency.test.ts`: Symbol mapping, 2-decimal formatting, negative values, null safety (4 tests)<br>• `currencyConversion.test.ts`: Manual exchange multiplication, 2-decimal precision rounding, comma parsing, zero/negative/null input safety, summary formula generation (5 tests)<br>• `expenseCalculation.test.ts`: Equal split largest-remainder distribution, exact split verification, percentage allocations, shares ratios, proportional tax/tip allocation, zero/empty handling (9 tests)<br>• `memberOnboarding.test.ts`: Comma/newline bulk member parsing, deduplication, whitespace safety, and candidate auto-match resolution (6 tests)<br>• `statementFormatter.test.ts`: RFC 4180 CSV generation, quote/comma escaping, chronological sorting, ledger rows, and empty dataset handling (3 tests)<br>• `tripDates.test.ts`: Date parsing, ISO string conversion, multi-day math, leap-year boundary additions, date range validation, Indian locale formatting, itinerary day expansion, >3 stop pagination (9 tests)<br>• `upiScheme.test.ts`: NPCI VPA format validation, fake handle rejection, URI parameter encoding, `margin=4` quiet-zone QR generation, fallback QR generation, bank suffix lookup, direct deep links for GPay/PhonePe/Paytm, friendly WhatsApp settlement reminder encoding (9 tests) | **59 Passed, 0 Failed** |
| **TypeScript Static Check** | Strict static type verification across all screens, components, services, and navigation stacks. | **0 Errors (`npx tsc --noEmit`)** |
| **GitHub Actions CI Pipeline** (`.github/workflows/ci.yml`) | Multi-job matrix pipeline executing on every push to `main` and `dev`:<br>1. Ubuntu + PostgreSQL 16 container service database test.<br>2. Linear Alembic migration chain verification (`0012_trip_checklists`).<br>3. SQLite fallback verification.<br>4. Mobile TypeScript static check.<br>5. Mobile unit test runner (`npm test`).<br>6. Expo Web static production bundle export. | **Automated CI Active** |
| **Production Hosting Deployment** | Deployed live via Expo Application Services (EAS) Web Hosting. | **Live at [fairshare-url.expo.app](https://fairshare-url.expo.app)** |

---

*Last Updated & Verified: November 2026 (134 Total Automated Tests Passing)*  
*Maintained by Prajwal & the FairShare Engineering Team.*
