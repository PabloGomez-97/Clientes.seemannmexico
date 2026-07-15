import { useEffect, useRef, useState } from "react";
import { Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import ReactDOM from "react-dom/client";
import { PdfTemplateCountryRates } from "../../pdf-template/PdfTemplateCountryRates";
import {
  formatDateForFilename,
  generateFlattenedPDF,
  preloadLogoAsDataUrl,
} from "../../pdf-template/pdfUtils";
import {
  SERVICE_FILENAME_LABELS,
  SERVICE_SUFFIX_LABELS,
  type CountryRateColumn,
  type CountryRateRow,
  type CountryRateService,
} from "./countryRatesTypes";

interface CountryRatesDownloadButtonProps {
  service: CountryRateService;
  countryCode: string;
  countryLabel: string;
  destinationLabel?: string;
  destinationCode?: string;
  selectedOriginLabel?: string;
  columns: CountryRateColumn[];
  rows: CountryRateRow[];
  translationNs: "QuoteAIR" | "Quotefcl" | "Quotelcl";
  disabled?: boolean;
}

type CountryRatesDownloadScope = "full" | "route";

function formatGeneratedDate(date: Date): string {
  return date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function CountryRatesDownloadButton({
  service,
  countryCode,
  countryLabel,
  destinationLabel,
  destinationCode,
  selectedOriginLabel,
  columns,
  rows,
  translationNs,
  disabled = false,
}: CountryRatesDownloadButtonProps) {
  const { t } = useTranslation();
  const [generating, setGenerating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
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

  const handleDownload = async (scope: CountryRatesDownloadScope) => {
    if (generating || disabled || rows.length === 0) return;

    setGenerating(true);
    setShowMenu(false);

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

      const routeRows =
        scope === "route" && selectedOriginLabel
          ? rows.filter(
            (r) =>
              r.origin.trim().toLowerCase() ===
              selectedOriginLabel.trim().toLowerCase(),
          )
          : rows;

      await new Promise<void>((resolve) => {
        root.render(
          <PdfTemplateCountryRates
            countryLabel={countryLabel}
            serviceSuffix={SERVICE_SUFFIX_LABELS[service]}
            destinationLabel={destinationLabel}
            selectedOriginLabel={selectedOriginLabel}
            service={service}
            generatedDate={generatedDate}
            columns={columns}
            rows={routeRows}
            logoSrc={logoDataUrl}
            includeLegal={scope !== "route"}
          />,
        );
        setTimeout(resolve, 600);
      });

      const pdfElement = tempDiv.querySelector("#pdf-content") as HTMLElement;
      if (!pdfElement) {
        throw new Error("PDF element not found");
      }

      const countryClean = countryCode.replace(/[^a-zA-Z0-9]/g, "_");
      const destinationClean = destinationCode
        ? `_${destinationCode.replace(/[^a-zA-Z0-9]/g, "_")}`
        : "";
      const originClean = selectedOriginLabel
        ? `_${selectedOriginLabel.replace(/[^a-zA-Z0-9]/g, "_")}`
        : "";
      const serviceLabel = SERVICE_FILENAME_LABELS[service];
      const filename =
        scope === "route"
          ? `Tarifas_${countryClean}${destinationClean}${originClean}_${serviceLabel}_${formatDateForFilename(new Date())}.pdf`
          : `Tarifas_${countryClean}${destinationClean}_${serviceLabel}_${formatDateForFilename(new Date())}.pdf`;

      await generateFlattenedPDF({
        filename,
        element: pdfElement,
        orientation: "landscape",
        pageSelector: ".pdf-sheet",
      });

      root.unmount();
    } catch (err) {
      console.error("Error al generar PDF de tarifas por país:", err);
    } finally {
      document.body.removeChild(tempDiv);
      setGenerating(false);
    }
  };

  const routeLabel =
    selectedOriginLabel && destinationLabel
      ? `${selectedOriginLabel} → ${destinationLabel}`
      : destinationLabel ?? countryLabel;

  const fullDesc = destinationLabel
    ? t(`${translationNs}.downloadCountryRatesFullDesc`, {
      destination: destinationLabel,
    })
    : undefined;

  return (
    <div className="qa-country-rates-download" ref={wrapperRef}>
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
            ? t(`${translationNs}.downloadCountryRatesEmpty`)
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
            {t(`${translationNs}.downloadCountryRatesGenerating`)}
          </>
        ) : (
          <>
            <i className="bi bi-download me-1" aria-hidden />
            {t(`${translationNs}.downloadCountryRates`)}
            <i className="bi bi-caret-down-fill ms-2" aria-hidden />
          </>
        )}
      </Button>

      {showMenu ? (
        <div className="qa-country-rates-download-popover" role="menu">
          <div className="qa-country-rates-download-title">
            {t(`${translationNs}.downloadCountryRatesMenuTitle`)}
          </div>

          <button
            type="button"
            className="qa-country-rates-download-item"
            role="menuitem"
            onClick={() => void handleDownload("route")}
          >
            <span className="qa-country-rates-download-item__icon">
              <i className="bi bi-signpost-split" aria-hidden />
            </span>
            <span className="qa-country-rates-download-item__text">
              <span className="qa-country-rates-download-item__label">
                {t(`${translationNs}.downloadCountryRatesRoute`, {
                  route: routeLabel,
                })}
              </span>
              <span className="qa-country-rates-download-item__desc">
                {t(`${translationNs}.downloadCountryRatesRouteDesc`)}
              </span>
            </span>
            <i className="bi bi-chevron-right" aria-hidden />
          </button>

          <button
            type="button"
            className="qa-country-rates-download-item"
            role="menuitem"
            onClick={() => void handleDownload("full")}
          >
            <span className="qa-country-rates-download-item__icon">
              <i className="bi bi-collection" aria-hidden />
            </span>
            <span className="qa-country-rates-download-item__text">
              <span className="qa-country-rates-download-item__label">
                {t(`${translationNs}.downloadCountryRatesFull`)}
              </span>
              <span className="qa-country-rates-download-item__desc">
                {fullDesc ?? " "}
              </span>
            </span>
            <i className="bi bi-chevron-right" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
