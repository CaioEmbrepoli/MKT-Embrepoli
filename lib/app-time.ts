export const APP_TIME_ZONE = "America/Sao_Paulo";
export const SAO_PAULO_UTC_OFFSET = "-03:00";

export function hasExplicitTimeZone(value: string) {
  return /(?:z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
}

export function withSaoPauloOffset(value: string) {
  const trimmed = value.trim();
  if (!trimmed || hasExplicitTimeZone(trimmed)) return trimmed;
  return `${trimmed.replace(/\.\d+$/, "")}${SAO_PAULO_UTC_OFFSET}`;
}

export function buildSaoPauloDateTime(date: string, time: string) {
  return `${date}T${time}:00${SAO_PAULO_UTC_OFFSET}`;
}

export function parseSaoPauloDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(withSaoPauloOffset(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error("Data de agendamento invalida.");
  }
  return date;
}

export function formatSaoPauloSchedule(value: string) {
  const date = new Date(withSaoPauloOffset(value));
  if (Number.isNaN(date.getTime())) return value;
  const day = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: APP_TIME_ZONE
  });
  const time = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE
  });
  return `${day} as ${time}`;
}
