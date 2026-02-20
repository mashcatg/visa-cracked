

# Visa Cracked — Complete System Documentation

This file contains every configuration, feature, design token, API integration, workflow, and algorithm needed to recreate the entire "Visa Cracked" AI mock visa interview platform from scratch.

---

## 1. TECH STACK

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui (Radix primitives)
- **Backend**: Supabase (Auth, Database, Edge Functions, Storage)
- **Voice AI**: Vapi Web SDK (`@vapi-ai/web`)
- **AI Analysis**: Google Gemini 2.5 Flash via Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`)
- **Charts**: Recharts
- **Routing**: React Router v6
- **State**: React Query (TanStack), React Context for auth
- **Theme**: next-themes (dark/light mode)
- **Font**: Poppins (Google Fonts)

---

## 2. COLOR PALETTE AND DESIGN SYSTEM

### Brand Identity
- **Brand Name**: "Visa Cracked"
- **Design Philosophy**: Premium, flat design. Zero borders (`border-width: 0` globally), zero shadows (`shadow-none` on all cards).
- **Font**: Poppins throughout (headings and body)

### CSS Variables (Light Theme)
```
--background: 0 0% 98%           (near-white)
--foreground: 168 100% 11%       (dark green #003934)
--card: 0 0% 100%                (white)
--primary: 168 100% 11%          (dark green #003934)
--primary-foreground: 0 0% 100%  (white)
--secondary: 145 40% 96%         (very light green)
--accent: 145 78% 52%            (vibrant green #24e16a)
--accent-foreground: 168 100% 11%
--destructive: 0 84% 60%         (red)
--muted: 150 10% 94%
--muted-foreground: 168 15% 40%
--border: 150 15% 90%
--ring: 145 78% 52%
--radius: 0.75rem
```

### Sidebar Variables
```
--sidebar-background: 168 100% 11%     (dark green)
--sidebar-foreground: 145 30% 85%      (light green text)
--sidebar-primary: 145 78% 52%         (accent green)
--sidebar-accent: 168 80% 15%          (slightly lighter dark green)
--sidebar-border: 168 60% 18%
```

### Dark Theme
```
--background: 168 100% 5%
--foreground: 145 30% 90%
--card: 168 80% 8%
--primary: 145 78% 52%
--primary-foreground: 168 100% 5%
```

### Contextual Colors (NOT brand colors)
- **Red Flags**: `text-orange-500` (icon + bullet dots)
- **Grammar Mistakes**: `text-red-500` (icon + strikethrough text)
- **Corrected Text**: `text-emerald-600`
- **Score Colors**: >= 80 = `text-emerald-600`, >= 60 = `text-amber-500`, < 60 = `text-red-500`
- **All other icons**: `text-accent` (brand green)

### Global CSS Reset
```css
* {
  @apply border-border;
  border-width: 0;
}
```

### Shimmer Loading Animations
Three CSS classes for skeleton loading:
- `.shimmer-text` — gradient text shimmer (dark theme)
- `.shimmer-text-light` — gradient text shimmer (light theme)
- `.shimmer-block` — block/skeleton shimmer for placeholder shapes

All use `@keyframes shimmer` with `background-position` animation at 1.5-2s duration.

---

## 3. DATABASE SCHEMA

### Table: `profiles`
| Column | Type | Default |
|--------|------|---------|
| id | uuid | gen_random_uuid() |
| user_id | uuid | NOT NULL |
| full_name | text | NULL |
| avatar_url | text | NULL |
| credits | integer | 10 |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

**RLS**: Users read/update own profile. Admins read/update all profiles.

### Table: `user_roles`
| Column | Type | Default |
|--------|------|---------|
| id | uuid | gen_random_uuid() |
| user_id | uuid | NOT NULL |
| role | app_role enum | 'user' |

**Enum**: `app_role` = ('admin', 'moderator', 'user')
**RLS**: Users view own roles. Admins manage all roles.

### Table: `countries`
| Column | Type |
|--------|------|
| id | uuid |
| name | text |
| code | text |
| flag_emoji | text (nullable) |
| created_at | timestamptz |

**RLS**: Anyone can read. Admins can manage.

### Table: `visa_types`
| Column | Type |
|--------|------|
| id | uuid |
| country_id | uuid (FK -> countries) |
| name | text |
| description | text (nullable) |
| vapi_assistant_id | text (nullable) |
| vapi_public_key | text (nullable) |
| vapi_private_key | text (nullable) |
| created_at | timestamptz |

**RLS**: Anyone can read. Admins can manage.
**Note**: Per-visa-type Vapi credentials override global environment variables.

### Table: `interviews`
| Column | Type | Default |
|--------|------|---------|
| id | uuid | gen_random_uuid() |
| user_id | uuid | NOT NULL |
| country_id | uuid | NOT NULL |
| visa_type_id | uuid | NOT NULL |
| name | text | NULL |
| status | text | 'pending' |
| vapi_call_id | text | NULL |
| messages | jsonb | NULL |
| transcript | text | NULL |
| recording_url | text | NULL |
| duration | integer | NULL |
| cost | numeric | NULL |
| is_public | boolean | false |
| created_at | timestamptz | now() |
| ended_at | timestamptz | NULL |

**Status values**: `pending`, `in_progress`, `completed`, `failed`
**RLS**: Users CRUD own interviews. Admins view all. Anyone can view public interviews.

### Table: `interview_reports`
| Column | Type |
|--------|------|
| id | uuid |
| interview_id | uuid (unique) |
| overall_score | integer (0-100) |
| english_score | integer |
| confidence_score | integer |
| financial_clarity_score | integer |
| immigration_intent_score | integer |
| pronunciation_score | integer |
| vocabulary_score | integer |
| response_relevance_score | integer |
| summary | text |
| grammar_mistakes | jsonb (array) |
| red_flags | jsonb (array) |
| improvement_plan | jsonb (array) |
| detailed_feedback | jsonb (array) |
| created_at | timestamptz |

**RLS**: Users view own reports. Admins view all. Anyone can view reports for public interviews.
**No client INSERT/UPDATE/DELETE** — only service role (edge functions) writes to this table.

### Table: `credit_grants`
| Column | Type |
|--------|------|
| id | uuid |
| user_id | uuid |
| credits | integer |
| reason | text |
| granted_by | uuid |
| expires_at | timestamptz |
| created_at | timestamptz |

**RLS**: Admins manage. Users view own grants.

### Database Functions

**`has_role(uuid, app_role) -> boolean`** — SECURITY DEFINER function to check user roles without recursive RLS.

**`handle_new_user() -> trigger`** — On `auth.users` INSERT: creates profile row + assigns 'user' role. Extracts `full_name` and `avatar_url` from `raw_user_meta_data`.

**`update_updated_at_column() -> trigger`** — Auto-updates `updated_at` on row modification.

### Storage Buckets
- `interview-documents` (private)

---

## 4. AUTHENTICATION

- **Methods**: Email/password + Google OAuth
- **Email verification**: Required (no auto-confirm)
- **Google OAuth**: Uses `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`
- **Password reset**: `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + "/reset-password" })`
- **Auth context** (`src/lib/auth.tsx`):
  - `AuthProvider` wraps app, provides `user`, `session`, `isAdmin`, `isLoading`, `signOut`
  - Admin check: calls `supabase.rpc("has_role", { _user_id, _role: "admin" })`
  - `RequireAuth` component redirects to `/login` if not authenticated
  - `RequireAdmin` component redirects to `/dashboard` if not admin
  - Uses `onAuthStateChange` listener set up BEFORE `getSession()`

---

## 5. ROUTES

| Route | Component | Auth |
|-------|-----------|------|
| `/` | Redirect to `/dashboard` | — |
| `/login` | Login | Public |
| `/signup` | Signup | Public |
| `/forgot-password` | ForgotPassword | Public |
| `/reset-password` | ResetPassword | Public |
| `/dashboard` | DashboardPage | RequireAuth |
| `/interview/:id/room` | InterviewRoom | RequireAuth |
| `/interview/:id/report` | InterviewReportPage | RequireAuth |
| `/mock/:id/public` | PublicReportPage | Public |
| `/admin/*` | AdminPage (nested routes) | RequireAuth + RequireAdmin |
| `/admin/users` | AdminUsers | Admin |
| `/admin/admins` | AdminAdmins | Admin |
| `/admin/countries` | AdminCountries | Admin |
| `/admin/visa-types` | AdminVisaTypes | Admin |
| `/admin/interviews` | AdminInterviews | Admin |

---

## 6. EDGE FUNCTIONS (Supabase/Deno)

All edge functions have `verify_jwt = false` in config.toml but implement their own auth via Bearer token.

### 6.1 `start-interview`
- **Input**: `{ interviewId }` + Bearer auth token
- **Flow**:
  1. Verify user auth
  2. Fetch interview with joined `visa_types` (to get per-visa Vapi credentials)
  3. Update interview status to `in_progress`
  4. Return `{ publicKey, assistantId }` for client-side Vapi SDK
- **Credential priority**: `visa_types.vapi_public_key` > `VAPI_PUBLIC_KEY` env var

### 6.2 `get-interview-results`
- **Input**: `{ interviewId }` + Bearer auth token
- **Flow**:
  1. Verify user auth
  2. Fetch Vapi call data with retry (3 attempts, 5s apart)
  3. Check if call failed (status !== "ended", pipeline errors, no transcript)
  4. If failed: mark interview as `failed`, NO credit deduction
  5. If success: mark as `completed`, deduct 10 credits from user's profile
- **Credit deduction**: Only on successful calls. `Math.max(0, credits - 10)`

### 6.3 `fetch-vapi-data`
- **Input**: `{ interviewId }` + Bearer auth token
- **Flow**:
  1. Verify user owns the interview
  2. Get per-visa private key (fallback to global `VAPI_PRIVATE_KEY`)
  3. Fetch from `https://api.vapi.ai/call/{vapi_call_id}` with retry (2 attempts)
  4. Return: `{ recordingUrl, stereoRecordingUrl, transcript, messages, duration, cost, endedReason }`
- **Design principle**: Ephemeral data NOT stored in DB. Fetched live from Vapi every time.

### 6.4 `analyze-interview`
- **Input**: `{ interviewId }` + Bearer auth token
- **Flow**:
  1. Verify user auth
  2. Fetch interview + Vapi call data (messages, transcript)
  3. Build conversation text from messages or transcript
  4. If interview was auto-terminated (max-duration/too-short), add negative evaluation note
  5. Upsert blank `interview_reports` row
  6. Fire 4 parallel AI workers, await all, return success
- **AI Model**: `google/gemini-2.5-flash` via `https://ai.gateway.lovable.dev/v1/chat/completions`
- **Temperature**: 0.3, max_tokens: 4096
- **Auth**: `LOVABLE_API_KEY` in Authorization header

#### 4 Parallel AI Workers:
1. **Worker 1 (Summary)**: Returns `{ mock_name, overall_score, summary }`. Updates interview name + report.
2. **Worker 2 (Scores)**: Returns 7 category scores (0-100): `english_score`, `confidence_score`, `financial_clarity_score`, `immigration_intent_score`, `pronunciation_score`, `vocabulary_score`, `response_relevance_score`
3. **Worker 3 (Issues)**: Returns `{ grammar_mistakes[], red_flags[], improvement_plan[] }`
4. **Worker 4 (Feedback)**: Returns `{ detailed_feedback[] }` with per-question: question, answer, score, feedback, suggested_answer

### 6.5 `generate-report-pdf`
- **Input**: `{ interviewId }` + Bearer auth token
- **Output**: Base64-encoded plain text file (NOT actual PDF)
- **Format**: ASCII-art formatted report with box-drawing characters
- **Filename**: `visa-cracked-{name}-{date}.txt`

---

## 7. ENVIRONMENT SECRETS

| Secret | Purpose |
|--------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `VAPI_PUBLIC_KEY` | Default Vapi public key |
| `VAPI_PRIVATE_KEY` | Default Vapi private key |
| `VAPI_ASSISTANT_ID` | Default Vapi assistant ID |
| `LOVABLE_API_KEY` | Lovable AI Gateway API key |
| `GEMINI_API_KEY` | Google Gemini API key (unused — uses Lovable gateway) |

---

## 8. VAPI INTEGRATION

### Client-Side (InterviewRoom.tsx)
1. Call `start-interview` edge function to get `publicKey` + `assistantId`
2. Dynamically import `@vapi-ai/web`, create `new Vapi(publicKey)`
3. Start call: `vapi.start(assistantId)`
4. Save `call.id` as `vapi_call_id` in interviews table immediately
5. Listen to events:
   - `call-start`: set connected, hide loading
   - `call-end`: trigger `handleCallEnd`
   - `speech-start`/`speech-end`: toggle speaking indicator
   - `message` (type=transcript): update subtitle bar, detect farewell phrases
   - `error`: show error toast

### Farewell Detection (Auto-End)
Phrases: "call ended", "goodbye", "interview is over", "that concludes", "thank you for your time", "end of the interview", "have a good day", "all the best", "interview is complete", "that's all"
When detected in assistant transcript, auto-stop after 2s delay.

### Per-Visa-Type Credentials
Each visa type row can have its own `vapi_assistant_id`, `vapi_public_key`, `vapi_private_key`. The backend prioritizes these over global env vars.

---

## 9. INTERVIEW ROOM UI

### Layout
- Full-screen dark background (`bg-[#003B36]`)
- **Header**: Brand name, countdown timer, connection quality indicator
- **Main view**: Bot avatar (full-screen, centered) as default, user camera as PIP (top-right). Tap PIP to swap.
- **Controls bar**: Mic toggle, Subtitle toggle, End Mock Test button
- **Subtitle bar**: Single-line, translucent black pill at bottom center, truncated

### Timer
- `MAX_DURATION = 207` seconds (3:27)
- Countdown from MAX_DURATION, auto-ends at 0
- Warning toast at 30 seconds remaining
- Red text when <= 30s

### Bot Avatar
- Fully rounded (`rounded-full`)
- Gradient background: `from-accent/30 to-accent/10`
- Pulsing ring animation when speaking (`animate-ping` + `animate-pulse`)
- Shows "Speaking..." or "Visa Officer" label

### Camera PIP Sizes
- Desktop: `w-[160px] h-[200px]`
- Mobile: `w-[100px] h-[140px]`

### Mic Toggle
- Default on. Toggles `streamRef.current.getAudioTracks().enabled`
- On: `bg-white/10` | Off: `bg-red-500/80`

### Connecting Screen
- 4 messages rotate every 3s: "Preparing...", "Setting up...", "Loading...", "Almost ready..."
- After one full cycle, locks on "Almost ready..." permanently
- Animated progress dots below message

---

## 10. INTERVIEW REPORT PAGE

### Layout
- Two-column: `grid lg:grid-cols-[1fr_380px]`
- **Left column**: Audio player, Conversation transcript (chat bubbles), AI Summary, Detailed Feedback
- **Right column**: Overall score gauge, Category scores, Red Flags, Grammar Mistakes, Improvement Plan

### Chat Bubble System
- User messages: right-aligned, `bg-accent/10 border-accent/20 rounded-2xl rounded-br-sm`
- Officer messages: left-aligned, `bg-muted rounded-2xl rounded-bl-sm`
- Label: "You" (accent color) or "Officer" (muted)

### Overall Score Gauge
- SVG circle: `w-28 h-28`, `viewBox="0 0 120 120"`
- Background circle: `r=52, strokeWidth=8, opacity 20%`
- Progress circle: `strokeDasharray={score * 3.27} 327`, `rotate(-90 60 60)`, rounded cap
- Card background: gradient `from-primary to-primary/80`

### Progressive Loading (Polling)
- Poll every 5 seconds for updated report data
- Show shimmer skeletons per section until data arrives
- 120-second timeout: if no data, show "Regenerate Report" button
- Each section (summary, scores, issues, feedback) loads independently as workers complete

### Skeleton Loading
- Uses `shimmer-block` class divs matching the layout structure
- Full layout skeleton on initial load (two-column with circle gauge, category rows, transcript lines)

---

## 11. DASHBOARD

### Stats Cards (3)
- Total Mock Tests, Average Score (out of 100), Pass Rate (score >= 60)

### CTA Card
- "Ready to ace your visa interview?" with accent gradient background
- "Start Mock Test" button

### Score Trend Chart
- Area chart (Recharts) showing average score by date
- Gradient fill from accent color
- Only shown when > 1 data point

### Recent Mock Tests Grid
- Up to 6 most recent, `md:grid-cols-2 lg:grid-cols-3`
- Each card shows: flag emoji, country, visa type, score (color-coded), time ago

---

## 12. SIDEBAR

### Structure
- Collapsible (16px collapsed, 64px = w-16 / 256px = w-64 expanded)
- Mobile: Sheet overlay triggered by hamburger button (fixed top-left)

### Navigation Items
1. Dashboard (with active state)
2. Search (opens Cmd+K dialog / mobile drawer)
3. Create Mock Test button (accent green)
4. Credits display with "Buy" badge (opens pricing modal)
5. Recent Mocks list (last 5) with 3-dot menu (Share, Rename, Delete)
6. Admin Panel (only if `isAdmin`)

### Active Mock Highlighting
- Current report's mock highlighted: `bg-sidebar-accent/50 text-sidebar-foreground`

### User Dropdown (bottom)
- Trigger: avatar initials + name + ChevronRight icon
- Opens to the right (`side="right"`)
- Contains: name, email, credit progress bar, "Free Plan" badge, dark/light mode toggle (Switch), Logout button (destructive)

---

## 13. PRICING MODAL

3 plans (static, no payment integration yet):
- **Starter**: 10 mocks, 100 credits, 800 TK
- **Pro**: 20 mocks, 200 credits, 1,500 TK (marked "Most Popular")
- **Premium**: 40 mocks, 400 credits, 2,800 TK

---

## 14. ADMIN PANEL

### Tabs
- Users, Admins, Countries, Visa Types, All Mock Tests

### Admin Users
- Table with: Name, User ID, Credits, Joined date, Grant Credits button
- Grant Credits dialog: amount, reason, expiry date
- Granting: inserts `credit_grants` record + updates `profiles.credits`

### Admin Features
- CRUD for countries (name, code, flag_emoji)
- CRUD for visa types (name, description, Vapi credentials per type)
- View all interviews across users
- Manage admin roles

---

## 15. WORKFLOWS

### Complete Mock Test Flow
```
1. User clicks "Start Mock Test" -> CreateInterviewModal opens
2. Selects country + visa type -> creates `interviews` row (status=pending)
3. Navigates to `/interview/{id}/room` (InterviewRoom)
4. Room calls `start-interview` edge function -> gets Vapi credentials
5. Vapi SDK starts call, saves `vapi_call_id` to DB
6. 3:27 countdown begins, user speaks with AI officer
7. Call ends (timer/manual/farewell detection)
8. `get-interview-results` edge function called:
   - Fetches Vapi call data (retries 3x)
   - If failed: marks interview failed, no credit deduction
   - If success: marks completed, deducts 10 credits
9. Navigate to `/interview/{id}/report`
10. Fire `analyze-interview` (async, non-blocking)
11. Report page polls every 5s for progressive updates
12. 4 AI workers fill in report sections in parallel
```

### Credit System
- New users start with 10 credits (profile default)
- Each successful mock costs 10 credits
- Credits checked client-side before creating interview
- Credits deducted server-side only after successful Vapi call
- Admins can grant credits via admin panel
- Credit grants tracked in `credit_grants` table

### Public Sharing
- Toggle `is_public = true` on interview
- Share URL: `/mock/{id}/public` (no auth required)
- RLS allows anyone to read public interviews and their reports

---

## 16. KEY ARCHITECTURAL DECISIONS

1. **Ephemeral data**: Recording URLs, transcripts, messages, duration, cost are NOT stored in DB. They are fetched live from Vapi API every time via `fetch-vapi-data` edge function. Only `vapi_call_id` is persisted.

2. **Parallel AI analysis**: 4 independent workers run simultaneously to minimize wait time. Each writes its section to `interview_reports` independently. The UI polls and renders each section as it arrives.

3. **Credit deduction server-side**: Credits are only deducted in `get-interview-results` after confirming the Vapi call succeeded. Failed calls (pipeline errors, no transcript) result in zero credit deduction.

4. **Per-visa Vapi config**: Each visa type can have its own Vapi assistant, public key, and private key. This allows different AI officer personalities per visa category.

5. **Service role for reports**: `interview_reports` has no client INSERT/UPDATE policies. Only edge functions using `SUPABASE_SERVICE_ROLE_KEY` can write to it.

---

## 17. SEARCH SYSTEM

- Desktop: `CommandDialog` (cmdk) with `Cmd+K` shortcut
- Mobile: Drawer with text input
- Searches user's interviews by name, country, visa type
- Navigates to report page on selection

---

## 18. RESPONSIVE DESIGN

- Mobile detection: `useIsMobile()` hook (checks viewport width)
- Mobile adaptations:
  - Sidebar becomes Sheet overlay with hamburger trigger
  - Dialogs become Drawers (bottom sheet)
  - CommandDialog becomes search Drawer
  - Interview room: smaller PIP, shorter button text
  - Main content gets `pt-16` padding for hamburger button
- User dropdown opens `side="right"` with `sideOffset={8}` to avoid mobile browser bottom nav

---

## 19. ASSETS

- `src/assets/logo.png` — Full logo (used on auth pages)
- `src/assets/logo-alt.png` — Alternative logo
- `src/assets/sidebar-logo.png` — Sidebar logo (light, for dark background)

