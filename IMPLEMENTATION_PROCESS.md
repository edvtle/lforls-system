# PLP Lost and Found System

## Implementation Process Guide

## 1. Goal

Implement a complete end-to-end Lost and Found System using the existing React + Vite frontend and Supabase for authentication, database, storage, and security, while preserving the current UI structure and route map.

## 2. Implementation Principles

- Preserve existing page layouts, component hierarchy, and navigation flow.
- Replace all mock and localStorage data flows with Supabase queries and mutations.
- Enforce role-based behavior for user and admin.
- Keep all important buttons connected to real backend actions.
- Use secure defaults through Row Level Security and ownership checks.

## 3. Architecture Target

- Frontend: React + Vite
- Backend: Supabase Auth, Postgres, Storage, Realtime
- Security: RLS on all app tables
- Roles: user, admin

## 4. Phased Process

### Phase 0: Baseline and Readiness

Objective: Prepare safe migration from localStorage to Supabase.

Tasks:

- Inventory current data contracts used by pages, cards, forms, and modals.
- Confirm route behavior and role expectations.
- Define loading, error, and empty-state conventions for async calls.
- Confirm cutover strategy from mock data to live data.

Output:

- Stable field mapping reference for migration.
- Clear error-handling and fallback behavior.

### Phase 1: Supabase Foundation and Auth

Objective: Establish authentication and session lifecycle.

Tasks:

- Add Supabase client and environment configuration.
- Build auth service for signup, login, logout, and session retrieval.
- Add global auth provider and hook for session and profile state.
- On signup, create matching profile row.
- Implement role-based redirects:
  - admin to /admin
  - user to /home
- Protect private routes and handle suspended or banned status.

Output:

- Working auth flow with persistent sessions.
- Route guards based on role and account status.

### Phase 2: Database Schema and Security

Objective: Create production schema, constraints, and policies.

Tasks:

- Create tables:
  - profiles
  - items
  - item_images
  - matches
  - claims
  - conversations
  - messages
  - notifications
  - flags
  - audit_logs
- Add constraints, defaults, indexes, and updated_at triggers.
- Enable RLS and implement policies for:
  - public and owner-safe item access
  - owner-only mutations unless admin
  - conversation-participant messaging access
  - user-only notification access
  - admin moderation access

Output:

- Migration file with schema and policy baseline.

### Phase 3: Storage and Upload Pipeline

Objective: Support media upload with secure access.

Tasks:

- Create storage buckets:
  - item-images
  - avatars
- Add upload helpers with deterministic path structure.
- Save uploaded image metadata in item_images.
- Apply file size and file type checks.

Output:

- Functional image upload and retrieval pipeline.

### Phase 4: Service Layer Migration

Objective: Replace local stores with Supabase services.

Tasks:

- Introduce service modules for:
  - auth
  - profiles
  - items
  - claims
  - matches
  - messages
  - notifications
  - flags
  - admin
  - audit
- Rewire pages to use services instead of mock stores.
- Preserve presentational component APIs where possible.

Output:

- Clean separation between UI and backend operations.

### Phase 5: User Module Integration

Objective: Complete all user workflows end-to-end.

Tasks:

- Home: recent items, search, filters, quick report actions.
- Report Lost Item: multi-step validation, insert report, upload images, trigger matching.
- Report Found Item: same as above for found flow.
- Browse Items: live query with search, filters, sort, pagination.
- Item Details: full info, images, claim button, message button, match confidence.
- Matches: ranked candidate pairs and confidence labels.
- Messages: create/open conversation, send messages, enforce participant scope.
- Notifications: list alerts and mark one or all as read.
- Profile: update profile, manage reports, track recovered items.

Output:

- User-facing flow is fully functional with live backend data.

### Phase 6: Admin Module Integration

Objective: Complete moderation and review operations.

Tasks:

