import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politica de Privacidade | Gestão Embrepoli",
  description: "Politica de privacidade da plataforma interna Gestão Embrepoli."
};

const updatedAt = "26 de maio de 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <section className="mx-auto max-w-4xl rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm md:p-12">
        <header className="mb-10 text-center">
          <Image src="/embrepoli-logo.png" alt="Logo Embrepoli" width={96} height={96} className="mx-auto h-24 w-24 object-contain" priority />
          <p className="mt-4 text-sm font-black uppercase tracking-[0.2em] text-blue-700">Gestão Embrepoli</p>
          <h1 className="mt-3 text-3xl font-black md:text-4xl">Politica de Privacidade</h1>
          <p className="mt-3 text-sm font-semibold text-slate-500">Ultima atualizacao: {updatedAt}</p>
        </header>

        <div className="space-y-7 text-sm leading-7 text-slate-700 md:text-base">
          <section>
            <h2 className="text-xl font-black text-slate-950">1. Dados coletados</h2>
            <p className="mt-2">
              A Gestao Embrepoli pode armazenar dados de usuarios internos, como nome, email, funcao, permissoes, equipes, atividades realizadas e registros
              necessarios para operar o sistema. Tambem pode armazenar dados de clientes, comentarios, metricas, arquivos e informacoes comerciais inseridas
              por usuarios autorizados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-950">2. Dados de integracoes</h2>
            <p className="mt-2">
              Quando a Embrepoli autoriza conexoes com plataformas externas, como TikTok, YouTube ou Google Drive, o sistema pode acessar dados permitidos
              pela propria autorizacao, como informacoes de conta, conteudos, arquivos, comentarios, metricas e dados de desempenho. O acesso e usado apenas
              para gestao interna, analise e organizacao operacional.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-950">3. Finalidade de uso</h2>
            <p className="mt-2">
              Os dados sao usados para organizar marketing e vendas, acompanhar tarefas, revisar conteudos, importar comentarios, analisar resultados,
              responder duvidas de clientes, gerar relatorios internos e melhorar os processos comerciais da Embrepoli.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-950">4. Compartilhamento</h2>
            <p className="mt-2">
              A Embrepoli nao vende dados coletados pelo sistema. As informacoes podem ser processadas por provedores usados para operar a plataforma, como
              hospedagem, banco de dados, autenticacao, armazenamento, APIs autorizadas e ferramentas de inteligencia artificial, sempre para as finalidades
              descritas nesta politica.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-950">5. Retencao e exclusao</h2>
            <p className="mt-2">
              Dados operacionais podem ser mantidos enquanto forem necessarios para o uso do sistema. Comentarios brutos importados podem ter retencao
              temporaria, enquanto perguntas e respostas consolidadas no Banco de Duvidas podem ser mantidas como base de conhecimento da empresa. Dados
              podem ser corrigidos ou removidos quando solicitado por um responsavel autorizado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-950">6. Seguranca</h2>
            <p className="mt-2">
              O sistema usa controle de acesso por usuario, permissoes por equipe, autenticacao e regras de acesso no banco de dados para reduzir acessos
              indevidos. Usuarios devem manter suas credenciais seguras e informar qualquer suspeita de uso nao autorizado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-slate-950">7. Contato</h2>
            <p className="mt-2">
              Para solicitar informacoes, correcao, exclusao ou esclarecimentos sobre privacidade, entre em contato com o administrador da Gestao Embrepoli.
            </p>
          </section>
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 pt-6 text-sm font-bold">
          <Link href="/" className="rounded-full bg-blue-600 px-5 py-3 text-white transition hover:bg-blue-700">
            Voltar ao sistema
          </Link>
          <Link href="/terms" className="rounded-full bg-slate-100 px-5 py-3 text-slate-700 transition hover:bg-slate-200">
            Termos de Uso
          </Link>
        </footer>
      </section>
    </main>
  );
}
