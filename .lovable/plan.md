# Exibir integrantes da equipe no chat do motorista

## Objetivo
Substituir o código `PED-...` usado como nome da conversa pelos nomes reais dos integrantes da equipe que participaram daquele chat.

## Implementação
- Carregar, para cada sala do motorista, os remetentes da equipe e seus nomes cadastrados.
- Usar os nomes da equipe no título da lista e no cabeçalho da conversa.
- Manter o frete apenas como contexto secundário, sem usar `PED-...` como identidade da conversa.
- Preservar a conversa geral como “Equipe de Operação” enquanto ainda não houver mensagem de um integrante identificado.
- Corrigir o tipo atual da conversa e manter busca, atualização ao vivo e navegação móvel funcionando.

## Validação
- Verificar a compilação e os erros do aplicativo.
- Abrir o portal do motorista autenticado e confirmar os nomes na lista e no cabeçalho, em desktop e celular.
