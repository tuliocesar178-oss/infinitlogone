# Roadmap

## Ícone das notificações (17/11)
- [x] Separar logo colorida e símbolo monocromático transparente para notificações
- [x] Atualizar o worker existente sem apagar inscrições nem pedir nova permissão
- [x] Cinco testes passaram; logo, símbolo e worker servidos corretamente; build sem erros
- [ ] Conferir aparência final no Android — depende de celular físico; a identificação do Chrome é controlada pelo sistema

## Categorias de fotos do motorista (02/11)
- [x] Ampliar seleção existente com seis categorias, preservando opções originais e etapas
- [x] Preservar múltiplos arquivos, autoria e visualização privada; 11 testes de categorias/upload e 11 de etapas/completude passaram; políticas de anexos e arquivos conferidas
- [x] Sessão de motorista confirmou oito opções, duas fotos simultâneas, orientação do canhoto e tela 390x844 sem rolagem horizontal; não confirmou entrega
- [ ] Validar gravação real e leitura pelo cliente — depende de frete e imagens de teste autorizados; não anexar imagens artificiais à operação real
- [ ] Validar câmera física e substituição de imagens já enviadas — câmera requer celular; motorista não tem permissão atual de alterar anexos enviados (pode substituir seleção antes de enviar)
- [ ] Publicar alterações das fotos — publicação recusada pelo usuário; aguardar nova autorização

## Integração do mapa operacional (02/11)
- [x] Compartilhar consultas, atualizações e regras entre Rotas ativas e Rastreamento
- [x] Adicionar filtros, indicadores, seleção e acompanhamento com GPS e trajetos reais
- [x] 122 testes passaram; sessão administrativa confirmou seleção, acompanhamento, filtros e mapas nas três telas sem erro; tela 654x639 sem rolagem horizontal
- [ ] Verificar deslocamento GPS em tempo real no celular — depende de motorista em operação com GPS ativo; registros disponíveis estavam desatualizados
- [x] Publicação solicitada para infinitlogone.lovable.app; conclusão do deploy não confirmada

## Separação dos valores de frete (02/11)
- [x] Corrigir criação, despacho, negociação, aceite e pagamentos com valores independentes
- [x] Proteger consultas do motorista contra exposição comercial e sinalizar valores antigos pendentes
- [x] Corrigir telas financeiras/relatórios; 112 testes passaram, consulta comercial negada e oferta real de 1800 conferida sem exposição de 3700
- [ ] Validar criação, despacho, aceite e pagamento ponta a ponta — depende de sessão administrativa autorizada e frete de teste; não aceitar ofertas expiradas nem alterar operações reais
- [x] Publicação solicitada para infinitlogone.lovable.app; conclusão do deploy ainda não confirmada

## Modo de testes temporário (28/10)
- [x] Centralizar configuração administrativa, leitura autenticada e auditoria; preservar segurança e aprovação de motoristas
- [x] Integrar cadastro operacional, veículos, obras/rascunhos, fretes, edição de endereços, coleta/entrega e descrição/respostas de ocorrências ao modo central
- [x] Identificar pendências cadastrais e rota não calculada; preservar métricas ausentes e retomada de obras sem cliente
- [x] Executar 44 testes/98 assertivas de regras; sessão real de motorista lê estado, não pode ativar nem acessar rascunhos da equipe e é redirecionada da Administração
- [ ] Ativar e testar gravações completas, edição, coleta/entrega sem anexos, desativação e auditoria administrativa — bloqueado por falta de conta administrativa indicada/autorizada; solicitada, pergunta ignorada; modo permanece desligado
- [ ] Conferir Torre, rastreamento, financeiro, relatórios e portal com registros incompletos reais; completar cobertura dos cadastros públicos — depende de ativação administrativa e sessões dos perfis; credenciais de acesso continuam obrigatórias
- [ ] Validar PostgreSQL em todos os inserts/updates liberados e corrigir eventuais bloqueios; não declarar fluxos aprovados antes da execução com sessão administrativa

