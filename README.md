# NexusTrack Converter

Análise de Funcionalidades: NexusPay vs UTMify

NexusPay (real-comment-bot.lovable.app)

•Proposta: Analytics & Tracking focado em "Monitorizar, Decidir, Escalar".

•Funcionalidades Identificadas:

•Vendas em Tempo Real: Acompanhamento de conversões.

•Tracking CAPI: Server-side tracking para maior precisão (evita bloqueios de cookies/iOS 14+).

•Leads Qualificados: Uso de IA para identificar potenciais compradores.

•Dashboard de Analytics: Interface para visualização de métricas.

•Autenticação: Sistema de login e criação de conta.

UTMify (Referência de Mercado)

•Proposta: Rastreamento preciso de vendas para infoprodutores e e-commerce.

•Funcionalidades Chave:

•Rastreamento UTM: Identifica origem (source), mídia (medium), campanha (campaign), conteúdo (content) e termo (term).

•Identificação de Comprador: Associa o clique na UTM ao checkout e à venda final.

•Rastreamento de CTAs: Identifica em qual botão de "Comprar" ou link o usuário clicou na página de vendas.

•Integração com Checkouts: Hotmart, Kiwify, Perfect Pay, Eduzz, etc.

•CAPI (Conversions API): Envia eventos de conversão diretamente para o Facebook/Google via servidor.

•Regras de Otimização: Automação baseada em ROI/CPA.

•Fingerprint Tracking: Rastreia o usuário mesmo se ele trocar de dispositivo ou navegador (em alguns casos).

Melhorias para o Novo App (Antigravity)

•Interface Ultra-Moderna: Dashboard intuitivo com gráficos em tempo real.

•Mapa de Calor/Cliques: Visualização de onde os usuários estão clicando na página.

•Atribuição Multi-Toque: Entender toda a jornada do cliente, não apenas o último clique.

•IA Preditiva: Sugestões de escala baseadas no comportamento das campanhas.

•Configuração "One-Click": Facilitar a instalação do script de rastreio.

2- PROMPT DE CRIAÇÃO: NEXUSTRACK PRO (UTMIFY + NEXUSPAY EVOLUTION)

Ação: Crie um aplicativo Full-Stack de Analytics e Tracking de Vendas de alta performance, focado em infoprodutores e e-commerce, com as seguintes especificações:

1. CORE ENGINE (RASTREAMENTO E ATRIBUIÇÃO)

•Script de Pixel Próprio: Gere um script JS leve para ser inserido em páginas de vendas que captura automaticamente: UTMs (source, medium, campaign, content, term), IP, User-Agent, Referrer e gera um Fingerprint Único do visitante.

•Atribuição de Vendas: Sistema de Webhooks para integrar com Hotmart, Kiwify, Perfect Pay e Eduzz. O sistema deve cruzar o e-mail/telefone do comprador vindo do webhook com o Fingerprint/UTM capturado no clique inicial para atribuir a venda à campanha correta.

•Rastreamento de CTAs: Identifique automaticamente cliques em botões de checkout na página. O dashboard deve mostrar qual botão (ID ou texto) gerou mais cliques e qual converteu em venda.

2. SERVER-SIDE TRACKING (CAPI)

•Integração Meta/Google/TikTok: Envie eventos de conversão (PageView, Lead, InitiateCheckout, Purchase) diretamente via API do servidor para as plataformas de anúncios, garantindo a deduplicação de eventos (Browser + Server).

•Contorno de iOS 14+: Use o rastreamento server-side para garantir que 100% das conversões sejam marcadas, mesmo com bloqueadores de cookies.

3. DASHBOARD E INTERFACE (UI/UX)

•Estética: Design "Dark Mode" ultra-moderno, inspirado no NexusPay, com acentos em verde neon (#00FF7F) e cinza escuro (#121212).

•Métricas em Tempo Real: Cards com Vendas Aprovadas, Boletos Gerados, Pix Pendentes, ROI, CPA e Taxa de Conversão de Página.

•Gráficos de Performance: Gráficos de linha para vendas diárias e gráficos de pizza para origem de tráfego (UTM Source).

•IA de Qualificação: Um indicador visual (score de 0 a 100) para cada lead, baseado no tempo de permanência e número de cliques em CTAs.

4. ESTRUTURA DE DADOS (DATABASE)

•Users: Auth completo (Login/Signup).

•Campaigns: Configuração de Pixel ID e Tokens de API.

•Leads/Clicks: Log detalhado de cada visita com suas respectivas UTMs.

•Sales: Registro de conversões vinculadas aos leads.

5. TECNOLOGIAS RECOMENDADAS

•Frontend: React com Tailwind CSS e Lucide Icons.

•Backend: Node.js ou Python com suporte a Webhooks e processamento assíncrono.

•Database: PostgreSQL ou Supabase para persistência rápida.

Instrução Final: O app deve ser intuitivo, permitindo que o usuário configure uma nova campanha e gere seu script de rastreio em menos de 1 minuto. Comece criando a estrutura de autenticação e o dashboard principal.


Esse app deve estar em meticais e deve estar 100% conversivel, coloque uma api de cambio real pois eu quero conectar esse app a HOTmart e quero que cada venda que seja enviada em dolar para mim, o app me envia a notificacao em metical, conversa automaticamente esse valor para metical, nao so dolar, mas em qualquer outra moeda que o pagador usar, deve cambiar com cambio do dia para metical, sem erros, 

3- quero que seja pwa

4- configure envio de notificacoes de venda fora da app, vou volocar vapid keys, para isso acontecer, todas vendas, deve entrar uma notificacao

usando esse modelo: [Nome do comprador(a hotmart envia esse dado] pagou X meticais (valor ja cambiado, claro) em [nome da plataforma]


5- alem disso quero um app de trackemento, de envios de todos dados possiveis do comprador para alimentar o piel do facebok, com o amior numero de informacoes do lciente possiveis, para que o piel seja inteligente e muito bonito, top.... Quero algo top, trackeamento total, todos dados, todos dados mesmo devem er enviados, nome, email, cidade, e tudo ue for peciso, tudo falo de tudo mesmo, quero um trackeamento avancado super completo para aumento de conversoes

6- analisa tudo, tudo isso

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://nexustrack.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3f6cceb8-818e-4581-b84e-a4e872deddd2).

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
