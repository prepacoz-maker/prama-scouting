// Etichette in italiano per enum e stati. Modificare qui per cambiare i testi dell'interfaccia.

export const STATUS_LABELS: Record<string, string> = {
  DA_VALUTARE: "Da valutare",
  IN_OSSERVAZIONE: "In osservazione",
  NUOVO_CONTROLLO_RICHIESTO: "Nuovo controllo richiesto",
  VIDEO_RICHIESTO: "Video richiesto",
  IN_FOLLOW_UP: "In follow-up",
  INTERESSANTE: "Interessante",
  MOLTO_INTERESSANTE: "Molto interessante",
  NON_PRIORITARIO: "Non idoneo al momento",
  ARCHIVIATO: "Archiviato",
  DUPLICATO: "Duplicato",
};

/** Etichetta sintetica mostrata sulla Player Card. */
export function cardLabel(status: string): string {
  switch (status) {
    case "MOLTO_INTERESSANTE":
      return "Alta priorità";
    case "INTERESSANTE":
      return "Interessante";
    case "IN_FOLLOW_UP":
    case "NUOVO_CONTROLLO_RICHIESTO":
    case "VIDEO_RICHIESTO":
      return "Da seguire";
    case "DA_VALUTARE":
    case "IN_OSSERVAZIONE":
      return "In osservazione";
    default:
      return STATUS_LABELS[status] ?? status;
  }
}

export const INTEREST_LABELS: Record<string, string> = {
  BASSO: "Basso",
  MEDIO: "Medio",
  ALTO: "Alto",
  MOLTO_ALTO: "Molto alto",
};

export const RELIABILITY_LABELS: Record<string, string> = {
  NESSUNA: "Non disponibile",
  BASSA: "Bassa",
  MEDIA: "Media",
  ALTA: "Alta",
};

export const ROLE_LABELS: Record<string, string> = {
  SCOUT: "Scout",
  REFERENTE: "Referente di zona",
  ADMIN: "Admin PRAMA",
};

export const ROLE_GROUP_LABELS: Record<string, string> = {
  PORTIERE: "Portiere",
  DIFENSORE: "Difensore",
  CENTROCAMPISTA: "Centrocampista",
  ATTACCANTE: "Attaccante",
};

export const EVENT_LABELS: Record<string, string> = {
  PARTITA: "Partita",
  ALLENAMENTO: "Allenamento",
  TORNEO: "Torneo",
  AMICHEVOLE: "Amichevole",
  VIDEO: "Video",
};

export const FOOT_LABELS: Record<string, string> = {
  DESTRO: "Destro",
  SINISTRO: "Sinistro",
  ENTRAMBI: "Entrambi",
  NON_RILEVATO: "Non rilevato",
};

export const MATURATION_LABELS: Record<string, string> = {
  PRECOCE: "Precoce",
  IN_LINEA: "In linea",
  TARDIVA: "Tardiva",
  NON_VALUTABILE: "Non valutabile",
};

export const REVIEW_LABELS: Record<string, string> = {
  BOZZA: "Bozza",
  DA_VALUTARE: "Da valutare",
  INTEGRAZIONE_RICHIESTA: "Integrazione richiesta",
  APPROVATA: "Approvata",
};

export const ACTION_LABELS: Record<string, string> = {
  ARCHIVIAZIONE: "Archiviazione",
  NUOVO_CONTROLLO: "Nuovo controllo",
  RICHIESTA_VIDEO: "Richiesta video",
  COLLOQUIO: "Colloquio (gestito da PRAMA)",
  FOLLOW_UP: "Follow-up",
};

export const FOLLOWUP_TYPE_LABELS: Record<string, string> = {
  NUOVO_CONTROLLO: "Nuovo controllo",
  VIDEO: "Video da visionare",
  COLLOQUIO: "Colloquio",
  MONITORAGGIO: "Monitoraggio",
};

export const FOLLOWUP_STATUS_LABELS: Record<string, string> = {
  APERTO: "Aperto",
  COMPLETATO: "Completato",
  ANNULLATO: "Annullato",
};

export const CONSENT_LABELS: Record<string, string> = {
  FOTO: "Foto",
  VIDEO: "Video",
  DATI: "Dati personali",
};

export const CATEGORIES = ["U13", "U14", "U15", "U16", "U17", "U18", "U19", "Juniores", "Prima squadra"];

export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Rome" }).format(new Date(d)) : "—";

export const fmtDateTime = (d: Date | string) =>
  new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(d));
