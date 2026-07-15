import { useState } from "react";
import { Modal, Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import {
  PriceHistoryCharts,
  type PriceHistoryTierConfig,
} from "./PriceHistoryCharts";
import type { PriceHistorySeriesResult } from "./priceHistoryTypes";

interface PriceHistoryModalProps {
  i18nNamespace: string;
  originLabel: string;
  destinationLabel: string;
  tiers: PriceHistoryTierConfig[];
  loading: boolean;
  error: string | null;
  seriesResult: PriceHistorySeriesResult | null;
}

export function PriceHistoryModal({
  i18nNamespace,
  originLabel,
  destinationLabel,
  tiers,
  loading,
  error,
  seriesResult,
}: PriceHistoryModalProps) {
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
        {t(`${i18nNamespace}.priceHistoryOpen`)}
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
            {t(`${i18nNamespace}.priceHistoryTitle`)}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="qa-price-history-modal-route">
            {originLabel} → {destinationLabel}
          </p>
          <PriceHistoryCharts
            i18nNamespace={i18nNamespace}
            tiers={tiers}
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
            {t(`${i18nNamespace}.priceHistoryClose`)}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
