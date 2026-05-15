# Diretrizes para IA — Embrepoli Marketing App

Estas regras devem ser seguidas por qualquer IA que modifique este projeto.

## Servidor de Desenvolvimento

- **Sempre manter o servidor `npm run dev` ativo na porta 3000.**
- Antes de qualquer verificação visual ou teste de UI, confirmar que o servidor está rodando.
- Se o servidor parar por qualquer motivo, reiniciá-lo com `npm run dev` antes de continuar.
- Nunca mudar a porta do servidor de desenvolvimento.

## Qualidade do Código

- **Sempre rodar `npx tsc --noEmit` antes de considerar uma tarefa concluída.** Nenhuma tarefa está completa se houver erros de TypeScript.
- Não introduzir `any` sem justificativa explícita.
- Manter os padrões de nomenclatura existentes (camelCase para variáveis, PascalCase para componentes).
- Preferir editar arquivos existentes a criar novos.

## Git e Commits

- **Nunca commitar sem aprovação explícita do usuário.**
- Nunca usar `--force` em branches que não sejam branches de feature pessoal.
- Nunca pular hooks de pre-commit (`--no-verify`).

## Banco de Dados (Supabase)

- **Nunca deletar ou sobrescrever dados de produção sem confirmação explícita.**
- Sempre usar migrations SQL para alterações de schema — nunca editar tabelas diretamente pela UI do Supabase sem registrar a migration em `supabase/`.
- Ao adicionar colunas, usar `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para segurança.

## Memória Automática

- Após cada modificação relevante (novo campo, nova feature, mudança de arquitetura), registrar as informações pertinentes em `.claude/memory/` sem precisar ser solicitado.
- Manter os arquivos de memória atualizados conforme o projeto evolui.
- Se uma informação em `.claude/memory/` estiver desatualizada, corrigi-la imediatamente.

## Estrutura do Projeto

- Todo o código principal da UI está em `app/page.tsx` (arquivo único grande — ~6000 linhas).
- Tipos em `lib/types.ts`, camada de dados em `lib/supabase-data.ts`, integração Google/YouTube em `lib/google-api.ts`.
- Não criar novos arquivos de componente sem necessidade real — o padrão do projeto é colocar tudo em `page.tsx`.

## ⚠️ Atenção — Modo de Planejamento e Worktrees

Quando o Claude Code entra em **modo de planejamento** (*plan mode*), ele cria automaticamente um **git worktree isolado** em `.claude/worktrees/<nome-aleatorio>/` com um branch separado. Qualquer edição feita durante o planejamento vai para esse worktree — **não para o app principal** (`C:\Caio\app`, branch `main`).

**Ao sair do modo de planejamento e iniciar a implementação:**
- Confirmar em qual diretório as edições estão sendo feitas.
- Se as edições forem no worktree, copiar todos os arquivos modificados para `C:\Caio\app` antes de commitar.
- O app principal está sempre em `C:\Caio\app` (branch `main`).
- Usar `git worktree list` para verificar em qual worktree se está trabalhando.
