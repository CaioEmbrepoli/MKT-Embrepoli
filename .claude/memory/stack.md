# Stack Técnico

## Framework
- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS**

## Banco de Dados
- **Supabase** (PostgreSQL)
- Client: `@supabase/supabase-js`

## Integrações Externas
- **Google OAuth 2.0** — Drive Picker + YouTube
- **YouTube Data API v3** — Importação de vídeos do canal
- **Google Drive API** — Upload e thumbnails

## Gráficos
- **Recharts** — AreaChart, BarChart, PieChart

## Servidor de Dev
- `npm run dev` → porta **3000**
- Sempre manter ativo durante desenvolvimento

## Comandos Úteis
```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Build de produção
npx tsc --noEmit    # Verificação de tipos TypeScript
```

## Variáveis de Ambiente (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```
