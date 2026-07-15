import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { MAX_QUOTE_RESEND_RECIPIENTS } from "../../services/quotePdfResend";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface QuotePdfResendCellProps {
  quoteNumber: string;
  hasPdf: boolean;
  customerReference?: string;
  ownerUsername?: string;
  token: string | null;
  onSend: (params: {
    quoteNumber: string;
    emails: string[];
    customerReference?: string;
    ownerUsername?: string;
  }) => Promise<void>;
  isSending?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
  showSuccessMessage?: boolean;
  emptyVariant?: "muted" | "table";
}

function QuotePdfResendCell({
  quoteNumber,
  hasPdf,
  customerReference,
  ownerUsername,
  token,
  onSend,
  isSending = false,
  triggerLabel,
  triggerClassName = "qv-btn qv-btn--ghost qv-resend-toggle",
  showSuccessMessage = true,
  emptyVariant = "muted",
}: QuotePdfResendCellProps) {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [emails, setEmails] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setShowModal(false);
    setEmails([""]);
    setError(null);
    setSuccessMessage(null);
  }, [quoteNumber]);

  const closeModal = () => {
    if (isSending) return;
    setShowModal(false);
    setError(null);
    setEmails([""]);
  };

  const openModal = (event: React.MouseEvent) => {
    event.stopPropagation();
    setError(null);
    setSuccessMessage(null);
    setEmails([""]);
    setShowModal(true);
  };

  const updateEmail = (index: number, value: string) => {
    setError(null);
    setEmails((prev) =>
      prev.map((email, currentIndex) =>
        currentIndex === index ? value : email,
      ),
    );
  };

  const addEmailField = () => {
    setError(null);
    setEmails((prev) => {
      if (prev.length >= MAX_QUOTE_RESEND_RECIPIENTS) return prev;
      return [...prev, ""];
    });
  };

  const removeEmailField = (index: number) => {
    setError(null);
    setEmails((prev) => {
      if (prev.length === 1) return [""];
      return prev.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const validateEmails = (): string[] | null => {
    const normalized = emails.map((email) => email.trim()).filter(Boolean);

    if (normalized.length === 0) {
      setError(t("quotesView.resendErrorNoEmails"));
      return null;
    }

    if (normalized.length > MAX_QUOTE_RESEND_RECIPIENTS) {
      setError(t("quotesView.resendErrorMaxEmails"));
      return null;
    }

    const unique = new Map<string, string>();
    for (const email of normalized) {
      if (!EMAIL_REGEX.test(email)) {
        setError(t("quotesView.resendErrorInvalid", { email }));
        return null;
      }
      const key = email.toLowerCase();
      if (unique.has(key)) {
        setError(t("quotesView.resendErrorDuplicate"));
        return null;
      }
      unique.set(key, email);
    }

    return Array.from(unique.values());
  };

  const handleSend = async () => {
    if (!token || !hasPdf || isSending) return;

    const validEmails = validateEmails();
    if (!validEmails) return;

    setError(null);

    try {
      await onSend({
        quoteNumber,
        emails: validEmails,
        customerReference,
        ownerUsername,
      });
      setShowModal(false);
      setEmails([""]);
      setSuccessMessage(t("quotesView.resendSuccess"));
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : t("quotesView.resendErrorGeneric"),
      );
    }
  };

  if (!hasPdf) {
    if (emptyVariant === "table") {
      return (
        <span style={{ color: "#d1d5db", fontSize: "11px" }}>---</span>
      );
    }

    return (
      <span className="qv-field-cell__value qv-field-cell__value--muted">—</span>
    );
  }

  const buttonLabel = triggerLabel ?? t("quotesView.resendAddRecipients");

  const modal = showModal
    ? createPortal(
        <div className="qv-overlay" onClick={closeModal}>
          <div
            className="qv-modal qv-modal--search qv-modal--resend"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="qv-resend-modal-title"
          >
            <h3 className="qv-modal__title" id="qv-resend-modal-title">
              {t("quotesView.resendModalTitle")}
            </h3>

            <p className="qv-resend-modal__subtitle">
              {t("quotesView.resendModalSubtitle")}
            </p>

            <div className="qv-resend-modal__quote">
              <span className="qv-label">{t("quotesView.quoteNumber")}</span>
              <input
                className="qv-input"
                type="text"
                value={quoteNumber}
                disabled
              />
            </div>

            <div className="qv-resend-modal__emails">
              <div className="qv-resend-modal__emails-header">
                <label className="qv-label" style={{ marginBottom: 0 }}>
                  {t("quotesView.resendModalEmailsLabel")}
                </label>
                <button
                  type="button"
                  className="qv-btn qv-btn--ghost qv-btn--sm"
                  onClick={addEmailField}
                  disabled={
                    emails.length >= MAX_QUOTE_RESEND_RECIPIENTS || isSending
                  }
                  aria-label={t("quotesView.resendAddEmail")}
                >
                  +
                </button>
              </div>
              <div className="qv-resend-emails">
                {emails.map((email, index) => (
                  <div
                    key={`resend-email-${index}`}
                    className="qv-resend-email-row"
                  >
                    <input
                      className="qv-input"
                      type="email"
                      value={email}
                      onChange={(event) =>
                        updateEmail(index, event.target.value)
                      }
                      placeholder={t("quotesView.resendEmailPlaceholder", {
                        index: index + 1,
                      })}
                      disabled={isSending}
                    />
                    <button
                      type="button"
                      className="qv-btn qv-btn--ghost qv-btn--sm"
                      onClick={() => removeEmailField(index)}
                      disabled={emails.length === 1 || isSending}
                      aria-label={t("quotesView.resendRemoveEmail")}
                    >
                      -
                    </button>
                  </div>
                ))}
              </div>
              <small className="qv-hint">{t("quotesView.resendMaxEmails")}</small>
            </div>

            {error ? <div className="qv-error">{error}</div> : null}

            <div className="qv-modal__actions">
              <button
                type="button"
                className="qv-btn qv-btn--ghost"
                onClick={closeModal}
                disabled={isSending}
              >
                {t("quotesView.close")}
              </button>
              <button
                type="button"
                className="qv-btn qv-btn--primary"
                onClick={handleSend}
                disabled={isSending || !token}
              >
                {isSending ? t("quotesView.resendSending") : t("quotesView.resendSendPdf")}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={openModal}
        disabled={isSending}
      >
        {isSending ? (
          <span
            className="spinner-border spinner-border-sm"
            style={{ width: "10px", height: "10px" }}
          />
        ) : (
          buttonLabel
        )}
      </button>
      {showSuccessMessage && successMessage ? (
        <p className="qv-resend__message qv-resend__message--success">
          {successMessage}
        </p>
      ) : null}
      {modal}
    </>
  );
}

export default QuotePdfResendCell;
