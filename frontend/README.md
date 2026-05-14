# Frontend

Next.js app for the public chat experience and admin console

## Key Paths

- `src/app/chat/page.tsx` - public chatbot UI.
- `src/app/admin/` - protected admin console routes.
- `src/app/admin/context.tsx` - admin auth/session state.
- `src/lib/api.ts` - API client for chat, FAQs, and admin endpoints.
- `src/components/ui/` - shared UI primitives.

## Commands

```powershell
npm install
npm run dev
npm run build
```

## Environment

Set `NEXT_PUBLIC_BACKEND_URL` to the deployed backend URL. If unset locally, the app uses `http://localhost:8000`.

## Deployment

Deploy this folder as the Vercel frontend project. The Vercel Root Directory must be `frontend`.
