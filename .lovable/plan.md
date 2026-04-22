
# Correção robusta dos webhooks da Hotmart: venda real vs aprovação tardia

O problema faz sentido: a Hotmart pode enviar eventos em momentos diferentes para a mesma transação. Uma compra pode ter acontecido na semana passada, mas só receber um webhook de aprovação hoje. Se o app usa apenas `created_at` do momento em que o webhook chegou, ele trata uma venda antiga como venda de hoje, gera notificação errada e polui dashboard/resumo diário.

A correção é separar claramente:

```text
Momento em que a venda aconteceu      → sale_date / purchased_at
Momento em que foi aprovada           → approved_at
Momento em que o webhook chegou       → webhook_received_at / created_at
Estado atual da transação             → status
Último evento recebido da Hotmart     → last_hotmart_event
```

## 1. Ajustar o modelo de dados das vendas

Criar novos campos na tabela de vendas:

- `sale_date`: data comercial da venda, usada para dashboard, relatórios, resumo diário e gráficos.
- `approved_at`: data em que a Hotmart aprovou/liberou a compra, quando disponível.
- `status_updated_at`: data do último evento relevante recebido.
- `hotmart_event`: último evento bruto recebido, por exemplo `PURCHASE_APPROVED`.
- `first_seen_at`: quando o NexusTrack viu essa transação pela primeira vez.
- `last_webhook_at`: quando chegou o webhook mais recente.

Manter `created_at` apenas como data técnica de criação do registo no app, não como data da venda.

## 2. Reescrever a lógica do webhook da Hotmart

Atualizar `supabase/functions/hotmart-webhook/index.ts` para interpretar melhor os eventos da Hotmart:

- Extrair datas reais do payload da Hotmart, tentando em ordem campos como:
  - data da compra/transação;
  - data de aprovação;
  - data do evento;
  - fallback para o momento atual só se a Hotmart não enviar nenhuma data útil.
- Quando chegar um webhook tardio de aprovação:
  - atualizar o status da venda existente;
  - preencher `approved_at`;
  - não alterar `sale_date`;
  - não criar nova venda;
  - não disparar notificação de “Nova venda!” se a venda já tinha sido registada antes.
- Quando for uma transação nova:
  - criar a venda com `sale_date` igual à data real da compra;
  - notificar apenas se for realmente uma venda nova e recente, não uma aprovação antiga.

## 3. Blindar contra conflitos e duplicações

Reforçar a idempotência por `transaction_id`:

- Garantir índice único em `sales.transaction_id`.
- Para webhooks repetidos da mesma transação:
  - atualizar apenas campos de estado;
  - nunca duplicar receita;
  - nunca duplicar notificação de venda;
  - nunca duplicar envio CAPI para Meta.
- Ajustar a ordem de prioridade dos status:
  - `refunded` e `chargeback` devem prevalecer;
  - `cancelled` não deve voltar para aprovado;
  - `approved` e `realized` devem ser tratados como venda válida, mas sem gerar duas vendas;
  - eventos informativos da Hotmart não devem mexer na receita.

## 4. Corrigir dashboards, relatórios e resumo diário

Trocar os cálculos que hoje usam `created_at` para usarem `sale_date`:

- Dashboard principal.
- Gráfico de vendas diárias.
- Top produtos.
- Heatmap.
- Funil.
- Campanhas/ROAS.
- Página de vendas.
- Resumo diário das 22:00.

Resultado esperado:

```text
Venda feita na semana passada,
aprovada hoje pela Hotmart
→ aparece na semana passada nos relatórios
→ pode ter status atualizado hoje
→ não conta como venda de hoje
→ não dispara “Nova venda!” hoje
```

## 5. Melhorar a página de Vendas para mostrar as duas datas

Na tabela de vendas, mostrar de forma clara:

- Data da venda: `sale_date`.
- Data de aprovação: `approved_at`, quando existir.
- Status atual.
- Plataforma/transação.

Exemplo visual:

```text
Comprador      Produto      Valor      Status      Venda em       Aprovada em
João           Curso X      4.500 MT   approved    15/04/2026     22/04/2026
```

Isso evita a confusão entre “foi vendido hoje” e “foi aprovado hoje”.

## 6. Ajustar notificações

Atualizar as regras de notificação:

- “Nova venda!” só para transações novas.
- Atualização tardia de aprovação não deve gerar notificação como se fosse venda nova.
- Se for necessário, no futuro pode existir outro tipo de notificação separado:
  - “Venda aprovada”
  - mas por agora vou evitar para não duplicar ou confundir.

Também vou garantir que o `send-push` receba `kind: "sale"` nas notificações reais de venda, respeitando as preferências do usuário.

## 7. Corrigir o resumo diário

O resumo diário deverá consultar vendas pela `sale_date`, não pelo `created_at`.

Assim, às 22:00 o resumo mostra:

- vendas realmente feitas naquele dia local;
- não aprovações antigas recebidas naquele dia;
- sem duplicar vendas se o cron ou webhook repetir.

## 8. Atualizar registros antigos quando possível

Adicionar uma migração segura para preencher `sale_date` das vendas existentes:

- Se o payload Hotmart tiver data real da compra, usar essa data.
- Se não tiver, usar `created_at` como fallback.
- Não apagar dados existentes.

## 9. Testes e validação

Validar estes cenários:

```text
1. Compra nova aprovada imediatamente
   → cria venda
   → conta no dia correto
   → envia uma notificação

2. Compra antiga aprovada hoje
   → atualiza status
   → mantém sale_date antiga
   → não conta como venda de hoje
   → não envia “Nova venda!”

3. Mesmo webhook reenviado pela Hotmart
   → não duplica venda
   → não duplica notificação
   → não duplica CAPI

4. Venda reembolsada
   → muda para refunded
   → sai da receita ativa
   → aparece em Reembolsos

5. Venda cancelada
   → muda para cancelled
   → aparece em Canceladas
   → não entra na receita
```

## Resultado final

Depois desta correção, o NexusTrack passa a entender os webhooks da Hotmart de forma mais realista:

- venda é contabilizada na data em que aconteceu;
- aprovação tardia apenas atualiza o status;
- notificações deixam de parecer vendas novas quando são apenas aprovações antigas;
- dashboard, vendas, campanhas e resumo diário ficam consistentes;
- conflitos de webhooks repetidos são evitados por design.
