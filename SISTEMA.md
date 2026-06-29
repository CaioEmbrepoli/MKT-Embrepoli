# Gestão Embrepoli — Documentação do Sistema

> Documento gerado em 2026-05-20. Última atualização: 2026-05-26. Alimenta a memória persistente do assistente de IA para este projeto.

---

## 1. Visão Geral

O **Gestão Embrepoli** (anteriormente "Embrepoli Marketing App") é uma ferramenta interna de gestão desenvolvida para a equipe da Embrepoli. Centraliza marketing, vendas, planejamento, produção, revisão, análise de conteúdo, CRM de comentários do YouTube e funil comercial em um único sistema.

**URL de produção:** `mkt-embrepoli.vercel.app`  
**Repositório:** `github.com/CaioEmbrepoli/MKT-Embrepoli`

### Stack Técnica
- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Banco de dados:** Supabase (PostgreSQL) com Row-Level Security
- **Storage:** Supabase Storage (imagens, vídeos, documentos)
- **Autenticação:** Supabase Auth (email/senha)
- **Deploy:** Vercel (CI/CD automático via push para `main`)
- **Integrações:** Google Drive API, YouTube Data API v3, Ollama (IA local)

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
│       ├── ai-chat/           # Chat de IA local
│       ├── ai-classify/       # Classificação em batch de comentários via Ollama
│       ├── knowledge-chat/    # Sistema de chat do Banco de Dúvidas (sessões por dia)
│       │   ├── send/          # Envia pergunta, salva sessão/mensagem/gap
│       │   ├── today/         # Carrega sessão do dia + mensagens + gaps
│       │   ├── gap-answer/    # Admin responde um gap pendente
│       │   ├── cleanup/       # Arquiva sessões antigas
│       │   └── shared.ts      # Auth, busca Jaccard, mappers
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
| `customer_questions` | Banco de perguntas e respostas usado pelo chat de IA |
| `comments` | Comentários do YouTube importados (CRM) |
| `auto_filters` | Filtros automáticos de palavras-chave para comentários |
| `profile_module_permissions` | Permissões granulares por área, módulo e ação |
| `sales_clients` | Clientes, leads e inativos da área de Vendas |
| `sales_funnel_stages` | Etapas customizáveis do Funil Comercial |
| `call_schedules` | Agenda e histórico de ligações comerciais |
| `knowledge_chat_sessions` | Sessões de chat do Banco de Dúvidas (1 por usuário por dia) |
| `knowledge_chat_messages` | Mensagens trocadas em cada sessão (role: user/ai/system/error) |
| `knowledge_chat_matches` | Rastreabilidade de qual Q&A respondeu qual mensagem |
| `knowledge_gaps` | Perguntas sem resposta no banco, aguardando admin responder |

**Migrations registradas:** `customer-questions-ai-migration.sql`, `profile-permissions-migration.sql` e `sales-client-import-migration.sql`.

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
Base de conhecimento interna com chat de dúvidas. Visível apenas para **admin**.

**Dois painéis:**
- **Chat (esquerda):** Usuário faz uma pergunta → busca local procura no banco de Q&A aprovadas → responde. Se não encontrar, registra gap pendente e informa o usuário.
- **Base de Conhecimento (direita):** Lista de perguntas/respostas com filtro de status (pendente/aprovado/respondido). Admin pode responder perguntas pendentes inline.

**Sessões por dia:** Cada usuário tem 1 sessão ativa por dia (tabela `knowledge_chat_sessions`). Sessões de dias anteriores são arquivadas automaticamente com TTL de 30 dias ao abrir nova sessão. Endpoint `today` carrega ou cria a sessão do dia junto com mensagens e gaps.

**Busca:** Similaridade por Jaccard com remoção de stopwords em português — `provider: "local"`, `model: "keyword-search"`. Pontua contra pergunta (1.0×), resposta (0.6×) e título do vídeo (0.4×). Threshold: 0.30.

