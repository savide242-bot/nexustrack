

# Plano — 4 Correções Críticas

## Diagnóstico

Analisei a base de dados e o código. Encontrei:
- **CAPI funciona**: Há 2 eventos Purchase "sent" (30/03 e 31/03). O problema é que `user_id` está `null` nos logs, então o terminal ao vivo não mostra nada (a RLS policy exige `auth.uid() = user_id`).
- **Facebook Login**: O SDK carrega e o `fb-token-exchange` funciona. O popup é bloqueado pelo browser. Precisa de configuração de domínios no Meta Developers (incluindo `3f6cceb8-818e-4581-b84e-a4e872deddd2.lovableproject.com`).
- **Vendas existentes**: 2 vendas (24 USD e 15.75 USD), ambas "approved". Ambas com `lead_id` atribuído.
- **Dashboard mostra todos os tempos**: Não há filtro de data — mostra tudo acumulado.

---

## 1. CAPI Tracking — corrigir `user_id` nos logs

**Problema:** A edge function `hotmart-webhook` chama `meta-capi` mas não envia `user_id`. A function `meta-capi` grava `user_id: null`. A RLS de SELECT exige `auth.uid() = user_id`, então o terminal ao vivo nunca mostra os eventos.

**Correção:**
- `hotmart-webhook/index.ts`: Adicionar `user_id: userId` no body enviado ao `meta-capi`
- `meta-capi/index.ts`: Já grava `user_id` do body — basta receber
- Isto corrige o terminal ao vivo e o histórico

## 2. Filtros de data — "Hoje" como padrão

Adicionar filtro de data em todas as páginas principais: Dashboard, Vendas, Campanhas.

**Opções:** Hoje (padrão), Ontem, Este Mês, Mês Passado, Personalizado (date picker)

**Implementação:**
- Criar componente `DateFilter` reutilizável com select + date picker para "personalizado"
- Aplicar filtro `.gte("created_at", from).lte("created_at", to)` nas queries de vendas, leads, etc.
- Dashboard (`Index.tsx`): filtrar vendas e leads por data
- Vendas (`Sales.tsx`): filtrar por data
- Campanhas (`Campaigns.tsx`): já tem filtro para Meta Ads; adicionar filtro para o mapa de vendas

## 3. Barra de progresso 0/100K MT

**Localização:** Canto superior direito do layout (dentro de `AppLayout.tsx` ou topo do Dashboard)

**Lógica:**
- Meta fixa: 100.000 MT
- Valor actual: soma de `amount_mzn` de vendas **do período filtrado** com status != "refunded"
- A venda conta no momento em que é inserida (quando Hotmart envia o webhook de compra, não quando é "aprovada" depois) — já funciona assim pois o webhook insere a venda imediatamente
- Barra visual com `Progress` component + texto "X / 100K MT"
- Posição: header do layout, visível em todas as páginas

**Idempotência:** O webhook já gera `transaction_id` único. Mas preciso garantir que não conta vendas duplicadas. Adicionar `UNIQUE` constraint em `transaction_id` para prevenir duplicatas.

## 4. Aba de Reembolsos

O Hotmart envia webhooks de reembolso com evento `REFUND`. O código actual já marca `status: "refunded"`.

**Implementação:**
- Na página Vendas, adicionar tabs: "Vendas" | "Reembolsos"
- Tab Reembolsos mostra vendas com `status = 'refunded'`
- Na barra de progresso, subtrair reembolsos do total

## 5. Facebook Login — instruções finais

Não há correção de código necessária — o fluxo está correcto. O problema é configuração de domínios.

**Domínios a configurar no developers.facebook.com:**

**Settings → Basic → App Domains:**
```
nexustrack.lovable.app
3f6cceb8-818e-4581-b84e-a4e872deddd2.lovableproject.com
```

**Settings → Basic → Site URL:**
```
https://nexustrack.lovable.app
```

**Facebook Login → Settings → Valid OAuth Redirect URIs:**
```
https://nexustrack.lovable.app
https://3f6cceb8-818e-4581-b84e-a4e872deddd2.lovableproject.com
```

**Settings → Advanced → Allowed Domains for the JavaScript SDK:**
```
nexustrack.lovable.app
3f6cceb8-818e-4581-b84e-a4e872deddd2.lovableproject.com
```

**App Mode:** Mudar para **Live**

**Permissões necessárias:** `ads_read`, `business_management` (precisam de aprovação se a app estiver em Live mode sem Advanced Access)

---

## Ficheiros a editar

1. **`src/components/DateFilter.tsx`** — novo componente de filtro de data reutilizável
2. **`src/components/ProgressBar.tsx`** — novo componente de barra de progresso 0/100K
3. **`src/components/AppLayout.tsx`** — adicionar barra de progresso no header
4. **`src/pages/Index.tsx`** — filtro de data + queries filtradas
5. **`src/pages/Sales.tsx`** — filtro de data + tabs Vendas/Reembolsos
6. **`src/pages/Campaigns.tsx`** — filtro de data no mapa de vendas
7. **`supabase/functions/hotmart-webhook/index.ts`** — enviar `user_id` ao chamar meta-capi
8. **Migração** — `UNIQUE` constraint em `sales.transaction_id` para prevenir duplicatas

