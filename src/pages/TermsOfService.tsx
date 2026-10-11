import { Link } from "react-router-dom";
import { Radar, ArrowLeft, FileCheck } from "lucide-react";

export default function TermsOfService() {
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
            <FileCheck className="h-4 w-4" /> Termos de Uso e Serviço
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Termos de Serviço do NexusTrack
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            Última atualização: {new Date().toLocaleDateString("pt-PT")}
          </p>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1. Aceitação dos Termos</h2>
            <p>
              Ao aceder e utilizar a plataforma <strong>NexusTrack</strong>, o utilizador concorda em cumprir e estar vinculado aos presentes Termos de Serviço e a todas as leis e regulamentos aplicáveis. Se não concordar com estes termos, não deverá utilizar a plataforma.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">2. Descrição dos Serviços</h2>
            <p>
              O NexusTrack disponibiliza ferramentas SaaS de monitorização de campanhas publicitárias, atribuição de conversões através de parâmetros UTM, cálculo de métricas de rentabilidade (como ROAS e CPA) e integração com plataformas de terceiros, incluindo a <strong>Meta Marketing API</strong>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3. Responsabilidades do Utilizador</h2>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>O utilizador é responsável por manter a confidencialidade das suas credenciais de acesso.</li>
              <li>O utilizador garante que possui autorização legal para conectar contas de anúncios e páginas de vendas à plataforma.</li>
              <li>O utilizador compromete-se a não utilizar o serviço para quaisquer fins ilícitos, fraudulentos ou que violem as políticas de publicidade das redes conectadas (como as Diretrizes de Anúncios da Meta).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">4. Conexões com Terceiros (Meta / Facebook)</h2>
            <p>
              O NexusTrack utiliza APIs fornecidas pela Meta para obter dados de campanhas publicitárias e executar ações autorizadas pelo utilizador (como pausar ou reativar anúncios). A disponibilidade dessas funcionalidades depende da continuidade do fornecimento dos serviços pela Meta.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">5. Limitação de Responsabilidade</h2>
            <p>
              A plataforma é fornecida "como está". O NexusTrack não garante que o serviço será ininterrupto ou isento de erros decorrentes de instabilidades em APIs de terceiros. Em caso algum o NexusTrack será responsável por lucros cessantes ou prejuízos indiretos decorrentes do uso da ferramenta.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">6. Rescisão e Modificações</h2>
            <p>
              Podemos rever estes Termos de Serviço periodicamente. O uso continuado da plataforma após alterações constitui aceitação dos novos termos. O utilizador pode cancelar a sua conta a qualquer momento.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-border/40 text-xs text-muted-foreground flex justify-between">
          <span>&copy; {new Date().getFullYear()} NexusTrack Intelligence. Todos os direitos reservados.</span>
          <Link to="/privacy" className="text-primary hover:underline">Política de Privacidade</Link>
        </div>
      </div>
    </div>
  );
}