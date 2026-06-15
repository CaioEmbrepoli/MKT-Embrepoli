# Estrutura do Projeto

## Arquivos Principais

| Arquivo | Descrição |
|---|---|
| `app/page.tsx` | Todo o código de UI (~6000 linhas). Componentes, modais, lógica de estado. |
| `app/layout.tsx` | Layout raiz do Next.js |
| `lib/types.ts` | Definições de tipos TypeScript |
| `lib/supabase-data.ts` | Camada de dados: load, save, delete para todas as entidades |
| `lib/google-api.ts` | Integração com Google Drive e YouTube Data API |
| `supabase/schema.sql` | Schema do banco de dados |
| `app/api/drive-thumb/route.ts` | Proxy de thumbnails do Google Drive |
| `app/api/google-config/route.ts` | Endpoint que retorna credenciais OAuth para o cliente |
| `app/l/[slug]/route.ts` | Rota pública (sem auth) de redirect para Links Rastreáveis — registra clique e redireciona para `destination_url` |

## Links Rastreáveis (Pretty Links interno)

- Tudo fica em Métricas → aba "Links Rastreáveis" (`metricsMode === "links"`, componente `TrackableLinksSettings`): campo de URL de destino + nome opcional, botão "Gerar link", e lista de todos os links com URL curta, contador de clicks, copiar e excluir. Não existe mais aba em Configurações.
- Gera URL curta `${NEXT_PUBLIC_SITE_URL}/l/<slug>` a partir da URL de destino.
- Tabelas: `trackable_links` (slug único global, `click_count`) e `trackable_link_clicks` (log de cliques).
- Slug gerado client-side via `generateTrackableLinkSlug` (em `app/page.tsx`), garantindo não-colisão com links já carregados.
- `app/l/[slug]/route.ts` usa o service role do Supabase (sem RLS), busca o link pelo slug, faz `insert` em `trackable_link_clicks` + RPC `increment_trackable_link_clicks` (ambos `await`ados, não fire-and-forget — em rotas de redirect o processo pode terminar antes de promises soltas completarem) e redireciona (302) para `destination_url`. Slug inexistente redireciona para `/`.
- Em Next.js 15, `params` de route handlers é uma Promise — sempre `const { slug } = await params`.
- Tipo `TrackableLink` em `lib/types.ts`; CRUD em `lib/supabase-data.ts` (`saveTrackableLink`, `deleteTrackableLink`, `replaceTrackableLinks`).

## Padrão de Organização do page.tsx

O arquivo `page.tsx` contém:
- Tipos locais e helpers no topo
- Componentes de UI como funções nomeadas
- Componente principal `Home` que gerencia todo o estado global
- Modais como componentes separados no final do arquivo
- Padrão: uma feature → um componente de painel + zero ou mais modais

## Detecção de Canal YouTube

Canal YouTube é identificado por:
```ts
const isYoutubeChannel = activeChannel !== "all" && (
  activeChannel === "youtube" ||
  channelById.get(activeChannel)?.name.toLowerCase().includes("youtube")
);
```

## Thumbnails de Vídeos YouTube

Geradas via `thumbnailFor(metric)`:
```ts
if (ext?.startsWith("yt:")) return `https://i.ytimg.com/vi/${ext.slice(3)}/mqdefault.jpg`;
```
O `externalId` deve ser preservado ao editar métricas para manter a thumbnail.
