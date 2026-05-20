# Embrepoli Marketing App — Documentação do Sistema

> Documento gerado em 2026-05-20. Alimenta a memória persistente do assistente de IA para este projeto.

---

## 1. Visão Geral

O **Embrepoli Marketing App** é uma ferramenta interna de gestão de marketing desenvolvida para a equipe da Embrepoli. Centraliza o planejamento, produção, revisão e análise de conteúdo de marketing em um único sistema.

**URL de produção:** `mkt-embrepoli.vercel.app`  
**Repositório:** `github.com/CaioEmbrepoli/MKT-Embrepoli`

### Stack Técnica
- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Banco de dados:** Supabase (PostgreSQL) com Row-Level Security
- **Storage:** Supabase Storage (imagens, vídeos, documentos)
- **Autenticação:** Supabase Auth (email/senha)
- **Deploy:** Vercel (CI/CD automático via push para `main`)
- **Integrações:** Google Drive API, YouTube Data API v3

---

## 2. Arquitetura de Arquivos

```
C:\Caio\app\
├── app/
│   ├── page.tsx          # UI principal (~7500 linhas) — TUDO está aqui
│   ├── layout.tsx        # Layout raiz (lang="pt-BR", metadata)
│   ├── globals.css       # Estilos globais
│   └── api/
│       ├── google-config/     # Retorna credenciais Google
│       ├── google/
│       │   ├── status/        # Status das conexões Drive/YouTube
│       │   ├── oauth/         # Fluxo OAuth Google
│       │   ├── disconnect/    # Desconectar serviço Google
│       │   ├── drive/         # Listagem e thumbnails do Drive
│       │   └── youtube/       # Uploads e stats do YouTube
│       ├── drive-thumb/       # Thumbnail do Drive (backup)
│       ├── drive-thumb-by-id/ # Thumbnail por ID
│       ├── dev-login/         # Login automático em desenvolvimento
│       ├── task-resets/       # Endpoint para reset de metas
│       └── cron/
│           └── metrics-update/ # Cron de atualização de métricas
├── lib/
│   ├── types.ts          # Todos os tipos TypeScript do sistema
│   ├── supabase-data.ts  # Camada de dados (leitura/escrita no Supabase)
│   └── google-api.ts     # Integração com APIs do Google
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

### 4.8 Configurações
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

### Supabase
- **Banco de dados:** PostgreSQL com RLS por `organization_id`
- **Storage:** Arquivos de usuário (avatares, anexos, artes)
- **Auth:** Email/senha com confirmação e recuperação
- **Realtime:** Subscriptions WebSocket para sincronização automática

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
| `/api/task-resets` | POST | Reset de metas por frequência |
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
