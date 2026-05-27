import { useState } from "react";

/* ============================================================
   INTERFACES
   ============================================================ */

export interface GroundShipment {
  id?: number;
  number?: string;
  operationFlow?: string;
  shipmentType?: string;
  shipmentClass?: string;
  currentFlow?: string;
  departure?: string;
  arrival?: string;
  from?: string;
  to?: string;
  finalDestination?: string;
  carrier?: string;
  truckNumber?: string;
  trackingNumber?: string;
  proNumber?: string;
  driver?: string;
  bookingNumber?: string;
  waybillNumber?: string;
  containerNumber?: string;
  consignee?: string;
  consigneeId?: number;
  consigneeAddress?: string;
  shipper?: string;
  shipperAddress?: string;
  customer?: string;
  customerReference?: string;
  salesRep?: string;
  accountingStatus?: string;
  cargoDescription?: string;
  cargoStatus?: string;
  rateCategory?: string;
  totalCargo_Pieces?: number;
  totalCargo_WeightDisplayValue?: string;
  totalCargo_VolumeDisplayValue?: string;
  totalCharge_IncomeDisplayValue?: string;
  totalCharge_ExpenseDisplayValue?: string;
  totalCharge_ProfitDisplayValue?: string;
  createdOn?: string;
  hazardous?: boolean;
  customsReleased?: boolean;
  freightReleased?: boolean;
  paymentType?: string;
  declaredValue?: number;
  pallets?: number;
  notes?: string;
  entryNumber?: string;
  itNumber?: string;
  broker?: string;
  [key: string]: string | number | boolean | undefined;
}

/* ============================================================
   ROUTE DISPLAY  —  Origen → Destino
   ============================================================ */

export function GroundRouteDisplay({ shipment }: { shipment: GroundShipment }) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "#f9fafb",
        borderRadius: "8px",
        marginBottom: "20px",
      }}
    >
      <h6
        style={{
          margin: 0,
          color: "#1f2937",
          fontSize: "0.9rem",
          fontWeight: "600",
          marginBottom: "16px",
        }}
      >
        🚛 Ruta Terrestre
      </h6>

      {/* Ruta Principal: Origen → Destino */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "20px",
          padding: "16px",
          backgroundColor: "white",
          borderRadius: "8px",
          border: "2px solid #3b82f6",
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: "600",
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "4px",
            }}
          >
            Origen
          </div>
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: "700",
              color: "#1f2937",
            }}
          >
            {shipment.from || "N/A"}
          </div>
          {shipment.departure && (
            <div
              style={{
                fontSize: "0.75rem",
                color: "#6b7280",
                marginTop: "4px",
              }}
            >
              📅 {formatDate(shipment.departure)}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <div style={{ fontSize: "1.5rem", color: "#3b82f6" }}>→</div>
          {shipment.shipmentClass && (
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: "600",
                color: "#3b82f6",
                backgroundColor: "#dbeafe",
                padding: "2px 8px",
                borderRadius: "12px",
                whiteSpace: "nowrap",
              }}
            >
              {shipment.shipmentClass}
            </div>
          )}
        </div>

        <div style={{ flex: 1, textAlign: "right" }}>
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: "600",
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "4px",
            }}
          >
            Destino
          </div>
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: "700",
              color: "#1f2937",
            }}
          >
            {shipment.to || "N/A"}
          </div>
          {shipment.arrival && (
            <div
              style={{
                fontSize: "0.75rem",
                color: "#6b7280",
                marginTop: "4px",
              }}
            >
              📅 {formatDate(shipment.arrival)}
            </div>
          )}
        </div>
      </div>

      {/* Detalles adicionales de la ruta */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
        }}
      >
        {shipment.carrier && (
          <div
            style={{
              padding: "12px",
              backgroundColor: "white",
              borderRadius: "6px",
              border: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                fontSize: "0.7rem",
                color: "#6b7280",
                fontWeight: "600",
                marginBottom: "4px",
              }}
            >
              Transportista
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "#1f2937",
                fontWeight: "600",
              }}
            >
              {shipment.carrier}
            </div>
          </div>
        )}

        {shipment.driver && (
          <div
            style={{
              padding: "12px",
              backgroundColor: "white",
              borderRadius: "6px",
              border: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                fontSize: "0.7rem",
                color: "#6b7280",
                fontWeight: "600",
                marginBottom: "4px",
              }}
            >
              Conductor
            </div>
            <div style={{ fontSize: "0.85rem", color: "#1f2937" }}>
              {shipment.driver}
            </div>
          </div>
        )}

        {shipment.truckNumber && (
          <div
            style={{
              padding: "12px",
              backgroundColor: "white",
              borderRadius: "6px",
              border: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                fontSize: "0.7rem",
                color: "#6b7280",
                fontWeight: "600",
                marginBottom: "4px",
              }}
            >
              N° Camión
            </div>
            <div style={{ fontSize: "0.85rem", color: "#1f2937" }}>
              {shipment.truckNumber}
            </div>
          </div>
        )}

        {shipment.finalDestination && (
          <div
            style={{
              padding: "12px",
              backgroundColor: "white",
              borderRadius: "6px",
              border: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                fontSize: "0.7rem",
                color: "#6b7280",
                fontWeight: "600",
                marginBottom: "4px",
              }}
            >
              Destino Final
            </div>
            <div style={{ fontSize: "0.85rem", color: "#1f2937" }}>
              {shipment.finalDestination}
            </div>
          </div>
        )}

        {shipment.shipper && (
          <div
            style={{
              padding: "12px",
              backgroundColor: "white",
              borderRadius: "6px",
              border: "1px solid #e5e7eb",
              gridColumn: "span 2",
            }}
          >
            <div
              style={{
                fontSize: "0.7rem",
                color: "#6b7280",
                fontWeight: "600",
                marginBottom: "4px",
              }}
            >
              Remitente (Shipper)
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "#1f2937",
                fontWeight: "600",
              }}
            >
              {shipment.shipper}
            </div>
            {shipment.shipperAddress && (
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#6b7280",
                  marginTop: "4px",
                  whiteSpace: "pre-line",
                }}
              >
                {shipment.shipperAddress}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   COLLAPSIBLE SECTION
   ============================================================ */

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  icon = "📋",
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        marginBottom: "12px",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "12px 16px",
          backgroundColor: isOpen ? "#f9fafb" : "white",
          border: "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          transition: "background-color 0.2s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>{icon}</span>
          <span
            style={{ fontWeight: "600", color: "#1f2937", fontSize: "0.9rem" }}
          >
            {title}
          </span>
        </div>
        <span
          style={{
            fontSize: "1.2rem",
            color: "#6b7280",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div style={{ padding: "16px", backgroundColor: "white" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   INFO FIELD
   ============================================================ */

export function InfoField({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: string | number | boolean | undefined | null;
  fullWidth?: boolean;
}) {
  if (value === null || value === undefined || value === "" || value === "N/A")
    return null;

  return (
    <div
      style={{
        marginBottom: "12px",
        flex: fullWidth ? "1 1 100%" : "1 1 48%",
        minWidth: fullWidth ? "100%" : "200px",
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          fontWeight: "600",
          color: "#6b7280",
          textTransform: "uppercase" as const,
          letterSpacing: "0.5px",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "0.875rem",
          color: "#1f2937",
          wordBreak: "break-word" as const,
        }}
      >
        {String(value)}
      </div>
    </div>
  );
}
