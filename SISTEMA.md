# Gestão Embrepoli — Documentação do Sistema

> Documento gerado em 2026-05-20. Última atualização: 2026-05-21. Alimenta a memória persistente do assistente de IA para este projeto.

---

## 1. Visão Geral

O **Gestão Embrepoli** (anteriormente "Embrepoli Marketing App") é uma ferramenta interna de gestão de marketing desenvolvida para a equipe da Embrepoli. Centraliza o planejamento, produção, revisão, análise de conteúdo e CRM de comentários do YouTube em um único sistema.

**URL de produção:** `mkt-embrepoli.vercel.app`  
**Repositório:** `github.com/CaioEmbrepoli/MKT-Embrepoli`

### Stack Técnica
- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Banco de dados:** Supabase (PostgreSQL) com Row-Level Security
- **Storage:** Supabase Storage (imagens, vídeos, documentos)
- **Autenticação:** Supabase Auth (email/senha)
- **Deploy:** Vercel (CI/CD automático via push para `main`)
- **Integrações:** Google Drive API, YouTube Data API v3, Ollama (IA local), Gemini AI (fallback)

---

## 2. Arquitetura de Arquivos

```
C:\Caio\app\
├── app/
│   ├── page.tsx          # UI principal (~8800 linhas) — TUDO está aqui
│   ├── layout.tsx        # Layout raiz (lang="pt-BR", metadata)
│   ├── globals.css       # Estilos globais
│   └── api/
│       ├── google-config/     # Retorna credenciais Google
│       ├── google/
│       │   ├── status/        # Status das conexões Drive/YouTube
│       │   ├── oauth/         # Fluxo OAuth Google
│       │   ├── disconnect/    # Desconectar serviço Google
│       │   ├── drive/         # Listagem e thumbnails do Drive
│       │   └── youtube/       # Uploads, stats e comentários do YouTube
│       ├── drive-thumb/       # Thumbnail do Drive (backup)
│       ├── drive-thumb-by-id/ # Thumbnail por ID
│       ├── dev-login/         # Login automático em desenvolvimento
│       ├── task-resets/       # Endpoint para reset de metas
│       ├── gemini-chat/       # Chat de IA para Banco de Dúvidas (Ollama/Gemini)
│       ├── gemini-classify/   # Classificação em batch de comentários (Ollama/Gemini)
│       └── cron/
│           └── metrics-update/ # Cron de atualização de métricas
├── lib/
│   ├── types.ts          # Todos os tipos TypeScript do sistema
│   ├── supabase-data.ts  # Camada de dados (leitura/escrita no Supabase)
│   └── google-api.ts     # Integração com APIs do Google e YouTube
└── supabase/             # Migrations SQL do banco de dados
```

**Regra do projeto:** Todo código de UI fica em `app/page.tsx`. Não criar novos arquivos de componente sem necessidade real.

---

## 3. Banco de Dados — Tabelas Supabase

Todas as tabelas têm isolamento por `organization_id` via Row-Level Security (RLS).

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Usuários da organização |
| `channels` | Canais de marketing |
| `product_lines` | Linhas de produto |
| `vehicle_types` | Tipos de veículo |
| `content_types` | Tipos de conteúdo |
| `funnel_stages` | Etapas do funil de vendas |
| `task_boards` | Boards de tarefas |
| `task_columns` | Colunas dos boards |
| `tasks` | Tarefas e metas |
| `task_assignees` | Responsáveis por tarefas |
| `task_checklist_items` | Itens de checklist das tarefas |
| `task_comments` | Comentários nas tarefas |
| `task_attachments` | Anexos das tarefas |
| `campaigns` | Campanhas de marketing |
| `campaign_audiences` | Segmentos de público |
| `campaign_assignees` | Responsáveis por campanhas |
| `posts` | Posts do calendário editorial |
| `post_assignees` | Responsáveis por posts |
| `post_templates` | Templates de post |
| `post_review_assets` | Artes enviadas para revisão |
| `post_review_comments` | Comentários em artes |
| `ideas` | Ideias de conteúdo |
| `idea_attachments` | Anexos das ideias |
| `post_metrics` | Métricas de performance |
| `post_metric_snapshots` | Histórico de métricas |
| `notifications` | Notificações dos usuários |
| `calendar_dates` | Datas especiais no calendário |
| `comments` | Comentários do YouTube importados (CRM) ⚠️ migration pendente |
| `auto_filters` | Filtros automáticos de palavras-chave para comentários ⚠️ migration pendente |

