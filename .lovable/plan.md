

# Correções — 4 Problemas

## 1. Tracking CAPI — Remover selector de campanha
**Ficheiro:** `src/pages/Tracking.tsx`
- Remover o `<Select>` de campanha
- Salvar Pixel ID e Access Token na tabela `profiles` (novos campos `meta_pixel_id`, `meta_access_token`)
- Carregar valores do perfil ao montar, salvar com `supabase.from("profiles").update()`
- Histórico CAPI mostra todos os eventos do utilizador (sem filtro de campanha — query via join com campaigns do user)
- Evento teste usa os dados do perfil directamente

**Migração:** Adicionar `meta_pixel_id text` e `meta_access_token text` à tabela `profiles`

## 2. Páginas — Remover campo campanha
**Ficheiro:** `src/pages/Pages.tsx`
- Remover o `<Select>` de campanha do formulário de criação
- Inserir página sem `campaign_id` (já é nullable)
- O script de tracking usa `page.id` como identificador em vez de `campaign_id`
- Métricas buscam por `page_url` match em vez de `campaign_id`

**Ficheiro:** `supabase/functions/track/index.ts`
- Aceitar `page_id` como alternativa a `campaign_id`
- Tornar `campaign_id` opcional na inserção em `leads_clicks`

**Migração:** Tornar `campaign_id` nullable em `leads_clicks` (ALTER COLUMN DROP NOT NULL) e em `cta_clicks`

## 3. Vendas/Webhook — Corrigir RLS para vendas sem campanha
O problema: vendas inseridas pelo webhook sem `campaign_id` não aparecem porque a RLS de `sales` faz JOIN com `campaigns`.

**Migração:** 
- DROP a política `Users can view own sales` existente
- Criar nova política que permite ver vendas se:
  - `campaign_id` IS NOT NULL e o user é dono da campanha, OU
  - `campaign_id` IS NULL e `buyer_email` match com o email do utilizador autenticado

**Webhook fix:** O `hotmart-webhook` também precisa associar um `user_id` às vendas para a RLS funcionar sem campanha.
- Adicionar coluna `user_id uuid` à tabela `sales` (nullable)
- O webhook tenta encontrar o user_id via `campaigns.user_id` ou via `profiles` match por email
- Nova RLS: `auth.uid() = user_id OR EXISTS(campaign join)`

## 4. Integrações — Remover dependência de campanha
**Ficheiro:** `src/pages/Integrations.tsx`
- Remover o selector de campanha
- Salvar o `hotmart_token` na tabela `profiles` (novo campo)
- A página carrega e salva directamente do perfil do utilizador
- Manter as tabs de plataformas (Hotmart, Kiwify, Perfect Pay, Eduzz)
- Manter webhook URL com botão copiar
- Meta/Google/TikTok tokens continuam salvos por campanha na aba Campanhas

**Migração:** Adicionar `hotmart_token text` à tabela `profiles`

**Webhook fix:** `hotmart-webhook` deve buscar o `hotmart_token` nos perfis também (não só nas campanhas)

## Resumo das migrações SQL
```text
ALTER TABLE profiles ADD COLUMN meta_pixel_id text;
ALTER TABLE profiles ADD COLUMN meta_access_token text;
ALTER TABLE profiles ADD COLUMN hotmart_token text;

ALTER TABLE leads_clicks ALTER COLUMN campaign_id DROP NOT NULL;
ALTER TABLE cta_clicks ALTER COLUMN campaign_id DROP NOT NULL;

ALTER TABLE sales ADD COLUMN user_id uuid;

-- Drop old RLS on sales
DROP POLICY "Users can view own sales" ON sales;
-- New RLS: user owns via user_id OR via campaign
CREATE POLICY "Users can view own sales" ON sales
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = sales.campaign_id AND c.user_id = auth.uid()
    )
  );
```

## Ficheiros a editar
1. **Migração SQL** — schema changes acima
2. **`src/pages/Tracking.tsx`** — remover selector campanha, usar profiles
3. **`src/pages/Pages.tsx`** — remover campo campanha, usar page_id no script
4. **`src/pages/Integrations.tsx`** — remover selector campanha, salvar hotmart_token no profiles
5. **`supabase/functions/track/index.ts`** — aceitar page_id, campaign_id opcional
6. **`supabase/functions/track-cta/index.ts`** — campaign_id opcional
7. **`supabase/functions/hotmart-webhook/index.ts`** — buscar hottok nos profiles, associar user_id à venda, disparar push mesmo sem campaign_id

