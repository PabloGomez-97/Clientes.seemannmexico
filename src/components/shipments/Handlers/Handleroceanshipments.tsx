import { useState } from "react";

export interface OceanShipment {
  id?: number;
  number?: string;
  operationFlow?: string;
  shipmentType?: string;
  currentFlow?: string;
  departure?: string;
  arrival?: string;
  portOfLoading?: string;
  portOfUnloading?: string;
  placeOfDelivery?: string;
  finalDestination?: string;
  vessel?: string;
  voyage?: string;
  carrier?: string;
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
  typeOfMove?: string;
  totalCargo_Pieces?: number;
  totalCargo_WeightDisplayValue?: string;
  totalCargo_VolumeDisplayValue?: string;
  totalCharge_IncomeDisplayValue?: string;
  totalCharge_ExpenseDisplayValue?: string;
  totalCharge_ProfitDisplayValue?: string;
  createdOn?: string;
  hazardous?: boolean;
  containerized?: boolean;
  quoteNumber?: string;
  customsReleased?: boolean;
  freightReleased?: boolean;
  podDelivery?: string;
  entryNumber?: string;
  itNumber?: string;
  amsNumber?: string;
  broker?: string;
  notes?: string;
  [key: string]: any;
}

export interface OutletContext {
  accessToken: string;
  refreshAccessToken: () => Promise<string>;
  onLogout: () => void;
}

export interface Quote {
  id?: string | number;
  number?: string;
  date?: string;
  validUntil_Date?: string;
  transitDays?: number;
  customerReference?: string;
  origin?: string;
  destination?: string;
  shipper?: string;
  consignee?: string;
  totalCargo_Pieces?: number;
  totalCargo_WeightDisplayValue?: string;
  totalCargo_VolumeDisplayValue?: string;
  totalCharge_IncomeDisplayValue?: string;
  notes?: string;
  [key: string]: any;
}

export function OceanShipmentTimeline({
  shipment,
}: {
  shipment: OceanShipment;
}) {
  const getTimelineSteps = () => {
    const steps = [
      {
        label: "En Puerto",
        date: shipment.portOfLoading,
        completed: !!shipment.portOfLoading,
        icon: "⚓",
      },
      {
        label: "En Tránsito",
        date: shipment.departure,
        completed: !!shipment.departure,
        icon: "🚢",
      },
      {
        label: "Arribado",
        date: shipment.arrival,
        completed:
          !!shipment.arrival && new Date(shipment.arrival) <= new Date(),
        icon: "📦",
      },
      {
        label: "Aduana",
        date: shipment.entryNumber || shipment.itNumber,
        completed: shipment.customsReleased || !!shipment.entryNumber,
        icon: "🛃",
      },
      {
        label: "Entregado",
        date: shipment.podDelivery,
        completed: !!shipment.podDelivery,
        icon: "✅",
      },
    ];
    return steps;
  };

  const steps = getTimelineSteps();
  const completedSteps = steps.filter((s) => s.completed).length;

  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "#f9fafb",
        borderRadius: "8px",
        marginBottom: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h6
          style={{
            margin: 0,
            color: "#1f2937",
            fontSize: "0.9rem",
            fontWeight: "600",
          }}
        >
          Estado del Envío
        </h6>
        <span
          style={{
            backgroundColor: completedSteps === 5 ? "#10b981" : "#3b82f6",
            color: "white",
            padding: "4px 12px",
            borderRadius: "12px",
            fontSize: "0.75rem",
            fontWeight: "600",
          }}
        >
          {completedSteps === 5 ? "Entregado" : "En Proceso"}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          position: "relative",
        }}
      >
        {/* Línea de fondo */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "5%",
            right: "5%",
            height: "2px",
            backgroundColor: "#e5e7eb",
            zIndex: 0,
          }}
        />

        {/* Línea de progreso */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "5%",
            width: `${((completedSteps - 1) / 4) * 90}%`,
            height: "2px",
            backgroundColor: "#3b82f6",
            zIndex: 0,
            transition: "width 0.3s ease",
          }}
        />

        {steps.map((step, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
              zIndex: 1,
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: step.completed ? "#3b82f6" : "#e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
                marginBottom: "8px",
                transition: "all 0.3s ease",
                boxShadow: step.completed
                  ? "0 2px 8px rgba(59, 130, 246, 0.3)"
                  : "none",
              }}
            >
              {step.icon}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: "600",
                color: step.completed ? "#1f2937" : "#9ca3af",
                textAlign: "center",
                marginBottom: "4px",
              }}
            >
              {step.label}
            </div>
            {step.date &&
              typeof step.date === "string" &&
              step.date.includes("/") && (
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "#6b7280",
                    textAlign: "center",
                  }}
                >
                  {step.date}
                </div>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function OceanRouteDisplay({ shipment }: { shipment: OceanShipment }) {
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
        🚢 Ruta Marítima
      </h6>

      {/* Ruta Principal: Puerto → Puerto */}
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
            Puerto de Carga
          </div>
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: "700",
              color: "#1f2937",
            }}
          >
            {shipment.portOfLoading || "N/A"}
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
          <div
            style={{
              fontSize: "1.5rem",
              color: "#3b82f6",
            }}
          >
            →
          </div>
          {shipment.typeOfMove && (
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
              {shipment.typeOfMove}
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
            Puerto de Descarga
          </div>
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: "700",
              color: "#1f2937",
            }}
          >
            {shipment.portOfUnloading || "N/A"}
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
        {shipment.vessel && (
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
              Embarcación
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "#1f2937",
                fontWeight: "600",
              }}
            >
              {shipment.vessel}
            </div>
            {shipment.voyage && (
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#6b7280",
                  marginTop: "2px",
                }}
              >
                Viaje: {shipment.voyage}
              </div>
            )}
          </div>
        )}

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
              Carrier
            </div>
            <div style={{ fontSize: "0.85rem", color: "#1f2937" }}>
              {shipment.carrier}
            </div>
          </div>
        )}

        {shipment.placeOfDelivery && (
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
              Lugar de Entrega
            </div>
            <div style={{ fontSize: "0.85rem", color: "#1f2937" }}>
              {shipment.placeOfDelivery}
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

export function InfoField({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: any;
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
          textTransform: "uppercase",
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
          wordBreak: "break-word",
        }}
      >
        {typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
          ? String(value)
          : value}
      </div>
    </div>
  );
}

