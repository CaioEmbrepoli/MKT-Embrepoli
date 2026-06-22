# Decisões de Arquitetura e UX

## 2026-06-22 - Fila automática de publicação TikTok

- A publicação de vídeo no TikTok não faz mais download/upload completo na rota Next.js. `POST /api/tiktok/publish` apenas valida o ativo e cria `post_publications` + `tiktok_upload_queue`.
- `supabase/functions/tiktok-upload-processor` envia o vídeo em blocos de 32 MB, persiste URL de upload, `publish_id` e bytes enviados para retomar em nova execução. Depois do upload, o cron `tiktok-publications` continua responsável por consultar a confirmação final da API TikTok.
- A tabela `tiktok_upload_queue` usa RLS por organização e está em Realtime. É necessário manter um Database Webhook de INSERT e uma chamada de recuperação periódica para a Edge Function, como já ocorre para a fila do YouTube.
- A Edge Function usa a conexão TikTok salva. Para renovar um token expirado, os segredos `TIKTOK_ENV`, `TIKTOK_CLIENT_KEY` e `TIKTOK_CLIENT_SECRET` (ou as variantes sandbox) também precisam estar configurados nos Secrets das Edge Functions do Supabase.

---

## 2026-06-11 — Botão "Repensar sugestão" + integração Tray (preço em tempo real, opcional)

**Botão "Repensar sugestão" (Comentários):** `app/page.tsx` (~linha 18078-18100), bloco de
sugestão de resposta — quando `selected.suggestedReply` existe, agora há um botão com ícone
`RefreshCw` (ao lado de "Usar sugestão") que chama `handleSuggestReply(selected, { force: true })`.
- `handleSuggestReply` (linha ~17368) agora aceita `force` mesmo quando `comment.status !== "novo"`
  e envia `{ commentId, force }` para `/api/comments/suggest-reply`.
- `app/api/comments/suggest-reply/route.ts` aceita `body.force` — quando `true`, ignora
  `comment.suggested_reply` já salvo e gera uma nova sugestão via `suggestReplyForComment`,
  sobrescrevendo o valor no Supabase.

**Integração Tray Commerce (preço em tempo real no RAG) — OPCIONAL/CONFIGURÁVEL:**
Caio ainda não confirmou se tem `consumer_key`/`consumer_secret`/`code` da Tray Partners. Por isso
o código foi implementado seguindo o mesmo padrão do Ollama: se não configurado, comportamento
atual é preservado (sem erros).
- `lib/tray-api.ts` (novo) — `getTrayToken(service, organizationId)` lê a tabela
  `tray_integration` (retorna `null` se não houver linha = não configurado) e renova o
  `access_token` automaticamente se faltar <20min para expirar; `searchTrayProduct(apiAddress,
  accessToken, query)` busca `GET {api_address}/products?...&search=...` (parâmetro `search` e
  formato de resposta **ainda não validados com credenciais reais** — ajustar quando o Caio
  conseguir acesso).
- `supabase/tray-integration-migration.sql` (novo, **NÃO aplicada ainda**) — cria tabela
  `tray_integration` (organization_id, api_address, access_token, refresh_token, expires_at) com
  RLS por organização (admin/gestor).
- `app/api/tray/setup/route.ts` (novo) — rota de setup único, `POST {apiAddress, consumerKey,
  consumerSecret, code}` (admin/gestor), troca por `access_token`/`refresh_token` via
  `POST {apiAddress}/auth` e salva (upsert) em `tray_integration`. Chamar manualmente uma vez
  quando o Caio tiver as credenciais.
- `app/api/knowledge-chat/shared.ts`: `askAiWithBank`/`askKnowledgeAi`/`suggestReplyForComment`
  agora aceitam um `ctx?: AuthContext` opcional (último parâmetro). Quando presente e a pergunta
  contém palavras de preço (`PRICE_INTENT_KEYWORDS`: preco/valor/quanto/custa...),
  `buildTrayPriceContext` chama `getTrayToken` + `searchTrayProduct` (usando
  `extractEntityTokens` da pergunta) e injeta `"Preço atualizado da loja: ..."` no prompt da IA,
  instruindo a priorizar esse valor sobre o banco. Sem `tray_integration` configurada, retorna
  `undefined` e o prompt fica igual a antes.
- Callers atualizados para passar `ctx`: `app/api/comments/suggest-reply/route.ts` e
  `app/api/knowledge-chat/send/route.ts`.

**Pendente:** aplicar a migration `tray-integration-migration.sql` (pedir confirmação antes —
mudança de schema em produção) e validar `searchTrayProduct` com credenciais reais quando o Caio
conseguir o `consumer_key`/`consumer_secret`/`code` na Tray.

---