**Fluxo completo:**
1. `POST /api/knowledge-chat/send` recebe a pergunta
2. Salva mensagem do usuário em `knowledge_chat_messages`
3. Executa busca Jaccard no banco de Q&A aprovadas
4. Se encontrou: salva resposta + registra match em `knowledge_chat_matches`
5. Se não encontrou: salva resposta padrão + cria `KnowledgeGap` (status `aguardando_resposta`) + vincula ao `gap_id` da mensagem
6. Admin responde o gap via `POST /api/knowledge-chat/gap-answer` → gap vira `convertido` e entra no banco

**Cleanup:** `POST /api/knowledge-chat/cleanup` arquiva sessões antigas.

### 4.9 Comentários
CRM de comentários importados do YouTube. Visível apenas para **admin**.

**Funcionalidades:**
- Importação de comentários de vídeos do YouTube via OAuth backend-mediated
- Classificação automática via IA local (Ollama): `duvida_relevante` ou `normal` — 1 chamada em batch por importação
- Filtros automáticos por palavras-chave (override manual, antes da IA)
- Ações por comentário: Responder, Ignorar, Adicionar ao Banco de Dúvidas
- Classificação híbrida: regras locais primeiro; IA local apenas para casos incertos
- Proteção contra duplicatas: filtro em memória por `existingExternalIds` + upsert/constraint por `organization_id, external_id`

**Status de comentário:** `novo` → `respondido` / `ignorado`

**Integração IA:** `POST /api/ai-classify` — classifica todos os comentários em lote.

**Adicionando ao banco:** Ao clicar "+ Adicionar ao Banco", comentário vira `CustomerQuestion` no Banco de Dúvidas, com rastreabilidade via `fromCommentId`/`bankQuestionId`. Itens vindos da IA podem entrar com `needsReview: true`.

### 4.11 Configurações
Painel administrativo dividido em abas:
- **Equipe:** Gerenciamento de usuários, aprovação de cadastros, roles
- **Funil:** Criação/edição de etapas do funil com cores e ordenação
- **Filtros:** Configuração de canais, linhas de produto, tipos de veículo e tipos de conteúdo
- **Templates:** Templates de post (estrutura, checklist, exemplos de legenda)
- **Calendário:** Datas especiais (feriados, comemorativas, eventos)
- **Conta:** Integrações Google (Drive e YouTube), gerenciamento de credenciais

### 4.12 Vendas
Área comercial separada de Marketing, com escopo próprio para clientes, ligações, funil, atividades, metas e configurações.

**Módulos:**
- **Painel:** cards de resumo de clientes ativos, leads, ligações de hoje e ligações atrasadas.
- **Clientes:** lista unificada de leads, clientes e inativos, com filtros e busca.
- **Ligações:** agenda/histórico com visualizações por Frequência, Urgência e Desfecho; cards clicáveis abrem `AgendaModal`; suporta arquivar, excluir e drag-and-drop.
- **Funil Comercial:** pipeline e visualização de funil com etapas customizáveis, emojis, cores, reordenamento e layout lado a lado.
- **Atividades:** tarefas comerciais separadas dos boards de Marketing.
- **Metas:** metas comerciais com escopo de Vendas.
- **Configurações:** ajustes comerciais.

**Regra técnica:** usar `areaScope` para impedir mistura de boards, tarefas e metas entre Marketing e Vendas.

**Visibilidade:**
- Ligações: toggle "Minhas / Todas" para todos; filtro de foco, não privacidade rígida.
- Atividades: `isPrivate` por item; privado fica visível só ao criador.
- Metas: Individual quando `assignedTo` está preenchido; Grupo quando vazio.
- Funil: compartilhado para a equipe.

