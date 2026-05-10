# Adam's List — Property Review Platform

## What We Are Building
A closed-ecosystem web platform where licensed contractors review property owners as clients. Contractors look up a property address or find it on a map, see reviews left by other contractors, and leave their own reviews covering payment behaviour, job details, red flags, and interaction quality. Think of it as a Carfax for property owners, built by and for the trades industry. The platform is restricted to verified licensed contractors with valid state registration and insurance.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 | Frontend UI and backend API routes |
| Styling | Tailwind CSS | UI styling |
| Database | Supabase (PostgreSQL + PostGIS) | Data storage with geospatial support |
| Authentication | Supabase Auth + Google OAuth | Contractor sign in |
| Mapping | Mapbox + react-map-gl | Property map and address search |
| Payments | Stripe | Subscription management (not yet built) |
| Hosting | Vercel | Deployment via GitHub |
| Property Data | King County ArcGIS REST API | On-demand parcel data |
| Email | Resend | Transactional emails |
| CLI | Claude Code | AI-assisted development |

---

## Local Development Environment

- OS: Windows with WSL2 running Ubuntu
- IDE: VS Code connected to WSL
- Node: v24.14.0 via NVM
- npm: 11.9.0
- Python: 3.12.3 (WSL environment only, not in app)
- Git: 2.43.0
- Stripe CLI: 1.37.3
- Claude Code: installed and active
- Supabase CLI: authenticated and linked to project

---

## Online Accounts

| Service | Purpose |
|---------|---------|
| GitHub | Code repository — davidhisey-dev/property-review-platform |
| Supabase | Database and authentication — CLI authenticated and linked |
| Vercel | Hosting — property-review-platform.vercel.app |
| Mapbox | Maps and geocoding |
| Stripe | Payments (not yet integrated) |
| Google Cloud Console | Google OAuth credentials |
| Resend | Transactional email |

---

## Project Location
```
~/projects/property-review-platform
```

### Start dev server:
```bash
cd ~/projects/property-review-platform
npm run dev
```
App runs at **http://localhost:3000**

### Commit and deploy:
```bash
git add .
git commit -m "description"
git push origin main
```
Vercel auto-deploys on every push to main.

---

## Current Build Status

### Completed
- Foundation, file structure, environment variables
- Google OAuth authentication flow
- Auth callback route at `/auth/callback`
- Browser and server Supabase clients
- Supabase CLI authenticated and linked
- Migration folder at `supabase/migrations/`
- Full database schema with all migrations applied
- Middleware — full routing for all user states
- Contractor registration flow — form, pending, rejected, reapply
- Admin dashboard — four tabs (Pending, Active, Rejected, Feedback)
- Email notifications — submission, approval, rejection, suspension, review hiding via Resend
- Review form — 7 sections, conditional logic, stars, save/draft, submit
- Draft system — save, resume via property page banner and `?draftId=` param
- Dashboard — full screen map, slide-up panel, My Reviews panel
- Search bar — in AppHeader, available on dashboard, property, and review pages
- Property page — tabbed layout (Summary, Property Details, Reviews)
- Property page — at a glance aggregate section, parcel details, public records links
- Property page — review cards with full detail display
- Explore aggregate pins — color-coded by avg rating, NCNS forces red
- Navigation — AppHeader with hamburger drawer, consistent across all pages
- Review counts — in pin popups and panel list rows
- Multiple reviews per property supported
- Contractor history banner on property page
- Feedback reporting — in hamburger drawer, admin feedback queue
- Account status management — suspend, reinstate, hide/restore reviews
- Suspended user page at `/suspended`
- Database trigger — auto-rebuilds property_profiles on review status change
- KC parcel detail fields — zoning, legal description, plat, taxable values
- Public records links — eReal Property and Recorder's Office

### Not Yet Built
- Stripe subscription integration
- Apple Sign-In
- ATTOM lien data integration
- Stale draft edge function deployment (scaffolded, needs Docker)
- Explore aggregate pin clustering at scale
- Explore filter controls (rating, flag type, job type)
- Admin search/sort on contractor lists
- Satellite/aerial view toggle on property page
- Contractor-reported lien submission
- Review flagging/reporting
- Notification system
- Separate production Supabase project
- Custom domain

---

## Routing & Auth Flow

| User State | Route |
|-----------|-------|
| Unauthenticated | `/` (sign-in) |
| Authenticated — no users row | `/register` |
| Authenticated — registration_status = pending | `/register/pending` |
| Authenticated — registration_status = rejected | `/register/rejected` |
| Authenticated — approved but is_active = false | `/suspended` |
| Authenticated — approved and active | Through to requested route |
| Admin | Bypasses registration checks |

