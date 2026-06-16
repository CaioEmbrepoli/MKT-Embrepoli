import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sem conexao | Gestao Embrepoli",
  description: "O sistema precisa de internet para carregar dados atualizados."
};

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <img src="/icons/icon-192.png" alt="Embrepoli" className="mb-6 h-16 w-16 rounded-2xl" />
          <h1 className="text-2xl font-black">Sem conexao com a internet</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
            O app foi aberto, mas comentarios, metricas, publicacoes e integracoes precisam de conexao para carregar dados atualizados.
          </p>
          <a
            href="/"
            className="mt-6 inline-flex rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700"
          >
            Tentar novamente
          </a>
        </div>
      </section>
    </main>
  );
}
