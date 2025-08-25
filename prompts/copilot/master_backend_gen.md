Context:
- docs/specs/backend/Endpoints.md
- docs/specs/backend/AppFlow.md
- docs/specs/backend/Functions.md
- docs/specs/backend/DataModel.postgres.md
- docs/specs/backend/Services.md
- docs/specs/db/supabase_schema.sql

Goal:
Generar backend mínimo funcional en TypeScript (Express + pg) bajo /server/src según los specs.

Hard rules:
- Postgres only (sin Mongo).
- JWT middleware.
- Estructura: routes/controllers/services/providers/lib/models.
- Implementar TODOS los endpoints de Endpoints.md con los flujos de AppFlow/Functions.
- Respetar DataModel.postgres.md y supabase_schema.sql.

Tasks:
1) Crear /server/src/index.ts (CORS, JSON, /health).
2) Crear routes/controllers/services para: auth, projects, blocks, files, templates, versions, ai.
3) AIService con router plan free (OSS en mi servidor) vs premium (OpenAI/Zhipu). Log tokens/costo en ai_run/ai_message.

Output:
Bloques de código por archivo, listos para pegar (sin explicaciones).
