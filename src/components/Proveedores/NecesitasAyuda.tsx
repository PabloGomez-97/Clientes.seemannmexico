// src/components/Proveedores/NecesitasAyuda.tsx
import { useState, useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useTranslation } from "react-i18next";
import "./styles/Homeproveedores.css";

interface Ejecutivo {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
}

export default function NecesitasAyuda() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [ejecutivos, setEjecutivos] = useState<Ejecutivo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEjecutivos = async () => {
      try {
        const res = await fetch("/api/ejecutivos", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setEjecutivos(data.ejecutivos || []);
        }
      } catch (err) {
        console.error("Error al cargar ejecutivos:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEjecutivos();
  }, [token]);

  return (
    <div className="ayuda-container">
      <h2 className="ayuda-title">
        {t("proveedor.ayuda.title", "¿Necesitas ayuda?")}
      </h2>
      <p className="ayuda-subtitle">
        {t(
          "proveedor.ayuda.subtitle",
          "Contacta a nuestro equipo ejecutivo para cualquier consulta.",
        )}
      </p>

      {loading ? (
        <p className="ayuda-loading">
          {t("proveedor.ayuda.loading", "Cargando...")}
        </p>
      ) : ejecutivos.length === 0 ? (
        <p className="ayuda-empty">
          {t(
            "proveedor.ayuda.noResults",
            "No hay ejecutivos disponibles en este momento.",
          )}
        </p>
      ) : (
        <ul className="ayuda-list">
          {ejecutivos.map((ej) => (
            <li key={ej.id} className="ayuda-item">
              <p className="ayuda-nombre">{ej.nombre}</p>
              <p className="ayuda-contacto">
                <a href={`mailto:${ej.email}`}>{ej.email}</a>
              </p>
              {ej.telefono && (
                <p className="ayuda-contacto">
                  <a href={`tel:${ej.telefono}`}>{ej.telefono}</a>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