**Importação XLSX:** clientes de Vendas usam campos `external_code`, `client_type`, `state_uf`, `city` e `last_purchase_at`; dependência `xlsx` deve estar versionada em `package.json`/`package-lock.json`.

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
notificationSound (boolean)
```

### ProfileArea
```typescript
id, profileId, area (AppArea), active
```

### ProfileModulePermission
```typescript
id, profileId, area (AppArea), moduleId, canView, canCreate, canEdit,
canDelete, canApprove, canManage
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
id, columnId, title, description, priority, progress, dueDate, order,
createdBy, assignedTo[], relatedTo, funnelStageId, parentTaskId?,
previousColumnId?, checklist[], comments[], attachments[],
resetFrequency, resetTime, resetWeekday?, resetMonthDay?,
resetMonthLastDay (boolean), fixedGoalKey?, lastResetAt?, nextResetAt?,
targetValue?, currentValue?, unit?, isPrivate?
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
id, organizationId, source (CustomerQuestionSource), externalId?,
videoId?, videoTitle?, questionText, answerText, authorName, likes,
status (CustomerQuestionStatus), category, reviewerId?, learning,
fromCommentId?, sourceCommentId?, needsReview (boolean),
reviewedAt?, reviewedBy?, aiConfidence?, aiReason?,
publishedAt?, answeredAt?, createdAt
```

**CustomerQuestionStatus:** `"pendente" | "respondido" | "aprovado" | "descartado"`  
**CustomerQuestionSource:** `"youtube" | "instagram" | "facebook" | "tiktok" | "manual"`

### SalesClient
```typescript
id, externalCode, name, clientType, email, phone, company, segment,
stateUf, city, lastPurchaseAt, status (SalesClientStatus),
source (SalesClientSource), assignedTo, notes, proposals[],
salesFunnelStage, createdAt
```

**SalesClientStatus:** `"lead" | "cliente" | "inativo"`  
**SalesClientSource:** `"instagram" | "youtube" | "indicacao" | "site" | "manual" | "outros"`

### SalesProposal
```typescript
id, title, value, status ("rascunho"|"enviada"|"negociacao"|"ganha"|"perdida"|"expirada"),
createdAt, notes
```

### SalesFunnelStage
```typescript
id, name, color, emoji, order, halfWidth
```

### CallSchedule
```typescript
id, clientId, clientName, phone, frequency (CallFrequency),
nextCallAt, lastCallAt?, callHistory (CallLog[]), assignedTo,
createdBy, active, paused?, archived?, notes
```

**CallFrequency:** `"daily" | "weekly" | "biweekly" | "monthly"`

### CallLog
```typescript
id, date, notes, outcome
```

### Comment
```typescript
id, source ("youtube"|"instagram"|"facebook"|"tiktok"), externalId?,
videoId?, videoTitle?, authorName, text, likes, response?,
status (CommentStatus), addedToBank (boolean), bankQuestionId?,
publishedAt?, createdAt
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

### KnowledgeChatSession
```typescript
id, organizationId, userId, dateKey, status (KnowledgeChatSessionStatus),
title, archivedAt?, expiresAt?, lastMessageAt?, createdAt, updatedAt
```
**KnowledgeChatSessionStatus:** `"active" | "archived"`

### KnowledgeChatMessage
```typescript
id, sessionId, organizationId, userId, role (KnowledgeChatMessageRole),
content, provider?, model?, unknown (boolean), confidence?,
reason?, gapId?, errorMessage?, createdAt
```
**KnowledgeChatMessageRole:** `"user" | "ai" | "system" | "error"`

### KnowledgeChatMatch
```typescript
id, sessionId, messageId, questionId, confidence?, reason?, createdAt
```
*(Rastreabilidade: qual Q&A do banco respondeu qual mensagem do chat)*

### KnowledgeGap
```typescript
id, organizationId, sessionId, userId, questionText,
status (KnowledgeGapStatus), customerQuestionId?,
answeredAt?, resolvedBy?, createdAt, updatedAt
```
**KnowledgeGapStatus:** `"aguardando_resposta" | "convertido" | "ignorado" | "erro"`

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
- **Configuração de menus Marketing/Vendas:** restrita a administradores

