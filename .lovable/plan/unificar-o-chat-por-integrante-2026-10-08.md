# Unificar o chat por integrante

## Resultado
- Reorganizar o chat existente em uma conversa individual por par de pessoas, independentemente do frete.
- Mostrar nome e foto do outro participante na lista e no cabeçalho.
- Manter o grupo **OPERAÇÃO** separado, exclusivo da equipe autorizada.
- Preservar mensagens, arquivos, autores, horários, referências dos fretes e notificações, sem duplicação.

## Históricos antigos
- Consolidar apenas conversas cujos dois participantes estejam identificados com segurança.
- Para históricos com três participantes ou destinatários indefinidos, a proposta é mantê-los acessíveis em **Fretes e operações**, sem copiá-los para chats individuais. Essa é a decisão pendente apresentada anteriormente.
- Não excluir salas nem mensagens antigas.

## Experiência
- Organizar a lista em **Conversas individuais**, **Grupos** e **Fretes e operações**.
- Buscar pessoas, conteúdo de mensagens e códigos de frete nos históricos autorizados.
- Mostrar o código do frete como referência discreta na mensagem, com acesso ao frete correspondente.
- Atualizar os acessos rápidos ao chat para abrir a mesma conversa individual, preservando o contexto do frete.
- Manter os controles e recursos existentes, sem alterar criação, oferta, aceite ou conclusão de fretes.

## Detalhes técnicos
- Usar IDs normalizados dos dois participantes e uma restrição única no chat existente.
- Consolidar históricos de modo idempotente, preservando os IDs e vínculos originais.
- Validar acesso por participante no banco, inclusive nos históricos consolidados; não permitir acesso amplo da equipe a conversas individuais de terceiros.
- Garantir que motoristas não acessem o grupo e clientes não acessem conversas internas.
- Conferir contadores de leitura e atualização ao vivo durante a consolidação.

## Validação
- Comparar contagens e IDs de mensagens e anexos antes e depois da mudança.
- Testar que abrir a conversa pelos dois participantes produz o mesmo histórico.
- Testar busca, contexto de frete, mensagens não lidas e acesso negado para terceiros.
- Conferir o fluxo autenticado de motorista e equipe, com visualização em computador e celular.

## Situação atual
A unificação ainda não foi aplicada. A estrutura e os históricos existentes foram analisados; a implementação depende da aprovação desta abordagem para os históricos compartilhados.