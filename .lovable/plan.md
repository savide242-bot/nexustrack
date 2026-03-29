

# NexusTrack Pro — Plano Completo Refatorado

## Resumo das 9 entregas

### 1. Corrigir Dashboard — remover dados falsos
- Remover `+12% esta semana` hardcoded do MetricCard de Vendas
- Mostrar apenas dados reais do banco

### 2. Nova aba "Páginas"
- **Nova tabela `pages`**: `id`, `user_id`, `campaign_id`, `url`, `name`, `created_at`
- Nova página onde o utilizador adiciona a URL da página de vendas e recebe um script de tracking
- O script captura: visitantes, cliques em CTAs (com ID e texto do botão), UTMs, fingerprint
- Métricas exibidas: total visitantes, total cliques CTA, quais CTAs mais clicados, taxa de conversão por CTA
- Rota `/pages` + link na sidebar

### 3. Vendas — país de origem + vendas por fonte
- Adicionar colunas **País** e **Fonte (utm_source)** na tabela de vendas
- Cruzamento: `sales.lead_id → leads_clicks.country / utm_source`
- Precisão 100%: dados vêm do lead associado via modelo híbrido de atribuição

### 4. Aba Campanhas — Facebook Ads + Mapa Mundial
- **Facebook Ads via token manual**: o utilizador cola o **Access Token de longa duração** + **Ad Account ID** (já configurado no Meta Developers)
- Dados salvos na tabela `campaigns` (colunas `fb_access_token`, `fb_ad_account_id`)
- **Edge Function `facebook-ads`**: proxy server-side que busca campanhas, ad sets, ads, gastos, impressões, cliques, CPA, ROAS via Marketing API do Facebook
- UI com tabela de métricas Facebook Ads (gasto, lucro, ROI, ROAS, CPA)
- **Mapa mundial interativo** com `react-simple-maps`:
  - Pontos amarelos nos países com vendas
  - Zoom para ver cidades específicas
  - Dados de `sales` cruzados com `leads_clicks.country/city`

### 5. Nova aba "Tracking" (CAPI Avançado)
- Página dedicada ao rastreamento avançado Meta CAPI
- Campos: Pixel ID + Access Token (salvos por campanha)
- **Edge Function `meta-capi`** envia eventos com TODOS os dados reais do comprador:
  - Email, nome completo, telefone, país, cidade, estado, CEP, IP, user-agent, FBC, FBP
  - **Valor na moeda original** (USD/BRL/EUR) — NÃO em MZN — para o Meta receber dados reais
  - Deduplicação via `event_id`
  - Eventos: PageView, Lead, InitiateCheckout, Purchase
- **Nova tabela `capi_events_log`**: id, campaign_id, event_name, event_id, payload (jsonb), status, response, created_at
- Histórico de todos os eventos CAPI enviados visível na página
- Rota `/tracking` + link na sidebar

### 6. Integrações — salvar no banco + múltiplas plataformas
- Refazer a página para carregar dados existentes ao montar e salvar com `supabase.update()`
- Suportar: **Hotmart, Kiwify, Perfect Pay, Eduzz** (campo platform na UI, espaço para mais)
- Mostrar URL do webhook com botão copiar:
  `https://qjfnosljbyqzyrfhiybi.supabase.co/functions/v1/hotmart-webhook`
- Remover VAPID da UI (será gerido como secret do servidor)

### 7. Push Notifications — OBRIGATÓRIO FUNCIONAR
- **Guardar VAPID keys como secrets do servidor** via `add_secret`:
  - `VAPID_PUBLIC_KEY`: `BAOhQu5GzLaWqPRGOnnJtxaooJsf5IX6IzZ2bfnyCehzXHebgQ-0jLhVZuU-hIjrteYi7R1E-eELWSht3dlk_Y0`
  - `VAPID_PRIVATE_KEY`: `yDMbbUzqpcvN_KsRSQ0BbhM7wRcLWwt7SMNOQIUIUbM`
- **Service Worker `public/sw.js`** para receber push events (funciona fora do app, com app fechado)
- **Botão "Ativar Notificações"** na página de Notificações que pede permissão ao browser e salva subscription em `push_subscriptions`
- **Edge Function `send-push`** que usa web-push com as VAPID keys para enviar notificações
- Formato: **"[Nome] pagou X MZN em [Plataforma]"**
- Chamada automática pelo webhook da Hotmart após cada venda aprovada
- Deve funcionar fora do app, em background, sem falhas

### 8. Edge Functions (6 funções)
- **`track`**: Recebe dados do pixel script → insere em `leads_clicks` → retorna `lead_id`
- **`track-cta`**: Recebe cliques em CTAs → insere em `cta_clicks`
- **`hotmart-webhook`**: Recebe webhooks Hotmart → converte moeda via ExchangeRate API → atribuição híbrida (email 40pts + telefone 30pts + fingerprint 20pts + UTM 10pts) → insere em `sales` → dispara `meta-capi` + `send-push`
- **`meta-capi`**: Envia eventos para Conversions API do Facebook com dados reais
- **`facebook-ads`**: Proxy para buscar métricas de campanhas do Facebook Ads
- **`send-push`**: Envia push notification via VAPID/web-push para todas subscriptions do utilizador

### 9. Migração de banco de dados
- Nova tabela `pages` (id, user_id, campaign_id, url, name, created_at) com RLS
- Nova tabela `capi_events_log` (id, campaign_id, event_name, event_id, payload, status, response, created_at) com RLS
- Adicionar colunas em `campaigns`: `fb_access_token`, `fb_ad_account_id`
- Habilitar realtime em `sales` e `notifications_log`

---

## Detalhes Técnicos

### Dependências novas
- `react-simple-maps` — mapa mundial interativo SVG

### Modelo de atribuição híbrido (no webhook)
Ao receber venda, buscar leads dos últimos 7 dias e pontuar:
- Email match: +40 pontos
- Telefone match: +30 pontos
- Fingerprint match: +20 pontos
- UTM match: +10 pontos
- Lead com maior score é associado à venda

### Novas rotas
- `/pages` — Páginas de vendas + script + métricas CTA
- `/tracking` — CAPI avançado + histórico de eventos

### Sidebar atualizada
Adicionar: Páginas, Tracking (entre as existentes)

