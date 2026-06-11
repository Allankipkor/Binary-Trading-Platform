# OpenMarket

A binary options trading platform inspired by TagOption, rebranded as **OpenMarket** with a full backend.

## Features

- **Landing page** — Marketing site with live ticker and chart preview
- **User authentication** — Register, login, JWT sessions via NextAuth
- **Trading platform** — Real trades stored in database when logged in; demo mode available
- **Payments** — M-Pesa STK Push, USDT TRC20 crypto, card placeholder
- **Database** — SQLite via Prisma (User, Trade, Transaction models)

## Quick Start

```bash
npm install
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login` | Sign in |
| `/register` | Create account |
| `/trade` | Live trading (requires login) |
| `/trade?demo=true` | Demo mode ($10k virtual balance) |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| GET | `/api/user/me` | Current user & balance |
| GET/POST | `/api/trades` | List/settle trades, place trade |
| GET | `/api/prices?assetId=&tick=true` | Price feed |
| POST | `/api/payments/deposit` | M-Pesa, crypto, or card deposit |
| POST | `/api/payments/withdraw` | Withdrawal request |
| POST | `/api/payments/crypto/confirm` | Confirm crypto tx hash |
| POST | `/api/payments/mpesa/callback` | M-Pesa webhook |
| GET | `/api/payments/history` | Transaction history |

## Environment Variables

Copy `.env.example` to `.env`:

```bash
DATABASE_URL="file:./dev.db"
AUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# M-Pesa Daraja API — https://developer.safaricom.co.ke
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=174379
MPESA_PASSKEY=
MPESA_CALLBACK_URL=http://localhost:3000/api/payments/mpesa/callback
USD_TO_KES=130

# Crypto USDT TRC20
CRYPTO_USDT_ADDRESS=your_trc20_address
CRYPTO_AUTO_CONFIRM=true   # auto-credit in dev
```

### M-Pesa Setup

1. Register at [Safaricom Daraja](https://developer.safaricom.co.ke)
2. Create an app and get Consumer Key/Secret
3. For sandbox STK push, use shortcode `174379` and the sandbox passkey
4. Expose your callback URL publicly (use ngrok for local dev)

### Crypto Setup

- Set `CRYPTO_USDT_ADDRESS` to your TRC20 wallet
- With `CRYPTO_AUTO_CONFIRM=true`, deposits credit instantly (dev only)
- In production, users send USDT then submit tx hash for confirmation

## Tech Stack

- Next.js 15 (App Router)
- NextAuth v5 (credentials)
- Prisma + SQLite
- Tailwind CSS 4
- M-Pesa Daraja API
- Zod validation