---

## Database Schema

### `users`
Contractor accounts linked to Supabase Auth.

Key fields: `display_name`, `email`, `company_name`, `business_type_id`, `license_number`, `license_state`, `license_classification`, `license_status`, `insurance_provider`, `insurance_policy`, `insurance_expiry`, `is_active`, `is_admin`, `reviews_hidden`, `registration_status` (pending/approved/rejected), `rejection_reason`, `rejected_at`, `suspended_at`, `suspension_reason`, `suspension_lifted_at`, `subscription_status`, `language_preference`

### `properties`
King County parcel data cached on demand.

Key fields: `parcel_number`, `address_full`, `city`, `state`, `zip_code`, `latitude`, `longitude`, `property_type`, `present_use`, `acreage`, `square_feet_lot`, `appraised_land_value`, `appraised_improvement_value`, `appraised_total_value`, `tax_year`, `last_sale_price`, `last_sale_date`, `last_sale_seller`, `last_sale_buyer`, `is_unincorporated`, `legal_desc`, `zoning`, `levy_code`, `levy_jurisdiction`, `taxable_land_value`, `taxable_improvement_value`, `tax_val_reason`, `new_construction`, `tax_account_number`, `plat_name`, `plat_lot`, `plat_block`, `kc_data_last_synced`

### `reviews`
Contractor reviews of property owners. Status enum: `draft`, `submitted`, `discarded`.

**Draft lifecycle:** `status`, `last_edited_at`, `discarded_at`, `stale_prompt_sent_at`, `snooze_until`

**Section 1 — Project Info:** `primary_contact_name`, `primary_contact_is_owner` (yes/no/unknown), `no_call_no_show`, `contractor_role`, `job_size`, `job_value`, `completed_project`, `job_completion_date`, `job_description`

**Section 2 — Overall Experience:** `overall_rating`, `would_work_again`

**Section 3 — Payment:** `paid_on_time`, `payment_timeliness`, `ease_of_collecting_payment`, `final_payment_experience`, `flag_payment_delays`, `flag_renegotiated_mid_project`, `flag_required_legal_action`

**Section 4 — Scope:** `scope_clarity`, `change_order_willingness`, `change_request_count`, `flag_expected_unpaid_work`, `flag_disputed_agreed_scope`

**Section 5 — Communication & Decision-Making:** `ease_of_interaction`, `responsiveness`, `professionalism`, `clear_decision_maker`, `decision_consistency`, `flag_hard_to_reach`, `flag_conflicting_directions`, `flag_frequent_reversals`, `flag_last_minute_changes`

**Section 6 — Timeline, Preparedness & Site:** `timeline_expectations`, `plan_design_readiness`, `financial_readiness`, `site_type`, `site_accessibility`, `flag_unrealistic_deadlines`, `flag_blamed_for_delays`, `flag_major_changes_after_start`, `flag_financial_issues_impacted`, `flag_site_restrictions_impacted`, `flag_safety_or_access_challenges`

**Section 7 — Review:** `title`, `body`, `watch_out_for` (150 char), `what_worked_well` (150 char)

### `payment_tactics`
Reference table — 10 payment avoidance behaviours.

### `red_flags`
Reference table — 10 client warning signs.

### `client_pattern_tags`
Reference table — 8 client pattern tags (Easy/Professional, Organized, Indecisive, Price-sensitive, Scope creeper, High expectations, Difficult/high conflict, High risk).

### `review_payment_tactics`
Junction table linking reviews to payment tactics.

### `review_red_flags`
Junction table linking reviews to red flags.

### `review_client_pattern_tags`
Junction table linking reviews to client pattern tags. Limit 3 per review enforced in UI.

### `property_profiles`
Aggregated review stats per property. Rebuilt automatically via database trigger on every review status change. Filters on `status = 'submitted'` AND `users.reviews_hidden = false` only.

Key fields: `review_count`, `avg_overall_rating`, averages for all 14 rating fields, counts for key flags including `no_call_no_show_count`. Uses `last_calculated_at` — not `updated_at`.

### `business_types`
Reference table — contractor profession types. Integer primary key. Includes: Electrician, Flooring, General Contractor, House Cleaning, HVAC, Landscaper, Mobile Detailing, Other, Painter, Pest Control, Plumber, Power Washing, Roofer, Specialist Trade, Window Washing.

### `subscriptions`
Stripe subscription and payment status per user (not yet integrated).

### `recently_viewed`
Tracks which properties each contractor has visited. Used for Recently Viewed feature. Unique constraint on (user_id, property_id). Entries older than 30 days cleaned up client-side.