> **Migrations pendentes para novas tabelas:**
> ```sql
> -- Tabela de comentários
> CREATE TABLE IF NOT EXISTS comments (
>   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
>   organization_id uuid NOT NULL,
>   source text NOT NULL DEFAULT 'youtube',
>   external_id text,
>   video_id text,
>   video_title text,
>   author_name text NOT NULL DEFAULT '',
>   text text NOT NULL DEFAULT '',
>   likes integer NOT NULL DEFAULT 0,
>   response text,
>   status text NOT NULL DEFAULT 'novo',
>   added_to_bank boolean NOT NULL DEFAULT false,
>   published_at timestamptz,
>   created_at timestamptz NOT NULL DEFAULT now(),
>   UNIQUE (organization_id, external_id)
> );
> 
> -- Tabela de filtros automáticos
> CREATE TABLE IF NOT EXISTS auto_filters (
>   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
>   organization_id uuid NOT NULL,
>   keyword text NOT NULL,
>   match_type text NOT NULL DEFAULT 'contains',
>   active boolean NOT NULL DEFAULT true,
>   created_at timestamptz NOT NULL DEFAULT now()
> );
> 
> -- Coluna em customer_questions
> ALTER TABLE customer_questions ADD COLUMN IF NOT EXISTS from_comment_id uuid;
> ```

---

## 4. Seções da Interface (Menu Principal)

### 4.1 Painel (Dashboard)
Visão geral da operação de marketing. Exibe estatísticas da equipe, atividade recente, breakdown de status dos posts e acesso rápido às funcionalidades.

### 4.2 Calendário
Visualização do calendário editorial em três modos: **Semana**, **Mês** e **Ano**. Mostra os posts agendados com cores por canal. Permite marcar datas especiais (feriados, datas comemorativas, eventos internos). Clique em um dia abre opção de criar novo post.

### 4.3 Ideias
Gerenciamento de ideias de conteúdo. Suporta dois modos de visualização: **Kanban** e **Lista**. Filtra por tipo (Todos, Postagem, Melhoria, Sistema, Outros). Permite criar ideias do zero ou a partir de templates de post existentes. Ideias podem ter anexos de múltiplas fontes.

### 4.4 Tarefas
Board Kanban com múltiplos boards. O board padrão é "Tarefas" com colunas personalizáveis. Existe um board especial de **Metas** com tratamento diferente: metas são agrupadas por frequência (Diárias, Semanais, Mensais, Trimestrais, Únicas) e têm reset automático. Suporta subtarefas aninhadas, checklists, comentários e anexos.

### 4.5 Revisões
Workflow de revisão de artes (imagens, vídeos, arquivos). Mostra lista de assets aguardando revisão com contador de pendências. Fluxo: upload do arquivo → revisão → **Aprovado** ou **Ajustes solicitados** (com comentário obrigatório). Notifica o responsável pelo post.

### 4.6 Campanhas
Planejamento e acompanhamento de campanhas de marketing. Cada campanha tem objetivo, público-alvo, mensagem, período, responsáveis e classificações (produto, veículo, funil). Status: **Planejada → Ativa → Pausada → Encerrada**.

### 4.7 Métricas
Registro e análise de performance. Métricas podem ser vinculadas a posts específicos ou registradas independentemente. Exibe KPIs por canal:
- **YouTube:** Views, Vídeos publicados, Média de views, Likes, Comentários, Taxa de likes
- **Outros canais:** Alcance, Engajamento, Cliques, Leads, Taxa de engajamento, Taxa de conversão

Gráficos de pizza e barras mostram breakdowns por canal, tipo de conteúdo, linha de produto, tipo de veículo e etapa do funil. Suporta filtros múltiplos simultâneos.

### 4.8 Banco de Dúvidas
Base de conhecimento interna com chat de IA. Visível apenas para **admin**.

**Dois painéis:**
- **Chat de IA (esquerda):** Usuário faz uma pergunta → IA busca no banco de Q&A aprovadas → responde. Se não encontrar, envia para fila pendente.
- **Base de Conhecimento (direita):** Lista de perguntas/respostas com filtro de status (pendente/aprovado/respondido). Admin pode responder perguntas pendentes inline.

**Integração IA:** `POST /api/gemini-chat` — usa Ollama (se configurado) ou Gemini como fallback.

**Fluxo de pendência:** Se IA não sabe responder → insere `CustomerQuestion` com status `pendente` → admin responde pelo painel direito → entra no banco e IA passa a responder.

