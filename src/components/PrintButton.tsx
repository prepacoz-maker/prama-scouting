"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn-primary" onClick={() => window.print()}>
      Stampa o salva in PDF
    </button>
  );
}
