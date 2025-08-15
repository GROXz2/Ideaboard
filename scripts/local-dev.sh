#!/usr/bin/env bash
set -euo pipefail
supabase start
supabase functions serve ai-run --env-file .env &
supabase functions serve attachments-sign-url --env-file .env &
supabase functions serve webhooks-stripe --env-file .env &
wait
