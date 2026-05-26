import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Uso | Gestão Embrepoli",
  description: "Termos de uso da plataforma interna Gestão Embrepoli."
};

const updatedAt = "26 de maio de 2026";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <section className="mx-auto max-w-4xl rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm md:p-12">
        <header className="mb-10 text-center">
          <Image src="/embrepoli-logo.png" alt="Logo Embrepoli" width={96} height={96} className="mx-auto h-24 w-24 object-contain" priority />
          <p className="mt-4 text-sm font-black uppercase tracking-[0.2em] text-blue-700">Gestão Embrepoli</p>
          <h1 className="mt-3 text-3xl font-black md:text-4xl">Termos de Uso</h1>
          <p className="mt-3 text-sm font-semibold text-slate-500">Ultima atualizacao: {updatedAt}</p>
        </header>

        <div className="space-y-7 text-sm leading-7 text-slate-700 md:text-base">
          <section>
            <h2 className="text-xl font-black text-slate-950">1. Sobre o sistema</h2>
            <p className="mt-2">
              A Gestao Embrepoli e uma plataforma interna da Embrepoli para organizar atividades de marketing, vendas, calendario de conteudo, metricas,
              comentarios, clientes, revisoes e integracoes com servicos externos autorizados pela empresa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-950">2. Uso permitido</h2>
            <p className="mt-2">
              O acesso ao sistema e restrito a usuarios autorizados pela Embrepoli. Cada usuario deve usar sua propria conta, manter suas credenciais em
              seguranca e acessar apenas informacoes relacionadas ao seu trabalho e permissoes dentro da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-950">3. Integracoes externas</h2>
            <p className="mt-2">
              O sistema pode se conectar a plataformas externas, como TikTok, YouTube, Google Drive e futuras APIs autorizadas, somente quando uma conta
              responsavel da empresa concede permissao. Essas integracoes podem ser usadas para consultar dados operacionais, importar conteudos, analisar
              metricas, organizar arquivos e apoiar respostas a clientes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-950">4. Responsabilidades do usuario</h2>
            <p className="mt-2">
              O usuario se compromete a nao compartilhar acessos, nao exportar informacoes sem autorizacao, nao manipular dados de forma indevida e nao
              usar o sistema para atividades fora dos objetivos comerciais e operacionais da Embrepoli.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-950">5. Dados e conteudos</h2>
            <p className="mt-2">
              As informacoes cadastradas no sistema pertencem a Embrepoli ou aos respectivos titulares quando aplicavel. Comentarios, metricas, arquivos,
              clientes e registros comerciais devem ser tratados como informacoes internas e podem ser removidos, corrigidos ou revisados conforme regras
              da empresa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-950">6. Alteracoes nos termos</h2>
            <p className="mt-2">
              A Embrepoli pode atualizar estes termos para refletir mudancas no sistema, nas integracoes ou nos processos internos. A versao atual ficara
              disponivel nesta pagina.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-950">7. Contato</h2>
            <p className="mt-2">
              Para duvidas sobre estes termos, permissoes de acesso ou uso do sistema, entre em contato com o administrador da Gestao Embrepoli.
            </p>
          </section>
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 pt-6 text-sm font-bold">
          <Link href="/" className="rounded-full bg-blue-600 px-5 py-3 text-white transition hover:bg-blue-700">
            Voltar ao sistema
          </Link>
          <Link href="/privacy" className="rounded-full bg-slate-100 px-5 py-3 text-slate-700 transition hover:bg-slate-200">
            Politica de Privacidade
          </Link>
        </footer>
      </section>
    </main>
  );
}
