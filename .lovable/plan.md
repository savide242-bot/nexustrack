

# Plano — Backend Robusto + Precisão Total

## Problemas identificados na BD

- Existem vendas duplicadas: a Hotmart envia vários webhooks para a mesma transação (ex: PURCHASE_COMPLETE, depois PURCHASE_APPROVED) e o sistema cria uma nova venda para cada webhook
- Não existe constraint UNIQUE no `transaction_id` — webhooks repetidos geram vendas duplicadas
- Vendas com `amount=0` estão como "approved" em vez de "cancelled" (o comprador preencheu dados mas não pagou)
- As vendas "cancelled" e "refunded" estão a ir todas para a aba "Reembolsos" sem distinção
- O CTA mostra "unknown" porque `button_id` e `button_text` estão vazios para alguns botões
- O lead attribution no webhook busca leads de TODOS os utilizadores, sem filtrar por `user_id`

## 1. Idempotência: UNIQUE constraint + UPSERT no webhook

**Migração SQL:**
- `ALTER TABLE sales ADD CONSTRAINT sales_transaction_id_unique UNIQUE (transaction_id);`

**`supabase/functions/hotmart-webhook/index.ts`:**
- Antes de inserir, verificar se já existe venda com o mesmo `transaction_id`
- Se existir: atualizar apenas o `status` (ex: de "approved" para "refunded" ou "cancelled")
- Se não existir: inserir como novo
- Vendas com `original_amount <= 0` devem ter status `"cancelled"`, nunca `"approved"`
- Só enviar notificação push e CAPI se for INSERT novo com status approved (não em updates)

## 2. Isolamento multi-tenant no webhook

**`supabase/functions/hotmart-webhook/index.ts`:**
- Remover Strategy 2 (fallback para "único utilizador com hotmart_token") e Strategy 3 (fallback para qualquer utilizador)
- Manter APENAS Strategy 1: match exato via `hottok` → `profiles.hotmart_token`
- Se `hottok` não bater com nenhum perfil, retornar `{ ok: true, skipped: "no matching user" }` em vez de atribuir a qualquer utilizador
- Lead attribution: filtrar leads apenas do `user_id` encontrado (não de todos os utilizadores)

## 3. Distinção cancelled vs refunded

**`supabase/functions/hotmart-webhook/index.ts`:**
- Hotmart envia eventos como `PURCHASE_CANCELED`, `PURCHASE_REFUNDED`, `PURCHASE_COMPLETE`, `PURCHASE_APPROVED`, `PURCHASE_PROTEST`, `PURCHASE_CHARGEBACK`
- Mapear correctamente:
  - `REFUND` / `CHARGEBACK` → `"refunded"`
  - `CANCEL` / `PROTEST` → `"cancelled"`
  - `COMPLETE` / `APPROVED` → `"approved"` (apenas se amount > 0)
  - Amount = 0 → sempre `"cancelled"`

**`src/pages/Sales.tsx`:**
- Criar 3 abas: Vendas | Canceladas | Reembolsos
- Vendas: `status === "approved" && amount_mzn > 0`
- Canceladas: `status === "cancelled"` ou `amount_mzn <= 0`
- Reembolsos: `status === "refunded"`

## 4. CTA "unknown" → fallback inteligente

**`src/pages/Pages.tsx`:**
- Na linha 84, quando `button_text` está vazio, usar o tagName do elemento (ex: "Link", "Botão") ou o `href` truncado em vez de "unknown"

**Tracking script (`getScript`):**
- Melhorar captura do `button_text`: usar `el.innerText || el.textContent || el.title || el.getAttribute("aria-label") || el.tagName`

## 5. Estado do Pixel

Baseado nos dados do CAPI: o pixel está a receber eventos com sucesso (4 "sent", 2 "error"). Os 2 erros são porque o campo `currency` está em falta no `custom_data` quando `original_amount = 0`. Já está corrigido — as vendas com amount=0 passarão a ser "cancelled" e não enviarão CAPI.

## 6. Stories detection

O Instagram Stories não envia referrer identificável diferente do bio link — ambos usam `l.instagram.com`. A única forma fiável é o utilizador adicionar UTMs nos links dos stories (ex: `?utm_content=story`). O sistema já classifica `utm_content=story` como "Instagram — Story". Sem UTM, é impossível tecnicamente distinguir.

No entanto, no script de tracking actual, a detecção automática de `instagram.com` no referrer já existe (linha 152 do Pages.tsx). Vou melhorar para que quando detecte Instagram sem UTM, classifique como "Instagram" genérico em vez de "Direto".

## Ficheiros a editar

1. **Migração SQL** — UNIQUE constraint em `transaction_id`
2. **`supabase/functions/hotmart-webhook/index.ts`** — idempotência, isolamento multi-tenant, status correcto, amount=0 → cancelled
3. **`src/pages/Sales.tsx`** — 3 abas (Vendas, Canceladas, Reembolsos)
4. **`src/pages/Pages.tsx`** — CTA text fallback no script + no display
5. **`supabase/functions/track/index.ts`** — minor: garantir Instagram sem UTM = "Instagram"

