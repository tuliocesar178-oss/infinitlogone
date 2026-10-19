# Navegação profissional e fluxo simplificado de coleta e entrega

Já existe: mapa Mapbox com rota real, trecho percorrido atenuado, recálculo, voz, rotas alternativas, "Abrir em outro aplicativo", checklist de coleta e envio de comprovantes no painel do frete. O trabalho reaproveita tudo isso e entrega em 3 fases, testando cada uma antes da seguinte.

## Fase 1 — Navegação + ação da etapa na mesma tela
- Câmera estilo Uber/99: veículo perto da parte de baixo da tela, mapa inclinado e girando conforme a direção (quando o GPS informar), acompanhamento suave; botões de zoom, centralizar, voz e encerrar.
- Painel inferior compacto e expansível: cliente, endereço completo (número/complemento), status, próxima ação, contato do responsável, documentos pendentes.
- Botão principal muda sozinho conforme a etapa:
  - indo à coleta → dentro do raio (padrão 300 m): aviso "Você está chegando à coleta." + **CHEGUEI À COLETA — TIRAR FOTOS** (sempre exige toque; o GPS sozinho não confirma nada);
  - na coleta → checklist curto → **CONFIRMAR COLETA E INICIAR VIAGEM** (usa a mudança de status já existente) e a rota passa automaticamente para a entrega;
  - perto do destino → "Você está chegando ao destino." + **PREPARAR ENTREGA**;
  - entrega → **ENVIAR COMPROVANTES E FINALIZAR ENTREGA**, usando o fluxo atual.
- Câmera abre direto, com alternativa de escolher arquivo; prévia, remover e repetir antes do envio; barra de progresso.

## Fase 2 — Documentos por categoria
- Cartões: canhoto, NF, CT-e, MDF-e, fotos da entrega/descarga, outros — cada um pendente/enviado/aprovado, com substituição registrada no histórico.
- Fotos da coleta por categoria (geral, volumes, estado, carregada, outros).
- Exigências configuráveis por frete (CT-e/MDF-e só quando aplicável); botão final explica exatamente o que falta; exceção só para equipe autorizada, com motivo registrado.
- Opção de "aguardando conferência da logística" antes de concluir.

## Fase 3 — Sem internet e sincronização
- Fotos tiradas sem conexão ficam guardadas no aparelho como "pendentes" e são enviadas depois, sem duplicar.
- Torre, rastreamento, portal do cliente e notificações refletem cada etapa (já ligados aos status atuais; serão conferidos).

## Limites honestos
- GPS/voz com tela bloqueada ou em segundo plano não serão prometidos sem teste em celular real; se o app instalado não sustentar isso, fica documentado o caminho do app nativo com o SDK de navegação do Mapbox.
- Nenhuma coordenada ou progresso simulado; a chegada nunca conclui coleta ou entrega sozinha.

## Detalhes técnicos
- `navigation-view.tsx`: bottom sheet expansível + `StageAction` derivada de `order.status` e `routeProgress.remaining`; raio em constante configurável.
- `navigation-map.tsx`: `easeTo` com `pitch` ~55, `bearing` = heading, `padding` superior grande para deslocar o veículo para baixo.
- Reuso dos componentes de captura/checklist de `driver/panels.tsx` (extraídos, sem mudar regras de status).
- Fase 2: migração adicionando `document_category`, `validation_status`, `replaced_by` em `order_attachments` e `required_documents jsonb` em `orders`, com RLS existente preservada.
- Fase 3: fila em IndexedDB com chave idempotente por arquivo.
