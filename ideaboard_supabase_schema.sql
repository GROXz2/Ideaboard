
-- =======================================================
-- IdeaBoard AI — Supabase Schema (PostgreSQL 15+)
-- Generated for production bootstrap
-- Notes:
--  - Uses pgcrypto's gen_random_uuid() for UUIDs
--  - Uses pgvector for semantic search (vector(1536))
--  - Avoid reserved word "user": table is app_user
--  - Password fields are for hashed values ONLY
--  - Consider Supabase Auth for user identities in the future
-- =======================================================

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists vector;

-- ============== ENUM TYPES ==============
do $$ begin
    create type plan_type as enum ('free','premium');
exception when duplicate_object then null; end $$;

do $$ begin
    create type tier_type as enum ('free','pro','enterprise');
exception when duplicate_object then null; end $$;

do $$ begin
    create type role_type as enum ('owner','admin','editor','viewer');
exception when duplicate_object then null; end $$;

do $$ begin
    create type node_type as enum ('note','topic','task');
exception when duplicate_object then null; end $$;

do $$ begin
    create type node_status as enum ('todo','doing','done');
exception when duplicate_object then null; end $$;

do $$ begin
    create type template_status as enum ('draft','published','archived');
exception when duplicate_object then null; end $$;

do $$ begin
    create type attachment_type as enum ('audio','image','doc');
exception when duplicate_object then null; end $$;

do $$ begin
    create type provider_type as enum ('stripe','iap');
exception when duplicate_object then null; end $$;

do $$ begin
    create type task_status as enum ('todo','doing','done');
exception when duplicate_object then null; end $$;

do $$ begin
    create type priority_type as enum ('low','med','high');
exception when duplicate_object then null; end $$;

do $$ begin
    create type policy_source as enum ('upload','link','manual');
exception when duplicate_object then null; end $$;

do $$ begin
    create type knowledge_source as enum ('upload','link','wiki');
exception when duplicate_object then null; end $$;

do $$ begin
    create type ai_role_type as enum ('user','assistant','system','tool');
exception when duplicate_object then null; end $$;

-- ============== CORE IDENTITY / TENANCY ==============

create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_name text,
  name text,
  birth_date date,
  password text, -- store only salted+hashed value
  plan plan_type not null default 'free',
  created_at timestamptz not null default now()
);

create table if not exists org (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  contact_email text,
  tax_id text,
  password text, -- optional (hashed) if you need org-level secret
  tier tier_type not null default 'free',
  created_at timestamptz not null default now()
);

