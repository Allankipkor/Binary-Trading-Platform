# SmartDollarFX

A binary options trading platform built with Next.js, Prisma, and Neon Postgres.

## Features

- **Landing page** — Marketing site with live ticker and chart preview
- **User authentication** — Register, login, JWT sessions via NextAuth
- **Trading platform** — Real trades stored in database when logged in; demo mode available
- **Payments** — M-Pesa STK Push via PayHero, USDT TRC20 crypto deposits
- **Admin panel** — User management, payment config, dashboard stats

## Quick Start

```bash
npm install
# For local dev with SQLite:
cp .env.example .env
# Edit .env: set DATABASE_URL="file:./dev.db"
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Default admin login
- **Email:** admin@smartdollarfx.com
- **Password:** Admin@123

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login` | Sign in |
| `/register` | Create account |
| `/trade` | Live trading (requires login) |
| `/trade?demo=true` | Demo mode ($10k virtual balance) |
| `/admin` | Admin dashboard |
| `/withdraw` | Withdrawal page |

## Deploy to Vercel

1. **Database** — Create a free [Neon Postgres](https://neon.tech) database, copy the connection string
2. **Environment Variables** — In Vercel dashboard, set all variables from `.env.example`:
   - `DATABASE_URL` — Neon connection string
   - `AUTH_SECRET` — Run `openssl rand -base64 32`
   - `NEXTAUTH_URL` — Your production URL (e.g. `https://smartdollarfx.vercel.app`)
   - PayHero & crypto settings
3. **Push schema** — Run `npx prisma db push` locally against the Neon URL, or let Vercel's build command handle it
4. **Seed admin** — `npx tsx prisma/seed.ts` against the production DB
5. **Deploy** — Connect your GitHub repo to Vercel and deploy

## Environment Variables

Copy `.env.example` to `.env` and fill in your values.

## Tech Stack

- Next.js 15 (App Router)
- NextAuth v5 (credentials)
- Prisma + PostgreSQL (Neon)
- Tailwind CSS 4
- M-Pesa PayHero API
- Zod validation
