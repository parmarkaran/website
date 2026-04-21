/* ============================================================
   CharacterVerse — Supabase Config
   Fill in your project details below after setup.

   ── SETUP (one-time, ~10 min) ─────────────────────────────

   STEP 1: Create free account at https://supabase.com
           → New Project → choose any name & password

   STEP 2: In Supabase → SQL Editor → run this SQL:

      create table if not exists public.cv_characters (
        user_id    uuid references auth.users(id) on delete cascade primary key,
        data       jsonb not null default '[]',
        updated_at timestamptz default now()
      );
      alter table public.cv_characters enable row level security;
      create policy "own" on public.cv_characters
        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

      create table if not exists public.cv_conversations (
        user_id    uuid references auth.users(id) on delete cascade,
        char_id    text not null,
        data       text not null default '[]',
        updated_at timestamptz default now(),
        primary key (user_id, char_id)
      );
      alter table public.cv_conversations enable row level security;
      create policy "own" on public.cv_conversations
        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

   STEP 3: Authentication → Providers → Enable Google
           (needs a Google Cloud OAuth client — see supabase docs)
           Authentication → Providers → Enable Twitter/X
           (needs a Twitter Developer App)

   STEP 4: Authentication → URL Configuration
           - Site URL: your Cloudflare Pages URL
           - Redirect URLs: add your production URL + http://localhost:3000

   STEP 5: Settings → API → copy your Project URL + anon key below

   ── HOSTING (free) ────────────────────────────────────────
   → Push all files to a GitHub repo
   → Go to https://pages.cloudflare.com → Connect to GitHub
   → No build settings needed (pure static site)
   → Free subdomain: yoursite.pages.dev (or add custom domain ~$10/yr)

============================================================ */

const SUPABASE_URL  = 'https://aevjuzazqpqlpsrazrvn.supabase.co';        // e.g. https://abcxyz.supabase.co
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFldmp1emF6cXBxbHBzcmF6cnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NTA2NjIsImV4cCI6MjA5MjMyNjY2Mn0.Y18ynW-bOKCrR7LjTrEQdWM0jjgt5swR9YjHXwfu3ec';   // eyJhbGci... (safe to expose publicly)
