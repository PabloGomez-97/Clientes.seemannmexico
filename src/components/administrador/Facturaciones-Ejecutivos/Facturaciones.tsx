// src/components/administrador/natalia/InvoicesXEjecutivo.tsx
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { Modal, Table } from "react-bootstrap";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface OutletContext {
  accessToken: string;
  refreshAccessToken: () => Promise<string>;
  onLogout: () => void;
}

type Ejecutivo = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
};

// Interface para Invoice del API
interface Invoice {
  id: number;
  number: string;
  type: string;
  divisionId: number | null;
  divisionName: string | null;
  billToId: number;
  billToName: string;
  operationFlow: string;
  billToAddress: string;
  paymentTermsId: number;
  paymentTerms: string;
  dueDays: number;
  date: string;
  dueDate: string;
  status: string;
  notes: string | null;
  statementMemo: string;
  currencyId: number;
  currency: string;
  currencyCode: string;
  baseCurrencyId: number;
  baseCurrency: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  homeCurrencyId: number;
  homeCurrency: string;
  homeCurrencyCode: string;
  homeAmount: number;
  homeTaxAmount: number;
  homeTotalAmount: number;
  balanceDue: number;
  baseAmount: number;
  charges: Charge[];
  totalCargoValue: number;
  amountPaid: number;
  paymentDate: string | null;
  salesRep: string | null;
  moduleNumber: string;
  moduleType: string;
  view: string;
  viewModule: string;
}

interface Charge {
  description: string;
  rosterLineNumber: number;
  notes: string | null;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  exchangeRate: number;
}

// Interface para trabajar internamente
interface InvoiceData {
  moduleNumber: string;
  invoiceNumber: string;
  billToName: string;
  salesRep: string;
  type: string;
  status: string;
  date: string;
  dueDate: string;
  amount: number;
  totalAmount: number;
  homeTotalAmount: number;
  balanceDue: number;
  amountPaid: number;
  paymentDate: string | null;
}

interface InvoiceStats {
  totalInvoices: number;
  invoicedCount: number;
  postedCount: number;
  totalAmount: number;
  totalHomeTotalAmount: number;
  totalBalanceDue: number;
  totalAmountPaid: number;
  averagePerInvoice: number;
  uniqueClients: number;
}

interface ExecutiveComparison {
  nombre: string;
  stats: InvoiceStats;
}

type TabType = "individual" | "comparativa" | "doble";
type SortField =
  | "nombre"
  | "totalInvoices"
  | "invoicedCount"
  | "postedCount"
  | "totalAmount"
  | "totalHomeTotalAmount"
  | "totalBalanceDue"
  | "totalAmountPaid"
  | "averagePerInvoice"
  | "uniqueClients";
type SortDirection = "asc" | "desc";

