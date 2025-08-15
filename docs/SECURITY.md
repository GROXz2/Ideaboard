# Security Notes

Row Level Security (RLS) is disabled for the MVP. For production deploys enable
RLS on all tables and create policies such as:

- **board/node/edge**: members of an organization can read, owners can write.
- **ai_thread/ai_message/ai_run**: restrict by board/org and user role.
- **attachment**: uploader or board members can access.
- **purchase**: buyer can read; system updates via service role.

Use Supabase Policies to scope every table by `org_id` and `owner_user_id` where
applicable.
