# Integrar sugestão ANTT à etapa Valores

## Objetivo
Conectar a calculadora ANTT já existente à etapa **Valores** do cadastro de frete, sem alterar coeficientes, fórmula, distância Mapbox ou demais módulos.

## Alterações
- Manter o recálculo automático atual com a distância rodoviária do Mapbox e os parâmetros ANTT já preenchidos no formulário.
- Destacar no card: piso mínimo ANTT, pedágios, outros custos, margem e valor sugerido.
- Adicionar **Usar valor sugerido**, copiando o total para **Valor negociado com cliente**, que continuará editável.
- Exibir comparação clara quando o valor informado estiver abaixo do piso, incluindo piso, valor informado e diferença.
- Completar o resumo final do cadastro com piso ANTT, pedágios, valor sugerido, valor negociado e situação.
- Preservar o registro auditável já existente no frete: tabela/resolução, coeficientes, distância, piso, sugestão, margem e data do cálculo.

## Detalhes técnicos
- Reutilizar exclusivamente `calculateANTTMinimumFreight` e `AnttCard`.
- Não criar cálculo, tabela de coeficientes ou consulta de pedágio paralela.
- Alterar somente a apresentação e a ligação do resultado ao campo de valor no fluxo de criação.

## Validação
- Conferir recálculo ao mudar distância, carga, contratação, eixos e desempenho.
- Conferir que o botão preenche o valor sem bloquear edição posterior.
- Conferir os estados sem dados, calculando, abaixo do piso e dentro do piso.
- Validar a tela em desktop e celular.
