import { ZodError } from "zod";

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

export const fail = (error: string): ActionResult<never> => ({ ok: false, error });

export function describeError(error: unknown): string {
  if (error instanceof ZodError) return error.issues.map((i) => i.message).join(" ");
  console.error(error);
  return "Operazione non riuscita. Riprovare; se il problema continua, avvisare il referente.";
}
