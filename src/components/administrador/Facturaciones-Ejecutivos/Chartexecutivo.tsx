// src/components/administrador/Facturaciones-Ejecutivos/Chartexecutivo.tsx
// Charts for Executive Reporting — Seemann Group
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { QuoteStats, ExecutiveComparison } from "./types";

interface ChartProps {
  data?: QuoteStats;
  comparativeData?: ExecutiveComparison[];
  doubleData?: ExecutiveComparison[];
  type: "individual" | "comparativa" | "doble";
}

const FONT =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const C = {
  primary: "#ff6200",
  secondary: "#1a1a1a",
  textMuted: "#6b7280",
  border: "#e5e7eb",
  borderLight: "#f3f4f6",
  bg: "#f8f9fa",
  white: "#ffffff",
  positive: "#059669",
  negative: "#dc2626",
  textLight: "#9ca3af",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const fmtShort = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const cardStyle = {
  backgroundColor: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: 20,
  fontFamily: FONT,
};

const titleStyle = {
  fontSize: 11,
  fontWeight: 600 as const,
  color: C.textMuted,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  marginBottom: 16,
  fontFamily: FONT,
};

interface TooltipEntry {
  dataKey: string;
  name: string;
  value: number;
  payload: { name?: string; nombre?: string; nombreCompleto?: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const entries = payload as TooltipEntry[];
  return (
    <div
      style={{
        backgroundColor: C.white,
        padding: "10px 14px",
        borderRadius: 4,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: `1px solid ${C.border}`,
        fontFamily: FONT,
      }}
    >
      <p
        style={{
          margin: 0,
          fontWeight: 600,
          color: C.secondary,
          fontSize: 12,
          marginBottom: 2,
        }}
      >
        {entries[0].payload.name || entries[0].payload.nombre}
      </p>
      {entries.map((entry, i) => {
        const isFinancial =
          entry.dataKey === "Income" ||
          entry.dataKey === "Expense" ||
          entry.dataKey === "Profit" ||
          entry.dataKey === "value" ||
          (typeof entry.name === "string" && entry.name.includes("Income")) ||
          (typeof entry.name === "string" && entry.name.includes("Expense")) ||
          (typeof entry.name === "string" && entry.name.includes("Profit"));
        return (
          <p
            key={i}
            style={{
              margin: "2px 0 0",
              color: C.textMuted,
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {entry.name && entry.name !== entries[0].payload.name
              ? `${entry.name}: `
              : ""}
            {isFinancial ? fmt(entry.value) : entry.value}
          </p>
        );
      })}
    </div>
  );
};

const axisProps = {
  tick: { fill: C.textMuted, fontSize: 11, fontFamily: FONT },
  axisLine: { stroke: C.border },
  tickLine: false as const,
};

function ChartExecutivo({
  data,
  comparativeData,
  doubleData,
  type,
}: ChartProps) {
  // ─── INDIVIDUAL ───
  if (type === "individual" && data) {
    const statusData = [
      { name: "Completed", value: data.completedQuotes },
      { name: "Pending", value: data.pendingQuotes },
    ].filter((d) => d.value > 0);

    const typeData = [
      { name: "Air", value: data.airQuotes },
      { name: "Sea", value: data.seaQuotes },
      { name: "Truck", value: data.truckQuotes },
    ].filter((d) => d.value > 0);

    const financialData = [
      { name: "Income", value: data.totalIncome },
      { name: "Expense", value: data.totalExpense },
      { name: "Profit", value: data.totalProfit },
    ];

    return (
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}
      >
        {statusData.length > 0 && (
          <div style={cardStyle}>
            <div style={titleStyle}>Quote Status</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={statusData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={C.borderLight}
                  vertical={false}
                />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: C.bg }} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? C.secondary : C.textLight} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {typeData.length > 0 && (
          <div style={cardStyle}>
            <div style={titleStyle}>Transport Type</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={typeData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={C.borderLight}
                  vertical={false}
                />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: C.bg }} />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {typeData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.name === "Air"
                          ? C.primary
                          : entry.name === "Sea"
                            ? C.secondary
                            : C.textMuted
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div style={cardStyle}>
          <div style={titleStyle}>Financial Breakdown</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={financialData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={C.borderLight}
                vertical={false}
              />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={fmtShort} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: C.bg }} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {financialData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={
                      i === 0 ? C.positive : i === 1 ? C.negative : C.primary
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // ─── COMPARATIVA ───
  if (type === "comparativa" && comparativeData && comparativeData.length > 0) {
    const top5Profit = [...comparativeData]
      .sort((a, b) => b.stats.totalProfit - a.stats.totalProfit)
      .slice(0, 5)
      .map((ex) => ({
        nombre:
          ex.nombre.length > 12
            ? ex.nombre.substring(0, 12) + "..."
            : ex.nombre,
        nombreCompleto: ex.nombre,
        value: ex.stats.totalProfit,
      }));

    const top5Quotes = [...comparativeData]
      .sort((a, b) => b.stats.totalQuotes - a.stats.totalQuotes)
      .slice(0, 5)
      .map((ex) => ({
        nombre:
          ex.nombre.length > 12
            ? ex.nombre.substring(0, 12) + "..."
            : ex.nombre,
        nombreCompleto: ex.nombre,
        value: ex.stats.totalQuotes,
      }));

    const top5Margin = [...comparativeData]
      .sort((a, b) => b.stats.profitMargin - a.stats.profitMargin)
      .slice(0, 5)
      .map((ex) => ({
        nombre:
          ex.nombre.length > 12
            ? ex.nombre.substring(0, 12) + "..."
            : ex.nombre,
        nombreCompleto: ex.nombre,
        value: ex.stats.profitMargin,
      }));

    const top6Financial = [...comparativeData]
      .sort((a, b) => b.stats.totalIncome - a.stats.totalIncome)
      .slice(0, 6)
      .map((ex) => ({
        nombre:
          ex.nombre.length > 10
            ? ex.nombre.substring(0, 10) + "..."
            : ex.nombre,
        nombreCompleto: ex.nombre,
        Income: ex.stats.totalIncome,
        Expense: ex.stats.totalExpense,
      }));

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={cardStyle}>
          <div style={titleStyle}>Top 5 by Profit</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top5Profit} margin={{ bottom: 50 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={C.borderLight}
                vertical={false}
              />
              <XAxis
                dataKey="nombre"
                angle={-35}
                textAnchor="end"
                height={70}
                {...axisProps}
              />
              <YAxis {...axisProps} tickFormatter={fmtShort} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: C.bg }} />
              <Bar dataKey="value" fill={C.primary} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={cardStyle}>
          <div style={titleStyle}>Top 5 by Quotes</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top5Quotes} margin={{ bottom: 50 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={C.borderLight}
                vertical={false}
              />
              <XAxis
                dataKey="nombre"
                angle={-35}
                textAnchor="end"
                height={70}
                {...axisProps}
              />
              <YAxis {...axisProps} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: C.bg }} />
              <Bar dataKey="value" fill={C.secondary} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={cardStyle}>
          <div style={titleStyle}>Top 5 by Profit Margin (%)</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top5Margin} margin={{ bottom: 50 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={C.borderLight}
                vertical={false}
              />
              <XAxis
                dataKey="nombre"
                angle={-35}
                textAnchor="end"
                height={70}
                {...axisProps}
              />
              <YAxis {...axisProps} tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <Tooltip
                content={({
                  active,
                  payload,
                }: {
                  active?: boolean;
                  payload?: Record<string, unknown>[];
                }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div
                      style={{
                        backgroundColor: C.white,
                        padding: "10px 14px",
                        borderRadius: 4,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        border: `1px solid ${C.border}`,
                        fontFamily: FONT,
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 600,
                          color: C.secondary,
                          fontSize: 12,
                        }}
                      >
                        {(payload[0] as Record<string, unknown>).payload
                          ? ((
                              (payload[0] as Record<string, unknown>)
                                .payload as Record<string, unknown>
                            ).nombreCompleto as string)
                          : ""}
                      </p>
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontWeight: 600,
                          color: C.textMuted,
                          fontSize: 13,
                        }}
                      >
                        {(
                          (payload[0] as Record<string, unknown>)
                            .value as number
                        ).toFixed(1)}
                        %
                      </p>
                    </div>
                  );
                }}
                cursor={{ fill: C.bg }}
              />
              <Bar dataKey="value" fill={C.positive} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={cardStyle}>
          <div style={titleStyle}>Income vs Expense (Top 6)</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top6Financial} margin={{ bottom: 50 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={C.borderLight}
                vertical={false}
              />
              <XAxis
                dataKey="nombre"
                angle={-35}
                textAnchor="end"
                height={70}
                {...axisProps}
              />
              <YAxis {...axisProps} tickFormatter={fmtShort} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: C.bg }} />
              <Bar dataKey="Income" fill={C.positive} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Expense" fill={C.negative} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // ─── DOBLE ───
  if (type === "doble" && doubleData && doubleData.length === 2) {
    const [e1, e2] = doubleData;

    const metricsData = [
      {
        name: "Total",
        [e1.nombre]: e1.stats.totalQuotes,
        [e2.nombre]: e2.stats.totalQuotes,
      },
      {
        name: "Completed",
        [e1.nombre]: e1.stats.completedQuotes,
        [e2.nombre]: e2.stats.completedQuotes,
      },
      {
        name: "Air",
        [e1.nombre]: e1.stats.airQuotes,
        [e2.nombre]: e2.stats.airQuotes,
      },
      {
        name: "Sea",
        [e1.nombre]: e1.stats.seaQuotes,
        [e2.nombre]: e2.stats.seaQuotes,
      },
      {
        name: "Truck",
        [e1.nombre]: e1.stats.truckQuotes,
        [e2.nombre]: e2.stats.truckQuotes,
      },
      {
        name: "Clients",
        [e1.nombre]: e1.stats.uniqueConsignees,
        [e2.nombre]: e2.stats.uniqueConsignees,
      },
    ];

    const financialData = [
      {
        name: "Income",
        [e1.nombre]: e1.stats.totalIncome,
        [e2.nombre]: e2.stats.totalIncome,
      },
      {
        name: "Expense",
        [e1.nombre]: e1.stats.totalExpense,
        [e2.nombre]: e2.stats.totalExpense,
      },
      {
        name: "Profit",
        [e1.nombre]: e1.stats.totalProfit,
        [e2.nombre]: e2.stats.totalProfit,
      },
    ];

    const efficiencyData = [
      {
        name: "Completion %",
        [e1.nombre]: e1.stats.completionRate,
        [e2.nombre]: e2.stats.completionRate,
      },
      {
        name: "Margin %",
        [e1.nombre]: e1.stats.profitMargin,
        [e2.nombre]: e2.stats.profitMargin,
      },
    ];

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={cardStyle}>
          <div style={titleStyle}>Metrics Comparison</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metricsData} margin={{ bottom: 20 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={C.borderLight}
                vertical={false}
              />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: C.bg }} />
              <Bar dataKey={e1.nombre} fill={C.primary} radius={[3, 3, 0, 0]} />
              <Bar
                dataKey={e2.nombre}
                fill={C.secondary}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={cardStyle}>
          <div style={titleStyle}>Financial Comparison</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={financialData} margin={{ bottom: 20 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={C.borderLight}
                vertical={false}
              />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={fmtShort} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: C.bg }} />
              <Bar dataKey={e1.nombre} fill={C.primary} radius={[3, 3, 0, 0]} />
              <Bar
                dataKey={e2.nombre}
                fill={C.secondary}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
          <div style={titleStyle}>Efficiency Comparison (%)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={efficiencyData} margin={{ bottom: 20 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={C.borderLight}
                vertical={false}
              />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <Tooltip
                content={({
                  active,
                  payload,
                }: {
                  active?: boolean;
                  payload?: Record<string, unknown>[];
                }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div
                      style={{
                        backgroundColor: C.white,
                        padding: "10px 14px",
                        borderRadius: 4,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        border: `1px solid ${C.border}`,
                        fontFamily: FONT,
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 600,
                          color: C.secondary,
                          fontSize: 12,
                        }}
                      >
                        {
                          (
                            (payload[0] as Record<string, unknown>)
                              .payload as Record<string, unknown>
                          ).name as string
                        }
                      </p>
                      {payload.map(
                        (entry: Record<string, unknown>, i: number) => (
                          <p
                            key={i}
                            style={{
                              margin: "2px 0 0",
                              fontWeight: 600,
                              color: C.textMuted,
                              fontSize: 13,
                            }}
                          >
                            {entry.name as string}:{" "}
                            {(entry.value as number).toFixed(1)}%
                          </p>
                        ),
                      )}
                    </div>
                  );
                }}
                cursor={{ fill: C.bg }}
              />
              <Bar dataKey={e1.nombre} fill={C.primary} radius={[3, 3, 0, 0]} />
              <Bar
                dataKey={e2.nombre}
                fill={C.secondary}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // No data
  return (
    <div
      style={{
        ...cardStyle,
        padding: "40px 20px",
        textAlign: "center",
        color: C.textMuted,
        fontSize: 13,
      }}
    >
      No hay datos disponibles para mostrar gráficos
    </div>
  );
}

export default ChartExecutivo;