### 4.9 Comentários
CRM de comentários importados do YouTube. Visível apenas para **admin**.

**Funcionalidades:**
- Importação de comentários de vídeos do YouTube via OAuth backend-mediated
- Classificação automática via IA (Ollama/Gemini): `duvida_relevante` ou `normal` — 1 chamada em batch por importação
- Filtros automáticos por palavras-chave (override manual, antes da IA)
- Ações por comentário: Responder, Ignorar, Adicionar ao Banco de Dúvidas

**Status de comentário:** `novo` → `respondido` / `ignorado`

**Integração IA:** `POST /api/gemini-classify` — classifica todos os comentários em lote.

**Adicionando ao banco:** Ao clicar "+ Adicionar ao Banco", comentário vira `CustomerQuestion` pendente no Banco de Dúvidas, com rastreabilidade via `fromCommentId`.

### 4.11 Configurações
Painel administrativo dividido em abas:
- **Equipe:** Gerenciamento de usuários, aprovação de cadastros, roles
- **Funil:** Criação/edição de etapas do funil com cores e ordenação
- **Filtros:** Configuração de canais, linhas de produto, tipos de veículo e tipos de conteúdo
- **Templates:** Templates de post (estrutura, checklist, exemplos de legenda)
- **Calendário:** Datas especiais (feriados, comemorativas, eventos)
- **Conta:** Integrações Google (Drive e YouTube), gerenciamento de credenciais

---

## 5. Modais do Sistema

### 5.1 Modal de Post
**Campos:** Título, Canal, Campanha, Linha de produto, Tipo de veículo, Tipo de conteúdo, Funil, Responsáveis (múltiplos), Data e hora de publicação, Descrição, Checklist de produção.

**Formatos por canal:**
- Instagram: Feed, Story, Reels, Lives
- YouTube: Vídeo, Shorts
- TikTok: Vídeo, Story, Live, Feed
- LinkedIn: Post, Artigo, Vídeo
- Facebook: Post, Story, Reels
- Blog, Email, WhatsApp: Post

**Status do post:** Ideia → Produção → Revisão → Aprovado → Agendado → Publicado

**Seção de Artes:** Painel integrado para envio e revisão de artes, com contador de aprovados/pendentes.

### 5.2 Modal de Ideia
Dois modos: **Do zero** e **Usar template**. Campos: Título, Tipo (Postagem/Melhoria/Sistema/Outros), Canal, Formato, Linha de produto, Tipo de veículo, Tipo de conteúdo, Funil, Prioridade (Alta/Média/Baixa), Descrição, Anexos.

Anexos suportam: upload local, Google Drive (browser integrado), YouTube (busca integrada) e links externos.

### 5.3 Modal de Campanha
Campos: Nome, Objetivo, Público (predefinido ou customizado), Mensagem, Linha de produto, Tipo de veículo, Etapa do funil, Data início, Data fim, Status, Responsáveis.

### 5.4 Modal de Tarefa
Campos: Título, Board, Coluna, Prioridade (Alta/Média/Baixa), Progresso (Bloqueada/No prazo/Atenção/Finalizando), Data de entrega, Descrição, Responsáveis, Checklist, Comentários, Anexos.

**Para Metas (board especial):** Valor alvo, Unidade (posts, leads, R$...), Frequência de reset (Diária/Semanal/Mensal/Trimestral), Horário de reset, Dia da semana (para semanal).

### 5.5 Modal de Métrica
Campos: Post vinculado (opcional), Canal, Campanha, Data, Alcance, Curtidas, Comentários, Compartilhamentos, Cliques, Leads, Notas, Aprendizados, Tipo de vídeo, Status de privacidade (para YouTube).

### 5.6 Painel de Revisão de Arte
Fluxo de aprovação com upload, preview, comentários por asset e botões Aprovar / Solicitar ajustes.

### 5.7 Modal de Perfil
Edição do perfil do usuário logado: Nome, Email, Telefone, Bio, Avatar (upload), Troca de senha.

### 5.8 Modal de Membro da Equipe
Edição de membros (visível para admins/gestores): Nome, Email, Telefone, Role (admin/gestor/colaborador), Status ativo/inativo, Avatar.

---

## 6. Tipos de Dados Principais

### Profile
```typescript
id, organizationId, name, email, phone, bio, role, avatarUrl, active,
notificationSound (boolean), pendingApproval (boolean)
```

