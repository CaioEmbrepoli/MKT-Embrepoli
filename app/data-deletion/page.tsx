export default function DataDeletionPage() {
  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 600, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Exclusão de Dados</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>
        Esta página descreve como solicitar a exclusão dos seus dados pessoais armazenados pelo aplicativo Gestão Embrepoli.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Como solicitar a exclusão</h2>
      <p style={{ color: "#555", marginBottom: 16 }}>
        Para solicitar a exclusão dos seus dados, entre em contato pelo e-mail abaixo informando seu nome e o dado que deseja remover. Atenderemos sua solicitação em até 30 dias.
      </p>
      <p style={{ fontWeight: 700 }}>
        E-mail:{" "}
        <a href="mailto:caio@embrepoli.com.br" style={{ color: "#2563eb" }}>
          caio@embrepoli.com.br
        </a>
      </p>

      <p style={{ color: "#888", fontSize: 13, marginTop: 48 }}>
        Embrepoli — Curitiba, PR
      </p>
    </main>
  );
}
