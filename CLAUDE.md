# Embrepoli Marketing App — Regras do Projeto

> Contexto completo do Caio e da Embrepoli já carregado via CLAUDE.md global.
> Este arquivo adiciona as regras específicas do código.

## Regras críticas

- Todo código de UI fica em `app/page.tsx` — nunca criar componentes novos sem necessidade real
- Zero erros TypeScript antes de concluir qualquer tarefa (`npx tsc --noEmit`)
- Nunca commitar sem aprovação explícita do Caio
- Servidor dev na porta 3000 — manter sempre ativo
- Nunca deletar dados de produção sem confirmação explícita

## Banco de dados

- Supabase PostgreSQL com RLS por `organization_id` em todas as tabelas
- Novas colunas: sempre `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- Migrations: sempre registrar em `supabase/` antes de executar

## Estrutura

- `app/page.tsx` — todo o UI (~7500 linhas)
- `lib/types.ts` — todos os tipos TypeScript
- `lib/supabase-data.ts` — camada de dados
- `lib/google-api.ts` — integrações Google
- `supabase/` — migrations SQL

## Worktrees

Ao sair do plan mode, confirmar que edições estão em `C:\Caio\app` e não no worktree.
