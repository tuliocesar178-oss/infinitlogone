# Central Operacional Inteligente

Vou transformar `/ops/central` (tela inicial de Admin/Logística) numa central única inspirada em Uber Freight/Bringg/Onfleet, sem precisar navegar entre telas.

## Layout (desktop)

```text
┌─────────────────────────────────────────────────────────────┐
│ TopBar: Busca global · Ações rápidas · Saúde · TV · Tema    │
├─────────────────────────────────────────────────────────────┤
│ KPIs (carrossel de cards, 4 linhas em xl / scroll em md)    │
├────────────────────────────────┬────────────────────────────┤
│                                │  Central de Alertas        │
│   MAPA OPERACIONAL (~60%)      │  (fixa, tempo real)        │
│   + filtros flutuantes         │                            │
│   + legenda de cores           ├────────────────────────────┤
│                                │  Feed Operacional          │
├────────────────────────────────┴────────────────────────────┤
│ Monitor de Fretes (tabela dinâmica com progresso e ETA)     │
├─────────────────────────────────────────────────────────────┤
│ Painel do Gestor (somente admin) — faturamento, ranking     │
└─────────────────────────────────────────────────────────────┘
```

Em tablet: mapa full width, alertas/feed abaixo em abas. Em mobile: KPIs em scroll horizontal, mapa em card, tabela em cards empilhados.

## Blocos

1. **Mapa Operacional** — reaproveita `FleetMap`, estendido para camadas: motoristas (cor por status), pedidos ativos (origem/destino), ocorrências, base da empresa. Filtros flutuantes (cidade, motorista, cliente, status, veículo, tipo de carga, período). Ao clicar num pedido: rota completa, ETA, km restantes, última atualização.
2. **KPIs** — 17 cartões calculados de `orders`, `drivers`, `vehicles`, `incidents`, `route_summaries` (Pedidos Hoje, Em Andamento, Finalizados, Coletas Pendentes, Motoristas Online/Disponíveis/Em Viagem/Offline, Veículos em Operação/Parados, Ocorrências, Atrasados, Tempo Médio, Taxa de Entrega, KM Rodados, Faturado, Lucro).
3. **Central de Alertas** — estende `ops-central.ts` com regras: desvio de rota, motorista parado (>15min sem ping em viagem), atraso, nova ocorrência, novo frete, novo motorista, documento/CNH vencendo (30d), veículo em manutenção, GPS offline (>10min), sem internet. Cada alerta: hora, responsável, prioridade, cor, ícone.
4. **Monitor de Fretes** — tabela realtime com Código, Cliente, Motorista, Origem→Destino, Status (label PT), ETA, % (via `progressPercent`), ocorrências. Linha clica → drawer lateral com detalhes e ações, sem sair da tela.
5. **Busca global** — Cmd/Ctrl+K abre command palette pesquisando `orders` (código/tracking/NF/CT-e), `clients`, `drivers` (nome/telefone), `vehicles` (placa), cidades.
6. **Central de Ações** — botões: Novo Frete, Nova Coleta, Cadastrar Motorista/Cliente/Veículo/Usuário, Nova Ocorrência.
7. **Feed Operacional** — timeline lendo `order_events` em tempo real (hora + descrição amigável).
8. **Indicador de saúde** — score 0-100 baseado em atrasos, ocorrências ativas, motoristas parados, GPS offline; badge Excelente/Boa/Atenção/Crítica.
9. **Modo TV** — rota `/ops/central/tv` (ou `?tv=1`) em tela cheia, sem sidebar, rotação automática entre mapa/KPIs/alertas/fretes, refresh agressivo.
10. **Modo Escuro** — toggle persistido em `localStorage`, tokens dark já mapeados em `styles.css`.
11. **Painel do Gestor** — só admin (via `has_role`): faturamento, despesas, lucro, custo/km, frete médio, top motoristas, top clientes, veículos mais usados, ranking mensal. Gráficos com Recharts.
12. **Realtime** — subscriptions em `orders`, `driver_locations`, `freight_offers`, `incidents`, `order_events`, `notifications`, `vehicles`.

## Detalhes técnicos

- Arquivos novos:
  - `src/components/ops/global-search.tsx` (Cmd+K)
  - `src/components/ops/quick-actions.tsx`
  - `src/components/ops/health-indicator.tsx`
  - `src/components/ops/freight-monitor.tsx`
  - `src/components/ops/operational-feed.tsx`
  - `src/components/ops/manager-panel.tsx`
  - `src/components/ops/map-filters.tsx`
  - `src/components/ops/order-drawer.tsx`
  - `src/routes/_authenticated/ops.central.tv.tsx`
  - `src/hooks/use-theme.ts`
- Extensões:
  - `src/lib/ops-central.ts`: novas regras de alertas (desvio, parado, documentos vencendo, GPS offline), tipos de KPI, score de saúde.
  - `src/components/fleet-map.tsx`: aceitar múltiplas camadas (motoristas, pedidos, incidentes, base), popup clicável emitindo seleção.
  - `src/routes/_authenticated/ops.central.tsx`: reestruturar layout, agregar todos os blocos, subscriptions consolidadas.
- Sem mudanças de schema (apenas leituras). Tudo respeita RLS existente; painel do gestor usa `has_role('admin')`.
- Responsividade com grid Tailwind (`grid-cols-[minmax(0,1fr)_360px]` no desktop, colapsando para stack no md/sm).
- Performance: `useQuery` com `staleTime` curto + realtime invalidations; agrupar canais em um único `supabase.channel`.

## Fora do escopo desta entrega
- CDs/Base da empresa: exibiremos apenas a base (endereço fixo em `app_settings`); múltiplos CDs ficam para depois se necessário.
- Detecção real de "sem internet" do motorista: aproximado por ausência de ping (mesma regra do GPS Offline).
