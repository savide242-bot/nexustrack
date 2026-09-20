---
name: Operations & Ads control
description: Aba "Controlar Anúncios" com operações por moeda, ROI/ROAS/lucro reais e controlo directo de campanhas do Facebook.
type: feature
---
- Tabela `operations` (user_id, name, currency, fb_ad_account_id, kind paid|organic, color). `campaigns`, `pages` e `sales` têm `operation_id` nullable.
- Tabela `ad_spend_manual` para gastos fora do Facebook (por operação, com moeda própria).
- Página `/ads` (`src/pages/Ads.tsx`): tabs por operação, KPIs (gasto, receita, lucro, ROAS, ROI, vendas, CPA, orçamento/dia) sempre na moeda da operação.
- Câmbio ao vivo em `src/lib/currency.ts` (open.er-api.com base USD, cache localStorage 6h, fallback embutido).
- Edge function `fb-ads-control`: acções `campaigns` (lista + insights + status + daily_budget + moeda da conta), `set_budget`, `set_status` (ACTIVE/PAUSED). Token lido do vault, rate limit 60/min, cada escrita gravada em `audit_log`.
- Orçamento pode ser escrito em qualquer moeda e é convertido ao câmbio do dia para a moeda da conta de anúncios antes de ir ao Facebook.
- `hotmart-webhook` resolve `operation_id` (via campanha ou página do lead) e envia a notificação de venda na moeda da operação.
- Associação de página a operação feita em `/pages` através de um selector por página.
