IdeaBoard AI — README (MVP)
=================================

Estado: MVP para validación con usuarios
Fecha: 2025-08-15

Resumen
-------
IdeaBoard es una app **mobile‑first** para lluvia de ideas con una pizarra de post‑its conectados y **IA por nodo**. Este README define variables de entorno, la base de datos (tablas, relaciones y cómo se comunican) y las funciones del MVP listas para que el backend (en Supabase Edge Functions) y el frontend (React Native + Expo) trabajen.

Stack recomendado
-----------------
- **Frontend**: React Native (Expo, TypeScript), React Query, Zustand/Redux (opcional), Supabase JS.
- **Backend**: Supabase (PostgreSQL 15 + pgvector), Edge Functions (Node 18), Storage, Realtime.
- **IA (MVP)**: API de OpenAI (modelos GPT‑4o‑mini / gpt‑4.1‑mini o equivalente).
- **Autenticación**: Supabase Auth (o placeholder si usas app_user).
- **Pagos (Marketplace)**: Stripe Webhooks (MVP simple).
- **Infra**: Supabase proyecto gestionado + Vercel (web) / EAS (móvil).

Variables de entorno
--------------------
### Comunes (Frontend y Edge Functions)
- `EXPO_PUBLIC_SUPABASE_URL` — URL del proyecto Supabase.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Public anon key.
- `OPENAI_API_BASE` — (opcional) base URL del proveedor de IA.
- `OPENAI_API_KEY` — api key del modelo.

### Sólo Edge Functions
- `SERVICE_ROLE_KEY` — clave service role de Supabase (para acciones de sistema puntuales).
- `STRIPE_WEBHOOK_SECRET` — secreto de webhook de Stripe.
- `RAG_TOPK` — topK por defecto para búsquedas semánticas (ej. `5`).
- `MAX_TOKENS_PER_RUN` — cota de tokens por ejecución (ej. `4000`).

### Sólo Frontend (Expo)
- `EXPO_PUBLIC_DEFAULT_MODEL` — modelo por defecto (ej. `gpt-4o-mini`).
- `EXPO_PUBLIC_FEATURE_RAG` — `true|false` para habilitar RAG.
- `EXPO_PUBLIC_MAX_MESSAGE_CHARS` — cota UX de caracteres por prompt.

Base de datos (tablas y relaciones)
-----------------------------------
> Esquema: PostgreSQL 15, con **pgvector** para embeddings. Los nombres de tablas y FKs se leen de los archivos `ideaboard_supabase_schema.sql` y `ideaboard_erd_complete_v3.pdf`.

### 1) Identidad / Tenancy
- **app_user** ← usuarios de la app.
- **org** 1..N **org_member** N..1 **app_user** — membresías y roles (`owner|admin|editor|viewer`).

### 2) Pizarra / Grafo
- **board**: tablero; `owner_user_id` y `org_id` (nullable).
- **node**: post‑it/nodo dentro de un `board` con `type (note|topic|task)`, `content (jsonb)` y posición `pos_x/pos_y`.
- **edge**: relación dirigida `from_node_id` → `to_node_id` dentro del mismo `board`.

### 3) IA Conversacional (por nodo y por board)
- **ai_thread**: hilo de conversación anclado a `board_id` y opcionalmente a `node_id`. `started_by_user_id` rastrea el autor.
- **ai_message**: mensajes dentro del hilo (roles `user|assistant|system|tool`), guarda `model`, `temperature`, `tokens_in/out`, `usd_cost`, `latency_ms`, `status`, relación opcional a `transcription` (audio→texto).
- **ai_run**: métrica/resumen por ejecución (input/output, costos y tokens) vinculable a `board_id` y/o `node_id`.
- **ai_message_tag**: tags por mensaje (para pin, clasificación).
- **ai_context_ref**: referencias a contexto RAG por mensaje (sección de política o chunk documental con `score` y `reason`).

### 4) Adjuntos y Transcripción
- **attachment**: archivos (audio, imagen, doc) con `url`, `mime`, `board_id`/`node_id` opcionales y `uploader_user_id`.
- **transcription**: resultado STT vinculado 1..1 a `attachment` (texto, idioma, confianza).

### 5) Conocimiento y Políticas (RAG)
- **policy_doc** → **policy_section** → **policy_embedding (vector(1536))**.
- **knowledge_doc** → **doc_chunk** → **doc_embedding (vector(1536))**.

### 6) Tareas y KPI
- **task**: tareas vinculadas a `board_id` (y opcionalmente `node_id`), con `assignee_user_id`, `status`, `priority`, `due_date`.
- **kpi**: definiciones por `org_id` y opcionalmente `board_id`/`node_id`.
- **kpi_data_point**: series temporales para cada KPI.

### 7) Marketplace
- **template** y **template_version** (JSON Schema de plantillas; estado `draft|published|archived`).
- **purchase**: compras por `buyer_user_id`, `provider (stripe|iap)` y `status (paid|refunded)`.

### 8) Auditoría y Notificaciones
- **audit_log**: acciones (actor, target, meta) por organización.
- **notification**: notificaciones por `user_id`, con `payload` jsonb y `read_at`.

Flujos de datos (alto nivel)
----------------------------
1) **Chat de IA por nodo**  
`ai_thread(node_id)` → `ai_message(user)` → Edge Function `/ai/run` → proveedor IA → `ai_message(assistant)` + `ai_run` (+ opcional `ai_context_ref` si RAG).

