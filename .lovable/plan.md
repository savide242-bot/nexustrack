
Plano de correção e endurecimento

1. Segurança: subir de “boa” para “forte de verdade”
- Rever onde tokens estão guardados hoje: `profiles.meta_access_token`, `profiles.meta_pixel_id`, `profiles.hotmart_token`, `profiles.fb_ad_account_id`.
- Separar melhor os usos: token de Ads e token de CAPI não devem ficar misturados no mesmo campo.
- Endurecer o backend:
  - validar inputs nas funções `track`, `track-cta`, `meta-capi`, `hotmart-webhook`, `fb-token-exchange`
  - limitar abuso/rate limiting nas rotas públicas de tracking
  - rever políticas permissivas de INSERT (`WITH CHECK (true)`) para manter tracking público sem deixar payloads soltos demais
- Verificar configuração de autenticação e activar proteção contra passwords vazadas.
- Resultado esperado: dados continuam protegidos por autenticação e regras de acesso, mas com menos risco de abuso e menos chance de falhas futuras.

O que encontrei:
- As tabelas principais já têm RLS.
- Dados enviados ao Meta CAPI são hashados antes de envio.
- Mas os tokens sensíveis ainda estão guardados em texto na base de dados do app, protegidos por RLS, não “criptografia máxima”.
- O linter já acusa 3 pontos: 2 políticas permissivas e proteção de passwords vazadas desligada.

2. Aba Campanhas: deixar “pronta para uso”
- Manter o mapa sempre visível e garantir que acende países a partir de vendas reais.
- Melhorar a secção Meta Ads:
  - fluxo claro: conectar Facebook → escolher BM/conta de anúncios → guardar conta → importar métricas
  - mostrar métricas gerais logo no topo: gasto, compras, ROAS, CTR, CPC, CPM, impressões, cliques
  - mostrar estado da conta ligada e última importação
- Corrigir a origem dos dados guardados no perfil para não misturar credenciais de Ads com CAPI.

O que encontrei:
- As métricas gerais já existem parcialmente.
- O mapa depende de `sales.lead_id -> leads_clicks.country`; hoje a base está sem vendas, por isso nada acende.
- O login Facebook no preview está bloqueado por design: o código detecta iframe e impede login. No publicado ainda pode haver bloqueio de popup do navegador.

3. Erro ao conectar Facebook
- Corrigir UX do erro:
  - mostrar claramente que no preview não vai funcionar
  - adicionar ação/aviso para abrir a URL publicada
  - tratar popup bloqueado com mensagem correta e fallback
- Rever a configuração Meta necessária e listar tudo que precisa ser colocado na app Meta para evitar erro de domínio/popup.
- Validar o fluxo completo: SDK, permissões, troca do token, listagem das ad accounts/BMs, salvamento da conta.

O que encontrei:
- `fb-token-exchange` existe e responde.
- O botão atual depende de popup (`FB.login()`).
- A screenshot mostra bloqueio de popup; isso é compatível com o código atual e com restrições do navegador/preview.

4. Aba Páginas: analytics mais completos
- Expandir os dados além do que já existe:
  - número de visitantes
  - cliques em CTAs
  - CTA mais clicado
  - taxa de clique
  - top CTAs
  - origem/UTMs
  - países/cidades quando existirem
  - tendência temporal
  - visitantes vs cliques vs conversões em vendas atribuídas
- Melhorar a forma como os dados são carregados para evitar consultas repetidas por página e deixar mais confiável/rápido.

O que encontrei:
- Hoje já mostra visitantes, cliques CTA, taxa de conversão e top CTAs.
- Mas faltam métricas mais ricas e agregadas.
- A página faz várias queries em loop, o que é frágil para crescer.
- Há 1 página cadastrada, mas ainda sem leads nem cliques gravados.

5. Aba Tracking API: deixar realmente funcional
- Validar salvamento de Pixel ID e token.
- Garantir que o histórico de eventos grava tanto eventos de teste quanto compras reais.
- Melhorar a observabilidade:
  - estado do Pixel
  - último envio
  - erros detalhados
  - contagem de eventos enviados/com erro
- Garantir consistência entre webhook de venda e envio ao Meta CAPI.

O que encontrei:
- A UI existe e envia teste.
- A função `meta-capi` só grava no log quando recebe `campaign_id`.
- O botão de teste da aba Tracking hoje não envia `campaign_id`, então o histórico pode ficar vazio mesmo se o envio funcionar.
- Na base atual há 0 eventos CAPI.

6. Robustez para “sem bugs agora e no futuro”
- Fazer revisão completa das partes críticas:
  - autenticação
  - tracking público
  - webhook de vendas
  - notificações
  - realtime do mapa
  - importação Meta Ads
- Adicionar validações defensivas, mensagens claras e tolerância a erros.
- Rever modelagem para reduzir acoplamento entre campanhas, páginas, vendas e integrações.
- Se necessário, criar funções/backend helpers para métricas agregadas em vez de calcular tudo no frontend.

Implementação prevista
- `src/pages/Campaigns.tsx`: UX do Facebook, métricas gerais, estado da conta, robustez do mapa
- `src/pages/Pages.tsx`: dashboard de analytics mais completo
- `src/pages/Tracking.tsx`: estado funcional real + histórico correto
- `supabase/functions/fb-token-exchange/index.ts`: validação e robustez do fluxo Meta
- `supabase/functions/track/index.ts`: validação de visitante e tracking
- `supabase/functions/track-cta/index.ts`: validação de CTA
- `supabase/functions/meta-capi/index.ts`: logging correto e consistência
- `supabase/functions/hotmart-webhook/index.ts`: segurança, atribuição e confiabilidade
- Migrações/regras de acesso: endurecer segurança onde necessário

Resultado final esperado
- Campanhas: conectar Facebook de forma clara, escolher conta, puxar métricas gerais e ver o mapa acender com vendas reais.
- Páginas: ver analytics úteis de verdade, incluindo CTAs e comportamento.
- Tracking API: salvar, testar e auditar eventos corretamente.
- Segurança: boa proteção por acesso + endurecimento dos pontos ainda frágeis, sem prometer “segurança máxima absoluta”, mas deixando o sistema muito mais robusto e profissional.
