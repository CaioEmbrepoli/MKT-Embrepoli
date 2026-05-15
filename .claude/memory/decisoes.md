# Decisões de Arquitetura e UX

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