2) **Adjuntar audio y transcribir**  
`attachment(type=audio)` → Worker STT → `transcription` → `ai_message(transcription_id)` como input de IA.

3) **RAG**  
Consulta vectorial (`policy_embedding` / `doc_embedding`) → contexto en prompt → guardar citas en `ai_context_ref` con `score`.

Diagrama (ASCII) — Chat por Nodo
--------------------------------
app (RN) → supabase.insert(ai_message: user)
app → POST /functions/v1/ai/run { threadId, input, attachments? }
EdgeFn → authz + límites
EdgeFn → (opcional) RAG topK → cita secciones/chunks
EdgeFn → OpenAI.chat.completions.stream
EdgeFn → insert ai_message: assistant, insert ai_run
EdgeFn → Realtime event
app ← stream/refresh mensajes

Funciones (MVP)
---------------
### Edge Functions (HTTP)
- `POST /ai/run`
  - **Body**: `{ threadId, input, model?, temperature?, attachments?: [{id}], rag?: { topK?, usePolicies?, useKnowledge? } }`
  - **Resp**: `{ messageId, output: { text }, usage: { tokens_in, tokens_out, usd_cost }, latency_ms }`
  - **Efectos**: inserta `ai_message(assistant)` y `ai_run`; crea `ai_context_ref` si hubo RAG.

- `POST /attachments/sign-url`
  - **Body**: `{ boardId, nodeId?, mime, type }`
  - **Resp**: `{ attachment: { id, url } }`
  - **Efectos**: crea `attachment` y devuelve URL firmada para subir a Storage.

- `POST /webhooks/stripe`
  - **Body**: evento Stripe
  - **Efectos**: valida firma, marca `purchase.status = 'paid'|'refunded'`.

### CRUD directo con Supabase JS (cliente)
- **Threads**: `insert/select/update ai_thread` (por `board_id`, `node_id`).
- **Messages**: `insert/select ai_message` (ordenado por `created_at`); realtime por `thread_id`.
- **Nodes/Edges**: `insert/update/delete node, edge`.
- **Tasks**: `insert/update task`.
- **Attachments/Transcriptions**: `insert attachment`, `insert transcription` (si procesas STT en cliente o worker).
- **Templates/Purchases**: `select template`, `insert purchase` (previo a webhook de confirmación).

Modelo de permisos (RLS — pendiente de endurecer en prod)
----------------------------------------------------------
- Activar RLS por tabla y añadir policies de: **lectura por miembro de org**, **escritura por owner/assignee**, **scoping por board_id/node_id**.
- Para Edge Functions, usar `SERVICE_ROLE_KEY` únicamente para operaciones de sistema (p. ej., insertar `ai_message(assistant)` tras validar contexto del `threadId`).

Índices clave
-------------
- GIN sobre jsonb (`node.content`, `template.json_schema`, `notification.payload`, `ai_message.output`).
- pgvector IVFFLAT en embeddings (policies/docs). Requiere ANALYZE y cantidad de filas.
- Auxiliares de grafo: `idx_edge_from`, `idx_edge_to`, `idx_node_board`.
- Métrica IA: `idx_ai_run_user_created`, `idx_ai_message_thread_created`.

Convenciones de naming
----------------------
- Timestamps: `created_at`, `updated_at` (timestamptz).
- Claves primarias: `id (uuid)`.
- FKs con `on delete cascade|set null` según corresponda.
- Enums: `*_type`, `*_status`.

Checklist de aceptación MVP
---------------------------
- [ ] Crear hilo `ai_thread` por board/nodo.
- [ ] Enviar `ai_message(user)` y recibir `ai_message(assistant)` con costos en `ai_run`.
- [ ] Adjuntar archivo y (opcional) transcribir audio.
- [ ] Crear nodos, mover posición, conectar con edges.
- [ ] Crear y actualizar tareas.
- [ ] (Opcional) RAG activable por flag env.
- [ ] Realtime en mensajes de IA y grafo.
- [ ] Webhook Stripe básico para compras de plantillas.

Referencias rápidas a tablas (claves y relaciones)
--------------------------------------------------
- **ai_thread**: `org_id?`, `board_id`, `node_id?`, `started_by_user_id?` → hilo de IA.  
- **ai_message**: FK `thread_id` + métricas de ejecución; `transcription_id?`, `parent_message_id?`.  
- **ai_run**: métrica por corrida con `board_id?`/`node_id?`.  
- **attachment** ↔ **transcription** (1..1), ambos vinculables a `board_id`/`node_id`.  
- **policy_* / knowledge_* / *_embedding**: estructura RAG con `vector(1536)`.  
- **board / node / edge**: grafo de la pizarra.  
- **task**: tareas por board (y opcional nodo).  
- **template / template_version / purchase**: marketplace.  
- **audit_log / notification**: auditoría y notificaciones.

Notas de implementación
-----------------------
- **Streaming**: preferir stream en Edge Function y emitir Realtime para refrescar el chat; en MVP puedes confirmar por polling. 
- **Costos**: calcular `usd_cost` por mensaje/ejecución y guardar en `ai_message`/`ai_run` para interfaz de costos por board.
- **Multimodal**: si hay `attachment(type=audio)`, transcribir y asociar a `ai_message.transcription_id`.
- **Escalabilidad**: en RAG, separar colas de embeddings e indexación IVFFLAT con `lists` adecuados.
- **BYOM**: la arquitectura deja espacio para cambiar `OPENAI_API_BASE` y `model` por org o plan.

