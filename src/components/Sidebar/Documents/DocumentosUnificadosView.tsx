// src/components/Sidebar/Documents/DocumentosUnificadosView.tsx
// Vista unificada de documentos para cliente y ejecutivo.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import "./DocumentosUnificadosView.css";
import LoadingTips from "../../shipments/LoadingTips";

const FONT =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const DOCS_CACHE_TTL = 3 * 60 * 60 * 1000;
const DOCS_CACHE_PREFIX = "unifiedDocumentsCache_v1";

export interface DocItem {
  id: string;
  shipmentId: string | null;
  tipo: string;
  nombreArchivo: string;
  tipoArchivo: string;
  tamanoMB: string;
  fechaSubida: string;
}

interface AllDocs {
  air: DocItem[];
  ocean: DocItem[];
  ground: DocItem[];
  quotes: DocItem[];
}

type TransportType = "all" | "air" | "ocean" | "ground" | "quotes";
type GroupTransportType = Exclude<TransportType, "all">;

interface ReferenceMeta {
  number: string | null;
  customerReference: string | null;
}

interface CachedDocsPayload {
  ts: number;
  docs: AllDocs;
  referenceMap: Record<string, ReferenceMeta>;
}

type UnifiedDoc = DocItem & { _type: GroupTransportType };

interface DocGroup {
  key: string;
  type: GroupTransportType;
  title: string;
  subtitle: string | null;
  docs: UnifiedDoc[];
  latestTimestamp: number;
  sortValue: number;
  lookupValue: string | null;
}

const TRANSPORT_LABELS: Record<TransportType, string> = {
  all: "Todos",
  air: "Aérea",
  ocean: "Marítima",
  ground: "Terrestre",
  quotes: "Cotizaciones",
};

const SUMMARY_METRICS: Array<{
  key: TransportType;
  label: string;
  sub: string;
}> = [
  { key: "all", label: "Todos", sub: "documentos" },
  { key: "air", label: "Aéreo", sub: "documentos" },
  { key: "ocean", label: "Marítimo", sub: "documentos" },
  { key: "ground", label: "Terrestre", sub: "documentos" },
  { key: "quotes", label: "Cotizaciones", sub: "documentos" },
];

const FILE_BADGES: Array<{ match: string; label: string }> = [
  { match: "pdf", label: "PDF" },
  { match: "excel", label: "XLS" },
  { match: "spreadsheet", label: "XLS" },
  { match: "word", label: "DOC" },
  { match: "document", label: "DOC" },
];

const UPLOAD_DOC_TYPES = [
  "Orden de compra",
  "Invoice",
  "Packing List",
  "Certificado de Origen",
  "Póliza de seguro",
  "Guía de Despacho",
  "Declaración de Ingreso",
] as const;

type UploadDocType = (typeof UPLOAD_DOC_TYPES)[number];