- Dashboard: totals for lost, found, matches, pending claims, and flags.
- Manage Items: approve, reject, hide, soft-delete suspicious reports.
- Manage Users: suspend, ban, reactivate.
- Claims Review: approve or reject ownership claims.
- Reports and Flags: review and update moderation statuses.
- Analytics: report volume, recovery rate, matching metrics.
- Write audit logs for sensitive admin actions.

Output:

- Admin workflows are persisted and role-protected.

### Phase 7: Matching Pipeline

Objective: Implement hybrid matching and persistence.

Tasks:

- Compare only lost items against found items.
- Compute weighted scores for:
  - text similarity
  - metadata similarity
  - image similarity
  - time and location factors
- Apply final score formula:
  final_score = 0.45 _ text_score + 0.20 _ metadata_score + 0.25 _ image_score + 0.10 _ time_location_score
- If no image is available, redistribute image weight to text and metadata.
- Save top ranked matches for each new item.
- Trigger notifications when score threshold is met.
- Allow admin confirm or reject of suggested matches.

Output:

- Match records, ranking, confidence labels, and alert flow.

### Phase 8: Button-to-Action Completion

Objective: Ensure all important UI actions are connected.

Required actions to verify:

- Sign Up
- Login
- Logout
- Report Lost Item submit
- Report Found Item submit
- Next and Back in forms
- Submit Claim
- Contact Finder or Notify Owner
- Send Message
- Report Fake Item or Report User
- Mark as Claimed after approved claim
- Admin approve or reject actions
- Search, filter, sort
- Mark all notifications read
- Save Profile
- Delete Report as soft-delete where possible

Output:

- No critical button left unimplemented.

### Phase 9: Seed, QA, and Hardening

Objective: Prepare stable release behavior.

Tasks:

- Add realistic seed data for user and admin journeys.
- Create test checklist for all key flows.
- Validate loading, error, and empty states.
- Run role and RLS verification tests.
- Confirm soft-delete behavior and status transitions.

Output:

- Demo-ready and testable implementation baseline.

## 5. Current Progress Snapshot

Completed:

- Supabase auth foundation and provider wiring.
- Role-based route guard migration to context-based auth.
- Initial auth page wiring for signup and login.
- Initial database migration with schema, indexes, RLS, and storage policies.
- Home page wired to live item query path with fallback behavior.

In Progress:

- Replace remaining page-level localStorage flows with service-layer queries and mutations.
- Complete report, details, claims, messages, and notifications integrations.
- Complete admin moderation actions with database persistence and audit logging.
- Implement full matching pipeline persistence and notifications.

## 6. Verification Checklist

### Authentication and Access

- Signup creates auth user and profile row.
- Login redirects user by role.
- Session persists after refresh.
- Private routes reject unauthenticated users.
- Suspended or banned users cannot access protected modules.

### User Flows

- Lost and found reporting inserts records and uploads images.
- Browse supports search, filters, sort, and pagination.
- Details supports claim and message actions.
- Messaging is restricted to conversation participants.
- Notifications can be marked read individually and in bulk.
- Profile updates persist correctly.

### Admin Flows

- Dashboard metrics load from live data.
- Item moderation updates item status correctly.
- User moderation updates account status correctly.
- Claims review updates claim and related item state.
- Flags workflow updates review status correctly.
- Audit logs capture important admin actions.

### Matching

- New lost and found submissions generate ranked candidates.
- Match scores and confidence labels are stored correctly.
- Threshold matches generate notifications.
- Confirmed or rejected decisions are persisted.

### Data and Security

- RLS blocks unauthorized reads and writes.
- Users can only mutate their own allowed records unless admin.
- Soft-delete behavior is used for report deletion where required.

## 7. Deliverables

- Supabase SQL schema and migrations
- Storage bucket and policy setup
- React service layer for Supabase access
- Updated frontend pages with live integration
- Matching utility and generation pipeline
- Role-based auth guards
- RLS policy baseline
- Seed script
- User and admin test checklist
