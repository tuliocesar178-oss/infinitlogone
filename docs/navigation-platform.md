# Navegação: capacidades e validação física

O projeto é um PWA React/TanStack Start, não um aplicativo nativo. A navegação usa Mapbox GL JS e Directions driving-traffic com passos em pt-BR. Turf projeta GPS sobre a via; voz usa SpeechSynthesis, sujeita às vozes do dispositivo. Não há garantia de restrições de peso/altura/eixos nem de trânsito em toda a cobertura.

GPS só inicia por ação explícita. Destino deriva da etapa do frete; coleta permanece alvo até confirmação. A navegação grava posições e ETA nos campos existentes e nunca grava status. Confirmação e comprovantes continuam na tela operacional.

Atualização de posição é limitada a dez segundos; Directions a dois minutos ou após dois sinais de desvio além de 60 m (ou duas vezes a precisão), com intervalo mínimo de quinze segundos. Perda de internet preserva a rota em memória; reconexão ou retorno à aba tenta recalcular. Não há fila offline persistente de posições.

## Limites
- PWA não garante GPS, voz ou recálculo com tela bloqueada ou outro app ativo.
- Links universais Google Maps/Waze delegam a abertura ao sistema, com alternativa web. O navegador não identifica com segurança se o app está instalado.
- Android/iPhone físicos, bloqueio de tela, áudio e troca para apps instalados precisam de validação em campo.

## Caminho nativo (não implementado)
Para continuidade confiável, criar cliente móvel separado Android/iOS com Mapbox Navigation SDK, autenticação e contrato de telemetria existentes. Android exige serviço de localização em primeiro plano/notificação e permissões apropriadas; iOS exige modos e permissões de localização em segundo plano. Um invólucro híbrido somente atende se usar plugin nativo auditado/compatível e testes físicos. Não há SDK nativo embutido neste PWA.

## Testes físicos pendentes
- Coleta → comprovantes de carregamento → entrega sem conclusão por proximidade.
- Desvio real, GPS impreciso, perda de internet e retomada.
- Android e iPhone: voz, tela bloqueada, minimizar e aplicativos externos.
- Conferir posição/ETA na Torre e portal do cliente com contas autorizadas.