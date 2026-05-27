import React, { useState, useEffect } from "react";
import TarifarioAereo from "../Proveedores/TarifarioAereo";
import TarifarioFCL from "../Proveedores/TarifarioFCL";
import TarifarioLCL from "../Proveedores/TarifarioLCL";
import { useAuth } from "../../auth/AuthContext";
import { useTranslation } from "react-i18next";
import "../Sidebar/styles/Cotizador.css";

type TipoTarifa = "AEREO" | "FCL" | "LCL" | null;

interface Proveedor {
  id: string;
  nombre: string;
  email: string;
}

const serviceTypes = [
  { key: "AEREO" as const, icon: "fa fa-plane" },
  { key: "FCL" as const, icon: "fa fa-ship" },
  { key: "LCL" as const, icon: "fa fa-cubes" },
] as const;

const typeLabels: Record<
  string,
  { title: string; badge: string; description: string; features: string[] }
> = {
  AEREO: {
    title: "Tarifas Aéreas",
    badge: "AIR",
    description:
      "Gestiona tarifas de carga aérea por peso para todos los proveedores",
    features: [
      "Tarifas por rango de peso",
      "Carriers y frecuencias",
      "Local charges y gastos",
    ],
  },
  FCL: {
    title: "Tarifas FCL",
    badge: "FCL",
    description:
      "Gestiona tarifas de contenedor completo de todos los proveedores",
    features: [
      "Contenedores 20GP, 40HQ, 40NOR",
      "Free time y remarks",
      "Carriers y transit time",
    ],
  },
  LCL: {
    title: "Tarifas LCL",
    badge: "LCL",
    description:
      "Gestiona tarifas de carga consolidada de todos los proveedores",
    features: [
      "Tarifas OF W/M",
      "Servicios y frecuencias",
      "Agentes y operadores",
    ],
  },
};

const GestorTarifas: React.FC = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [tipoTarifa, setTipoTarifa] = useState<TipoTarifa>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [selectedProveedor, setSelectedProveedor] = useState<string>("");

  useEffect(() => {
    const fetchProveedores = async () => {
      try {
        const response = await fetch("/api/admin/ejecutivos", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          const provs = data.ejecutivos
            .filter((e: any) => e.activo && e.roles?.proveedor)
            .map((e: any) => ({
              id: e.id || e._id,
              nombre: e.nombre,
              email: e.email,
            }));
          setProveedores(provs);
        }
      } catch (err) {
        console.error("Error al cargar proveedores:", err);
      }
    };
    fetchProveedores();
  }, [token]);

  const handleSeleccionTipo = (tipo: TipoTarifa) => {
    setTipoTarifa(tipo);
    setSelectedProveedor("");
  };

  const handleVolver = () => {
    setTipoTarifa(null);
    setSelectedProveedor("");
  };

  // ── Selection View ──
  if (tipoTarifa === null) {
    return (
      <div className="cotizador-page">
        <div className="cotizador-container">
          <div className="cotizador-header">
            <h1>Gestión de Tarifas</h1>
            <p>
              Administra tarifas aéreas, FCL y LCL en nombre de los proveedores
            </p>
          </div>

          <div className="cotizador-grid">
            {serviceTypes.map(({ key, icon }) => {
              const info = typeLabels[key];
              return (
                <div
                  key={key}
                  className="cotizador-card"
                  onClick={() => handleSeleccionTipo(key)}
                >
                  <span className="cotizador-card__indicator" />

                  <div className="cotizador-card__header">
                    <div className="cotizador-card__icon">
                      <i className={icon} />
                    </div>
                    <h2 className="cotizador-card__title">{info.title}</h2>
                    <span className="cotizador-card__badge">{info.badge}</span>
                  </div>

                  <p className="cotizador-card__desc">{info.description}</p>

                  <ul className="cotizador-card__features">
                    {info.features.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>

                  <button
                    className="cotizador-card__btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSeleccionTipo(key);
                    }}
                  >
                    Gestionar {info.title}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Tariff Form View ──
  const activeInfo = typeLabels[tipoTarifa];

  return (
    <div className="cotizador-page cotizador-page--form">
      <div className="cotizador-container cotizador-container--form">
        <button
          className="cotizador-back cotizador-back--form"
          onClick={handleVolver}
        >
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
            <path
              fillRule="evenodd"
              d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5z"
            />
          </svg>
          Volver a selección
        </button>

        {/* Provider selector */}
        <div
          style={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: "20px 28px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i
              className="fa fa-user-tie"
              style={{ color: "#6b7280", fontSize: 16 }}
            />
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#374151",
                fontFamily: '"Inter", system-ui, sans-serif',
              }}
            >
              Agregar tarifa en nombre de:
            </span>
          </div>
          <select
            value={selectedProveedor}
            onChange={(e) => setSelectedProveedor(e.target.value)}
            style={{
              fontFamily: '"Inter", system-ui, sans-serif',
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
              color: "#1f2937",
              backgroundColor: "#fff",
              minWidth: 240,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">-- Seleccionar proveedor --</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.nombre}>
                {p.nombre}
              </option>
            ))}
          </select>
          {selectedProveedor && (
            <span
              style={{
                fontSize: 13,
                color: "#059669",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <i className="fa fa-check-circle" /> {selectedProveedor}
            </span>
          )}
        </div>

        <div className="cotizador-quote-container cotizador-quote-container--form">
          {tipoTarifa === "AEREO" && (
            <TarifarioAereo
              key={`aereo-${selectedProveedor}`}
              proveedorNombreOverride={selectedProveedor || undefined}
            />
          )}
          {tipoTarifa === "FCL" && (
            <TarifarioFCL
              key={`fcl-${selectedProveedor}`}
              proveedorNombreOverride={selectedProveedor || undefined}
            />
          )}
          {tipoTarifa === "LCL" && (
            <TarifarioLCL
              key={`lcl-${selectedProveedor}`}
              proveedorNombreOverride={selectedProveedor || undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default GestorTarifas;
