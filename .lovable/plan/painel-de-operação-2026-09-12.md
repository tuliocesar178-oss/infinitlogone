# Painel de Operação

## Objetivo
Adicionar um mural operacional independente em `/painel-operacao`, otimizado para TV e telas grandes, usando somente dados reais já existentes. A Torre de Controle, o Dashboard e o fluxo de fretes permanecem inalterados.

## Tela e acesso
- Adicionar **Painel de Operação** ao menu de Administrador e Logística.
- Restringir a rota aos perfis operacionais autorizados: administrador, logística, supervisor e operacional.
- Criar cabeçalho próprio com marca, data, relógio, estado online e tempo desde a última atualização.
- Oferecer modo tela cheia pela Fullscreen API, com interface ampliada e sem menus laterais.

## Conteúdo operacional
- Indicadores reais: fretes de hoje, em operação, aguardando motorista, em coleta, em viagem, próximos do destino, entregues hoje e ocorrências.
- Cards grandes com frete, cliente, motorista, veículo/placa, rota, distância, progresso, ETA, previsão e ocorrência.
- Ordenação automática por prioridade: ocorrência, atraso, coleta/descarga, proximidade do destino, viagem e demais operações.
- Destaque de atraso somente quando houver previsão e dados reais suficientes para calculá-lo.
- Resumo de entregas concluídas hoje e estado vazio quando não houver operação.

## Mapa, filtros e integração
- Reutilizar o mapa e o rastreamento Mapbox existentes para mostrar apenas veículos com posição real.
- Filtros por situação, cliente, motorista, cidade, estado e data.
- Abrir os detalhes já existentes do frete, o chat atual e a Torre de Controle; não criar módulos paralelos.

## Atualização e rotação
- Atualizar automaticamente com os eventos em tempo real de fretes, veículos, posições e ocorrências, além de atualização periódica de segurança.
- Adicionar rotação opcional entre Operação ao vivo, Ocorrências, Atrasados, Mapa e Entregues hoje.
- Permitir intervalos de 10, 20, 30 ou 60 segundos, com 30 segundos como padrão.
- Não gerar posição, ETA, distância, ocorrência ou qualquer outro dado fictício quando estiver ausente.

## Validação
- Validar acesso autorizado e bloqueio para perfis não operacionais.
- Validar atualização automática, filtros, ordenação, rotação e modo tela cheia.
- Conferir visual em TV/desktop, tablet e celular, incluindo estados sem dados.