### `feedback`
Contractor-submitted issue reports. Fields: `user_id`, `issue_type` (bug/wrong_information/inappropriate_content/other), `description`, `page_url`, `status` (open/reviewed/resolved/dismissed), `admin_notes`.

---

## Key File Structure
```
property-review-platform/
├── app/
│   ├── admin/page.tsx              ← four-tab admin dashboard
│   ├── account/page.tsx            ← contractor account management
│   ├── api/
│   │   ├── email/                  ← transactional email routes
│   │   │   ├── approve/route.ts
│   │   │   ├── reject/route.ts
│   │   │   ├── suspend/route.ts
│   │   │   ├── reinstate/route.ts
│   │   │   ├── reviews-hidden/route.ts
│   │   │   └── reviews-restored/route.ts
│   │   └── property/
│   │       ├── cache/route.ts      ← KC parcel cache
│   │       ├── rebuild/route.ts    ← property profile rebuild (admin only)
│   │       └── search/route.ts     ← KC ArcGIS address search
│   ├── auth/callback/route.ts
│   ├── dashboard/page.tsx          ← main map dashboard (landing page)
│   ├── property/[id]/
│   │   ├── page.tsx                ← property profile (tabbed)
│   │   └── review/page.tsx         ← review form
│   ├── register/
│   │   ├── page.tsx
│   │   ├── pending/page.tsx
│   │   └── rejected/page.tsx
│   ├── suspended/page.tsx          ← suspended account page
│   └── page.tsx                    ← sign-in page
├── components/
│   └── AppHeader.tsx               ← unified header with search + hamburger nav
├── lib/
│   ├── email.ts                    ← Resend email helpers
│   ├── supabase.ts                 ← browser client
│   └── supabase-server.ts          ← server client
├── supabase/
│   ├── migrations/                 ← all schema migrations
│   └── functions/
│       └── stale-draft-check/      ← daily cron (scaffolded, deploy when ready)
├── middleware.ts                   ← auth + registration status routing
└── .env.local
```

---

## Review Form — Final Locked Spec (7 Sections)

**Presentation:** Collapsible sections. Headers always visible. Conditional blocks expand based on input. Required fields marked *.

**Universal trigger rule:** Any rating ≤ 3 stars opens the issues sub-block for that section.

**Section 1: Project Info** — Always visible, always enabled. Primary Contact Name required in all cases including NCNS. NCNS = Yes locks Sections 2–7 (CSS hidden, data preserved), enables submit immediately.

**Section 2: Overall Experience** — Star rating, would work again, client pattern tags (limit 3).

**Section 3: Payment & Financial Behaviour** — Payment ratings, expands on any ≤ 3 or paid on time = No.

**Section 4: Scope & Change Behaviour** — Scope ratings (frequency of scope changes removed), expands on any ≤ 3.

**Section 5: Communication & Decision-Making** — Communication ratings, expands on any ≤ 3 or clear decision-maker = No.

**Section 6: Timeline, Preparedness & Site** — Timeline/site ratings, expands on any ≤ 3.

**Section 7: Your Review** — Always visible. Review text always enabled regardless of NCNS.

---

## Dashboard & Map

**Layout:** Full screen Mapbox map. AppHeader fixed at top with search bar and hamburger nav. Slide-up panel anchored to bottom with free positioning (collapses if released below 20vh). Tapping drag handle toggles collapsed ↔ 30vh.

**My Reviews panel:** Single tab, no Explore tab. Shows summary row (Drafts · Submitted · Total), draft list with stale badges, submitted list with star ratings and primary contact. Amber pencil-icon teardrop pins = drafts, color-coded teardrops = submitted (green/gray/red by rating).

**Aggregate pins:** Always visible on map. Color-coded by avg_overall_rating. NCNS count > 0 forces red regardless of rating. Green = 4.0+, Gray = 3.0–3.9, Red = below 3.0 or any NCNS. Opacity dims to 60% when panel is pulled up.

**Search:** In AppHeader, available on all pages. On dashboard: flies map to result. On property/review pages: navigates to dashboard with URL params. Mapbox geocoding with KC bbox/proximity bias. KC ArcGIS lookup on selection. Address normalization with ordinal protection. Mismatch detection with confirmation card.

**Pin colors:**
- Amber + pencil icon = draft (My Reviews)
- Color-coded teardrop = submitted/aggregate

---

## Draft System
- Save Draft always available alongside Submit
- 30-day inactivity prompt via email, 7-day snooze (one snooze only)
- After 37 days no action: soft-deleted (status = discarded)
- Draft resume via `?draftId=` param — surfaced on property page history banner and dashboard
- Edge function scaffolded at `supabase/functions/stale-draft-check/index.ts` — deploy when Docker available