## Cadastro operacional por telefone, sem SMS (28/10)
- [x] Separar cadastro e conta preservando UUIDs e relacionamentos em drivers/clients; identidade operacional não cria usuário Auth
- [x] Cadastro/consulta/edição de motorista e cliente, telefone normalizado, contatos empresariais e rejeição de duplicidades
- [x] Ativação administrativa implementada com e-mail real, senha, claim exclusivo e associação ao mesmo UUID; sem SMS nem confirmação fictícia de telefone
- [x] Restringir ofertas automáticas a aprovados, validar aprovação na gravação/aceite e push; aprovações administrativas protegidas
- [x] Validar 15 testes; criar motorista/cliente sem e-mail, reabrir edição de cliente, detectar duplicidade e selecionar cliente no novo frete; edição motorista confirmada na base e cadastro em tela pequena simulado
- [ ] Validar ativação/login completo e associação a conta já existente — falta identidade real autorizada para teste; não criar contas fictícias com e-mail inventado
- [ ] Acesso por telefone/senha sem confirmação — autenticação atual não oferece fluxo comprovado sem confirmação; cadastro funciona, acesso usa e-mail real
- [ ] Validar isolamento completo em conta operacional/cliente, uploads e Android/iPhone físicos — faltam sessões específicas e dispositivos reais

## CEP e localização de coleta/entrega (28/10)
- [x] Corrigir sobrescrita de CEP, preservar zeros e separar aviso postal da validação operacional
- [x] Abrir mapas independentes ao selecionar endereço, manter dados manuais e confirmar pontos
- [x] Conferir persistência e recálculo real: rascunho de teste PED-AF742109 reaberto/editado; rota de 1 km para 0,5 km, KM percorrido nulo, nenhuma oferta enviada
- [x] Validar 23 testes e fluxo autenticado em computador/celular simulado: CEP zero inicial, CEP inválido, mapas, confirmação, salvar e reabrir
- [ ] Testar indisponibilidade de consulta e arraste físico no celular — clique/reposição verificados; dispositivo real indisponível

## Dashboard comparativo de KM por obra (20/10)
- [x] KPIs (KM total, obras, fretes, média, obra maior, vs. período anterior) dentro do módulo de Relatórios existente
- [x] Gráfico de barras por obra (KM/fretes/média, clique filtra) e evolução por dia/semana/mês com seleção de obras
- [x] Comparação com período anterior equivalente, detalhamento expansível por obra e filtros de veículo/origem/destino
- [x] Regra de KM: efetivo medido primeiro, planejado marcado como estimado, cancelados fora dos totais; 12 testes passam
- [ ] Validar exportação Excel/PDF e impressão com volume real de fretes — depende de mais fretes concluídos com KM medido

## Central de ocorrências do motorista (20/10)
- [x] Ampliar registros existentes com categorias, estados, prioridades, histórico e notificações autorizadas
- [x] Integrar formulário mobile, anexos privados, localização opcional e rascunho offline com retentativa idempotente
- [x] Disponibilizar acompanhamento e resposta na operação, navegação e painéis existentes
- [x] Validar 32 testes de regras/notificações, leitura autenticada do histórico, categorias e rejeição de registro não autorizado
- [ ] Validar envio, anexos e resposta ponta a ponta — depende de frete ativo atribuído autorizado para teste; nenhum disponível, sem alterar operações reais
- [ ] Validar câmera, GPS e recebimento push em celular físico — depende de dispositivos reais e publicação do transporte existente

## Central de painéis KPI para TV (20/10)
- [x] Expandir painel existente com rotas/entregas, ocorrências, programação e desempenho
- [x] Definir KPIs sem duplicidade, períodos e prazos contratados separados da previsão GPS
- [x] Integrar seleção de rotas reais, motorista, cliente, obra e histórico existente
- [x] Configurar critérios de desvio, parada e ausência de GPS com histórico e ações autorizadas
- [x] Adicionar apresentação com intervalo inicial de 20 segundos, pausa, filtros persistentes e conexão real
- [x] Validar acesso autenticado, 19 regras de cálculo, interações e apresentação em Full HD/4K sem erros de execução
- [ ] Validar desvio/parada com deslocamento físico e tratamento completo de ocorrência — depende de telemetria real contínua e ocorrência autorizada para teste; não alterar operações reais durante validação

- [x] Corrigir tela desconectada do serviço de navegação; validar acesso autenticado, cálculo rodoviário real, mapa e orientação de GPS negado; deslocamento e sincronização física continuam pendentes abaixo

- [x] Notificações no celular: diagnosticar e reutilizar inscrições, PWA e eventos existentes
- [x] Permissão explícita, preferências por evento e teste restrito ao dispositivo autenticado
- [x] Implementar envio por eventos, acesso atual dos destinatários, proteção de dados e prevenção de duplicidade
- [ ] Publicar endpoint e validar eventos automáticos — aguarda solicitação de publicação; transporte aponta ao site publicado
- [ ] Validar inscrição real, envio, abertura e despacho/aceite — navegador de testes retorna permissão negada mesmo com concessão; depende de navegador/celular compatível
- [ ] Validar recebimento físico Android/iPhone, bateria e sem conexão — depende de celulares reais
- [ ] Aviso de prazo sem aceite e retentativas de transporte — dependem de mecanismo de execução adiada; nenhum agendamento permanente foi criado

