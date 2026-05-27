import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import LoadingTips from "../shipments/LoadingTips";
import { useTranslation } from "react-i18next";
import { MUNDOGAMING_DUMMY_INVOICES } from "./Mundogaming/mundogamingDummyInvoiceData";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./styles/ReporteriaFinanciera.css";
import { linbisFetch } from "../../services/linbisFetch";

interface OutletContext {
  accessToken: string;
  refreshAccessToken: () => Promise<string>;
  onLogout: () => void;
}

interface Invoice {
  id?: number;
  number?: string;
  type?: number;
  date?: string;
  dueDate?: string;
  status?: number;
  billTo?: {
    name?: string;
    identificationNumber?: string;
  };
  billToAddress?: string;
  currency?: {
    abbr?: string;
    name?: string;
  };
  amount?: {
    value?: number;
    userString?: string;
  };
  taxAmount?: {
    value?: number;
    userString?: string;
  };
  totalAmount?: {
    value?: number;
    userString?: string;
  };
  balanceDue?: {
    value?: number;
    userString?: string;
  };
  charges?: Array<{
    description?: string;
    quantity?: number;
    unit?: string;
    rate?: number;
    amount?: number;
  }>;
  shipment?: {
    number?: string;
    waybillNumber?: string;
    consignee?: {
      name?: string;
    };
    departure?: string;
    arrival?: string;
    customerReference?: string;
  };
  paymentTerm?: {
    name?: string;
  };
  notes?: string;
  [key: string]: any;
}

const ITEMS_PER_PAGE = 15;
const CHART_COLORS = [
  "#ff6200",
  "#1a1a1a",
  "#6b7280",
  "#d97706",
  "#047857",
  "#b91c1c",
  "#2563eb",
  "#7c3aed",
];

/* -- Sub-components ----------------------------------------- */

function InfoField({
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
    <div className={`rf-info-field ${fullWidth ? "rf-info-field--full" : ""}`}>
      <div className="rf-info-field__label">{label}</div>
      <div className="rf-info-field__value">{String(value)}</div>
    </div>
  );
}

interface TabDef {
  key: string;
  label: string;
  content: React.ReactNode;
  hidden?: boolean;
}

