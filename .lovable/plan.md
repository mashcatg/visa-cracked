# VisaCracker — Full MVP Plan

## Brand & Design

- **Colors**: Dark green `#003934` (primary dark), Green `#24e16a` (accent/CTA)
- **Logo**: VisaCracker logo uploaded — will be used in sidebar and auth pages
- **Style**: Modern, clean dashboard UI with dark green sidebar, white content area, green accent buttons, and highlights

---

## 1. Authentication

- **Email/password** sign up & login with Supabase Auth
- **Google OAuth** sign-in
- No landing page — unauthenticated users land on the **login page**, authenticated users go to the **dashboard**
- Forgot password / reset password flow

## 2. Dashboard (Home)

- **Left sidebar** with:
  - VisaCracker logo at top
  - Dashboard link
  - Search (also triggered via `Ctrl+K` — opens a command palette modal)
  - **"Create Interview"** button (prominent green CTA)
  - Recent Interviews list
- **Main content area** showing:
  - Total interviews count, average score, pass rate stats
  - Score trend chart over time
  - Recent interview cards with quick score preview

## 3. Create Interview Flow

- Click "Create Interview" → opens a **modal** with:
  - **Country selector** (populated from admin-managed countries)
  - **Visa type selector** (filtered by selected country, admin-managed)
  - **File upload** area (supporting documents)
  - Submit button
- On submit → immediately transition to the **Interview Room**

## 4. Interview Room (Vapi Integration)

- Full-screen interview view with:
  - Camera preview (user's webcam)
  - Microphone access
  - **Real-time subtitles** for both user and assistant speech
  - Speaking status indicator (who's talking)
  - End Interview button
- Uses **Vapi Web SDK** with your public key on the frontend
- Backend edge function uses your private key to securely create the web call
- On call end → automatically fetches call data (transcript, messages, recording URL, duration) from Vapi API via backend

## 5. Post-Interview Analysis (Gemini)

- After the interview ends, backend edge function:
  - Fetches full call data from Vapi
  - Sends transcript + messages to **Gemini 2.5 Flash** (your own API key) for deep analysis
  - Generates structured scoring: overall score, English score, confidence, financial clarity, immigration intent
  - Extracts grammar mistakes with corrections, red flags, and improvement plan
  - Stores everything in the database

## 6. Interview Report Page

- Detailed report view showing:
  - 🎯 **Overall Score** (0-100) with visual gauge
  - Category breakdown scores (English, Confidence, Financial Clarity, Immigration Intent)
  - ❌ **Grammar Mistakes** — original vs corrected
  - ⚠ **Red Flags** — highlighted warnings
  - ✅ **Improvement Plan** — actionable recommendations
  - Audio playback of the recording
  - Full transcript viewer
- **Download Report** button → generates a server-side PDF with all conversation data, scores, and analysis

## 7. Admin Panel

- Accessible only to users with the `admin` role
- Default admin: `mashcatg@gmail.com`
- **Users Management**: View all registered users
- **Admin Management**: CRUD other admin accounts
- **Countries Management**: Create, read, update, and delete countries
- **Visa Types Management**: CRUD visa types under each country
- **All Interviews**: View all users' interviews with their reports and scores

## 8. Backend (Supabase / Lovable Cloud)

- **Database tables**: profiles, user_roles, countries, visa_types, interviews, interview_reports
- **Edge functions**:
  - `start-interview` — securely creates Vapi web call
  - `get-interview-results` — fetches call data from Vapi after interview ends
  - `analyze-interview` — sends transcript to Gemini for scoring
  - `generate-report-pdf` — generates downloadable PDF report
- **RLS policies** on all tables for proper security
- **Secrets needed**: Vapi Private Key, Vapi Public Key, Gemini API Key