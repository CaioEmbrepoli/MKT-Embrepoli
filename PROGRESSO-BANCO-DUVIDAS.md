# Progresso — Banco de Dúvidas dos Clientes

Rastreamento das fases de implementação da Central de Mensagens + Banco de Dúvidas.
Planos de referência: `plano-sugestao-respostas.txt` e `plano-central-mensagens-redes-sociais.txt`

---

## ✅ Fase 1 — Estrutura base (em andamento)
- [x] Tabela `customer_questions` criada no Supabase
- [x] Tipos TypeScript (`CustomerQuestion`, `CustomerQuestionStatus`, `CustomerQuestionSource`) em `lib/types.ts`
- [x] Camada de dados em `lib/supabase-data.ts` (`loadAppData`, `replaceCustomerQuestions`)
- [x] Seção "Banco de Dúvidas" no menu (visível somente para **admin**)
- [x] Componente `BancoDeDuvidas` em `app/page.tsx` com:
  - Cards de stats (Pendentes / Respondidos / Aprovados / Descartados)
  - Filtros por status, source e busca por texto
  - Lista de perguntas com metadados
  - Painel de detalhe com textarea de resposta e controle de status
  - Formulário de entrada manual de perguntas
  - Placeholder para importação YouTube (Fase 2)

---

## ⏳ Fase 2 — Importação de comentários do YouTube
- [ ] Endpoint `/api/google/youtube/comments` para buscar comentários via `commentThreads`
- [ ] Botão "Importar do YouTube" na seção Banco de Dúvidas
- [ ] Deduplicação por `external_id` (`yt_comment:<commentId>`)
- [ ] Associar comentário ao post/vídeo correspondente quando existir

---

## ⏳ Fase 3 — Instagram e Facebook (Meta API)
- [ ] Configurar Meta App com permissões de comentários
- [ ] Endpoint de webhook para receber mensagens/comentários
- [ ] Importação de comentários de posts do Instagram/Facebook
- [ ] Conectar conta Meta nas Configurações do app

---

## ⏳ Fase 4 — Embeddings e busca semântica
- [ ] Ativar extensão `pgvector` no Supabase
- [ ] Tabela `question_embeddings` para vetores das perguntas
- [ ] Gerar embeddings via API (OpenAI ou similar) ao salvar pergunta
- [ ] Busca semântica: encontrar perguntas similares automaticamente

---

## ⏳ Fase 5 — Sugestão automática de resposta com IA
- [ ] Ao abrir uma pergunta, buscar perguntas similares via embedding
- [ ] Usar Claude API + RAG para sugerir resposta baseada na base aprovada
- [ ] Equipe revisa e aprova antes de qualquer resposta ao cliente
- [ ] Base de conhecimento cresce com cada resposta aprovada

---

## ⏳ Fase 6 — TikTok (avaliação futura)
- [ ] Avaliar disponibilidade da API TikTok para comentários
- [ ] Pode depender de conta comercial ou parceiro aprovado

---

## Notas técnicas
- Fonte de dados atual: somente YouTube (já conectado via OAuth)
- Autenticação: `google_connections` table, reusa token existente
- Isolamento: todos os dados filtrados por `organization_id`
- Acesso: somente role `admin` vê a seção no menu
