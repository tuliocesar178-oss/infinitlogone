# Reformulação da experiência de ofertas e navegação do motorista

O escopo enviado é enorme (oferta + navegação + mapa inteligente + alertas + check-in + entrega + 12 melhorias extras). Vou dividir em fases entregáveis para não quebrar nada que já funciona. Confirme se posso seguir nesta ordem.

## Fase 1 — Nova tela de oferta (foco desta rodada)

O que muda:

- Nova rota dedicada: `/driver/ofertas/$id` (tela cheia dentro do shell do motorista).
- A lista em `/driver/ofertas` passa a mostrar cards resumidos (valor, origem→destino, distância, expira em X) que abrem a tela de detalhe.
- Tela de detalhe estilo Uber Driver:
  - **Mapa (~40% da tela)** com Mapbox: pin verde na coleta, pin vermelho na entrega, linha da rota via Mapbox Directions, zoom automático (fitBounds), distância e tempo estimado.
  - **Bloco de informações** logo abaixo: valor, origem, destino, distância, tempo, data/hora da coleta, data/hora prevista de entrega, tipo de carga, peso, valor da NF, obs. da logística, tipo de veículo, nº de paradas.
  - **Contador regressivo** ao topo ("Expira em 14:52") atualizando a cada segundo.
  - **Barra inferior fixa** (sticky) com 3 botões grandes: Recusar / Negociar / Aceitar.
- **Modal "Negociar valor"**: input de novo valor + observações + enviar. Enquanto pendente, o card mostra "Aguardando resposta da logística".
- **Aceitar**: reaproveita fluxo existente (`acceptOffer`), redireciona para `/driver` (Início) onde o frete ativo já aparece.
- **Ganho estimado**, **km vazio até a coleta** e **prioridade** exibidos como badges quando os dados existirem no `freight_program`.

Fora do escopo desta fase (fico esperando o OK para próximas):

- Fase 2 — Painel "Minhas Rotas" com mapa por card + botão "Iniciar navegação" (deep links Google Maps / Waze / Apple Maps / Mapbox).
- Fase 3 — Navegação ativa: streaming de localização, velocidade, ETA para admin/logística/cliente/torre.
- Fase 4 — Mapa inteligente: trânsito, rotas alternativas, sugestão "caminho mais rápido".
- Fase 5 — Alertas inteligentes (parado, desvio, atraso, GPS off) na Central Operacional.
- Fase 6 — Check-in automático 200m (coleta) e chegada ao destino com evidências obrigatórias (parte já existe em `ActiveOrderPanel`, vou consolidar).
- Fase 7 — Extras: histórico de ofertas, favoritar rotas, chat rápido, ligar, reportar ocorrência, compartilhar localização, modo escuro, modo direção.

## Detalhes técnicos (Fase 1)

- Componente novo: `src/routes/_authenticated/driver.ofertas.$id.tsx`.
- Mapa: reutilizar Mapbox JS já configurado no projeto (mesmo token do `fleet-map.tsx`); usar `Directions API` via gateway para desenhar a rota; fallback para linha reta + haversine se rota falhar.
- Countdown: `expires_at` já existe em `freight_offers`; hook `useCountdown` local.
- Modal de negociação: componente shadcn `Dialog`, escreve em `freight_offers` (novo `counter_offer_amount`, `counter_offer_note`, `status='negotiating'`) — o schema já suporta `negotiating`.
- Sem novas migrações se as colunas de contra-proposta existirem; senão migro `counter_offer_amount numeric` + `counter_offer_note text` + GRANTs.
- Card da lista `/driver/ofertas` passa a ser link para `/driver/ofertas/$id`; `OfferCard` existente vira variante compacta.

Confirma que sigo com a **Fase 1** agora? Assim que aprovar, implemento e a gente segue fase por fase.
