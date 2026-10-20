# Central de Painéis KPI — INFINITLOG VAPT VUPT

## Objetivo
Ampliar o painel existente em `/painel-operacao`, mantendo a Torre de Controle e os fluxos atuais, para uma central de quatro telas preparada para TVs Full HD e 4K.

## Painéis e navegação
- **Rotas e entregas:** oito KPIs clicáveis, mapa amplo e lista de fretes. Contagem por frete único; veículos e motoristas contados por identificação única.
- **Ocorrências e alertas:** desvio confirmado, parada prolongada, falta de GPS, atraso, prazo próximo e ocorrências registradas.
- **Programação:** agenda ordenada por prazo, com hoje, amanhã, próximos sete dias e fretes sem motorista.
- **Desempenho:** entregas por dia, previstas versus realizadas, pontualidade, faixas de atraso, status e categorias/evolução de ocorrências.
- Acesso “Painéis Operacionais” para administração e equipe operacional autorizada, reutilizando as permissões existentes.
- Períodos hoje, amanhã, próximos sete dias e intervalo personalizado; filtros por cliente, obra, motorista e situação, com “Limpar filtros”.

## Rotas, detalhes e prazos
- Estender o mapa existente para apresentar simultaneamente as geometrias reais dos fretes ativos. Selecionar um frete destaca seu itinerário e reduz o destaque dos demais.
- Marcadores com posição real, horário da última leitura e indicação de GPS desatualizado; origem e destino somente com coordenadas cadastradas. Sem linhas retas simuladas.
- Reutilizar a ficha do frete e seus históricos/documentos, ampliando a informação de motorista, foto disponível, veículo, cliente, obra, endereços, itinerário e responsável.
- Separar **prazo contratado**, **data programada** e **previsão de chegada**. A previsão usa o horário da leitura que a originou, não um horário recalculado artificialmente a cada atualização da tela.
- Distinguir no prazo, prazo próximo, risco de atraso, atraso confirmado e prazo vencido sem atualização confiável. Dados insuficientes mostram “Prazo não definido” ou “Sem previsão confiável”.
- Para entregas antigas sem `completed_at`, usar o evento real de conclusão quando disponível. Sem evento, informar conclusão sem horário conhecido e excluir a entrega de gráficos diários/pontualidade que exigem esse horário.

## Alertas e histórico
- Reutilizar `incidents` e o histórico do frete, acrescentando reconhecimento, responsável, observações e encerramento auditado. Não criar um cadastro paralelo de ocorrências.
- Administração configura tolerância de desvio, tempo de confirmação, limite de precisão GPS, parada prolongada, ausência de GPS e proximidade do prazo. Parada inicial: **20 minutos**.
- Confirmar desvio e parada por uma sequência temporal de posições válidas, não por uma leitura isolada. Espera em coleta/descarga é identificada como operacional; velocidade ou precisão ausentes não confirmam parada.
- Alertas automáticos usam identidade estável por frete/categoria/episódio, evitando registros repetidos entre TVs e atualizações. Reconhecer ou encerrar não altera automaticamente o status do frete.
- A detecção acompanha o painel aberto e reconstrói episódios a partir da telemetria disponível. Monitoramento contínuo mesmo sem nenhuma tela aberta dependeria de execução periódica externa, fora desta entrega.

## Apresentação para TV
- Layout de alto contraste com identidade oficial, azul-marinho, azul elétrico, ciano e cores semafóricas; cartões discretos e tipografia grande.
- Tela cheia, relógio/data em São Paulo, seleção manual, tela anterior, pausa/retomada e alternância inicial de **20 segundos**.
- Preservar filtros padrão por usuário sem sobrescrever preferências de outras TVs. Ocorrências críticas aparecem em faixa persistente sem bloquear a alternância.
- Mostrar última atualização bem-sucedida, conexão real e aviso “Dados temporariamente desatualizados” em falhas.
- Atualizações em tempo real agrupadas, atualização periódica de segurança e limpeza das inscrições ao sair; manter dados anteriores durante novas consultas, sem piscar os cartões.

## Verificação dos dados existentes
- Existem os campos de prazo, geometria de rota, posição, ETA e conclusão, além de obras, anexos e eventos.
- Nos dois fretes atuais, somente um possui prazo final cadastrado. O frete entregue não tem `completed_at`, mas possui eventos de conclusão utilizáveis.
- `incidents` ainda não possui campos de reconhecimento ou atribuição; serão acrescentados com controle de acesso e auditoria.
- Há histórico em `order_tracking_points`, mas não em `driver_locations`; o monitoramento deve aproveitar a origem de telemetria realmente preenchida.
- Não preencher horários, ocorrências ou posições ausentes com exemplos.

## Detalhes técnicos
- Reutilizar `operation-board`, o mapa operacional e a ficha de frete; cálculos compartilhados para KPIs, cartões, alertas e gráficos.
- Carregamento inicial com TanStack Query e consulta autenticada; filtros e painel selecionado nos parâmetros da página.
- Alterações de persistência por migração no Lovable Cloud, com permissões existentes preservadas e validação de perfil nas ações protegidas.
- Acrescentar testes de regras para contagem sem duplicidade, prazo versus ETA, conclusão por evento, GPS antigo, tolerância de desvio, parada de 20 minutos e acesso às ações.

## Critérios de conclusão
- Validar os quatro painéis e interações com dados reais, incluindo seleção de veículo/motorista e retorno à visão geral.
- Testar período, filtros, gráficos, atualização, reconexão e alternância de 20 segundos.
- Conferir visual em 1920×1080, 3840×2160 e tela menor; verificar tela cheia e ausência de sobreposições.
- Validar acesso operacional e bloqueio de motorista/cliente, sem alterar fretes reais durante testes.
- Relatar separadamente o que foi testado por telemetria registrada e o que exige deslocamento físico ou uso prolongado em TV real.