### EditorialPost
```typescript
id, organizationId, title, channelId, campaignId, productLineId, vehicleTypeId,
contentTypeId, funnelStageId, status, description, publishAt, assignedTo[],
productionChecklist[], extraChannels[], publishedVideoId
```

### Idea
```typescript
id, organizationId, title, type, channelId, vehicleTypeId, productLineId,
contentTypeId, funnelStageId, priority, description, attachments[]
```

### Task
```typescript
id, boardId, columnId, title, description, priority, progress, dueDate,
assignedTo[], checklist[], comments[], attachments[], parentTaskId,
isGoal, targetValue, currentValue, unit, resetFrequency, resetTime,
resetWeekday, lastReset, nextReset
```

### Campaign
```typescript
id, organizationId, name, objective, audienceId, customAudience, message,
productLineId, vehicleTypeId, funnelStageId, startDate, endDate, status,
assignedTo[]
```

### PostMetric
```typescript
id, organizationId, postId, postTitle, channelId, campaignId, productLineId,
vehicleTypeId, contentTypeId, funnelStageId, date, reach, likes, comments,
shares, clicks, leads, notes, learning, videoType, privacyStatus, externalId
```

### CustomerQuestion
```typescript
id, organizationId, questionText, answerText, category, status,
authorName, likes, learning, reviewerId, publishedAt, answeredAt,
createdAt, needsReview (boolean), fromCommentId? (rastreabilidade)
```

### Comment
```typescript
id, organizationId, source ("youtube"), externalId?, videoId?, videoTitle?,
authorName, text, likes, response?, status (CommentStatus),
addedToBank (boolean), publishedAt?, createdAt
```

### CommentStatus
```typescript
"novo" | "respondido" | "ignorado"
```

### AutoFilter
```typescript
id, organizationId, keyword, matchType (AutoFilterMatchType), active, createdAt
```

### AutoFilterMatchType
```typescript
"contains" | "startsWith" | "exact"
```

### YouTubeCommentItem
```typescript
commentId, videoId, videoTitle, authorName, text, likes, publishedAt
```
*(Tipo de transporte — usado na busca de comentários do YouTube, não persistido diretamente)*

### PostReviewAsset
```typescript
id, postId, name, type (arquivo|foto|video), status, uploadedBy, reviewedBy,
url, previewUrl, mimeType, originalSize, compressedSize
```

### FileAttachment
```typescript
name, type (arquivo|foto|video), source (upload|external),
url, previewUrl, originalSize, compressedSize, mimeType
```

---

## 7. Sistema de Permissões

### Roles
| Role | Acesso |
|------|--------|
| **admin** | Total — inclui configurações, aprovação de usuários, tudo |
| **gestor** | Gestão de conteúdo, revisão de artes, configurações, atribuições |
| **colaborador** | Criação própria, visualização do que está atribuído |

### Regras de Visibilidade
- **Admin/Gestor:** Veem todos os itens da organização
- **Colaborador:** Veem apenas itens que criaram OU que foram atribuídos a eles
- **Ideias:** Colaborador vê só as próprias ideias
- **Configurações:** Acesso bloqueado para colaboradores

---

## 8. Autenticação e Fluxo de Acesso

### Modos de tela
| Modo | Descrição |
|------|-----------|
| `login` | Tela principal de login |
| `signup` | Cadastro novo usuário |
| `forgot` | Solicitar recuperação de senha |
| `reset` | Redefinir senha (via link de email) |
| `checkEmail` | Aguardando confirmação de email |
| `pending` | Aguardando aprovação de admin |

### Fluxo de cadastro
1. Usuário preenche nome, email e senha
2. Recebe email de confirmação
3. Após confirmar, conta fica com status **pendente**
4. Admin/Gestor recebe notificação de aprovação pendente
5. Admin aprova → usuário acessa o sistema

### Modo dev
Em `localhost`, existe bypass automático de login via `/api/dev-login`.

---

## 9. Integrações Externas

### Google Drive
- **Configuração:** API Key + OAuth Client ID (em variável de ambiente / tabela de config)
- **Escopo:** Leitura de arquivos do Drive do usuário
- **Funcionalidades:** Browser de pastas, seleção de arquivos, thumbnails, links em ideias/posts
- **Autenticação:** OAuth por usuário, tokens armazenados no cliente
- **Status:** Verificado em `/api/google/status`

### YouTube
- **Funcionalidades:** Busca de vídeos por palavra-chave, listagem de uploads do canal, stats (views, likes, comentários), classificação (Vídeo/Shorts), status de privacidade
- **Vinculação:** Vídeos YouTube podem ser linkados a posts via `publishedVideoId` (formato `yt:VIDEO_ID`)
- **Import:** Processo multi-fase com indicador de progresso

