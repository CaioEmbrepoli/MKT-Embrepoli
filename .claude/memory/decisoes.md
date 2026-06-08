# Decisões de Arquitetura e UX

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

**Compatibilidade:** A opção de token manual (`connect-token`) e os scopes antigos (`INSTAGRAM_SCOPES`,
Facebook Login) **foram mantidos no código** como fallback/legado — só remover depois de validar que
o novo fluxo OAuth funciona ponta a ponta em produção (conectar → token `IGAA...` salvo com `expires_at`
~60 dias → publicação de teste bem-sucedida).

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
