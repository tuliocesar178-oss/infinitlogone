# Preparar e gerar o APK Android de desenvolvimento

## Auditoria da estrutura existente

A aplicação usa TanStack Start com React e Vite. O servidor é construído com Nitro e atende páginas renderizadas no servidor e funções de servidor. Por isso, o build web atual não deve ser tratado como uma SPA estática para embutir no APK: o aplicativo Android precisa acessar uma implantação HTTPS da InfinitLog para manter SSR, autenticação, chamadas ao servidor e integrações existentes.

O cliente Supabase usa a sessão autenticada do navegador e as funções de servidor validam o token recebido. O APK não deve receber chaves administrativas nem substituir o Supabase por outro backend.

O rastreamento existente em `use-background-tracking.ts` usa `navigator.geolocation.watchPosition`. Ele começa quando há um frete ativo nos status definidos pelo sistema, valida as leituras e grava posições no Supabase pelo cliente web. A transmissão ocorre em intervalos variáveis: durante movimento, em torno de 3 segundos ou após deslocamento suficiente; parado, em torno de 15 segundos. A verificação de ausência de sinal roda a cada 10 segundos. Isso não é um serviço nativo e não garante rastreamento com o aplicativo suspenso ou a tela bloqueada. Não há fila local de posições para sincronização offline nesse fluxo.

Não foi encontrada configuração Capacitor, estrutura Android ou declaração de permissões Android nos arquivos auditados. O monitoramento operacional também usa um fluxo próprio; a integração da tela de diagnóstico e a distribuição das atualizações ao portal do cliente precisam ser verificadas junto aos respectivos módulos antes de alterar o rastreamento.

## Dependências e endereço do aplicativo

As dependências do Capacitor foram adicionadas ao `package.json`. Instale-as usando o gerenciador do projeto:
