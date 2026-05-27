import { useEffect, useState } from "react";

export interface OutletContext {
  accessToken: string;
  refreshAccessToken: () => Promise<string>;
  onLogout: () => void;
}

export interface Consignee {
  id?: number;
  name?: string;
  accountNumber?: string;
  code?: string;
  email?: string;
  [key: string]: any;
}

export interface AirShipment {
  id?: string | number;
  number?: string;
  date?: string;
  consignee?: Consignee;
  origin?: { code?: string; name?: string } | null;
  destination?: { code?: string; name?: string } | null;
  executedAt?: { code?: string; name?: string } | null;
  [key: string]: any;
}

// Componente para el Timeline Visual
export function ShipmentTimeline({ shipment }: { shipment: AirShipment }) {
  const getTimelineSteps = () => {
    // Verificar si ha llegado (arrival completado)
    const hasArrived = (() => {
      if (!shipment.arrival || !shipment.arrival.displayDate) return false;
      try {
        const [month, day, year] = shipment.arrival.displayDate.split("/");
        const arrivalDate = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
        );
        return arrivalDate <= new Date();
      } catch {
        return false;
      }
    })();

    const steps = [
      {
        label: "En Tránsito",
        date: shipment.departure,
        completed: !!shipment.departure,
        icon: "✈️",
      },
      {
        label: "Llegada",
        date: shipment.arrival,
        completed: hasArrived,
        icon: "📦",
      },
    ];
    return steps;
  };

  const getProgressPercentage = () => {
    if (!shipment.departure || !shipment.arrival) return 0;

    try {
      const parseDisplayDate = (obj: any) => {
        const s = obj?.displayDate?.trim();
        if (!s) return null;

        const [m, d, y] = s.split("/");
        if (!m || !d || !y) return null;

        const date = new Date(Number(y), Number(m) - 1, Number(d));
        const time = date.getTime();
        return Number.isFinite(time) ? time : null;
      };

      const departureTime = parseDisplayDate(shipment.departure);
      const arrivalTime = parseDisplayDate(shipment.arrival);

      if (!departureTime || !arrivalTime) return 0;

      const now = Date.now();
      if (now <= departureTime) return 0;
      if (now >= arrivalTime) return 100;

      return ((now - departureTime) / (arrivalTime - departureTime)) * 100;
    } catch {
      return 0;
    }
  };

  const steps = getTimelineSteps();
  const progress = getProgressPercentage();
  const [animatedProgress, setAnimatedProgress] = useState(0);

  const completedSteps = steps.filter((s) => s.completed).length;

  useEffect(() => {
    let rafId: number;
    const durationMs = 6000;
    const start = performance.now();

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    let fromValue = 0;

    setAnimatedProgress((prev) => {
      fromValue = prev;
      return prev;
    });

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(t);

      const next = fromValue + (progress - fromValue) * eased;
      setAnimatedProgress(next);

      if (t < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [progress]);

  const progressClamped = Math.max(0, Math.min(100, animatedProgress));
  const trackStart = 5; // %
  const trackSpan = 90; // del 5% al 95% (90% de recorrido)
  const x = trackStart + (progressClamped / 100) * trackSpan; // posición del avión
  const w = (progressClamped / 100) * trackSpan; // ancho de la línea

  return (
    <div
      style={{
        padding: "20px",
        background:
          "linear-gradient(to bottom, #e0f2fe 0%, #f0f9ff 50%, #fef3c7 100%)",
        borderRadius: "8px",
        marginBottom: "20px",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
      }}
    >
      {/* Sol decorativo con rayos */}
      <div
        style={{
          position: "absolute",
          top: "15px",
          right: "30px",
          width: "50px",
          height: "50px",
          borderRadius: "50%",
          background: "radial-gradient(circle, #fbbf24 0%, #f59e0b 100%)",
          boxShadow: "0 0 30px rgba(251, 191, 36, 0.4)",
          zIndex: 0,
        }}
      >
        {/* Rayos del sol */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "80px",
            height: "80px",
            transform: "translate(-50%, -50%)",
            animation: "sunRays 20s linear infinite",
          }}
        >
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: "2px",
                height: "20px",
                backgroundColor: "#fbbf24",
                transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-30px)`,
                opacity: 0.4,
              }}
            />
          ))}
        </div>
      </div>

      {/* Estrellas pequeñas (aparecen sutilmente) */}
      {[...Array(6)].map((_, i) => (
        <div
          key={`star-${i}`}
          style={{
            position: "absolute",
            top: `${10 + i * 15}%`,
            left: `${15 + i * 12}%`,
            fontSize: "0.6rem",
            opacity: 0.3,
            animation: `twinkle ${2 + i * 0.5}s ease-in-out infinite`,
            animationDelay: `${i * 0.3}s`,
            color: "#fbbf24",
            zIndex: 0,
          }}
        >
          ✦
        </div>
      ))}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <h6
          style={{
            margin: 0,
            color: "#0f172a",
            fontSize: "0.95rem",
            fontWeight: "700",
            textShadow: "0 1px 2px rgba(255, 255, 255, 0.8)",
          }}
        >
          Estado del Envío
        </h6>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          position: "relative",
          paddingLeft: "1%",
          paddingRight: "6%",
          minHeight: "110px",
        }}
      >
        {/* Nubes grandes flotantes - múltiples capas */}
        <div
          style={{
            position: "absolute",
            top: "5px",
            left: "0",
            right: "0",
            height: "50px",
            overflow: "hidden",
            zIndex: 0,
            pointerEvents: "none",
          }}
        >
          {/* Nube 1 */}
          <div
            style={{
              position: "absolute",
              top: "5px",
              fontSize: "2rem",
              filter: "blur(0.5px)",
              animation: "cloudDrift 45s linear infinite",
            }}
          >
            ☁️
          </div>
        </div>

        {/* Pájaros volando en formación V */}
        <div
          style={{
            position: "absolute",
            top: "15px",
            left: "20%",
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "relative",
              animation: "birdsFloat 25s ease-in-out infinite",
            }}
          >
            <span
              style={{
                position: "absolute",
                fontSize: "0.7rem",
                color: "#475569",
                transform: "translate(0px, 0px)",
              }}
            >
              Ʌ
            </span>
            <span
              style={{
                position: "absolute",
                fontSize: "0.65rem",
                color: "#64748b",
                transform: "translate(-10px, 8px)",
              }}
            >
              Ʌ
            </span>
            <span
              style={{
                position: "absolute",
                fontSize: "0.6rem",
                color: "#64748b",
                transform: "translate(10px, 8px)",
              }}
            >
              Ʌ
            </span>
            <span
              style={{
                position: "absolute",
                fontSize: "0.55rem",
                color: "#94a3b8",
                transform: "translate(-18px, 16px)",
              }}
            >
              Ʌ
            </span>
            <span
              style={{
                position: "absolute",
                fontSize: "0.55rem",
                color: "#94a3b8",
                transform: "translate(18px, 16px)",
              }}
            >
              Ʌ
            </span>
          </div>
        </div>

        {/* Montañas estilizadas con capas de profundidad */}
        <div
          style={{
            position: "absolute",
            bottom: "0",
            left: "0",
            right: "0",
            height: "70px",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-around",
            paddingLeft: "3%",
            paddingRight: "3%",
            zIndex: 0,
            pointerEvents: "none",
          }}
        >
          {/* Capa de montañas lejanas (más claras) */}
          {[...Array(4)].map((_, i) => (
            <div
              key={`mountain-far-${i}`}
              style={{
                width: "0",
                height: "0",
                borderLeft: `${35 + i * 8}px solid transparent`,
                borderRight: `${35 + i * 8}px solid transparent`,
                borderBottom: `${30 + i * 10}px solid #cbd5e1`,
                animation: "mountainShimmer 8s ease-in-out infinite",
                animationDelay: `${i * 0.5}s`,
                opacity: 0.4,
              }}
            />
          ))}

          {/* Capa de montañas cercanas (más oscuras) */}
          {[...Array(3)].map((_, i) => (
            <div
              key={`mountain-near-${i}`}
              style={{
                width: "0",
                height: "0",
                borderLeft: `${40 + i * 10}px solid transparent`,
                borderRight: `${40 + i * 10}px solid transparent`,
                borderBottom: `${40 + i * 12}px solid #94a3b8`,
                animation: "mountainShimmer 6s ease-in-out infinite",
                animationDelay: `${i * 0.8}s`,
                opacity: 0.25,
                marginLeft: `${i * 60}px`,
              }}
            />
          ))}
        </div>

        {/* Línea de fondo más sutil */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "5%",
            right: "5%",
            height: "3px",
            background: "linear-gradient(to right, #e0e7ff, #dbeafe, #e0e7ff)",
            borderRadius: "2px",
            zIndex: 1,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          }}
        />

        {/* Línea de progreso con gradiente animado */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: `${trackStart}%`,
            width: `${w}%`,
            height: "3px",
            background: "linear-gradient(to right, #3b82f6, #60a5fa, #3b82f6)",
            borderRadius: "2px",
            zIndex: 2,
            boxShadow: "0 2px 8px rgba(59, 130, 246, 0.4)",
            // IMPORTANTE: quita el transition, porque ya animas con RAF
          }}
        />

        {/* Avión con animación de vuelo suave */}
        <div
          style={{
            position: "absolute",
            top: "4px",
            left: `${x}%`,
            transform: "translateX(-50%) rotate(45deg)",
            fontSize: "1.6rem",
            zIndex: 3,
            pointerEvents: "none",
            animation: "planeBounce 2s ease-in-out infinite",
            filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))",
          }}
        >
          ✈️
        </div>

        {/* Estela del avión */}
        <div
          style={{
            position: "absolute",
            top: "21px",
            left: `${trackStart + Math.max(0, w - 5)}%`,
            width: "5%",
            height: "1px",
            background:
              "linear-gradient(to right, transparent, rgba(147, 197, 253, 0.4), transparent)",
            zIndex: 1,
            pointerEvents: "none",
            opacity: animatedProgress > 5 ? 1 : 0,
          }}
        />

        {/* Steps del timeline */}
        {steps.map((step, index) => (
          <div
            key={index}
            style={{
              flex: "0 0 auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
              zIndex: 2,
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: step.completed
                  ? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
                  : "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.3rem",
                marginBottom: "10px",
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: step.completed
                  ? "0 4px 12px rgba(59, 130, 246, 0.35), 0 0 0 3px rgba(59, 130, 246, 0.1)"
                  : "0 2px 6px rgba(0, 0, 0, 0.08)",
                border: step.completed ? "none" : "2px solid white",
              }}
            >
              {step.icon}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: "700",
                color: step.completed ? "#0f172a" : "#94a3b8",
                textAlign: "center",
                marginBottom: "4px",
                textShadow: step.completed
                  ? "0 1px 2px rgba(255, 255, 255, 0.8)"
                  : "none",
                letterSpacing: "0.01em",
              }}
            >
              {step.label}
            </div>
            {step.date &&
              step.date.displayDate &&
              step.date.displayDate.trim() !== "" && (
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: step.completed ? "#475569" : "#94a3b8",
                    textAlign: "center",
                    fontWeight: "500",
                  }}
                >
                  {(() => {
                    try {
                      const [month, day, year] =
                        step.date.displayDate.split("/");
                      const date = new Date(
                        parseInt(year),
                        parseInt(month) - 1,
                        parseInt(day),
                      );
                      return date.toLocaleDateString("es-CL", {
                        day: "numeric",
                        month: "short",
                      });
                    } catch {
                      return step.date.displayDate;
                    }
                  })()}
                </div>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Componente para Secciones Colapsables
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

// Componente para mostrar un campo
export function InfoField({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: any;
  fullWidth?: boolean;
}) {
  if (value === null || value === undefined || value === "" || value === 0)
    return null;

  let displayValue: string;
  if (typeof value === "boolean") {
    displayValue = value ? "Sí" : "No";
  } else if (typeof value === "object") {
    return null;
  } else {
    displayValue = String(value);
  }

  return (
    <div
      style={{
        marginBottom: "12px",
        flex: fullWidth ? "1 1 100%" : "1 1 48%",
        minWidth: fullWidth ? "100%" : "200px",
        boxSizing: "border-box",
        overflow: "hidden",
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
          overflowWrap: "anywhere",
          whiteSpace: "normal",
          textAlign: "justify",
        }}
      >
        {displayValue}
      </div>
    </div>
  );
}

// Componente para mostrar información de commodities
export function CommoditiesSection({ commodities }: { commodities: any[] }) {
  if (!commodities || commodities.length === 0) return null;

  return (
    <div>
      {commodities.map((commodity, index) => (
        <div
          key={index}
          style={{
            padding: "12px",
            backgroundColor: "#f9fafb",
            borderRadius: "6px",
            marginBottom: index < commodities.length - 1 ? "12px" : "0",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: "600",
              color: "#3b82f6",
              marginBottom: "8px",
            }}
          >
            Ítem {index + 1}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <InfoField
              label="Descripción"
              value={commodity.description}
              fullWidth
            />
            <InfoField label="Piezas" value={commodity.pieces} />
            <InfoField
              label="Peso Total"
              value={
                commodity.totalWeightValue
                  ? `${commodity.totalWeightValue} kg`
                  : null
              }
            />
            <InfoField
              label="Volumen Total"
              value={
                commodity.totalVolumeValue
                  ? `${commodity.totalVolumeValue} m³`
                  : null
              }
            />
            <InfoField
              label="Tipo de Empaque"
              value={commodity.packageType?.description}
            />
            <InfoField label="Número PO" value={commodity.poNumber} />
            <InfoField
              label="Número de Factura"
              value={commodity.invoiceNumber}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Componente para SubShipments
export function SubShipmentsList({ subShipments }: { subShipments: any[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!subShipments || subShipments.length === 0) return null;

  return (
    <div style={{ marginTop: "16px" }}>
      <div
        style={{
          fontSize: "0.85rem",
          fontWeight: "600",
          color: "#1f2937",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span>📦</span>
        <span>Cotización ({subShipments.length})</span>
      </div>

      {subShipments.map((subShipment, index) => (
        <div
          key={index}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            marginBottom: "8px",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() =>
              setExpandedIndex(expandedIndex === index ? null : index)
            }
            style={{
              width: "100%",
              padding: "10px 12px",
              backgroundColor: expandedIndex === index ? "#f9fafb" : "white",
              border: "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "4px",
              }}
            >
              <span
                style={{
                  fontWeight: "600",
                  color: "#1f2937",
                  fontSize: "0.85rem",
                }}
              >
                {subShipment.number || `Sub-Envío ${index + 1}`}
              </span>
              {subShipment.consignee?.name && (
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  {subShipment.consignee.name}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: "1rem",
                color: "#6b7280",
                transform:
                  expandedIndex === index ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            >
              ▼
            </span>
          </button>

          {expandedIndex === index && (
            <div
              style={{
                padding: "12px",
                backgroundColor: "white",
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                <InfoField label="Número" value={subShipment.number} />
                <InfoField label="Waybill" value={subShipment.waybillNumber} />
                <InfoField
                  label="Consignatario"
                  value={subShipment.consignee?.name}
                  fullWidth
                />
                <InfoField
                  label="Dirección"
                  value={subShipment.consigneeAddress}
                  fullWidth
                />
                <InfoField label="Carrier" value={subShipment.carrier?.name} />
                <InfoField
                  label="Descripción de Carga"
                  value={subShipment.cargoDescription}
                  fullWidth
                />
                <InfoField
                  label="Piezas Manifestadas"
                  value={subShipment.manifestedPieces}
                />
                <InfoField
                  label="Peso Manifestado"
                  value={
                    subShipment.manifestedWeight
                      ? `${subShipment.manifestedWeight} kg`
                      : null
                  }
                />
                <InfoField
                  label="Referencia Cliente"
                  value={subShipment.customerReference}
                />
              </div>

              {subShipment.commodities &&
                subShipment.commodities.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: "600",
                        color: "#6b7280",
                        marginBottom: "8px",
                      }}
                    >
                      Commodities
                    </div>
                    <CommoditiesSection commodities={subShipment.commodities} />
                  </div>
                )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