export function QuoteModal({
  quote,
  onClose,
}: {
  quote: Quote | null;
  onClose: () => void;
}) {
  if (!quote) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("es-CL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCLP = (priceString?: string) => {
    if (!priceString) return null;
    const numberMatch = priceString.match(/[\d.,]+/);
    if (!numberMatch) return priceString;
    const cleanNumber = numberMatch[0].replace(/,/g, "");
    const number = parseFloat(cleanNumber);
    if (isNaN(number)) return priceString;
    const formatted = new Intl.NumberFormat("es-CL").format(number);
    return `$${formatted} CLP`;
  };

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center p-3"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 10000,
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded"
        style={{
          maxWidth: "700px",
          width: "100%",
          maxHeight: "90vh",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            padding: "24px",
            color: "white",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <h5
                style={{
                  margin: 0,
                  fontSize: "1.3rem",
                  fontWeight: "700",
                  marginBottom: "4px",
                }}
              >
                Cotización #{quote.number || "N/A"}
              </h5>
              {quote.date && (
                <div style={{ fontSize: "0.9rem", opacity: 0.9 }}>
                  📅 {formatDate(quote.date)}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                border: "none",
                borderRadius: "6px",
                width: "32px",
                height: "32px",
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "white",
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div
          style={{
            padding: "24px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {/* Información de la Cotización */}
          <div style={{ marginBottom: "20px" }}>
            <h6
              style={{
                fontSize: "0.9rem",
                fontWeight: "600",
                color: "#1f2937",
                marginBottom: "12px",
              }}
            >
              📋 Información General
            </h6>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <InfoField label="Número" value={quote.number} />
              <InfoField
                label="Fecha"
                value={quote.date ? formatDate(quote.date) : null}
              />
              <InfoField label="Referencia" value={quote.customerReference} />
              <InfoField label="Días de Tránsito" value={quote.transitDays} />
              <InfoField label="Origen" value={quote.origin} fullWidth />
              <InfoField label="Destino" value={quote.destination} fullWidth />
            </div>
          </div>

          {/* Carga */}
          {(quote.totalCargo_Pieces ||
            quote.totalCargo_WeightDisplayValue ||
            quote.totalCargo_VolumeDisplayValue) && (
            <div style={{ marginBottom: "20px" }}>
              <h6
                style={{
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  color: "#1f2937",
                  marginBottom: "12px",
                }}
              >
                📦 Información de Carga
              </h6>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                <InfoField label="Piezas" value={quote.totalCargo_Pieces} />
                <InfoField
                  label="Peso"
                  value={quote.totalCargo_WeightDisplayValue}
                />
                <InfoField
                  label="Volumen"
                  value={quote.totalCargo_VolumeDisplayValue}
                />
              </div>
            </div>
          )}

          {/* Resumen Financiero */}
          {quote.totalCharge_IncomeDisplayValue && (
            <div style={{ marginBottom: "20px" }}>
              <h6
                style={{
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  color: "#1f2937",
                  marginBottom: "12px",
                }}
              >
                💰 Resumen Financiero
              </h6>
              <div
                style={{
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  borderRadius: "8px",
                  padding: "20px",
                  border: "2px solid rgba(16, 185, 129, 0.2)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "#6b7280",
                    marginBottom: "8px",
                    fontWeight: "600",
                  }}
                >
                  Gasto Parcial
                </div>
                <div
                  style={{
                    fontSize: "1.8rem",
                    fontWeight: "700",
                    color: "#10b981",
                  }}
                >
                  {formatCLP(quote.totalCharge_IncomeDisplayValue) || "$0 CLP"}
                </div>
              </div>
            </div>
          )}

          {/* Notas */}
          {quote.notes && quote.notes !== "N/A" && (
            <div>
              <h6
                style={{
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  color: "#1f2937",
                  marginBottom: "12px",
                }}
              >
                📝 Notas
              </h6>
              <div
                style={{
                  padding: "12px",
                  backgroundColor: "#fffbeb",
                  borderRadius: "6px",
                  border: "1px solid #fde047",
                  color: "#713f12",
                  fontSize: "0.875rem",
                  whiteSpace: "pre-wrap",
                }}
              >
                {quote.notes}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e5e7eb",
            backgroundColor: "#f9fafb",
          }}
        >
          <button
            onClick={onClose}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "10px 24px",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "600",
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