### Ollama (IA Local — Primário)
- **O que é:** LLM server local, exposto via Cloudflare Tunnel (URL permanente gratuita)
- **Endpoint:** Configurado via variável `OLLAMA_HOST` (ex: `https://xyz.trycloudflare.com`)
- **Modelo padrão:** `llama3.2` (configurável via `OLLAMA_MODEL`)
- **Ativação:** Se `OLLAMA_HOST` estiver definido, todas as chamadas de IA usam Ollama
- **APIs:** `/api/chat` (gemini-chat) e `/api/generate` com `format: "json"` (gemini-classify)
- **Status:** Variável comentada no `.env.local` — ainda não configurado

> **Setup para ativar (salvo para fazer depois):**
> 1. Baixar Ollama: `https://ollama.com/download` → instalar no Windows
> 2. No terminal: `ollama pull llama3.2`
> 3. Instalar cloudflared: `winget install Cloudflare.cloudflared`
> 4. Criar tunnel permanente: `cloudflared tunnel --url http://localhost:11434`
> 5. Copiar a URL gerada (ex: `https://xyz.trycloudflare.com`)
> 6. No `.env.local`: descomentar e preencher `OLLAMA_HOST=https://xyz.trycloudflare.com`
> 7. Na Vercel: adicionar `OLLAMA_HOST` e `OLLAMA_MODEL=llama3.2` nas env vars
> 8. Alternativa gratuita com domínio fixo: ngrok com 1 static domain (`ngrok http 11434`)

### Gemini AI (Fallback — quando Ollama não configurado)
- **Modelo:** `gemini-2.0-flash`
- **Biblioteca:** `@google/generative-ai` (instalada no projeto)
- **Variável:** `GEMINI_API_KEY` (não configurada no `.env.local` ainda)
- **Uso:** Classificação de comentários (`/api/gemini-classify`) e chat de dúvidas (`/api/gemini-chat`)
- **Ativação automática:** Se `OLLAMA_HOST` não estiver definido, usa Gemini

### Supabase
- **Banco de dados:** PostgreSQL com RLS por `organization_id`
- **Storage:** Arquivos de usuário (avatares, anexos, artes)
- **Auth:** Email/senha com confirmação e recuperação
- **Realtime:** Subscriptions WebSocket para sincronização automática — inclui tabelas `comments` e `auto_filters`

---

## 10. API Routes

| Rota | Método | Função |
|------|--------|--------|
| `/api/google-config` | GET | Retorna credenciais da API Google |
| `/api/google/status` | GET | Status de conexão Drive e YouTube |
| `/api/google/oauth/start` | POST | Inicia fluxo OAuth para um serviço |
| `/api/google/disconnect` | POST | Desconecta serviço Google |
| `/api/google/drive/list` | GET | Lista arquivos em pasta do Drive |
| `/api/google/drive/thumb` | GET | Thumbnail de arquivo do Drive |
| `/api/google/youtube/uploads` | GET | Uploads e stats do canal YouTube |
| `/api/drive-thumb` | GET | Thumbnail Drive (endpoint backup) |
| `/api/drive-thumb-by-id` | GET | Thumbnail por ID do arquivo |
| `/api/dev-login` | POST | Login automático (apenas desenvolvimento) |
| `/api/google/youtube/comments` | GET | Comentários de um vídeo YouTube (backend-mediated) |
| `/api/task-resets` | POST | Reset de metas por frequência |
| `/api/gemini-chat` | POST | Chat de IA para Banco de Dúvidas (Ollama ou Gemini) |
| `/api/gemini-classify` | POST | Classificação em batch de comentários (Ollama ou Gemini) |
| `/api/cron/metrics-update` | GET | Atualização automática de métricas (cron) |

---

## 11. Sistema de Notificações

### Notificações derivadas (geradas automaticamente)
| Gatilho | Tipo | Destinatário |
|---------|------|-------------|
| Atribuição de tarefa | `task` | Usuário atribuído |
| Atribuição de post | `post` | Usuário atribuído |
| Atribuição de campanha | `campaign` | Usuário atribuído |
| Prazo ≤ 1 dia | `task` | Responsáveis pela tarefa |
| Prazo vencido | `task` | Responsáveis pela tarefa |
| Post publicado hoje | `post` | Responsáveis pelo post |
| Novo cadastro pendente | `system` | Admins/Gestores |

