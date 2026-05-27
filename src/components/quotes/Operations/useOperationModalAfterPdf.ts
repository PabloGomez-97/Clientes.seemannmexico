import { useCallback, useEffect, useRef, useState } from "react";
import type { CrearOperacionPayload } from "../../../services/operaciones";

export const OPERATION_MODAL_DELAY_MS = 5000;

export type OperationModalContext = {
  quoteNumber: string;
  quoteId?: string;
  validUntil?: string | null;
  emailContext: CrearOperacionPayload["emailContext"];
};

/**
 * Programa la apertura del modal de operación tras descargar el PDF de cotización.
 * Espera OPERATION_MODAL_DELAY_MS antes de mostrarlo.
 */
export function useOperationModalAfterPdf() {
  const [operationModalCtx, setOperationModalCtx] =
    useState<OperationModalContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleOperationModal = useCallback((ctx: OperationModalContext) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setOperationModalCtx(ctx);
      timerRef.current = null;
    }, OPERATION_MODAL_DELAY_MS);
  }, []);

  const clearOperationModal = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOperationModalCtx(null);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    operationModalCtx,
    scheduleOperationModal,
    clearOperationModal,
  };
}
