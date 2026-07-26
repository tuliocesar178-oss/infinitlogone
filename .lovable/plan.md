# Programação de Frete (PF)

Novo módulo que consolida cliente, motorista, operação, custos, pagamento e documentos em um único documento oficial gerado automaticamente a cada pedido. Numeração `PF-AAAA-000001`, exportável em PDF, com fluxo de envio ao motorista integrado ao módulo de ofertas já existente.

## 1. Banco de dados (migração única)

### 1.1. Ampliar `drivers` (dados financeiros/cadastrais)
Adicionar colunas: `cpf`, `phone`, `city`, `photo_url`, `rntrc`, `cnh_expires_at`, `bank_name`, `bank_code`, `bank_agency`, `bank_account`, `bank_account_digit`, `bank_account_type` (`corrente|poupanca`), `pix_key`, `pix_key_type` (`cpf|cnpj|email|phone|random`), `favored_name`, `favored_document`, `preferred_payment_method` (`pix|ted|doc|boleto`), `payment_term_days`, `default_price_per_km numeric`, `min_freight_value numeric`, `financial_notes`, `financial_status` (`ativo|bloqueado|pagamento_pendente`, default `ativo`).

### 1.2. Ampliar `orders`
Adicionar: `origin_state`, `origin_zip`, `destination_state`, `destination_zip`, `cargo_volume_m3` (cubagem), `invoice_value numeric`, `cargo_value_declared numeric`, `cte_number`, `mdfe_number`, `pickup_franchise_minutes int`, `delivery_franchise_minutes int`.

### 1.3. Nova tabela `freight_programs`
Colunas: `id`, `order_id (unique)`, `pf_code text unique` (`PF-AAAA-000001` via sequência + função `generate_pf_code()`), `status` (`draft|sent|accepted|declined|cancelled`), `freight_value numeric`, `payment_method` (`pix|ted|transferencia|boleto`), `payment_term` (`a_vista|30d|45d|60d|90d`), `payment_notes`, `responsible_id uuid` (usuário logística), `sent_at`, `created_at/updated_at`. Trigger `AFTER INSERT ON orders` cria automaticamente o `freight_programs` em `draft` já com `responsible_id = created_by`.

### 1.4. Nova tabela `freight_costs`
Colunas: `id`, `program_id`, `kind` (`frete|pedagio|licenca|batedor|escolta|combustivel|ajudante|estadia|diaria|outros`), `label`, `amount numeric`, `notes`. View `freight_program_totals` soma custos por programa.

### 1.5. Ampliar `order_attachments`
Adicionar `xml_url text` só como novo `kind` (aceitar: `nota_fiscal|cte|mdfe|manifesto|pdf|foto|video|xml`). Nenhum schema change — apenas convenção; o `kind` já é `text`.

### 1.6. RLS + GRANTs
- `freight_programs` / `freight_costs`: staff `ALL`; motorista `SELECT` quando `program.order.driver_id = auth.uid()` e `status = 'sent'`.
- Novos campos financeiros em `drivers` já protegidos pelas policies existentes (staff-only para leitura ampla; motorista lê os próprios).

## 2. Backend automatizado

- `generate_pf_code()` — igual ao `generate_tracking_code`, com sequência `freight_program_seq`.
- Trigger `trg_orders_create_pf` — insere `freight_programs(order_id, pf_code, status='draft', responsible_id=NEW.created_by)`.
- Função RPC `send_program_to_driver(_program_id uuid, _driver_id uuid, _price numeric, _expires_minutes int default 15)` — em transação: seta `orders.driver_id? não` (fica só quando aceito) → cria `freight_offers` para o motorista escolhido, marca `freight_programs.status='sent'`, `sent_at=now()`, e insere `order_events`.
- Trigger em `freight_offers` (accept) já existente: quando aceito, atualizar `freight_programs.status='accepted'` e `orders.status='driver_assigned'`. Isso libera automaticamente o botão "INICIAR DESLOCAMENTO" no app do motorista (já suportado pelo enum de status).

## 3. Frontend — Logística

### 3.1. Cadastro do motorista (nova aba "Financeiro")
Rota `/_authenticated/ops/motoristas/$id` já pode ser criada agora. Duas abas: **Cadastro** (dados pessoais + CNH + veículo) e **Financeiro** (banco, PIX, favorecido, forma/prazo, valores padrão, situação). Upload de foto para bucket `driver-photos` (novo, público).

### 3.2. Programação de Frete
Ao abrir `/ops/pedidos/$id`, adicionar aba **"Programação de Frete (PF-…)"** com seções colapsáveis:
1. **Cliente** — read-only, puxado de `orders`.
2. **Motorista** — combobox de motoristas disponíveis; ao escolher, exibe cartão com foto, CNH, veículo, dados bancários (mascarados). Botão "trocar".
3. **Operação** — form com endereços completos + CEP/UF, peso, volumes, cubagem, tipo, NF, CT-e, MDF-e, obs.
4. **Programação** — datas/horas de coleta e entrega, franquias, tempo estimado e KM (auto-preenchidos, editáveis).
5. **Custos** — tabela editável (linhas com tipo + valor + obs), total calculado.
6. **Condição de pagamento** — método + prazo + observações.
7. **Documentos** — reaproveita `order_attachments`, com filtros por tipo (NF/CT-e/MDF-e/Manifesto/PDF/Foto/Vídeo/XML).
8. **Responsável** — nome + timestamp, automáticos.

Barra fixa inferior: **Salvar** · **Exportar PDF** · **Enviar ao motorista** (dispara `send_program_to_driver`).

### 3.3. Exportação PDF
Client-side com `@react-pdf/renderer` (leve, sem Node deps). Layout A4:
- Cabeçalho com logo InfinitLog + `PF-2026-000001` grande + `Código de rastreio` e QR (gerado com `qrcode`).
- Blocos: Cliente / Motorista (com foto) / Operação / Programação / Custos (tabela) / Total / Condição de pagamento / Responsável e assinatura.
- Rodapé com contato e link de rastreio.
Botão baixa como `PF-2026-000001.pdf`.

## 4. Frontend — Motorista
A tela de oferta já existe (`_authenticated/driver.*`). Enriquecer o cartão da oferta com dados vindos do `freight_programs` associado: cliente, origem/destino, mapa (mantém o placeholder atual), valor, peso, volumes, tipo, datas e lista de documentos. Botões **ACEITAR** / **NEGOCIAR** / **RECUSAR** — já implementados. Após aceite → status vira `driver_assigned` e libera **INICIAR DESLOCAMENTO** (fluxo existente).

## 5. Segurança e validações
- Zod nos forms (endereços, valores ≥ 0, prazos válidos, CPF/CNPJ com máscara).
- Nunca expor dados bancários do motorista no portal público de rastreio (o `get_tracking` já filtra).
- PF em `draft` visível só à staff; motorista só enxerga após `send_program_to_driver`.

## 6. Ordem de entrega
1. Migração (drivers + orders + freight_programs + freight_costs + trigger + RPC).
2. Bucket `driver-photos` + tela de cadastro financeiro do motorista.
3. Aba Programação de Frete no detalhe do pedido (form completo + custos + salvamento).
4. Exportação PDF com QR code e logo.
5. Envio ao motorista + enriquecimento da tela de oferta.

Confirma para eu iniciar pela migração?
