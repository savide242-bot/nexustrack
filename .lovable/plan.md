

# Plano de Implementacao — 7 Pontos

Sim, o teu projecto tem esse link:
**`https://3f6cceb8-818e-4581-b84e-a4e872deddd2.lovableproject.com/`**

Este dominio tambem precisa ser adicionado nas configuracoes do Facebook Developers.

---

## Configuracao Facebook Developers (COMPLETA)

No **developers.facebook.com**, na tua App:

**Settings → Basic:**
- App Domains:
  - `nexustrack.lovable.app`
  - `3f6cceb8-818e-4581-b84e-a4e872deddd2.lovableproject.com`
- Site URL: `https://nexustrack.lovable.app`

**Facebook Login → Settings:**
- Valid OAuth Redirect URIs:
  - `https://nexustrack.lovable.app`
  - `https://3f6cceb8-818e-4581-b84e-a4e872deddd2.lovableproject.com`
  - `https://id-preview--3f6cceb8-818e-4581-b84e-a4e872deddd2.lovable.app`
- Embedded Browser OAuth Login: **Yes**

**Settings → Advanced:**
- Allowed Domains for the JavaScript SDK:
  - `nexustrack.lovable.app`
  - `3f6cceb8-818e-4581-b84e-a4e872deddd2.lovableproject.com`
  - `id-preview--3f6cceb8-818e-4581-b84e-a4e872deddd2.lovable.app`

**App Mode:** Live (nao Development)

---

## 1. Taxa de conversao = vendas / visitantes
**Ficheiro:** `src/pages/Pages.tsx`
- Buscar `sales` com join `leads_clicks` via `lead_id` para contar vendas atribuidas a cada pagina
- Formula: `(vendas da pagina / visitantes) * 100`
- Adicionar KPI "Vendas" ao lado dos outros

## 2. IP → Pais/Cidade (server-side) + Origens detalhadas
**Ficheiro:** `supabase/functions/track/index.ts`
- Extrair IP real dos headers `x-forwarded-for` ou `x-real-ip`
- Chamar `http://ip-api.com/json/{ip}?fields=country,countryCode,city,regionName` para resolver geolocalizacao
- Gravar `country` (codigo ISO 2 letras), `city`, `state` automaticamente — cliente nao precisa enviar
- Melhorar parsing do `referrer` para classificar: Instagram (Story/Direct/Bio/Feed), Facebook, Google, TikTok, Direto, Outro
  - `l.instagram.com` → verificar utm_content para Story/Direct/Bio
  - `lm.facebook.com` ou `m.facebook.com` → Facebook
  - `google.com` → Google
  - sem referrer → Direto

**Ficheiro:** `src/pages/Pages.tsx`
- Mostrar origem detalhada (ex: "Instagram — Story") em vez de utm_source bruto
- Mostrar cidade junto com pais quando disponivel

## 3. Tracking CAPI — Terminal de logs ao vivo
**Ficheiro:** `src/pages/Tracking.tsx`
- Adicionar seccao "Logs do CAPI (AO VIVO)" com estilo terminal (fundo preto, font mono, texto verde)
- Texto inicial: `// Aguardando os primeiros eventos Server-Side...`
- Status: `Prontidao [OK]` em verde quando pixel configurado
- Subscription realtime em `capi_events_log` — cada evento novo aparece como linha de log
- Sucesso: `[14:23:05] ✓ Purchase — event_id: abc123 — sent`
- Erro: `[14:23:05] ✗ Purchase — error: invalid token` em vermelho

## 4. Facebook Login — remover bloqueio iframe + adicionar dominio lovableproject
**Ficheiro:** `src/pages/Campaigns.tsx`
- Remover a deteccao de iframe que bloqueia o login
- Manter apenas try/catch e fallback timer
- Se popup for bloqueado, mostrar toast com instrucao clara

## 5. "Copiar Script" responsivo mobile
**Ficheiro:** `src/pages/Pages.tsx`
- Card header: `flex-col` em mobile, botao `w-full` em telas pequenas (`sm:w-auto`)

## 6. Sidebar fecha ao clicar (mobile)
**Ficheiro:** `src/components/AppSidebar.tsx`
- Importar `useSidebar` do `@/components/ui/sidebar`
- No `onClick` de cada `Link`, chamar `setOpenMobile(false)`

## 7. Animacoes e efeitos visuais
**Ficheiro:** `src/index.css`
- Adicionar keyframes: `fade-in`, `slide-up`, `scale-in`
- Classes utilitarias: `animate-fade-in`, `animate-slide-up`

**Ficheiros:** `Campaigns.tsx`, `Pages.tsx`, `Tracking.tsx`
- Cards com fade-in escalonado (`animation-delay` por index)
- Hover effects: `hover:scale-[1.02] transition-all duration-300`
- Glow nos KPIs: `hover:shadow-[0_0_20px_hsl(150_100%_50%/0.15)]`
- Botoes com `active:scale-95 transition-transform`

## Ficheiros a editar
1. `supabase/functions/track/index.ts` — IP + geo + referrer parsing
2. `src/pages/Pages.tsx` — conversao correta, origens detalhadas, responsivo
3. `src/pages/Tracking.tsx` — terminal ao vivo
4. `src/pages/Campaigns.tsx` — remover bloqueio iframe
5. `src/components/AppSidebar.tsx` — fechar sidebar mobile
6. `src/index.css` — animacoes

