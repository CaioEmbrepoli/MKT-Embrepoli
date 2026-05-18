# Embrepoli Marketing

App web interno para organizar o marketing da Embrepoli: calendário editorial, ideias de posts, tarefas em Kanban, campanhas, briefings, métricas e canais configuráveis.

## Stack

- Next.js + TypeScript + Tailwind CSS
- Supabase Auth, Database, RLS e Realtime
- Supabase Storage para avatares e anexos
- DnD Kit para Kanban arrastável
- Recharts para gráficos do painel
- Deploy previsto na Vercel

## Como rodar

Este workspace não tinha `npm`, `pnpm`, `yarn` ou `git` disponíveis no PATH no momento da criação. Depois de ajustar o ambiente local, rode:

```bash
npm install
npm run dev
```

Depois acesse `http://localhost:3000`.

## Configuração Supabase

1. Crie um projeto no Supabase.
2. Rode o SQL de `supabase/schema.sql` no SQL Editor.
3. Copie `.env.example` para `.env.local`.
4. Preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=https://SEU-PROJETO.vercel.app
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://SEU-PROJETO.vercel.app/api/google/oauth/callback
GOOGLE_OAUTH_STATE_SECRET=
GOOGLE_API_KEY=
```

5. O `schema.sql` já publica as tabelas no Realtime com `alter publication supabase_realtime add table ...`. Se alguma tabela já estiver publicada, ignore o aviso de duplicidade ou remova a linha repetida no SQL Editor.
6. Confirme os buckets `task-attachments` e `profile-avatars` no Supabase Storage.
7. Em Supabase Auth > URL Configuration, configure:
   - Site URL produção: `https://SEU-PROJETO.vercel.app`
   - Redirect URLs: `http://localhost:3000`, `https://SEU-PROJETO.vercel.app`
   - Na Vercel, mantenha `NEXT_PUBLIC_SITE_URL` com a URL final da produção. Essa variável é usada nos emails de confirmação e redefinição de senha.

## Integração Google corporativa

O Drive e o YouTube usam uma conexão Google da empresa, salva no Supabase. Um Administrador ou Gestor conecta uma vez em `Configurações > Conta e Permissões`; depois a equipe inteira usa a mesma autorização automaticamente, inclusive em outros computadores.

No Google Cloud Console, configure o OAuth Client como aplicação web e adicione estes Redirect URIs:

```text
https://SEU-PROJETO.vercel.app/api/google/oauth/callback
http://localhost:3000/api/google/oauth/callback
```

Na Vercel, preencha `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` e `SUPABASE_SERVICE_ROLE_KEY`. O `GOOGLE_API_KEY` continua opcional para buscas públicas no YouTube. Depois rode `supabase/google-connections.sql` no SQL Editor para criar a tabela `google_connections` no projeto já existente.

Para o primeiro acesso, crie um usuário no Supabase Auth e insira o perfil inicial:

```sql
insert into public.profiles (id, organization_id, name, email, role)
values (
  '<auth.users.id>',
  '00000000-0000-0000-0000-000000000001',
  'Administrador',
  'admin@embrepoli.com.br',
  'admin'
);
```

Novos cadastros são liberados para qualquer email, mas entram com `active = false`. Um Gestor ou Administrador precisa aprovar o membro em `Configurações > Equipe` para que ele acesse o sistema completo.

## Deploy Vercel

1. Envie o projeto para um repositório Git.
2. Importe o repositório na Vercel.
3. Configure as mesmas variáveis de ambiente.
4. Publique o projeto.

## Observação

A interface funciona com dados locais quando o Supabase ainda não está configurado. Quando `.env.local` existe, o app carrega os dados do Supabase, salva alterações nas tabelas e assina atualizações Realtime para refletir mudanças feitas por outras contas.

## Roadmap

As ideias futuras, incluindo publicação/agendamento em Facebook, Instagram e TikTok, estão em `ROADMAP.md`.