create table if not exists org_member (
  org_id uuid not null references org(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  role role_type not null default 'viewer',
  invited_by uuid references app_user(id),
  nombre text,
  usuario text,
  birth_date date,
  password text, -- optional (hashed); keep in sync with org policy
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- ============== BOARDS / GRAPH ==============

create table if not exists board (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references org(id) on delete set null,
  owner_user_id uuid not null references app_user(id) on delete restrict,
  title text not null,
  is_private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists node (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references board(id) on delete cascade,
  nombre text,
  type node_type not null default 'note',
  content jsonb not null default '{}'::jsonb,
  pos_x int not null default 0,
  pos_y int not null default 0,
  style jsonb,
  status node_status not null default 'todo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists edge (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references board(id) on delete cascade,
  from_node_id uuid not null references node(id) on delete cascade,
  to_node_id uuid not null references node(id) on delete cascade,
  label text,
  created_at timestamptz not null default now()
);

-- ============== TEMPLATES / MARKETPLACE ==============

create table if not exists template (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references org(id) on delete set null,
  creator_user_id uuid not null references app_user(id) on delete cascade,
  title text not null,
  description text,
  tags text[] not null default '{}',
  price_cents int not null default 0,
  cover_url text,
  status template_status not null default 'draft',
  json_schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists template_version (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references template(id) on delete cascade,
  version int not null,
  changes text,
  schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint uq_template_version unique (template_id, version)
);

create table if not exists purchase (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid not null references app_user(id) on delete cascade,
  template_id uuid not null references template(id) on delete restrict,
  provider provider_type not null,
  provider_receipt text,
  status text not null default 'paid', -- 'paid' | 'refunded'
  created_at timestamptz not null default now()
);

-- ============== AI RUN SUMMARY (OPTIONAL) ==============

create table if not exists ai_run (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references org(id) on delete set null,
  user_id uuid not null references app_user(id) on delete cascade,
  board_id uuid references board(id) on delete set null,
  node_id uuid references node(id) on delete set null,
  input text,
  output jsonb,
  model text,
  tokens_in int,
  tokens_out int,
  usd_cost numeric(10,4),
  created_at timestamptz not null default now()
);

-- ============== ATTACHMENTS / TRANSCRIPTIONS ==============

create table if not exists attachment (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references org(id) on delete set null,
  uploader_user_id uuid not null references app_user(id) on delete cascade,
  board_id uuid references board(id) on delete set null,
  node_id uuid references node(id) on delete set null,
  type attachment_type not null,
  mime text,
  url text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists transcription (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references attachment(id) on delete cascade,
  engine text,
  language text,
  text text,
  confidence numeric,
  created_at timestamptz not null default now()
);

-- ============== POLICIES / KNOWLEDGE (RAG) ==============

create table if not exists policy_doc (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references org(id) on delete cascade,
  title text not null,
  source policy_source not null,
  url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists policy_section (
  id uuid primary key default gen_random_uuid(),
  policy_doc_id uuid not null references policy_doc(id) on delete cascade,
  section_ref text,
  heading text,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists policy_embedding (
  id uuid primary key default gen_random_uuid(),
  policy_section_id uuid not null references policy_section(id) on delete cascade,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create table if not exists knowledge_doc (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references org(id) on delete cascade,
  title text not null,
  source knowledge_source not null,
  url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists doc_chunk (
  id uuid primary key default gen_random_uuid(),
  knowledge_doc_id uuid not null references knowledge_doc(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists doc_embedding (
  id uuid primary key default gen_random_uuid(),
  doc_chunk_id uuid not null references doc_chunk(id) on delete cascade,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

-- ============== TASKS / KPI ==============

create table if not exists task (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references org(id) on delete set null,
  board_id uuid not null references board(id) on delete cascade,
  node_id uuid references node(id) on delete set null,
  title text not null,
  description text,
  assignee_user_id uuid references app_user(id) on delete set null,
  due_date date,
  status task_status not null default 'todo',
  priority priority_type not null default 'med',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists kpi (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references org(id) on delete cascade,
  board_id uuid references board(id) on delete set null,
  node_id uuid references node(id) on delete set null,
  name text not null,
  definition text,
  target numeric,
  unit text,
  created_at timestamptz not null default now()
);

create table if not exists kpi_data_point (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references kpi(id) on delete cascade,
  timestamp timestamptz not null,
  value numeric not null,
  note text,
  created_at timestamptz not null default now()
);

-- ============== NOTIFICATIONS / AUDIT ==============

create table if not exists notification (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references org(id) on delete set null,
  actor_user_id uuid not null references app_user(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============== AI PROMPT HISTORY ==============

create table if not exists ai_thread (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references org(id) on delete cascade,
  board_id uuid references board(id) on delete cascade,
  node_id uuid references node(id) on delete cascade,
  started_by_user_id uuid references app_user(id) on delete set null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_message (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references ai_thread(id) on delete cascade,
  org_id uuid references org(id) on delete set null,
  user_id uuid references app_user(id) on delete set null,  -- null for assistant/tool
  role ai_role_type not null,
  content text,
  output jsonb,
  model text,
  temperature numeric,
  tokens_in int,
  tokens_out int,
  usd_cost numeric(10,4),
  latency_ms int,
  status text default 'ok', -- ok|error|blocked
  error_msg text,
  parent_message_id uuid references ai_message(id) on delete set null,
  transcription_id uuid references transcription(id) on delete set null,
  input_hash text,
  created_at timestamptz not null default now()
);

create table if not exists ai_context_ref (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references ai_message(id) on delete cascade,
  policy_section_id uuid references policy_section(id) on delete set null,
  doc_chunk_id uuid references doc_chunk(id) on delete set null,
  score numeric,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists ai_message_tag (
  message_id uuid not null references ai_message(id) on delete cascade,
  tag text not null,
  primary key (message_id, tag)
);

-- ============== INDEXES ==============

-- JSONB GIN indexes
create index if not exists idx_node_content_gin on node using gin (content);
create index if not exists idx_template_schema_gin on template using gin (json_schema);
create index if not exists idx_notification_payload_gin on notification using gin (payload);
create index if not exists idx_ai_message_output_gin on ai_message using gin (output);

-- Graph helpers
create index if not exists idx_node_board on node(board_id);
create index if not exists idx_edge_board on edge(board_id);
create index if not exists idx_edge_from on edge(from_node_id);
create index if not exists idx_edge_to on edge(to_node_id);

-- Marketplace
create index if not exists idx_template_org on template(org_id);
create index if not exists idx_template_creator on template(creator_user_id);

-- AI usage
create index if not exists idx_ai_run_user_created on ai_run(user_id, created_at);
create index if not exists idx_ai_message_thread_created on ai_message(thread_id, created_at);
create index if not exists idx_ai_message_org_created on ai_message(org_id, created_at);

-- Transcription full-text (Spanish); adjust to EN if needed
create index if not exists idx_transcription_fts on transcription
  using gin (to_tsvector('spanish', coalesce(text, '')));

-- Vector indexes (pgvector ivfflat). NOTE: requires ANALYZE and sufficient rows.
create index if not exists idx_policy_embedding_ivf on policy_embedding
  using ivfflat (embedding vector_cosine) with (lists = 100);
create index if not exists idx_doc_embedding_ivf on doc_embedding
  using ivfflat (embedding vector_cosine) with (lists = 100);

-- KPI queries
create index if not exists idx_kpi_org on kpi(org_id);
create index if not exists idx_kpi_data_ts on kpi_data_point(kpi_id, timestamp);

-- ============== (Optional) RLS STUBS ==============
-- Supabase recommends enabling RLS per table and adding policies.
-- Uncomment below and craft policies for your access model.

-- alter table app_user enable row level security;
-- alter table org enable row level security;
-- alter table org_member enable row level security;
-- alter table board enable row level security;
-- alter table node enable row level security;
-- alter table edge enable row level security;
-- alter table template enable row level security;
-- alter table template_version enable row level security;
-- alter table purchase enable row level security;
-- alter table ai_run enable row level security;
-- alter table attachment enable row level security;
-- alter table transcription enable row level security;
-- alter table policy_doc enable row level security;
-- alter table policy_section enable row level security;
-- alter table policy_embedding enable row level security;
-- alter table knowledge_doc enable row level security;
-- alter table doc_chunk enable row level security;
-- alter table doc_embedding enable row level security;
-- alter table task enable row level security;
-- alter table kpi enable row level security;
-- alter table kpi_data_point enable row level security;
-- alter table notification enable row level security;
-- alter table audit_log enable row level security;
-- alter table ai_thread enable row level security;
-- alter table ai_message enable row level security;
-- alter table ai_context_ref enable row level security;
-- alter table ai_message_tag enable row level security;

-- Example allow-all (NOT for prod)
-- create policy "dev_select_all" on board for select using (true);

-- =======================================================
-- END OF SCHEMA
-- =======================================================