## 2026-06-08 — Migração do OAuth do Instagram para "Instagram Business Login"

**Problema:** Publicações agendadas do Instagram falhavam com "Token has been expired or revoked."
mesmo poucos dias após reconectar. O botão de "Conectar via OAuth" do sistema "conectava" mas não
habilitava publicação de verdade — o Caio vinha usando token manual (rota `connect-token`) como
workaround, só que esse token durava ~10 dias em vez dos 60 dias esperados.

**Causa raiz:** A Meta tem dois produtos distintos para conectar Instagram a um app externo:
- **Facebook Login for Business** (`graph.facebook.com`, tokens `EAA...`, scopes `instagram_basic`/`instagram_content_publish`...)
- **Instagram Business Login / API with Instagram Login** (`graph.instagram.com`/`api.instagram.com`/`www.instagram.com`, tokens `IGAA.../IGQV.../IGQ...`, scopes `instagram_business_*`)

O app da Embrepoli no Meta Developer está aprovado para o **segundo** (é de lá que vêm os tokens
manuais `IGAA...` que funcionam). Só que o fluxo OAuth implementado em `oauth/start`/`oauth/callback`
usava o **primeiro** caminho (Facebook Login) — por isso "conectava" mas não funcionava de verdade,
e o token manual colado nunca passava pela troca de long-lived token.

**Decisão:** Reescrever o fluxo OAuth para usar o Instagram Business Login nativo:
1. `oauth/start` → `https://www.instagram.com/oauth/authorize` com scopes `INSTAGRAM_BUSINESS_SCOPES`
   (`instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_comments`,
   `instagram_business_manage_messages`) — constante nova em `lib/meta-server.ts`
2. `oauth/callback` → troca de 2 etapas, ambas em endpoints nativos do Instagram (não graph.facebook.com):
   - `POST https://api.instagram.com/oauth/access_token` (code → short-lived token, ~1h)
   - `GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token` (→ long-lived, 60 dias)
   - `fetchInstagramAccount()` já reconhecia tokens `IGAA/IGQV/IGQ` e foi reaproveitada sem alteração
3. `instagramAppId()`/`instagramAppSecret()` agora preferem `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET`
   (credenciais próprias do produto Instagram Business Login no painel Meta) e caem para
   `META_APP_ID`/`META_APP_SECRET` como fallback — **se o painel mostrar um App ID/Secret específico
   de Instagram, configurar `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET` na Vercel**
4. Novo cron `app/api/cron/instagram-token-refresh/route.ts` (registrado em `vercel.json`, roda
   diariamente às 09:00 UTC) renova automaticamente tokens `IGAA/IGQV/IGQ` que estão a ≤10 dias de
   expirar (e têm ≥24h desde a última atualização) via `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token`
   — elimina de vez a necessidade de reconectar manualmente a cada ~60 dias

**Atualização 2026-06-08 (mesmo dia):** Caio confirmou que o redeploy com `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET`
funcionou — o botão novo abriu a tela de OAuth do Instagram corretamente. A pedido dele, a opção de
**token manual foi REMOVIDA** da UI e do backend (não ficou só como fallback):
- `app/page.tsx`: removido botão "Token manual", modal "Cadastrar token Instagram / Meta", states
  `instagramTokenOpen`/`instagramAccessToken`/`instagramExpiresAt` e função `submitInstagramToken`;
  botão principal renomeado de "Conectar/Reconectar com Facebook" (azul `#1877F2`) para
  "Conectar/Reconectar Instagram" (gradiente fuchsia→pink, condizente com a marca do Instagram)
- `app/api/meta/instagram/connect-token/route.ts` — **deletado** (`git rm`)
- `lib/meta-api.ts` — removida função `connectInstagramToken` e seu import em `page.tsx`
- `INSTAGRAM_SCOPES` (legado Facebook Login) permanece em `lib/meta-server.ts` apenas porque ainda
  é referenciado como fallback de tipos/scopes em código legado — pode ser removido depois se
  confirmado que nada mais o usa.

**Validação pendente:** confirmar no Supabase que o token salvo em `meta_connections` para o Instagram
começa com `IGAA` e tem `expires_at` ~60 dias à frente; depois, fazer uma publicação de teste para
validar ponta a ponta.

**Arquivos alterados:**
- `lib/meta-server.ts` — `INSTAGRAM_BUSINESS_SCOPES`, `INSTAGRAM_OAUTH_AUTHORIZE_URL`,
  `INSTAGRAM_OAUTH_TOKEN_URL`, `instagramGraphAccessTokenUrl()`, `instagramGraphRefreshTokenUrl()`,
  `instagramAppId()`/`instagramAppSecret()` com fallback de env vars
