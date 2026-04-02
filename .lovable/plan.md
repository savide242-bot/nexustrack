

# Plano — 7 Melhorias

## 1. Vendas por Fonte: trocar PieChart por lista com mini-donut

Substituir o gráfico de pizza (recharts PieChart) no `Index.tsx` por uma lista estilo a imagem de referência: cada fonte numa linha com o nome, contagem, mini-donut circular (SVG) e percentagem. Visual limpo, sem o gráfico pesado.

**Ficheiro:** `src/pages/Index.tsx` — remover PieChart, criar componente inline `SourceRow` com SVG circular.

## 2. Stories detection: melhorar classifySource no tracking

O problema é que Instagram Stories não envia UTM. Quando o utilizador partilha um link nos stories, o referrer vem como `l.instagram.com` sem nenhum `utm_content=story`. A única forma de distinguir stories de bio é pelo referrer pattern. Instagram stories usa `l.instagram.com` como redirect, enquanto bio link usa `l.instagram.com` também — ambos são indistinguíveis sem UTM.

**Solução:** No script de tracking (`Pages.tsx` → `getScript`), adicionar detecção automática:
- Se `document.referrer` contém `instagram` E `utm_source` não está definido, definir automaticamente `utm_source=instagram`
- Documentar ao utilizador que para distinguir stories de bio, deve usar UTMs nos links (ex: `?utm_source=ig&utm_content=story`)

No `classifySource` do edge function `track/index.ts`, melhorar a heurística:
- Se referrer é `l.instagram.com` ou `instagram.com` sem UTM → "Instagram" (genérico)  
- Adicionar detecção de `igshid` no referrer (parâmetro que Instagram adiciona)

**Ficheiros:** `supabase/functions/track/index.ts`, `src/pages/Pages.tsx`

## 3. Tracking operacional: verificação

O tracking CAPI já funciona (há eventos "sent" na BD). O problema anterior era `user_id=null` nos logs. Isso já foi corrigido no `hotmart-webhook`. As configurações de Pixel ID e Access Token estão salvas nos `profiles`. Nenhuma alteração de código necessária aqui — apenas confirmar com o utilizador que está operacional.

## 4. Páginas: filtrar por hoje como padrão

Adicionar `DateFilter` à aba Páginas. Filtrar `leads_clicks` e `cta_clicks` por `created_at` dentro do range selecionado.

**Ficheiro:** `src/pages/Pages.tsx` — importar `DateFilter`, adicionar state `dateRange`, filtrar queries com `.gte/.lte`.

## 5. Integrações e Tracking: modo salvo com botão Editar

Nas páginas `Integrations.tsx` e `Tracking.tsx`, quando os campos já estão preenchidos e salvos:
- Mostrar os valores mascarados (ex: `HOT-****XX`, `EAA****xx`) com ícone de check
- Esconder formulário, mostrar botão "Editar"
- Ao clicar "Editar", mostrar formulário novamente

**Ficheiros:** `src/pages/Integrations.tsx`, `src/pages/Tracking.tsx` — adicionar state `editing`, lógica condicional.

## 6. Leads: fingerprint como métrica + responsivo mobile

- Adicionar coluna "Fingerprint" na tabela de leads (já existe no BD `leads_clicks.fingerprint`)
- Tornar a tabela responsiva: em mobile, usar cards empilhados em vez de tabela horizontal
- Adicionar `DateFilter` para filtrar por hoje como padrão

**Ficheiro:** `src/pages/Leads.tsx` — adicionar fingerprint, layout responsivo com cards mobile, DateFilter.

## 7. Login: animações e efeitos visuais

Adicionar ao `Login.tsx`:
- Background com partículas/gradiente animado
- Card com `animate-fade-in` + `animate-scale-in` ao carregar
- Logo com glow pulsante (`animate-pulse` neon)
- Inputs com transição de foco suave
- Botão com hover scale effect

**Ficheiro:** `src/pages/Login.tsx`

## Ficheiros a editar

1. `src/pages/Index.tsx` — lista de fontes com mini-donut
2. `supabase/functions/track/index.ts` — melhorar stories detection
3. `src/pages/Pages.tsx` — script tracking + DateFilter
4. `src/pages/Integrations.tsx` — modo salvo/editar
5. `src/pages/Tracking.tsx` — modo salvo/editar
6. `src/pages/Leads.tsx` — fingerprint + responsivo + DateFilter
7. `src/pages/Login.tsx` — animações

