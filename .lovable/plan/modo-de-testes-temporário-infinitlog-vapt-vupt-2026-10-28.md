# Modo de testes temporário — INFINITLOG VAPT VUPT

## Resultado
Permitir salvar, reabrir e completar cadastros e fretes com dados pendentes, além de registrar etapas sem fotos ou documentos, enquanto o modo estiver ativo. Desativar o modo restaura as exigências de produção sem apagar registros ou alterar históricos.

## 1. Controle central e seguro
- Acrescentar o controle **Modo de testes temporário** à Administração, com ativação/desativação exclusiva do administrador e registro de autor e horário.
- Disponibilizar apenas o estado desse controle aos usuários autenticados. Não expor outras configurações operacionais.
- Consultar a mesma configuração nas telas, nas funções de gravação e nas regras do banco. Falha de consulta não concede flexibilização.
- Ativar o modo solicitado depois de verificar as proteções e os testes de ativação/desativação.

## 2. Cadastros e formulários
- Revisar motorista, cliente, veículo, obra, criação/edição de frete, perfil, ocorrências e configurações existentes.
- Liberar ausência de nome, telefone de contato, endereço, número, informações complementares e anexos quando forem apenas exigências de preenchimento. Preservar validações técnicas dos dados efetivamente informados.
- Aceitar contatos incompletos e dados de veículo sem placa, sem perder essas informações ao salvar o cadastro.
- Retirar bloqueios de avanço e conclusão relacionados somente à incompletude; não duplicar os formulários.
- Mostrar pendências e permitir edição posterior. Onde faltar uma relação indispensável à integridade, salvar os dados pendentes com identificação estável, sem inventar cliente, motorista, veículo ou vínculo.
- Manter as exigências de credenciais reais para criar acesso: o modo não permite entrar sem autenticação nem cria contas fictícias.

## 3. Fretes, endereços e rota
- Permitir salvar e editar fretes com CEP inválido/desconhecido, endereço incompleto, peso, produto, contatos ou configuração veicular pendentes.
- Preservar CEP como texto e não substituir silenciosamente endereço ou coordenadas.
- Sem pontos suficientes, exibir **Rota pendente** e manter distância, pedágio, duração e cálculo de preço ausentes, sem valores fabricados.
- Permitir avanço dos assistentes e registro autorizado das etapas, sem exigir anexos durante o modo.
- Manter cálculo rodoviário real quando os pontos estiverem disponíveis; completar os dados depois deve permitir recalcular a rota.
- Separar salvar informações pendentes de executar uma operação que precisa de dados reais: navegação precisa de destino, oferta financeira precisa de valor válido e pagamento precisa de destinatário e valor reais.

## 4. Coleta, entrega e ocorrências
- Revisar todos os caminhos de coleta/entrega, não apenas a tela de navegação, incluindo exigências documentais e validações de conclusão.
- Permitir ações autorizadas sem fotos, comprovantes ou descrição complementar durante o modo; registrar a pendência, o responsável e o horário.
- Nunca criar evidências fictícias nem declarar upload concluído quando falhou.
- Preservar transições existentes, ações explícitas, acesso privado, confirmação de parada segura em ocorrências e prevenção de duplicidade.

## 5. Segurança, financeiro e retorno à produção
- Não alterar autenticação, permissões, RLS, isolamento dos clientes, privacidade, aprovação administrativa ou autoria dos eventos.
- **Despacho continua somente para motoristas aprovados**, conforme sua escolha anterior; o modo não aprova cadastros.
- Permitir pendências complementares no financeiro sem inventar valores, executar pagamentos incompletos ou remover controles financeiros.
- Identificar registros incompletos também na Torre, rastreamento, portal do cliente e relatórios; não tratar rota ou métricas ausentes como dados reais.
- Ao desligar, manter consulta e edição dos registros de teste, mas voltar a exigir os dados necessários para novas ações de produção. Não reclassificar registros incompletos como válidos automaticamente.

## Detalhes técnicos
- Reutilizar `app_settings` com leitura estreita autenticada e escrita administrativa auditada; não reutilizar o acesso público da aparência da página inicial.
- Criar uma política compartilhada de validação de completude e schemas parametrizados; as funções de gravação consultam o modo independentemente do navegador.
- Ajustar RPCs e triggers apenas nas verificações de ausência de dados/anexos. Manter grants, políticas, deduplicação, validação de arquivos enviados e invariantes de segurança.
- Usar mudanças aditivas para guardar pendências quando o modelo atual exige campos ou relacionamentos; não remover colunas, vínculos ou restrições indiscriminadamente.
- Invalidar a consulta do modo após alterações e evitar estado autorizado persistido em cache local.

## Verificação e entrega
- Adicionar e executar testes com modo ligado/desligado para cada regra flexibilizada, além de rejeição de alteração por motorista/cliente e preservação da aprovação/controle financeiro.
- Exercitar cadastros incompletos, edição após reabrir, frete sem rota, CEP inválido, avanço de etapas, coleta/entrega sem comprovante e conclusão autorizada.
- Conferir Torre, rastreamento, financeiro, relatórios e portal com métricas ausentes, sem introduzir zeros artificiais.
- Validar os fluxos com sessões autorizadas e registros de teste claramente identificados, sem alterar fretes operacionais reais.
- Informar exatamente as validações alteradas, os testes executados e qualquer fluxo ainda bloqueado. Verificações que dependam de outras sessões ou de celular físico serão identificadas, não declaradas aprovadas.
- Publicação não incluída: a mudança no aplicativo publicado exige uma solicitação de publicação.