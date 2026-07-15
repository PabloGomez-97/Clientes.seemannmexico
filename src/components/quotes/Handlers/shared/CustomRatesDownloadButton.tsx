import { useEffect, useRef, useState } from "react";
import { Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import ReactDOM from "react-dom/client";
import type { BrowsableRateRow } from "./buildBrowsableRates";
import {
  buildCustomRatesFilename,
  downloadCustomRatesExcel,
} from "./customRatesExport";
import { PdfTemplateCustomRates } from "../../pdf-template/PdfTemplateCustomRates";
import {
  generateFlattenedPDF,
  preloadLogoAsDataUrl,
} from "../../pdf-template/pdfUtils";

interface CustomRatesDownloadButtonProps {
  rows: BrowsableRateRow[];
  disabled?: boolean;
  className?: string;
  /** Muestra un aviso sobrio y descartable encima del botón. */
  showHint?: boolean;
}

type DownloadFormat = "pdf" | "xlsx";

const HINT_STORAGE_KEY = "consultaTarifas.customDownload.hintDismissed";

function formatGeneratedDate(date: Date): string {
  return date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function readHintDismissed(): boolean {
  try {
    return localStorage.getItem(HINT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function CustomRatesDownloadButton({
  rows,
  disabled = false,
  className,
  showHint = false,
}: CustomRatesDownloadButtonProps) {
  const { t } = useTranslation();
  const [generating, setGenerating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(readHintDismissed);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showMenu) return;

    const handleMouseDown = (event: MouseEvent) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      if (event.target instanceof Node && wrapper.contains(event.target)) return;
      setShowMenu(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowMenu(false);
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showMenu]);

  const handleDownload = async (format: DownloadFormat) => {
    if (generating || disabled || rows.length === 0) return;

    setGenerating(true);
    setShowMenu(false);

    try {
      if (format === "xlsx") {
        downloadCustomRatesExcel(
          rows,
          buildCustomRatesFilename("xlsx", new Date()),
        );
        return;
      }

      const tempDiv = document.createElement("div");
      tempDiv.style.position = "fixed";
      tempDiv.style.top = "0";
      tempDiv.style.left = "0";
      tempDiv.style.width = "297mm";
      tempDiv.style.opacity = "0";
      tempDiv.style.pointerEvents = "none";
      tempDiv.style.zIndex = "-1";
      document.body.appendChild(tempDiv);

      try {
        const logoDataUrl = await preloadLogoAsDataUrl("/logo.png");
        const generatedDate = formatGeneratedDate(new Date());
        const root = ReactDOM.createRoot(tempDiv);

        await new Promise<void>((resolve) => {
          root.render(
            <PdfTemplateCustomRates
              rows={rows}
              generatedDate={generatedDate}
              logoSrc={logoDataUrl}
            />,
          );
          setTimeout(resolve, 600);
        });

        const pdfElement = tempDiv.querySelector("#pdf-content") as HTMLElement;
        if (!pdfElement) {
          throw new Error("PDF element not found");
        }

        await generateFlattenedPDF({
          filename: buildCustomRatesFilename("pdf", new Date()),
          element: pdfElement,
          orientation: "landscape",
          pageSelector: ".pdf-sheet",
        });

        root.unmount();
      } finally {
        document.body.removeChild(tempDiv);
      }
    } catch (err) {
      console.error("Error al generar descarga personalizada de tarifas:", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div
      className={`qa-country-rates-download ct-custom-download${className ? ` ${className}` : ""}`}
      ref={wrapperRef}
    >
      {showHint && !hintDismissed ? (
        <div className="ct-custom-download__hint" role="note">
          <p className="ct-custom-download__hint-text">
            {t("consultaTarifas.customDownload.hint")}
          </p>
          <button
            type="button"
            className="ct-custom-download__hint-close"
            onClick={() => {
              setHintDismissed(true);
              try {
                localStorage.setItem(HINT_STORAGE_KEY, "1");
              } catch {
                /* ignore */
              }
            }}
            aria-label={t("consultaTarifas.customDownload.hintDismiss")}
          >
            <i className="bi bi-x" aria-hidden />
          </button>
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline-secondary"
        size="sm"
        className="qa-btn qa-btn-outline qa-country-rates-download-btn"
        onClick={() => {
          if (generating || disabled || rows.length === 0) return;
          setShowMenu((v) => !v);
        }}
        disabled={disabled || generating || rows.length === 0}
        title={
          rows.length === 0
            ? t("consultaTarifas.customDownload.empty")
            : undefined
        }
        aria-expanded={showMenu}
        aria-haspopup="menu"
      >
        {generating ? (
          <>
            <span
              className="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden
            />
            {t("consultaTarifas.customDownload.generating")}
          </>
        ) : (
          <>
            <i className="bi bi-sliders me-1" aria-hidden />
            {t("consultaTarifas.customDownload.button")}
            <i className="bi bi-caret-down-fill ms-2" aria-hidden />
          </>
        )}
      </Button>

      {showMenu ? (
        <div className="qa-country-rates-download-popover" role="menu">
          <div className="qa-country-rates-download-title">
            {t("consultaTarifas.customDownload.menuTitle")}
          </div>

          <button
            type="button"
            className="qa-country-rates-download-item"
            role="menuitem"
            onClick={() => void handleDownload("pdf")}
          >
            <span className="qa-country-rates-download-item__icon">
              <i className="bi bi-file-earmark-pdf" aria-hidden />
            </span>
            <span className="qa-country-rates-download-item__text">
              <span className="qa-country-rates-download-item__label">
                {t("consultaTarifas.customDownload.pdf")}
              </span>
              <span className="qa-country-rates-download-item__desc">
                {t("consultaTarifas.customDownload.pdfDesc", {
                  count: rows.length,
                })}
              </span>
            </span>
            <i className="bi bi-chevron-right" aria-hidden />
          </button>

          <button
            type="button"
            className="qa-country-rates-download-item"
            role="menuitem"
            onClick={() => void handleDownload("xlsx")}
          >
            <span className="qa-country-rates-download-item__icon">
              <i className="bi bi-file-earmark-excel" aria-hidden />
            </span>
            <span className="qa-country-rates-download-item__text">
              <span className="qa-country-rates-download-item__label">
                {t("consultaTarifas.customDownload.excel")}
              </span>
              <span className="qa-country-rates-download-item__desc">
                {t("consultaTarifas.customDownload.excelDesc", {
                  count: rows.length,
                })}
              </span>
            </span>
            <i className="bi bi-chevron-right" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
