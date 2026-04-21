---
name: Campaign attribution
description: Campaigns table cross-references Meta Ads campaign_name with sales utm_campaign to compute real ROAS/CPA per campaign.
type: feature
---
- Match feito por `campaign_name.toLowerCase().trim() === leads_clicks.utm_campaign` (mesma normalização).
- Modal `CampaignDetailModal` mostra lado-a-lado: ROAS reportado pelo Meta vs ROAS real (receita MZN ÷ gasto convertido a MZN com fator aproximado 12 BRL→MZN).
- Tabela ordenável por ROAS, gasto, vendas ou CTR e cada linha abre o modal ao clicar.