### Configuração
- **Som:** Usuário pode ativar/desativar som de notificação (Web Audio API)
- **Leitura:** Marcar como lido individualmente ou em lote
- **Tipos target:** `post`, `task`, `review`, `idea`, `campaign`, `metric`, `calendar`, `system`

---

## 12. Sistema de Arquivos

### Limites e compressão
- **Imagens:** Máx. 2MB após compressão, máx. 1920px de dimensão, qualidade JPEG reduzida progressivamente
- **Vídeos:** Máx. 100MB
- **Documentos:** PDF, DOCX, PPTX, XLSX, TXT, CSV, ODF e outros

### Fontes de arquivo
| Fonte | Tipo | Descrição |
|-------|------|-----------|
| `upload` | Local | Upload direto do dispositivo |
| `external` | Google Drive | Link de arquivo do Drive |
| `external` | YouTube | Link/embed de vídeo YouTube |
| `external` | URL | Link externo qualquer |

### Sanitização
- Remoção de acentos e caracteres especiais no nome do arquivo
- Detecção de MIME type
- Rastreamento de tamanho original vs comprimido

---

## 13. Sincronização em Tempo Real

- **Mecanismo:** WebSocket via Supabase Realtime (Postgres Changes)
- **Cobertura:** Todas as tabelas principais
- **Debounce:** 500ms após evento para evitar recargas múltiplas
- **Anti-echo:** Ignora mudanças próprias nos primeiros 2 segundos após salvamento local
- **Fallback:** Polling a cada 60 segundos (garante sincronização mesmo se WebSocket falhar)
- **Conflitos:** Last-write-wins

---

## 14. Automações

### Reset automático de metas
Metas no board de Tarefas têm suporte a reset periódico:
- **Frequências:** Diária, Semanal, Mensal, Trimestral
- **Configuração:** Horário de reset + dia da semana (para semanal) + dia do mês (para mensal)
- **Funcionamento:** Endpoint `/api/task-resets` verifica e zera o progresso das metas no horário programado
- **Rastreamento:** `lastReset` e `nextReset` por tarefa

### Cron de métricas
`/api/cron/metrics-update` atualiza automaticamente dados de métricas (principalmente YouTube) com snapshots históricos.

---

## 15. Configurações do Sistema

### O que pode ser configurado pelo admin/gestor
| Seção | O que configura |
|-------|----------------|
| Canais | Nome e cor dos canais de marketing |
| Linhas de produto | Categorias de produtos |
| Tipos de veículo | Classificação de veículos |
| Tipos de conteúdo | Classificação de conteúdo |
| Funil | Etapas, cores e ordem do funil de vendas |
| Templates | Templates de post com estrutura e checklist |
| Calendário | Feriados, datas comemorativas, eventos |
| Equipe | Usuários, roles, aprovações, status ativo/inativo |
| Google | Conexão/desconexão Drive e YouTube |

---

## 16. Componentes Reutilizáveis (internos ao page.tsx)

| Componente | Função |
|-----------|--------|
| `TextInput` | Input de texto com spellCheck condicional por tipo |
| `TextArea` | Textarea com rows=8, spellCheck ativo |
| `TextInputControlled` | Input controlado com spellCheck condicional |
| `Select` | Select estilizado (não controlado) |
| `SelectControlled` | Select controlado |
| `MultiSelectField` | Seleção múltipla de responsáveis |
| `FileDropZone` | Zona de drop para upload de arquivos |
| `Badge` | Tag de status/label |
| `EditableItemList` | Lista de itens editáveis com deleção |
| `ChecklistComponent` | Checklist com done/undone e deleção |
| `EntityModal` | Container que decide qual modal renderizar |
| `LoginScreen` | Tela de auth completa com todos os modos |

---

## 17. Padrões e Convenções

- **Nomenclatura:** `camelCase` para variáveis/funções, `PascalCase` para componentes
- **Commits:** Nunca sem aprovação explícita do usuário
- **TypeScript:** Zero erros antes de considerar tarefa concluída (`npx tsc --noEmit`)
- **Banco:** Usar `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para novas colunas
- **Migrations:** Sempre registrar em `supabase/` antes de executar
- **Servidor dev:** Porta 3000, manter sempre ativo
- **Dados de produção:** Nunca deletar/sobrescrever sem confirmação explícita
- **Worktrees:** Ao sair do plan mode, confirmar se edições estão no app principal (`C:\Caio\app`) e não no worktree
