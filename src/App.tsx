// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import { useAuth } from "./auth/AuthContext";
import Login from "./auth/Login";
import LoginAdmin from "./auth/LoginAdmin";
import LoginProveedor from "./auth/LoginProveedor";
import ProtectedRoute from "./auth/ProtectedRoute";

// Layouts
import AdminLayout from "./layouts/AdminLayout";
import UserLayout from "./layouts/UserLayout";
import ProveedorLayout from "./layouts/ProveedorLayout";

// Home Page
import Home from "./components/cliente/home/Home";

// Admin Views
import UsersManagement from "./components/administrador/Administracion-Cuentas/users-management";
import SettingsAdmin from "./components/administrador/Administracion-Cuentas/clientes-ejecutivos";
import ReporteriaLayout from "./components/administrador/reporteria/ReporteriaLayout";
import ReportExecutive from "./components/administrador/Facturaciones-Ejecutivos/Reporteriaexecutivo";
import Cotizadoradministrador from "./components/administrador/Cotizador-Administrador/Cotizador-administrador";
import SimuladorCotizaciones from "./components/administrador/Simulador-Cotizador/SimuladorCotizaciones";
import Clientesejecutivos from "./components/administrador/Administracion-Cuentas/clientes-ejecutivos";
import ShipsGoTrackingAdmin from "./components/administrador/Shipsgo/gettrackingshipsgo-admin";
import ShipsGoTrackingAdminOP from "./components/administrador/Shipsgo/OP-trackeo";
import Invoicesxejecutivo from "./components/administrador/Facturaciones-Ejecutivos/Facturaciones";
import GestorTarifas from "./components/Pricing/GestorTarifas";
import TarifarioCompleto from "./components/Pricing/TarifarioCompleto";
import HomePricing from "./components/Pricing/HomePricing";
import DocumentosProveedores from "./components/Pricing/DocumentosProveedores";
import HomeEjecutivo from "./components/administrador/HomeEjecutivo";
import HomeOperaciones from "./components/administrador/HomeOperaciones";
import ReporteriaClientes from "./components/administrador/ReporteriaClientes";
import Documentacion from "./components/administrador/Documentacion";
import OPDocumentacion from "./components/administrador/OP-Documentacion";
import OPReporteriaClientes from "./components/administrador/OP-reporteriaclientes";
import Auditoria from "./components/administrador/Auditoria";
import AgenciaAduanas from "./components/administrador/AgenciaAduanas";
import GestionCotizador from "./components/administrador/GestionCotizador";
import ComportamientoDeClientes from "./components/administrador/CustomerBehaviorTracking/ComportamientoDeClientes";
import OPComportamientoDeClientes from "./components/administrador/CustomerBehaviorTracking/OP-ComportamientoDeClientes";
import PricingAlertsPanel from "./components/administrador/PricingAlerts/PricingAlertsPanel";

// Reportería Pages
import ReporteriaDashboard from "./components/administrador/reporteria/pages/ReporteriaDashboard";
import ReporteriaKPIs from "./components/administrador/reporteria/pages/ReporteriaKPIs";
import ReporteriaExecutives from "./components/administrador/reporteria/pages/ReporteriaExecutives";
import ReporteriaTrends from "./components/administrador/reporteria/pages/ReporteriaTrends";

// Quotes View
import QuoteLCL from "./components/quotes/QuoteLCL";
import QuoteFCL from "./components/quotes/QuoteFCL";
import QuoteAIR from "./components/quotes/QuoteAIR";

