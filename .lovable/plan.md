# Central Inteligente de Controle da Frota

Transforma `/ops/veiculos` em um mapa Mapbox em tela cheia estilo Uber, com veículos, motoristas e entregas em tempo real, filtros, sugestão inteligente de veículos para novos fretes, heatmap, geofences, replay de rotas e alertas.

Como é uma entrega grande, proponho executar em **4 fases**, cada uma testável antes da próxima.

---

## Fase 1 — Mapa em tempo real + Card de Disponibilidade

Substitui a listagem atual por um mapa em tela cheia.

- Nova rota principal: `/ops/veiculos` = mapa. A listagem atual vira `/ops/veiculos/lista`.
- Marcadores coloridos por status (9 cores conforme especificado).
- Painel lateral com card **Disponibilidade da Frota** (Total, Disponíveis, Em Viagem, Em Coleta, Carregando, Próximos, Retornando, Manutenção, Offline).
- Filtros: cidade, estado, motorista, tipo de veículo, status, cliente.
- Popup ao clicar no veículo com: foto, placa, modelo, motorista, telefone, cliente, origem/destino, status, velocidade, KM restantes, ETA, % da rota, carga/peso/volumes, última atualização.
- Realtime: assinatura em `driver_locations` e `orders` via Supabase Realtime.
- Rotas ativas desenhadas usando `orders.origin_lat/lng`, `current_lat/lng`, `destination_lat/lng`.

## Fase 2 — Sugestão Inteligente para Novos Fretes

- No wizard `/ops/pedidos/novo`, ao definir coleta, chamar server function que:
  - Busca veículos com `drivers.status='available'` e localização recente.
  - Calcula distância haversine e ETA (Mapbox Directions via connector).
  - Retorna top 5 veículos e top 5 motoristas com distância, tempo, situação e KM até coleta.
- Bloqueia seleção de veículos indisponíveis.
- Destaca no mapa (Fase 1) os candidatos com halo.

## Fase 3 — Heatmap, Geofences e Replay

- Camada Heatmap Mapbox: concentração de veículos + entregas (últimos 7 dias).
- Nova tabela `geofences` (base, cliente, CD, coleta, entrega) com centro + raio; trigger que atualiza status/notifica ao entrar/sair (reaproveita `tg_after_driver_location`).
- Replay de rota reaproveitando `route_summaries.replay_geojson` — player com timeline, velocidade, paradas.

## Fase 4 — Alertas e Dashboard Operacional

- Tabela `fleet_alerts` + job pg_cron chamando `/api/public/hooks/fleet-monitor` a cada 2 min.
- Regras: veículo parado >30min, fora de rota (>500m do trajeto), atraso > previsto, GPS desconectado (sem ping >10min), perda de conexão.
- Notifica admin/logística via `notifications` + toast realtime.
- Dashboard operacional no topo do mapa: veículos ativos, motoristas ativos, fretes andando, entregas de hoje, tempo médio, KM rodados hoje, combustível estimado (KM × consumo médio do tipo), veículos parados.

---

## Detalhes técnicos

- Mapbox GL JS via `VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN` (já conectado).
- Directions/Matrix via gateway `MAPBOX_API_KEY` em server functions.
- Cores de status mapeadas em `src/lib/vehicles.ts` (novo `FLEET_MAP_COLORS`).
- Reaproveita: `driver_locations`, `route_summaries`, `orders`, `drivers`, `vehicles`, `tg_after_driver_location`, `finalize_route`.
- Migrations necessárias: `geofences`, `fleet_alerts`, colunas `vehicles.avg_fuel_kmL` e `vehicles.current_lat/lng/last_seen_at`.

---

**Começo pela Fase 1 assim que você aprovar.** Confirma seguir nessa ordem, ou quer priorizar outra fase primeiro (ex.: sugestão inteligente antes do heatmap)?
