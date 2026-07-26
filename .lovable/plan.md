# InfinitLog TMS — Reorientação da Plataforma

A plataforma deixa de ser marketplace e passa a ser um **TMS interno**: cliente não faz login para pedir frete, apenas rastreia. A equipe de logística cadastra o pedido, o sistema oferta a motoristas, e o motorista segue um fluxo guiado que atualiza o status automaticamente.

## Ajustes no modelo atual

O schema criado na Fase 1 já cobre 90% do necessário. Vou apenas:

- **Remover perfil `client`** do fluxo de login: cliente vira só um registro na tabela `clients` (dados de contato). Sem `auth.users` para cliente.
- **Ampliar `orders`**: `contact_name`, `contact_phone`, `pickup_window_start/end`, `delivery_window_start/end`, `volumes`, `cargo_type`, `priority`, `negotiated_price` (renomear `price`), campo `qr_payload`.
- **Novo enum `order_status`** com os passos operacionais:
  `preparing → awaiting_driver → driver_assigned → en_route_pickup → at_pickup → loaded → out_for_delivery → in_transit → near_destination → delivered → finalized → incident → cancelled`.
- **Mapeamento cliente-visível** (view/função): reduz para 7 status públicos.
- **Tabela `order_attachments`** (NF, CT-e, MDF-e, fotos, PDFs, outros) com `kind` enum.
- **Bucket Storage** `order-files` (privado) + policies por pedido/motorista.
- **`freight_offers`**: já existe. Adiciono job de auto-broadcast/expiração via `pg_cron` + server function `/api/public/hooks/dispatch-offers`.

## Rotas (nova estrutura)

```text
/                          Landing institucional
/rastreio                  Busca pública (código ou nº pedido)
/rastreio/$code            Timeline + mapa + status público
/auth                      Login (apenas staff + motorista)
/_authenticated/app        Redireciona por role
/_authenticated/ops        Painel logística (cards operacionais, novo pedido, chat)
/_authenticated/ops/pedidos/$id   Detalhe do pedido (edição, anexos, ofertas, chat, timeline)
/_authenticated/ops/pedidos/novo  Cadastro guiado
/_authenticated/admin      Igual ops + KPIs, cadastros, financeiro
/_authenticated/driver     Home: oferta atual OU frete ativo
/_authenticated/driver/frete/$id  Fluxo guiado (1 botão por vez)
```

Rota `/_authenticated/me` (cliente) é removida.

## Fluxo do motorista (guiado, 1 ação por vez)

Cada botão dispara uma server function que insere `order_event` e transita o `orders.status`. Motorista nunca escolhe status.

```text
Aceitar oferta      → driver_assigned
INICIAR DESLOCAMENTO → en_route_pickup
CHEGUEI NA COLETA    → at_pickup
ENVIAR FOTOS+NF+volumes → loaded → out_for_delivery
INICIAR ENTREGA      → in_transit
(GPS < X km)         → near_destination (automático)
ENVIAR COMPROVANTES  → delivered
(revisão staff)      → finalized
```

Uploads obrigatórios validados no server antes de transitar.

## Notificações

Trigger em `orders` após update de status:
- insere linhas em `notifications` para staff + admin + (futuro) cliente.
- Chama server fn que envia e-mail (Resend/Lovable) para o cliente com link `/rastreio/$code`.
- Estrutura pronta para WhatsApp (webhook `/api/public/hooks/whatsapp-out` stub).

## Fases de entrega

**Fase 2A — Núcleo TMS (o que farei agora se aprovado)**
1. Migração: novo enum de status, colunas extras em `orders`, tabela `order_attachments`, bucket + policies, trigger de auto-notificação.
2. Cadastro de pedido (ops/admin) em wizard curto + upload de anexos + geração de QR/tracking.
3. Painel de logística com os 8 cards operacionais reais + lista filtrada ao clicar.
4. Detalhe do pedido: edição, anexos, timeline, chat, ações de admin (cancelar, marcar ocorrência, forçar reoferta).
5. Portal público `/rastreio` + `/rastreio/$code` com status mapeados, timeline, QR code.
6. Remoção do perfil client do login e da rota `/me`.

**Fase 2B — Motorista guiado**
7. Home do motorista: oferta ativa (aceitar/negociar/recusar com countdown) ou frete em andamento.
8. Tela do frete com o "próximo passo" e formulários obrigatórios (fotos, NF, volumes, canhoto, assinatura, recebedor).
9. Auto-broadcast de ofertas via `pg_cron` (expira e reoferta) mantendo a primeira oferta válida até alguém aceitar.

**Fase 3 — Mapa & Realtime (Mapbox)**
10. Posição do motorista (upsert em `drivers.current_lat/lng`) + Realtime.
11. Mapa no painel ops, no detalhe do pedido, no rastreio público, e cálculo de "próximo ao destino".

**Fase 4 — Chat + notificações ricas**
12. Chat por pedido com fotos/PDF/áudio/vídeo (Storage).
13. E-mail transacional para cliente a cada mudança pública de status. Estrutura WhatsApp preparada.

**Fase 5 — Financeiro, auditoria, exportações** (sem mudança em relação ao plano anterior).

## Detalhes técnicos

- Todas as transições de status são feitas por `createServerFn` com `requireSupabaseAuth`, verificando papel (`is_staff` ou driver dono do frete) e gravando `order_events` na mesma transação (RPC SQL).
- Anexos: upload direto ao Storage via signed URL emitido por server fn (evita expor service role).
- QR Code: gerado no cliente (`qrcode` npm) apontando para `https://<host>/rastreio/<code>`.
- Auto-oferta: `freight_offers.expires_at` + cron a cada minuto chama `/api/public/hooks/dispatch-offers` (protegido por `apikey` anon) que oferta a próximo motorista disponível sem cancelar as anteriores; ao 1º aceite, cancela as demais via trigger.
- `driver` e `logistics` continuam com RLS restrito; `admin` amplo.
- i18n pt-BR em toda UI.

## Confirmações antes de começar Fase 2A

1. Posso **remover o perfil cliente do login** e a rota `/me`? Clientes viram apenas registros gerenciados pela logística.
2. **E-mail transacional para o cliente**: posso habilitar Resend (Lovable) usando o e-mail em `clients.contact_email` para enviar link de rastreio a cada mudança de status pública?
3. **Prioridade da execução**: começo por Fase 2A (núcleo TMS + rastreio público) e depois 2B (motorista)? Ou prefere motorista antes?
4. **Mapbox** ainda não está conectado — mantenho para a Fase 3 conforme original, ok?
