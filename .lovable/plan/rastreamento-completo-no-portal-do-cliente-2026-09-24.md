# Rastreamento completo no Portal do Cliente

## Objetivo
Reorganizar a aba **Rastreamento** para mostrar, com dados reais e atualização ao vivo, onde está o frete, quem é o motorista responsável e qual veículo está em uso, preservando mapa, histórico e todas as opções de compartilhamento atuais.

## O que será alterado
- Manter a seleção de entregas ativas e o histórico recente, enriquecendo cada frete ativo com motorista, veículo e placa quando definidos.
- Exibir distância restante e previsão usando os campos reais do frete, sem valores simulados.
- Atualizar automaticamente a tela quando houver mudança no frete, motorista, veículo ou localização.
- Criar uma seção de motorista com foto, nome, situação operacional e categoria da CNH, sem expor CPF, RG, endereço, documentos ou dados financeiros.
- Criar uma seção de veículo com foto, marca, modelo, placa, tipo, ano, cor, capacidade, eixos e carroceria, omitindo campos vazios.
- Mostrar estados claros de “Aguardando definição” quando motorista ou veículo ainda não estiverem vinculados.
- Manter Mapbox, linha do tempo, WhatsApp, copiar link, copiar código, QR Code e envio por e-mail.
- Adaptar a organização para desktop e celular seguindo a referência enviada.

## Segurança e dados
- Consumir exclusivamente os cadastros e vínculos atuais de pedidos, motoristas, perfis e veículos.
- Selecionar somente os campos operacionais necessários para o cliente.
- Não criar dados fictícios nem duplicar cadastros.
- Usar a foto principal já cadastrada. A galeria ampliada será exibida somente se houver múltiplas fotos realmente persistidas no cadastro atual; hoje o modelo disponível possui uma foto principal por veículo.

## Validação
- Conferir carregamento, seleção de frete e estados sem motorista/veículo.
- Conferir atualização ao vivo e preservação das ações de compartilhamento.
- Validar visualmente em desktop e celular.
- Confirmar que informações privadas do motorista não aparecem nas consultas nem na tela.