---

## Property Page (Tabbed Layout)

Three tabs: **Summary** (default), **Property Details**, **Reviews [count]**

**Summary tab:**
- Property header with address, avg star rating, review count
- At a Glance section — would work again breakdown, section rating averages, flag counts, common pattern tags
- Your History banner — contractor's personal review history on this property, draft resume link

**Property Details tab:**
- KC parcel data: zoning, legal description, plat, new construction, levy jurisdiction, tax valuation note
- Taxable vs appraised comparison warning if >5% difference
- Public Records links:
  - eReal Property: `https://blue.kingcounty.com/Assessor/eRealProperty/Dashboard.aspx?ParcelNbr=[parcel_number]`
  - Recorder's Office: `https://recordsearch.kingcounty.gov/LandmarkWeb/search/index` (with parcel number shown for manual copy)

**Reviews tab:**
- Full review cards with all detail
- Card layout: NCNS banner, REVIEWER/CLIENT CONTACT sections, job context, overall rating, section ratings, pattern tags, payment tactics, red flags, watch out for, what worked well, review text, footer date
- Reviews from users with `reviews_hidden = true` are excluded

---

## Admin Dashboard (Four Tabs)

**Pending:** Registration queue, oldest first. Approve/reject with modal and email.

**Active:** All approved contractors A–Z. Expand for details. Actions per contractor:
- Admin toggle (cannot toggle own account)
- Suspend (with reason modal, sends email)
- Reinstate (inline confirm, sends email)
- Hide Reviews (inline confirm, rebuilds property profiles, sends email)
- Restore Reviews (inline confirm, rebuilds property profiles, sends email)
- Status badges: Suspended, Reviews Hidden

**Rejected:** Most recently rejected first. Reinstate button.

**Feedback:** Contractor-submitted issue reports. Filter by status. Expand to update status and add admin notes. Default shows Open + Reviewed. Dismissed items accessible via Dismissed filter with muted styling.

---

## Email Notifications (via Resend)
- Registration submitted
- Application approved
- Application rejected (with reason)
- Account suspended
- Account reinstated
- Reviews hidden
- Reviews restored

---

## KC ArcGIS Integration

**Parcel search endpoint:**
```
https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_Parcels/MapServer/0/query
```

**Address normalization:** USPS standard abbreviations applied before KC lookup. Ordinal numbers (1ST, 2ND, 3RD, 6TH etc.) protected from suffix replacement via placeholder pattern.

**Mismatch detection:** If KC returns a parcel whose house number differs from searched number by >20%, shows confirmation card rather than assuming correct parcel.

**Available but not used for lien data:** KC ArcGIS has no public lien/tax delinquency endpoints. eReal Property (Assessor) and Recorder's Office linked directly from property page.

---

## Database Functions & Triggers

### `rebuild_property_profile(property_id UUID)`
Recalculates all aggregate stats for a property from submitted reviews. Excludes reviews from users with `reviews_hidden = true`. Uses `SECURITY DEFINER`. Called by trigger automatically.

### `trigger_rebuild_property_profile()`
Database trigger on `reviews` table. Fires `AFTER INSERT OR UPDATE OR DELETE` for each row. Calls `rebuild_property_profile()` when a review status changes to or from `submitted`. Uses `SECURITY DEFINER`.

---

## Next Steps (Priority Order)

1. **Stripe subscription integration** — plan tiers, checkout, gating, webhooks, billing portal
2. **Apple Sign-In** — mirror Google OAuth via Supabase Auth
3. **Admin enhancements** — search/sort on contractor lists, subscription status visibility
4. **Stale draft edge function** — deploy when Docker available
5. **ATTOM lien data** — supplement KC Recorder data (requires contract)
6. **Satellite/aerial view** — Mapbox satellite toggle on property page
7. **Contractor-reported lien submission** — structured lien reporting in review form
8. **Review flagging** — contractors report inaccurate/abusive reviews
9. **Notification system** — email digest of new reviews on worked properties
10. **Explore filter controls** — filter pins by rating, flag type, job type
11. **Aggregate pin clustering** — Mapbox clustering at scale
12. **Vercel Pro upgrade** — before public launch ($20/month)
13. **Separate production Supabase project** — before public launch
14. **Custom domain** — when ready to go public
15. **Performance tuning** — PostGIS optimization, query profiling
16. **Mobile responsiveness pass** — full iOS Safari 14+ audit
17. **Accessibility pass** — ARIA labels, contrast ratios
18. **Beta contractor onboarding** — soft launch with known contractors
