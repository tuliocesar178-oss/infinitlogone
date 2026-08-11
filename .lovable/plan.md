# Plano de Modernização: Oferta de Frete para Motoristas (Estilo Uber/99)

Reconstruir a experiência de oferta de frete para motoristas, priorizando uma interface mobile-first, minimalista e funcional, baseada em mapas e dados reais.

## Alterações de Design e UI
- **Interface Baseada em Mapbox**: O mapa será o elemento central, ocupando o topo da tela, exibindo a rota real (não linear) entre motorista, coleta e entrega.
- **Painel de Ações Inferior (Bottom Sheet)**: Um painel elegante com cantos arredondados contendo as informações críticas e botões de ação (Aceitar/Recusar).
- **Hierarquia de Informação**: Foco em "Para onde vou?", "Quanto recebo?" e "O que transporto?".
- **Componentes Mobile-First**: Otimizados para toque, com botões grandes e leitura rápida sob luz solar.

## Funcionalidades Técnicas
- **Cálculo de Rota Real**: Integração com Mapbox Directions API para calcular quilometragem e tempo exatos.
- **Geolocalização do Motorista**: Cálculo em tempo real da distância até o ponto de coleta.
- **Notificações e Alertas**: Interface de alerta para novas ofertas com som (opcional) e visual vibrante.
- **Fluxo de Aceite/Recusa**:
  - Aceite: Transição imediata para o modo operacional e navegação.
  - Recusa: Modal de motivo da recusa para fins estatísticos da central.
- **Contador Regressivo**: Timer visual sincronizado com a validade da oferta no backend.

## Detalhes da Implementação
- **Componente `OfferRichCard`**: Será o componente principal usado nas listas e na tela de detalhes.
- **Lógica de Telemetria**: Reuso do `useBackgroundTracking` para mostrar a posição do motorista antes mesmo do aceite.
- **Integração com Navegadores Externos**: Botão "Iniciar Navegação" disparando intents para Google Maps/Waze.

## Segurança e Dados
- **Isolamento de Dados**: Garantir que o motorista veja apenas o que lhe é pertinente (excluir margens e dados bancários do cliente).
- **Consumo de Dados Reais**: Eliminação total de placeholders, usando 100% de dados do Supabase.
