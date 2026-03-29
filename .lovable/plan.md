

# Plano — 3 Correções

## 1. Botão Facebook não abre popup de login

**Causa raiz:** O Facebook SDK bloqueia `FB.login()` quando executado dentro de um iframe (o preview do Lovable). O SDK carrega correctamente (vejo `app_id: 1108905534695999` na resposta da edge function), mas o popup é bloqueado pelo browser porque está num iframe cross-origin.

**Solução:**
- Adicionar detecção de iframe no `handleFbLogin` — se estiver num iframe, mostrar um toast explicando que o login Facebook só funciona na URL publicada (`nexustrack.lovable.app`)
- Adicionar um `try/catch` à volta do `FB.login()` para capturar erros de popup bloqueado e resetar o estado `fbLoading` correctamente
- Garantir que o timeout de fallback reseta o loading se o popup for bloqueado silenciosamente

**Configuração necessária no Facebook Developers:**
- Em **Settings → Basic**: Adicionar `nexustrack.lovable.app` em "App Domains"
- Em **Facebook Login → Settings**: Adicionar `https://nexustrack.lovable.app` em "Valid OAuth Redirect URIs"
- Em **Settings → Advanced**: Adicionar `nexustrack.lovable.app` em "Allowed Domains for the JavaScript SDK"
- A App deve estar em modo **Live** (não Development)

## 2. Verificação geral de funcionalidades

Vou verificar e corrigir:
- **Mapa de vendas**: Está presente e funcional (já confirmado no código — `Geography` fill dinâmico + realtime subscription). OK.
- **Meta Ads OAuth**: O fluxo está correcto no código — o problema é apenas o iframe. Na URL publicada vai funcionar.
- **Webhook Hotmart**: O filtro de teste só bloqueia `test === true`, emails `@example.com`, e nomes exactos "teste". Vendas orgânicas passam.
- **Notificações push**: Enviar notificação de teste para confirmar formato.
- **Console warnings**: Corrigir o warning `key` no `Geographies` (usar `geo.rsmKey` em vez de `geo.rsSVGPath`)

## 3. Refazer logotipo/ícone PWA

Criar um ícone PWA profissional e moderno para o NexusTrack Pro:
- Design clean com tema verde (#00FF7F) sobre fundo escuro (#121212)
- Forma geométrica moderna (não texto genérico)
- Gerar ícones 192x192 e 512x512 via SVG inline convertido
- Actualizar `public/manifest.json` se necessário

## Ficheiros a editar
1. **`src/pages/Campaigns.tsx`** — fix FB login iframe detection + key warning
2. **Invocar `send-push`** — notificação de teste
3. **Gerar ícones PWA** — criar SVGs profissionais para 192x192 e 512x512

