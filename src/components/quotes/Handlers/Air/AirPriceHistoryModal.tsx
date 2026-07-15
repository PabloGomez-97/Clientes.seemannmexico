import { useState } from "react";
import { Modal, Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { AirPriceHistoryCharts } from "./AirPriceHistoryCharts";
import type { AirPriceHistorySeriesResult } from "./HandlerQuoteAirHistorical";

interface AirPriceHistoryModalProps {
  originLabel: string;
  destinationLabel: string;
  loading: boolean;
  error: string | null;
  seriesResult: AirPriceHistorySeriesResult | null;
}

export function AirPriceHistoryModal({
  originLabel,
  destinationLabel,
  loading,
  error,
  seriesResult,
}: AirPriceHistoryModalProps) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline-secondary"
        size="sm"
        className="qa-btn qa-btn-outline qa-price-history-open-btn"
        onClick={() => setShow(true)}
      >
        <i className="bi bi-graph-up-arrow me-1" aria-hidden />
        {t("QuoteAIR.priceHistoryOpen")}
      </Button>

      <Modal
        show={show}
        onHide={() => setShow(false)}
        size="xl"
        centered
        scrollable
        className="qa-price-history-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center gap-2">
            <i className="bi bi-graph-up-arrow" aria-hidden />
            {t("QuoteAIR.priceHistoryTitle")}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="qa-price-history-modal-route">
            {originLabel} → {destinationLabel}
          </p>
          <AirPriceHistoryCharts
            loading={loading}
            error={error}
            seriesResult={seriesResult}
            embedded
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            className="qa-btn qa-btn-outline"
            onClick={() => setShow(false)}
          >
            {t("QuoteAIR.priceHistoryClose")}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
