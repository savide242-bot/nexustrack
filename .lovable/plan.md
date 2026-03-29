

# Plano — 3 Correções + Teste Push

## 1. Limpar vendas de teste + filtrar no webhook
- **Apagar** todas as 10 vendas de teste existentes no banco (via SQL DELETE)
- **No webhook `hotmart-webhook`**: adicionar filtro para ignorar webhooks de teste da Hotmart — detectar via emails como `*@example.com`, `*postman*`, nomes como `Teste*`, ou campo `test: true` no payload. Retornar `{ ok: true, skipped: "test webhook" }` sem inserir

## 2. Tracking CAPI — botões responsivos
**Ficheiro:** `src/pages/Tracking.tsx` linha 113
- Mudar `<div className="flex gap-2">` para `<div className="flex flex-col sm:flex-row gap-2">` para os botões empilharem em mobile

## 3. Enviar notificação de boas-vindas para testar VAPID
- Chamar a edge function `send-push` com o `user_id` do utilizador actual, título "Bem-vindo ao NexusTrack!" e corpo "As notificações push estão activas. Receberá alertas de cada venda em tempo real."
- A subscrição push já existe na tabela (`push_subscriptions` tem 1 registo para o utilizador)
- A função `send-push` usa `web-push` com VAPID — se funcionar, confirma que o sistema está operacional

## Ficheiros a editar
1. **SQL DELETE** — remover todas as vendas de teste
2. **`supabase/functions/hotmart-webhook/index.ts`** — adicionar filtro de teste no início
3. **`src/pages/Tracking.tsx`** — botões responsivos
4. **Invocar `send-push`** — notificação de boas-vindas (via curl à edge function)