// User Views
import Cotizador from "./components/Sidebar/Newquotes";
import QuotesView from "./components/Sidebar/QuotesView";
import AirShipmentsView from "./components/shipments/AirShipmentsView";
import OceanShipmentsView from "./components/shipments/OceanShipmentsView";
import GroundShipmentsView from "./components/shipments/GroundShipmentsView";
import Financiera from "./components/Sidebar/ReporteriaFinanciera";
import Settings from "./components/settings/Settings";
import ReporteriaOperacional from "./components/Sidebar/ReporteriaOperacional";
import ShipsGoTracking from "./components/Sidebar/Shipsgotracking";
import CreateShipmentForm from "./components/Sidebar/New-tracking";
import CreateOceanShipmentForm from "./components/Sidebar/New-ocean-tracking";
import Novedades from "./components/Sidebar/Novedades";
import ShippingOrderView from "./components/Sidebar/ShippingOrder";
import CotizacionEspecial from "./components/Sidebar/Cotizacion-especial";
import MisDocumentosCliente from "./components/Sidebar/MisDocumentosCliente";
import PrivacyPolicy from "./components/Footer/PrivacyPolicy";
import TermsOfService from "./components/Footer/TermsOfService";
import CookiesSettings from "./components/Footer/CookiesSettings";
import Contenedores from "./components/Footer/info/Contenedores";
import Contactenos from "./components/Footer/info/Contactenos";
import ItinerarioPage from "./components/Footer/info/ItinerarioPage";
import ReportarError from "./components/Footer/info/ReportarError";
import PromesasPage from "./components/cliente/home/promesas/PromesasPage";

// Proveedor Views
import HomeProveedores from "./components/Proveedores/Homeproveedores";
import TarifarioAereo from "./components/Proveedores/TarifarioAereo";
import TarifarioFCL from "./components/Proveedores/TarifarioFCL";
import TarifarioLCL from "./components/Proveedores/TarifarioLCL";
import ArchivosProveedor from "./components/Proveedores/ArchivosProveedor";
import NecesitasAyuda from "./components/Proveedores/NecesitasAyuda";
import QuoteInternacionalizacion from "./components/Proveedores/QuoteInternacionalizacion";

/** Renders different home page depending on the user's role */
function HomeSwitch() {
  const { user } = useAuth();
  if (user?.roles?.pricing && !user?.roles?.ejecutivo) return <HomePricing />;
  if (user?.roles?.ejecutivo) return <HomeEjecutivo />;
  if (user?.roles?.operaciones) return <HomeOperaciones />;
  if (user?.roles?.pricing) return <HomePricing />;
  return <HomeEjecutivo />;
}

