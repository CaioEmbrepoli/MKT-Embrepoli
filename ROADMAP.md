# Roadmap Embrepoli Marketing

## Próxima grande evolução: publicação nas redes sociais

Futuramente, o app pode evoluir de organizador interno para uma central própria de publicação e agendamento, reduzindo a dependência de ferramentas como Meta Business Suite e TikTok Studio.

### Facebook e Instagram

- Integrar com Meta Graph API para publicar ou agendar posts.
- Exigir conta Instagram profissional ligada a uma Página do Facebook.
- Criar e configurar app no Meta Developers.
- Implementar OAuth para conectar contas da Embrepoli.
- Solicitar permissões de publicação e leitura de métricas.
- Armazenar tokens com segurança no Supabase.
- Respeitar limitações por formato: imagem, vídeo, carrossel, reels, stories e texto.

### TikTok

- Avaliar TikTok API disponível para a conta da Embrepoli.
- Implementar OAuth para conexão da conta.
- Verificar se a API permite publicação direta, agendamento ou apenas envio para revisão/publicação manual.
- Mapear limitações de vídeo, legenda, música, capa e permissões.

### Etapas sugeridas

1. Preparar publicação: gerar copy, hashtags, mídia e checklist por canal.
2. Publicar/agendar no Facebook e Instagram via Meta API.
3. Puxar métricas automáticas da Meta para posts publicados.
4. Integrar TikTok conforme permissões disponíveis.
5. Consolidar métricas automáticas por campanha, canal e linha de produto.

### Observação

Essa integração deve vir depois do MVP principal, porque depende de aprovação das plataformas, gestão segura de tokens e testes cuidadosos para evitar publicações incorretas.
