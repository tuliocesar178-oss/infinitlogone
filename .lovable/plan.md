## Mapa Inteligente de Aproximação

Sistema completo de rastreamento em tempo real com transições automáticas de status conforme o motorista se aproxima do destino, com experiências dedicadas para cliente, motorista e equipe de logística.

---

### 1. Infraestrutura

**Conector Mapbox** (`standard_connectors--connect` com `mapbox`)
- Token público (browser) para mapas interativos
- Token secreto (server) para geocoding/directions/matrix
- Conforme regra: só um conector de mapas por projeto — Mapbox substitui a intenção anterior de Google Maps

**Novas configurações** (tabela `app_settings`)
- `approach_radius_km` (padrão 20) — raio de aproximação
- `near_radius_km` (padrão 5) — raio "muito próximo"
- `arrival_radius_m` (padrão 100) — raio para liberar entrega
- `ping_interval_seconds` (padrão 15)

Admin edita em `/admin/config`.

---

### 2. Schema

**Novas tabelas:**
- `driver_locations` — pings brutos (order_id, driver_id, lat, lng, speed_kmh, heading, accuracy_m, created_at). Índice por order_id + created_at.
- `route_summaries` — histórico consolidado por pedido (started_at, arrived_at, total_distance_km, total_minutes, avg_speed, stops_count, replay_geojson).
- `app_settings` — chave/valor JSON com política admin-only.

**Novas colunas em `orders`:**
- `distance_to_destination_km`, `eta_minutes`, `current_city`, `last_ping_at`
- `approach_notified_at`, `near_notified_at`, `arrival_detected_at`
- `started_trip_at`, `arrived_at`

**Novo enum status:** já existe `near_destination` — reutilizar. Adicionar transições automáticas via trigger a partir de ping.

**Realtime:** habilitar `orders` e `driver_locations` na publication.

---

### 3. Backend — Server Functions & Route

- **`/src/lib/tracking.functions.ts`**
  - `pingLocation({ orderId, lat, lng, speed, heading, accuracy })` — motorista autenticado. Calcula distância (haversine), grava ping, atualiza order (distance/eta/last_ping_at/current_city via Mapbox reverse geocoding). Ao cruzar `approach_radius_km` → status `near_destination` + enfileira notificações (aproximação). Ao cruzar `arrival_radius_m` → marca `arrival_detected_at`.
  - `finalizeRoute({ orderId })` — chamada quando status muda para `delivered`; consolida `route_summaries` a partir dos pings.
  - `overrideArrivalPermission({ orderId })` — staff-only, permite entrega fora do raio.
- **`/src/routes/api/tracking-eta.ts`** — server route (staff) que chama Mapbox Directions para atualizar ETA sob demanda.

Trigger SQL `after insert on driver_locations` sincroniza `orders.last_ping_at` e cria evento se cruzar `near_destination`.

---

### 4. Motorista (`/driver/pedido/$id`)

Nova tela de viagem ativa:
- Botão "INICIAR DESLOCAMENTO" → habilita geolocation watcher (a cada `ping_interval_seconds`) que chama `pingLocation`.
- Mapbox GL mostrando rota origem→destino e posição atual.
- **Modo aproximação** (dentro do raio): banner "Você está próximo do destino" + checklist (NF, canhoto, fotos, assinatura).
- **Chegada** (dentro de `arrival_radius_m`): botão "REGISTRAR ENTREGA" liberado. Fora do raio, botão desabilitado com nota "Aguardando aproximação do endereço ou autorização da logística".
- Wizard de entrega: fotos (carga, canhoto, NF), nome/documento recebedor, assinatura em canvas → salva em `deliveries` + storage, muda status para `delivered`.

---

### 5. Cliente — Portal `/rastreio/$code`

Detecta `status === 'near_destination'` e ativa **Modo Aproximação**:
- Banner destacado: "🚚 Seu pedido está chegando!"
- Cards: Distância atual, ETA, Cidade atual, Última atualização
- Barra de progresso animada baseada em `distance_to_destination_km` vs distância inicial
- Mapa Mapbox mostrando motorista (marker animado), destino e rota restante
- Atualização via Supabase Realtime na tabela `orders` (sem reload)

Evidências (fotos/canhoto/assinatura) aparecem quando `delivered`.

---

### 6. Logística `/ops`

Novo card destacado no topo: **Entregas Próximas** (pedidos com status `near_destination` OU distância < aproximação).
- Colunas: Cliente | Motorista | Cidade atual | Distância | ETA | Status
- Linhas em vermelho quando `eta > delivery_window_end` (atraso)
- Ação "Abrir replay" → visualização da rota completa (polyline no mapa) após entrega
- Ação "Autorizar entrega fora do raio" quando aplicável

---

### 7. Notificações

Reaproveita `notification_outbox` já enfileirado por trigger de status. Adiciona novos tipos:
- `approach_20km`, `approach_10km`, `approach_5km`, `arrival_imminent`
- Canais: push, e-mail, WhatsApp (linha na outbox marcada como pendente para provider futuro)

Mensagens localizadas em `src/lib/notification-templates.ts`.

---

### 8. Histórico e Replay

- `route_summaries` consolidado ao finalizar entrega
- `/ops/pedidos/$id` ganha aba "Replay da rota" com polyline animada (Mapbox) reproduzindo pings
- Métricas: distância, tempo total, velocidade média, paradas (heurística: velocidade < 3 km/h por > 3 min)

---

### 9. Inteligência de trânsito (fase futura preparada)

- Server fn `refreshEtaFromTraffic` chamada a cada 5 min por trip ativa via `pg_cron` → endpoint público assinado (`/api/public/cron/refresh-eta`)
- Se novo ETA > ETA anterior + 20%, dispara notificação de atraso
- Nesta entrega deixamos apenas o endpoint e cron desativado (habilitável quando o Mapbox connector estiver conectado)

---

### Sequência de execução

1. Conectar Mapbox (bloqueia até o usuário aprovar em card)
2. Migração DB (tabelas, colunas, triggers, RLS, GRANTs, realtime)
3. Server functions e route de tracking
4. Tela do motorista com watcher + mapa + wizard de entrega
5. Portal do cliente com Modo Aproximação + mapa realtime
6. Card "Entregas Próximas" e replay em `/ops`
7. Templates de notificação e enfileiramento nos limiares
8. Config admin em `/admin/config`

Aprove para eu começar solicitando a conexão do Mapbox.
