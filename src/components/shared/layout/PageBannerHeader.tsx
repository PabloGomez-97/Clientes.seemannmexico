import { Trans, useTranslation } from "react-i18next";
import { imgUrl } from "../../../config/images";

export type PageBannerVariant =
  | "airShipments"
  | "oceanShipments"
  | "groundShipments"
  | "quotes"
  | "specialQuote"
  | "shippingOrder"
  | "airTracking"
  | "oceanTracking"
  | "myDocuments";

const UPPERCASE_BADGE_VARIANTS = new Set<PageBannerVariant>([
  "specialQuote",
  "shippingOrder",
  "airTracking",
  "oceanTracking",
  "myDocuments",
]);

const RICH_DESCRIPTION_VARIANTS = new Set<PageBannerVariant>([
  "airTracking",
  "oceanTracking",
]);

interface PageBannerHeaderProps {
  variant: PageBannerVariant;
  rounded?: boolean;
  className?: string;
}

export default function PageBannerHeader({
  variant,
  rounded = false,
  className,
}: PageBannerHeaderProps) {
  const { t } = useTranslation();
  const baseKey = `pageBanner.${variant}`;
  const badge = t(`${baseKey}.badge`);
  const title = t(`${baseKey}.title`);
  const isUppercaseBadge = UPPERCASE_BADGE_VARIANTS.has(variant);
  const hasRichDescription = RICH_DESCRIPTION_VARIANTS.has(variant);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        height: 220,
        overflow: "hidden",
        background: "#1a1a1a",
        ...(rounded ? { borderRadius: 12, marginBottom: 24 } : {}),
      }}
    >
      <img
        src={imgUrl("/insights1.png")}
        alt={badge}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.75,
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to right, rgba(26,26,26,0.85) 0%, rgba(26,26,26,0.35) 100%)",
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-block",
              background: "var(--primary-color)",
              color: "#fff",
              fontSize: 11,
              fontWeight: isUppercaseBadge ? 700 : 600,
              letterSpacing: isUppercaseBadge ? 1.2 : "0.06em",
              textTransform: isUppercaseBadge ? "uppercase" : "none",
              padding: "3px 10px",
              borderRadius: 3,
              marginBottom: 10,
            }}
          >
            {badge}
          </div>
          <h2
            style={{
              color: "#fff",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: isUppercaseBadge ? undefined : "-0.02em",
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {title}
          </h2>
          <div
            style={{
              color: "rgba(255,255,255,0.78)",
              fontSize: 14,
              letterSpacing: isUppercaseBadge ? undefined : "0.01em",
              margin: "8px 0 0",
              maxWidth: 460,
            }}
          >
            {hasRichDescription ? (
              <Trans
                i18nKey={`${baseKey}.description`}
                components={{
                  p: <p style={{ margin: "0 0 8px" }} />,
                  strong: <strong />,
                  highlight: <strong style={{ color: "#ff6200" }} />,
                }}
              />
            ) : (
              <p style={{ margin: 0 }}>{t(`${baseKey}.description`)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
