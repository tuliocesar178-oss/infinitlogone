## Módulo Veículos — Plano de Execução

Escopo enorme. Vou entregar em **4 fases**, cada uma funcional (sem telas "Em Breve"). Confirme fase a fase.

---

### Fase 1 — Fundação, Listagem, Cadastro e Documentos

**Banco de dados** (migration única):
- Extender `vehicles`: `photo_url`, `chassis`, `color`, `capacity_m3`, `axles`, `body_type`, `category`, `renavam`, `crlv_expires_at`, `licensing_expires_at`, `insurance_company`, `insurance_policy`, `insurance_expires_at`, `antt_number`, `antt_expires_at`, `ipva_expires_at`, `acquisition_date`, `owner_company`, `notes`, `current_km`, `current_city`, `current_state`, `current_lat`, `current_lng`, `current_speed_kmh`, `battery_level`, `last_location_at`, `status` (novo enum `vehicle_status`).
- Novo enum `vehicle_status`: `disponivel, em_coleta, em_transito, em_entrega, retornando, manutencao, bloqueado, reserva, offline`.
- Nova tabela `vehicle_types` (semeada com os 12 tipos + permite adicionar).
- Nova tabela `vehicle_documents` (kind, label, file_path, expires_at, mime_type, size_bytes).
- Bucket privado `vehicle-files` para fotos/docs.
- RLS: staff (admin/logistics) gerencia tudo; motoristas leem apenas o veículo vinculado.

**Frontend**:
- `/ops/veiculos` — listagem com cards/tabela, busca, filtros (status/tipo/motorista), ordenação, paginação.
- `/ops/veiculos/novo` e `/ops/veiculos/$id` — cadastro completo em abas: **Geral | Documentos | Manutenção | Abastecimentos | Multas | Histórico | Mapa**. Nas Fases 2–4 as abas ganham conteúdo real.
- Aba **Geral** e **Documentos** entregues nesta fase, com upload de foto e anexos com validade.
- Habilitar link "Veículos" no `app-shell.tsx`.
- Constantes em `src/lib/vehicles.ts` (status, cores, tipos, badges).

---

### Fase 2 — Manutenções, Abastecimentos, Multas e Lembretes

**Banco**:
- `vehicle_maintenances` (kind, date, km, cost, supplier, notes, attachments)
- `vehicle_refuelings` (date, station, city, liters, price_per_liter, total, km, driver_id, receipt_url) — trigger calcula consumo médio
- `vehicle_fines` (number, agency, date, amount, driver_id, status: pago/pendente/recorrido, doc_url)
- `vehicle_reminders` (view materializada / função que agrega vencimentos: seguro, IPVA, CNH motorista, licenciamento, ANTT, próxima manutenção por KM/tempo)
- Job/função `notify_vehicle_reminders` que enfileira em `notifications` para staff.

**Frontend**:
- Abas de Manutenção, Abastecimento e Multas ativas com CRUD, upload de comprovantes/NFs.
- Painel de **Lembretes** em `/ops/veiculos` (topo) e no dashboard operacional.
- Cálculo automático de consumo médio exibido no header do veículo.

---

### Fase 3 — Localização, Mapa da Frota, Checklist e Integrações

**Banco**:
- `vehicle_checklists` (order_id, driver_id, itens JSON, photos, has_issue, opened_incident_id)
- Trigger: `has_issue = true` → cria `incidents` automaticamente.
- Trigger em `orders`: ao atribuir motorista, vincular veículo atual; ao mudar status do pedido, atualizar `vehicles.status` conforme mapeamento (Coleta→em_coleta, Trânsito→em_transito, Entrega→em_entrega, Finalizado→disponivel).
- Trigger em `driver_locations` atualiza `vehicles.current_lat/lng/city/state/speed/last_location_at` do veículo vinculado.

**Frontend**:
- Aba **Mapa** do veículo com Mapbox: pino ao vivo, cidade/estado, velocidade, última atualização, bateria.
- `/ops/veiculos/mapa` — mapa consolidado da frota com todos os pinos coloridos por status, filtros e cards laterais.
- Checklist de saída no app do motorista (`ActiveTripCard`) — obrigatório antes de "INICIAR DESLOCAMENTO", com anexo de fotos e abertura automática de ocorrência.

---

### Fase 4 — Dashboard da Frota, Histórico e Financeiro

**Banco**:
- `vehicle_expenses` (unificada: origem = manutenção | abastecimento | multa | seguro | ipva | licenciamento | pedágio) — populada por triggers das tabelas correspondentes.
- Views: `vehicle_stats` (km percorridos, tempo em operação, custo/km, receita associada via `orders.price`).

**Frontend**:
- Aba **Histórico** do veículo: fretes realizados, motoristas, KM, ocorrências, custos, receitas.
- `/ops/veiculos/dashboard` — KPIs (total, por status, KM, consumo médio, custo/km), rankings (mais utilizados, maior custo), gráficos Recharts.
- Integração com módulo Financeiro (quando existir) via `vehicle_expenses`.

---

### Detalhes técnicos

- Enums novos criados via migration; após aprovação da migration, tipos regenerados antes do código TypeScript que os consome.
- Mapbox reutiliza `trip-map.tsx` e `MAPBOX_PUBLIC_TOKEN` já conectado.
- Todos os uploads em bucket `vehicle-files` (privado) via signed URLs.
- RLS consistente com `is_staff()` e `has_role()`.
- Documentos com validade dispararão lembretes via mesma pipeline de `notification_outbox`.

---

**Próximo passo**: executar **Fase 1** completa (migration + listagem + cadastro Geral/Documentos + navegação). Confirma para eu iniciar?