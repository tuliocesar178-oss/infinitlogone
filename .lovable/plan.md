# Evidências por etapa no rastreamento

## Objetivo
Transformar o rastreamento do cliente em um histórico operacional completo, usando apenas fotos, documentos, eventos e comprovantes reais já enviados no fluxo atual do motorista.

## O que será construído
- Enriquecer cada evidência com a etapa/status do frete, autor, data/hora e localização quando disponível.
- Preservar o fluxo atual do motorista: as fotos da coleta e os comprovantes da entrega serão vinculados automaticamente ao evento correspondente durante o envio.
- Substituir a linha do tempo resumida por um acompanhamento detalhado, com etapas concluídas, em andamento e pendentes, horários reais, descrições e contadores de evidências.
- Permitir abrir fotos em galeria ampliada e visualizar/baixar documentos, inclusive PDF, sem duplicar arquivos.
- Exibir no frete ativo os totais reais de fotos e documentos.
- Organizar os comprovantes por coleta, carregamento, entrega, canhoto, nota fiscal e outros documentos.
- Usar a mesma fonte de arquivos no Rastreamento e na Central de Documentos, removendo datas simuladas.
- Atualizar a tela automaticamente quando uma evidência ou evento for registrado.

## Segurança e dados
- Fazer uma alteração aditiva no cadastro de anexos para guardar evento/status, coordenadas e metadados operacionais.
- Restringir leitura ao cliente proprietário do frete, ao motorista atribuído e à equipe autorizada.
- Manter o armazenamento privado e gerar acessos temporários aos arquivos somente após validar o vínculo do usuário com o frete.
- Remover permissões públicas amplas de leitura dos anexos e comprovantes, sem afetar o rastreio público resumido existente.
- Não expor documento do recebedor, dados pessoais do motorista ou outros campos privados no portal do cliente.

## Implementação técnica
- Criar uma migração aditiva para `order_attachments` e ajustar suas políticas de acesso.
- Centralizar a leitura autenticada de eventos e evidências em função servidora protegida.
- Atualizar o upload atual do motorista para registrar a etapa e a localização disponível.
- Criar componentes de linha do tempo, resumo, galeria e categorias de comprovantes reutilizáveis.
- Reutilizar a consulta segura na aba Documentos.

## Validação
- Confirmar que um cliente não acessa evidências de outro cliente, mesmo alterando identificadores.
- Testar coleta e entrega com múltiplas fotos, canhoto, assinatura e PDF.
- Conferir atualização automática, horários reais, estados sem evidência e arquivo indisponível.
- Validar visualmente o rastreamento e a Central de Documentos em desktop e celular.
