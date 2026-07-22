# Plataforma InfinitLog — Reconstrução Completa

Este é um projeto grande. Vou entregá-lo em fases incrementais, garantindo que cada uma resulte em um app funcional. Antes de começar, preciso confirmar o escopo da Fase 1.

## Visão do produto

Um único aplicativo web (responsivo, tema claro, estética Uber/Apple) com login unificado. Após autenticar, o sistema detecta o perfil (Admin, Logística, Motorista, Cliente) e renderiza o painel correspondente. Landing pública + rastreio sem login.

## Arquitetura técnica

- **Frontend**: TanStack Start (já configurado), React 19, Tailwind v4, shadcn.
- **Backend**: Lovable Cloud (Supabase) — Auth, Postgres com RLS, Realtime, Storage.
- **Mapa**: Mapbox (conector) — token público no browser, secreto no server.
- **Notificações**: Realtime do Supabase + som/vibração no cliente. Push nativo fica fora (é web app).
- **Estado**: TanStack Query + Realtime subscriptions.

## Modelo de dados (resumo)

```text
profiles(id, full_name, phone, avatar_url, created_at)
user_roles(user_id, role: admin|logistics|driver|client)
drivers(user_id, status: available|on_trip|offline, vehicle_id, current_lat, current_lng)
vehicles(id, plate, model, capacity_kg, driver_id)
clients(user_id, company_name, doc)
orders(id, code, client_id, origin, destination, status, price, km, eta, invoice_url, tracking_code, created_at)
order_events(order_id, type, payload, actor_id, created_at)  -- timeline + auditoria
freight_offers(id, order_id, driver_id, status, expires_at, accepted_at)
negotiations(id, offer_id, proposed_by, amount, note, status, created_at)
deliveries(order_id, pickup_photo_url, delivery_photo_url, signature_url, receiver_name, delivered_at)
messages(id, order_id, sender_id, kind: text|photo|video|pdf|audio, content, url, created_at)
notifications(id, user_id, type, title, body, read_at, created_at)
incidents(id, order_id, type, description, created_at)
financials -- visão computada sobre orders
```

RLS: cada perfil vê apenas o que lhe cabe (motorista → seus fretes; cliente → seus pedidos; logística → operação; admin → tudo). Papéis via tabela `user_roles` + função `has_role` (evita recursão).

## Rotas

```text
/                       Landing pública (Quem somos, Serviços, Contato, Rastrear)
/rastreio/$code         Rastreio público
/auth                   Login unificado (magic link + senha)
/_authenticated/app     Roteador de perfil (redireciona conforme role)
/_authenticated/admin/* Dashboard admin, cadastros, financeiro, mapa
/_authenticated/ops/*   Painel logística (pedidos, ofertas, chat, mapa)
/_authenticated/driver  Painel motorista (fluxo Uber-like)
/_authenticated/me      Painel cliente (encomendas, histórico, perfil)
```

## Design system

- Fundo `oklch(0.99 0 0)`, texto quase-preto, primário preto (Uber), acento âmbar sutil para CTAs de ação.
- Cards grandes, radius 20px, sombras suaves, tipografia Inter/Geist.
- Componentes: `StatusPill`, `OrderCard`, `BigActionButton`, `Timeline`, `MapCanvas`, `ChatThread`, `OfferCard` com countdown.

## Fases sugeridas

**Fase 1 — Fundação (o que proponho fazer agora)**
1. Ativar Lovable Cloud + Mapbox (peço confirmação).
2. Design system (styles.css) + shell da landing pública e rastreio (mock).
3. Auth unificado + tabela `user_roles` + roteador de perfil.
4. Schema completo com RLS.
5. Dashboards vazios (esqueleto) para os 4 perfis.

**Fase 2 — Pedidos & Motorista**
- CRUD de pedidos (admin/logística), oferta de fretes, aceite/negociação, fluxo do motorista (Uber-like), timeline automática.

**Fase 3 — Mapa & Realtime**
- Mapbox com posição do veículo em tempo real, ETA, rastreio público ao vivo.

**Fase 4 — Chat, Notificações, Documentos**
- Chat por pedido (Storage para mídias), notificações realtime com som/vibração, upload de NF, foto e assinatura digital.

**Fase 5 — Financeiro & Auditoria**
- Dashboard financeiro, exportação PDF/Excel, log de auditoria, soft delete.

## Confirmações antes de começar

1. Posso ativar **Lovable Cloud** (backend gerenciado com Auth, DB, Storage, Realtime)? É necessário para praticamente tudo.
2. Posso conectar **Mapbox** agora? (Alternativa: Google Maps gerenciado pela Lovable, mais rápido de plugar mas sem estilos Mapbox custom.)
3. Confirma seguir a divisão em **5 fases** começando pela Fase 1 (fundação + auth + schema + shells)? Se preferir, começo por outra fase (ex.: fluxo do motorista primeiro).
4. **Idioma**: interface 100% pt-BR? (assumo que sim)
5. **Push notifications nativas** ficam fora do escopo web (só possível via PWA/Web Push com service worker). Posso incluir Web Push (com permissão do browser) ou basta som+vibração+notificação in-app?

Assim que confirmar esses pontos, começo a Fase 1.
