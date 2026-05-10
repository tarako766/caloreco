# Calreco

おすすめ構成（実装中）:

- Front: Next.js App Router
- UI: Tailwind + shadcn/ui（最小コンポーネント）
- API: Next.js Route Handler
- AI: Gemini 2.5 Flash
- DB: PostgreSQL
- ORM: Prisma

## 1) セットアップ

```bash
npm install
cp .env.example .env
```

`.env` の `GEMINI_API_KEY` を埋めてください。

## 2) DB（PostgreSQL）

Docker が使える場合:

```bash
docker compose up -d db
```

※ Docker が起動していないと失敗します（Docker Desktop を起動）。

Prisma（初回）:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

## 3) 開発サーバー

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## 4) API

- `POST /api/chat`
- body: `{ "message": "..." }`
- env: `GEMINI_API_KEY`

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
