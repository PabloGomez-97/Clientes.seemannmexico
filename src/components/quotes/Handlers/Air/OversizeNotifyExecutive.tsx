import React, { useState } from "react";
import { useTranslation } from "react-i18next";

export type OversizeReason =
  | "oversize"
  | "no-apta-aereo"
  | "vuelo-carguero"
  | "oversize-maritimo";

interface OversizeNotifyExecutiveProps {
  /** Active reasons for the alert */
  reasons: OversizeReason[];
  /** Loading state */
  loading: boolean;
  /** Callback when user clicks "Notify my executive" */
  onNotify: () => Promise<void>;
  /** Whether the shipment data has been filled in (origin, destination, pieces, etc.) */
  hasMinimumData: boolean;
}

/**
 * Component shown below the quote/operation generators when the cargo triggers
 * an oversize, height-error, or cargo-flight restriction. It tells the client
 * their quote requires case-by-case analysis and lets them send an email
 * notification to their assigned executive with the data they already entered.
 */
export const OversizeNotifyExecutive: React.FC<
  OversizeNotifyExecutiveProps
> = ({ reasons, loading, onNotify, hasMinimumData }) => {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  const handleClick = async () => {
    setError(false);
    try {
      await onNotify();
      setSent(true);
    } catch {
      setError(true);
    }
  };

  // Build a comma-separated list of human-readable reasons
  const reasonLabels = reasons.map((r) => t(`OversizeNotify.reason_${r}`));

  return (
    <div
      className="qa-card mb-4"
      style={{
        borderLeft: "4px solid #dc3545",
        backgroundColor: "#fff8f7",
      }}
    >
      {/* Header */}
      <div className="d-flex align-items-center gap-2 mb-3">
        <i
          className="bi bi-exclamation-triangle-fill text-danger"
          style={{ fontSize: "1.5rem" }}
        />
        <h5 className="fw-bold mb-0 text-danger">
          {t("OversizeNotify.title")}
        </h5>
      </div>

      {/* Explanation */}
      <p className="mb-2" style={{ lineHeight: 1.6 }}>
        {t("OversizeNotify.explanation")}
      </p>

      {/* Reasons badges */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {reasonLabels.map((label, idx) => (
          <span
            key={idx}
            className="badge"
            style={{
              backgroundColor: "#dc3545",
              fontSize: "0.8rem",
              padding: "0.4rem 0.7rem",
            }}
          >
            <i className="bi bi-info-circle me-1" />
            {label}
          </span>
        ))}
      </div>

      {/* Fill data reminder */}
      <div
        className="p-3 rounded mb-3"
        style={{
          backgroundColor: "#fff3cd",
          border: "1px solid #ffc107",
        }}
      >
        <div className="d-flex align-items-start gap-2">
          <i
            className="bi bi-pencil-square"
            style={{ fontSize: "1.1rem", marginTop: "2px", color: "#856404" }}
          />
          <p className="mb-0 small" style={{ color: "#856404" }}>
            {t("OversizeNotify.fillFieldsReminder")}
          </p>
        </div>
      </div>

      {/* Success message */}
      {sent && (
        <div
          className="p-3 rounded mb-3 d-flex align-items-center gap-2"
          style={{
            backgroundColor: "#d4edda",
            border: "1px solid #c3e6cb",
            color: "#155724",
          }}
        >
          <i
            className="bi bi-check-circle-fill"
            style={{ fontSize: "1.2rem" }}
          />
          <span className="fw-semibold">{t("OversizeNotify.sent")}</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          className="p-3 rounded mb-3 d-flex align-items-center gap-2"
          style={{
            backgroundColor: "#f8d7da",
            border: "1px solid #f5c6cb",
            color: "#721c24",
          }}
        >
          <i className="bi bi-x-circle-fill" style={{ fontSize: "1.2rem" }} />
          <span>{t("OversizeNotify.error")}</span>
        </div>
      )}

      {/* Notify button */}
      <button
        className="qa-btn qa-btn-primary w-100"
        style={{
          backgroundColor: sent ? "#28a745" : "#dc3545",
          borderColor: sent ? "#28a745" : "#dc3545",
          fontSize: "1rem",
          padding: "0.75rem 1.5rem",
        }}
        disabled={loading || sent || !hasMinimumData}
        onClick={handleClick}
      >
        {loading ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" />
            {t("OversizeNotify.sending")}
          </>
        ) : sent ? (
          <>
            <i className="bi bi-check-circle me-2" />
            {t("OversizeNotify.sentButton")}
          </>
        ) : (
          <>
            <i className="bi bi-envelope-fill me-2" />
            {t("OversizeNotify.notifyButton")}
          </>
        )}
      </button>

      {!hasMinimumData && !sent && (
        <small className="text-muted d-block mt-2 text-center">
          {t("OversizeNotify.missingData")}
        </small>
      )}
    </div>
  );
};
