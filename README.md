# IdeaBoard Edge Functions

Backend MVP for IdeaBoard using Supabase Edge Functions (Deno).

## Requirements

- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Deno](https://deno.land/)

## Environment

Copy `.env.example` to `.env` and fill values.

## Database

Apply schema using Supabase CLI:

```bash
supabase db reset --db-url "$SUPABASE_DB_URL" --file db/ideaboard_supabase_schema.sql
```

## Local development

Start services and serve functions:

```bash
supabase start
supabase functions serve ai-run --env-file .env
supabase functions serve attachments-sign-url --env-file .env
supabase functions serve webhooks-stripe --env-file .env
```

## Deployment

Deploy functions to Supabase:

```bash
supabase functions deploy ai-run
supabase functions deploy attachments-sign-url
supabase functions deploy webhooks-stripe
```

## Notes on security

Row Level Security is disabled for the MVP. See `docs/SECURITY.md` for
recommendations on enabling policies per table in production.
