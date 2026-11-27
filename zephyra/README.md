# Zephyra

A black, minimal photo site. Visitors see one big masonry wall of your photos; only you can
add, rename or delete them, from a password-protected page at `/admin`.

- **Framework:** Next.js (React + TypeScript)
- **Font:** Jost, bundled with the site
- **Photos:** stored in Supabase (free tier is plenty to start)
- **Hosting:** Vercel (free tier)

## How it works

| Where | What |
| --- | --- |
| `/` | The public wall. Click a photo to view it full screen (← → keys, Esc). |
| `/admin` | Log in with your password, drag photos in, edit titles, delete. |
| `src/app/api/*` | The server code: login, upload, rename, delete. |
| `src/lib/resize.ts` | Runs in your browser: makes each photo sharp (up to 3000 px), small enough to upload, and **removes hidden location data** (GPS) from it. |
| `src/lib/store-*.ts` | Where photos are saved: a local folder while developing, Supabase when live. |

## Try it on your own computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
cd zephyra
cp .env.example .env.local      # then open .env.local and set ADMIN_PASSWORD
npm install
npm run dev                     # open http://localhost:3000 and http://localhost:3000/admin
```

Leave the two `SUPABASE_` lines empty for now. Photos are then saved in a `.data` folder that
is ignored by git.

## Put it online (one-time setup, about 15 minutes)

### 1. Create the photo storage (Supabase)
1. Make a free account at <https://supabase.com> and click **New project**. Pick any name and a strong database password.
2. When it finishes, open **SQL Editor → New query**, paste everything from `supabase/schema.sql`, and click **Run**.
3. Open **Project Settings → API**. Copy two things:
   - **Project URL** → this is your `SUPABASE_URL`
   - **service_role key** (under "Project API keys") → this is your `SUPABASE_SERVICE_ROLE_KEY`
   Treat the service_role key like a password. Never put it in a file you commit.

### 2. Publish the website (Vercel)
1. Make a free account at <https://vercel.com> and sign in with GitHub.
2. Click **Add New → Project** and pick this repository.
3. Set **Root Directory** to `zephyra`.
4. Open **Environment Variables** and add these four:
   - `ADMIN_PASSWORD`: the password you will use to log in
   - `SESSION_SECRET`: a long random string. Make one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Click **Deploy**. When it is done, open `your-site.vercel.app/admin`, log in, and add photos.

You can connect your own domain name later under the project's **Settings → Domains**.

## Good to know
- Each photo is re-saved at up to 3000 px on its long edge (at the highest quality that fits), plus a smaller 1200 px copy for the wall. Your original files are never uploaded.
- Logging in lasts 30 days on a device. Anyone with the password can upload, so keep it long and private.
- To change the password, change `ADMIN_PASSWORD` in Vercel and redeploy.
