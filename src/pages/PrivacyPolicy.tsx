import { Link } from "react-router-dom";
import { Radar, ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#090a0f] text-foreground p-6 sm:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-border/40 pb-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Radar className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg text-foreground tracking-tight">
              Nexus<span className="text-primary">Track</span>
            </span>
          </Link>
          <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao App
          </Link>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-wider">
            <Shield className="h-4 w-4" /> Política de Privacidade Oficial
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Política de Privacidade do NexusTrack
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            Última atualização: {new Date().toLocaleDateString("pt-PT")}
          </p>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1. Introdução e Visão Geral</h2>
            <p>
              O <strong>NexusTrack</strong> é uma plataforma de inteligência de tráfego, análise de dados e rastreamento de conversões para anunciantes digitais. Esta Política de Privacidade descreve como recolhemos, usamos, processamos e protegemos as suas informações ao utilizar a nossa plataforma, o nosso website e as nossas integrações com redes publicitárias, nomeadamente a <strong>Meta (Facebook Ads)</strong>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">2. Dados Recolhidos e Finalidade</h2>
            <p>Para fornecer os serviços de análise e inteligência publicitária, recolhemos os seguintes dados:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong>Dados de Autenticação:</strong> Nome, endereço de e-mail e identificadores de conta fornecidos no registo.</li>
              <li><strong>Integração com a Meta (Facebook Marketing API):</strong> Quando autoriza a ligação da sua conta de anúncios, acedemos exclusivamente a dados de leitura e gestão de campanhas publicitárias (gastos, impressões, cliques, conjuntos de anúncios e métricas de desempenho).</li>
              <li><strong>Dados de Rastreamento (Pixel & UTMs):</strong> Endereço IP (anonimizado), parâmetros UTM de campanhas, referrers, identificadores de cliques publicitários (como fbclid) e eventos de navegação para atribuição de vendas.</li>
              <li><strong>Webhooks de Vendas:</strong> Identificadores de transação, valores de compra e moeda enviados pelas plataformas de pagamento conectadas (Hotmart, Kiwify, etc.).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3. Utilização dos Dados da Meta (Facebook Ads)</h2>
            <p>
              O NexusTrack cumpre rigorosamente as <em>Políticas de Plataforma da Meta</em>. Os dados de anúncios obtidos através da Meta Marketing API são utilizados estritamente para exibir os relatórios de retorno sobre investimento (ROAS, CPA, ROI) e permitir a gestão direta de orçamentos e status de campanhas no painel do próprio utilizador. <strong>Nunca partilhamos, vendemos ou cedemos os seus dados publicitários a terceiros</strong>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">4. Eliminação e Retenção de Dados</h2>
            <p>
              Os dados são retidos apenas enquanto a sua conta estiver ativa. A qualquer momento, o utilizador pode revogar o acesso do Facebook através da página de Integrações do NexusTrack ou diretamente nas configurações de aplicações do Facebook. Para solicitar a exclusão total e imediata dos seus dados, basta enviar um pedido para o nosso suporte através de <code>privacidade@nexustrack.app</code>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">5. Segurança da Informação</h2>
            <p>
              Implementamos encriptação de ponta a ponta (SSL/TLS), isolamento de base de dados com Row Level Security (RLS) e cofres criptografados seguros para tokens de acesso de APIs externas.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">6. Contacto</h2>
            <p>
              Se tiver dúvidas sobre esta Política de Privacidade ou sobre o tratamento dos seus dados, entre em contacto connosco pelo e-mail <code>suporte@nexustrack.app</code>.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-border/40 text-xs text-muted-foreground flex justify-between">
          <span>&copy; {new Date().getFullYear()} NexusTrack Intelligence. Todos os direitos reservados.</span>
          <Link to="/terms" className="text-primary hover:underline">Termos de Serviço</Link>
        </div>
      </div>
    </div>
  );
}