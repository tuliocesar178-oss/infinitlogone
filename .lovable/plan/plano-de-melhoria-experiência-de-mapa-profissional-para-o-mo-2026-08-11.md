# Plano de Melhoria: Experiência de Mapa Profissional para o Motorista

Aprimorar a visualização de mapas e rotas na interface do motorista, tornando-a interativa, com navegação passo a passo, integração em tempo real com GPS e telemetria do Mapbox, inspirada em aplicativos de mobilidade como Uber/99.

## Fases de Implementação

### 1. Refatoração do Componente de Mapa
- **Componente Base:** Atualizar `RouteMiniMap` para suportar modo interativo total, zoom dinâmico e centralização inteligente.
- **Camadas de Rota:** Implementar o traçado real via Mapbox Directions API, diferenciando trechos percorridos de planejados.
- **Marcadores Personalizados:** Adicionar marcadores 🟢 (Coleta), 🔴 (Entrega) e 🔵 (Motorista) com popups informativos.

### 2. Painel de Navegação em Tela Cheia (`/driver/navegacao/$id`)
- **Visualização Imersiva:** Criar uma nova rota focada no mapa ocupando toda a viewport.
- **Floating Controls:** Botões flutuantes para centralizar (motorista vs. rota completa) e iniciar navegação externa.
- **Feedback Visual:** Caixa flutuante com KM e Tempo estimados em tempo real via telemetria.

### 3. Lógica de Etapas e Geofencing
- **Etapa 1 (Motorista → Coleta):** Foco na rota de aproximação.
- **Etapa 2 (Coleta → Entrega):** Troca automática de destino após confirmação de carregamento.
- **Integração GPS:** Automação do compartilhamento de localização via permissão nativa.

### 4. Integração Visual na Oferta
- **Botão "VER ROTA":** Adicionar atalho na tela de detalhes da oferta (`driver.ofertas.$id.tsx`) para abrir o mapa expandido.
- **Barra de Progresso:** Implementar indicador visual de progresso da viagem baseado na distância real percorrida.

## Detalhes Técnicos

- **Tecnologias:** Mapbox GL JS, Mapbox Directions API, Geolocation API, Framer Motion (para transições de painéis).
- **Dados:** Conversão de endereços em coordenadas (Geocoding) quando necessário.
- **Responsividade:** Layout mobile-first rigoroso com botões amplos para uso em suporte veicular.
- **Segurança:** Localização compartilhada via `order_tracking_points` vinculada ao `auth.uid()`.

---

### 📊 Relatório de Planejamento

**Padrão utilizado:** Experiência de Mapa Uber-Like

**Sub-agentes envolvidos:**
- 🎨 **UI Architect** (Layout imersivo, marcadores, painéis flutuantes)
- 🗄️ **Supabase Engineer** (Telemetria em tempo real, persistência de eventos)
- 🔌 **API Integrator** (Mapbox Directions, Geocoding, Deeplink Navegação)
- 🔍 **Code Auditor** (Performance de renderização do mapa, consumo de bateria)

**Arquivos Impactados:**
- `src/components/driver/route-mini-map.tsx` (Refatoração para interatividade)
- `src/routes/_authenticated/driver.ofertas.$id.tsx` (Integração do botão "Ver Rota")
- `src/routes/_authenticated/driver.navegacao.$id.tsx` (Nova tela de navegação full)
- `src/components/driver/panels.tsx` (Ajustes no ActiveOrderPanel)
- `src/lib/geofence.ts` (Melhorias no cálculo de ETA/KM)