- [x] Endereços completos com número/sem número, pesquisa e confirmação manual
- [x] Persistir precisão e invalidar rotas ao criar/editar endereços
- [x] Testar validação e geocodificação real em desktop/mobile: números 100 e 1000 retornam pontos distintos; 13 testes passam
- [ ] Validar gravação ponta a ponta e recálculo após edição de um frete autorizado, sem alterar fretes reais durante testes

- [x] Corrigir geometria, desenho persistente e enquadramento da rota Mapbox
- [x] Separar diagnóstico GPS/sincronização e mostrar horário somente após confirmação
- [x] Validar linha rodoviária real e restauração de estilo; testar recálculo sem duplicação e troca de destino
- [ ] Confirmar gravação GPS real e atualização na Torre/Cliente — bloqueado pela ausência de GPS físico e permissão de localização no navegador de testes

- [x] Integrar navegação interna Mapbox com instruções, progresso, recálculo e ETA
- [x] Oferecer escolha Google Maps/Waze sem alterar o estado do frete
- [x] Validar acesso real do motorista, Directions e links; testar regras de etapas e progresso e permissão GPS negada
- [ ] Validar deslocamento real, voz, troca de apps, sincronização na Torre/Cliente e tela bloqueada — depende de Android/iPhone físico e GPS real

- [x] Adaptar catálogo de pesados à referência com pisos ANTT calculados antes da seleção
- [x] Integrar configurações/carrocerias cadastradas e preservar seleção e auditoria do frete
- [x] Validar comparação, recálculo e seleção em computador e celular
- [ ] Completar eixos e capacidades dos veículos reais — depende dos dados da equipe; nenhum veículo completo cadastrado

- [x] Corrigir e validar carregamento do chat no portal do motorista

- [x] Criar rota protegida `/painel-operacao`
- [x] Adicionar acesso no menu de Administração e Logística
- [x] Exibir indicadores, fretes, atrasos e ocorrências com dados reais
- [x] Integrar mapa, filtros, detalhes e chat existentes
- [x] Adicionar atualização ao vivo, rotação e modo TV
- [x] Validar visual e funcionamento em desktop e celular
- [x] Mostrar somente clientes cadastrados na seleção de cliente responsável

- [x] Reorganizar o rastreamento do cliente com motorista, veículo e atualização ao vivo
- [x] Vincular evidências reais às etapas do frete e registrar autor, horário e localização
- [x] Exibir linha do tempo com fotos e documentos no rastreamento do cliente
- [x] Unificar rastreamento e Central de Documentos sem duplicar arquivos
- [x] Reforçar acesso às evidências apenas ao cliente proprietário, motorista atribuído e equipe
- [x] Validar atualizações ao vivo e visualização em desktop e celular
- [x] Exibir nomes reais dos integrantes da equipe no chat do motorista
- [x] Unificar chats individuais por par de usuários, preservando históricos e acesso autorizado
- [x] Manter grupo OPERAÇÃO separado e referências de fretes nas mensagens
- [x] Validar busca, mensagens não lidas e acesso entre perfis
- [x] Adicionar Mapa Logístico Premium com pré-visualização sem alterar o design ativo
- [x] Persistir escolha administrativa e permitir restaurar o design anterior
- [x] Validar rastreio público, aparência e preservação dos portais internos

## Navegação profissional (plano 19/10)
- [x] Fase 1: câmera seguindo o veículo, botão da etapa na navegação (chegada à coleta/fotos, checklist, iniciar viagem, preparar entrega, comprovantes), detalhes expansíveis
- [ ] Fase 2: documentos por categoria (NF, CT-e, MDF-e, canhoto), exigências por frete, exceções autorizadas
- [ ] Fase 3: fotos sem internet com envio posterior
- [ ] Teste em celular real (GPS, câmera, tela bloqueada)

- [x] Navegação: painel retrátil, caminhão no mapa, zoom com pausa do acompanhamento, instrução com rua
- [x] Corrigir erro de gravação do tempo estimado (número inteiro)
- [ ] Validar caminhão, rota encurtando e gravação da posição em celular real (depende de GPS físico)
