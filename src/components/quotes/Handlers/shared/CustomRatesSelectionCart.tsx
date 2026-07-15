import { useTranslation } from "react-i18next";
import type { BrowsableRateRow } from "./buildBrowsableRates";
import {
  CUSTOM_RATE_MODE_ORDER,
  customRateSelectionKey,
  groupSelectedRatesByMode,
} from "./customRatesExport";
import { SERVICE_SUFFIX_LABELS } from "./countryRatesTypes";
import { CustomRatesDownloadButton } from "./CustomRatesDownloadButton";

interface CustomRatesSelectionCartProps {
  selectedRows: BrowsableRateRow[];
  onRemove: (row: BrowsableRateRow) => void;
  onClear: () => void;
}

export function CustomRatesSelectionCart({
  selectedRows,
  onRemove,
  onClear,
}: CustomRatesSelectionCartProps) {
  const { t } = useTranslation();
  const grouped = groupSelectedRatesByMode(selectedRows);

  if (selectedRows.length === 0) return null;

  return (
    <section className="ct-cart" aria-label={t("consultaTarifas.customDownload.cartTitle")}>
      <div className="ct-cart__header">
        <div className="ct-cart__heading">
          <h3 className="ct-cart__title">
            {t("consultaTarifas.customDownload.cartTitle")}
          </h3>
          <p className="ct-cart__subtitle">
            {t("consultaTarifas.customDownload.cartSubtitle", {
              count: selectedRows.length,
            })}
          </p>
        </div>
        <div className="ct-cart__actions">
          <CustomRatesDownloadButton rows={selectedRows} />
          <button
            type="button"
            className="ct-cart__clear"
            onClick={onClear}
          >
            {t("consultaTarifas.customDownload.clearAll")}
          </button>
        </div>
      </div>

      <div className="ct-cart__groups">
        {CUSTOM_RATE_MODE_ORDER.map((mode) => {
          const rows = grouped[mode];
          if (rows.length === 0) return null;

          return (
            <div key={mode} className="ct-cart__group">
              <div className="ct-cart__group-header">
                <span className={`ct-cart__badge ct-cart__badge--${mode}`}>
                  {SERVICE_SUFFIX_LABELS[mode]}
                </span>
                <span className="ct-cart__group-count">
                  {t("consultaTarifas.customDownload.groupCount", {
                    count: rows.length,
                  })}
                </span>
              </div>
              <div className="ct-cart__table-wrap">
                <table className="ct-cart__table">
                  <thead>
                    <tr>
                      <th>{t("consultaTarifas.customDownload.colOrigin")}</th>
                      <th>{t("consultaTarifas.customDownload.colDestination")}</th>
                      <th>{t("consultaTarifas.customDownload.colCarrier")}</th>
                      <th>{t("consultaTarifas.customDownload.colValidity")}</th>
                      <th className="ct-cart__th-actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={customRateSelectionKey(row)}>
                        <td>{row.origin}</td>
                        <td>{row.destination}</td>
                        <td>{row.carrier ?? "—"}</td>
                        <td>{row.validUntil}</td>
                        <td className="ct-cart__td-actions">
                          <button
                            type="button"
                            className="ct-cart__remove"
                            onClick={() => onRemove(row)}
                            aria-label={t(
                              "consultaTarifas.customDownload.remove",
                            )}
                          >
                            <i className="bi bi-x-lg" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
