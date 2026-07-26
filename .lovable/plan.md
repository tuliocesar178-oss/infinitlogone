# Central Operacional — InfinitLog

Nova rota `/ops/central` que vira a **tela inicial de Admin e Logística** (redirect a partir de `/ops`). Layout estilo Uber Freight Dispatch: mapa dominante à esquerda, colunas operacionais à direita, KPIs no topo, alertas ao vivo.

Como é grande, entrego em **3 fases** — cada uma testável antes da próxima.

---

## Fase 1 — Estrutura, Mapa, KPIs, Fretes e Alertas ao vivo

Entrega o layout completo e todos os dados **em tempo real** (Supabase Realtime), reaproveitando o que já existe.

**Rota / navegação**
- Nova rota `/ops/central` (nova página inicial pós-login p/ admin+logística).
- Item "Central Operacional" no topo da sidebar; `/ops` continua como Dashboard secundário.

**Layout (grid 12 colunas)**
```text
┌───────────────────── KPIs (linha topo) ─────────────────────┐
│ Fretes ativos · Motoristas online · Aguardando · Em coleta │
│ Em trânsito · Próximos · Entregues hoje · KM · Ocorrências  │
├──────────────────────────────┬──────────────────────────────┤
│                              │  🚚 Aguardando Despacho      │
│                              │  (cards + botão DESPACHAR)   │
│      MAPA OPERACIONAL        ├──────────────────────────────┤
│      (Mapbox, 70%)           │  🟦 Em Andamento             │
│      + filtros flutuantes    │  (cards com ETA e %)         │
│                              ├──────────────────────────────┤
│                              │  🔔 Central de Alertas       │
└──────────────────────────────┴──────────────────────────────┘
```

**Mapa** — reaproveita `FleetMap` (Fase 1 anterior) com:
- Veículos coloridos por status (9 cores já definidas).
- Camada de rotas ativas (linhas origem→destino usando `orders.origin/destination_lat/lng`).
- Filtros flutuantes: cidade, motorista, cliente, status, veículo, equipe, data.

**Colunas laterais**
- **Aguardando Despacho**: pedidos em `preparing`/`awaiting_driver` sem `driver_id`. Cada card: cliente, cidade origem→destino, peso, janela de coleta, valor, prioridade, botão **DESPACHAR** (Fase 2 abrirá sugestão inteligente; Fase 1 já leva ao pedido).
- **Fretes em Andamento**: pedidos em status ativos com motorista/veículo, distância restante, ETA, % concluído (barra), status; clique abre o pedido.
- **Central de Alertas**: derivada em tempo real de `orders`, `driver_locations`, `incidents`, `freight_offers` e `drivers`. Regras (todas puramente derivadas, sem tabela nova nesta fase):
  - Motorista recusou frete (`freight_offers.status='declined'` últimas 24h)
  - Motorista negociando (`freight_offers.status='negotiating'` ou entrada em `negotiations`)
  - Veículo parado >30min em rota ativa (último `driver_locations.speed_kmh < 3`)
  - GPS desconectado (sem ping >10min em rota ativa)
  - Ocorrência aberta (`incidents.resolved_at is null`)
  - Entrega atrasada (`delivery_window_end < now()` e status ≠ delivered)
  - Motorista offline em pedido ativo (`drivers.status='offline'`)
  - Documentação vencendo (CNH/CRLV/ANTT em ≤30 dias)
  - Cada alerta com severidade (info/warn/critical) e link para pedido/motorista.

**KPIs (topo)** — agregados a partir de `orders`, `drivers`, `route_summaries`:
- Fretes ativos, Motoristas online, Motoristas disponíveis, Veículos disponíveis, Em viagem, Aguardando motorista, Em coleta, Em trânsito, Próximos, Entregues hoje, Ocorrências abertas, Tempo médio de entrega (7 dias), KM rodados hoje.

**Realtime** — 1 canal Supabase assinando `orders`, `driver_locations`, `incidents`, `freight_offers`, `drivers`, `vehicles` → invalida as queries relevantes. Refetch fallback a cada 20s.

## Fase 2 — Despacho Inteligente, Painel do Motorista, Painel do Frete

- **Modal de Despacho Inteligente** ao clicar em DESPACHAR: server function calcula top-5 motoristas ordenados por score (distância → tempo até coleta → disponibilidade → tipo/capacidade do veículo → rating → tempo parado → fretes do dia). Destaca ⭐ Melhor Opção. Usa Mapbox Matrix (via gateway) para distâncias/tempos reais e reaproveita `send_program_to_driver()` já existente.
- **Painel lateral do Motorista** (clicar em marcador): foto, contatos (ligar/WhatsApp), status, veículo, frete atual + valor + tempo restante, última atualização/GPS, histórico recente, botão "Ver rota".
- **Painel lateral do Frete** (clicar em card/marcador do pedido): timeline (`order_events`), mapa, cliente, motorista, equipe, carga/peso/volumes, documentos (`order_attachments`), ocorrências, fotos, chat resumido com link para o thread completo.

## Fase 3 — Financeiro rápido, Agenda, Chat operacional, Replay, Notificações

- **Central Financeira Rápida** (cards): receitas do dia (`orders.price` entregues hoje), despesas do dia (`freight_costs`), lucro previsto, fretes faturados/pendentes, motoristas aguardando pagamento, clientes inadimplentes. Requer view SQL `v_ops_finance_daily`.
- **Agenda Operacional**: timeline cronológica das próximas 24h por pedido (coleta → carga → saída → entrega → retorno) com edição inline das janelas.
- **Chat Operacional**: um canal geral (nova tabela `channel_messages`) + link para o chat existente por pedido (`messages`).
- **Replay**: player usando `route_summaries.replay_geojson` (saída/paradas/coleta/entrega/retorno com velocidade e tempo parado).
- **Central de Notificações**: dropdown consumindo `notifications` já existente com filtros (nova, aceita, recusa, negociação, coleta, entrega, pagamento, ocorrência).

---

## Detalhes técnicos

- Reaproveita: `FleetMap`, `driver_locations`, `orders`, `drivers`, `vehicles`, `incidents`, `freight_offers`, `route_summaries`, `notifications`, `STATUS_LABEL`, `FLEET_MAP_COLORS`.
- Novos arquivos Fase 1: `src/routes/_authenticated/ops.central.tsx`, `src/components/ops/kpi-bar.tsx`, `src/components/ops/dispatch-queue.tsx`, `src/components/ops/active-freights.tsx`, `src/components/ops/alerts-panel.tsx`, `src/lib/ops-central.ts` (regras de alerta + agregadores).
- Sem migração nova na Fase 1. Fase 2/3 podem introduzir `channel_messages` e a view `v_ops_finance_daily`.
- Redirecionamento pós-login: ajustar `src/lib/roles.ts` para mandar admin/logistics para `/ops/central`.

---

**Começo pela Fase 1.** Confirma essa ordem, ou prefere Despacho Inteligente (Fase 2) primeiro?