const UPLOAD_ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatFecha(fechaISO: string) {
  return new Date(fechaISO).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatFechaFull(fechaISO: string) {
  return new Date(fechaISO).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getReferenceKey(type: GroupTransportType, referenceId: string | null) {
  return `${type}:${referenceId || "sin-referencia"}`;
}

function getDocsCacheKey(ownerUsername: string) {
  return `${DOCS_CACHE_PREFIX}_${ownerUsername.toLowerCase()}`;
}

function readDocsCache(ownerUsername: string): CachedDocsPayload | null {
  try {
    const raw = localStorage.getItem(getDocsCacheKey(ownerUsername));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedDocsPayload;
    if (!parsed?.ts || Date.now() - parsed.ts > DOCS_CACHE_TTL) {
      localStorage.removeItem(getDocsCacheKey(ownerUsername));
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeDocsCache(
  ownerUsername: string,
  docs: AllDocs,
  referenceMap: Record<string, ReferenceMeta>,
) {
  try {
    const payload: CachedDocsPayload = {
      ts: Date.now(),
      docs,
      referenceMap,
    };
    localStorage.setItem(
      getDocsCacheKey(ownerUsername),
      JSON.stringify(payload),
    );
  } catch {
    // Cache is best-effort.
  }
}

function getGroupTitle(
  type: GroupTransportType,
  meta: ReferenceMeta | null,
  internalId: string | null,
) {
  const number = normalizeText(meta?.number);
  const customerReference = normalizeText(meta?.customerReference);
  const suffix = number || customerReference || internalId || "";

  if (type === "quotes") {
    return suffix ? `Cotización ${suffix}` : "Cotización";
  }

  return suffix
    ? `Operación ${TRANSPORT_LABELS[type]} ${suffix}`
    : `Operación ${TRANSPORT_LABELS[type]}`;
}

function getGroupSubtitle(
  meta: ReferenceMeta | null,
  internalId: string | null,
) {
  const number = normalizeText(meta?.number);
  const customerReference = normalizeText(meta?.customerReference);

  if (customerReference && customerReference !== number) {
    return `Ref. cliente: ${customerReference}`;
  }

  if (internalId && internalId !== number && internalId !== customerReference) {
    return `ID interno: ${internalId}`;
  }

  return null;
}

function getFileBadge(tipoArchivo: string) {
  const lower = tipoArchivo.toLowerCase();
  const match = FILE_BADGES.find((item) => lower.includes(item.match));
  return match?.label ?? "FILE";
}

function getGroupLookupValue(
  meta: ReferenceMeta | null,
  internalId: string | null,
) {
  return (
    normalizeText(meta?.number) ||
    normalizeText(meta?.customerReference) ||
    internalId
  );
}

function getReferenceSortValue(
  meta: ReferenceMeta | null,
  internalId: string | null,
) {
  const source =
    normalizeText(meta?.number) ||
    normalizeText(meta?.customerReference) ||
    internalId;
  if (!source) return -1;

  const numeric = source.match(/\d+/g)?.join("");
  if (numeric) return Number(numeric);

  return 0;
}

interface Props {
  ownerUsername: string;
  canDelete?: boolean;
  title?: string;
}

export function DocumentosUnificadosView({
  ownerUsername,
  canDelete = true,
  title,
}: Props) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [docs, setDocs] = useState<AllDocs>({
    air: [],
    ocean: [],
    ground: [],
    quotes: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<TransportType>("all");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [referenceMap, setReferenceMap] = useState<
    Record<string, ReferenceMeta>
  >({});
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [uploadReference, setUploadReference] = useState("");
  const [uploadTipo, setUploadTipo] = useState<UploadDocType>("Invoice");
  const [uploading, setUploading] = useState(false);

  const loadReferenceMap = useCallback(async (sourceDocs: AllDocs) => {
    const nextMap: Record<string, ReferenceMeta> = {};

    const addRefs = (type: GroupTransportType, items: DocItem[]) => {
      items.forEach((doc) => {
        const internalId = normalizeText(doc.shipmentId);
        if (!internalId) return;

        const key = getReferenceKey(type, internalId);
        if (!nextMap[key]) {
          nextMap[key] = { number: internalId, customerReference: null };
        }
      });
    };

    addRefs("air", sourceDocs.air);
    addRefs("ocean", sourceDocs.ocean);
    addRefs("ground", sourceDocs.ground);
    addRefs("quotes", sourceDocs.quotes);

    setReferenceMap(nextMap);
    return nextMap;
  }, []);

  const loadDocs = useCallback(
    async (forceRefresh = false) => {
      if (!token || !ownerUsername) return;
      setLoading(true);
      setError(null);

      const cached = forceRefresh ? null : readDocsCache(ownerUsername);
      if (cached) {
        setDocs(cached.docs);
        setReferenceMap(cached.referenceMap);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/documents/all?ownerUsername=${encodeURIComponent(ownerUsername)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!res.ok) throw new Error("Error al cargar documentos");

        const data = await res.json();
        const nextDocs: AllDocs = {
          air: data.air || [],
          ocean: data.ocean || [],
          ground: data.ground || [],
          quotes: data.quotes || [],
        };

        setDocs(nextDocs);
        const nextReferenceMap = await loadReferenceMap(nextDocs);
        writeDocsCache(ownerUsername, nextDocs, nextReferenceMap);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    },
    [loadReferenceMap, ownerUsername, token],
  );

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const allDocs = useMemo<UnifiedDoc[]>(
    () => [
      ...docs.air.map((d) => ({ ...d, _type: "air" as const })),
      ...docs.ocean.map((d) => ({ ...d, _type: "ocean" as const })),
      ...docs.ground.map((d) => ({ ...d, _type: "ground" as const })),
      ...docs.quotes.map((d) => ({ ...d, _type: "quotes" as const })),
    ],
    [docs],
  );

  const counts: Record<TransportType, number> = {
    all: allDocs.length,
    air: docs.air.length,
    ocean: docs.ocean.length,
    ground: docs.ground.length,
    quotes: docs.quotes.length,
  };

  const visibleDocs = useMemo(() => {
    let list =
      activeType === "all"
        ? allDocs
        : allDocs.filter((doc) => doc._type === activeType);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((doc) => {
        const internalId = normalizeText(doc.shipmentId);
        const meta =
          referenceMap[getReferenceKey(doc._type, internalId)] || null;
        const number = normalizeText(meta?.number) || "";
        const customerReference = normalizeText(meta?.customerReference) || "";

        return (
          doc.nombreArchivo.toLowerCase().includes(q) ||
          doc.tipo.toLowerCase().includes(q) ||
          (internalId || "").toLowerCase().includes(q) ||
          number.toLowerCase().includes(q) ||
          customerReference.toLowerCase().includes(q) ||
          TRANSPORT_LABELS[doc._type].toLowerCase().includes(q)
        );
      });
    }

    return [...list].sort(
      (a, b) =>
        new Date(b.fechaSubida).getTime() - new Date(a.fechaSubida).getTime(),
    );
  }, [activeType, allDocs, referenceMap, search]);

  const groupedDocs = useMemo<DocGroup[]>(() => {
    const groups = new Map<string, DocGroup>();

    visibleDocs.forEach((doc) => {
      const internalId = normalizeText(doc.shipmentId);
      const meta = referenceMap[getReferenceKey(doc._type, internalId)] || null;
      const key = getReferenceKey(doc._type, internalId);
      const timestamp = new Date(doc.fechaSubida).getTime();

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          type: doc._type,
          title: getGroupTitle(doc._type, meta, internalId),
          subtitle: getGroupSubtitle(meta, internalId),
          docs: [],
          latestTimestamp: timestamp,
          sortValue: getReferenceSortValue(meta, internalId),
          lookupValue: getGroupLookupValue(meta, internalId),
        });
      }

      const group = groups.get(key)!;
      group.docs.push(doc);
      group.latestTimestamp = Math.max(group.latestTimestamp, timestamp);
      group.sortValue = Math.max(
        group.sortValue,
        getReferenceSortValue(meta, internalId),
      );
      group.lookupValue =
        group.lookupValue || getGroupLookupValue(meta, internalId);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        docs: [...group.docs].sort(
          (a, b) =>
            new Date(b.fechaSubida).getTime() -
            new Date(a.fechaSubida).getTime(),
        ),
      }))
      .sort((a, b) => {
        if (b.sortValue !== a.sortValue) return b.sortValue - a.sortValue;
        if (b.latestTimestamp !== a.latestTimestamp) {
          return b.latestTimestamp - a.latestTimestamp;
        }
        return a.title.localeCompare(b.title, "es", { numeric: true });
      });
  }, [referenceMap, visibleDocs]);

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      if (prev.includes(key)) {
        return prev.filter((groupKey) => groupKey !== key);
      }

      const next = prev.length >= 2 ? prev.slice(1) : [...prev];
      next.push(key);
      return next;
    });
  }, []);

  const buildDestination = useCallback(
    (group: DocGroup) => {
      const lookup = group.lookupValue || "";
      const isAdmin = location.pathname.startsWith("/admin/");

      if (group.type === "quotes") {
        if (isAdmin) {
          return {
            to: `/admin/reporteriaclientes/${encodeURIComponent(ownerUsername)}`,
            state: {
              targetTab: "quotes" as const,
              quoteFilterNumber: lookup,
            },
          };
        }

        return {
          to: "/quotes",
          state: {
            quoteFilter: lookup,
          },
        };
      }

      if (isAdmin) {
        return {
          to: `/admin/reporteriaclientes/${encodeURIComponent(ownerUsername)}`,
          state: {
            targetTab: "seguimientos" as const,
            shipmentFilterNumber: lookup,
          },
        };
      }

      return {
        to: "/trackings",
        state: {
          shipmentFilterNumber: lookup,
        },
      };
    },
    [location.pathname, ownerUsername],
  );

  const handleUpload = useCallback(
    async (fileList: FileList | null) => {
      if (!token || !ownerUsername || !fileList?.length) return;

      const reference = uploadReference.trim();
      if (!reference) {
        setError("Indica el folio de cotización o una referencia.");
        return;
      }

      const file = fileList[0];
      if (file.size > 5 * 1024 * 1024) {
        setError(`"${file.name}" excede el máximo de 5MB.`);
        return;
      }
      if (!UPLOAD_ALLOWED_MIME.includes(file.type)) {
        setError("Solo se permiten PDF, Excel o Word.");
        return;
      }

      setUploading(true);
      setError(null);
      try {
        const contenidoBase64 = await fileToBase64(file);
        const res = await fetch("/api/documentos/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            quoteId: reference,
            ownerUsername,
            tipo: uploadTipo,
            nombreArchivo: file.name,
            contenidoBase64,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Error al subir documento");
        }

        setSuccessMsg(`"${file.name}" subido correctamente`);
        setTimeout(() => setSuccessMsg(null), 4000);
        setUploadReference("");
        await loadDocs(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al subir documento");
      } finally {
        setUploading(false);
      }
    },
    [loadDocs, ownerUsername, token, uploadReference, uploadTipo],
  );

  const handleDownload = useCallback(
    async (doc: UnifiedDoc) => {
      if (!token || downloadingId === doc.id) return;
      setDownloadingId(doc.id);

      try {
        const endpoint =
          doc._type === "air"
            ? `/api/air-shipments/documentos/download/${doc.id}?ownerUsername=${encodeURIComponent(ownerUsername)}`
            : doc._type === "ocean"
              ? `/api/ocean-shipments/documentos/download/${doc.id}?ownerUsername=${encodeURIComponent(ownerUsername)}`
              : doc._type === "ground"
                ? `/api/ground-shipments/documentos/download/${doc.id}?ownerUsername=${encodeURIComponent(ownerUsername)}`
                : `/api/documentos/download/${doc.id}?ownerUsername=${encodeURIComponent(ownerUsername)}`;

        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Error al descargar");

        const contentType = res.headers.get("Content-Type") || "";
        if (!contentType.includes("application/json")) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = doc.nombreArchivo;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          const data = await res.json();
          const a = document.createElement("a");
          a.href = data.documento.contenidoBase64;
          a.download = doc.nombreArchivo;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } catch {
        setError("Error al descargar el documento");
      } finally {
        setDownloadingId(null);
      }
    },
    [downloadingId, ownerUsername, token],
  );

  const handleDelete = useCallback(
    async (doc: UnifiedDoc) => {
      if (!token || !canDelete) return;
      if (!window.confirm(`¿Eliminar "${doc.nombreArchivo}"?`)) return;
      setDeletingId(doc.id);

      try {
        const endpoint =
          doc._type === "air"
            ? `/api/air-shipments/documentos/${doc.id}?ownerUsername=${encodeURIComponent(ownerUsername)}`
            : doc._type === "ocean"
              ? `/api/ocean-shipments/documentos/${doc.id}?ownerUsername=${encodeURIComponent(ownerUsername)}`
              : doc._type === "ground"
                ? `/api/ground-shipments/documentos/${doc.id}?ownerUsername=${encodeURIComponent(ownerUsername)}`
                : `/api/documentos/${doc.id}?ownerUsername=${encodeURIComponent(ownerUsername)}`;

        const res = await fetch(endpoint, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Error al eliminar");

        setSuccessMsg(`"${doc.nombreArchivo}" eliminado`);
        setTimeout(() => setSuccessMsg(null), 4000);
        await loadDocs(true);
      } catch {
        setError("Error al eliminar el documento");
      } finally {
        setDeletingId(null);
      }
    },
    [canDelete, loadDocs, ownerUsername, token],
  );

  const handleRefresh = useCallback(async () => {
    await loadDocs(true);
  }, [loadDocs]);

  return (
    <div className="doc-unified-view" style={{ fontFamily: FONT }}>
      {title && (
        <div className="doc-header">
          <h2 className="doc-header__title">{title}</h2>
        </div>
      )}

      {/* Subida directa a R2 México (seemanndocumentsmexico) */}
      <div
        style={{
          display: "grid",
          gap: 12,
          padding: "14px 16px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
          Subir documento
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(160px, 1.2fr) minmax(160px, 1fr) auto",
            gap: 10,
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569" }}>
            Folio / referencia
            <input
              type="text"
              value={uploadReference}
              onChange={(e) => setUploadReference(e.target.value)}
              placeholder="Ej. cotización o ref. interna"
              disabled={uploading}
              style={{
                height: 36,
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                padding: "0 10px",
                fontSize: 13,
              }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569" }}>
            Tipo
            <select
              value={uploadTipo}
              onChange={(e) => setUploadTipo(e.target.value as UploadDocType)}
              disabled={uploading}
              style={{
                height: 36,
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                padding: "0 10px",
                fontSize: 13,
                background: "#fff",
              }}
            >
              {UPLOAD_DOC_TYPES.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </label>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 36,
              padding: "0 14px",
              borderRadius: 6,
              background: uploading ? "#94a3b8" : "#ff6200",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: uploading ? "default" : "pointer",
            }}
          >
            {uploading ? "Subiendo…" : "Seleccionar archivo"}
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={uploading}
              style={{ display: "none" }}
              onChange={(e) => {
                void handleUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <div style={{ fontSize: 11, color: "#64748b" }}>
          PDF, Excel o Word · máx. 5MB · se guarda en el bucket México de
          documentos.
        </div>
      </div>

      <section className="doc-metrics-strip" aria-label="Resumen de documentos">
        {SUMMARY_METRICS.map((metric) => {
          const active = activeType === metric.key;
          return (
            <button
              key={metric.key}
              type="button"
              className={`doc-metrics-strip__item${active ? " doc-metrics-strip__item--active" : ""}`}
              aria-pressed={active}
              onClick={() => setActiveType(metric.key)}
            >
              <div className="doc-metrics-strip__label">{metric.label}</div>
              <div className="doc-metrics-strip__value">
                {counts[metric.key]}
              </div>
              <div className="doc-metrics-strip__sub">{metric.sub}</div>
            </button>
          );
        })}
      </section>

      <div className="doc-toolbar">
        <div className="doc-search">
          <input
            type="text"
            placeholder="Buscar por nombre, tipo, operación o cotización..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="doc-link"
              onClick={() => setSearch("")}
            >
              Limpiar
            </button>
          )}
        </div>
        <button
          type="button"
          className="doc-refresh-button"
          onClick={handleRefresh}
          disabled={loading}
        >
          Actualizar
        </button>
      </div>

      {successMsg && (
        <div className="doc-alert doc-alert--success">{successMsg}</div>
      )}

      {error && (
        <div className="doc-alert doc-alert--error">
          {error}
          <button
            type="button"
            className="doc-alert__close"
            onClick={() => setError(null)}
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingTips />}

      {!loading && groupedDocs.length > 0 && (
        <div className="doc-groups">
          {groupedDocs.map((group) => {
            const isExpanded = expandedGroups.includes(group.key);
            const destination = buildDestination(group);

            return (
              <section
                key={group.key}
                className={`doc-group${isExpanded ? " doc-group--open" : ""}`}
              >
                <div
                  className="doc-group__header"
                  onClick={() => toggleGroup(group.key)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleGroup(group.key);
                    }
                  }}
                >
                  <div className="doc-group__copy">
                    <div className="doc-group__title-row">
                      <div className="doc-group__title">{group.title}</div>
                      <button
                        type="button"
                        className="doc-group__view"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(destination.to, {
                            state: destination.state,
                          });
                        }}
                      >
                        {group.type === "quotes"
                          ? "Ver Cotización"
                          : "Ver Operación"}
                      </button>
                    </div>
                    <div className="doc-group__subtitle">
                      {group.subtitle ||
                        "Documentos agrupados bajo esta referencia"}
                    </div>
                  </div>

                  <div className="doc-group__meta">
                    <span>
                      {group.docs.length} documento
                      {group.docs.length !== 1 ? "s" : ""}
                    </span>
                    <span className="doc-group__toggle">
                      {isExpanded ? "Cerrar" : "Abrir"}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="doc-group__body">
                    <div className="doc-group__table-header">
                      <div className="doc-group__head">Documento</div>
                      <div className="doc-group__head">Tipo</div>
                      <div className="doc-group__head">Fecha</div>
                      <div className="doc-group__head doc-group__head--actions">
                        Acciones
                      </div>
                    </div>

                    {group.docs.map((doc) => {
                      const isDeleting = deletingId === doc.id;
                      const isDownloading = downloadingId === doc.id;

                      return (
                        <div key={doc.id} className="doc-row">
                          <div
                            className="doc-document"
                            title={doc.nombreArchivo}
                          >
                            <span className="doc-file-badge">
                              {getFileBadge(doc.tipoArchivo)}
                            </span>
                            <div className="doc-document__copy">
                              <div className="doc-document__name">
                                {doc.nombreArchivo}
                              </div>
                              <div className="doc-document__size">
                                {doc.tamanoMB} MB
                              </div>
                            </div>
                          </div>

                          <div className="doc-type-cell">
                            <span className="doc-type-badge" title={doc.tipo}>
                              {doc.tipo}
                            </span>
                          </div>

                          <div
                            className="doc-date"
                            title={formatFechaFull(doc.fechaSubida)}
                          >
                            {formatFecha(doc.fechaSubida)}
                          </div>

                          <div className="doc-actions">
                            <button
                              type="button"
                              className="doc-action-link"
                              onClick={() => handleDownload(doc)}
                              disabled={isDownloading || isDeleting}
                            >
                              {isDownloading ? "Descargando..." : "Descargar"}
                            </button>

                            {canDelete && (
                              <button
                                type="button"
                                className="doc-action-link doc-action-link--danger"
                                onClick={() => handleDelete(doc)}
                                disabled={isDeleting || isDownloading}
                              >
                                {isDeleting ? "Eliminando..." : "Eliminar"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {!loading && groupedDocs.length === 0 && (
        <div className="doc-empty">
          <div>
            <div className="doc-empty__title">
              {search
                ? `Sin resultados para "${search}"`
                : counts.all === 0
                  ? "No hay documentos disponibles"
                  : `Sin documentos en ${TRANSPORT_LABELS[activeType]}`}
            </div>
            {search ? (
              <button
                type="button"
                className="doc-link"
                onClick={() => setSearch("")}
              >
                Limpiar búsqueda
              </button>
            ) : null}
          </div>
        </div>
      )}

      {!loading && visibleDocs.length > 0 && (
        <div className="doc-results">
          {visibleDocs.length} documento{visibleDocs.length !== 1 ? "s" : ""}
          {activeType !== "all" && ` en ${TRANSPORT_LABELS[activeType]}`}
          {search && ` encontrado${visibleDocs.length !== 1 ? "s" : ""}`}
        </div>
      )}
    </div>
  );
}

export default DocumentosUnificadosView;
