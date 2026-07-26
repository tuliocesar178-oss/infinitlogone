# Gestão de Fretes — Módulo completo

Reescreve `/ops` (dashboard de fretes), o wizard de novo frete e o fluxo do motorista para virar o **núcleo operacional** da InfinitLog. Reaproveita tudo que já existe: `orders`, `freight_programs`, `freight_offers`, `negotiations`, `deliveries`, `messages`, `order_events`, `order_attachments`, `driver_locations`, `send_program_to_driver()`, `on_offer_accepted()`, `generate_pf_code()`, `generate_tracking_code()`.

Entrego em **4 fases** — cada uma testável antes da próxima.

---

## Fase 1 — Dashboard de Fretes + Cards clicáveis + Detalhe

Substitui o `/ops` atual pelo dashboard de fretes definido no spec.

- **Cards por estado** com contagem em tempo real (Preparando · Aguardando Motorista · Oferta Enviada · Em Deslocamento · Em Coleta · Em Trânsito · Próximo da Entrega · Entregues Hoje · Ocorrências).
- Clique no card → `/ops/pedidos?status=<card>` (nova rota) que mostra a lista filtrada.
- Botão fixo **NOVO FRETE** no topo.
- Lista com busca por código/cliente/cidade e filtros de prioridade/data.
- Sincronização realtime nas tabelas `orders`, `freight_offers`, `incidents`.
- **Não** mexe no wizard nem no motorista nesta fase — reaproveita o que já roda.

## Fase 2 — Wizard de Novo Frete em 6 etapas

Reconstrói `/ops/pedidos/novo` como stepper Uber-like com progresso, validação Zod por etapa e resumo lateral.

1. **Cliente** — cliente, contato, telefone, e-mail, empresa, OC, pedido, observações.
2. **Coleta** — empresa, responsável, telefone, endereço, cidade/UF/CEP, data, hora, franquia (min).
3. **Entrega** — mesmos campos, data/hora previstas, franquia.
4. **Carga** — peso, volumes, cubagem, tipo, produto, valor NF, número NF, CT-e, MDF-e, obs.
5. **Custos** — valor cliente, valor motorista, pedágio, combustível, escolta, licença, outros. Calcula em tempo real: **Custo Total**, **Lucro Previsto**, **Margem %**.
6. **Documentos** — upload NF, CT-e, MDF-e, XML, fotos, PDF, vídeos → bucket `order-files` → grava em `order_attachments`.

Ao salvar: cria `orders` (trigger já gera `tracking_code` e a `freight_programs` com `pf_code`), grava `freight_costs`, faz upload e mostra tela final com **QR Code**, **link de rastreio**, botões WhatsApp/Copiar/E-mail e **Despachar agora**.

## Fase 3 — Despacho Inteligente + Oferta + Negociação

Reaproveita `send_program_to_driver()` e a tabela `negotiations`.

- **Painel de Despacho** dentro do detalhe do pedido e no botão "Despachar" do dashboard.
- Server function `suggestDrivers(orderId)`:
  - Busca motoristas com `availability='disponivel'` e `status ≠ offline`.
  - Filtra por capacidade do veículo × peso da carga e tipo.
  - Calcula distância `driver.current_lat/lng → order.origin_lat/lng` (Haversine + Mapbox Matrix quando disponível).
  - Score composto: distância (peso 40) + rating (20) + histórico de aceite (15) + tempo parado (10) + fretes do dia (10) + tipo do veículo compatível (5).
  - Retorna top-N com ⭐ para o melhor.
- Lista de motoristas: foto, nome, cidade, veículo/placa, KM até coleta, ETA, status, valor sugerido (editável), botão **Enviar oferta**.
- Enviar oferta chama `send_program_to_driver()` → cria `freight_offers` e status vira `awaiting_driver`.
- **Portal do motorista** (`/driver`) já mostra ofertas; adiciono botão **Negociar** que abre modal (valor + obs) e insere `negotiations{status='proposed'}`.
- No detalhe do pedido, painel de negociações: cada proposta com **Aceitar** (atualiza `offered_price` e aceita a oferta) / **Contrapropor** (insere nova `negotiations{status='countered'}`) / **Recusar**.
- Trigger `on_offer_accepted` já cuida: cancela demais ofertas, vincula motorista, muda status para `driver_assigned`.

## Fase 4 — Fluxo Automático do Motorista + Chat + Histórico

Reescreve `/driver` para o fluxo de botões sequenciais (nenhum status manual).

- **Máquina de estados por ação**:
  - `driver_assigned` → botão **INICIAR DESLOCAMENTO** (`en_route_pickup`).
  - `en_route_pickup` → **INICIAR NAVEGAÇÃO** (abre Google Maps + começa ping GPS).
  - próximo (100m origem OU botão manual staff) → **CHEGUEI NA COLETA** (`at_pickup`).
  - `at_pickup` → **ENVIAR FOTO DA CARGA** (form obrigatório: fotos carga, foto NF, volumes conferidos, obs) → `loaded` → automático `out_for_delivery`.
  - `out_for_delivery` → **INICIAR ENTREGA** (`in_transit`).
  - próximo destino → **ENVIAR COMPROVANTES** (form: canhoto, NF assinada, fotos, nome recebedor, doc recebedor, assinatura digital em canvas) → grava em `deliveries` + `delivered`.
- Todas as ações gravam `order_events` com actor, from_status, to_status, GPS, payload.
- **Chat por pedido** (`/ops/pedidos/$id` aba Chat + no /driver): usa `messages` com kinds `text/photo/video/pdf/audio` (bucket `order-files`) e Supabase Realtime.
- **Histórico completo** no detalhe do pedido: timeline de `order_events` + negociações + entradas de custos + anexos + ocorrências, com actor, timestamp e GPS quando houver.

---

## Detalhes técnicos

- Novas rotas: `ops.pedidos.tsx` (lista filtrável), `ops.pedidos.$id.chat.tsx` (opcional; inicialmente aba dentro do detalhe).
- Reescreve: `ops.tsx` (dashboard cards), `ops.pedidos.novo.tsx` (wizard), `driver.tsx` (fluxo sequencial), `ops.pedidos.$id.tsx` (adiciona abas Despacho, Negociações, Chat, Histórico).
- Novos componentes: `components/orders/status-cards.tsx`, `orders/order-list.tsx`, `orders/new-order-wizard.tsx`, `orders/step-*.tsx`, `orders/dispatch-panel.tsx`, `orders/driver-suggestions.tsx`, `orders/negotiation-panel.tsx`, `orders/history-timeline.tsx`, `orders/order-chat.tsx`, `driver/action-flow.tsx`, `driver/pickup-evidence-form.tsx`, `driver/delivery-evidence-form.tsx`.
- Novas libs: `lib/orders.functions.ts` (createOrder, addCosts, suggestDrivers, respondNegotiation, driverAction), `lib/order-flow.ts` (mapa ação→transição).
- Sem migração nova; se necessário na Fase 3 crio `driver_stats` view. Bucket `order-files` já existe.
- Redirecionamento admin/logistics permanece `/ops/central`; `/ops` fica como Dashboard de Fretes (segundo item da sidebar).

---

**Começo pela Fase 1.** Alguma prioridade diferente ou confirmo essa ordem?