### Magic Link
Admins podem enviar Magic Link pela listagem de membros da equipe. A ação usa `supabase.auth.signInWithOtp` e aparece com ícone `Wand2` e tooltip explicativo.

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
- **O que é:** LLM server local (PC do Caio), exposto via Cloudflare Tunnel nomeado (`embrepoli-ia`)
- **Endpoint:** Configurado via variável `OLLAMA_HOST` (atualmente `https://ia.embrepoli.com.br`)
- **Modelo:** `llama3.1:8b` (configurável via `OLLAMA_MODEL`) — `gemma3:4b` (4B) copiava o texto do banco literalmente em vez de adaptar a resposta; `llama3.1:8b` (4.9GB) segue corretamente a instrução de reescrever a resposta com base na referência. Roda na GTX 1660 6GB
- **Ativação:** `askKnowledgeAi` (Chat de Dúvidas e Sugestão de Resposta), `/api/ai-chat` e `/api/ai-classify` usam Ollama.
- **Status:** Configurado e ativo — `.env.local` (dev) e env vars `OLLAMA_HOST`/`OLLAMA_MODEL` na Vercel (Production e Development)
- **Fallback:** se a chamada ao Ollama falhar (PC desligado, túnel caiu), `askKnowledgeAi` cai automaticamente para busca por palavras-chave (`searchBank`) — sem erro 500

> **Túnel fixo (`ia.embrepoli.com.br`):**
> O túnel atual é nomeado no Cloudflare (`embrepoli-ia`) e roteia `ia.embrepoli.com.br` para o proxy local protegido em `http://127.0.0.1:11435`. A URL não muda ao reiniciar o PC.
>
> **Proteção:** o proxy local exige `X-Embrepoli-IA-Token`, configurado por `OLLAMA_PROXY_TOKEN` no PC e na Vercel. O Ollama continua escutando só em `127.0.0.1:11434`.
>
> **Inicialização automática:** `cloudflared`, `scripts/ollama-proxy.mjs` e `ollama serve` devem subir no logon/startup. A antiga rotina de refresh com `*.trycloudflare.com` não deve mais atualizar `OLLAMA_HOST` nem disparar redeploy.

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
| `/api/ai-chat` | POST | Chat de IA local |
| `/api/ai-classify` | POST | Classificação em batch de comentários via Ollama |
| `/api/knowledge-chat/send` | POST | Envia pergunta ao chat, salva sessão/mensagem/gap |
| `/api/knowledge-chat/today` | GET | Carrega sessão do dia + mensagens + gaps do usuário |
| `/api/knowledge-chat/gap-answer` | POST | Admin responde gap pendente → gap vira `convertido` |
| `/api/knowledge-chat/cleanup` | POST | Arquiva sessões antigas (TTL 30 dias) |
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
- **Tipos target:** `post`, `task`, `review`, `idea`, `campaign`, `metric`, `calendar`, `question`, `system`

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

---

## Atualização operacional — 27-05-2026

### Arquitetura
- O `app/page.tsx` concentra lógica demais e deve ser tratado como risco técnico.
- Refatoração futura deve ser por domínio (`sales`, `tasks`, `calendar`, `feedback`, etc.), depois de mapear estados compartilhados e criar testes mínimos.
- Por enquanto, manter a estrutura atual para não interromper funcionalidades em andamento.

### Ligações de Vendas
- `CallSchedule` precisa considerar `manualDate`.
- Agendamento automático deve usar dias úteis, limite de 20 ligações automáticas por vendedor/dia e preservar datas manuais.
- Datas manuais não entram no contador automático.
- A visão de Urgência é dinâmica e deriva de `nextCallAt`.
- O filtro "Minhas" deve considerar o responsável (`assignedTo`), não somente `createdBy`.
- Busca de ligações deve procurar por nome, telefone e observações com texto normalizado.