function DetailTabs({ tabs }: { tabs: TabDef[] }) {
  const visibleTabs = tabs.filter((t) => !t.hidden);
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.key || "");
  const current = visibleTabs.find((t) => t.key === activeTab);

  return (
    <div className="rf-detail-tabs">
      <div className="rf-tabs__nav">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            className={`rf-tabs__btn ${activeTab === tab.key ? "rf-tabs__btn--active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab(tab.key);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="rf-tabs__panel">{current?.content}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: "paid" | "pending" | "overdue" }) {
  const { t } = useTranslation();
  const config = {
    paid: { label: t("reportFinancial.statusPaid"), cls: "rf-badge--paid" },
    pending: {
      label: t("reportFinancial.statusPending"),
      cls: "rf-badge--pending",
    },
    overdue: {
      label: t("reportFinancial.statusOverdue"),
      cls: "rf-badge--overdue",
    },
  };
  const c = config[status];
  return <span className={`rf-badge ${c.cls}`}>{c.label}</span>;
}

/* ===========================================================
   MAIN COMPONENT
   =========================================================== */

function ReporteriaFinanciera() {
  const { accessToken, refreshAccessToken } = useOutletContext<OutletContext>();
  const { activeUsername } = useAuth();
  const { t } = useTranslation();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [displayedInvoices, setDisplayedInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreInvoices, setHasMoreInvoices] = useState(true);

  // Client-side table pagination
  const [rowsPerPage, setRowsPerPage] = useState(ITEMS_PER_PAGE);
  const [tablePage, setTablePage] = useState(1);

  // Dashboard tab
  const [dashTab, setDashTab] = useState<"summary" | "expenses" | "invoices">(
    "summary",
  );

  // Filters
  const [periodFilter, setPeriodFilter] = useState<
    "month" | "3months" | "6months" | "year" | "all"
  >("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "paid" | "pending" | "overdue"
  >("all");

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Accordion (max 2 open)
  const [expandedIds, setExpandedIds] = useState<(string | number)[]>([]);

  /* -- Format helpers --------------------------------------- */

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("es-CL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateShort = (dateString?: string) => {
    if (!dateString) return "---";
    return new Date(dateString).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (
    value: number,
    currency: string = "CLP",
    decimals: number = 0,
  ): string => {
    const numeric = Number.isFinite(value) ? value : 0;
    const amount = decimals === 0 ? Math.round(numeric) : numeric;
    const formatted = new Intl.NumberFormat("es-CL", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);

    if (currency === "$") return `$${formatted}`;
    return `${currency} $${formatted}`;
  };

  const formatCompact = (value: number): string => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toFixed(0);
  };

  const processCharges = (charges: any[]) => {
    if (!charges || charges.length === 0) return [];
    const uniqueCharges: any[] = [];
    const seenCharges = new Set<string>();
    charges.forEach((charge) => {
      const key = `${charge.description}-${charge.quantity}-${charge.rate}-${charge.amount}`;
      if (!seenCharges.has(key)) {
        seenCharges.add(key);
        uniqueCharges.push(charge);
      }
    });
    return uniqueCharges;
  };

  /* -- Status helpers --------------------------------------- */

  const getInvoiceStatus = (
    invoice: Invoice,
  ): "paid" | "pending" | "overdue" => {
    const balanceDue = invoice.balanceDue?.value || 0;
    if (balanceDue === 0) return "paid";
    if (invoice.dueDate) {
      const dueDate = new Date(invoice.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDate < today) return "overdue";
    }
    return "pending";
  };

  const getServiceType = (
    shipmentNumber?: string,
  ): "Air" | "Ocean" | "Unknown" => {
    if (!shipmentNumber) return "Unknown";
    if (shipmentNumber.startsWith("SOG")) return "Air";
    if (shipmentNumber.startsWith("HBLI")) return "Ocean";
    return "Unknown";
  };

  /* -- Balance with exchange rate --------------------------- */

  const getConvertedBalance = (invoice: Invoice): string => {
    if (
      invoice.charges &&
      invoice.charges.length > 0 &&
      invoice.totalAmount?.value
    ) {
      const totalCharges = invoice.charges.reduce(
        (sum, charge) => sum + (charge.amount || 0),
        0,
      );
      if (totalCharges > 0) {
        const exchangeRate = (invoice.totalAmount.value / totalCharges) * 2;
        const convertedBalance =
          (invoice.balanceDue?.value || 0) * exchangeRate;
        return formatCurrency(convertedBalance, "CLP");
      }
    }
    return formatCurrency(invoice.balanceDue?.value || 0, "CLP");
  };

  const getExchangeRateText = (invoice: Invoice): string | null => {
    if (
      !invoice.charges ||
      invoice.charges.length === 0 ||
      !invoice.totalAmount?.value
    )
      return null;
    const totalCharges = processCharges(invoice.charges).reduce(
      (sum, charge) => sum + (charge.amount || 0),
      0,
    );
    if (totalCharges <= 0) return null;
    const exchangeRate = (invoice.totalAmount.value / totalCharges).toFixed(2);
    return `${exchangeRate} CLP / ${invoice.currency?.abbr || "USD"}`;
  };

  /* -- Fetch ------------------------------------------------ */

  const fetchInvoices = async (page: number = 1, append: boolean = false) => {
    if (!accessToken) {
      setError(t("reportFinancial.noTokenError"));
      return;
    }
    if (!activeUsername) {
      setError(t("reportFinancial.noUsernameError"));
      return;
    }

    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        ConsigneeName: activeUsername,
        Page: page.toString(),
        ItemsPerPage: "50",
        SortBy: "newest",
      });

      const response = await linbisFetch(
        `https://api.linbis.com/invoices?${queryParams}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
        accessToken,
        refreshAccessToken,
      );

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const invoicesArray: Invoice[] = Array.isArray(data) ? data : [];

      const sortedInvoices = invoicesArray.sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      setHasMoreInvoices(invoicesArray.length === 50);

      const cacheKey = `invoicesCache_${activeUsername}`;

      if (append && page > 1) {
        const combined = [...invoices, ...sortedInvoices].sort((a, b) => {
          const dateA = a.date ? new Date(a.date) : new Date(0);
          const dateB = b.date ? new Date(b.date) : new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        setInvoices(combined);
        setDisplayedInvoices(combined);
        localStorage.setItem(cacheKey, JSON.stringify(combined));
        localStorage.setItem(
          `${cacheKey}_timestamp`,
          new Date().getTime().toString(),
        );
        localStorage.setItem(`${cacheKey}_page`, page.toString());
      } else {
        setInvoices(sortedInvoices);
        setDisplayedInvoices(sortedInvoices);
        localStorage.setItem(cacheKey, JSON.stringify(sortedInvoices));
        localStorage.setItem(
          `${cacheKey}_timestamp`,
          new Date().getTime().toString(),
        );
        localStorage.setItem(`${cacheKey}_page`, page.toString());
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("reportFinancial.unknownError"),
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreInvoices = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchInvoices(nextPage, true);
  };

  /* -- Initial load / cache --------------------------------- */

  useEffect(() => {
    if (!accessToken || !activeUsername) return;

    if (activeUsername === "MundoGaming") {
      setInvoices(MUNDOGAMING_DUMMY_INVOICES as Invoice[]);
      setDisplayedInvoices(MUNDOGAMING_DUMMY_INVOICES as Invoice[]);
      setHasMoreInvoices(false);
      setLoading(false);
      return;
    }

    const cacheKey = `invoicesCache_${activeUsername}`;
    const cachedInvoices = localStorage.getItem(cacheKey);
    const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);
    const cachedPage = localStorage.getItem(`${cacheKey}_page`);

    if (cachedInvoices && cacheTimestamp) {
      const oneHour = 60 * 60 * 1000;
      const cacheAge = new Date().getTime() - parseInt(cacheTimestamp);
      if (cacheAge < oneHour) {
        const parsed = JSON.parse(cachedInvoices);
        setInvoices(parsed);
        setDisplayedInvoices(parsed);
        if (cachedPage) setCurrentPage(parseInt(cachedPage));
        const lastPageSize = parsed.length % 50;
        setHasMoreInvoices(lastPageSize === 0 && parsed.length >= 50);
        setLoading(false);
        return;
      } else {
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(`${cacheKey}_timestamp`);
        localStorage.removeItem(`${cacheKey}_page`);
      }
    }

    setCurrentPage(1);
    fetchInvoices(1, false);
  }, [accessToken, activeUsername]);

  /* -- Period filter ---------------------------------------- */

  const filteredByPeriod = useMemo(() => {
    const now = new Date();
    const startDate = new Date();

    switch (periodFilter) {
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "3months":
        startDate.setMonth(now.getMonth() - 3);
        break;
      case "6months":
        startDate.setMonth(now.getMonth() - 6);
        break;
      case "year":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case "all":
        return invoices;
    }

    return invoices.filter((inv) => {
      if (!inv.date) return false;
      return new Date(inv.date) >= startDate;
    });
  }, [invoices, periodFilter]);

  /* -- Status filter ---------------------------------------- */

  const filteredByStatus = useMemo(() => {
    if (statusFilter === "all") return filteredByPeriod;
    return filteredByPeriod.filter(
      (inv) => getInvoiceStatus(inv) === statusFilter,
    );
  }, [filteredByPeriod, statusFilter]);

  useEffect(() => {
    setDisplayedInvoices(filteredByStatus);
  }, [filteredByStatus]);

  /* -- Metrics by currency ---------------------------------- */

  const metricsByCurrency = useMemo(() => {
    const currencies: {
      [key: string]: {
        totalBilled: number;
        totalPending: number;
        totalPaid: number;
        count: number;
        overdueCount: number;
      };
    } = {};

    filteredByPeriod.forEach((inv) => {
      const currency = inv.currency?.abbr || "USD";
      if (!currencies[currency]) {
        currencies[currency] = {
          totalBilled: 0,
          totalPending: 0,
          totalPaid: 0,
          count: 0,
          overdueCount: 0,
        };
      }

      const total = inv.totalAmount?.value || 0;
      const balance = inv.balanceDue?.value || 0;
      const status = getInvoiceStatus(inv);

      currencies[currency].totalBilled += total;
      currencies[currency].totalPending += balance;
      currencies[currency].totalPaid += total - balance;
      currencies[currency].count += 1;
      if (status === "overdue") currencies[currency].overdueCount += 1;
    });

    return currencies;
  }, [filteredByPeriod]);

  /* -- Chart data: monthly billing trend -------------------- */

  const monthlyTrendData = useMemo(() => {
    const months: {
      [key: string]: { billed: number; paid: number; pending: number };
    } = {};

    filteredByPeriod.forEach((inv) => {
      if (!inv.date) return;
      const d = new Date(inv.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!months[key]) months[key] = { billed: 0, paid: 0, pending: 0 };

      const total = inv.totalAmount?.value || 0;
      const balance = inv.balanceDue?.value || 0;
      months[key].billed += total;
      months[key].paid += total - balance;
      months[key].pending += balance;
    });

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        const [year, month] = key.split("-");
        const label = new Date(+year, +month - 1).toLocaleDateString("es-CL", {
          month: "short",
          year: "2-digit",
        });
        return { name: label, ...val };
      });
  }, [filteredByPeriod]);

  /* -- Chart data: status distribution ---------------------- */

  const statusDistribution = useMemo(() => {
    let paid = 0,
      pending = 0,
      overdue = 0;
    filteredByPeriod.forEach((inv) => {
      const s = getInvoiceStatus(inv);
      if (s === "paid") paid++;
      else if (s === "pending") pending++;
      else overdue++;
    });
    return [
      {
        name: t("reportFinancial.chartPaidPlural"),
        value: paid,
        color: "#047857",
      },
      {
        name: t("reportFinancial.chartPending"),
        value: pending,
        color: "#d97706",
      },
      {
        name: t("reportFinancial.chartOverdue"),
        value: overdue,
        color: "#b91c1c",
      },
    ].filter((d) => d.value > 0);
  }, [filteredByPeriod]);

  /* -- Chart data: expense concentration -------------------- */

  const expenseConcentration = useMemo(() => {
    const categories: { [key: string]: number } = {};
    filteredByPeriod.forEach((inv) => {
      if (!inv.charges) return;
      processCharges(inv.charges).forEach((c) => {
        const desc = c.description || "Otros";
        categories[desc] = (categories[desc] || 0) + (c.amount || 0);
      });
    });
    return Object.entries(categories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [filteredByPeriod]);

  /* -- Chart data: service type breakdown ------------------- */

  const serviceTypeBreakdown = useMemo(() => {
    const types: { [key: string]: { count: number; total: number } } = {};
    filteredByPeriod.forEach((inv) => {
      const stype = getServiceType(inv.shipment?.number);
      if (!types[stype]) types[stype] = { count: 0, total: 0 };
      types[stype].count++;
      types[stype].total += inv.totalAmount?.value || 0;
    });
    return Object.entries(types).map(([name, val]) => ({
      name,
      count: val.count,
      total: val.total,
    }));
  }, [filteredByPeriod]);

  /* -- Chart data: payment term breakdown ------------------- */

  const paymentTermBreakdown = useMemo(() => {
    const terms: { [key: string]: { count: number; total: number } } = {};
    filteredByPeriod.forEach((inv) => {
      const term = inv.paymentTerm?.name || t("reportFinancial.noPaymentTerm");
      if (!terms[term]) terms[term] = { count: 0, total: 0 };
      terms[term].count++;
      terms[term].total += inv.totalAmount?.value || 0;
    });
    return Object.entries(terms)
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([name, val]) => ({ name, count: val.count, total: val.total }));
  }, [filteredByPeriod]);

  /* -- Alerts / risks --------------------------------------- */

  const alerts = useMemo(() => {
    const result: {
      type: "danger" | "warning" | "info";
      title: string;
      text: string;
    }[] = [];

    const overdueInvoices = filteredByPeriod.filter(
      (inv) => getInvoiceStatus(inv) === "overdue",
    );

    if (overdueInvoices.length > 0) {
      const totalOverdue = overdueInvoices.reduce(
        (sum, inv) => sum + (inv.balanceDue?.value || 0),
        0,
      );
      result.push({
        type: "danger",
        title: t("reportFinancial.alertOverdueTitle", {
          count: overdueInvoices.length,
        }),
        text: t("reportFinancial.alertOverdueText", {
          amount: formatCompact(totalOverdue),
        }),
      });
    }

    const pendingInvoices = filteredByPeriod.filter(
      (inv) => getInvoiceStatus(inv) === "pending",
    );
    const soonDue = pendingInvoices.filter((inv) => {
      if (!inv.dueDate) return false;
      const days =
        (new Date(inv.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 7;
    });

    if (soonDue.length > 0) {
      result.push({
        type: "warning",
        title: t("reportFinancial.alertDueSoonTitle", {
          count: soonDue.length,
        }),
        text: t("reportFinancial.alertDueSoonText"),
      });
    }

    // Concentration risk
    if (expenseConcentration.length > 0) {
      const totalExpense = expenseConcentration.reduce(
        (s, e) => s + e.value,
        0,
      );
      const topExpense = expenseConcentration[0];
      const topPct =
        totalExpense > 0
          ? ((topExpense.value / totalExpense) * 100).toFixed(0)
          : "0";
      if (Number(topPct) >= 60) {
        result.push({
          type: "info",
          title: t("reportFinancial.alertConcentrationTitle"),
          text: t("reportFinancial.alertConcentrationText", {
            name: topExpense.name,
            pct: topPct,
          }),
        });
      }
    }

    return result;
  }, [filteredByPeriod, expenseConcentration]);

  /* -- Forecast (simple linear projection) ------------------ */

  const forecast = useMemo(() => {
    if (monthlyTrendData.length < 2) return null;
    const last3 = monthlyTrendData.slice(-3);
    const avgBilled = last3.reduce((s, m) => s + m.billed, 0) / last3.length;
    const avgPaid = last3.reduce((s, m) => s + m.paid, 0) / last3.length;
    return {
      projectedBilling: avgBilled,
      projectedCollection: avgPaid,
      trend:
        last3.length >= 2 && last3[last3.length - 1].billed > last3[0].billed
          ? "up"
          : "down",
    };
  }, [monthlyTrendData]);

  /* -- Sorting ---------------------------------------------- */

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const sortedInvoices = useMemo(() => {
    return [...displayedInvoices].sort((a, b) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case "number":
          valA = (a.notes?.split("@")[0] || a.number || "").toLowerCase();
          valB = (b.notes?.split("@")[0] || b.number || "").toLowerCase();
          break;
        case "date":
          valA = a.date ? new Date(a.date).getTime() : 0;
          valB = b.date ? new Date(b.date).getTime() : 0;
          break;
        case "dueDate":
          valA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          valB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          break;
        case "total":
          valA = a.totalAmount?.value || 0;
          valB = b.totalAmount?.value || 0;
          break;
        case "balance":
          valA = a.balanceDue?.value || 0;
          valB = b.balanceDue?.value || 0;
          break;
        case "status": {
          const order = { paid: 0, pending: 1, overdue: 2 };
          valA = order[getInvoiceStatus(a)];
          valB = order[getInvoiceStatus(b)];
          break;
        }
        default:
          return 0;
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [displayedInvoices, sortColumn, sortDirection]);

  /* -- Client-side pagination ------------------------------- */

  const totalTablePages = Math.max(
    1,
    Math.ceil(sortedInvoices.length / rowsPerPage),
  );

  const paginatedInvoices = useMemo(() => {
    const start = (tablePage - 1) * rowsPerPage;
    return sortedInvoices.slice(start, start + rowsPerPage);
  }, [sortedInvoices, tablePage, rowsPerPage]);

  const paginationRangeText = useMemo(() => {
    if (sortedInvoices.length === 0) return "0 de 0";
    const start = (tablePage - 1) * rowsPerPage + 1;
    const end = Math.min(tablePage * rowsPerPage, sortedInvoices.length);
    return `${start}-${end} de ${sortedInvoices.length}`;
  }, [tablePage, rowsPerPage, sortedInvoices.length]);

  useEffect(() => {
    setTablePage(1);
  }, [displayedInvoices]);

  /* -- Accordion toggle (max 2) ----------------------------- */

  const toggleAccordion = (invoice: Invoice) => {
    const key = invoice.id || invoice.number || "";
    setExpandedIds((prev) => {
      if (prev.includes(key)) {
        return prev.filter((id) => id !== key);
      }
      if (prev.length >= 2) {
        return [...prev.slice(1), key];
      }
      return [...prev, key];
    });
  };

  /* -- Refresh ---------------------------------------------- */

  const refreshInvoices = () => {
    if (!activeUsername) return;

    if (activeUsername === "MundoGaming") {
      setInvoices(MUNDOGAMING_DUMMY_INVOICES as Invoice[]);
      setDisplayedInvoices(MUNDOGAMING_DUMMY_INVOICES as Invoice[]);
      setHasMoreInvoices(false);
      setLoading(false);
      return;
    }

    const cacheKey = `invoicesCache_${activeUsername}`;
    localStorage.removeItem(cacheKey);
    localStorage.removeItem(`${cacheKey}_timestamp`);
    localStorage.removeItem(`${cacheKey}_page`);
    setCurrentPage(1);
    setInvoices([]);
    setDisplayedInvoices([]);
    fetchInvoices(1, false);
  };

  /* -- Generate PDF ----------------------------------------- */

  const generatePDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert(t("reportFinancial.pdfPopupError"));
      return;
    }

    const periodLabel = {
      month: t("reportFinancial.periodLastMonth"),
      "3months": t("reportFinancial.periodLast3Months"),
      "6months": t("reportFinancial.periodLast6Months"),
      year: t("reportFinancial.periodLastYear"),
      all: t("reportFinancial.periodAll"),
    }[periodFilter];

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${t("reportFinancial.pdfTitle")} - ${activeUsername}</title>
  <style>
    @media print { @page { margin: 1cm; } body { margin: 0; } .print-button { display: none; } }
    body { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #1a1a1a; line-height: 1.6; }
    .header { background: #1a1a1a; color: white; padding: 30px; border-radius: 4px; margin-bottom: 30px; }
    .header h1 { margin: 0 0 8px 0; font-size: 1.5rem; }
    .header p { margin: 2px 0; opacity: 0.85; font-size: 0.875rem; }
    .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
    .metric-card { border: 1px solid #e5e7eb; border-radius: 4px; padding: 16px; }
    .metric-card h3 { font-size: 0.6875rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; margin: 0 0 8px 0; }
    .metric-card .value { font-size: 1.25rem; font-weight: 700; color: #1a1a1a; }
    .currency-section { margin-bottom: 24px; page-break-inside: avoid; }
    .currency-title { font-size: 1rem; font-weight: 600; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; page-break-inside: avoid; }
    th { background-color: #fafafa; padding: 10px 12px; text-align: left; font-size: 0.6875rem; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb; }
    td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 0.8125rem; }
    .status-paid { color: #047857; font-weight: 600; }
    .status-pending { color: #b45309; font-weight: 600; }
    .status-overdue { color: #b91c1c; font-weight: 600; }
    .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 0.8125rem; }
    .print-button { background: #1a1a1a; color: white; border: none; border-radius: 4px; padding: 10px 20px; font-size: 0.875rem; font-weight: 600; cursor: pointer; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${t("reportFinancial.pdfTitle")}</h1>
    <p><strong>${t("reportFinancial.pdfClient")}</strong> ${activeUsername || "N/A"}</p>
    <p><strong>${t("reportFinancial.pdfPeriod")}</strong> ${periodLabel}</p>
    <p><strong>${t("reportFinancial.pdfGenerated")}</strong> ${new Date().toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
  </div>
  <button class="print-button" onclick="window.print()">${t("reportFinancial.pdfPrint")}</button>
  ${Object.entries(metricsByCurrency)
    .map(
      ([currency, metrics]) => `
  <div class="currency-section">
    <h2 class="currency-title">${t("reportFinancial.pdfSummaryIn")} ${currency}</h2>
    <div class="metrics">
      <div class="metric-card">
        <h3>${t("reportFinancial.kpiTotalBilled")}</h3>
        <div class="value">${formatCurrency(metrics.totalBilled, currency)}</div>
        <p style="margin:4px 0 0;font-size:0.8125rem;color:#6b7280;">${metrics.count} ${t("reportFinancial.invoices")}</p>
      </div>
      <div class="metric-card">
        <h3>${t("reportFinancial.pdfPendingPayment")}</h3>
        <div class="value" style="color:#b45309;">${formatCurrency(metrics.totalPending, currency)}</div>
      </div>
      <div class="metric-card">
        <h3>${t("reportFinancial.kpiTotalPaid")}</h3>
        <div class="value" style="color:#047857;">${formatCurrency(metrics.totalPaid, currency)}</div>
      </div>
      <div class="metric-card">
        <h3>${t("reportFinancial.pdfOverdueInvoices")}</h3>
        <div class="value" style="color:#b91c1c;">${metrics.overdueCount}</div>
      </div>
    </div>
  </div>`,
    )
    .join("")}
  <div style="margin-top:32px;">
    <h2 style="font-size:1rem;font-weight:600;margin-bottom:12px;">${t("reportFinancial.pdfInvoiceDetail")}</h2>
    <table>
      <thead>
        <tr>
          <th>${t("reportFinancial.pdfNumber")}</th>
          <th>${t("reportFinancial.thStatus")}</th>
          <th>${t("reportFinancial.thShipment")}</th>
          <th>${t("reportFinancial.thPaymentTerm")}</th>
          <th style="text-align:right;">${t("reportFinancial.thTotal")}</th>
          <th>${t("reportFinancial.thDate")}</th>
          <th>${t("reportFinancial.thDueDate")}</th>
          <th style="text-align:right;">${t("reportFinancial.thBalance")}</th>
        </tr>
      </thead>
      <tbody>
        ${displayedInvoices
          .map((invoice) => {
            const status = getInvoiceStatus(invoice);
            const statusLabel = {
              paid: t("reportFinancial.statusPaid"),
              pending: t("reportFinancial.statusPending"),
              overdue: t("reportFinancial.statusOverdue"),
            }[status];
            return `<tr>
              <td><strong>${invoice.notes ? invoice.notes.split("@")[0] : invoice.number || "N/A"}</strong></td>
              <td style="text-align:center;" class="status-${status}">${statusLabel}</td>
              <td>${invoice.shipment?.number || "-"}</td>
              <td>${invoice.paymentTerm?.name || "-"}</td>
              <td style="text-align:right;">${formatCurrency(invoice.totalAmount?.value || 0, "CLP")}</td>
              <td>${invoice.date ? new Date(invoice.date).toLocaleDateString("es-CL") : "-"}</td>
              <td>${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("es-CL") : "-"}</td>
              <td style="text-align:right;" class="status-${status}">${getConvertedBalance(invoice)}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  </div>
  <div class="footer">
    <p>${t("reportFinancial.pdfFooter")}</p>
    <p>${t("reportFinancial.pdfTotalInvoices")} <strong>${displayedInvoices.length}</strong></p>
  </div>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  /* -- Sort icon -------------------------------------------- */

  const SortIcon = ({ column }: { column: string }) => {
    const active = sortColumn === column;
    return (
      <svg
        className={`rf-sort-icon ${active ? "rf-sort-icon--active" : ""} ${active && sortDirection === "asc" ? "rf-sort-icon--asc" : ""}`}
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M7 10l5 5 5-5z" />
      </svg>
    );
  };

  /* -- Custom tooltip --------------------------------------- */

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 4,
          padding: "8px 12px",
          fontSize: "0.75rem",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4, color: "#1a1a1a" }}>
          {label}
        </div>
        {payload.map((p: any, i: number) => (
          <div
            key={i}
            style={{ color: p.color, display: "flex", gap: 8, marginTop: 2 }}
          >
            <span>{p.name}:</span>
            <span style={{ fontWeight: 600 }}>${formatCompact(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  /* =========================================================
     RENDER
     ========================================================= */

  const totalInvoices = filteredByPeriod.length;
  const totalBilledAll = filteredByPeriod.reduce(
    (s, inv) => s + (inv.totalAmount?.value || 0),
    0,
  );
  const totalPendingAll = filteredByPeriod.reduce(
    (s, inv) => s + (inv.balanceDue?.value || 0),
    0,
  );
  const totalPaidAll = totalBilledAll - totalPendingAll;
  const overdueCount = filteredByPeriod.filter(
    (inv) => getInvoiceStatus(inv) === "overdue",
  ).length;

  return (
    <div className="rf-container">
      {/* -- Header ------------------------------------------ */}
      <div className="rf-header">
        <div>
          <h1 className="rf-header__title">{t("reportFinancial.title")}</h1>
          <p className="rf-header__subtitle">
            {activeUsername} &middot; {totalInvoices}{" "}
            {t("reportFinancial.invoicesInPeriod")}
          </p>
        </div>
        <div className="rf-header__actions">
          <button
            className="rf-btn"
            onClick={refreshInvoices}
            disabled={loading}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {t("reportFinancial.refresh")}
          </button>
          <button className="rf-btn rf-btn--primary" onClick={generatePDF}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            {t("reportFinancial.exportPDF")}
          </button>
        </div>
      </div>

      {/* -- Toolbar / Filters ------------------------------- */}
      <div className="rf-toolbar">
        <div className="rf-toolbar__filters">
          <div className="rf-filter-group">
            <span className="rf-filter-group__label">
              {t("reportFinancial.periodLabel")}
            </span>
            {(
              [
                { key: "month", label: t("reportFinancial.filter1M") },
                { key: "3months", label: t("reportFinancial.filter3M") },
                { key: "6months", label: t("reportFinancial.filter6M") },
                { key: "year", label: t("reportFinancial.filter1Y") },
                { key: "all", label: t("reportFinancial.filterAll") },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                className={`rf-filter-btn ${periodFilter === f.key ? "rf-filter-btn--active" : ""}`}
                onClick={() => setPeriodFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="rf-filter-group">
            <span className="rf-filter-group__label">
              {t("reportFinancial.statusLabel")}
            </span>
            {(
              [
                { key: "all", label: t("reportFinancial.filterAllStatus") },
                { key: "paid", label: t("reportFinancial.filterPaid") },
                { key: "pending", label: t("reportFinancial.filterPending") },
                { key: "overdue", label: t("reportFinancial.filterOverdue") },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                className={`rf-filter-btn ${statusFilter === f.key ? "rf-filter-btn--active" : ""}`}
                onClick={() => setStatusFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && <LoadingTips />}

      {/* -- Error ------------------------------------------- */}
      {error && (
        <div className="rf-error">
          <strong>{t("reportFinancial.error")}</strong> {error}
        </div>
      )}

      {/* -- Dashboard --------------------------------------- */}
      {!loading && invoices.length > 0 && (
        <>
          {/* -- KPI grid ------------------------------------ */}
          <div className="rf-kpi-grid">
            <div className="rf-kpi">
              <div className="rf-kpi__label">
                {t("reportFinancial.kpiTotalBilled")}
              </div>
              <div className="rf-kpi__value">
                CLP ${formatCompact(totalBilledAll)}
              </div>
              <div className="rf-kpi__sub">
                {totalInvoices} {t("reportFinancial.invoices")}
              </div>
            </div>
            <div className="rf-kpi">
              <div className="rf-kpi__label">
                {t("reportFinancial.kpiTotalPaid")}
              </div>
              <div className="rf-kpi__value rf-kpi__value--success">
                CLP ${formatCompact(totalPaidAll)}
              </div>
              <div className="rf-kpi__sub">
                {totalBilledAll > 0
                  ? ((totalPaidAll / totalBilledAll) * 100).toFixed(0)
                  : 0}
                % {t("reportFinancial.collected")}
              </div>
            </div>
            <div className="rf-kpi">
              <div className="rf-kpi__label">
                {t("reportFinancial.kpiPendingCollection")}
              </div>
              <div className="rf-kpi__value rf-kpi__value--warning">
                CLP ${formatCompact(totalPendingAll)}
              </div>
              <div className="rf-kpi__sub">
                {
                  filteredByPeriod.filter(
                    (inv) => getInvoiceStatus(inv) === "pending",
                  ).length
                }{" "}
                {t("reportFinancial.pendingInvoices")}
              </div>
            </div>
            <div className="rf-kpi">
              <div className="rf-kpi__label">
                {t("reportFinancial.kpiOverdueInvoices")}
              </div>
              <div
                className={`rf-kpi__value ${overdueCount > 0 ? "rf-kpi__value--danger" : ""}`}
              >
                {overdueCount}
              </div>
              {forecast && (
                <div
                  className={`rf-kpi__change ${forecast.trend === "up" ? "rf-kpi__change--up" : "rf-kpi__change--down"}`}
                >
                  {forecast.trend === "up" ? "+" : "-"}{" "}
                  {t("reportFinancial.projMonth")} CLP $
                  {formatCompact(forecast.projectedBilling)}
                </div>
              )}
            </div>
          </div>

          {/* -- Alerts -------------------------------------- */}
          {alerts.length > 0 && (
            <div className="rf-alerts">
              {alerts.map((alert, i) => (
                <div key={i} className={`rf-alert rf-alert--${alert.type}`}>
                  <span className="rf-alert__icon">
                    {alert.type === "danger" ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    ) : alert.type === "warning" ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    )}
                  </span>
                  <div className="rf-alert__text">
                    <div className="rf-alert__title">{alert.title}</div>
                    <div>{alert.text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* -- Dashboard tabs ------------------------------ */}
          <div className="rf-tabs">
            <div className="rf-tabs__nav">
              {(
                [
                  { key: "summary", label: t("reportFinancial.tabSummary") },
                  { key: "expenses", label: t("reportFinancial.tabExpenses") },
                  { key: "invoices", label: t("reportFinancial.tabInvoices") },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  className={`rf-tabs__btn ${dashTab === tab.key ? "rf-tabs__btn--active" : ""}`}
                  onClick={() => setDashTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ============================
                TAB: Resumen Ejecutivo
                ============================ */}
            {dashTab === "summary" && (
              <div
                className="rf-tabs__panel"
                style={{ animation: "rf-tabFadeIn 0.2s ease" }}
              >
                {/* Monthly billing trend */}
                <div className="rf-panel__row">
                  <div className="rf-panel">
                    <h3 className="rf-panel__title">
                      {t("reportFinancial.panelBillingTrend")}
                    </h3>
                    {monthlyTrendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={monthlyTrendData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f3f4f6"
                          />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                            tickFormatter={(v) => formatCompact(v)}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="billed"
                            name={t("reportFinancial.chartBilled")}
                            stroke="#ff6200"
                            fill="rgba(255,98,0,0.08)"
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="paid"
                            name={t("reportFinancial.chartPaid")}
                            stroke="#047857"
                            fill="rgba(4,120,87,0.06)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <p style={{ color: "#9ca3af", fontSize: "0.8125rem" }}>
                        {t("reportFinancial.noDataChart")}
                      </p>
                    )}
                  </div>

                  <div className="rf-panel">
                    <h3 className="rf-panel__title">
                      {t("reportFinancial.panelStatusDistribution")}
                    </h3>
                    {statusDistribution.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={statusDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {statusDistribution.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number) => [
                                `${value} ${t("reportFinancial.invoices")}`,
                                "",
                              ]}
                              contentStyle={{
                                fontSize: "0.75rem",
                                borderRadius: 4,
                                border: "1px solid #e5e7eb",
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div
                          className="rf-legend"
                          style={{ justifyContent: "center" }}
                        >
                          {statusDistribution.map((d, i) => (
                            <span key={i} className="rf-legend__item">
                              <span
                                className="rf-legend__dot"
                                style={{ backgroundColor: d.color }}
                              />
                              {d.name} ({d.value})
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p style={{ color: "#9ca3af", fontSize: "0.8125rem" }}>
                        {t("reportFinancial.noInvoices")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Forecast + currency breakdown */}
                <div className="rf-panel__row">
                  <div className="rf-panel">
                    <h3 className="rf-panel__title">
                      {t("reportFinancial.panelForecast")}
                    </h3>
                    {forecast ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                        }}
                      >
                        <div className="rf-totals-row">
                          <span className="rf-totals-row__label">
                            {t("reportFinancial.forecastBilling")}
                          </span>
                          <span className="rf-totals-row__value">
                            CLP ${formatCompact(forecast.projectedBilling)}
                          </span>
                        </div>
                        <div className="rf-totals-row">
                          <span className="rf-totals-row__label">
                            {t("reportFinancial.forecastCollection")}
                          </span>
                          <span
                            className="rf-totals-row__value"
                            style={{ color: "#047857" }}
                          >
                            CLP ${formatCompact(forecast.projectedCollection)}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#9ca3af",
                            marginTop: 4,
                          }}
                        >
                          {t("reportFinancial.forecastBasis", {
                            count: Math.min(3, monthlyTrendData.length),
                          })}
                        </div>
                      </div>
                    ) : (
                      <p style={{ color: "#9ca3af", fontSize: "0.8125rem" }}>
                        {t("reportFinancial.forecastNeedData")}
                      </p>
                    )}
                  </div>

                  <div className="rf-panel">
                    <h3 className="rf-panel__title">
                      {t("reportFinancial.panelCurrencySummary")}
                    </h3>
                    {Object.entries(metricsByCurrency).length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        {Object.entries(metricsByCurrency).map(
                          ([currency, m]) => (
                            <div key={currency}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: "0.8125rem",
                                  marginBottom: 4,
                                }}
                              >
                                <span style={{ fontWeight: 600 }}>
                                  {currency}
                                </span>
                                <span style={{ color: "#6b7280" }}>
                                  {m.count} {t("reportFinancial.invoices")}
                                </span>
                              </div>
                              <div className="rf-breakdown">
                                <div
                                  className="rf-breakdown__seg"
                                  style={{
                                    width: `${m.totalBilled > 0 ? (m.totalPaid / m.totalBilled) * 100 : 0}%`,
                                    backgroundColor: "#047857",
                                  }}
                                />
                                <div
                                  className="rf-breakdown__seg"
                                  style={{
                                    width: `${m.totalBilled > 0 ? (m.totalPending / m.totalBilled) * 100 : 0}%`,
                                    backgroundColor: "#d97706",
                                  }}
                                />
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: "0.6875rem",
                                  color: "#9ca3af",
                                  marginTop: 2,
                                }}
                              >
                                <span>
                                  {t("reportFinancial.currencyPaid")}{" "}
                                  {formatCurrency(m.totalPaid, currency)}
                                </span>
                                <span>
                                  {t("reportFinancial.currencyPending")}{" "}
                                  {formatCurrency(m.totalPending, currency)}
                                </span>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <p style={{ color: "#9ca3af", fontSize: "0.8125rem" }}>
                        {t("reportFinancial.noData")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ============================
                TAB: Analisis de Gastos
                ============================ */}
            {dashTab === "expenses" && (
              <div
                className="rf-tabs__panel"
                style={{ animation: "rf-tabFadeIn 0.2s ease" }}
              >
                <div className="rf-panel__row">
                  <div className="rf-panel">
                    <h3 className="rf-panel__title">
                      {t("reportFinancial.panelExpenseConcentration")}
                    </h3>
                    {expenseConcentration.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart
                          data={expenseConcentration}
                          layout="vertical"
                          margin={{ left: 20 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f3f4f6"
                          />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                            tickFormatter={(v) => formatCompact(v)}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 10, fill: "#6b7280" }}
                            width={120}
                          />
                          <Tooltip
                            formatter={(value: number) => [
                              formatCurrency(value, "USD"),
                              t("reportFinancial.chargesAmount"),
                            ]}
                            contentStyle={{
                              fontSize: "0.75rem",
                              borderRadius: 4,
                              border: "1px solid #e5e7eb",
                            }}
                          />
                          <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                            {expenseConcentration.map((_, i) => (
                              <Cell
                                key={i}
                                fill={CHART_COLORS[i % CHART_COLORS.length]}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p style={{ color: "#9ca3af", fontSize: "0.8125rem" }}>
                        {t("reportFinancial.noChargesData")}
                      </p>
                    )}
                  </div>

                  <div className="rf-panel">
                    <h3 className="rf-panel__title">
                      {t("reportFinancial.panelTopCategories")}
                    </h3>
                    {expenseConcentration.length > 0 ? (
                      <ul className="rf-rank-list">
                        {expenseConcentration.map((item, i) => {
                          const totalExp = expenseConcentration.reduce(
                            (s, e) => s + e.value,
                            0,
                          );
                          const pct =
                            totalExp > 0
                              ? ((item.value / totalExp) * 100).toFixed(1)
                              : "0";
                          return (
                            <li key={i} className="rf-rank-item">
                              <div className="rf-rank-item__left">
                                <span className="rf-rank-item__pos">
                                  {i + 1}
                                </span>
                                <span className="rf-rank-item__name">
                                  {item.name}
                                </span>
                              </div>
                              <span className="rf-rank-item__value">
                                {pct}%
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p style={{ color: "#9ca3af", fontSize: "0.8125rem" }}>
                        {t("reportFinancial.noData")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Service type + payment term */}
                <div className="rf-panel__row">
                  <div className="rf-panel">
                    <h3 className="rf-panel__title">
                      {t("reportFinancial.panelServiceType")}
                    </h3>
                    {serviceTypeBreakdown.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={serviceTypeBreakdown}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={75}
                              paddingAngle={3}
                              dataKey="total"
                            >
                              {serviceTypeBreakdown.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number) => [
                                formatCurrency(value, "CLP"),
                                t("reportFinancial.thTotal"),
                              ]}
                              contentStyle={{
                                fontSize: "0.75rem",
                                borderRadius: 4,
                                border: "1px solid #e5e7eb",
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div
                          className="rf-legend"
                          style={{ justifyContent: "center" }}
                        >
                          {serviceTypeBreakdown.map((d, i) => (
                            <span key={i} className="rf-legend__item">
                              <span
                                className="rf-legend__dot"
                                style={{
                                  backgroundColor:
                                    CHART_COLORS[i % CHART_COLORS.length],
                                }}
                              />
                              {d.name} ({d.count})
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p style={{ color: "#9ca3af", fontSize: "0.8125rem" }}>
                        {t("reportFinancial.noData")}
                      </p>
                    )}
                  </div>

                  <div className="rf-panel">
                    <h3 className="rf-panel__title">
                      {t("reportFinancial.panelPaymentTerm")}
                    </h3>
                    {paymentTermBreakdown.length > 0 ? (
                      <ul className="rf-rank-list">
                        {paymentTermBreakdown.map((item, i) => (
                          <li key={i} className="rf-rank-item">
                            <div className="rf-rank-item__left">
                              <span className="rf-rank-item__pos">{i + 1}</span>
                              <span className="rf-rank-item__name">
                                {item.name}
                              </span>
                            </div>
                            <span className="rf-rank-item__value">
                              {formatCurrency(item.total, "CLP")} ({item.count})
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ color: "#9ca3af", fontSize: "0.8125rem" }}>
                        {t("reportFinancial.noData")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ============================
                TAB: Detalle Facturas
                ============================ */}
            {dashTab === "invoices" && (
              <div
                className="rf-tabs__panel"
                style={{ animation: "rf-tabFadeIn 0.2s ease" }}
              >
                <div className="rf-table-wrapper">
                  <div className="rf-table-scroll">
                    <table className="rf-table">
                      <thead>
                        <tr>
                          <th
                            className="rf-th rf-th--left rf-th--sortable"
                            onClick={() => handleSort("number")}
                          >
                            <span>{t("reportFinancial.thInvoiceNumber")}</span>
                            <SortIcon column="number" />
                          </th>
                          <th
                            className="rf-th rf-th--center rf-th--sortable"
                            onClick={() => handleSort("status")}
                          >
                            <span>{t("reportFinancial.thStatus")}</span>
                            <SortIcon column="status" />
                          </th>
                          <th className="rf-th">
                            <span>{t("reportFinancial.thShipment")}</span>
                          </th>
                          <th className="rf-th">
                            <span>{t("reportFinancial.thPaymentTerm")}</span>
                          </th>
                          <th
                            className="rf-th rf-th--right rf-th--sortable"
                            onClick={() => handleSort("total")}
                          >
                            <span>{t("reportFinancial.thTotal")}</span>
                            <SortIcon column="total" />
                          </th>
                          <th
                            className="rf-th rf-th--sortable"
                            onClick={() => handleSort("date")}
                          >
                            <span>{t("reportFinancial.thDate")}</span>
                            <SortIcon column="date" />
                          </th>
                          <th
                            className="rf-th rf-th--sortable"
                            onClick={() => handleSort("dueDate")}
                          >
                            <span>{t("reportFinancial.thDueDate")}</span>
                            <SortIcon column="dueDate" />
                          </th>
                          <th
                            className="rf-th rf-th--right rf-th--sortable"
                            onClick={() => handleSort("balance")}
                          >
                            <span>{t("reportFinancial.thBalance")}</span>
                            <SortIcon column="balance" />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedInvoices.map((invoice, index) => {
                          const invoiceKey =
                            invoice.id || invoice.number || index;
                          const isExpanded = expandedIds.includes(
                            invoice.id || invoice.number || "",
                          );
                          const status = getInvoiceStatus(invoice);

                          return (
                            <React.Fragment key={invoiceKey}>
                              <tr
                                className={`rf-tr ${isExpanded ? "rf-tr--active" : ""}`}
                                onClick={() => toggleAccordion(invoice)}
                              >
                                <td className="rf-td rf-td--number">
                                  <svg
                                    className={`rf-row-chevron ${isExpanded ? "rf-row-chevron--open" : ""}`}
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                  >
                                    <polyline points="9 18 15 12 9 6" />
                                  </svg>
                                  {invoice.notes
                                    ? invoice.notes.split("@")[0]
                                    : invoice.number || "---"}
                                </td>
                                <td className="rf-td rf-td--center">
                                  <StatusBadge status={status} />
                                </td>
                                <td className="rf-td rf-td--shipment">
                                  {invoice.shipment?.number || "---"}
                                </td>
                                <td className="rf-td">
                                  {invoice.paymentTerm?.name || "---"}
                                </td>
                                <td className="rf-td rf-td--right rf-td--bold">
                                  {formatCurrency(
                                    invoice.totalAmount?.value || 0,
                                    "CLP",
                                  )}
                                </td>
                                <td className="rf-td">
                                  {formatDateShort(invoice.date)}
                                </td>
                                <td className="rf-td">
                                  {formatDateShort(invoice.dueDate)}
                                </td>
                                <td className="rf-td rf-td--right rf-td--bold">
                                  {getConvertedBalance(invoice)}
                                </td>
                              </tr>

                              {/* Accordion content */}
                              {isExpanded && (
                                <tr className="rf-accordion-row">
                                  <td colSpan={8} className="rf-accordion-cell">
                                    <div className="rf-accordion-content">
                                      <DetailTabs
                                        tabs={[
                                          {
                                            key: "info",
                                            label: t(
                                              "reportFinancial.tabGeneral",
                                            ),
                                            content: (
                                              <div className="rf-cards-grid">
                                                <div className="rf-card">
                                                  <h4>
                                                    {t(
                                                      "reportFinancial.cardInvoiceData",
                                                    )}
                                                  </h4>
                                                  <div className="rf-info-grid">
                                                    <InfoField
                                                      label={t(
                                                        "reportFinancial.fieldInvoiceInternal",
                                                      )}
                                                      value={invoice.number}
                                                    />
                                                    <InfoField
                                                      label={t(
                                                        "reportFinancial.fieldInvoiceNumber",
                                                      )}
                                                      value={
                                                        invoice.notes
                                                          ? invoice.notes.split(
                                                              "@",
                                                            )[0]
                                                          : null
                                                      }
                                                    />
                                                    <InfoField
                                                      label={t(
                                                        "reportFinancial.fieldIssueDate",
                                                      )}
                                                      value={formatDate(
                                                        invoice.date,
                                                      )}
                                                    />
                                                    <InfoField
                                                      label={t(
                                                        "reportFinancial.fieldDueDate",
                                                      )}
                                                      value={formatDate(
                                                        invoice.dueDate,
                                                      )}
                                                    />
                                                    <InfoField
                                                      label={t(
                                                        "reportFinancial.fieldCurrency",
                                                      )}
                                                      value={
                                                        invoice.currency?.name
                                                          ? `${invoice.currency.name} (${invoice.currency.abbr})`
                                                          : invoice.currency
                                                              ?.abbr
                                                      }
                                                    />
                                                    <InfoField
                                                      label={t(
                                                        "reportFinancial.fieldStatus",
                                                      )}
                                                      value={
                                                        {
                                                          paid: t(
                                                            "reportFinancial.statusPaid",
                                                          ),
                                                          pending: t(
                                                            "reportFinancial.statusPending",
                                                          ),
                                                          overdue: t(
                                                            "reportFinancial.statusOverdue",
                                                          ),
                                                        }[status]
                                                      }
                                                    />
                                                  </div>
                                                </div>
                                                <div className="rf-card">
                                                  <h4>
                                                    {t(
                                                      "reportFinancial.cardShipment",
                                                    )}
                                                  </h4>
                                                  <div className="rf-info-grid">
                                                    <InfoField
                                                      label={t(
                                                        "reportFinancial.fieldShipmentNumber",
                                                      )}
                                                      value={
                                                        invoice.shipment?.number
                                                      }
                                                    />
                                                    <InfoField
                                                      label={t(
                                                        "reportFinancial.fieldServiceType",
                                                      )}
                                                      value={getServiceType(
                                                        invoice.shipment
                                                          ?.number,
                                                      )}
                                                    />
                                                    <InfoField
                                                      label={t(
                                                        "reportFinancial.fieldWaybill",
                                                      )}
                                                      value={
                                                        invoice.shipment
                                                          ?.waybillNumber
                                                      }
                                                    />
                                                    <InfoField
                                                      label={t(
                                                        "reportFinancial.fieldCustomerRef",
                                                      )}
                                                      value={
                                                        invoice.shipment
                                                          ?.customerReference
                                                      }
                                                    />
                                                    <InfoField
                                                      label={t(
                                                        "reportFinancial.fieldConsignee",
                                                      )}
                                                      value={
                                                        invoice.shipment
                                                          ?.consignee?.name
                                                      }
                                                    />
                                                  </div>
                                                </div>
                                                <div className="rf-card">
                                                  <h4>
                                                    {t(
                                                      "reportFinancial.cardBilledTo",
                                                    )}
                                                  </h4>
                                                  <div className="rf-info-grid">
                                                    <InfoField
                                                      label={t(
                                                        "reportFinancial.fieldName",
                                                      )}
                                                      value={
                                                        invoice.billTo?.name
                                                      }
                                                    />
                                                    <InfoField
                                                      label={t(
                                                        "reportFinancial.fieldRutId",
                                                      )}
                                                      value={
                                                        invoice.billTo
                                                          ?.identificationNumber
                                                      }
                                                    />
                                                    <InfoField
                                                      label={t(
                                                        "reportFinancial.fieldAddress",
                                                      )}
                                                      value={
                                                        invoice.billToAddress
                                                      }
                                                      fullWidth
                                                    />
                                                  </div>
                                                </div>
                                              </div>
                                            ),
                                          },
                                          {
                                            key: "charges",
                                            label: t(
                                              "reportFinancial.tabCharges",
                                            ),
                                            hidden:
                                              !invoice.charges ||
                                              invoice.charges.length === 0,
                                            content: (
                                              <div
                                                style={{ overflowX: "auto" }}
                                              >
                                                <table className="rf-charges-table">
                                                  <thead>
                                                    <tr>
                                                      <th>
                                                        {t(
                                                          "reportFinancial.chargesDescription",
                                                        )}
                                                      </th>
                                                      <th className="rf-charges-table--right">
                                                        {t(
                                                          "reportFinancial.chargesQuantity",
                                                        )}
                                                      </th>
                                                      <th className="rf-charges-table--right">
                                                        {t(
                                                          "reportFinancial.chargesRate",
                                                        )}{" "}
                                                        (
                                                        {invoice.currency
                                                          ?.abbr || "USD"}
                                                        )
                                                      </th>
                                                      <th className="rf-charges-table--right">
                                                        {t(
                                                          "reportFinancial.chargesAmount",
                                                        )}{" "}
                                                        (
                                                        {invoice.currency
                                                          ?.abbr || "USD"}
                                                        )
                                                      </th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {processCharges(
                                                      invoice.charges || [],
                                                    ).map((charge, idx) => (
                                                      <tr key={idx}>
                                                        <td>
                                                          {charge.description}
                                                        </td>
                                                        <td className="rf-charges-table--right">
                                                          {charge.quantity}{" "}
                                                          {charge.unit}
                                                        </td>
                                                        <td className="rf-charges-table--right">
                                                          {formatCurrency(
                                                            charge.rate || 0,
                                                            invoice.currency
                                                              ?.abbr || "USD",
                                                            3,
                                                          )}
                                                        </td>
                                                        <td className="rf-charges-table--right rf-charges-table--bold">
                                                          {formatCurrency(
                                                            charge.amount || 0,
                                                            invoice.currency
                                                              ?.abbr || "USD",
                                                          )}
                                                        </td>
                                                      </tr>
                                                    ))}
                                                    <tr className="rf-charges-total-row">
                                                      <td
                                                        colSpan={3}
                                                        style={{
                                                          textAlign: "right",
                                                        }}
                                                      >
                                                        {t(
                                                          "reportFinancial.chargesTotal",
                                                        )}
                                                      </td>
                                                      <td
                                                        style={{
                                                          textAlign: "right",
                                                        }}
                                                      >
                                                        {formatCurrency(
                                                          processCharges(
                                                            invoice.charges ||
                                                              [],
                                                          ).reduce(
                                                            (sum, c) =>
                                                              sum +
                                                              (c.amount || 0),
                                                            0,
                                                          ),
                                                          invoice.currency
                                                            ?.abbr || "USD",
                                                        )}
                                                      </td>
                                                    </tr>
                                                    {getExchangeRateText(
                                                      invoice,
                                                    ) && (
                                                      <tr className="rf-charges-exchange-row">
                                                        <td
                                                          colSpan={3}
                                                          style={{
                                                            textAlign: "right",
                                                          }}
                                                        >
                                                          {t(
                                                            "reportFinancial.chargesExchangeRate",
                                                          )}
                                                        </td>
                                                        <td
                                                          style={{
                                                            textAlign: "right",
                                                          }}
                                                        >
                                                          {getExchangeRateText(
                                                            invoice,
                                                          )}
                                                        </td>
                                                      </tr>
                                                    )}
                                                  </tbody>
                                                </table>
                                              </div>
                                            ),
                                          },
                                          {
                                            key: "totals",
                                            label: t(
                                              "reportFinancial.tabTotals",
                                            ),
                                            content: (
                                              <div className="rf-totals-list">
                                                <div className="rf-totals-row">
                                                  <span className="rf-totals-row__label">
                                                    {t(
                                                      "reportFinancial.totalsSubtotal",
                                                    )}
                                                  </span>
                                                  <span className="rf-totals-row__value">
                                                    {formatCurrency(
                                                      invoice.amount?.value ||
                                                        0,
                                                      "CLP",
                                                    )}
                                                  </span>
                                                </div>
                                                <div className="rf-totals-row">
                                                  <span className="rf-totals-row__label">
                                                    {t(
                                                      "reportFinancial.totalsIVA",
                                                    )}
                                                  </span>
                                                  <span className="rf-totals-row__value">
                                                    {formatCurrency(
                                                      invoice.taxAmount
                                                        ?.value || 0,
                                                      "CLP",
                                                    )}
                                                  </span>
                                                </div>
                                                <div className="rf-totals-row rf-totals-row--total">
                                                  <span className="rf-totals-row__label">
                                                    {t(
                                                      "reportFinancial.totalsTotal",
                                                    )}
                                                  </span>
                                                  <span className="rf-totals-row__value">
                                                    {formatCurrency(
                                                      invoice.totalAmount
                                                        ?.value || 0,
                                                      "CLP",
                                                    )}
                                                  </span>
                                                </div>
                                                <div
                                                  className={`rf-totals-row rf-totals-row--balance rf-totals-row--balance-${status}`}
                                                >
                                                  <span className="rf-totals-row__label">
                                                    {t(
                                                      "reportFinancial.totalsBalance",
                                                    )}
                                                  </span>
                                                  <span className="rf-totals-row__value">
                                                    {getConvertedBalance(
                                                      invoice,
                                                    )}
                                                  </span>
                                                </div>
                                              </div>
                                            ),
                                          },
                                        ]}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* -- Table footer / pagination ------------ */}
                  <div className="rf-table-footer">
                    <div className="rf-table-footer__left">
                      {hasMoreInvoices && !loadingMore && (
                        <button className="rf-btn" onClick={loadMoreInvoices}>
                          {t("reportFinancial.loadMoreInvoices")}
                        </button>
                      )}
                      {loadingMore && (
                        <span
                          style={{ fontSize: "0.8125rem", color: "#9ca3af" }}
                        >
                          {t("reportFinancial.loadingEllipsis")}
                        </span>
                      )}
                    </div>
                    <div className="rf-table-footer__right">
                      <span className="rf-pagination-label">
                        {t("reportFinancial.rowsPerPage")}
                      </span>
                      <select
                        className="rf-pagination-select"
                        value={rowsPerPage}
                        onChange={(e) => {
                          setRowsPerPage(Number(e.target.value));
                          setTablePage(1);
                        }}
                      >
                        <option value={10}>10</option>
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                      <span className="rf-pagination-range">
                        {paginationRangeText}
                      </span>
                      <button
                        className="rf-pagination-btn"
                        disabled={tablePage <= 1}
                        onClick={() => setTablePage((p) => p - 1)}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </button>
                      <button
                        className="rf-pagination-btn"
                        disabled={tablePage >= totalTablePages}
                        onClick={() => setTablePage((p) => p + 1)}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* -- Footer -------------------------------- */}
                <div className="rf-footer">
                  <span className="rf-footer__count">
                    {t("reportFinancial.footerTotal")}{" "}
                    <strong>{sortedInvoices.length}</strong>{" "}
                    {t("reportFinancial.invoices")}
                  </span>
                  {hasMoreInvoices && (
                    <button
                      className="rf-btn"
                      onClick={loadMoreInvoices}
                      disabled={loadingMore}
                    >
                      {loadingMore
                        ? t("reportFinancial.loadingEllipsis")
                        : t("reportFinancial.loadMoreInvoices")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* -- Empty state -------------------------------------- */}
      {!loading && invoices.length === 0 && !error && (
        <div className="rf-empty">
          <p className="rf-empty__title">{t("reportFinancial.emptyTitle")}</p>
          <p className="rf-empty__subtitle">
            {t("reportFinancial.emptySubtitle")}
          </p>
        </div>
      )}

      {/* -- Loading more toast ------------------------------- */}
      {loadingMore && (
        <div className="rf-loading-toast">
          <div className="rf-loading-toast__spinner" />
          {t("reportFinancial.loadingMoreInvoices")}
        </div>
      )}
    </div>
  );
}

export default ReporteriaFinanciera;
