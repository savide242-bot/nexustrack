

# Plano de Correções — 9 Pontos

## Problemas Identificados

### 1. Configurações salvam no banco?
Sim, confirmei: Integrações, Tracking CAPI e Settings salvam no banco via `profiles.update()`. O PATCH retorna 204 (sucesso). Funciona.

### 2. Tracking envia todos eventos?
O tracking script (na aba Páginas) envia PageView e cliques CTA. O webhook Hotmart dispara Purchase via CAPI. Falta enviar Lead e InitiateCheckout automaticamente — precisa adicionar esses eventos ao script e ao webhook.

### 3. Webhooks Hotmart não marcam + notificações fora da app
**Problema principal encontrado:** As vendas existem no banco (3 registos) mas todas têm `user_id: NULL`. A RLS exige `auth.uid() = user_id`, então o utilizador não vê nada. O webhook não está a encontrar o utilizador via hottok porque o hottok do webhook de teste da Hotmart pode ser diferente do que está guardado no perfil.

**Push notifications:** A função `send-push` NÃO funciona — faz apenas um `fetch` directo ao endpoint sem encriptação VAPID (RFC 8291). Precisa usar a biblioteca `web-push` com VAPID signing para funcionar. Sem isso, o push endpoint rejeita a request. Também: não há nenhuma subscription guardada (tabela `push_subscriptions` vazia).

### 4. Login PWA não mantém sessão
O Supabase usa `localStorage` para tokens por defeito. Mas falta persistir a sessão correctamente no PWA. O `main.tsx` não tem nenhuma guarda para iframes/preview. A sessão deveria persistir naturalmente, mas o PWA precisa do manifest correcto e do SW a não interferir.

### 5. PWA bem configurado?
Faltam: ícones reais (icon-192.png, icon-512.png), VitePWA plugin, e o SW actual é básico. O manifest.json referencia ícones que não existem. Mas adicionar vite-plugin-pwa pode causar problemas no preview. Manter abordagem simples: manifest + SW manual.

### 6. Actualizações automáticas
O SW actual não tem lógica de cache/update. Precisa de adicionar `skipWaiting()` + `clients.claim()` para updates imediatos.

### 7. Menu hambúrguer em vez de sidebar trigger
O SidebarTrigger usa o ícone padrão do shadcn (PanelLeft). Trocar por `Menu` (3 traços) e garantir que em mobile abre sheet overlay, não sidebar persistente.

### 8. Bugs
- Console warnings: "Function components cannot be given refs" em Tracking e Notifications — usar `export default function` sem problemas, mas React Router pode estar a tentar dar ref.
- Sales retorna `[]` (RLS bloqueia — `user_id` é null nos registos).
- `transaction_id` tem unique constraint e testes com mesmo ID falham (duplicate key).

### 9. Segurança — VAPID exposta + RLS
- **VAPID public key hardcoded** no `Notifications.tsx` (linha 61) — está no código frontend visível para qualquer um. A VAPID public key É publica por design (browsers precisam dela para subscrever), mas podemos carregá-la de uma edge function.
- **4 políticas RLS com `WITH CHECK (true)`** em: `leads_clicks`, `cta_clicks`, `sales`, `capi_events_log` — estas são INSERT policies usadas por edge functions/webhooks (service role). O service role bypassa RLS, mas o anon role pode inserir qualquer coisa. Precisam ser restringidas.

---

## Plano de Implementação

### Migração SQL
- Actualizar `user_id` nas vendas existentes para o utilizador correcto (`866aeade-c840-46f7-ae8b-9dc8d9bc709c`)
- Remover unique constraint de `transaction_id` (ou tornar nullable/ignorar duplicados no webhook)
- Restringir INSERT policies: remover `WITH CHECK (true)` e usar `WITH CHECK (false)` nas tabelas `sales`, `capi_events_log` (só service role deve inserir). Manter `true` em `leads_clicks` e `cta_clicks` (tracking público precisa)

### Edge Function `send-push` — Reescrever com web-push real
- Usar `npm:web-push` via esm.sh para Deno
- Implementar VAPID signing correcto com as keys guardadas nos secrets
- Encriptar payload com RFC 8291 (a biblioteca web-push faz isto)

### Edge Function `hotmart-webhook` — Fix user matching
- Se hottok não encontrar user, tentar match por email do buyer com profiles
- Gerar `transaction_id` único quando vazio (evitar duplicate key)
- Usar `upsert` em vez de `insert` para duplicados

### Frontend
- **AppLayout.tsx**: Trocar SidebarTrigger por ícone Menu (3 traços hambúrguer)
- **Notifications.tsx**: Carregar VAPID public key de env ou manter (é pública por design)
- **SW.js**: Adicionar `skipWaiting()` + `clients.claim()` para auto-update
- **main.tsx**: Adicionar guarda para preview/iframe (não registar SW em dev)

### Segurança
- Restringir RLS INSERT em `sales` e `capi_events_log` para `false` (service role bypassa)
- A VAPID public key no frontend é normal — browsers precisam dela. Não é um risco de segurança
- A VAPID private key já está guardada como secret do servidor (não exposta)

### Ficheiros a editar
1. **Migração SQL** — fix user_id, transaction_id constraint, RLS INSERT policies
2. **`supabase/functions/send-push/index.ts`** — reescrever com web-push real
3. **`supabase/functions/hotmart-webhook/index.ts`** — fix user matching + upsert
4. **`src/components/AppLayout.tsx`** — menu hambúrguer
5. **`public/sw.js`** — skipWaiting + clients.claim
6. **`src/main.tsx`** — guarda preview/iframe para SW
7. **`src/pages/Notifications.tsx`** — manter VAPID public key (é seguro)