function InvoicesXEjecutivo() {
  const { accessToken } = useOutletContext<OutletContext>();
  const { user, getEjecutivos } = useAuth();

  // Estados generales
  const [activeTab, setActiveTab] = useState<TabType>("individual");
  const [ejecutivos, setEjecutivos] = useState<Ejecutivo[]>([]);
  const [loadingEjecutivos, setLoadingEjecutivos] = useState(true);

  // Estados para Análisis Individual
  const [selectedEjecutivo, setSelectedEjecutivo] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Estados para Análisis Comparativa
  const [compStartDate, setCompStartDate] = useState<string>("");
  const [compEndDate, setCompEndDate] = useState<string>("");
  const [comparativeData, setComparativeData] = useState<ExecutiveComparison[]>(
    [],
  );
  const [allComparativeInvoices, setAllComparativeInvoices] = useState<
    InvoiceData[]
  >([]);
  const [loadingComparative, setLoadingComparative] = useState(false);
  const [errorComparative, setErrorComparative] = useState<string | null>(null);
  const [hasSearchedComparative, setHasSearchedComparative] = useState(false);
  const [sortField, setSortField] = useState<SortField>("totalHomeTotalAmount");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [showInvoicesModal, setShowInvoicesModal] = useState(false);
  const [invoicesDetalle, setInvoicesDetalle] = useState<InvoiceData[]>([]);

  // Estados para Análisis Doble
  const [ejecutivo1, setEjecutivo1] = useState<string>("");
  const [ejecutivo2, setEjecutivo2] = useState<string>("");
  const [doubleStartDate, setDoubleStartDate] = useState<string>("");
  const [doubleEndDate, setDoubleEndDate] = useState<string>("");
  const [doubleData, setDoubleData] = useState<ExecutiveComparison[]>([]);
  const [allDoubleInvoices, setAllDoubleInvoices] = useState<InvoiceData[]>([]);
  const [loadingDouble, setLoadingDouble] = useState(false);
  const [errorDouble, setErrorDouble] = useState<string | null>(null);
  const [hasSearchedDouble, setHasSearchedDouble] = useState(false);

  // Cargar ejecutivos al montar
  useEffect(() => {
    const fetchEjecutivos = async () => {
      try {
        setLoadingEjecutivos(true);
        const data = await getEjecutivos();
        const activeEjecutivos = data.filter((e): e is Ejecutivo => e !== null);
        setEjecutivos(activeEjecutivos);
      } catch (err) {
        console.error("Error cargando ejecutivos:", err);
      } finally {
        setLoadingEjecutivos(false);
      }
    };

    fetchEjecutivos();
  }, []);

  useEffect(() => {
    const tooltipTriggerList = document.querySelectorAll(
      '[data-bs-toggle="tooltip"]',
    );
    tooltipTriggerList.forEach((el) => {
      new (window as any).bootstrap.Tooltip(el);
    });
  }, []);

  // Función para convertir fecha MM/DD/YYYY (del API) a Date object
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split("/");
    if (parts.length !== 3) return null;
    // MM/DD/YYYY -> new Date(YYYY, MM-1, DD)
    return new Date(
      parseInt(parts[2]),
      parseInt(parts[0]) - 1,
      parseInt(parts[1]),
    );
  };

  // Función para convertir fecha del input (YYYY-MM-DD) a Date object
  const parseInputDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split("-");
    if (parts.length !== 3) return null;
    // YYYY-MM-DD -> new Date(YYYY, MM-1, DD)
    return new Date(
      parseInt(parts[0]),
      parseInt(parts[1]) - 1,
      parseInt(parts[2]),
    );
  };

  // Función para convertir Invoice a InvoiceData
  const mapInvoiceToData = (invoice: Invoice): InvoiceData => {
    return {
      moduleNumber: invoice.statementMemo || invoice.moduleNumber,
      invoiceNumber: invoice.number,
      billToName: invoice.billToName || "",
      salesRep: invoice.salesRep || "",
      type: invoice.type || "",
      status: invoice.status || "",
      date: invoice.date || "",
      dueDate: invoice.dueDate || "",
      amount: invoice.amount || 0,
      totalAmount: invoice.totalAmount || 0,
      homeTotalAmount: invoice.homeTotalAmount || 0,
      balanceDue: invoice.balanceDue || 0,
      amountPaid: invoice.amountPaid || 0,
      paymentDate: invoice.paymentDate,
    };
  };

  // Función para calcular estadísticas de un array de invoices
  const calculateStats = (invoicesArray: InvoiceData[]): InvoiceStats => {
    const totalInvoices = invoicesArray.length;
    const invoicedCount = invoicesArray.filter(
      (i) => i.status === "Invoiced",
    ).length;
    const postedCount = invoicesArray.filter(
      (i) => i.status === "Posted",
    ).length;
    const totalAmount = invoicesArray.reduce(
      (sum, i) => sum + (i.amount || 0),
      0,
    );
    const totalHomeTotalAmount = invoicesArray.reduce(
      (sum, i) => sum + (i.homeTotalAmount || 0),
      0,
    );
    const totalBalanceDue = invoicesArray.reduce(
      (sum, i) => sum + (i.balanceDue || 0),
      0,
    );
    const totalAmountPaid = invoicesArray.reduce(
      (sum, i) => sum + (i.amountPaid || 0),
      0,
    );

    // Calcular clientes únicos
    const uniqueClientsSet = new Set(
      invoicesArray
        .map((i) => i.billToName?.trim())
        .filter((c) => c && c.length > 0),
    );
    const uniqueClients = uniqueClientsSet.size;

    return {
      totalInvoices,
      invoicedCount,
      postedCount,
      totalAmount,
      totalHomeTotalAmount,
      totalBalanceDue,
      totalAmountPaid,
      averagePerInvoice:
        totalInvoices > 0 ? totalHomeTotalAmount / totalInvoices : 0,
      uniqueClients,
    };
  };

  // Función para agrupar invoices por mes
  const groupByMonth = (invoicesArray: InvoiceData[]) => {
    const monthMap: { [key: string]: InvoiceData[] } = {};

    invoicesArray.forEach((invoice) => {
      if (!invoice.date) return;

      const parts = invoice.date.split("/");
      if (parts.length !== 3) return;

      const month = parseInt(parts[0]);
      const year = parseInt(parts[2]);
      const key = `${year}-${month.toString().padStart(2, "0")}`;

      if (!monthMap[key]) {
        monthMap[key] = [];
      }

      monthMap[key].push(invoice);
    });

    return monthMap;
  };

  // Fetch para análisis individual
  const fetchIndividualData = async () => {
    if (!selectedEjecutivo) {
      setError("Debes seleccionar un ejecutivo");
      return;
    }

    const cacheKey = `invoicesExecutive_${selectedEjecutivo}_${startDate}_${endDate}`;
    const cached = localStorage.getItem(cacheKey);
    const timestamp = localStorage.getItem(`${cacheKey}_timestamp`);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (cached && timestamp && now - parseInt(timestamp) < fiveMinutes) {
      const parsedData = JSON.parse(cached);
      setInvoices(parsedData);
      setHasSearched(true);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch("https://api.linbis.com/invoices/all", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Error al obtener invoices: ${response.statusText}`);
      }

      const data: Invoice[] = await response.json();

      // Convertir a InvoiceData
      const mappedData = data.map(mapInvoiceToData);

      // Eliminar duplicados basándose en el moduleNumber
      const uniqueData = Array.from(
        new Map(mappedData.map((item) => [item.moduleNumber, item])).values(),
      );

      // Filtrar facturas donde moduleNumber NO comience con SOG
      const filteredData = uniqueData.filter(
        (item) => !item.moduleNumber.startsWith("SOG"),
      );

      // Filtrar por ejecutivo (con validación de null)
      let filteredInvoices = filteredData.filter(
        (i) =>
          i.salesRep &&
          i.salesRep.toLowerCase() === selectedEjecutivo.toLowerCase(),
      );

      // Filtrar por rango de fechas si están definidas
      if (startDate || endDate) {
        filteredInvoices = filteredInvoices.filter((invoice) => {
          const invoiceDate = parseDate(invoice.date);
          if (!invoiceDate) return false;

          const start = startDate ? parseInputDate(startDate) : null;
          const end = endDate ? parseInputDate(endDate) : null;

          if (start && end) {
            return invoiceDate >= start && invoiceDate <= end;
          } else if (start) {
            return invoiceDate >= start;
          } else if (end) {
            return invoiceDate <= end;
          }
          return true;
        });
      }

      setInvoices(filteredInvoices);
      setHasSearched(true);

      // Guardar en caché
      localStorage.setItem(cacheKey, JSON.stringify(filteredInvoices));
      localStorage.setItem(`${cacheKey}_timestamp`, now.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      console.error("Error fetching invoices:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch para análisis comparativa
  const fetchComparativeData = async () => {
    const cacheKey = `invoicesComparative_${compStartDate}_${compEndDate}`;
    const cached = localStorage.getItem(cacheKey);
    const timestamp = localStorage.getItem(`${cacheKey}_timestamp`);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (cached && timestamp && now - parseInt(timestamp) < fiveMinutes) {
      const parsedData = JSON.parse(cached);
      setComparativeData(parsedData.comparativeData);
      setAllComparativeInvoices(parsedData.allInvoices);
      setHasSearchedComparative(true);
      setErrorComparative(null);
      return;
    }

    try {
      setLoadingComparative(true);
      setErrorComparative(null);

      const response = await fetch("https://api.linbis.com/invoices/all", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Error al obtener invoices: ${response.statusText}`);
      }

      const data: Invoice[] = await response.json();

      // Convertir a InvoiceData
      const mappedData = data.map(mapInvoiceToData);

      // Eliminar duplicados basándose en el moduleNumber
      const uniqueData = Array.from(
        new Map(mappedData.map((item) => [item.moduleNumber, item])).values(),
      );

      // Filtrar facturas donde moduleNumber NO comience con SOG
      const filteredData = uniqueData.filter(
        (item) => !item.moduleNumber.startsWith("SOG"),
      );

      // Filtrar por rango de fechas
      let filteredInvoices = filteredData;
      if (compStartDate || compEndDate) {
        filteredInvoices = filteredData.filter((invoice) => {
          const invoiceDate = parseDate(invoice.date);
          if (!invoiceDate) return false;

          const start = compStartDate ? parseInputDate(compStartDate) : null;
          const end = compEndDate ? parseInputDate(compEndDate) : null;

          if (start && end) {
            return invoiceDate >= start && invoiceDate <= end;
          } else if (start) {
            return invoiceDate >= start;
          } else if (end) {
            return invoiceDate <= end;
          }
          return true;
        });
      }

      // Agrupar por ejecutivo (filtrar salesRep nulos primero)
      const groupedByExecutive: { [key: string]: InvoiceData[] } = {};
      filteredInvoices.forEach((invoice) => {
        const exec = invoice.salesRep;
        if (!exec || exec.trim().length === 0) return;

        if (!groupedByExecutive[exec]) {
          groupedByExecutive[exec] = [];
        }
        groupedByExecutive[exec].push(invoice);
      });

      // Calcular stats para cada ejecutivo
      const comparativeResults: ExecutiveComparison[] = Object.keys(
        groupedByExecutive,
      ).map((exec) => ({
        nombre: exec,
        stats: calculateStats(groupedByExecutive[exec]),
      }));

      setComparativeData(comparativeResults);
      setAllComparativeInvoices(filteredInvoices);
      setHasSearchedComparative(true);

      // Guardar en caché
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          comparativeData: comparativeResults,
          allInvoices: filteredInvoices,
        }),
      );
      localStorage.setItem(`${cacheKey}_timestamp`, now.toString());
    } catch (err) {
      setErrorComparative(
        err instanceof Error ? err.message : "Error desconocido",
      );
      console.error("Error fetching comparative invoices:", err);
    } finally {
      setLoadingComparative(false);
    }
  };

  // Fetch para análisis doble
  const fetchDoubleData = async () => {
    if (!ejecutivo1 || !ejecutivo2) {
      setErrorDouble("Debes seleccionar dos ejecutivos");
      return;
    }

    if (ejecutivo1 === ejecutivo2) {
      setErrorDouble("Debes seleccionar dos ejecutivos diferentes");
      return;
    }

    const cacheKey = `invoicesDouble_${ejecutivo1}_${ejecutivo2}_${doubleStartDate}_${doubleEndDate}`;
    const cached = localStorage.getItem(cacheKey);
    const timestamp = localStorage.getItem(`${cacheKey}_timestamp`);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (cached && timestamp && now - parseInt(timestamp) < fiveMinutes) {
      const parsedData = JSON.parse(cached);
      setDoubleData(parsedData.doubleData);
      setAllDoubleInvoices(parsedData.allInvoices);
      setHasSearchedDouble(true);
      setErrorDouble(null);
      return;
    }

    try {
      setLoadingDouble(true);
      setErrorDouble(null);

      const response = await fetch("https://api.linbis.com/invoices/all", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Error al obtener invoices: ${response.statusText}`);
      }

      const data: Invoice[] = await response.json();

      // Convertir a InvoiceData
      const mappedData = data.map(mapInvoiceToData);

      // Eliminar duplicados basándose en el moduleNumber
      const uniqueData = Array.from(
        new Map(mappedData.map((item) => [item.moduleNumber, item])).values(),
      );

      // Filtrar facturas donde moduleNumber NO comience con SOG
      const filteredData = uniqueData.filter(
        (item) => !item.moduleNumber.startsWith("SOG"),
      );

      // Filtrar por los dos ejecutivos (con validación de null)
      let filteredInvoices = filteredData.filter(
        (i) =>
          i.salesRep &&
          (i.salesRep.toLowerCase() === ejecutivo1.toLowerCase() ||
            i.salesRep.toLowerCase() === ejecutivo2.toLowerCase()),
      );

      // Filtrar por rango de fechas
      if (doubleStartDate || doubleEndDate) {
        filteredInvoices = filteredInvoices.filter((invoice) => {
          const invoiceDate = parseDate(invoice.date);
          if (!invoiceDate) return false;

          const start = doubleStartDate
            ? parseInputDate(doubleStartDate)
            : null;
          const end = doubleEndDate ? parseInputDate(doubleEndDate) : null;

          if (start && end) {
            return invoiceDate >= start && invoiceDate <= end;
          } else if (start) {
            return invoiceDate >= start;
          } else if (end) {
            return invoiceDate <= end;
          }
          return true;
        });
      }

      // Agrupar por ejecutivo (con validación de null)
      const exec1Invoices = filteredInvoices.filter(
        (i) =>
          i.salesRep && i.salesRep.toLowerCase() === ejecutivo1.toLowerCase(),
      );
      const exec2Invoices = filteredInvoices.filter(
        (i) =>
          i.salesRep && i.salesRep.toLowerCase() === ejecutivo2.toLowerCase(),
      );

      const doubleResults: ExecutiveComparison[] = [
        { nombre: ejecutivo1, stats: calculateStats(exec1Invoices) },
        { nombre: ejecutivo2, stats: calculateStats(exec2Invoices) },
      ];

      setDoubleData(doubleResults);
      setAllDoubleInvoices(filteredInvoices);
      setHasSearchedDouble(true);

      // Guardar en caché
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          doubleData: doubleResults,
          allInvoices: filteredInvoices,
        }),
      );
      localStorage.setItem(`${cacheKey}_timestamp`, now.toString());
    } catch (err) {
      setErrorDouble(err instanceof Error ? err.message : "Error desconocido");
      console.error("Error fetching double invoices:", err);
    } finally {
      setLoadingDouble(false);
    }
  };

  // Función para formatear moneda
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Función para manejar ordenamiento
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Función para obtener datos ordenados
  const getSortedData = (data: ExecutiveComparison[]) => {
    return [...data].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      if (sortField === "nombre") {
        aValue = a.nombre;
        bValue = b.nombre;
      } else {
        aValue = a.stats[sortField];
        bValue = b.stats[sortField];
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === "asc"
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  };

  // Función para renderizar indicador de ordenamiento
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  // Función para mostrar modal de detalle
  const handleShowInvoicesDetail = (invoicesList: InvoiceData[]) => {
    setInvoicesDetalle(invoicesList);
    setShowInvoicesModal(true);
  };

  // Renderizar gráficos individuales
  const renderIndividualCharts = () => {
    if (invoices.length === 0) return null;

    const stats = calculateStats(invoices);
    const monthlyData = groupByMonth(invoices);
    const sortedMonths = Object.keys(monthlyData).sort();

    // Datos para gráfico de barras mensual
    const monthlyChartData = {
      labels: sortedMonths.map((m) => {
        const [year, month] = m.split("-");
        return `${month}/${year}`;
      }),
      datasets: [
        {
          label: "Total Facturado (CLP)",
          data: sortedMonths.map((m) => {
            const monthInvoices = monthlyData[m];
            return monthInvoices.reduce((sum, i) => sum + i.homeTotalAmount, 0);
          }),
          backgroundColor: "rgba(59, 130, 246, 0.8)",
          borderColor: "rgb(59, 130, 246)",
          borderWidth: 1,
        },
      ],
    };

    // Datos para gráfico de status
    const statusChartData = {
      labels: ["Invoiced", "Posted"],
      datasets: [
        {
          data: [stats.invoicedCount, stats.postedCount],
          backgroundColor: [
            "rgba(251, 191, 36, 0.8)",
            "rgba(34, 197, 94, 0.8)",
          ],
          borderColor: ["rgb(251, 191, 36)", "rgb(34, 197, 94)"],
          borderWidth: 1,
        },
      ],
    };

    return (
      <div className="row g-4 mb-4">
        <div className="col-md-8">
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              padding: "24px",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
            }}
          >
            <h5
              style={{
                fontSize: "16px",
                fontWeight: "600",
                color: "#1f2937",
                marginBottom: "20px",
              }}
            >
              📈 Facturación Mensual
            </h5>
            <div style={{ height: "280px", maxHeight: "35vh" }}>
              <Bar
                data={monthlyChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (context) =>
                          formatCurrency(Number(context.parsed.y)),
                      },
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value) => formatCurrency(Number(value)),
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              padding: "24px",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
            }}
          >
            <h5
              style={{
                fontSize: "16px",
                fontWeight: "600",
                color: "#1f2937",
                marginBottom: "20px",
              }}
            >
              📊 Status de Facturas
            </h5>
            <div
              style={{
                height: "220px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Doughnut
                data={statusChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom",
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Renderizar gráficos comparativos
  const renderComparativeCharts = () => {
    if (comparativeData.length === 0) return null;

    const sortedData = getSortedData(comparativeData);

    // Gráfico de barras comparativo
    const compareChartData = {
      labels: sortedData.map((d) => d.nombre),
      datasets: [
        {
          label: "Total Facturado (CLP)",
          data: sortedData.map((d) => d.stats.totalHomeTotalAmount),
          backgroundColor: "rgba(59, 130, 246, 0.8)",
          borderColor: "rgb(59, 130, 246)",
          borderWidth: 1,
        },
        {
          label: "Saldo Pendiente (CLP)",
          data: sortedData.map((d) => d.stats.totalBalanceDue),
          backgroundColor: "rgba(239, 68, 68, 0.8)",
          borderColor: "rgb(239, 68, 68)",
          borderWidth: 1,
        },
      ],
    };

    return (
      <div className="mb-4">
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            padding: "24px",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
          }}
        >
          <h5
            style={{
              fontSize: "16px",
              fontWeight: "600",
              color: "#1f2937",
              marginBottom: "20px",
            }}
          >
            📊 Comparación por Ejecutivo
          </h5>
          <div style={{ height: "280px", maxHeight: "35vh" }}>
            <Bar
              data={compareChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "top",
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) =>
                        `${context.dataset.label}: ${formatCurrency(Number(context.parsed.y))}`,
                    },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: (value) => formatCurrency(Number(value)),
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container-fluid">
      {/* Header */}
      <div className="row mb-4">
        <div className="col">
          <h2
            style={{
              fontSize: "28px",
              fontWeight: "700",
              color: "#1f2937",
              marginBottom: "8px",
              letterSpacing: "-0.5px",
            }}
          >
            Reportería de Facturación por Ejecutivo
          </h2>
          <p
            style={{
              fontSize: "15px",
              color: "#6b7280",
              margin: 0,
            }}
          >
            Bienvenida {user?.nombreuser}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "8px",
          marginBottom: "24px",
          display: "flex",
          gap: "8px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
        }}
      >
        {[
          {
            key: "individual" as TabType,
            label: "👤 Análisis Individual",
            icon: "📊",
          },
          {
            key: "comparativa" as TabType,
            label: "📊 Análisis Comparativa",
            icon: "📈",
          },
          { key: "doble" as TabType, label: "⚖️ Análisis Doble", icon: "🔄" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: "12px 24px",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s",
              backgroundColor:
                activeTab === tab.key
                  ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                  : "transparent",
              background:
                activeTab === tab.key
                  ? "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)"
                  : "transparent",
              color: activeTab === tab.key ? "white" : "#6b7280",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Individual */}
      {activeTab === "individual" && (
        <>
          {/* Filtros */}
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              padding: "24px",
              marginBottom: "24px",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
            }}
          >
            <h4
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#1f2937",
                marginBottom: "20px",
              }}
            >
              🔍 Filtros de Búsqueda
            </h4>
            <div className="row g-3">
              <div className="col-md-4">
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "8px",
                  }}
                >
                  Ejecutivo
                </label>
                <select
                  className="form-select"
                  value={selectedEjecutivo}
                  onChange={(e) => setSelectedEjecutivo(e.target.value)}
                  disabled={loadingEjecutivos}
                  style={{
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    padding: "10px 12px",
                  }}
                >
                  <option value="">Selecciona un ejecutivo...</option>
                  {ejecutivos.map((ej) => (
                    <option key={ej.id} value={ej.nombre}>
                      {ej.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "8px",
                  }}
                >
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    padding: "10px 12px",
                  }}
                />
              </div>
              <div className="col-md-3">
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "8px",
                  }}
                >
                  Fecha Fin
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    padding: "10px 12px",
                  }}
                />
              </div>
              <div className="col-md-2">
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "transparent",
                    marginBottom: "8px",
                  }}
                >
                  .
                </label>
                <button
                  onClick={fetchIndividualData}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: loading ? "not-allowed" : "pointer",
                    background:
                      "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
                    color: "white",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? "Buscando..." : "🔍 Buscar"}
                </button>
              </div>
            </div>
            {error && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px 16px",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  color: "#991b1b",
                  fontSize: "14px",
                }}
              >
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Resultados */}
          {loading && (
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                padding: "60px 20px",
                textAlign: "center",
              }}
            >
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p className="mt-3 text-muted">Cargando datos...</p>
            </div>
          )}

          {!loading && hasSearched && invoices.length === 0 && (
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                padding: "60px 20px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  backgroundColor: "#fef3c7",
                  borderRadius: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px",
                }}
              >
                <svg width="32" height="32" fill="#f59e0b" viewBox="0 0 16 16">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                  <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
                </svg>
              </div>
              <h4
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#1f2937",
                  marginBottom: "8px",
                }}
              >
                No se encontraron facturas
              </h4>
              <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                Intenta ajustar los filtros de búsqueda
              </p>
            </div>
          )}

          {!loading && hasSearched && invoices.length > 0 && (
            <>
              {/* KPIs */}
              {(() => {
                const stats = calculateStats(invoices);
                return (
                  <div className="row g-4 mb-4">
                    <div className="col-md-3">
                      <div
                        style={{
                          backgroundColor: "white",
                          borderRadius: "12px",
                          border: "1px solid #e5e7eb",
                          padding: "20px",
                          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#6b7280",
                            margin: 0,
                            fontWeight: "500",
                          }}
                        >
                          Total Facturas
                        </p>
                        <h3
                          style={{
                            fontSize: "28px",
                            fontWeight: "700",
                            color: "#1f2937",
                            margin: "8px 0 0 0",
                          }}
                        >
                          {stats.totalInvoices}
                        </h3>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div
                        style={{
                          backgroundColor: "white",
                          borderRadius: "12px",
                          border: "1px solid #e5e7eb",
                          padding: "20px",
                          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#6b7280",
                            margin: 0,
                            fontWeight: "500",
                          }}
                        >
                          Total Facturado (CLP)
                        </p>
                        <h3
                          style={{
                            fontSize: "24px",
                            fontWeight: "700",
                            color: "#10b981",
                            margin: "8px 0 0 0",
                          }}
                        >
                          {formatCurrency(stats.totalHomeTotalAmount)}
                        </h3>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div
                        style={{
                          backgroundColor: "white",
                          borderRadius: "12px",
                          border: "1px solid #e5e7eb",
                          padding: "20px",
                          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#6b7280",
                            margin: 0,
                            fontWeight: "500",
                          }}
                        >
                          Saldo Pendiente (CLP)
                        </p>
                        <h3
                          style={{
                            fontSize: "24px",
                            fontWeight: "700",
                            color: "#ef4444",
                            margin: "8px 0 0 0",
                          }}
                        >
                          {formatCurrency(stats.totalBalanceDue)}
                        </h3>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div
                        style={{
                          backgroundColor: "white",
                          borderRadius: "12px",
                          border: "1px solid #e5e7eb",
                          padding: "20px",
                          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#6b7280",
                            margin: 0,
                            fontWeight: "500",
                          }}
                        >
                          Clientes Únicos
                        </p>
                        <h3
                          style={{
                            fontSize: "28px",
                            fontWeight: "700",
                            color: "#2563eb",
                            margin: "8px 0 0 0",
                          }}
                        >
                          {stats.uniqueClients}
                        </h3>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Gráficos */}
              {renderIndividualCharts()}

              {/* Tabla de facturas */}
              <div
                style={{
                  backgroundColor: "white",
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  padding: "24px",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                }}
              >
                <h5
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#1f2937",
                    marginBottom: "20px",
                  }}
                >
                  📋 Detalle de Facturas ({invoices.length})
                </h5>
                <div style={{ overflowX: "auto" }}>
                  <Table striped bordered hover>
                    <thead>
                      <tr>
                        <th>N° Factura</th>
                        <th>N° Operación</th>
                        <th>Cliente</th>
                        <th>Fecha</th>
                        <th>Status</th>
                        <th>Total (CLP)</th>
                        <th>Saldo Pendiente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice, idx) => (
                        <tr key={idx}>
                          <td>{invoice.invoiceNumber}</td>
                          <td>{invoice.moduleNumber}</td>
                          <td>{invoice.billToName}</td>
                          <td>{invoice.date}</td>
                          <td>
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: "4px",
                                fontSize: "12px",
                                fontWeight: "600",
                                backgroundColor:
                                  invoice.status === "Posted"
                                    ? "#d1fae5"
                                    : "#fef3c7",
                                color:
                                  invoice.status === "Posted"
                                    ? "#065f46"
                                    : "#92400e",
                              }}
                            >
                              {invoice.status}
                            </span>
                          </td>
                          <td style={{ fontWeight: "600", color: "#10b981" }}>
                            {formatCurrency(invoice.homeTotalAmount)}
                          </td>
                          <td style={{ fontWeight: "600", color: "#ef4444" }}>
                            {formatCurrency(invoice.balanceDue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>
            </>
          )}

          {!hasSearched && !loading && (
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                padding: "60px 20px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  backgroundColor: "#eff6ff",
                  borderRadius: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px",
                }}
              >
                <svg width="32" height="32" fill="#2563eb" viewBox="0 0 16 16">
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                </svg>
              </div>
              <h4
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#1f2937",
                  marginBottom: "8px",
                }}
              >
                Selecciona un ejecutivo y busca
              </h4>
              <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                Los resultados aparecerán aquí
              </p>
            </div>
          )}
        </>
      )}

      {/* Tab Comparativa */}
      {activeTab === "comparativa" && (
        <>
          {/* Filtros Comparativa */}
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              padding: "24px",
              marginBottom: "24px",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
            }}
          >
            <h4
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#1f2937",
                marginBottom: "20px",
              }}
            >
              🔍 Filtros de Búsqueda Comparativa
            </h4>
            <div className="row g-3">
              <div className="col-md-4">
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "8px",
                  }}
                >
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={compStartDate}
                  onChange={(e) => setCompStartDate(e.target.value)}
                  style={{
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    padding: "10px 12px",
                  }}
                />
              </div>
              <div className="col-md-4">
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "8px",
                  }}
                >
                  Fecha Fin
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={compEndDate}
                  onChange={(e) => setCompEndDate(e.target.value)}
                  style={{
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    padding: "10px 12px",
                  }}
                />
              </div>
              <div className="col-md-4">
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "transparent",
                    marginBottom: "8px",
                  }}
                >
                  .
                </label>
                <button
                  onClick={fetchComparativeData}
                  disabled={loadingComparative}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: loadingComparative ? "not-allowed" : "pointer",
                    background:
                      "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
                    color: "white",
                    opacity: loadingComparative ? 0.6 : 1,
                  }}
                >
                  {loadingComparative ? "Buscando..." : "🔍 Buscar Todos"}
                </button>
              </div>
            </div>
            {errorComparative && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px 16px",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  color: "#991b1b",
                  fontSize: "14px",
                }}
              >
                ⚠️ {errorComparative}
              </div>
            )}
          </div>

          {/* Loading Comparativa */}
          {loadingComparative && (
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                padding: "60px 20px",
                textAlign: "center",
              }}
            >
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p className="mt-3 text-muted">Cargando datos comparativos...</p>
            </div>
          )}

          {/* No data Comparativa */}
          {!loadingComparative &&
            hasSearchedComparative &&
            comparativeData.length === 0 && (
              <div
                style={{
                  backgroundColor: "white",
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  padding: "60px 20px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    backgroundColor: "#fef3c7",
                    borderRadius: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 24px",
                  }}
                >
                  <svg
                    width="32"
                    height="32"
                    fill="#f59e0b"
                    viewBox="0 0 16 16"
                  >
                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                    <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
                  </svg>
                </div>
                <h4
                  style={{
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#1f2937",
                    marginBottom: "8px",
                  }}
                >
                  No se encontraron datos
                </h4>
                <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                  Intenta ajustar los filtros de búsqueda
                </p>
              </div>
            )}

          {/* Results Comparativa */}
          {!loadingComparative &&
            hasSearchedComparative &&
            comparativeData.length > 0 && (
              <>
                {/* Resumen Global */}
                {(() => {
                  const globalStats = calculateStats(allComparativeInvoices);
                  return (
                    <div className="mb-4">
                      <h4
                        style={{
                          fontSize: "18px",
                          fontWeight: "700",
                          color: "#1f2937",
                          marginBottom: "16px",
                        }}
                      >
                        📊 Resumen General
                      </h4>
                      <div className="row g-4">
                        <div className="col-md-3">
                          <div
                            style={{
                              backgroundColor: "white",
                              borderRadius: "12px",
                              border: "1px solid #e5e7eb",
                              padding: "20px",
                              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "12px",
                                color: "#6b7280",
                                margin: 0,
                                fontWeight: "500",
                              }}
                            >
                              Total Facturas
                            </p>
                            <h3
                              style={{
                                fontSize: "28px",
                                fontWeight: "700",
                                color: "#1f2937",
                                margin: "8px 0 0 0",
                              }}
                            >
                              {globalStats.totalInvoices}
                            </h3>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div
                            style={{
                              backgroundColor: "white",
                              borderRadius: "12px",
                              border: "1px solid #e5e7eb",
                              padding: "20px",
                              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "12px",
                                color: "#6b7280",
                                margin: 0,
                                fontWeight: "500",
                              }}
                            >
                              Total Facturado (CLP)
                            </p>
                            <h3
                              style={{
                                fontSize: "24px",
                                fontWeight: "700",
                                color: "#10b981",
                                margin: "8px 0 0 0",
                              }}
                            >
                              {formatCurrency(globalStats.totalHomeTotalAmount)}
                            </h3>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div
                            style={{
                              backgroundColor: "white",
                              borderRadius: "12px",
                              border: "1px solid #e5e7eb",
                              padding: "20px",
                              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "12px",
                                color: "#6b7280",
                                margin: 0,
                                fontWeight: "500",
                              }}
                            >
                              Saldo Pendiente (CLP)
                            </p>
                            <h3
                              style={{
                                fontSize: "24px",
                                fontWeight: "700",
                                color: "#ef4444",
                                margin: "8px 0 0 0",
                              }}
                            >
                              {formatCurrency(globalStats.totalBalanceDue)}
                            </h3>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div
                            style={{
                              backgroundColor: "white",
                              borderRadius: "12px",
                              border: "1px solid #e5e7eb",
                              padding: "20px",
                              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "12px",
                                color: "#6b7280",
                                margin: 0,
                                fontWeight: "500",
                              }}
                            >
                              Promedio por Factura
                            </p>
                            <h3
                              style={{
                                fontSize: "20px",
                                fontWeight: "700",
                                color: "#2563eb",
                                margin: "8px 0 0 0",
                              }}
                            >
                              {formatCurrency(globalStats.averagePerInvoice)}
                            </h3>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Gráficos Comparativos */}
                {renderComparativeCharts()}

                {/* Tabla Comparativa */}
                <div
                  style={{
                    backgroundColor: "white",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    padding: "24px",
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                  }}
                >
                  <h5
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#1f2937",
                      marginBottom: "20px",
                    }}
                  >
                    📊 Comparación Detallada por Ejecutivo
                  </h5>
                  <div style={{ overflowX: "auto" }}>
                    <Table striped bordered hover>
                      <thead>
                        <tr>
                          <th
                            onClick={() => handleSort("nombre")}
                            style={{ cursor: "pointer", userSelect: "none" }}
                          >
                            Ejecutivo {renderSortIndicator("nombre")}
                          </th>
                          <th
                            onClick={() => handleSort("totalInvoices")}
                            style={{ cursor: "pointer", userSelect: "none" }}
                          >
                            Total Facturas{" "}
                            {renderSortIndicator("totalInvoices")}
                          </th>
                          <th
                            onClick={() => handleSort("invoicedCount")}
                            style={{ cursor: "pointer", userSelect: "none" }}
                          >
                            Invoiced {renderSortIndicator("invoicedCount")}
                          </th>
                          <th
                            onClick={() => handleSort("postedCount")}
                            style={{ cursor: "pointer", userSelect: "none" }}
                          >
                            Posted {renderSortIndicator("postedCount")}
                          </th>
                          <th
                            onClick={() => handleSort("totalHomeTotalAmount")}
                            style={{ cursor: "pointer", userSelect: "none" }}
                          >
                            Total Facturado (CLP){" "}
                            {renderSortIndicator("totalHomeTotalAmount")}
                          </th>
                          <th
                            onClick={() => handleSort("totalBalanceDue")}
                            style={{ cursor: "pointer", userSelect: "none" }}
                          >
                            Saldo Pendiente (CLP){" "}
                            {renderSortIndicator("totalBalanceDue")}
                          </th>
                          <th
                            onClick={() => handleSort("totalAmountPaid")}
                            style={{ cursor: "pointer", userSelect: "none" }}
                          >
                            Total Pagado (CLP){" "}
                            {renderSortIndicator("totalAmountPaid")}
                          </th>
                          <th
                            onClick={() => handleSort("uniqueClients")}
                            style={{ cursor: "pointer", userSelect: "none" }}
                          >
                            Clientes Únicos{" "}
                            {renderSortIndicator("uniqueClients")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {getSortedData(comparativeData).map((exec, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: "600" }}>{exec.nombre}</td>
                            <td>
                              <button
                                onClick={() => {
                                  const execInvoices =
                                    allComparativeInvoices.filter(
                                      (i) =>
                                        i.salesRep &&
                                        i.salesRep.toLowerCase() ===
                                          exec.nombre.toLowerCase(),
                                    );
                                  handleShowInvoicesDetail(execInvoices);
                                }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#2563eb",
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                  padding: 0,
                                }}
                              >
                                {exec.stats.totalInvoices}
                              </button>
                            </td>
                            <td>{exec.stats.invoicedCount}</td>
                            <td>{exec.stats.postedCount}</td>
                            <td style={{ fontWeight: "600", color: "#10b981" }}>
                              {formatCurrency(exec.stats.totalHomeTotalAmount)}
                            </td>
                            <td style={{ fontWeight: "600", color: "#ef4444" }}>
                              {formatCurrency(exec.stats.totalBalanceDue)}
                            </td>
                            <td style={{ fontWeight: "600", color: "#2563eb" }}>
                              {formatCurrency(exec.stats.totalAmountPaid)}
                            </td>
                            <td>{exec.stats.uniqueClients}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              </>
            )}

          {/* Initial message Comparativa */}
          {!hasSearchedComparative && !loadingComparative && (
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                padding: "60px 20px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  backgroundColor: "#eff6ff",
                  borderRadius: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px",
                }}
              >
                <svg width="32" height="32" fill="#2563eb" viewBox="0 0 16 16">
                  <path d="M1 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-3zm5-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7zm5-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V2z" />
                </svg>
              </div>
              <h4
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#1f2937",
                  marginBottom: "8px",
                }}
              >
                Compara el desempeño de todos los ejecutivos
              </h4>
              <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                Haz clic en "Buscar Todos" para ver el análisis comparativo
              </p>
            </div>
          )}
        </>
      )}

      {/* Tab Doble */}
      {activeTab === "doble" && (
        <>
          {/* Filtros Doble */}
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              padding: "24px",
              marginBottom: "24px",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
            }}
          >
            <h4
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#1f2937",
                marginBottom: "20px",
              }}
            >
              🔍 Filtros de Comparación Doble
            </h4>
            <div className="row g-3">
              <div className="col-md-3">
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "8px",
                  }}
                >
                  Ejecutivo 1
                </label>
                <select
                  className="form-select"
                  value={ejecutivo1}
                  onChange={(e) => setEjecutivo1(e.target.value)}
                  disabled={loadingEjecutivos}
                  style={{
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    padding: "10px 12px",
                  }}
                >
                  <option value="">Selecciona...</option>
                  {ejecutivos.map((ej) => (
                    <option key={ej.id} value={ej.nombre}>
                      {ej.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "8px",
                  }}
                >
                  Ejecutivo 2
                </label>
                <select
                  className="form-select"
                  value={ejecutivo2}
                  onChange={(e) => setEjecutivo2(e.target.value)}
                  disabled={loadingEjecutivos}
                  style={{
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    padding: "10px 12px",
                  }}
                >
                  <option value="">Selecciona...</option>
                  {ejecutivos.map((ej) => (
                    <option key={ej.id} value={ej.nombre}>
                      {ej.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "8px",
                  }}
                >
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={doubleStartDate}
                  onChange={(e) => setDoubleStartDate(e.target.value)}
                  style={{
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    padding: "10px 12px",
                  }}
                />
              </div>
              <div className="col-md-2">
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "8px",
                  }}
                >
                  Fecha Fin
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={doubleEndDate}
                  onChange={(e) => setDoubleEndDate(e.target.value)}
                  style={{
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    padding: "10px 12px",
                  }}
                />
              </div>
              <div className="col-md-2">
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "transparent",
                    marginBottom: "8px",
                  }}
                >
                  .
                </label>
                <button
                  onClick={fetchDoubleData}
                  disabled={loadingDouble}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: loadingDouble ? "not-allowed" : "pointer",
                    background:
                      "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
                    color: "white",
                    opacity: loadingDouble ? 0.6 : 1,
                  }}
                >
                  {loadingDouble ? "Buscando..." : "🔍 Comparar"}
                </button>
              </div>
            </div>
            {errorDouble && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px 16px",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  color: "#991b1b",
                  fontSize: "14px",
                }}
              >
                ⚠️ {errorDouble}
              </div>
            )}
          </div>

          {/* Loading Doble */}
          {loadingDouble && (
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                padding: "60px 20px",
                textAlign: "center",
              }}
            >
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p className="mt-3 text-muted">Comparando ejecutivos...</p>
            </div>
          )}

          {/* No data Doble */}
          {!loadingDouble && hasSearchedDouble && doubleData.length === 0 && (
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                padding: "60px 20px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  backgroundColor: "#fef3c7",
                  borderRadius: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px",
                }}
              >
                <svg width="32" height="32" fill="#f59e0b" viewBox="0 0 16 16">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                  <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
                </svg>
              </div>
              <h4
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#1f2937",
                  marginBottom: "8px",
                }}
              >
                No se encontraron datos
              </h4>
              <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                Intenta ajustar los filtros de búsqueda
              </p>
            </div>
          )}

          {/* Results Doble */}
          {!loadingDouble && hasSearchedDouble && doubleData.length > 0 && (
            <>
              {/* Comparación lado a lado */}
              <div className="row g-4 mb-4">
                {doubleData.map((exec, idx) => (
                  <div key={idx} className="col-md-6">
                    <div
                      style={{
                        backgroundColor: "white",
                        borderRadius: "12px",
                        border: "1px solid #e5e7eb",
                        padding: "24px",
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                      }}
                    >
                      <h4
                        style={{
                          fontSize: "20px",
                          fontWeight: "700",
                          color: "#1f2937",
                          marginBottom: "20px",
                          borderBottom: "2px solid #e5e7eb",
                          paddingBottom: "12px",
                        }}
                      >
                        {exec.nombre}
                      </h4>
                      <div className="row g-3">
                        <div className="col-6">
                          <div
                            style={{
                              padding: "12px",
                              backgroundColor: "#f9fafb",
                              borderRadius: "8px",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "11px",
                                color: "#6b7280",
                                margin: 0,
                                fontWeight: "500",
                              }}
                            >
                              Total Facturas
                            </p>
                            <p
                              style={{
                                fontSize: "24px",
                                fontWeight: "700",
                                color: "#1f2937",
                                margin: "4px 0 0 0",
                              }}
                            >
                              {exec.stats.totalInvoices}
                            </p>
                          </div>
                        </div>
                        <div className="col-6">
                          <div
                            style={{
                              padding: "12px",
                              backgroundColor: "#f9fafb",
                              borderRadius: "8px",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "11px",
                                color: "#6b7280",
                                margin: 0,
                                fontWeight: "500",
                              }}
                            >
                              Clientes Únicos
                            </p>
                            <p
                              style={{
                                fontSize: "24px",
                                fontWeight: "700",
                                color: "#2563eb",
                                margin: "4px 0 0 0",
                              }}
                            >
                              {exec.stats.uniqueClients}
                            </p>
                          </div>
                        </div>
                        <div className="col-12">
                          <div
                            style={{
                              padding: "12px",
                              backgroundColor: "#f9fafb",
                              borderRadius: "8px",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "11px",
                                color: "#6b7280",
                                margin: 0,
                                fontWeight: "500",
                              }}
                            >
                              Total Facturado (CLP)
                            </p>
                            <p
                              style={{
                                fontSize: "20px",
                                fontWeight: "700",
                                color: "#10b981",
                                margin: "4px 0 0 0",
                              }}
                            >
                              {formatCurrency(exec.stats.totalHomeTotalAmount)}
                            </p>
                          </div>
                        </div>
                        <div className="col-12">
                          <div
                            style={{
                              padding: "12px",
                              backgroundColor: "#f9fafb",
                              borderRadius: "8px",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "11px",
                                color: "#6b7280",
                                margin: 0,
                                fontWeight: "500",
                              }}
                            >
                              Saldo Pendiente (CLP)
                            </p>
                            <p
                              style={{
                                fontSize: "20px",
                                fontWeight: "700",
                                color: "#ef4444",
                                margin: "4px 0 0 0",
                              }}
                            >
                              {formatCurrency(exec.stats.totalBalanceDue)}
                            </p>
                          </div>
                        </div>
                        <div className="col-6">
                          <div
                            style={{
                              padding: "12px",
                              backgroundColor: "#f9fafb",
                              borderRadius: "8px",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "11px",
                                color: "#6b7280",
                                margin: 0,
                                fontWeight: "500",
                              }}
                            >
                              Invoiced
                            </p>
                            <p
                              style={{
                                fontSize: "20px",
                                fontWeight: "700",
                                color: "#f59e0b",
                                margin: "4px 0 0 0",
                              }}
                            >
                              {exec.stats.invoicedCount}
                            </p>
                          </div>
                        </div>
                        <div className="col-6">
                          <div
                            style={{
                              padding: "12px",
                              backgroundColor: "#f9fafb",
                              borderRadius: "8px",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "11px",
                                color: "#6b7280",
                                margin: 0,
                                fontWeight: "500",
                              }}
                            >
                              Posted
                            </p>
                            <p
                              style={{
                                fontSize: "20px",
                                fontWeight: "700",
                                color: "#22c55e",
                                margin: "4px 0 0 0",
                              }}
                            >
                              {exec.stats.postedCount}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Gráfico de comparación */}
              <div
                style={{
                  backgroundColor: "white",
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  padding: "24px",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                }}
              >
                <h5
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#1f2937",
                    marginBottom: "20px",
                  }}
                >
                  ⚖️ Comparación Visual
                </h5>
                <div style={{ height: "280px", maxHeight: "35vh" }}>
                  <Bar
                    data={{
                      labels: doubleData.map((d) => d.nombre),
                      datasets: [
                        {
                          label: "Total Facturado (CLP)",
                          data: doubleData.map(
                            (d) => d.stats.totalHomeTotalAmount,
                          ),
                          backgroundColor: "rgba(59, 130, 246, 0.8)",
                          borderColor: "rgb(59, 130, 246)",
                          borderWidth: 1,
                        },
                        {
                          label: "Saldo Pendiente (CLP)",
                          data: doubleData.map((d) => d.stats.totalBalanceDue),
                          backgroundColor: "rgba(239, 68, 68, 0.8)",
                          borderColor: "rgb(239, 68, 68)",
                          borderWidth: 1,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: "top",
                        },
                        tooltip: {
                          callbacks: {
                            label: (context) =>
                              `${context.dataset.label}: ${formatCurrency(Number(context.parsed.y))}`,
                          },
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: (value) => formatCurrency(Number(value)),
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Initial message Doble */}
          {!hasSearchedDouble && !loadingDouble && (
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                padding: "60px 20px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  backgroundColor: "#eff6ff",
                  borderRadius: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px",
                }}
              >
                <svg width="32" height="32" fill="#2563eb" viewBox="0 0 16 16">
                  <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                </svg>
              </div>
              <h4
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#1f2937",
                  marginBottom: "8px",
                }}
              >
                Compara dos ejecutivos directamente
              </h4>
              <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                Selecciona dos ejecutivos y haz clic en "Comparar"
              </p>
            </div>
          )}
        </>
      )}

      {/* Modal de detalle */}
      <Modal
        show={showInvoicesModal}
        onHide={() => setShowInvoicesModal(false)}
        size="xl"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Detalle de Facturas</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {invoicesDetalle.length === 0 ? (
            <p className="text-center">No hay facturas para mostrar</p>
          ) : (
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>N° Factura</th>
                  <th>N° Operación</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Status</th>
                  <th>Total (CLP)</th>
                </tr>
              </thead>
              <tbody>
                {invoicesDetalle.map((invoice, idx) => (
                  <tr key={idx}>
                    <td>{invoice.invoiceNumber}</td>
                    <td>{invoice.moduleNumber}</td>
                    <td>{invoice.billToName}</td>
                    <td>{invoice.date}</td>
                    <td>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "600",
                          backgroundColor:
                            invoice.status === "Posted" ? "#d1fae5" : "#fef3c7",
                          color:
                            invoice.status === "Posted" ? "#065f46" : "#92400e",
                        }}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td style={{ fontWeight: "600", color: "#10b981" }}>
                      {formatCurrency(invoice.homeTotalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default InvoicesXEjecutivo;
