# Módulo Motoristas — InfinitLog

Escopo grande. Vou entregar em 4 fases sequenciais para você validar cada etapa. Nada de tela "Em Breve".

## Fase 1 — Fundação (schema + listagem + perfil lateral)

**Banco (migration única):**
- Estender `drivers` com: `rg`, `cnh_issued_at`, `antt_expires_at`, `whatsapp`, `email`, `birth_date`, `gender`, `civil_status`, `address`, `address_number`, `address_complement`, `neighborhood`, `state`, `zip`, `notes`, `availability` (novo enum: `disponivel|em_frete|folga|ferias|bloqueado|offline`), `rating`, `daily_rate`, `hourly_wait_rate`, `owns_vehicle boolean`.
- Estender `vehicles` com: `color`, `max_weight_kg`, `axles`, `renavam`, `crlv_expires_at`, `insurance_expires_at`, `antt_expires_at`, `owner_driver_id`, `notes`.
- Nova tabela `driver_documents` (kind, label, file_path, expires_at, uploaded_by) com RLS + GRANT.
- Nova tabela `driver_ratings` (order_id, driver_id, score, notes).
- Bucket privado `driver-documents` + policies (staff read/write, motorista lê o próprio).
- Policies: motorista só vê a própria linha em `drivers`/`driver_documents`; staff (admin/logistics) gerencia tudo; logistics não pode DELETE em `drivers`.
- View `driver_stats` (total_fretes, em_andamento, concluidas, ultimo_acesso) via `orders`.

**UI:**
- Reescrever `/ops/motoristas`: busca, filtros (situação, cidade, disponibilidade), ordenação, paginação, toggle Cards/Lista, todas as colunas pedidas.
- Botão "Novo motorista" → modal cria `auth.users` (via server fn com `supabaseAdmin.auth.admin.inviteUserByEmail`) + linhas `profiles`/`drivers`/role.
- Painel lateral (Sheet) ao clicar: foto, contatos, status, veículo, financeiro resumido, últimos fretes, mapa Mapbox com última localização.
- Ações no painel: Editar, Bloquear/Desbloquear (`financial_status`+`availability`), Reset senha, Reenviar convite, Excluir (admin), Ver histórico.

## Fase 2 — Cadastro completo (tabs)

Reescrever `/ops/motoristas/$id` com abas:
1. **Cadastro** — todos os campos pessoais + endereço + CNH + ANTT com datas de validade.
2. **Veículo** — toggle "próprio/empresa"; se próprio, formulário completo em `vehicles` com `owner_driver_id`; se empresa, select dos veículos ativos.
3. **Financeiro** — campos já existentes + `daily_rate` e `hourly_wait_rate`; card "Status Financeiro" (Saldo a Receber, Último/Próximo Pagamento, Pendentes/Pagos/Total) computado de `orders`+`freight_programs`.
4. **Documentos** — upload categorizado (CNH frente/verso, foto, ANTT, comprovante residência, doc veículo, certificados, outros) com preview, alerta de validade próxima.
5. **Histórico** — tabela de fretes (data, origem/destino, cliente, km, tempo, valor, pagamento, ocorrências).
6. **Ofertas** — todas ofertas de `freight_offers` (aceitas/recusadas/expiradas/negociação, tempo de resposta).
7. **Localização** — mapa Mapbox com última localização + timestamp + cidade/estado.

## Fase 3 — Integrações

- Ao selecionar motorista em `freight-program-panel`, preencher automaticamente valor, forma de pagamento, banco, PIX, conta (já lê `drivers`, vou expor no card da PF).
- Trigger: `orders.status='delivered'` atualiza `driver_stats`; `driver_locations` mais recente alimenta o card de perfil.
- Filtro de ofertas: `send_program_to_driver` recusa motorista com `availability != 'disponivel'` ou `financial_status='bloqueado'`.

## Fase 4 — Motorista (visão do próprio)

- `/driver/perfil` — motorista vê e edita apenas o próprio cadastro/documentos (RLS já garante).
- Bloqueado por RLS de ver outros motoristas.

## Detalhes técnicos

- Server functions em `src/lib/drivers.functions.ts` (`inviteDriver`, `resetDriverPassword`, `deleteDriver`) usando `requireSupabaseAuth` + `supabaseAdmin` carregado no handler, checando `has_role(admin|logistics)`.
- Componentes: `DriverSidePanel`, `DriverCard`, `DriverListRow`, `DriverDocumentsTab`, `DriverVehicleTab`, `DriverFinanceTab`, `DriverHistoryTab`, `DriverOffersTab`, `DriverLocationTab`.
- Reuso: `TripMap` para localização, `share-tracking` padrões visuais.
- Sem novas Edge Functions; tudo via `createServerFn`.

## Confirmação

Começo pela **Fase 1** (migration + listagem nova + painel lateral + convite/bloqueio). Ao aprovar cada fase, sigo para a próxima. Confirma?