- `app/api/meta/instagram/oauth/start/route.ts` — reescrito para Instagram Business Login
- `app/api/meta/instagram/oauth/callback/route.ts` — reescrito (troca de token via endpoints `api.instagram.com`/`graph.instagram.com`)
- `app/api/cron/instagram-token-refresh/route.ts` — novo cron de renovação automática
- `vercel.json` — novo cron registrado

**Próximo passo (não-bloqueante para o código):** o Caio precisa confirmar no painel do Meta Developer
se existe um "Instagram App ID"/"Instagram App Secret" dedicado (Instagram > API setup with Instagram
login) e, se sim, configurar `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET` na Vercel — caso contrário o
fallback para `META_APP_ID`/`META_APP_SECRET` deve funcionar (mesmo app, mesmas credenciais exibidas).
Depois, testar o fluxo completo de reconexão.

---

### ⚠️ ATUALIZAÇÃO IMPORTANTE 2026-06-08 (mesmo dia, ~16h) — "Token has been expired or revoked." NÃO É do Instagram

Depois de toda a migração acima funcionar (token `IGAA...` válido, todas as permissões
`instagram_business_*` ativas e usadas — confirmado com prints do painel Meta), o Caio continuou
recebendo **"Token has been expired or revoked."** ao tentar publicar um Story. Passamos a tarde
caçando esse erro como se fosse do Instagram (cheguei a adicionar log `IG_ERR` em `graphGet`,
commit `9b97698`) — e o log NUNCA apareceu, porque **o erro não vem da Meta**.

**Causa raiz real:** essa frase é a mensagem padrão (`error_description`) que o **Google OAuth2**
retorna quando um `refresh_token` está expirado/revogado (`invalid_grant`). Em
`lib/google-server.ts`, `exchangeRefreshToken()` (linha ~117-140) repassa `data.error_description`
sem alteração. Quando a arte do post é um link do **Google Drive**, `preparePublicAsset()` em
`lib/instagram-publish-server.ts` chama `getGoogleAccessToken(context, "drive")` → que chama
`exchangeRefreshToken()` → que estoura essa mensagem do Google, repassada verbatim (linha 175-178).
Resultado: o usuário vê "Token has been expired or revoked." pensando que é o Instagram, quando
na real é a **conexão do Google Drive (`google_connections`, service="drive") com refresh_token
expirado/revogado**.

**Lição:** essa string é uma mensagem GENÉRICA de OAuth2 usada tanto pelo Google quanto pela Meta —
nunca assumir o provedor só pelo texto do erro. A ausência do log `IG_ERR` foi, na verdade, a pista
certa (provava que o erro nascia ANTES de qualquer chamada à Meta).

**Ação corretiva:** Caio precisa reconectar o Google Drive em Configurações → Conta e Permissões
(gera novo `refresh_token`). Considerar também adicionar log de diagnóstico equivalente
(`GOOGLE_ERR` ou similar) em `exchangeRefreshToken`/`getGoogleAccessToken`, e diferenciar as
mensagens de erro de "token do Google Drive expirado" vs "token do Instagram expirado" para evitar
essa confusão de novo.

---

## 2025-05 — Detecção de Shorts vs Vídeos

**Decisão:** Detectar YouTube Shorts pela duração do vídeo (≤ 60 segundos via `contentDetails.duration`).

**Motivo:** É a forma mais confiável sem precisar de acesso à API privada. Shorts são sempre ≤ 60s.

**Como:** Adicionar `contentDetails` ao `part` do request de `listMyYouTubeChannelVideos` e parsear a duração ISO 8601.

---

## 2025-05 — Filtros de Métricas em Popup

**Decisão:** Todos os filtros (exceto Período) ficam dentro de um botão "Filtros ▾" que abre um dropdown. Período fica visível sempre.

**Motivo:** Reduzir poluição visual na barra de filtros, especialmente em mobile. Período é o filtro mais usado.

---

## 2025-05 — Evolução do Período (antigo "Evolução diária")

**Decisão:** Quando período = "Todo período", mostrar top 5 vídeos mais visualizados como BarChart horizontal. Para períodos específicos (7/30/90 dias), manter agregação diária.

**Motivo:** Agregação diária com muitos meses de dados gera gráfico ilegível. Top 5 é mais útil para períodos longos.

---

## 2025-05 — Seções Ocultas no Canal YouTube

**Decisão:** Quando o canal YouTube está ativo, ocultar:
- "Posts sem métrica" (não faz sentido — dados vêm da API, não de posts)
- "Precisam de ajuste" (critério de leads não se aplica ao YouTube)
- "Conteúdos vencedores" (sem leads no YouTube)
- "Mais leads" no card de Análise

**Motivo:** YouTube usa métricas de views/engagement, não de leads. As seções acima são orientadas a funil de vendas.
