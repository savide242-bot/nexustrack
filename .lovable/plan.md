

# NexusTrack Pro — Plano de Implementação

## Visão Geral
App full-stack de analytics e tracking de vendas em **meticais (MZN)**, com conversão automática de câmbio, push notifications, PWA, rastreamento avançado para Facebook Pixel, e integração com Hotmart.

---

## Fase 1: Fundação (Auth + Layout + Database)

### Autenticação
- Login/Signup com email e senha via Lovable Cloud
- Página de recuperação de senha
- Proteção de rotas autenticadas

### Design System — Dark Mode
- Fundo escuro `#121212` com acentos verde neon `#00FF7F`
- Tipografia moderna, cards com glassmorphism sutil
- Layout responsivo com sidebar de navegação

### Estrutura de Banco de Dados
- **profiles** — dados do utilizador (nome, empresa)
- **user_roles** — controle de acesso
- **campaigns** — pixel IDs, tokens de API, configurações UTM
- **leads_clicks** — log de visitas com UTMs, fingerprint, IP, user-agent, tempo de permanência
- **sales** — conversões vinculadas a leads, valor original, moeda original, valor em MZN, taxa de câmbio
- **cta_clicks** — rastreamento de cliques em botões de checkout
- **notifications_log** — histórico de notificações enviadas

---

## Fase 2: Dashboard Principal

### Cards de Métricas em Tempo Real
- Vendas Aprovadas (MZN), Boletos/Pix Pendentes, ROI, CPA, Taxa de Conversão
- Atualização automática via subscriptions do Supabase

### Gráficos de Performance
- Gráfico de linha — vendas diárias (últimos 7/30 dias)
- Gráfico de pizza — distribuição por UTM Source
- Gráfico de barras — performance por campanha

### Tabela de Leads com Score IA
- Score 0-100 por lead baseado em: tempo de permanência, nº de cliques em CTAs, páginas visitadas
- Indicador visual colorido (vermelho → amarelo → verde)

---

## Fase 3: Tracking Engine

### Script de Pixel Próprio
- Geração automática de script JS leve para cada campanha
- Captura: UTMs (source, medium, campaign, content, term), IP, User-Agent, Referrer, Fingerprint único
- Botão "Copiar Script" com configuração em menos de 1 minuto
- Rastreamento automático de cliques em CTAs (botões de checkout)

### Rastreamento Avançado para Facebook CAPI
- Edge Function que envia eventos para a Conversions API do Facebook: PageView, Lead, InitiateCheckout, Purchase
- Dados enviados: nome, email, telefone, cidade, estado, país, CEP, IP, user-agent, FBC, FBP — máximo de dados possível para otimizar o pixel
- Deduplicação de eventos (Browser + Server) via event_id
- Suporte para Meta, Google Ads e TikTok CAPI

---

## Fase 4: Integração Hotmart + Câmbio

### Webhook Hotmart
- Edge Function para receber webhooks da Hotmart (vendas aprovadas, reembolsos, etc.)
- Cruzamento do email/telefone do comprador com fingerprint/UTM capturado para atribuição correta

### Conversão Automática para Meticais
- Integração com ExchangeRate API (gratuita) para câmbio em tempo real
- Qualquer moeda (USD, BRL, EUR, etc.) → MZN automaticamente
- Taxa de câmbio do dia armazenada junto com cada venda
- Exibição no dashboard sempre em MZN

---

## Fase 5: Push Notifications + PWA

### PWA (Progressive Web App)
- Instalável no telemóvel via browser
- Manifest com ícones e branding dark/verde neon
- Funciona offline para visualização do dashboard

### Push Notifications (VAPID)
- Configuração com VAPID keys fornecidas pelo utilizador
- Notificação automática a cada venda aprovada
- Formato: **"[Nome do comprador] pagou X MZN em [Hotmart]"**
- Valor já convertido para meticais na notificação
- Edge Function que dispara a notificação via Web Push API

---

## Páginas do App

1. **Login / Signup** — autenticação completa
2. **Dashboard** — métricas, gráficos, leads com score
3. **Campanhas** — criar/editar campanhas, gerar script de pixel
4. **Vendas** — lista detalhada com valor original e valor em MZN
5. **Leads** — tabela com fingerprint, UTMs, score IA, CTAs clicados
6. **Integrações** — configurar tokens Hotmart, Meta Pixel, VAPID keys
7. **Configurações** — perfil, preferências de notificação

