# SwiftFlow Logistics

Quero reconstruir completamente a plataforma da InfinitLog Transportes.

O objetivo é criar um sistema moderno, minimalista e extremamente intuitivo, inspirado na experiência do Uber, Uber Freight, Mercado Livre Envios e Amazon Logistics.

Não quero um sistema cheio de menus e telas complexas.

Quero um único aplicativo onde o conteúdo muda automaticamente conforme o perfil do usuário.

Toda a interface deve ser limpa, rápida, elegante e fácil de usar.

## PERFIS

O sistema deverá possuir apenas quatro perfis:

• Administrador

• Equipe de Logística

• Motorista

• Cliente

Todos utilizarão o mesmo aplicativo e a mesma tela de login.

Após o login, o sistema identificará automaticamente o perfil do usuário e exibirá apenas as funcionalidades permitidas.

Cada perfil deverá visualizar somente as informações necessárias para seu trabalho.

Não criar sistemas separados.

Criar apenas um único aplicativo inteligente.

--------------------------------------------------

## DESIGN

Inspirado em:

Uber

Uber Freight

Apple

Mercado Livre

Amazon

Google Maps

Utilizar:

• Interface minimalista

• Muitos espaços em branco

• Poucas cores

• Ícones modernos

• Cartões grandes

• Bordas arredondadas

• Sombras suaves

• Animações discretas

• Layout totalmente responsivo

• Tema claro

A experiência deverá ser extremamente simples.

O usuário nunca deverá ficar procurando onde clicar.

Sempre mostrar a próxima ação em destaque.

--------------------------------------------------

## DASHBOARD

Após login mostrar um Dashboard diferente para cada perfil.

Administrador:

Visualizar toda operação.

Equipe Logística:

Visualizar somente operação logística.

Motorista:

Visualizar apenas seus fretes.

Cliente:

Visualizar apenas suas encomendas.

--------------------------------------------------

## ADMINISTRADOR

O administrador terá acesso completo.

Dashboard contendo:

Pedidos

Motoristas online

Motoristas em viagem

Entregas

Financeiro

Ocorrências

Mapa em tempo real

Últimas atividades

Gráficos

Cadastrar:

Equipe

Motoristas

Clientes

Veículos

Pedidos

Visualizar toda operação em tempo real.

--------------------------------------------------

## EQUIPE DE LOGÍSTICA

A equipe será responsável pela operação.

Ela poderá:

Cadastrar pedidos.

Editar pedidos.

Cancelar pedidos.

Alterar status.

Visualizar mapa.

Conversar com motoristas.

Acompanhar entregas.

Anexar documentos.

Enviar ofertas de fretes.

Visualizar negociações.

Trocar motorista.

Criar ocorrências.

--------------------------------------------------

## MOTORISTA

O painel do motorista deverá ser semelhante ao Uber Driver.

Ao abrir o aplicativo mostrar apenas:

Olá, Nome do Motorista.

Status:

Disponível

Em viagem

Offline

Logo abaixo mostrar:

Nova Solicitação

Caso exista uma oferta.

Mostrar:

Origem

Destino

Mapa

Valor

KM

Tempo estimado

Horário

Cliente

Botões:

ACEITAR

NEGOCIAR

RECUSAR

Ao aceitar:

Mostrar apenas um grande botão:

INICIAR DESLOCAMENTO

Depois:

INICIAR NAVEGAÇÃO

Depois:

INICIAR COLETA

Depois:

ENVIAR FOTO DA CARGA

Após enviar:

Atualizar automaticamente:

SAIU PARA ENTREGA

Mostrar:

INICIAR ENTREGA

Ao chegar:

Mostrar:

ENVIAR FOTO DA ENTREGA

Enviar Nota Fiscal.

Assinatura Digital.

Finalizar.

Todo o fluxo deverá ser automático.

O motorista nunca escolherá manualmente o status.

O sistema deverá atualizar automaticamente.

--------------------------------------------------

## OFERTA DE FRETES

Quando existir um novo frete:

Enviar Push Notification.

Mostrar notificação dentro do aplicativo.

Emitir som.

Emitir vibração.

Mostrar contador regressivo.

Caso o tempo termine:

Enviar automaticamente para outro motorista.

O primeiro motorista continuará podendo aceitar enquanto o frete não for aceito por outro.

Caso outro motorista aceite:

Cancelar automaticamente todas as demais ofertas.

Mostrar para logística quem aceitou.

Registrar data.

Hora.

GPS.

Tempo até aceitar.

--------------------------------------------------

## NEGOCIAÇÃO

O motorista poderá negociar.

Mostrar:

Valor ofertado.

Minha proposta.

Observação.

A logística poderá:

Aceitar.

Enviar contraproposta.

Recusar.

Registrar histórico completo.

--------------------------------------------------

## MAPA

Utilizar Mapbox.

Mostrar:

Origem.

Destino.

Veículo.

Motorista.

Trajeto.

ETA.

Tempo restante.

Distância restante.

Atualizar automaticamente.

--------------------------------------------------

## CLIENTE

Criar uma Landing Page pública para clientes.

Mostrar:

Quem Somos.

Serviços.

Contato.

Rastrear Pedido.

Criar uma grande barra de pesquisa.

Permitir rastrear utilizando:

Código de rastreio.

Número do pedido.

Nota Fiscal.

Ao localizar:

Mostrar:

Mapa em tempo real.

Status atual.

Motorista.

Cidade de origem.

Cidade de destino.

Previsão de entrega.

Timeline completa.

Exemplo:

Pedido criado

↓

Em preparação

↓

Motorista confirmado

↓

Em deslocamento

↓

Carga coletada

↓

Saiu para entrega

↓

Próximo ao destino

↓

Entregue

Após finalizar:

Mostrar:

Foto da entrega.

Comprovante.

Assinatura.

Nome do recebedor.

Data.

Hora.

Caso o cliente possua login:

Mostrar:

Minhas encomendas.

Histórico.

Notificações.

Perfil.

--------------------------------------------------

## CHAT

Cada pedido possuirá um chat próprio.

Administrador.

Equipe.

Motorista.

Todas as mensagens deverão ficar vinculadas ao pedido.

Permitir:

Texto.

Fotos.

Vídeos.

PDF.

Áudios.

--------------------------------------------------

## NOTIFICAÇÕES

Enviar em tempo real:

Novo frete.

Oferta aceita.

Negociação.

Pedido atualizado.

Entrega iniciada.

Entrega concluída.

Ocorrências.

Mudança de rota.

--------------------------------------------------

## FINANCEIRO

Somente administrador.

Dashboard contendo:

Receita.

Despesas.

Pedidos faturados.

Lucro.

Gráficos.

Exportação PDF e Excel.

--------------------------------------------------

## SEGURANÇA

Utilizar Supabase Auth.

Row Level Security.

Permissões por perfil.

Proteção de rotas.

Soft Delete.

Auditoria completa.

--------------------------------------------------

## OBJETIVO FINAL

Construir uma plataforma única, moderna, minimalista e extremamente intuitiva, onde Administrador, Equipe de Logística, Motorista e Cliente utilizem o mesmo aplicativo, cada um com seu painel específico.

Toda a experiência deve ser centrada no pedido, com atualizações em tempo real, automação dos status, rastreamento ao vivo, chat integrado, notificações instantâneas e interface inspirada no Uber, priorizando simplicidade, velocidade, organização e excelente experiência do usuário.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://infinitlogone.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1c96beba-de41-4da8-bc59-dbb279969413).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
