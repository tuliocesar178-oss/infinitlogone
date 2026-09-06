# Módulo de Criação, Publicação e Gestão de Fretes

Integrar o novo fluxo ao que já existe (pedidos, ofertas, rastreamento, chat, documentos, ocorrências, financeiro). Nada é recriado do zero: a tabela `orders` já possui a maior parte dos campos de origem, destino, carga, rota e valores; o que falta é completado e a experiência é reconstruída.

## Fase 1 — Criação de frete em etapas (Fretes → + Criar Frete)
Assistente em 8 passos: Cliente → Origem → Destino → Carga → Veículo → Valores → Revisão → Publicação.
- Cliente: seleção do cadastro existente com preenchimento automático (razão social, CNPJ, contato, endereço) e cadastro rápido de novo cliente sem sair da tela.
- Origem e destino: CEP, endereço completo, local, responsável, telefone, data e janela de horário, observações — com busca de endereço e confirmação no mapa (Mapbox), sempre com coordenadas reais.
- Rota calculada automaticamente pela Directions API: distância, tempo e traçado real (nunca linha reta).
- Carga: tipo, produto, peso, volumes, dimensões, NF, pedido, tipo de operação, observações e anexos vinculados ao frete.
- Veículo: tipo, carroceria, capacidade, eixos, ajudantes, rastreamento e exigências.
- Valores: KM, custo por KM, pedágios, combustível, outros custos, valor do motorista, valor do cliente e margem — calculados e editáveis. Sem API de pedágio, mostra "Pedágios não calculados" e permite lançamento manual.
- Revisão com resumo completo e três ações: Editar, Salvar rascunho, Publicar frete.

## Fase 2 — Publicação e ciclo de status
- Publicar gera código de rastreio, registra data/hora, cria a sala de chat, prepara o rastreamento e coloca o frete em **Aguardando motorista**.
- Regra central: o status só avança quando o motorista aceita. Nada de "deslocando para coleta" automático na criação.
- Oferta enviada apenas a motoristas aprovados, ativos, com documentação válida e veículo compatível.
- Aceite atômico no banco: apenas um motorista confirma; os demais recebem aviso de frete já atribuído. Recusa registra motivo e mantém o frete disponível. Oferta com prazo configurável e opção de reenviar, alterar valor ou escolher motorista manualmente.

## Fase 3 — Lista e página do frete
- Tela **Fretes** com cards/tabela: código, cliente, origem, destino, motorista, veículo, data, KM, valor, status operacional e financeiro; filtros por status e busca por código, cliente, motorista, placa, pedido e NF.
- Página do frete com abas: Resumo, Rota, Rastreamento, Chat, Documentos, Ocorrências, Financeiro e Histórico.
- Histórico/auditoria de cada mudança: usuário, ação, data/hora, status anterior e novo.

## Fase 4 — Motorista, mapa e integrações
- Tela "Novo frete disponível" mobile-first com origem, destino, KM, tempo, peso, volumes, valor, valor/KM, datas, responsáveis e mapa com rota real; botões Ver detalhes, Ver rota, Aceitar e Recusar.
- Navegação em um toque (Google Maps/Waze/Apple Maps) para coleta e depois para entrega.
- Rastreamento automático durante a operação, alertas de aproximação por distância real e mensagens automáticas no chat a cada etapa.
- Torre de Controle recebe todo frete publicado, com mapa e quadro operacional e filtros.
- Ao finalizar, o frete vai automaticamente ao Financeiro como "Aguardando análise", usando os dados bancários já cadastrados no perfil do motorista.

## Detalhes técnicos
- Reutiliza `orders`, `order_events`, `order_attachments`, `order_tracking_points`, `freight_offers`, `freight_costs`, `chat_rooms`/`messages`, `incidents`, `driver_payments`, `clients`, `vehicles` e `vehicle_types`. Novas colunas apenas para o que falta (ex.: carroceria, ajudantes, exigências, prazo da oferta, status financeiro).
- Aceite atômico via função no banco com bloqueio de concorrência.
- Segurança no banco: políticas por perfil (admin, logística, financeiro, motorista, cliente) com permissões explícitas em cada tabela nova.
- Tudo responsivo e compatível com o app instalado (PWA); dados 100% reais, sem valores fictícios.

## Entrega
Sugiro executar por fases nesta ordem, validando cada uma no preview antes de seguir.
