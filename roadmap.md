# Roadmap

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
