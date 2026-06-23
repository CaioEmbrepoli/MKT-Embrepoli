// CPF tem 11 digitos, CNPJ tem 14 — o mesmo campo bruto (cadastro PF/PJ, campo
// unico de login "E-mail ou CPF/CNPJ", ou documento informado no checkout) e
// classificado por tamanho aqui, nunca pelo nome do campo de origem.
export function classifyDocument(raw: string): { cpf: string; cnpj: string } {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11) return { cpf: digits, cnpj: "" };
  if (digits.length === 14) return { cpf: "", cnpj: digits };
  return { cpf: "", cnpj: "" };
}