### Importação XLSX
- A importação de clientes pode usar a coluna "Frequência" para criar agendas de ligação automaticamente.
- Frequência vazia não cria agenda.
- `externalCode` segue como chave de deduplicação de clientes.
- Cliente com agenda ativa não deve receber agenda duplicada.

### Clientes e Propostas
- Cliente PF usa CPF.
- Cliente PJ usa Empresa/CNPJ e pode ter nome de contato separado.
- Origem "Outros" usa `sourceCustom`; limpar esse campo ao trocar para outra origem.
- Responsáveis no modal de cliente devem ser perfis ativos da área de vendas.
- Propostas usam ações explícitas de Ganha, Perdida e Excluir.
- Proposta ganha pode converter Lead em Cliente e deve refletir imediatamente no funil.

### Tarefas
- `tasks.priority` e `tasks.progress` devem aceitar `NULL`.
- A UI pode representar campos vazios como `""`, mas a persistência deve enviar `null`.
- Migration relacionada: `supabase/tasks-nullable-priority-progress.sql`.

### Feedback interno
- Existe módulo de feedback pelo botão `?`, com tipos Dúvida, Problema e Ideia.
- Admins têm aba de recebidos, podem responder, marcar como resolvido e excluir feedbacks.
- Resposta do admin deve persistir e notificar o usuário remetente.
- Validar tabela `feedback`, RLS e bucket/políticas de anexos.

### Deploy
- Em 27-05-2026 houve push para `main` no commit `2cf84a7`.
- A Vercel disparou deploy `dpl_CQaGUTFhKPzeEGwR61madTHNjyZJ`.

---

## Atualização operacional — 28-05-2026

### Importação unificada
- Métricas usam um botão "Importar" e `MetricImportModal`.
- Comentários usam um botão "Importar" e `CommentImportUnifiedModal`.
- Importação de métricas pode selecionar múltiplos canais e processar em fila.
- Importação de comentários suporta YouTube e Instagram; escopo "30 dias / todos" só aparece para YouTube.
- `ComentariosSection` precisa receber `channels` para detectar canais disponíveis.

### Métricas
- O widget de métricas do Painel de Marketing usa filtro global de período.
- Cards e gráfico devem consumir o mesmo estado filtrado.
- Períodos usados: 7d, 14d e 30d.

### Origem dos Leads e Atribuição
- Objetivo: ligar acessos do site, links rastreáveis, WhatsApp, formulários e vendas para entender o histórico antes da conversão.
- O identificador principal deve ser o `visitor_id` criado pelo script de tracking no navegador (`_emb_vid` no `localStorage`).
- `visitor_id` não aparece automaticamente em uma compra; ele precisa ser enviado pelo checkout, formulário, botão de WhatsApp ou webhook.
- Tabelas já preparadas para atribuição:
  - `visitors`: visitante anônimo.
  - `tracking_sessions`: sessões/acessos do visitante.
  - `tracking_touchpoints`: eventos intermediários, como clique em WhatsApp, envio de formulário ou início de checkout.
  - `persons`: lead/pessoa identificada, com `visitor_id`.
  - `conversions`: venda/conversão, com `visitor_id`.
- Integrações necessárias:
  1. Atualizar o script de tracking para expor `window.embrepoliVisitorId` e preencher campos ocultos em formulários.
  2. Criar endpoint de touchpoint, por exemplo `/api/tracking/touchpoint`, para registrar ações como clique em WhatsApp, formulário enviado, início de checkout e clique em CTA.
  3. No formulário do site, enviar `visitor_id` junto com nome, telefone e e-mail; salvar em `persons.visitor_id`.
  4. No botão de WhatsApp, registrar o clique com `visitor_id` antes de abrir o link do WhatsApp; se possível, incluir um código curto na mensagem para vinculação posterior.
  5. No checkout/loja, gravar `visitor_id` em campo customizado, metadata, observação interna ou payload do pedido.
  6. No webhook/importação de vendas, ler esse `visitor_id` e salvar em `conversions.visitor_id`.
  7. Quando a venda não trouxer `visitor_id`, tentar vincular por dados identificáveis confiáveis: telefone, e-mail, CPF/CNPJ ou cliente já cadastrado.
