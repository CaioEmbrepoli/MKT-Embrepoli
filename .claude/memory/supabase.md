# Supabase — Banco de Dados

## Tabelas Principais

### `post_metrics`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `organization_id` | uuid | FK |
| `external_id` | text | ID externo, ex: `yt:VIDEO_ID` para YouTube |
| `post_id` | uuid | FK opcional para posts |
| `post_title` | text | Título do post/vídeo |
| `channel_id` | text/uuid | Canal associado |
| `campaign_id` | uuid | Campanha |
| `product_line_id` | uuid | Linha de produto |
| `vehicle_type_id` | uuid | Tipo de veículo |
| `content_type_id` | uuid | Tipo de conteúdo |
| `funnel_stage_id` | uuid | Etapa do funil |
| `metric_date` | date | Data da métrica |
| `reach` | int | Alcance/visualizações |
| `likes` | int | Curtidas |
| `comments` | int | Comentários |
| `shares` | int | Compartilhamentos |
| `clicks` | int | Cliques |
| `leads` | int | Leads gerados |
| `notes` | text | Observações |
| `learning` | text | Aprendizado |
| `video_type` | text | `'video'` ou `'short'` (adicionado 2025-05) |
| `created_at` | timestamptz | |

### `posts`
Status possíveis: `'Ideia', 'Produção', 'Revisão', 'Aprovado', 'Agendado', 'Publicado'`

## Migrations Aplicadas

| Data | Descrição |
|---|---|
| 2025-05 | `ALTER TABLE post_metrics ADD COLUMN IF NOT EXISTS video_type TEXT;` |

## Mapeamento TypeScript ↔ Banco

`video_type` (banco) ↔ `videoType` (TypeScript em `PostMetric`)
`external_id` (banco) ↔ `externalId` (TypeScript)
`metric_date` (banco) ↔ `date` (TypeScript)
