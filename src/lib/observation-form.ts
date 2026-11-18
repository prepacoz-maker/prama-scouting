// Tipi e valori iniziali della scheda: condivisi tra pagine server e modulo client.
import { ATTRIBUTES, type Attribute } from "./rating";

type RatingValues = Record<Attribute, number | null>;
export type ObservationFormValues = RatingValues & {
  athleteId: string;
  date: string;
  eventType: string;
  team: string;
  opponent: string;
  category: string;
  competition: string;
  venue: string;
  minutes: number | string;
  conditions: string;
  maturation: string;
  strengths: string;
  improvements: string;
  notes: string;
  interest: string | null;
  action: string | null;
  nextCheckSuggested: string;
  conflictOfInterest: boolean;
};

export interface AthleteOption {
  id: string;
  label: string;
  team: string;
  category: string;
}

const emptyRatings = Object.fromEntries(ATTRIBUTES.map((a) => [a, null])) as RatingValues;

export const emptyObservation = (athlete?: AthleteOption): ObservationFormValues => ({
  ...emptyRatings,
  athleteId: athlete?.id ?? "",
  date: new Date().toISOString().slice(0, 10),
  eventType: "PARTITA",
  team: athlete?.team ?? "",
  opponent: "",
  category: athlete?.category ?? "",
  competition: "",
  venue: "",
  minutes: "",
  conditions: "",
  maturation: "NON_VALUTABILE",
  strengths: "",
  improvements: "",
  notes: "",
  interest: null,
  action: null,
  nextCheckSuggested: "",
  conflictOfInterest: false,
});
