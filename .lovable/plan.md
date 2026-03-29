

# Plano de Implementação — 4 Pontos

## 1. Mapa sempre visível — países acendem com vendas
Remover a estrutura de `Tabs` na página Campanhas. O mapa fica **sempre visível** abaixo dos dados de anúncios. Todos os países aparecem em cinza escuro. Quando há vendas num país, o polígono do país muda para verde (intensidade proporcional ao volume). Subscrição realtime em `sales` para acender em tempo real.

**Mudança:** Usar `Geography` fill dinâmico baseado em `salesByCountryCode` em vez de `Marker`. O mapa do mundo fica permanente — sem tabs.

## 2. Facebook Login OAuth (Marketing API)
O utilizador quer clicar "Conectar Facebook" → popup de login do FB → autorizar → app puxa ad accounts automaticamente. Isto usa o **Facebook JavaScript SDK** (`FB.login()`) — diferente do login de autenticação.

**Fluxo:**
1. Carregar FB JS SDK dinamicamente no componente
2. `FB.login()` com permissões `ads_read, ads_management, business_management`
3. Receber short-lived token → enviar para edge function `fb-token-exchange`
4. Edge function troca por long-lived token usando App Secret (guardado como secret seguro)
5. Guardar long-lived token + listar ad accounts via `/me/adaccounts`
6. Utilizador selecciona ad account → guardar no perfil

**Requisitos do utilizador:**
- Criar Facebook App em developers.facebook.com
- Fornecer o **Facebook App ID** (público, vai no código)
- Fornecer o **Facebook App Secret** (secreto, guardado como secret do servidor via `add_secret`)

## 3. Vendas orgânicas marcam sempre
O webhook já funciona, mas vou verificar que o filtro de teste não bloqueia vendas reais. O filtro só rejeita:
- `payload.test === true`
- Emails literalmente com `@example.com`
- Nomes que começam exactamente com "teste"

Vendas orgânicas sem hottok continuam a funcionar via fallback (Strategy 2/3 que encontra o user_id pelo perfil).

## 4. Enviar notificação de teste
Invocar `send-push` com formato: "💰 Nova venda! — João Silva pagou 3.500 MT em Hotmart"

## Ficheiros a criar/editar
1. **`src/pages/Campaigns.tsx`** — mapa permanente com países que acendem + botão "Conectar Facebook" com FB SDK
2. **Nova: `supabase/functions/fb-token-exchange/index.ts`** — troca token short→long e lista ad accounts
3. **Secret: `FB_APP_SECRET`** — necessário para token exchange (vou pedir via `add_secret`)
4. **Invocar `send-push`** — notificação de teste

## Informação necessária
Antes de implementar o login Facebook, preciso que forneças:
- **Facebook App ID** — encontras em developers.facebook.com → Your App → Settings → Basic
- **Facebook App Secret** — mesmo local, campo "App Secret"

Vou pedir o App Secret via ferramenta segura. O App ID é público e pode ficar no código.

