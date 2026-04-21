---
name: UX globals
description: Global keyboard shortcuts, KPI tooltips and rich empty states are app-wide UX standards.
type: preference
---
- **Atalhos teclado** (`useKeyboardShortcuts`, montado uma vez no `AppLayout`): `g+d` Dashboard, `g+s` Sales, `g+l` Leads, `g+c` Campaigns, `g+p` Pages, `g+t` Tracking, `g+n` Notifications. `Shift+?` mostra ajuda. Ignorar quando focus está em INPUT/TEXTAREA/SELECT/contentEditable.
- **Tooltips em KPIs**: usar `<InfoTooltip text="..." />` ao lado de qualquer KPI cuja fórmula não seja óbvia.
- **Empty states**: usar `<EmptyState icon title description ctaLabel ctaHref?>` em vez de Card simples; ícone neon glow, descrição clara e CTA quando faz sentido (ex: "Criar primeira página").
