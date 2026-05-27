// src/components/administrador/reporteria/ReporteriaLayout.tsx
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Upload, BarChart3, TrendingUp, Users, Target } from 'lucide-react';
import Papa from 'papaparse';
import { ReporteriaDataProvider } from './context/ReporteriaDataContext';
import { extractOperations } from './utils/dataProcessing';
import type { Operation } from './utils/types';

export default function ReporteriaLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [operations, setOperations] = useState<Operation[] | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = (file: File) => {
    setUploadError(null);

    Papa.parse(file, {
      complete: (res) => {
        try {
          const rows = (res.data as any[]).map((r) =>
            Array.isArray(r) ? (r as string[]).map((c) => (c == null ? '' : String(c))) : []
          );
          const parsedOps = extractOperations(rows);

          if (parsedOps.length === 0) {
            setUploadError('No se encontraron operaciones válidas en el CSV. Verifica el formato del archivo.');
            return;
          }

          console.log(`✅ Operaciones cargadas: ${parsedOps.length}`);
          setOperations(parsedOps);
          // 👇 Navegación la hacemos en un useEffect cuando operations ya esté listo
        } catch (error) {
          console.error('Error procesando CSV:', error);
          setUploadError('Error procesando el archivo CSV. Verifica el formato.');
        }
      },
      error: (error) => {
        console.error('Error leyendo CSV:', error);
        setUploadError('No se pudo leer el CSV. Revisa el formato.');
      },
      delimiter: ',',
      skipEmptyLines: true,
      encoding: 'latin1',
    });
  };

  // 👉 Navegar SOLO cuando ya tenemos operations y estamos en /admin/reporteria
  useEffect(() => {
    if (operations && location.pathname === '/admin/reporteria') {
      navigate('/admin/reporteria/dashboard', { replace: true });
    }
  }, [operations, location.pathname, navigate]);

  const menuItems = [
    { path: '/admin/reporteria/dashboard', name: 'Dashboard', icon: <BarChart3 size={18} /> },
    { path: '/admin/reporteria/kpis', name: 'KPIs', icon: <Target size={18} /> },
    { path: '/admin/reporteria/ejecutivos', name: 'Ejecutivos', icon: <Users size={18} /> },
    { path: '/admin/reporteria/tendencias', name: 'Tendencias', icon: <TrendingUp size={18} /> }
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <ReporteriaDataProvider operations={operations} setOperations={setOperations}>
      <div style={{ backgroundColor: '#fafafa', minHeight: 'calc(100vh - 60px)' }}>
        {/* Si no hay datos cargados, mostrar uploader */}
        {!operations ? (
          <div className="container-fluid py-5">
            <div className="row justify-content-center">
              <div className="col-lg-8 col-xl-6">
                <div
                  className="card border-0 shadow-sm"
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '40px'
                  }}
                >
                  <div className="text-center mb-4">
                    <div
                      className="d-inline-flex align-items-center justify-content-center mb-3"
                      style={{
                        width: '80px',
                        height: '80px',
                        backgroundColor: '#eff6ff',
                        borderRadius: '16px',
                      }}
                    >
                      <Upload size={40} color="#2563eb" />
                    </div>
                    <h3 className="fw-semibold mb-2" style={{ color: '#1f2937', fontSize: '1.75rem' }}>
                      Cargar Datos de Reportería
                    </h3>
                    <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
                      Sube tu archivo CSV con los datos de operaciones para comenzar el análisis
                    </p>
                  </div>

                  {uploadError && (
                    <div
                      className="alert alert-danger d-flex align-items-start mb-4"
                      style={{ borderRadius: '8px' }}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="me-2 mt-1"
                        style={{ flexShrink: 0 }}
                      >
                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                        <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
                      </svg>
                      <div>
                        <strong>Error:</strong> {uploadError}
                      </div>
                    </div>
                  )}

                  <div className="position-relative">
                    <input
                      type="file"
                      className="form-control form-control-lg"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      style={{
                        border: '2px dashed #d1d5db',
                        borderRadius: '10px',
                        padding: '2rem',
                        backgroundColor: '#f9fafb',
                        cursor: 'pointer',
                      }}
                    />
                  </div>

                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid #e5e7eb' }}>
                    <h6 className="fw-semibold mb-3" style={{ color: '#374151', fontSize: '0.9rem' }}>
                      📋 Requisitos del archivo:
                    </h6>
                    <ul className="text-muted mb-0" style={{ fontSize: '0.85rem', paddingLeft: '1.5rem' }}>
                      <li>Formato: CSV (separado por comas)</li>
                      <li>Codificación: Latin1 o UTF-8</li>
                      <li>Debe contener columnas de operaciones comerciales</li>
                      <li>Incluir datos de ejecutivos, clientes, facturación y profit</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Si hay datos, mostrar el layout con sidebar
          <div className="d-flex" style={{ minHeight: 'calc(100vh - 60px)' }}>
            {/* Mini Sidebar */}
            <div
              style={{
                width: '240px',
                backgroundColor: 'white',
                borderRight: '1px solid #e5e7eb',
                padding: '24px 0',
              }}
            >
              <div className="px-4 mb-4">
                <h6
                  className="text-uppercase fw-semibold mb-0"
                  style={{ color: '#6b7280', fontSize: '0.75rem', letterSpacing: '0.05em' }}
                >
                  Reportería
                </h6>
              </div>

              <nav>
                {menuItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-100 text-start d-flex align-items-center px-4 py-3 border-0 ${
                      isActive(item.path) ? 'bg-primary bg-opacity-10' : 'bg-transparent'
                    }`}
                    style={{
                      color: isActive(item.path) ? '#2563eb' : '#6b7280',
                      fontWeight: isActive(item.path) ? 600 : 400,
                      fontSize: '0.9rem',
                      transition: 'all 0.2s',
                      borderLeft: isActive(item.path) ? '3px solid #2563eb' : '3px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive(item.path)) {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive(item.path)) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span className="me-3">{item.icon}</span>
                    {item.name}
                  </button>
                ))}
              </nav>

              {/* Info del dataset cargado */}
              <div className="px-4 mt-4 pt-4" style={{ borderTop: '1px solid #e5e7eb' }}>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                  <div className="mb-2">
                    <strong style={{ color: '#374151' }}>Dataset activo</strong>
                  </div>
                  <div className="d-flex align-items-center mb-1">
                    <svg width="14" height="14" fill="currentColor" className="me-2" viewBox="0 0 16 16">
                      <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
                      <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z" />
                    </svg>
                    {operations?.length.toLocaleString() ?? 0} operaciones
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('¿Deseas cargar un nuevo archivo CSV? Se perderán los datos actuales.')) {
                        setOperations(null);
                        navigate('/admin/reporteria');
                      }
                    }}
                    className="btn btn-sm btn-outline-secondary w-100 mt-3"
                    style={{ fontSize: '0.75rem' }}
                  >
                    <Upload size={14} className="me-1" />
                    Cambiar CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Área de contenido */}
            <div className="flex-grow-1" style={{ padding: '32px', overflowY: 'auto' }}>
              <Outlet />
            </div>
          </div>
        )}
      </div>
    </ReporteriaDataProvider>
  );
}
