// Standard di valutazione PRAMA v2.1 (17 attributi di movimento) e set portiere v1.
// Per ogni attributo: indicatore con i verbi d'azione e descrittori dei livelli 1, 3 e 5.
// Il 2 si colloca tra 1 e 3, il 4 tra 3 e 5. Riferimento: la categoria osservata.
import type { Attribute } from "./rating";

export interface AttributeGuide {
  indicator: string;
  levels: { 1: string; 3: string; 5: string };
}

export const ATTRIBUTE_GUIDE: Record<Attribute, AttributeGuide> = {
  controllo: {
    indicator: "Riceve orientato verso il gioco, elimina la pressione con il primo tocco, protegge palla.",
    levels: {
      1: "Riceve fermo e di spalle; il primo tocco allunga la palla o la consegna alla pressione.",
      3: "Controlla pulito senza pressione; sotto pressione serve un secondo tocco.",
      5: "Riceve già orientato, anche sul piede debole e spalle alla porta; il primo tocco elimina l'avversario.",
    },
  },
  passaggio: {
    indicator: "Trasmette con tempo, peso e linea; verticalizza, filtra, cambia gioco, rompe le linee.",
    levels: {
      1: "Passaggi imprecisi o lenti anche senza pressione; solo appoggi corti e laterali.",
      3: "Trasmette con precisione a corta e media distanza; verticalizza solo con spazio evidente.",
      5: "Trova la linea che rompe una o due linee, con peso e tempo che fanno guadagnare tempo al compagno.",
    },
  },
  tecnica: {
    indicator: "Conduce per progredire, attrae e fissa l'avversario, libera il compagno.",
    levels: {
      1: "Conduce a testa bassa, perde il controllo in velocità, non sa quando fermarsi.",
      3: "Conduce per progredire nello spazio libero; con pressione scarica.",
      5: "Conduce per attrarre e fissare l'avversario e libera il compagno al momento giusto; cambia ritmo in conduzione.",
    },
  },
  dribbling: {
    indicator: "Punta, fissa e supera l'uomo; crea superiorità numerica.",
    levels: {
      1: "Evita il duello o perde palla quasi sempre.",
      3: "Supera l'uomo quando ha spazio e campo davanti.",
      5: "Cerca e vince il duello anche in spazi stretti, crea superiorità che cambia l'azione.",
    },
  },
  finalizzazione: {
    indicator: "Attacca l'area con i tempi giusti, conclude con scelta e qualità.",
    levels: {
      1: "Non attacca l'area; conclude in modo affrettato o fuori misura.",
      3: "Si fa trovare in area sulle situazioni chiare; conclusione corretta quando è libero.",
      5: "Anticipa i tempi dell'inserimento, sceglie la conclusione in base alla situazione, conclude con qualità sotto pressione.",
    },
  },
  intelligenzaTattica: {
    indicator: "Scansiona prima di ricevere, legge pressione, spazi e coperture, anticipa.",
    levels: {
      1: "Non guarda prima di ricevere; scopre la pressione quando la palla è già arrivata.",
      3: "Scansiona nelle situazioni tranquille, raramente sotto pressione.",
      5: "Scansiona più volte prima di ogni ricezione, anche sotto pressione; sa già dove giocare.",
    },
  },
  posizionamento: {
    indicator: "Si smarca tra le linee e in ampiezza, attacca la profondità, riconosce e sfrutta i mismatch.",
    levels: {
      1: "Resta in linea di copertura o nello stesso spazio del compagno; non offre soluzioni.",
      3: "Si smarca in modo corretto ma prevedibile; attacca la profondità solo su indicazione.",
      5: "Occupa lo spazio tra le linee e i corridoi intermedi al momento giusto; individua e sfrutta il mismatch.",
    },
  },
  decisionMaking: {
    indicator: "Sceglie ed esegue in fretta sotto pressione, semplifica, rischia nei momenti giusti.",
    levels: {
      1: "Sceglie spesso l'opzione sbagliata o in ritardo; forza la giocata.",
      3: "Sceglie l'opzione sicura e la esegue; sotto pressione rallenta.",
      5: "Sceglie in fretta l'opzione più efficace, varia le soluzioni, sa quando rischiare e quando semplificare.",
    },
  },
  pressioneRiaggressione: {
    indicator: "Pressa con i compagni, riaggredisce subito dopo la palla persa, copre lo spazio alle spalle.",
    levels: {
      1: "Si ferma dopo la palla persa; pressa da solo o non pressa.",
      3: "Partecipa alla pressione organizzata; riaggredisce quando è vicino alla palla.",
      5: "Riconosce i segnali di pressione, guida i compagni, riaggredisce subito e spesso recupera palla.",
    },
  },
  unoControUnoDifensivo: {
    indicator: "Orienta l'avversario, temporizza, interviene pulito, vince i duelli, non concede il mismatch.",
    levels: {
      1: "Si fa saltare spesso, interviene in ritardo o fallosamente.",
      3: "Tiene la posizione e temporizza contro avversari di pari livello.",
      5: "Orienta l'avversario verso la zona voluta, interviene al momento giusto, neutralizza anche il mismatch sfavorevole.",
    },
  },
  velocita: {
    indicator: "Accelera nei primi metri, cambia ritmo con e senza palla. Leggere con la maturazione apparente.",
    levels: {
      1: "Perde costantemente i primi metri.",
      3: "Nella media dei pari età nei primi metri.",
      5: "Guadagna metri decisivi in partenza e nei cambi di ritmo.",
    },
  },
  resistenza: {
    indicator: "Ripete sprint e recuperi, mantiene l'intensità nel finale.",
    levels: {
      1: "Cala vistosamente dopo pochi sprint o nel secondo tempo.",
      3: "Mantiene un'intensità costante per gran parte della gara.",
      5: "Ripete sprint e recuperi fino al finale, alza l'intensità quando serve.",
    },
  },
  coordinazione: {
    indicator: "Cambia direzione in equilibrio, frena e riparte, coordina il gesto in velocità.",
    levels: {
      1: "Perde equilibrio nei cambi di direzione; gesto rigido.",
      3: "Cambia direzione con controllo a velocità media.",
      5: "Cambia direzione ad alta velocità mantenendo equilibrio e qualità del gesto.",
    },
  },
  mentalita: {
    indicator: "Resta concentrato, alza l'intensità nei momenti chiave, chiede palla sotto pressione.",
    levels: {
      1: "Si spegne quando la gara si complica; si nasconde.",
      3: "Mantiene impegno costante, cala nei momenti difficili.",
      5: "Alza il livello nei momenti decisivi, chiede palla sotto pressione, trascina.",
    },
  },
  reazioneErrori: {
    indicator: "Dopo un errore riprova, chiede di nuovo palla, non si isola.",
    levels: {
      1: "Dopo un errore si isola, protesta o non chiede più palla.",
      3: "Si riprende dopo qualche minuto.",
      5: "Reagisce con l'azione successiva: riprova, rientra, chiede palla.",
    },
  },
  lavoroDiSquadra: {
    indicator: "Comunica, aiuta il compagno in difficoltà, si sacrifica per la squadra.",
    levels: {
      1: "Gioca per sé, non comunica, non aiuta i compagni in difficoltà.",
      3: "Comunica e collabora nelle situazioni semplici.",
      5: "Organizza e sostiene i compagni, si sacrifica nei momenti difficili, rende migliori gli altri.",
    },
  },
  disciplina: {
    indicator: "Applica le indicazioni, rispetta compagni, avversari, arbitri e staff, controlla le reazioni.",
    levels: {
      1: "Proteste ricorrenti, reazioni scomposte, ignora le indicazioni.",
      3: "Rispetta regole e indicazioni; qualche reazione nei momenti di tensione.",
      5: "Applica le indicazioni con precisione, mantiene autocontrollo anche se provocato, rispetta tutti.",
    },
  },
  gkPiazzamento: {
    indicator: "Si posiziona sulla bisettrice, regola la profondità, prepara gli appoggi prima del tiro.",
    levels: {
      1: "Spesso fuori posizione, appoggi non pronti al momento del tiro.",
      3: "Posizione corretta sulle azioni frontali; in ritardo sui cambi di lato.",
      5: "Sempre in posizione e in equilibrio al tiro, anche dopo un cambio di lato rapido.",
    },
  },
  gkPresaRespinta: {
    indicator: "Blocca quando può, respinge lontano dalla porta e fuori dallo specchio quando non può.",
    levels: {
      1: "Respinge centralmente o perde palla anche su tiri semplici.",
      3: "Blocca i tiri centrali, respinge in modo sicuro quelli laterali.",
      5: "Blocca anche tiri forti, respinge sempre in zona sicura, non concede ribattute.",
    },
  },
  gkReattivita: {
    indicator: "Reagisce sui tiri ravvicinati e deviati, si distende con tecnica corretta su entrambi i lati.",
    levels: {
      1: "Reagisce in ritardo, tecnica di tuffo scomposta.",
      3: "Interviene sui tiri prevedibili con tecnica corretta.",
      5: "Neutralizza tiri ravvicinati e deviati, tuffo efficace su entrambi i lati.",
    },
  },
  gkUsciteAlte: {
    indicator: "Legge la traiettoria, decide se uscire, attacca il pallone nel punto più alto.",
    levels: {
      1: "Resta sulla linea o esce a vuoto; non controlla l'area.",
      3: "Esce sui palloni chiari e li gestisce.",
      5: "Domina l'area: legge presto, esce con decisione anche nel traffico, blocca.",
    },
  },
  gkUnoControUno: {
    indicator: "Accorcia con i tempi giusti, resta in piedi il più a lungo possibile, chiude lo specchio.",
    levels: {
      1: "Si butta presto o resta sulla linea; viene saltato facilmente.",
      3: "Accorcia correttamente sugli 1 contro 1 semplici.",
      5: "Sceglie tempi e distanza in modo ottimale, resta in piedi, induce l'errore dell'attaccante.",
    },
  },
  gkProfondita: {
    indicator: "Gioca alto dietro la linea difensiva, legge il lancio, esce fuori area per anticipare.",
    levels: {
      1: "Resta sempre in porta, lascia scoperto lo spazio alle spalle.",
      3: "Esce sui lanci evidenti.",
      5: "Gioca alto con continuità, anticipa i lanci fuori area con sicurezza.",
    },
  },
  gkGiocoPiedi: {
    indicator: "Riceve orientato sotto pressione, usa entrambi i piedi, partecipa alla costruzione dal basso.",
    levels: {
      1: "Sotto pressione calcia lungo a caso o sbaglia l'appoggio.",
      3: "Gioca corto pulito senza pressione.",
      5: "Riceve orientato sotto pressione, rompe la prima linea avversaria con il passaggio.",
    },
  },
  gkDistribuzione: {
    indicator: "Rilancia, rimette con le mani e riparte veloce verso il compagno libero.",
    levels: {
      1: "Rilanci e rimesse imprecisi, ripartenza lenta.",
      3: "Distribuzione precisa e corretta nei tempi.",
      5: "Avvia la transizione con una distribuzione rapida e precisa, corta o lunga.",
    },
  },
  gkLettura: {
    indicator: "Legge l'azione in anticipo, sceglie tra uscire e restare, tra giocare corto e lungo.",
    levels: {
      1: "Decisioni tardive o sbagliate tra uscire e restare.",
      3: "Decide correttamente nelle situazioni semplici.",
      5: "Anticipa lo sviluppo dell'azione e decide sempre in tempo.",
    },
  },
  gkComunicazione: {
    indicator: "Parla con chiarezza, sistema la linea, organizza le palle inattive.",
    levels: {
      1: "Non parla, la difesa non sa cosa fare.",
      3: "Comunica nelle situazioni principali.",
      5: "Guida la linea con continuità, organizza le palle inattive, trasmette sicurezza.",
    },
  },
  gkCompetere: {
    indicator: "Resta concentrato anche con pochi interventi, interviene con decisione nei momenti chiave.",
    levels: {
      1: "Si deconcentra nelle fasi senza interventi.",
      3: "Resta presente, cala nei momenti difficili.",
      5: "Decisivo nei momenti chiave, concentrato per tutta la gara.",
    },
  },
  gkReazioneErrore: {
    indicator: "Dopo un gol subito o un errore resta lucido, non si nasconde, chiede palla.",
    levels: {
      1: "Dopo un errore perde sicurezza per il resto della gara.",
      3: "Si riprende dopo qualche azione.",
      5: "Resta lucido e sicuro subito dopo l'errore.",
    },
  },
};

export const MISMATCH_LABELS: Record<string, string> = {
  CREATO: "Creato",
  SFRUTTATO: "Sfruttato",
  SUBITO: "Subìto",
  NON_OSSERVATO: "Non osservato",
};

export const MISMATCH_TYPE_LABELS: Record<string, string> = {
  VELOCITA: "Velocità",
  STRUTTURA_FISICA: "Struttura fisica",
  ABILITA_RUOLO: "Abilità nel ruolo",
  POSIZIONE: "Posizione",
};