- IP não deve ser o identificador principal. Pode ser usado apenas como apoio probabilístico, de preferência com hash/anonymização e política de privacidade adequada.
- Relatórios desejados:
  - Quantas sessões ocorreram antes da compra.
  - Primeira origem/campanha do visitante.
  - Última origem/campanha antes da conversão.
  - Touchpoints antes da compra: WhatsApp, formulário, checkout, links rastreáveis.
  - Tempo entre primeira visita e venda.
- Regra de privacidade: evitar salvar dados sensíveis sem finalidade clara; para IP/User-Agent, preferir minimização e retenção limitada.

### Vendas
- Painel de Vendas reutiliza a visualização do Funil Comercial.
- `salesFunnelStages` e `salesClients` devem alimentar painel e funil para manter reatividade.
- Conversão Lead/Cliente fica na lista principal de clientes e persiste via `syncSalesClients`.
- Clientes inativos não exibem conversão.
- Ligações/Desfecho limita textos longos visualmente a 20 caracteres com reticências.
- Botões de ação devem usar ícones com `title` para acessibilidade.

### Planilha de clientes
- O botão "Planilha" une exportação de modelo e importação XLSX.
- `exportClientTemplate()` gera modelo com cabeçalhos esperados.
- A importação deve aceitar arquivos com 7, 8 ou 9 colunas.
- `lastPurchaseValue` registra valor da última compra.
- Se houver data de última compra, o lead pode ser promovido automaticamente para cliente.

### Revisão de assets
- Capas de vídeo (`isCover`) não entram na fila de aprovação/revisão.
- Capas continuam visíveis no modal de edição como contexto.
- Filtros de pendência devem excluir `isCover` em badges, sidebar, calendário e aba de revisões.

### Publicação de vídeo
- YouTube publish deve consultar metadata do Drive antes de baixar arquivo.
- Arquivos acima de 200MB devem usar streaming direto, evitando `arrayBuffer()` em RAM.
- `duplex: "half"` pode ser necessário para streaming com `fetch` em Node.
- `maxDuration = 300` deve ser usado nas rotas longas quando necessário.
- TikTok publish usa Content Posting API com `push_by_file`.
- TikTok faz upload em chunks de 64MB via `/api/tiktok/publish`.
- Evitar `pull_by_url` no TikTok porque exige domínio verificado.

### TikTok OAuth
- `video.publish` só deve ser solicitado quando o app/ambiente tiver esse escopo aprovado.
- No Sandbox, escopo não aprovado pode quebrar/reiniciar o fluxo OAuth.
- Ao adicionar scopes, o usuário precisa desconectar e reconectar a conta.

### Instagram / Meta
- Tokens `IGAA`, `IGQV` e `IGQ` usam `graph.instagram.com`.
- Tokens `EAA` usam `graph.facebook.com`.
- Centralizar essa regra em helper como `igApiBase(accessToken)`.
- Importadores Instagram devem sanitizar lone surrogates/Unicode malformado.
- Publicação Meta pode exigir `Content-Type` mesmo com body em `URLSearchParams`.

### Deploy e Git
- Conferir `git status` antes de commit/deploy, principalmente após criar arquivos em `app/api`, `lib` ou `supabase`.
- Builds da Vercel podem falhar se commits intermediários referenciarem arquivos ainda não versionados.
- Commits citados no dia: `bcf9204`, `591e6af`, `06cedd8`.
