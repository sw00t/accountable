import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { money, monthLabel, monthYear, shortMoney } from "../shared/format";
import { usePhone } from "../shared/phone";
import type { Dashboard } from "./hooks";
import "./dashboard-phone.css";

// Colors come from the brand tokens in shared/theme/tokens.css (RV9).
const axis = {
  fontSize: 11,
  fontFamily: "var(--mono)",
  fill: "var(--ink-muted)",
};

/**
 * H9: a phone labels every third month, counting back from the latest so this month always
 * has its label; a laptop labels each one.
 */
export function monthTicks(count: number, phone: boolean) {
  return (month: string, index: number) =>
    !phone || (count - 1 - index) % 3 === 0 ? monthLabel(month) : "";
}

/** The x axis and tooltip settings both charts share: labels as above, tooltips on a tap. */
function useMonthAxis(count: number) {
  const phone = usePhone();
  return {
    phone,
    tickFormatter: monthTicks(count, phone),
    // Every tick is drawn on a phone so the blank ones keep the spacing; a laptop keeps the default.
    interval: phone ? (0 as const) : undefined,
    trigger: phone ? ("click" as const) : ("hover" as const),
  };
}

function MoneyTip({ active, payload, label }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div>{monthYear(String(label))}</div>
      <b>{money(Number(payload[0].value))}</b> won
    </div>
  );
}

function CountTip({ active, payload, label }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;
  const won = payload.find((p) => p.dataKey === "won_count")?.value ?? 0;
  const lost = payload.find((p) => p.dataKey === "lost_count")?.value ?? 0;
  return (
    <div className="chart-tooltip">
      <div>{monthYear(String(label))}</div>
      <b>{won}</b> won, <b>{lost}</b> lost
    </div>
  );
}

/** H2: revenue won per month, Sea Green with the page's one gradient under it. */
export function RevenueChart({ months }: { months: Dashboard["months"] }) {
  const { phone, tickFormatter, interval, trigger } = useMonthAxis(months.length);
  return (
    <div
      className="chart"
      role="img"
      aria-label={`Revenue won per month: ${months.map((m) => `${monthYear(m.month)} ${money(m.won_value)}`).join(", ")}`}
    >
      <ResponsiveContainer width="100%" height={phone ? 180 : 320}>
        <AreaChart data={months} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--sea-green)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--sea-green)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="month"
            tickFormatter={tickFormatter}
            interval={interval}
            tick={axis}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={shortMoney}
            tick={axis}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            trigger={trigger}
            content={<MoneyTip />}
            cursor={{ stroke: "var(--sea-mist)" }}
          />
          <Area
            type="linear"
            dataKey="won_value"
            stroke="var(--sea-green)"
            strokeWidth={2.5}
            fill="url(#revenue-fill)"
            dot={{
              r: 3.5,
              fill: "var(--panel)",
              stroke: "var(--sea-green)",
              strokeWidth: 2,
            }}
            activeDot={{ r: 5, fill: "var(--sea-green)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** H3: deals won and lost per month, Sea Green and Coral. */
export function WonLostChart({ months }: { months: Dashboard["months"] }) {
  const { phone, tickFormatter, interval, trigger } = useMonthAxis(months.length);
  return (
    <div
      className="chart"
      role="img"
      aria-label={`Deals won and lost per month: ${months.map((m) => `${monthYear(m.month)} ${m.won_count} won, ${m.lost_count} lost`).join("; ")}`}
    >
      <ResponsiveContainer width="100%" height={phone ? 160 : 220}>
        <BarChart data={months} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={3}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="month"
            tickFormatter={tickFormatter}
            interval={interval}
            tick={axis}
            axisLine={false}
            tickLine={false}
          />
          <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} width={40} />
          <Tooltip trigger={trigger} content={<CountTip />} cursor={{ fill: "var(--hover)" }} />
          <Bar dataKey="won_count" fill="var(--sea-green)" radius={[3, 3, 0, 0]} maxBarSize={14} />
          <Bar dataKey="lost_count" fill="var(--coral)" radius={[3, 3, 0, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
