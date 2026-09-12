# Acelerar a inicialização da InfinitLog

## Objetivo
Reduzir o tempo percebido até a primeira tela e evitar consultas repetidas ao entrar no perfil correto.

## Alterações
- Remover a espera visual fixa de 600 ms no navegador e manter uma transição curta somente quando realmente necessária no app instalado.
- Trocar a imagem de abertura de aproximadamente 976 KB pela versão otimizada já disponível no projeto.
- Adiar a sincronização de notificações e a solicitação inicial de permissões até a tela estar utilizável.
- Simplificar a entrada em `/app`, reutilizando a sessão e os papéis já carregados, sem repetir validações de usuário.
- Preservar a validação de aprovação dos motoristas antes de encaminhá-los ao painel.
- Validar a página inicial e a entrada autenticada, verificando erros e tempo até a interface aparecer.

## Detalhes técnicos
- Banco e conexões estão saudáveis; as consultas mais lentas observadas ficam abaixo de 63 ms, portanto não há indicação para aumentar a instância.
- O foco será no caminho crítico do navegador e na remoção de chamadas sequenciais redundantes.
