---
name: Notification preferences
description: Per-user push controls (sales, refunds, milestones, daily summary) plus timezone for daily summary at 22h local.
type: feature
---
- Tabela `notification_prefs` (uma linha por user, RLS própria) com toggles `push_sales`, `push_refunds`, `push_milestones`, `daily_summary` e campo `timezone` (default `Africa/Maputo`).
- Edge function `send-push` aceita `kind: "sale"|"refund"|"milestone"|"summary"` e descarta o envio se a preferência correspondente estiver desligada.
- Edge function `daily-summary` corre via `pg_cron` a cada hora; só dispara push para utilizadores cuja hora local seja 22h.
- UI gerida em `/notifications` via componente `NotificationPrefs`.
