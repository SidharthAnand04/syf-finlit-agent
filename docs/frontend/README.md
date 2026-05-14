# Frontend

The frontend is a Next.js app under `frontend/`.

## Main Areas

- `src/app/chat/page.tsx` - public chat experience.
- `src/app/admin/` - admin console routes.
- `src/app/admin/context.tsx` - admin auth state and token cache.
- `src/lib/api.ts` - frontend API client for chat, FAQ, and admin endpoints.
- `src/components/ui/` - shared UI primitives.

## Admin Routes

- `/admin/overview`
- `/admin/sources`
- `/admin/faqs`
- `/admin/personality`
- `/admin/settings`
- `/admin/insights`

Admin users sign in with the backend `ADMIN_TOKEN`. The token is stored in browser localStorage and verified against `/admin/ping`.

## Runtime Notes

Set `NEXT_PUBLIC_BACKEND_URL` to the backend production URL in Vercel. If unset locally, the frontend defaults to `http://localhost:8000`.