function App() {
  const { user, loading } = useAuth();

  // Helper para determinar la ruta de inicio según el tipo de usuario
  const getHomeRoute = () => {
    if (!user) return "/login";
    if (user.username === "Ejecutivo") {
      if (user.roles?.proveedor) return "/proveedor/home";
      return "/admin/home";
    }
    return "/";
  };

  return (
    <>
      <Routes>
        {/* Ruta de Login */}
        <Route
          path="/login"
          element={
            loading ? null : user ? (
              <Navigate to={getHomeRoute()} replace />
            ) : (
              <Login />
            )
          }
        />

        {/* Ruta de Login Administrativo */}
        <Route
          path="/login-admin"
          element={
            loading ? null : user ? (
              <Navigate to={getHomeRoute()} replace />
            ) : (
              <LoginAdmin />
            )
          }
        />

        {/* Ruta de Login Proveedor */}
        <Route
          path="/login-proveedor"
          element={
            loading ? null : user ? (
              <Navigate to={getHomeRoute()} replace />
            ) : (
              <LoginProveedor />
            )
          }
        />

        {/* Rutas de Ejecutivo */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="cotizador-administrador"
            element={<Cotizadoradministrador />}
          />
          <Route
            path="simulador-cotizaciones"
            element={<SimuladorCotizaciones />}
          />
          <Route path="tusclientes" element={<Clientesejecutivos />} />
          <Route index element={<Navigate to="/admin/home" replace />} />
          <Route path="home" element={<HomeSwitch />} />
          <Route
            path="reporteriaclientes/:clientUsername?"
            element={<ReporteriaClientes />}
          />
          <Route
            path="documentacion/:clientUsername?"
            element={<Documentacion />}
          />
          <Route
            path="op-documentacion/:clientUsername?"
            element={<OPDocumentacion />}
          />
          <Route path="users" element={<UsersManagement />} />
          <Route path="reportexecutive" element={<ReportExecutive />} />
          <Route path="reportoperational" element={<Invoicesxejecutivo />} />
          <Route
            path="trackeos/:clientUsername?"
            element={<ShipsGoTrackingAdmin />}
          />
          <Route
            path="op-trackeos/:clientUsername?"
            element={<ShipsGoTrackingAdminOP />}
          />
          <Route
            path="op-reporteriaclientes/:clientUsername?"
            element={<OPReporteriaClientes />}
          />
          <Route path="pricing" element={<GestorTarifas />} />
          <Route path="tarifario-completo" element={<TarifarioCompleto />} />
          <Route
            path="documentos-proveedores"
            element={<DocumentosProveedores />}
          />

          {/* Rutas de Reportería con subrutas */}
          <Route path="reporteria" element={<ReporteriaLayout />}>
            <Route
              index
              element={<Navigate to="/admin/reporteria/dashboard" replace />}
            />
            <Route path="dashboard" element={<ReporteriaDashboard />} />
            <Route path="kpis" element={<ReporteriaKPIs />} />
            <Route path="ejecutivos" element={<ReporteriaExecutives />} />
            <Route path="tendencias" element={<ReporteriaTrends />} />
          </Route>
          <Route path="auditoria" element={<Auditoria />} />
          <Route path="agencia-aduanas" element={<AgenciaAduanas />} />
          <Route path="gestion-cotizador" element={<GestionCotizador />} />
          <Route
            path="comportamiento-clientes/:clientUsername?"
            element={<ComportamientoDeClientes />}
          />
          <Route
            path="op-comportamiento-clientes/:clientUsername?"
            element={<OPComportamientoDeClientes />}
          />
          <Route path="alertas-pricing" element={<PricingAlertsPanel />} />
          <Route path="settings" element={<SettingsAdmin />} />
        </Route>

        {/* Rutas de Proveedor */}
        <Route
          path="/proveedor"
          element={
            <ProtectedRoute requireProveedor={true}>
              <ProveedorLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/proveedor/home" replace />} />
          <Route path="home" element={<HomeProveedores />} />
          <Route path="tarifario-aereo" element={<TarifarioAereo />} />
          <Route path="tarifario-fcl" element={<TarifarioFCL />} />
          <Route path="tarifario-lcl" element={<TarifarioLCL />} />
          <Route
            path="internacionalizacion"
            element={<QuoteInternacionalizacion />}
          />
          <Route path="archivos" element={<ArchivosProveedor />} />
          <Route path="ayuda" element={<NecesitasAyuda />} />
        </Route>

        {/* Rutas de Usuario Regular */}
        <Route
          path="/"
          element={
            <ProtectedRoute requireAdmin={false}>
              <UserLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="quotes" element={<QuotesView />} />
          <Route path="newquotes" element={<Cotizador />} />
          <Route path="QuoteAIR" element={<QuoteAIR />} />
          <Route path="QuoteLCL" element={<QuoteLCL />} />
          <Route path="QuoteFCL" element={<QuoteFCL />} />
          <Route path="air-shipments" element={<AirShipmentsView />} />
          <Route path="trackings" element={<ShipsGoTracking />} />
          <Route
            path="trackings-aereo"
            element={<ShipsGoTracking initialTab="air" />}
          />
          <Route
            path="trackings-maritimo"
            element={<ShipsGoTracking initialTab="ocean" />}
          />
          <Route path="ocean-shipments" element={<OceanShipmentsView />} />
          <Route path="ground-shipments" element={<GroundShipmentsView />} />
          <Route path="shipping-orders" element={<ShippingOrderView />} />
          <Route path="cotizacion-especial" element={<CotizacionEspecial />} />
          <Route path="financiera" element={<Financiera />} />
          <Route path="settings" element={<Settings />} />
          <Route path="operacional" element={<ReporteriaOperacional />} />
          <Route path="new-tracking" element={<CreateShipmentForm />} />
          <Route
            path="new-ocean-tracking"
            element={<CreateOceanShipmentForm />}
          />
          <Route path="novedades" element={<Novedades />} />
          <Route path="mis-documentos" element={<MisDocumentosCliente />} />
          <Route path="promesas" element={<PromesasPage />} />
          <Route path="contenedores" element={<Contenedores />} />
          <Route path="contactenos" element={<Contactenos />} />
          <Route path="reportar-error" element={<ReportarError />} />
          <Route path="itinerario" element={<ItinerarioPage />} />
        </Route>

        {/* Rutas públicas legales */}
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/cookie-settings" element={<CookiesSettings />} />

        {/* Ruta por defecto */}
        <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />
      </Routes>
      <SpeedInsights />
      <Analytics />
    </>
  );
}

export default App;
