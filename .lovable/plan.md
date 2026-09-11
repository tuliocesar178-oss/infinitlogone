# Contraproposta da administração para o motorista

## Objetivo
Permitir que a equipe administrativa responda à proposta do motorista com um novo valor, mantendo o histórico e permitindo ao motorista aceitar, recusar ou enviar outra proposta.

## Implementação
- Adicionar no painel administrativo a ação **Enviar contraproposta**, com valor e observação.
- Ao enviar, encerrar a proposta pendente anterior como contraposta, registrar a nova rodada e manter a oferta em negociação.
- Exibir ao motorista a proposta mais recente da administração, destacando valor, observação e autoria.
- Disponibilizar ao motorista as ações **Aceitar**, **Recusar** e **Fazer nova contraproposta**.
- Atualizar o valor efetivo da oferta somente quando a contraproposta for aceita.
- Preservar todas as rodadas no histórico, com estados e origem de cada proposta.

## Segurança e consistência
- Criar uma função protegida no banco para a resposta do motorista, validando que a oferta pertence a ele e que a proposta ainda está pendente.
- Impedir respostas duplicadas e encerrar outras propostas pendentes da mesma oferta quando houver aceite.
- Manter as regras atuais de acesso: somente equipe interna e o motorista vinculado visualizam a negociação.

## Validação
- Verificar tipagem e compilação.
- Testar o fluxo administrativo e a visualização/resposta no perfil do motorista.
