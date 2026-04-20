

# Melhorias gerais do App — NexusTrack

Mantém-se o plano anterior de tracking (#1 Pixel Health, #2 InitiateCheckout, #3 Retry CAPI, #4 Validação Pixel, #5 Atribuição). Abaixo, melhorias para o **resto do app**.

---

## A. Dashboard inteligente

**Hoje:** KPIs estáticos (vendas, leads, conversão, ticket médio) + gráfico 7 dias.

**Melhorias:**
- **Comparação automática** vs período anterior ("+12% vs semana passada") em cada KPI
- **Top 3 produtos** mais vendidos no período (com receita MZN)
- **Hora de pico de vendas** (heatmap dia/hora) para optimizar campanhas
- **Funil visual:** Visitantes → CTAs → Checkout → Vendas com % entre etapas
- **Alerta inteligente:** se conversão cair >30% vs média histórica, badge vermelho

---

## B. Página de Leads — enriquecimento

**Hoje:** Lista de visitantes com fingerprint + geo.

**Melhorias:**
- **Timeline por lead:** ver todas as visitas, CTAs clicados e (se converteu) a venda associada num único card expansível
- **Score visual** (0-100) com barra de cor (vermelho→verde) em vez de só número
- **Filtros:** por país, UTM source, score mínimo, "só leads que converteram"
- **Exportar CSV** dos leads filtrados
- **Marcar lead como "hot":** flag manual para acompanhamento

---

## C. Campanhas — performance real

**Hoje:** Lista de campanhas + mapa mundial.

**Melhorias:**
- **ROAS por campanha:** receita MZN / gasto Meta Ads (puxar gasto via API Meta já integrada)
- **CPA real:** gasto / nº de vendas atribuídas
- **Ranking de campanhas:** ordenar por ROAS, vendas, ou conversão
- **Detalhe de campanha:** clicar abre modal com gráfico diário + top UTMs + top países

---

## D. Notificações — controlo fino

**Hoje:** Push para cada venda com texto fixo.

**Melhorias:**
- **Preferências por utilizador:** escolher receber push de [vendas / cancelamentos / reembolsos / metas atingidas]
- **Notificação de meta:** quando atinge marco do progresso (50k, 100k, 500k MZN)
- **Resumo diário às 22h:** "Hoje: X vendas, Y MZN, Z% vs ontem"
- **Histórico filtrável** por tipo e data

---

## E. Settings — perfil completo

**Hoje:** Apenas nome + empresa.

**Melhorias:**
- **Avatar/foto** (Supabase Storage)
- **Fuso horário** (afecta filtros de data e resumos)
- **Moeda preferida de exibição** (MZN padrão, mas opção USD/BRL/EUR)
- **Mudar password** + **2FA opcional**
- **Sessões activas** (ver dispositivos logados, revogar)
- **Eliminar conta** (RGPD)

---

## F. Performance & PWA

- **Lazy load** das páginas (`React.lazy` + `Suspense`) — reduz bundle inicial em ~40%
- **Skeleton loaders** uniformes em todas as listas (hoje algumas mostram "Carregando...", outras nada)
- **Offline mode básico:** dashboard mostra última versão em cache quando sem rede
- **Optimização de imagens** do mapa mundial (SVG → comprimido)

---

## G. UX & Acessibilidade

- **Atalhos de teclado:** `g d` → dashboard, `g s` → sales, `g l` → leads, `/` → focus search
- **Estado vazio melhorado:** quando não há dados, ilustração + CTA claro ("Criar primeira página", "Conectar Hotmart")
- **Toast unificado:** padronizar success (verde neon), error (vermelho), info (azul) com ícones
- **Tooltips** em todos os KPIs explicando como são calculados
- **Modo de foco:** botão para esconder sidebar e ver dashboard fullscreen em apresentações

---

## H. Segurança & Auditoria

- **Audit log:** tabela `audit_log` regista ações sensíveis (mudança de token Hotmart, eliminação de campanha)
- **Rate limiting** nas edge functions de tracking (proteger contra spam de leads falsos)
- **Validação de domínio** ao criar página: verificar que o user é dono (meta tag ou DNS)
- **Rotação de tokens:** alerta quando `hotmart_token` ou `meta_access_token` tem >90 dias

---

## I. Onboarding novo utilizador

**Hoje:** Após signup, utilizador cai no dashboard vazio sem saber o que fazer.

**Melhoria:**
- **Wizard de 4 passos** após primeiro login:
  1. Configurar Pixel Meta (ID + Token)
  2. Conectar Hotmart (Token + copiar webhook URL)
  3. Criar primeira página de tracking
  4. Instalar script no site
- Barra de progresso "Setup 2/4" no topo do dashboard até completar

---

## Recomendação de fases

**Fase 1 (impacto imediato):** A (Dashboard), B (Leads timeline), I (Onboarding)
**Fase 2 (retenção):** C (ROAS), D (Notificações), G (UX)
**Fase 3 (escala):** E (Settings), F (Performance), H (Segurança)

Diz-me **que letras queres avançar** (e se misturas com o plano de tracking #1-#5).

