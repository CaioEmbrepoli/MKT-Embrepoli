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
