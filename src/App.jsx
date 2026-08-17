import React, { useState, useEffect, useRef } from "react";
import { subscribeToRemoteChanges } from "./cloudStorage";
import {
  LayoutDashboard, ArrowLeftRight, Target, Settings as SettingsIcon, PieChart as PieChartIcon,
  Shield, TrendingUp, TrendingDown, CreditCard, Home, Sparkles, Wallet, Landmark, Plus,
  ArrowDownCircle, ArrowUpCircle, Repeat, X, ChevronRight, AlertTriangle,
  CheckCircle2, Calendar, Info, Trash2, Car, Package, PiggyBank,
  Rocket, Pencil, RefreshCw, Minus, Users, User, Moon, Sun, Monitor,
  Wand2, Undo2, ArrowDownToLine, Sprout, HelpCircle,
  ListChecks, ShoppingCart, Briefcase, GraduationCap, Circle, CheckCircle
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

/* ============================================================
   UTILIDADES
   ============================================================ */

const STORAGE_KEY = "finanzas-familia-v2";
const GS_FMT = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 });
const fmt = (n) => "Gs. " + GS_FMT.format(Math.round(Number(n) || 0));
const fmtSigned = (n) => (n < 0 ? "-Gs. " + GS_FMT.format(Math.abs(Math.round(n))) : "+" + fmt(n));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => new Date().toISOString().slice(0, 10);
const ym = (dateStr) => (dateStr || today()).slice(0, 7);
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const pct1 = (n) => (n * 100).toFixed(1) + "%";

const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function humanDate(d) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getDate()} de ${MONTHS_ES[dt.getMonth()]}`;
}
function monthLabel(ymStr) {
  const [y, m] = ymStr.split("-").map(Number);
  return `${MONTHS_ES[m - 1]} ${y}`;
}
function monthShort(ymStr) {
  const [y, m] = ymStr.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]}`;
}
function shiftMonth(ymStr, delta) {
  const [y, m] = ymStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function lastNMonths(n, endYm) {
  const arr = [];
  let cur = endYm || ym(today());
  for (let i = 0; i < n; i++) { arr.unshift(cur); cur = shiftMonth(cur, -1); }
  return arr;
}

/* ============================================================
   ESTADO INICIAL
   ============================================================ */

const DEFAULT_STATE = {
  version: 2,
  people: [
    { id: "richard", name: "Richard" },
    { id: "raquel", name: "Raquel" },
  ],
  accounts: [
    { id: "efectivo", name: "Efectivo", icon: "wallet", kind: "liquido", owner: "richard", balance: 300000, active: true },
    { id: "continental", name: "Banco Continental", icon: "bank", kind: "liquido", owner: "richard", balance: 28650, active: true },
    { id: "ueno", name: "Ueno Bank", icon: "bank", kind: "liquido", owner: "richard", balance: 15600, active: true },
    { id: "fondo", name: "Fondo de Emergencia", icon: "shield", kind: "fondo", owner: "familia", balance: 2010000, active: true },
    { id: "inv-pendiente", name: "Capital de Inversión Pendiente", icon: "package", kind: "inversion_pendiente", owner: "familia", balance: 0, active: true },
    { id: "inv-disponible", name: "Capital Disponible para Invertir", icon: "trending", kind: "inversion_disponible", owner: "familia", balance: 0, active: true },
  ],
  debts: [
    { id: "vehiculo", name: "Vehículo (Richard)", icon: "car", kind: "cuota", owner: "richard",
      initialBalance: 36000000, currentBalance: 36000000, installment: 1600000, dueDay: 10,
      lastPaidPeriod: "2026-08", payments: [] },
    { id: "tarjeta", name: "Tarjeta Continental (Richard)", icon: "card", kind: "tarjeta", owner: "richard",
      currentBalance: 189632, payments: [], consumptions: [] },
  ],
  investments: [],
  movements: [],
  tasks: [],
  goals: [
    { id: "g-fondo", name: "Fondo de emergencia", type: "fondo", ref: "fondo", target: 25000000, owner: "familia", custom: false },
    { id: "g-vehiculo", name: "Cancelar vehículo", type: "deuda", ref: "vehiculo", target: 36000000, owner: "richard", custom: false },
    { id: "g-inversion", name: "Inversiones", type: "inversion", ref: "ALL", target: null, owner: "familia", custom: false },
  ],
  patrimonioHistory: [],
  settings: {
    fondoTarget: 25000000,
    investmentStartDate: "2026-09-01",
    theme: "light",
    lastActiveUser: "richard",
    pins: { richard: "0000", raquel: "0000" },
    rates: { emergencia: 0.15, inversion: 0.25, ocio: 0.10, necesidades: 0.50 },
    fixedExpenses: [
      { id: "internet", name: "Internet", owner: "familia", amount: 100000, dueDay: 15 },
      { id: "suscripciones", name: "Suscripciones", owner: "familia", amount: 300000, dueDay: 5 },
      { id: "electricidad", name: "Electricidad", owner: "familia", amount: 300000, dueDay: 20, variable: true },
      { id: "alimentacion", name: "Alimentación", owner: "familia", amount: 2000000, dueDay: null },
    ],
    categories: {
      necesidad: ["Alimentación", "Vivienda", "Servicios", "Transporte", "Deudas", "Salud", "Educación", "Niñas", "Familia", "Otros"],
      ocio: ["Restaurantes", "Salidas", "Entretenimiento", "Compras personales", "Viajes", "Gustos"],
      otro: ["Otro"],
    },
  },
  meta: { createdAt: today(), initialSetupDate: null },
};

// Reconcilia un estado cargado (posiblemente guardado por una versión anterior de la app)
// con la forma actual, rellenando cualquier campo nuevo que todavía no existiera.
// Nunca pisa datos reales del usuario, solo agrega lo que falta.
const REQUIRED_ACCOUNT_IDS = ["fondo", "inv-pendiente", "inv-disponible"];

function reconcileState(loaded) {
  if (!loaded || typeof loaded !== "object") return DEFAULT_STATE;
  const loadedAccounts = Array.isArray(loaded.accounts) ? loaded.accounts : DEFAULT_STATE.accounts;
  // Las cuentas estructurales (fondo, capital pendiente, capital disponible) son requeridas
  // por el motor financiero en cualquier momento — si faltan (por ejemplo, en un estado
  // guardado por una versión anterior de la app), se agregan en cero sin tocar el resto.
  const missingRequired = REQUIRED_ACCOUNT_IDS
    .filter((id) => !loadedAccounts.some((a) => a.id === id))
    .map((id) => DEFAULT_STATE.accounts.find((a) => a.id === id));
  const accounts = [...loadedAccounts, ...missingRequired];
  return {
    ...DEFAULT_STATE,
    ...loaded,
    accounts,
    debts: Array.isArray(loaded.debts) ? loaded.debts : DEFAULT_STATE.debts,
    investments: Array.isArray(loaded.investments) ? loaded.investments : [],
    movements: Array.isArray(loaded.movements) ? loaded.movements : [],
    tasks: Array.isArray(loaded.tasks) ? loaded.tasks : [],
    goals: Array.isArray(loaded.goals) ? loaded.goals : DEFAULT_STATE.goals,
    people: Array.isArray(loaded.people) ? loaded.people : DEFAULT_STATE.people,
    patrimonioHistory: Array.isArray(loaded.patrimonioHistory) ? loaded.patrimonioHistory : [],
    settings: {
      ...DEFAULT_STATE.settings,
      ...(loaded.settings || {}),
      rates: { ...DEFAULT_STATE.settings.rates, ...(loaded.settings?.rates || {}) },
      pins: { ...DEFAULT_STATE.settings.pins, ...(loaded.settings?.pins || {}) },
      fixedExpenses: Array.isArray(loaded.settings?.fixedExpenses) ? loaded.settings.fixedExpenses : DEFAULT_STATE.settings.fixedExpenses,
      categories: {
        necesidad: Array.isArray(loaded.settings?.categories?.necesidad) ? loaded.settings.categories.necesidad : DEFAULT_STATE.settings.categories.necesidad,
        ocio: Array.isArray(loaded.settings?.categories?.ocio) ? loaded.settings.categories.ocio : DEFAULT_STATE.settings.categories.ocio,
        otro: Array.isArray(loaded.settings?.categories?.otro) ? loaded.settings.categories.otro : DEFAULT_STATE.settings.categories.otro,
      },
    },
    meta: { ...DEFAULT_STATE.meta, ...(loaded.meta || {}) },
  };
}

/* ============================================================
   MOTOR FINANCIERO
   ============================================================ */

const getAcc = (state, id) => state.accounts.find((a) => a.id === id);
const activeAccounts = (state) => state.accounts.filter((a) => a.active !== false);
const fundBalance = (state) => getAcc(state, "fondo").balance;
const fundComplete = (state) => fundBalance(state) >= state.settings.fondoTarget;
const investmentsStarted = (state, dateStr) => (dateStr || today()) >= state.settings.investmentStartDate;

function getRates(state, dateStr) {
  const base = state.settings.rates;
  const complete = fundComplete(state);
  return {
    emergencia: complete ? 0 : base.emergencia,
    inversion: complete ? base.inversion + base.emergencia : base.inversion,
    ocio: base.ocio,
    necesidades: base.necesidades,
    fundComplete: complete,
    invStarted: investmentsStarted(state, dateStr),
  };
}

function allocate(amount, rates) {
  const emergencia = Math.round(amount * rates.emergencia);
  const inversion = Math.round(amount * rates.inversion);
  const ocio = Math.round(amount * rates.ocio);
  const necesidades = amount - emergencia - inversion - ocio;
  return { emergencia, inversion, ocio, necesidades };
}

// Estado de distribución de un ingreso familiar, tolerante a datos viejos
// (donde "distributed" era un solo booleano para las dos partes juntas).
function distStatus(m) {
  if (m.distributedParts) return m.distributedParts;
  if (m.distributed === true) return { emergencia: true, inversion: true };
  return { emergencia: false, inversion: false };
}

function fixedExpenseEstimate(state, f) {
  if (!f.variable) return f.amount;
  const lastReal = state.movements
    .filter((m) => m.status === "activo" && m.type === "gasto" && m.fixedRef === f.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return lastReal ? lastReal.amount : f.amount;
}

function fixedObligationsTotal(state, owner) {
  const fixed = state.settings.fixedExpenses
    .filter((f) => !owner || f.owner === owner || f.owner === "familia")
    .reduce((s, f) => s + fixedExpenseEstimate(state, f), 0);
  const debts = state.debts.filter((d) => d.kind === "cuota" && d.currentBalance > 0 && (!owner || d.owner === owner || d.owner === "familia"));
  return fixed + debts.reduce((s, d) => s + Math.min(d.installment, d.currentBalance), 0);
}
const minIncomeNoDeficit = (state) => fixedObligationsTotal(state) / (state.settings.rates.necesidades || 0.5);

function ownerFilter(list, owner) {
  if (!owner || owner === "familia") return list;
  // Vista personal: SOLO lo que es estrictamente de esa persona.
  // El fondo/inversión familiares se muestran aparte, nunca mezclados en "mi patrimonio".
  return list.filter((x) => x.owner === owner);
}

function liquidTotal(state, owner) {
  return ownerFilter(activeAccounts(state).filter((a) => a.kind === "liquido"), owner).reduce((s, a) => s + a.balance, 0);
}
function totalAssets(state, owner) {
  const accs = ownerFilter(activeAccounts(state), owner).reduce((s, a) => s + a.balance, 0);
  const invs = ownerFilter(state.investments, owner).reduce((s, i) => s + i.currentValue, 0);
  return accs + invs;
}
function totalDebts(state, owner) {
  return ownerFilter(state.debts, owner).reduce((s, d) => s + d.currentBalance, 0);
}
function netWorth(state, owner) { return totalAssets(state, owner) - totalDebts(state, owner); }

function monthMovements(state, monthStr, owner) {
  const base = state.movements.filter((m) => m.status === "activo" && ym(m.date) === monthStr);
  if (!owner || owner === "familia") return base;
  return base.filter((m) => m.owner === owner || m.paidBy === owner);
}

function monthlyBudget(state, monthStr) {
  // Reglas 50/15/25/10 aplican SOLO sobre ingresos marcados como "aporte familiar".
  // Los ingresos "personales" quedan 100% fuera de esta distribución.
  const movs = monthMovements(state, monthStr);
  const incomes = movs.filter((m) => m.type === "ingreso");
  const aportesFamiliares = incomes.filter((m) => m.incomeType === "familiar");
  const ingresosPersonales = incomes.filter((m) => m.incomeType === "personal");
  const totalAportesFamiliares = aportesFamiliares.reduce((s, m) => s + m.amount, 0);
  const totalIngresosPersonales = ingresosPersonales.reduce((s, m) => s + m.amount, 0);
  const totalIncome = totalAportesFamiliares + totalIngresosPersonales;
  const necesidadesRecommended = aportesFamiliares.reduce((s, m) => s + (m.allocation ? m.allocation.necesidades : 0), 0);
  const ocioAssigned = aportesFamiliares.reduce((s, m) => s + (m.allocation ? m.allocation.ocio : 0), 0);
  const gastos = movs.filter((m) => m.type === "gasto");
  const necesidadesReal = gastos.filter((g) => g.classification === "necesidad").reduce((s, m) => s + m.amount, 0);
  const ocioSpent = gastos.filter((g) => g.classification === "ocio").reduce((s, m) => s + m.amount, 0);
  const pendingDistribution = aportesFamiliares.reduce((s, m) => {
    if (!m.allocation) return s;
    const ds = distStatus(m);
    return s + (ds.emergencia ? 0 : m.allocation.emergencia) + (ds.inversion ? 0 : m.allocation.inversion);
  }, 0);
  return { totalIncome, totalAportesFamiliares, totalIngresosPersonales, necesidadesRecommended, ocioAssigned, necesidadesReal, ocioSpent, pendingDistribution, gastoCount: gastos.length };
}

function pendingFixedThisMonth(state, monthStr) {
  const movs = monthMovements(state, monthStr);
  let pending = 0;
  const items = [];
  state.settings.fixedExpenses.forEach((f) => {
    const paid = movs.some((m) => m.type === "gasto" && m.fixedRef === f.id);
    const estimate = fixedExpenseEstimate(state, f);
    if (!paid) pending += estimate;
    items.push({ ...f, paid, estimate });
  });
  const cuotas = state.debts.filter((d) => d.kind === "cuota" && d.currentBalance > 0).map((d) => {
    const paid = d.lastPaidPeriod >= monthStr;
    if (!paid) pending += Math.min(d.installment, d.currentBalance);
    return { ...d, paidThisMonth: paid };
  });
  const saldadas = state.debts.filter((d) => d.kind === "cuota" && d.currentBalance <= 0 && d.initialBalance > 0);
  return { pending, items, cuotas, saldadas };
}

// Reparte lo que queda del presupuesto de "necesidades" del mes entre los días
// que faltan, para saber más o menos cuánto se puede gastar por día (comida,
// transporte, etc.) sin pasarse del 50% recomendado.
function dailySpendingSuggestion(state) {
  const now = new Date(today() + "T00:00:00");
  const year = now.getFullYear(), month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysRemaining = Math.max(daysInMonth - dayOfMonth + 1, 1); // incluye hoy

  const budget = monthlyBudget(state, ym(today()));
  const restante = budget.necesidadesRecommended - budget.necesidadesReal;
  const perDay = restante > 0 ? restante / daysRemaining : 0;

  return {
    recommended: budget.necesidadesRecommended,
    spent: budget.necesidadesReal,
    restante,
    daysRemaining,
    perDay,
    overBudget: restante < 0,
  };
}

function fundETA(state) {
  const aportes = state.movements.filter((m) => m.status === "activo" && m.type === "aporte" && m.destino === "fondo");
  const remaining = state.settings.fondoTarget - fundBalance(state);
  if (remaining <= 0) return { months: 0, avg: 0 };
  if (aportes.length === 0) return { months: null, avg: 0 };
  const recent = aportes.slice(0, 6);
  const avg = recent.reduce((s, m) => s + m.amount, 0) / recent.length;
  if (avg <= 0) return { months: null, avg: 0 };
  return { months: Math.ceil(remaining / avg), avg };
}

function investmentTotals(state, owner) {
  const list = ownerFilter(state.investments, owner);
  const contributed = list.reduce((s, i) => s + i.contributedTotal, 0);
  const current = list.reduce((s, i) => s + i.currentValue, 0);
  const gain = current - contributed;
  const rentabilidad = contributed > 0 ? gain / contributed : 0;
  return { contributed, current, gain, rentabilidad, count: list.length };
}

function computeSnapshot(state) {
  const cur = ym(today());
  const history = [...state.patrimonioHistory];
  const idx = history.findIndex((h) => h.ym === cur);
  const entry = { ym: cur, value: netWorth(state), assets: totalAssets(state), debts: totalDebts(state) };
  if (idx >= 0) history[idx] = entry; else history.push(entry);
  history.sort((a, b) => (a.ym < b.ym ? -1 : 1));
  return history;
}

function generateInsights(state) {
  const insights = [];
  const curYm = ym(today());
  const prevYm = shiftMonth(curYm, -1);
  const curB = monthlyBudget(state, curYm);
  const prevB = monthlyBudget(state, prevYm);

  if (prevB.necesidadesReal > 0) {
    const varActual = curB.ocioSpent; // proxy de gasto variable/discrecional
    const varPrev = prevB.ocioSpent;
    if (varPrev > 0) {
      const change = ((varActual - varPrev) / varPrev) * 100;
      if (Math.abs(change) >= 8) {
        insights.push({
          tone: change > 0 ? "amber" : "emerald",
          text: `Tus gastos de ocio ${change > 0 ? "aumentaron" : "bajaron"} ${Math.abs(change).toFixed(0)}% respecto al mes pasado.`,
        });
      }
    }
  }

  const fBal = fundBalance(state);
  const fTarget = state.settings.fondoTarget;
  if (fBal < fTarget) {
    const restante = fTarget - fBal;
    const eta = fundETA(state);
    if (restante <= fTarget * 0.1) insights.push({ tone: "emerald", text: `Estás muy cerca de completar tu fondo de emergencia: faltan ${fmt(restante)}.` });
    else if (eta.months) insights.push({ tone: "petrol", text: `A tu ritmo actual, alcanzarías el fondo de emergencia en unos ${eta.months} ${eta.months === 1 ? "mes" : "meses"}.` });
  } else {
    insights.push({ tone: "emerald", text: "Tu fondo de emergencia está completo. El excedente que antes iba ahí ahora refuerza tus inversiones." });
  }

  const fixed = pendingFixedThisMonth(state, curYm);
  const libre = liquidTotal(state) - fixed.pending - curB.pendingDistribution;
  if (libre > 0) {
    insights.push({ tone: "petrol", text: `Podrías invertir o ahorrar hasta ${fmt(libre)} este mes sin comprometer tus obligaciones.` });
  } else if (libre < 0) {
    insights.push({ tone: "red", text: `Tus obligaciones de este mes superan tu dinero libre en ${fmt(-libre)}. Priorizalas antes de gastar en otras cosas.` });
  }

  const inv = investmentTotals(state);
  if (inv.contributed > 0) {
    insights.push({ tone: inv.gain >= 0 ? "emerald" : "red", text: `Tus inversiones acumulan ${inv.gain >= 0 ? "una ganancia" : "una pérdida"} de ${fmt(Math.abs(inv.gain))} (${pct1(inv.rentabilidad)}) sobre lo aportado.` });
  }

  if (curB.necesidadesReal > curB.necesidadesRecommended && curB.necesidadesRecommended > 0) {
    insights.push({ tone: "amber", text: `Tus necesidades están ${fmt(curB.necesidadesReal - curB.necesidadesRecommended)} por encima de lo recomendado este mes.` });
  }

  if (insights.length === 0) insights.push({ tone: "petrol", text: "Todavía no hay suficiente historial este mes para generar recomendaciones. Seguí registrando tus movimientos." });

  return insights;
}

/* Motor de simulación: no muta el estado real */
function simulate(state, changes) {
  let s = JSON.parse(JSON.stringify(state));
  const date = today();
  if (changes.extraIncome > 0) {
    const rates = getRates(s, date);
    const alloc = allocate(changes.extraIncome, rates);
    getAcc(s, changes.incomeAccountId || "ueno").balance += changes.extraIncome;
    // simular distribución inmediata
    if (alloc.emergencia > 0) getAcc(s, "fondo").balance += alloc.emergencia;
    const invTarget = rates.invStarted ? "inv-disponible" : "inv-pendiente";
    if (alloc.inversion > 0) getAcc(s, invTarget).balance += alloc.inversion;
    getAcc(s, changes.incomeAccountId || "ueno").balance -= (alloc.emergencia + alloc.inversion);
  }
  if (changes.investAmount > 0) {
    const acc = getAcc(s, "inv-disponible");
    acc.balance = Math.max(0, acc.balance - changes.investAmount);
    s.investments.push({ id: "sim", contributedTotal: changes.investAmount, currentValue: changes.investAmount, owner: "familia", entries: [] });
  }
  if (changes.reduceExpense > 0) {
    // reducir gasto variable simulado = más dinero libre, no afecta cuentas reales en la simulación
    getAcc(s, "efectivo").balance += changes.reduceExpense;
  }
  if (changes.payDebtId && changes.payDebtAmount > 0) {
    const d = s.debts.find((x) => x.id === changes.payDebtId);
    if (d) d.currentBalance = Math.max(0, d.currentBalance - changes.payDebtAmount);
    getAcc(s, "ueno").balance -= changes.payDebtAmount;
  }
  return {
    liquidTotal: liquidTotal(s),
    fundBalance: fundBalance(s),
    fundPct: fundBalance(s) / s.settings.fondoTarget,
    investTotal: investmentTotals(s).current,
    debtTotal: totalDebts(s),
    netWorth: netWorth(s),
    fundETA: fundETA(s),
  };
}

/* ============================================================
   ICONOS
   ============================================================ */

const ICON_MAP = {
  wallet: Wallet, bank: Landmark, shield: Shield, package: Package, trending: TrendingUp,
  car: Car, card: CreditCard, piggy: PiggyBank, sprout: Sprout, home: Home, users: Users, user: User,
};
function Icon({ name, size = 18, className = "" }) {
  const Cmp = ICON_MAP[name] || Wallet;
  return <Cmp size={size} className={className} />;
}

/* ============================================================
   COMPONENTES BASE
   ============================================================ */

function ProgressBar({ pct, tone = "emerald", celebrate = false }) {
  return (
    <div className={`ff-progress ${celebrate ? "ff-progress--celebrate" : ""}`}>
      <div className={`ff-progress__fill ff-progress__fill--${tone}`} style={{ width: `${clamp01(pct) * 100}%` }} />
    </div>
  );
}
function Card({ children, className = "", onClick }) {
  return <div className={`ff-card ${className}`} onClick={onClick}>{children}</div>;
}
function Pill({ tone = "neutral", children }) { return <span className={`ff-pill ff-pill--${tone}`}>{children}</span>; }
function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="ff-empty">
      <div className="ff-empty__icon">{icon}</div>
      <div className="ff-empty__title">{title}</div>
      {subtitle && <div className="ff-empty__subtitle">{subtitle}</div>}
      {action}
    </div>
  );
}
function Field({ label, children }) {
  return <label className="ff-field"><span className="ff-field__label">{label}</span>{children}</label>;
}
function Sheet({ title, onClose, children, footer }) {
  return (
    <div className="ff-sheet-backdrop" onClick={onClose}>
      <div className="ff-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ff-sheet__header"><h3>{title}</h3><button className="ff-icon-btn" onClick={onClose}><X size={20} /></button></div>
        <div className="ff-sheet__body">{children}</div>
        {footer && <div className="ff-sheet__footer">{footer}</div>}
      </div>
    </div>
  );
}
function OwnerSelect({ value, onChange, state, includeFamilia = true }) {
  return (
    <div className="ff-segmented">
      {state.people.map((p) => (
        <button key={p.id} className={value === p.id ? "active" : ""} onClick={() => onChange(p.id)}>{p.name}</button>
      ))}
      {includeFamilia && <button className={value === "familia" ? "active" : ""} onClick={() => onChange("familia")}>Familia</button>}
    </div>
  );
}
function personName(state, ownerId) {
  if (ownerId === "familia") return "Familia";
  return state.people.find((p) => p.id === ownerId)?.name || ownerId;
}

/* ============================================================
   MODALES DE REGISTRO
   ============================================================ */

function IngresoModal({ state, onClose, onSubmit, initial, defaultOwner }) {
  const [owner, setOwner] = useState(initial?.owner || defaultOwner || "richard");
  const [incomeType, setIncomeType] = useState(initial?.incomeType || "familiar");
  const [tipo, setTipo] = useState(initial?.tipo || "Salario");
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : "");
  const [accountId, setAccountId] = useState(initial?.accountId || state.accounts.find((a) => a.kind === "liquido" && a.owner === (initial?.owner || defaultOwner || "richard"))?.id || "");
  const [date, setDate] = useState(initial?.date || today());
  const [description, setDescription] = useState(initial?.description || "");
  const num = Number(amount) || 0;
  const rates = getRates(state, date);
  const preview = num > 0 && incomeType === "familiar" ? allocate(num, rates) : null;
  const myAccounts = activeAccounts(state).filter((a) => a.kind === "liquido" && (a.owner === owner));

  useEffect(() => {
    const first = activeAccounts(state).filter((a) => a.kind === "liquido" && a.owner === owner)[0];
    if (!initial) setAccountId(first ? first.id : "");
  }, [owner]); // eslint-disable-line

  return (
    <Sheet title="Recibí dinero" onClose={onClose} footer={
      <button className="ff-btn ff-btn--primary ff-btn--full" disabled={num <= 0 || !accountId} onClick={() => onSubmit({ amount: num, owner, incomeType, tipo, accountId, date, description })}>{initial ? "Guardar cambios" : "Registrar ingreso"}</button>
    }>
      <Field label="¿Quién recibió el dinero?"><OwnerSelect value={owner} onChange={setOwner} state={state} includeFamilia={false} /></Field>
      <Field label="¿Es personal o aporte familiar?">
        <div className="ff-segmented">
          <button className={incomeType === "personal" ? "active" : ""} onClick={() => setIncomeType("personal")}>Personal</button>
          <button className={incomeType === "familiar" ? "active" : ""} onClick={() => setIncomeType("familiar")}>Aporte familiar</button>
        </div>
      </Field>
      <Field label="Tipo de ingreso">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {["Salario", "Extra", "Venta", "Bonificación", "Otro"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Monto (Gs.)"><input type="number" inputMode="numeric" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
      <Field label="Cuenta donde ingresó">
        {myAccounts.length === 0 ? (
          <div className="ff-note ff-note--amber"><AlertTriangle size={14} /> {personName(state, owner)} todavía no tiene cuentas líquidas. Creá una primero en Patrimonio.</div>
        ) : (
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {myAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </Field>
      <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Descripción (opcional)"><input type="text" placeholder="Ej: pago de cliente" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      {incomeType === "personal" ? (
        <div className="ff-note"><Info size={14} /> Este ingreso queda 100% para {personName(state, owner)}. No entra en la regla de distribución familiar (fondo/inversión/ocio/necesidades).</div>
      ) : preview && (
        <div className="ff-preview">
          <div className="ff-preview__title">Distribución sugerida (regla familiar combinada)</div>
          <div className="ff-donut-row">
            <div className="ff-chart-wrap" style={{ width: 90, height: 90, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Emergencia", value: preview.emergencia, color: "var(--ff-emerald)" },
                      { name: "Inversión", value: preview.inversion, color: "var(--ff-petrol)" },
                      { name: "Ocio", value: preview.ocio, color: "var(--ff-amber)" },
                      { name: "Necesidades", value: preview.necesidades, color: "var(--ff-carbon)" },
                    ].filter((d) => d.value > 0)}
                    dataKey="value" nameKey="name" innerRadius={26} outerRadius={44} paddingAngle={2} startAngle={90} endAngle={-270}
                  >
                    {[preview.emergencia > 0 && "var(--ff-emerald)", "var(--ff-petrol)", "var(--ff-amber)", "var(--ff-carbon)"].filter(Boolean).map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 12, border: "1px solid var(--ff-border)", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1 }}>
              <div className="ff-preview__row"><span><Shield size={14} /> Emergencia</span><b>{fmt(preview.emergencia)}</b></div>
              <div className="ff-preview__row"><span><TrendingUp size={14} /> Inversión</span><b>{fmt(preview.inversion)}</b></div>
              <div className="ff-preview__row"><span><Sparkles size={14} /> Ocio</span><b>{fmt(preview.ocio)}</b></div>
              <div className="ff-preview__row"><span><Home size={14} /> Necesidades</span><b>{fmt(preview.necesidades)}</b></div>
            </div>
          </div>
          <div className="ff-preview__note">{rates.fundComplete ? "El fondo familiar ya está completo: ese % extra refuerza inversiones." : "Se aplica sobre el total de aportes familiares (de Richard + Raquel), no sobre ingresos personales."}</div>
        </div>
      )}
    </Sheet>
  );
}

function GastoModal({ state, onClose, onSubmit, initial, defaultOwner }) {
  const [owner, setOwner] = useState(initial?.owner || defaultOwner || "familia");
  const [paidBy, setPaidBy] = useState(initial?.paidBy || defaultOwner || "richard");
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : "");
  const [accountId, setAccountId] = useState(initial?.accountId || "");
  const [classification, setClassification] = useState(initial?.classification || "necesidad");
  const [category, setCategory] = useState(initial?.category || state.settings.categories.necesidad[0]);
  const [date, setDate] = useState(initial?.date || today());
  const [description, setDescription] = useState(initial?.description || "");
  const num = Number(amount) || 0;
  const payerAccounts = activeAccounts(state).filter((a) => a.kind === "liquido" && (a.owner === paidBy || a.owner === "familia"));
  const tarjetas = state.debts.filter((d) => d.kind === "tarjeta" && (d.owner === paidBy || d.owner === "familia"));
  const spendable = [...payerAccounts, ...tarjetas.map((d) => ({ id: d.id, name: `${d.name} (consumo)` }))];
  const isTarjeta = tarjetas.some((d) => d.id === accountId);

  useEffect(() => { setCategory(state.settings.categories[classification][0]); }, [classification]); // eslint-disable-line
  useEffect(() => {
    // Si la cuenta/tarjeta elegida ya no pertenece a quien paga ahora, se reasigna a la primera opción válida.
    if (!spendable.some((a) => a.id === accountId)) setAccountId(spendable[0]?.id || "");
  }, [paidBy]); // eslint-disable-line

  return (
    <Sheet title="Gasté dinero" onClose={onClose} footer={
      <button className="ff-btn ff-btn--primary ff-btn--full" disabled={num <= 0 || !accountId} onClick={() => onSubmit({ amount: num, owner, paidBy, accountId, classification, category, date, description })}>Registrar gasto</button>
    }>
      <Field label="¿A quién pertenece este gasto?"><OwnerSelect value={owner} onChange={setOwner} state={state} /></Field>
      {owner === "familia" && <Field label="¿Quién puso la plata?"><OwnerSelect value={paidBy} onChange={setPaidBy} state={state} includeFamilia={false} /></Field>}
      <Field label="Monto (Gs.)"><input type="number" inputMode="numeric" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
      <Field label="Pagado desde">
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {spendable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="Tipo">
        <div className="ff-segmented">
          {["necesidad", "ocio", "otro"].map((c) => (
            <button key={c} className={classification === c ? "active" : ""} onClick={() => setClassification(c)}>{c === "necesidad" ? "Necesidad" : c === "ocio" ? "Ocio" : "Otro"}</button>
          ))}
        </div>
      </Field>
      <Field label="Categoría">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {state.settings.categories[classification].map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Nota (opcional)"><input type="text" placeholder="Ej: supermercado" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      {isTarjeta && <div className="ff-note ff-note--amber"><AlertTriangle size={14} /> Este consumo aumenta el saldo de esa tarjeta como una deuda nueva — no descuenta de ninguna cuenta. Después la pagás con "Pagué deuda".</div>}
    </Sheet>
  );
}

function TransferModal({ state, onClose, onSubmit, mode = "transferencia" }) {
  const savingsAccounts = activeAccounts(state).filter((a) => ["fondo", "ahorro"].includes(a.kind));
  const [fromId, setFromId] = useState(mode === "ahorro" ? (activeAccounts(state).find((a) => a.kind === "liquido")?.id || "") : (mode === "retiro" ? "fondo" : "ueno"));
  const [toId, setToId] = useState(mode === "ahorro" ? "fondo" : (mode === "retiro" ? (activeAccounts(state).find((a) => a.kind === "liquido")?.id || "") : "fondo"));
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState("");
  const num = Number(amount) || 0;
  const from = getAcc(state, fromId);
  const willUseFund = fromId === "fondo" && num > 0 && from && from.balance - num < state.settings.fondoTarget;
  const title = mode === "ahorro" ? "Ahorré dinero" : mode === "retiro" ? "Retiré dinero" : "Transferí dinero";

  return (
    <Sheet title={title} onClose={onClose} footer={
      <button className="ff-btn ff-btn--primary ff-btn--full" disabled={num <= 0 || fromId === toId} onClick={() => onSubmit({ fromId, toId, amount: num, date, description })}>Confirmar</button>
    }>
      <Field label="Desde">
        <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {activeAccounts(state).map((a) => <option key={a.id} value={a.id}>{a.name} ({fmt(a.balance)})</option>)}
        </select>
      </Field>
      <Field label="Hacia">
        <select value={toId} onChange={(e) => setToId(e.target.value)}>
          {activeAccounts(state).filter((a) => a.id !== fromId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="Monto (Gs.)"><input type="number" inputMode="numeric" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
      <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Nota (opcional)"><input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: aporte mensual" /></Field>
      <div className="ff-note">Una transferencia no es ingreso ni gasto: el patrimonio total de la familia no cambia.</div>
      {willUseFund && <div className="ff-note ff-note--amber"><AlertTriangle size={14} /> Esto deja el fondo por debajo del objetivo. El % de emergencia se reactivará solo en el próximo ingreso.</div>}
    </Sheet>
  );
}

function PagoDeudaModal({ state, onClose, onSubmit }) {
  const [debtId, setDebtId] = useState(state.debts[0]?.id);
  const debt = state.debts.find((d) => d.id === debtId);
  const [amount, setAmount] = useState(debt?.kind === "cuota" ? String(debt.installment) : "");
  const [accountId, setAccountId] = useState(activeAccounts(state).find((a) => a.kind === "liquido")?.id || "");
  const [date, setDate] = useState(today());
  const num = Number(amount) || 0;

  useEffect(() => {
    const d = state.debts.find((x) => x.id === debtId);
    if (d?.kind === "cuota") setAmount(String(d.installment));
  }, [debtId]); // eslint-disable-line

  if (state.debts.length === 0) return <Sheet title="Pagué deuda" onClose={onClose}><EmptyState icon={<CreditCard size={26} />} title="No hay deudas registradas" /></Sheet>;

  return (
    <Sheet title="Pagué deuda" onClose={onClose} footer={
      <button className="ff-btn ff-btn--primary ff-btn--full" disabled={num <= 0} onClick={() => onSubmit({ debtId, amount: num, accountId, date })}>Registrar pago</button>
    }>
      <Field label="Deuda">
        <select value={debtId} onChange={(e) => setDebtId(e.target.value)}>
          {state.debts.map((d) => <option key={d.id} value={d.id}>{d.name} — saldo {fmt(d.currentBalance)}</option>)}
        </select>
      </Field>
      <Field label="Monto a pagar (Gs.)"><input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="Pagado desde">
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {activeAccounts(state).filter((a) => a.kind === "liquido").map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
    </Sheet>
  );
}

function InversionModal({ state, onClose, onSubmit, defaultOwner }) {
  const [mode, setMode] = useState(state.investments.length ? "existing" : "new");
  const [investmentId, setInvestmentId] = useState(state.investments[0]?.id || "");
  const [name, setName] = useState("");
  const [type, setType] = useState("ETF");
  const [owner, setOwner] = useState(defaultOwner || "familia");
  const [amount, setAmount] = useState("");
  const [sourceId, setSourceId] = useState("inv-disponible");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const num = Number(amount) || 0;
  const sources = activeAccounts(state).filter((a) => a.kind === "liquido" || a.kind === "inversion_disponible");

  return (
    <Sheet title="Invertí dinero" onClose={onClose} footer={
      <button className="ff-btn ff-btn--primary ff-btn--full" disabled={num <= 0 || (mode === "new" && !name)} onClick={() => onSubmit({ mode, investmentId, name, type, owner, amount: num, sourceId, date, notes })}>Registrar inversión</button>
    }>
      {state.investments.length > 0 && (
        <Field label="¿Nueva inversión o aporte a una existente?">
          <div className="ff-segmented">
            <button className={mode === "existing" ? "active" : ""} onClick={() => setMode("existing")}>Existente</button>
            <button className={mode === "new" ? "active" : ""} onClick={() => setMode("new")}>Nueva</button>
          </div>
        </Field>
      )}
      {mode === "existing" && state.investments.length > 0 ? (
        <Field label="Inversión">
          <select value={investmentId} onChange={(e) => setInvestmentId(e.target.value)}>
            {state.investments.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.type})</option>)}
          </select>
        </Field>
      ) : (
        <>
          <Field label="Nombre (ej: ETF SPY, Depósito a plazo)"><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Tipo">
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {["ETF", "Acciones", "Fondo", "Depósito a plazo", "Cripto", "Otro"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Propietario"><OwnerSelect value={owner} onChange={setOwner} state={state} /></Field>
        </>
      )}
      <Field label="Monto aportado (Gs.)"><input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
      <Field label="Origen del dinero">
        <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          {sources.map((a) => <option key={a.id} value={a.id}>{a.name} ({fmt(a.balance)})</option>)}
        </select>
      </Field>
      <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Notas (opcional)"><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    </Sheet>
  );
}

function OtroModal({ state, onClose, onSubmit, defaultOwner }) {
  const [owner, setOwner] = useState(defaultOwner || "familia");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today());
  const num = Number(amount) || 0;
  return (
    <Sheet title="Otro movimiento" onClose={onClose} footer={
      <button className="ff-btn ff-btn--primary ff-btn--full" disabled={!description} onClick={() => onSubmit({ owner, amount: num, description, date })}>Registrar</button>
    }>
      <div className="ff-note"><Info size={14} /> Para movimientos que no encajan en las otras categorías. Queda en tu historial pero no afecta cuentas ni saldos automáticamente.</div>
      <Field label="¿De quién?"><OwnerSelect value={owner} onChange={setOwner} state={state} /></Field>
      <Field label="Monto de referencia (Gs., opcional)"><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="Descripción"><input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="¿Qué pasó?" autoFocus /></Field>
      <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
    </Sheet>
  );
}

function AccountModal({ state, onClose, onSubmit, editing }) {
  const [name, setName] = useState(editing?.name || "");
  const [owner, setOwner] = useState(editing?.owner || "richard");
  const [kind, setKind] = useState(editing?.kind || "liquido");
  const [balance, setBalance] = useState(editing ? String(editing.balance) : "0");
  const [icon, setIcon] = useState(editing?.icon || "bank");

  return (
    <Sheet title={editing ? "Editar cuenta" : "Nueva cuenta"} onClose={onClose} footer={
      <button className="ff-btn ff-btn--primary ff-btn--full" disabled={!name} onClick={() => onSubmit({ name, owner, kind, balance: Number(balance) || 0, icon })}>{editing ? "Guardar cambios" : "Crear cuenta"}</button>
    }>
      <Field label="Nombre"><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Ueno Bank" autoFocus /></Field>
      <Field label="Propietario"><OwnerSelect value={owner} onChange={setOwner} state={state} /></Field>
      <Field label="Tipo de cuenta">
        <div className="ff-segmented">
          <button className={kind === "liquido" ? "active" : ""} onClick={() => setKind("liquido")}>Líquida</button>
          <button className={kind === "ahorro" ? "active" : ""} onClick={() => setKind("ahorro")}>Ahorro</button>
        </div>
      </Field>
      <Field label={editing ? "Saldo actual (Gs.) — se registra como corrección" : "Saldo inicial (Gs.)"}>
        <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} />
      </Field>
      {editing && <div className="ff-note ff-note--amber"><AlertTriangle size={14} /> Si cambiás el saldo, se guarda un movimiento de "Corrección de saldo" para no perder la trazabilidad.</div>}
    </Sheet>
  );
}

function DebtModal({ state, onClose, onSubmit, editing }) {
  const [name, setName] = useState(editing?.name || "");
  const [owner, setOwner] = useState(editing?.owner || "familia");
  const [kind, setKind] = useState(editing?.kind || "cuota");
  const [currentBalance, setCurrentBalance] = useState(editing ? String(editing.currentBalance) : "");
  const [installment, setInstallment] = useState(editing?.installment ? String(editing.installment) : "");
  const [dueDay, setDueDay] = useState(editing?.dueDay ? String(editing.dueDay) : "");

  return (
    <Sheet title={editing ? "Editar deuda" : "Nueva deuda"} onClose={onClose} footer={
      <button className="ff-btn ff-btn--primary ff-btn--full" disabled={!name} onClick={() => onSubmit({ name, owner, kind, currentBalance: Number(currentBalance) || 0, installment: Number(installment) || 0, dueDay: dueDay ? Number(dueDay) : null })}>{editing ? "Guardar cambios" : "Crear deuda"}</button>
    }>
      <Field label="Nombre"><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Préstamo personal" autoFocus /></Field>
      <Field label="Propietario"><OwnerSelect value={owner} onChange={setOwner} state={state} /></Field>
      <Field label="Tipo">
        <div className="ff-segmented">
          <button className={kind === "cuota" ? "active" : ""} onClick={() => setKind("cuota")}>Cuota fija</button>
          <button className={kind === "tarjeta" ? "active" : ""} onClick={() => setKind("tarjeta")}>Tarjeta / libre</button>
        </div>
      </Field>
      <Field label="Saldo actual (Gs.)"><input type="number" value={currentBalance} onChange={(e) => setCurrentBalance(e.target.value)} /></Field>
      {kind === "cuota" && <>
        <Field label="Cuota mensual (Gs.)"><input type="number" value={installment} onChange={(e) => setInstallment(e.target.value)} /></Field>
        <Field label="Día de vencimiento"><input type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} /></Field>
      </>}
    </Sheet>
  );
}

function patrimonioTrend(state) {
  const h = state.patrimonioHistory;
  if (h.length < 2) return null;
  const recent = h.slice(-7); // hasta 6 diferencias mes a mes
  const deltas = [];
  for (let i = 1; i < recent.length; i++) deltas.push(recent[i].value - recent[i - 1].value);
  if (deltas.length === 0) return null;
  return deltas.reduce((s, d) => s + d, 0) / deltas.length;
}

function GoalModal({ state, onClose, onSubmit, editing }) {
  const [goalType, setGoalType] = useState(editing?.type === "patrimonio" ? "patrimonio" : "ahorro");
  const [name, setName] = useState(editing?.name || "");
  const [target, setTarget] = useState(editing ? String(editing.target || "") : "");
  const [targetDate, setTargetDate] = useState(editing?.targetDate || "");
  const [owner, setOwner] = useState(editing?.owner || "familia");
  return (
    <Sheet title={editing ? "Editar objetivo" : "Nuevo objetivo"} onClose={onClose} footer={
      <button className="ff-btn ff-btn--primary ff-btn--full" disabled={!name || !Number(target)} onClick={() => onSubmit({ goalType, name, target: Number(target), targetDate: targetDate || null, owner })}>{editing ? "Guardar cambios" : "Crear objetivo"}</button>
    }>
      {!editing && (
        <Field label="¿Qué tipo de objetivo es?">
          <div className="ff-segmented">
            <button className={goalType === "ahorro" ? "active" : ""} onClick={() => setGoalType("ahorro")}><PiggyBank size={14} /> Ahorro para algo</button>
            <button className={goalType === "patrimonio" ? "active" : ""} onClick={() => setGoalType("patrimonio")}><TrendingUp size={14} /> Patrimonio a largo plazo</button>
          </div>
        </Field>
      )}
      {goalType === "ahorro" ? (
        <div className="ff-note"><Info size={14} /> Esto crea una cuenta de ahorro dedicada. Usá "Ahorré" para ir sumando dinero real hacia esta meta.</div>
      ) : (
        <div className="ff-note"><Info size={14} /> Esto no crea una cuenta nueva: sigue tu patrimonio neto real (activos - deudas) hasta la fecha que elijas. Se actualiza solo con cada movimiento que registrás.</div>
      )}
      <Field label="Nombre del objetivo"><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={goalType === "patrimonio" ? "Ej: Patrimonio en 10 años" : "Ej: Vacaciones"} autoFocus /></Field>
      <Field label={goalType === "patrimonio" ? "Patrimonio neto que querés alcanzar (Gs.)" : "Monto objetivo (Gs.)"}><input type="number" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
      {goalType === "patrimonio" && <Field label="Fecha objetivo (opcional)"><input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></Field>}
      <Field label="¿De quién es este objetivo?"><OwnerSelect value={owner} onChange={setOwner} state={state} /></Field>
    </Sheet>
  );
}

function SimulatorSheet({ state, onClose, onApply }) {
  const [extraIncome, setExtraIncome] = useState("");
  const [investAmount, setInvestAmount] = useState("");
  const [reduceExpense, setReduceExpense] = useState("");
  const [payDebtId, setPayDebtId] = useState("");
  const [payDebtAmount, setPayDebtAmount] = useState("");

  const changes = {
    extraIncome: Number(extraIncome) || 0,
    incomeAccountId: "ueno",
    investAmount: Number(investAmount) || 0,
    reduceExpense: Number(reduceExpense) || 0,
    payDebtId: payDebtId || null,
    payDebtAmount: Number(payDebtAmount) || 0,
  };
  const hasAny = changes.extraIncome > 0 || changes.investAmount > 0 || changes.reduceExpense > 0 || (changes.payDebtId && changes.payDebtAmount > 0);
  const result = hasAny ? simulate(state, changes) : null;
  const current = { netWorth: netWorth(state), fundPct: fundBalance(state) / state.settings.fondoTarget, liquidTotal: liquidTotal(state), debtTotal: totalDebts(state) };

  return (
    <Sheet title="Simulador — ¿qué pasa si...?" onClose={onClose} footer={
      hasAny ? <button className="ff-btn ff-btn--primary ff-btn--full" onClick={() => onApply(changes)}><Wand2 size={16} /> Aplicar como movimientos reales</button> : null
    }>
      <div className="ff-note"><Info size={14} /> Esto no modifica tus datos reales hasta que toques "Aplicar".</div>
      <Field label="¿Y si recibo un ingreso extra? (Gs.)"><input type="number" value={extraIncome} onChange={(e) => setExtraIncome(e.target.value)} /></Field>
      <Field label="¿Y si invierto? (Gs.)"><input type="number" value={investAmount} onChange={(e) => setInvestAmount(e.target.value)} /></Field>
      <Field label="¿Y si reduzco gastos variables? (Gs.)"><input type="number" value={reduceExpense} onChange={(e) => setReduceExpense(e.target.value)} /></Field>
      <Field label="¿Y si pago una deuda?">
        <select value={payDebtId} onChange={(e) => setPayDebtId(e.target.value)}>
          <option value="">— No simular pago de deuda —</option>
          {state.debts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      {payDebtId && <Field label="Monto a pagar (Gs.)"><input type="number" value={payDebtAmount} onChange={(e) => setPayDebtAmount(e.target.value)} /></Field>}

      {result && (
        <div className="ff-preview">
          <div className="ff-preview__title">Resultado proyectado (estimación, no garantía)</div>
          <div className="ff-preview__row"><span>Dinero disponible</span><b>{fmt(current.liquidTotal)} → {fmt(result.liquidTotal)}</b></div>
          <div className="ff-preview__row"><span>Fondo de emergencia</span><b>{pct1(current.fundPct)} → {pct1(result.fundPct)}</b></div>
          <div className="ff-preview__row"><span>Inversiones</span><b>{fmt(result.investTotal)}</b></div>
          <div className="ff-preview__row"><span>Deudas</span><b>{fmt(current.debtTotal)} → {fmt(result.debtTotal)}</b></div>
          <div className="ff-preview__row"><span>Patrimonio neto</span><b>{fmt(current.netWorth)} → {fmt(result.netWorth)}</b></div>
          {result.fundETA.months !== null && <div className="ff-preview__note">Con este cambio, llegarías al fondo completo en ~{result.fundETA.months} meses.</div>}
        </div>
      )}
    </Sheet>
  );
}

/* ============================================================
   CONFIGURAR / CARGAR NUEVA SITUACIÓN
   ============================================================ */

function SetupModal({ state, onClose, onApply }) {
  const [step, setStep] = useState(1);
  const [cutoffDate, setCutoffDate] = useState(today());
  const [accounts, setAccounts] = useState(state.accounts.filter((a) => a.kind === "liquido").map((a) => ({ ...a })));
  const [fondoBalance, setFondoBalance] = useState(getAcc(state, "fondo")?.balance || 0);
  const [fondoTarget, setFondoTarget] = useState(state.settings.fondoTarget);
  const [investmentStartDate, setInvestmentStartDate] = useState(state.settings.investmentStartDate);
  const [debts, setDebts] = useState(state.debts.map((d) => ({ ...d })));
  const [fixedExpenses, setFixedExpenses] = useState(state.settings.fixedExpenses.map((f) => ({ ...f })));

  const updateAccount = (i, patch) => setAccounts((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  const addAccount = () => setAccounts((prev) => [...prev, { id: uid(), name: "", icon: "bank", kind: "liquido", owner: "richard", balance: 0, active: true }]);
  const removeAccount = (i) => setAccounts((prev) => prev.filter((_, idx) => idx !== i));
  const updateDebt = (i, patch) => setDebts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const addDebt = () => setDebts((prev) => [...prev, { id: uid(), name: "", icon: "card", kind: "cuota", owner: "familia", currentBalance: 0, initialBalance: 0, installment: 0, dueDay: 1, lastPaidPeriod: null, payments: [] }]);
  const removeDebt = (i) => setDebts((prev) => prev.filter((_, idx) => idx !== i));
  const updateFixed = (i, patch) => setFixedExpenses((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const addFixed = () => setFixedExpenses((prev) => [...prev, { id: uid(), name: "", owner: "familia", amount: 0, dueDay: null }]);
  const removeFixed = (i) => setFixedExpenses((prev) => prev.filter((_, idx) => idx !== i));

  function handleApply() {
    const cleanAccounts = [
      ...accounts.filter((a) => a.name.trim()).map((a) => ({ ...a, balance: Number(a.balance) || 0, active: true })),
      { id: "fondo", name: "Fondo de Emergencia", icon: "shield", kind: "fondo", owner: "familia", balance: Number(fondoBalance) || 0, active: true },
      { id: "inv-pendiente", name: "Capital de Inversión Pendiente", icon: "package", kind: "inversion_pendiente", owner: "familia", balance: 0, active: true },
      { id: "inv-disponible", name: "Capital Disponible para Invertir", icon: "trending", kind: "inversion_disponible", owner: "familia", balance: 0, active: true },
    ];
    const cleanDebts = debts.filter((d) => d.name.trim()).map((d) => ({
      ...d, currentBalance: Number(d.currentBalance) || 0, initialBalance: Number(d.currentBalance) || 0,
      installment: Number(d.installment) || 0, dueDay: d.dueDay ? Number(d.dueDay) : null,
      lastPaidPeriod: d.kind === "cuota" ? (d.lastPaidPeriod || null) : null, payments: [], consumptions: [],
    }));
    const cleanFixed = fixedExpenses.filter((f) => f.name.trim()).map((f) => ({ ...f, amount: Number(f.amount) || 0, dueDay: f.dueDay ? Number(f.dueDay) : null }));
    const goals = [
      { id: "g-fondo", name: "Fondo de emergencia", type: "fondo", ref: "fondo", target: Number(fondoTarget) || 0, owner: "familia", custom: false },
      ...cleanDebts.filter((d) => d.kind === "cuota").map((d) => ({ id: uid(), name: `Cancelar ${d.name}`, type: "deuda", ref: d.id, target: d.initialBalance, owner: d.owner, custom: false })),
      { id: "g-inversion", name: "Inversiones", type: "inversion", ref: "ALL", target: null, owner: "familia", custom: false },
    ];

    // Los saldos cargados acá son SALDOS INICIALES, no ingresos: se guardan como
    // movimientos de auditoría fechados en el corte, para que el historial real
    // empiece a contarse desde esta fecha (no se suman a la regla de distribución familiar).
    const saldoInicialMovs = [];
    cleanAccounts.forEach((a) => {
      if (a.balance !== 0) saldoInicialMovs.push({ id: uid(), type: "saldo_inicial", owner: a.owner, amount: a.balance, accountId: a.id, date: cutoffDate, description: `Saldo inicial de ${a.name}`, status: "activo" });
    });
    cleanDebts.forEach((d) => {
      if (d.currentBalance !== 0) saldoInicialMovs.push({ id: uid(), type: "saldo_inicial", owner: d.owner, amount: -d.currentBalance, debtId: d.id, date: cutoffDate, description: `Saldo inicial de deuda: ${d.name}`, status: "activo" });
    });

    onApply({
      version: 2, people: state.people, accounts: cleanAccounts, debts: cleanDebts, investments: [], movements: saldoInicialMovs, goals,
      patrimonioHistory: [],
      tasks: state.tasks || [],
      settings: { ...state.settings, fondoTarget: Number(fondoTarget) || 0, investmentStartDate, fixedExpenses: cleanFixed },
      meta: { createdAt: state.meta?.createdAt || today(), initialSetupDate: cutoffDate },
    });
  }

  return (
    <Sheet title="Configuración financiera inicial" onClose={onClose} footer={
      <div className="ff-row-inline" style={{ width: "100%" }}>
        {step > 1 && <button className="ff-btn ff-btn--secondary" onClick={() => setStep((s) => s - 1)}>Atrás</button>}
        {step < 4 ? <button className="ff-btn ff-btn--primary" style={{ flex: 1 }} onClick={() => setStep((s) => s + 1)}>Siguiente</button>
          : <button className="ff-btn ff-btn--primary" style={{ flex: 1 }} onClick={handleApply}>Cargar esta situación</button>}
      </div>
    }>
      <div className="ff-note" style={{ marginBottom: 10 }}><Info size={14} /> Reemplaza cuentas, deudas y configuración de toda la familia. El historial de movimientos se reinicia. Podés dejar todo en Gs. 0.</div>
      <Field label="Fecha de corte (a partir de acá empieza el historial real)"><input type="date" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} /></Field>
      <div className="ff-preview" style={{ marginBottom: 6 }}>
        <div className="ff-preview__title">Situación financiera inicial — {humanDate(cutoffDate)}</div>
        <div className="ff-preview__note">Los saldos que cargues quedan registrados como saldos iniciales en esta fecha, no como ingresos. No entran en la regla de distribución familiar.</div>
      </div>
      <div className="ff-steps">
        {["Cuentas", "Fondo e inversión", "Deudas y fijos", "Confirmar"].map((l, i) => (
          <div key={l} className={`ff-step ${step === i + 1 ? "active" : ""} ${step > i + 1 ? "done" : ""}`}>{i + 1}. {l}</div>
        ))}
      </div>
      {step === 1 && (<>
        <div className="ff-card__title" style={{ marginBottom: 8 }}>Cuentas líquidas</div>
        {accounts.map((a, i) => (
          <div key={a.id} className="ff-setup-block">
            <input type="text" placeholder="Nombre" value={a.name} onChange={(e) => updateAccount(i, { name: e.target.value })} />
            <div className="ff-setup-row">
              <select value={a.owner} onChange={(e) => updateAccount(i, { owner: e.target.value })}>
                {state.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value="familia">Familia</option>
              </select>
              <input type="number" placeholder="0" value={a.balance} onChange={(e) => updateAccount(i, { balance: e.target.value })} className="ff-setup-amount" />
              <button className="ff-icon-btn ff-icon-btn--ghost" onClick={() => removeAccount(i)}><Minus size={16} /></button>
            </div>
          </div>
        ))}
        <button className="ff-btn ff-btn--outline ff-btn--full" onClick={addAccount}><Plus size={15} /> Agregar cuenta</button>
      </>)}
      {step === 2 && (<>
        <Field label="Saldo actual del fondo de emergencia (Gs.)"><input type="number" value={fondoBalance} onChange={(e) => setFondoBalance(e.target.value)} /></Field>
        <Field label="Meta del fondo de emergencia (Gs.)"><input type="number" value={fondoTarget} onChange={(e) => setFondoTarget(e.target.value)} /></Field>
        <Field label="Fecha de inicio de inversiones"><input type="date" value={investmentStartDate} onChange={(e) => setInvestmentStartDate(e.target.value)} /></Field>
      </>)}
      {step === 3 && (<>
        <div className="ff-card__title" style={{ marginBottom: 8 }}>Deudas</div>
        {debts.map((d, i) => (
          <div key={d.id} className="ff-setup-block">
            <input type="text" placeholder="Nombre" value={d.name} onChange={(e) => updateDebt(i, { name: e.target.value })} />
            <div className="ff-setup-row">
              <input type="number" placeholder="Saldo actual" value={d.currentBalance} onChange={(e) => updateDebt(i, { currentBalance: e.target.value })} />
              <input type="number" placeholder="Cuota" value={d.installment} onChange={(e) => updateDebt(i, { installment: e.target.value })} />
            </div>
            <button className="ff-icon-btn ff-icon-btn--ghost" onClick={() => removeDebt(i)}><Trash2 size={14} /> Quitar</button>
          </div>
        ))}
        <button className="ff-btn ff-btn--outline ff-btn--full" onClick={addDebt}><Plus size={15} /> Agregar deuda</button>
        <div className="ff-card__title" style={{ margin: "16px 0 8px" }}>Gastos fijos mensuales</div>
        {fixedExpenses.map((f, i) => (
          <div key={f.id} className="ff-setup-row">
            <input type="text" placeholder="Nombre" value={f.name} onChange={(e) => updateFixed(i, { name: e.target.value })} />
            <input type="number" placeholder="0" value={f.amount} onChange={(e) => updateFixed(i, { amount: e.target.value })} className="ff-setup-amount" />
            <button className="ff-icon-btn ff-icon-btn--ghost" onClick={() => removeFixed(i)}><Minus size={16} /></button>
          </div>
        ))}
        <button className="ff-btn ff-btn--outline ff-btn--full" onClick={addFixed}><Plus size={15} /> Agregar gasto fijo</button>
      </>)}
      {step === 4 && (
        <div className="ff-preview">
          <div className="ff-preview__title">Resumen</div>
          <div className="ff-preview__row"><span>Cuentas líquidas</span><b>{fmt(accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0))}</b></div>
          <div className="ff-preview__row"><span>Fondo de emergencia</span><b>{fmt(fondoBalance)} / {fmt(fondoTarget)}</b></div>
          <div className="ff-preview__row"><span>Deudas</span><b>{fmt(debts.reduce((s, d) => s + (Number(d.currentBalance) || 0), 0))}</b></div>
          <div className="ff-preview__row"><span>Gastos fijos/mes</span><b>{fmt(fixedExpenses.reduce((s, f) => s + (Number(f.amount) || 0), 0))}</b></div>
          <div className="ff-preview__note">Esta acción no se puede deshacer.</div>
        </div>
      )}
    </Sheet>
  );
}

function ResetConfirmSheet({ onClose, onConfirm }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Sheet title="Restablecer datos financieros" onClose={onClose} footer={
      <button className="ff-btn ff-btn--danger ff-btn--full" disabled={!confirmed} onClick={onConfirm}>Sí, restablecer todo</button>
    }>
      <div className="ff-note ff-note--amber" style={{ marginBottom: 8 }}><AlertTriangle size={14} /> Esta acción no se puede deshacer.</div>
      <div className="ff-card__title" style={{ marginBottom: 6 }}>Se va a eliminar:</div>
      <ul className="ff-reset-list">
        <li>Todas las cuentas de Richard, Raquel y de la familia</li>
        <li>Todos los ingresos y gastos registrados</li>
        <li>Todas las deudas y sus pagos</li>
        <li>Todos los ahorros e inversiones</li>
        <li>El historial de patrimonio</li>
        <li>Todos los objetivos</li>
      </ul>
      <div className="ff-card__title" style={{ margin: "14px 0 6px" }}>Se va a conservar:</div>
      <ul className="ff-reset-list ff-reset-list--keep">
        <li>La aplicación, el diseño y la navegación</li>
        <li>Richard y Raquel como personas</li>
        <li>Las reglas de distribución (%), categorías y modo claro/oscuro</li>
      </ul>
      <label className="ff-checkbox-row">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        Entiendo que esto borra todos los datos financieros y no se puede deshacer.
      </label>
    </Sheet>
  );
}

function PinPad({ onDigit, onDelete }) {
  return (
    <div className="ff-pinpad">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) => (
        k === "" ? <div key={i} /> : (
          <button key={i} onClick={() => (k === "⌫" ? onDelete() : onDigit(k))}>{k}</button>
        )
      ))}
    </div>
  );
}

function LockScreen({ state, requestedPerson, onUnlock, onCancel }) {
  const [selected, setSelected] = useState(requestedPerson || null);
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);

  function tryPin(nextPin) {
    setPin(nextPin);
    if (nextPin.length === 4) {
      const correct = state.settings.pins[selected] === nextPin;
      setTimeout(() => {
        if (correct) onUnlock(selected);
        else { setShake(true); setPin(""); setTimeout(() => setShake(false), 400); }
      }, 120);
    }
  }

  if (!selected) {
    return (
      <div className="ff-lock-overlay">
        <div className="ff-lock-card">
          <div className="ff-lock-emoji">🔒</div>
          <h2 className="ff-lock-title">¿Quién sos?</h2>
          <div className="ff-lock-people">
            {state.people.map((p) => (
              <button key={p.id} className="ff-lock-person" onClick={() => setSelected(p.id)}>
                <User size={22} /> {p.name}
              </button>
            ))}
          </div>
          {onCancel && <button className="ff-link-btn" style={{ marginTop: 14 }} onClick={onCancel}>Cancelar</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="ff-lock-overlay">
      <div className={`ff-lock-card ${shake ? "ff-lock-card--shake" : ""}`}>
        <div className="ff-lock-emoji">🔒</div>
        <h2 className="ff-lock-title">PIN de {personName(state, selected)}</h2>
        <div className="ff-lock-dots">
          {[0, 1, 2, 3].map((i) => <div key={i} className={`ff-lock-dot ${i < pin.length ? "filled" : ""}`} />)}
        </div>
        <PinPad onDigit={(d) => pin.length < 4 && tryPin(pin + d)} onDelete={() => setPin(pin.slice(0, -1))} />
        <button className="ff-link-btn" style={{ marginTop: 14 }} onClick={() => { setSelected(requestedPerson || null); setPin(""); if (!requestedPerson) {} else if (onCancel) onCancel(); }}>
          {requestedPerson ? "Cancelar" : "← Elegir otra persona"}
        </button>
      </div>
    </div>
  );
}

function CloudStatusBanner() {
  // Dos canales independientes: uno para guardado/lectura normal, otro para la
  // sincronización en vivo. Así, si guardar funciona pero la sincronización en
  // vivo se cortó, ese aviso no queda tapado por el próximo guardado exitoso.
  const [statuses, setStatuses] = useState({ storage: null, sync: null });
  useEffect(() => {
    function handler(e) {
      const { source, status, message } = e.detail;
      setStatuses((prev) => ({ ...prev, [source]: status === "ok" ? null : { status, message } }));
    }
    window.addEventListener("cloudstorage-status", handler);
    return () => window.removeEventListener("cloudstorage-status", handler);
  }, []);
  const active = statuses.storage || statuses.sync;
  if (!active) return null;
  return (
    <div className="ff-cloud-banner">
      <AlertTriangle size={14} />
      <span>{active.message}</span>
    </div>
  );
}

function SaveIndicator({ status }) {
  if (status === "idle") return null;
  const map = {
    saving: { label: "Guardando…", tone: "amber" },
    saved: { label: "Guardado", tone: "emerald" },
    error: { label: "No se pudo guardar", tone: "red" },
  };
  const cfg = map[status];
  if (!cfg) return null;
  return <span className={`ff-save-indicator ff-save-indicator--${cfg.tone}`}>{cfg.label}</span>;
}

function TopBar({ state, activeUser, onRequestSwitch, viewMode, setViewMode, saveStatus }) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  return (
    <div className="ff-topbar">
      <div className="ff-topbar__who">
        <button className="ff-who-btn" onClick={() => setSwitcherOpen((v) => !v)}>
          <User size={14} /> Sos: <b>{personName(state, activeUser)}</b> <ChevronRight size={13} className="ff-who-caret" />
        </button>
        {switcherOpen && (
          <div className="ff-who-menu">
            {state.people.map((p) => (
              <button key={p.id} className={activeUser === p.id ? "active" : ""} onClick={() => { setSwitcherOpen(false); if (p.id !== activeUser) onRequestSwitch(p.id); }}>
                <User size={14} /> {p.name}
              </button>
            ))}
          </div>
        )}
        <SaveIndicator status={saveStatus} />
      </div>
      <div className="ff-segmented ff-topbar__mode">
        <button className={viewMode === "mio" ? "active" : ""} onClick={() => setViewMode("mio")}><User size={13} /> Mi dinero</button>
        <button className={viewMode === "familia" ? "active" : ""} onClick={() => setViewMode("familia")}><Users size={13} /> Nuestra familia</button>
      </div>
    </div>
  );
}

/* ============================================================
   TAB: INICIO
   ============================================================ */

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function DashboardTab({ state, viewOwner, activeUser, onDistribute, onNavigate, onOpenSimulator }) {
  const [showDetail, setShowDetail] = useState(false);
  const currentMonth = ym(today());
  const budget = monthlyBudget(state, currentMonth);
  const fixed = pendingFixedThisMonth(state, currentMonth);
  const fund = getAcc(state, "fondo");
  const pct = fund.balance / state.settings.fondoTarget;
  const complete = fundComplete(state);
  const rates = getRates(state, today());
  const invTotals = investmentTotals(state, viewOwner === "familia" ? null : viewOwner);
  const invDisp = getAcc(state, "inv-disponible");
  const invPend = getAcc(state, "inv-pendiente");
  const debtsTotal = totalDebts(state, viewOwner === "familia" ? null : viewOwner);
  const ocioDisponible = budget.ocioAssigned - budget.ocioSpent;
  const pendingEmergenciaMovs = state.movements.filter((m) => m.type === "ingreso" && m.status === "activo" && m.allocation && m.allocation.emergencia > 0 && !distStatus(m).emergencia);
  const pendingInversionMovs = state.movements.filter((m) => m.type === "ingreso" && m.status === "activo" && m.allocation && m.allocation.inversion > 0 && !distStatus(m).inversion);
  const pendingEmergencia = pendingEmergenciaMovs.reduce((s, m) => s + m.allocation.emergencia, 0);
  const pendingInversion = pendingInversionMovs.reduce((s, m) => s + m.allocation.inversion, 0);
  const undistributedMap = new Map();
  [...pendingEmergenciaMovs, ...pendingInversionMovs].forEach((m) => undistributedMap.set(m.id, m));
  const undistributed = Array.from(undistributedMap.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
  const dineroLibre = liquidTotal(state, viewOwner === "familia" ? null : viewOwner) - fixed.pending - budget.pendingDistribution;
  const necesidadesOver = budget.necesidadesReal - budget.necesidadesRecommended;
  const daily = dailySpendingSuggestion(state);
  const insights = generateInsights(state);
  const myTasksPending = state.tasks.filter((t) => t.owner === activeUser && !t.done);
  const myTasksOverdue = myTasksPending.filter((t) => t.dueDate && t.dueDate < today());
  const myLiquid = liquidTotal(state, viewOwner === "familia" ? null : viewOwner);
  const accountsForView = ownerFilter(activeAccounts(state).filter((a) => a.kind === "liquido"), viewOwner === "familia" ? null : viewOwner);

  const message = complete ? "El fondo familiar está completo. Ahora ese % refuerza inversiones." : necesidadesOver > 0 ? "Las necesidades están un poco por encima de lo recomendado este mes." : "El dinero familiar está bajo control.";

  return (
    <div className="ff-tab">
      <div className="ff-hero">
        <div className="ff-hero__eyebrow">{greeting()}</div>
        <div className="ff-hero__msg">{message}</div>
      </div>

      <Card className="ff-total-card">
        <div className="ff-total-card__label">Dinero {viewOwner === "familia" ? "total familiar" : `de ${personName(state, viewOwner)}`}</div>
        <div className="ff-total-card__value">{fmt(myLiquid)}</div>
        <div className="ff-total-card__breakdown">
          {accountsForView.length === 0 ? (
            <div>Todavía no hay cuentas cargadas para {personName(state, viewOwner)}.</div>
          ) : accountsForView.map((a) => <div key={a.id}><Icon name={a.icon} size={14} /> {a.name} <b>{fmt(a.balance)}</b></div>)}
        </div>
      </Card>

      <Card className="ff-goal-card" onClick={() => onNavigate("patrimonio")}>
        <div className="ff-row-between">
          <div className="ff-card__title"><Shield size={16} className="ff-ic-emerald" /> Fondo de emergencia (familiar)</div>
          {complete && <Pill tone="emerald"><CheckCircle2 size={12} /> Completo</Pill>}
        </div>
        <div className="ff-goal-card__value">{fmt(fund.balance)} <span>/ {fmt(state.settings.fondoTarget)}</span></div>
        <ProgressBar pct={pct} tone="emerald" celebrate={complete} />
        <div className="ff-row-between ff-small-text"><span>{(pct * 100).toFixed(2)}% completado</span><span>{complete ? "¡Objetivo alcanzado!" : `${fmt(state.settings.fondoTarget - fund.balance)} restantes`}</span></div>
        {pendingEmergencia > 0 && (
          <div className="ff-pending-line">
            <span><AlertTriangle size={13} /> {fmt(pendingEmergencia)} sin distribuir todavía</span>
            <button onClick={(e) => { e.stopPropagation(); onDistribute(pendingEmergenciaMovs.map((m) => m.id), "emergencia"); }}>Distribuir</button>
          </div>
        )}
      </Card>

      <div className="ff-grid-2">
        <Card className="ff-stat-card" onClick={() => onNavigate("patrimonio")}>
          <div className="ff-card__title"><TrendingUp size={15} className="ff-ic-petrol" /> Inversiones</div>
          <div className="ff-stat-card__value">{fmt(invTotals.current)}</div>
          <div className="ff-card__sub">{invTotals.contributed > 0 ? `${invTotals.gain >= 0 ? "+" : ""}${fmt(invTotals.gain)} (${pct1(invTotals.rentabilidad)})` : (rates.invStarted ? "Todavía sin aportes" : `Arrancan: ${monthLabel(state.settings.investmentStartDate.slice(0, 7))}`)}</div>
          {(invDisp.balance > 0 || invPend.balance > 0) && (
            <div className="ff-capital-line">
              <Package size={13} /> {fmt(invDisp.balance + invPend.balance)} {invDisp.balance > 0 ? "listo para invertir" : "reservado, esperando"}
            </div>
          )}
          {pendingInversion > 0 && (
            <div className="ff-pending-line ff-pending-line--stacked">
              <span><AlertTriangle size={13} /> {fmt(pendingInversion)} por invertir</span>
              <button onClick={(e) => { e.stopPropagation(); onDistribute(pendingInversionMovs.map((m) => m.id), "inversion"); }}>Distribuir</button>
            </div>
          )}
        </Card>
        <Card className="ff-stat-card" onClick={() => onNavigate("patrimonio")}>
          <div className="ff-card__title"><CreditCard size={15} className="ff-ic-red" /> Deudas</div>
          <div className="ff-stat-card__value">{fmt(debtsTotal)}</div>
          <div className="ff-card__sub">{ownerFilter(state.debts, viewOwner === "familia" ? null : viewOwner).length} obligaciones activas</div>
        </Card>
      </div>

      {undistributed.length > 0 && (
        <div className="ff-pending-explain">
          <Info size={13} /> Emergencia e inversión salen del mismo ingreso, pero cada una se distribuye por separado —
          podés mover una sin la otra, por ejemplo si todavía no te alcanza para las dos.
          {undistributed.length > 1 && (
            <button className="ff-link-btn" onClick={() => setShowDetail((v) => !v)}>{showDetail ? " Ocultar detalle" : " Ver ingreso por ingreso"}</button>
          )}
        </div>
      )}
      {showDetail && undistributed.map((m) => {
        const ds = distStatus(m);
        const parts = [];
        if (!ds.emergencia && m.allocation.emergencia > 0) parts.push(`${fmt(m.allocation.emergencia)} a fondo`);
        if (!ds.inversion && m.allocation.inversion > 0) parts.push(`${fmt(m.allocation.inversion)} a inversión`);
        return (
          <button key={m.id} className="ff-mini-row" onClick={() => onDistribute([m.id], "all")}>
            <span>{humanDate(m.date)} · {personName(state, m.owner)} · {parts.join(" + ")}</span>
            <span className="ff-link">Distribuir <ChevronRight size={14} /></span>
          </button>
        );
      })}

      <Card className={daily.overBudget ? "ff-card--amber" : "ff-card--outline"} onClick={() => onNavigate("movimientos")}>
        <div className="ff-card__title"><Home size={16} className="ff-ic-carbon" /> Cuánto gastar por día en necesidades</div>
        {daily.overBudget ? (
          <>
            <div className="ff-stat-card__value">Gs. 0</div>
            <div className="ff-card__sub">Ya superaste el 50% recomendado para necesidades este mes en {fmt(-daily.restante)}. Cualquier gasto de acá en más ya está por encima de lo sugerido.</div>
          </>
        ) : (
          <>
            <div className="ff-stat-card__value">{fmt(daily.perDay)} <span className="ff-muted">/día</span></div>
            <div className="ff-card__sub">
              Te quedan {fmt(daily.restante)} de tu presupuesto de necesidades (comida, transporte, servicios, etc.)
              para los próximos {daily.daysRemaining} {daily.daysRemaining === 1 ? "día" : "días"} de este mes.
            </div>
          </>
        )}
        <div className="ff-row-between ff-small-text">
          <span>Gastado: {fmt(daily.spent)}</span>
          <span>Presupuesto: {fmt(daily.recommended)}</span>
        </div>
      </Card>

      <Card className="ff-card--emerald-soft" onClick={() => onNavigate("movimientos")}>
        <div className="ff-card__title"><Sparkles size={16} /> Dinero para disfrutar</div>
        <div className="ff-stat-card__value">{fmt(Math.max(ocioDisponible, 0))}</div>
        <div className="ff-card__sub">{ocioDisponible >= 0 ? `Todavía hay ${fmt(ocioDisponible)} para disfrutar sin culpa este mes.` : `Se superó el presupuesto de ocio en ${fmt(-ocioDisponible)} este mes.`}</div>
      </Card>

      {myTasksPending.length > 0 && (
        <Card className="ff-card--outline" onClick={() => onNavigate("agenda")}>
          <div className="ff-row-between">
            <div>
              <div className="ff-card__title"><ListChecks size={15} /> Tu agenda</div>
              <div className="ff-card__sub">
                {myTasksPending.length} {myTasksPending.length === 1 ? "pendiente" : "pendientes"}
                {myTasksOverdue.length > 0 && <span className="ff-ic-red"> · {myTasksOverdue.length} atrasada{myTasksOverdue.length === 1 ? "" : "s"}</span>}
              </div>
            </div>
            <ChevronRight size={18} className="ff-muted" />
          </div>
        </Card>
      )}

      <Card>
        <div className="ff-card__title">Cómo se distribuye el ingreso familiar</div>
        <div className="ff-donut-row">
          <div className="ff-chart-wrap" style={{ width: 130, height: 130, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "Emergencia", value: rates.emergencia, color: "var(--ff-emerald)" },
                    { name: "Inversión", value: rates.inversion, color: "var(--ff-petrol)" },
                    { name: "Ocio", value: rates.ocio, color: "var(--ff-amber)" },
                    { name: "Necesidades", value: rates.necesidades, color: "var(--ff-carbon)" },
                  ].filter((d) => d.value > 0)}
                  dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2} startAngle={90} endAngle={-270}
                >
                  {[rates.emergencia > 0 && "var(--ff-emerald)", "var(--ff-petrol)", "var(--ff-amber)", "var(--ff-carbon)"].filter(Boolean).map((c, i) => <Cell key={i} fill={c} />)}
                </Pie>
                <Tooltip formatter={(v) => `${Math.round(v * 100)}%`} contentStyle={{ borderRadius: 12, border: "1px solid var(--ff-border)", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="ff-alloc-grid ff-alloc-grid--compact">
            <div className="ff-alloc-item"><Shield size={16} className="ff-ic-emerald" /><span>{Math.round(rates.emergencia * 100)}%</span><small>Emergencia</small></div>
            <div className="ff-alloc-item"><TrendingUp size={16} className="ff-ic-petrol" /><span>{Math.round(rates.inversion * 100)}%</span><small>Inversión</small></div>
            <div className="ff-alloc-item"><Sparkles size={16} className="ff-ic-amber" /><span>{Math.round(rates.ocio * 100)}%</span><small>Ocio</small></div>
            <div className="ff-alloc-item"><Home size={16} className="ff-ic-carbon" /><span>{Math.round(rates.necesidades * 100)}%</span><small>Necesidades</small></div>
          </div>
        </div>
        {complete && <div className="ff-note ff-note--emerald">El fondo está completo: ese porcentaje ahora refuerza inversiones automáticamente.</div>}
      </Card>

      <Card className="ff-card--outline" onClick={() => onNavigate("patrimonio")}>
        <div className="ff-row-between">
          <div><div className="ff-card__title"><Wallet size={15} /> Dinero libre real</div><div className="ff-card__sub">Sin comprometer fondo, deudas ni obligaciones.</div></div>
          <ChevronRight size={18} className="ff-muted" />
        </div>
        <div className="ff-stat-card__value">{fmt(Math.max(dineroLibre, 0))}</div>
      </Card>

      <Card>
        <div className="ff-row-between">
          <div className="ff-card__title"><Wand2 size={15} className="ff-ic-petrol" /> ¿Qué está pasando con mi dinero?</div>
        </div>
        <div className="ff-insights">
          {insights.map((ins, i) => (
            <div key={i} className={`ff-insight ff-insight--${ins.tone}`}>{ins.text}</div>
          ))}
        </div>
        <button className="ff-btn ff-btn--secondary ff-btn--full" onClick={onOpenSimulator}><Wand2 size={15} /> Simular una decisión</button>
      </Card>
    </div>
  );
}

/* ============================================================
   TAB: MOVIMIENTOS
   ============================================================ */

function IncomeStatusPill({ m }) {
  const ds = distStatus(m);
  const emergPending = m.allocation.emergencia > 0 && !ds.emergencia;
  const invPending = m.allocation.inversion > 0 && !ds.inversion;
  if (!emergPending && !invPending) return <Pill tone="emerald">Distribuido</Pill>;
  if (emergPending && invPending) return <Pill tone="amber">Sin distribuir</Pill>;
  return <Pill tone="amber">Parcial</Pill>;
}

const TYPE_META = {
  ingreso: { label: "Ingreso", icon: ArrowDownCircle, tone: "emerald", sign: 1 },
  gasto: { label: "Gasto", icon: ArrowUpCircle, tone: "red", sign: -1 },
  transferencia: { label: "Transferencia", icon: Repeat, tone: "petrol", sign: 0 },
  pago_deuda: { label: "Pago de deuda", icon: CreditCard, tone: "red", sign: -1 },
  inversion: { label: "Inversión", icon: TrendingUp, tone: "petrol", sign: 0 },
  ajuste: { label: "Corrección de saldo", icon: Pencil, tone: "petrol", sign: 0 },
  otro: { label: "Otro", icon: HelpCircle, tone: "petrol", sign: 0 },
  aporte: { label: "Aporte", icon: Shield, tone: "emerald", sign: 0 },
  saldo_inicial: { label: "Saldo inicial", icon: Landmark, tone: "petrol", sign: 0 },
};

function MovimientosTab({ state, viewOwner, onVoid, onEdit }) {
  const [filter, setFilter] = useState("todos");
  const movs = state.movements
    .filter((m) => m.type !== "aporte")
    .filter((m) => viewOwner === "familia" || m.owner === viewOwner || m.paidBy === viewOwner)
    .filter((m) => filter === "todos" || m.type === filter)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <div className="ff-tab">
      <div className="ff-tab-header"><h2>Movimientos</h2><p>¿Qué pasó con el dinero de {viewOwner === "familia" ? "la familia" : personName(state, viewOwner)}?</p></div>
      <div className="ff-filter-scroll">
        {["todos", "ingreso", "gasto", "transferencia", "pago_deuda", "inversion"].map((f) => (
          <button key={f} className={`ff-chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f === "todos" ? "Todos" : TYPE_META[f].label}</button>
        ))}
      </div>
      {movs.length === 0 ? (
        <EmptyState icon={<ArrowLeftRight size={28} />} title="Todavía no hay movimientos" subtitle="Registrá el primero con el botón +." />
      ) : (
        <div className="ff-list">
          {movs.map((m) => {
            const meta = TYPE_META[m.type] || TYPE_META.otro;
            const M = meta.icon;
            const accName = m.type === "transferencia" ? `${getAcc(state, m.fromId)?.name} → ${getAcc(state, m.toId)?.name}`
              : m.accountId ? (getAcc(state, m.accountId)?.name || state.debts.find((d) => d.id === m.accountId)?.name || "") : (m.debtId ? state.debts.find((d) => d.id === m.debtId)?.name : "");
            return (
              <div key={m.id} className={`ff-move-row ${m.status === "anulado" ? "ff-move-row--void" : ""}`}>
                <div className={`ff-move-icon ff-move-icon--${meta.tone}`}><M size={16} /></div>
                <div className="ff-move-mid">
                  <div className="ff-move-desc">
                    <span className="ff-move-desc__text">{m.description || m.category || meta.label}</span>
                    {m.type === "ingreso" && (
                      m.incomeType === "personal"
                        ? <Pill tone="neutral">Personal</Pill>
                        : m.allocation
                          ? <IncomeStatusPill m={m} />
                          : null
                    )}
                  </div>
                  <div className="ff-move-sub">{humanDate(m.date)} · {personName(state, m.owner)}{m.paidBy && m.paidBy !== m.owner ? ` (pagó ${personName(state, m.paidBy)})` : ""} · {accName}</div>
                </div>
                <div className="ff-move-right">
                  <div className={`ff-move-amount ff-move-amount--${meta.tone}`}>{meta.sign === 0 ? fmt(m.amount) : fmtSigned(meta.sign * m.amount)}</div>
                  {m.status === "activo" ? (
                    <div className="ff-row-inline">
                      {["ingreso", "gasto", "pago_deuda"].includes(m.type) && <button className="ff-icon-btn ff-icon-btn--ghost" title="Editar" onClick={() => onEdit(m)}><Pencil size={14} /></button>}
                      <button className="ff-icon-btn ff-icon-btn--ghost" title="Anular" onClick={() => onVoid(m.id)}><Trash2 size={14} /></button>
                    </div>
                  ) : <span className="ff-small-text">Anulado</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TAB: OBJETIVOS
   ============================================================ */

function ObjetivosTab({ state, onAddGoal, onEditGoal, onDeleteGoal, onOpenAhorro }) {
  const [adding, setAdding] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const trend = patrimonioTrend(state);
  const progressOf = (g) => {
    if (g.type === "fondo") return { current: getAcc(state, g.ref).balance, target: g.target };
    if (g.type === "ahorro") { const acc = getAcc(state, g.ref); return { current: acc ? acc.balance : 0, target: g.target }; }
    if (g.type === "inversion") return { current: investmentTotals(state, g.owner === "familia" ? null : g.owner).current, target: g.target };
    if (g.type === "deuda") { const d = state.debts.find((x) => x.id === g.ref); if (!d) return { current: 0, target: g.target }; return { current: g.target - d.currentBalance, target: g.target, sub: `Saldo restante: ${fmt(d.currentBalance)}` }; }
    if (g.type === "patrimonio") {
      const current = netWorth(state, g.owner === "familia" ? null : g.owner);
      let sub = g.targetDate ? `Objetivo: ${humanDate(g.targetDate)}` : "";
      if (trend !== null) {
        if (trend <= 0) sub += (sub ? " · " : "") + "El patrimonio familiar no está creciendo en promedio todavía — es una proyección, no una garantía.";
        else if (current < g.target) {
          const months = Math.ceil((g.target - current) / trend);
          const years = (months / 12).toFixed(1);
          const scope = g.owner === "familia" ? "A tu ritmo actual" : "Al ritmo actual de la familia (no hay historial separado por persona todavía)";
          sub += (sub ? " · " : "") + `${scope} (${fmt(trend)}/mes en promedio), llegarías en ~${years} años. Es una proyección, no una garantía.`;
        }
      } else {
        sub += (sub ? " · " : "") + "Necesitamos más historial (unos meses) para poder proyectar cuándo lo alcanzarías.";
      }
      return { current, target: g.target, sub };
    }
    return { current: 0, target: g.target };
  };

  return (
    <div className="ff-tab">
      <div className="ff-tab-header"><h2>Objetivos</h2><p>¿Hacia dónde estamos avanzando?</p></div>
      {state.goals.map((g) => {
        const p = progressOf(g);
        const pctv = p.target ? clamp01(p.current / p.target) : null;
        return (
          <Card key={g.id}>
            <div className="ff-row-between">
              <div className="ff-card__title">
                {g.type === "fondo" && <Shield size={16} className="ff-ic-emerald" />}
                {g.type === "deuda" && <Car size={16} className="ff-ic-red" />}
                {g.type === "inversion" && <TrendingUp size={16} className="ff-ic-petrol" />}
                {g.type === "ahorro" && <PiggyBank size={16} className="ff-ic-amber" />}
                {g.type === "patrimonio" && <TrendingUp size={16} className="ff-ic-emerald" />}
                {g.name} <Pill tone="neutral">{personName(state, g.owner)}</Pill>
              </div>
              <div className="ff-row-inline">
                {pctv !== null && pctv >= 1 && <Pill tone="emerald"><CheckCircle2 size={12} /> Listo</Pill>}
                {g.custom && (
                  <>
                    <button className="ff-icon-btn ff-icon-btn--ghost" onClick={() => setEditingGoal(g)}><Pencil size={13} /></button>
                    <button className="ff-icon-btn ff-icon-btn--ghost" onClick={() => onDeleteGoal(g)}><Trash2 size={13} /></button>
                  </>
                )}
              </div>
            </div>
            <div className="ff-stat-card__value">{fmt(p.current)} {p.target ? <span className="ff-muted">/ {fmt(p.target)}</span> : <span className="ff-muted">acumulado</span>}</div>
            {pctv !== null && <ProgressBar pct={pctv} tone={g.type === "deuda" ? "petrol" : "emerald"} celebrate={pctv >= 1} />}
            {p.sub && <div className="ff-small-text">{p.sub}</div>}
            {g.type === "ahorro" && <button className="ff-btn ff-btn--secondary ff-btn--full" onClick={() => onOpenAhorro(g.ref)}><PiggyBank size={14} /> Ahorrar hacia esta meta</button>}
          </Card>
        );
      })}
      {editingGoal && <GoalModal state={state} editing={editingGoal} onClose={() => setEditingGoal(null)} onSubmit={(g) => { onEditGoal(editingGoal, g); setEditingGoal(null); }} />}
      {adding ? <GoalModal state={state} onClose={() => setAdding(false)} onSubmit={(g) => { onAddGoal(g); setAdding(false); }} />
        : <button className="ff-btn ff-btn--outline ff-btn--full" onClick={() => setAdding(true)}><Plus size={16} /> Nuevo objetivo</button>}
    </div>
  );
}

/* ============================================================
   TAB: PATRIMONIO
   ============================================================ */

const PIE_COLORS = ["#146C55", "#0C4C63", "#B9852C", "#B3564A", "#767D87", "#8C6FB0"];

function PatrimonioTab({ state, viewOwner, onActivatePending, onAddAccount, onEditAccount, onHideAccount, onAddDebt, onEditDebt, onDeleteDebt, onUpdateInvestment, onOpenSetup }) {
  const scopedOwner = viewOwner === "familia" ? null : viewOwner;
  const eta = fundETA(state);
  const fixed = pendingFixedThisMonth(state, ym(today()));
  const minIncome = minIncomeNoDeficit(state);
  const invPend = getAcc(state, "inv-pendiente");
  const invDisp = getAcc(state, "inv-disponible");
  const started = investmentsStarted(state, today());
  const invTotals = investmentTotals(state, scopedOwner);
  const visibleAccounts = ownerFilter(activeAccounts(state).filter((a) => a.kind === "liquido" || a.kind === "ahorro"), scopedOwner);
  const visibleDebts = ownerFilter(state.debts, scopedOwner);
  const visibleInvestments = ownerFilter(state.investments, scopedOwner);
  const history = computeSnapshot(state).slice(-6);
  const curYm = ym(today());
  const months = lastNMonths(6, curYm);
  const flow = months.map((m) => {
    const b = monthlyBudget(state, m);
    const gastos = state.movements.filter((mv) => mv.status === "activo" && mv.type === "gasto" && ym(mv.date) === m).reduce((s, mv) => s + mv.amount, 0);
    return { name: monthShort(m), Ingresos: b.totalIncome, Gastos: gastos };
  });
  const catBreakdown = {};
  monthMovements(state, curYm).filter((m) => m.type === "gasto").forEach((m) => { catBreakdown[m.category] = (catBreakdown[m.category] || 0) + m.amount; });
  const catData = Object.entries(catBreakdown).map(([name, value]) => ({ name, value }));

  return (
    <div className="ff-tab">
      <div className="ff-tab-header"><h2>Patrimonio</h2><p>{viewOwner === "familia" ? "¿Dónde está el dinero y cuánto debemos?" : `¿Dónde está el dinero de ${personName(state, viewOwner)}?`}</p></div>

      <Card>
        <div className="ff-card__title">Patrimonio {viewOwner === "familia" ? "neto familiar" : `personal de ${personName(state, viewOwner)}`}</div>
        <div className="ff-stat-card__value">{fmt(netWorth(state, scopedOwner))}</div>
        <div className="ff-row-between ff-small-text"><span>Activos {fmt(totalAssets(state, scopedOwner))}</span><span>Deudas {fmt(totalDebts(state, scopedOwner))}</span></div>
        {viewOwner !== "familia" && <div className="ff-note"><Info size={14} /> No incluye el fondo de emergencia ni las inversiones familiares compartidas — esas se ven abajo por separado.</div>}
        {history.length > 1 && viewOwner === "familia" && (
          <div className="ff-chart-wrap">
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={history.map((h) => ({ name: monthShort(h.ym), Patrimonio: h.value }))}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--ff-carbon-soft)" }} axisLine={false} tickLine={false} />

                <YAxis hide />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 12, border: "1px solid var(--ff-border)", fontSize: 12 }} />
                <Line type="monotone" dataKey="Patrimonio" stroke="var(--ff-emerald)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <div className="ff-row-between"><div className="ff-card__title">{viewOwner === "familia" ? "Cuentas" : `Cuentas de ${personName(state, viewOwner)}`}</div><button className="ff-link-btn" onClick={onAddAccount}><Plus size={15} /> Agregar</button></div>
        {visibleAccounts.length === 0 ? (
          <EmptyState icon={<Wallet size={26} />} title="Todavía no hay cuentas cargadas" subtitle="Agregá la primera con el botón + Agregar." />
        ) : visibleAccounts.map((a) => (
          <div className="ff-mini-row" key={a.id}>
            <span><Icon name={a.icon} size={14} /> {a.name} <Pill tone="neutral">{personName(state, a.owner)}</Pill></span>
            <span className="ff-row-inline">
              <b>{fmt(a.balance)}</b>
              <button className="ff-icon-btn ff-icon-btn--ghost" onClick={() => onEditAccount(a)}><Pencil size={13} /></button>
              <button className="ff-icon-btn ff-icon-btn--ghost" onClick={() => onHideAccount(a.id)}><X size={13} /></button>
            </span>
          </div>
        ))}
      </Card>

      <Card>
        <div className="ff-card__title">Cuentas reservadas de la familia</div>
        <div className="ff-mini-row"><span><Shield size={14} className="ff-ic-emerald" /> Fondo de emergencia</span><b>{fmt(getAcc(state, "fondo").balance)}</b></div>
        <div className="ff-mini-row"><span><Package size={14} className="ff-ic-amber" /> Capital pendiente (pre-inversión)</span><b>{fmt(invPend.balance)}</b></div>
        <div className="ff-mini-row"><span><TrendingUp size={14} className="ff-ic-petrol" /> Capital disponible para invertir</span><b>{fmt(invDisp.balance)}</b></div>
        {started && invPend.balance > 0 && <button className="ff-btn ff-btn--secondary ff-btn--full" onClick={onActivatePending}><Rocket size={15} /> Activar capital pendiente</button>}
      </Card>

      <Card>
        <div className="ff-card__title"><TrendingUp size={15} className="ff-ic-petrol" /> Inversiones{viewOwner !== "familia" ? ` de ${personName(state, viewOwner)}` : ""}</div>
        {visibleInvestments.length === 0 ? (
          <EmptyState icon={<TrendingUp size={26} />} title="Todavía no hay inversiones registradas" subtitle="Empezá con el botón + → Invertí." />
        ) : (
          <>
            <div className="ff-row-between ff-small-text" style={{ marginBottom: 8 }}>
              <span>Aportado {fmt(invTotals.contributed)}</span>
              <span className={invTotals.gain >= 0 ? "ff-ic-emerald" : "ff-ic-red"}>{invTotals.gain >= 0 ? "+" : ""}{fmt(invTotals.gain)} ({pct1(invTotals.rentabilidad)})</span>
            </div>
            {visibleInvestments.map((inv) => {
              const g = inv.currentValue - inv.contributedTotal;
              const r = inv.contributedTotal > 0 ? g / inv.contributedTotal : 0;
              return (
                <div key={inv.id} className="ff-debt-block">
                  <div className="ff-row-between">
                    <span>{inv.name} <Pill tone="neutral">{inv.type}</Pill></span>
                    <b>{fmt(inv.currentValue)}</b>
                  </div>
                  <div className="ff-row-between ff-small-text">
                    <span>Aportado {fmt(inv.contributedTotal)} · {personName(state, inv.owner)}</span>
                    <span className={g >= 0 ? "ff-ic-emerald" : "ff-ic-red"}>{g >= 0 ? "+" : ""}{fmt(g)} ({pct1(r)})</span>
                  </div>
                  <button className="ff-link-btn" onClick={() => { const v = window.prompt(`Nuevo valor actual de "${inv.name}" (Gs.)`, inv.currentValue); if (v !== null && !isNaN(Number(v))) onUpdateInvestment(inv.id, Number(v)); }}>Actualizar valor actual</button>
                </div>
              );
            })}
          </>
        )}
      </Card>

      {flow.some((f) => f.Ingresos > 0 || f.Gastos > 0) && (
        <Card>
          <div className="ff-card__title">Ingresos vs. gastos (últimos 6 meses)</div>
          <div className="ff-chart-wrap">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={flow}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ff-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--ff-carbon-soft)" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 12, border: "1px solid var(--ff-border)", fontSize: 12 }} />
                <Bar dataKey="Ingresos" fill="var(--ff-emerald)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Gastos" fill="var(--ff-red)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {catData.length > 0 && (
        <Card>
          <div className="ff-card__title">Distribución de gastos este mes</div>
          <div className="ff-chart-wrap">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                  {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 12, border: "1px solid var(--ff-border)", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="ff-legend">
            {catData.map((c, i) => <div key={c.name} className="ff-legend__item"><span style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />{c.name}</div>)}
          </div>
        </Card>
      )}

      <Card>
        <div className="ff-card__title"><Shield size={15} className="ff-ic-emerald" /> ¿Cuándo llegamos a la meta del fondo?</div>
        {eta.months === null ? <div className="ff-card__sub">Todavía no hay suficientes aportes para estimar una fecha.</div>
          : eta.months === 0 ? <div className="ff-card__sub">¡Ya se alcanzó el objetivo!</div>
          : <div className="ff-card__sub">Con un aporte promedio de {fmt(eta.avg)}/mes, llegarían a Gs. {GS_FMT.format(state.settings.fondoTarget)} en unos <b>{eta.months} {eta.months === 1 ? "mes" : "meses"}</b>.</div>}
      </Card>

      <Card>
        <div className="ff-card__title"><Calendar size={15} /> Calendario de este mes</div>
        {fixed.items.map((f) => (
          <div className="ff-mini-row" key={f.id}>
            <span>{f.name}{f.dueDay ? ` · vence día ${f.dueDay}` : ""}{f.variable && <Pill tone="neutral">Variable</Pill>}</span>
            <span className="ff-row-inline"><b>{fmt(f.estimate)}</b>{f.paid ? <Pill tone="emerald">Pagado</Pill> : <Pill tone="amber">Estimado</Pill>}</span>
          </div>
        ))}
        {fixed.cuotas.map((d) => (
          <div className="ff-mini-row" key={d.id}><span><Car size={14} /> {d.name}</span><span className="ff-row-inline"><b>{fmt(Math.min(d.installment, d.currentBalance))}</b>{d.paidThisMonth ? <Pill tone="emerald">Pagado</Pill> : <Pill tone="amber">Pendiente</Pill>}</span></div>
        ))}
        {fixed.saldadas.length > 0 && fixed.saldadas.map((d) => (
          <div className="ff-mini-row" key={d.id}><span><CheckCircle2 size={14} className="ff-ic-emerald" /> {d.name}</span><Pill tone="emerald">Saldada — ya no cuenta como obligación</Pill></div>
        ))}
        {fixed.items.some((f) => f.variable) && <div className="ff-note"><Info size={14} /> Los gastos marcados "Variable" muestran el estimado según tu último gasto real en esa categoría, no un monto fijo.</div>}
      </Card>

      <Card>
        <div className="ff-row-between"><div className="ff-card__title">{viewOwner === "familia" ? "Deudas" : `Deudas de ${personName(state, viewOwner)}`}</div><button className="ff-link-btn" onClick={onAddDebt}><Plus size={15} /> Agregar</button></div>
        {visibleDebts.length === 0 ? <EmptyState icon={<CreditCard size={26} />} title="No hay deudas registradas" /> : visibleDebts.map((d) => {
          const pctv = d.initialBalance ? 1 - d.currentBalance / d.initialBalance : null;
          return (
            <div key={d.id} className="ff-debt-block">
              <div className="ff-row-between">
                <span><Icon name={d.icon} size={14} /> {d.name} <Pill tone="neutral">{personName(state, d.owner)}</Pill>{d.currentBalance <= 0 && <Pill tone="emerald"><CheckCircle2 size={12} /> Saldada</Pill>}</span>
                <span className="ff-row-inline">
                  <b>{fmt(d.currentBalance)}</b>
                  <button className="ff-icon-btn ff-icon-btn--ghost" onClick={() => onEditDebt(d)}><Pencil size={13} /></button>
                  <button className="ff-icon-btn ff-icon-btn--ghost" onClick={() => onDeleteDebt(d.id)}><Trash2 size={13} /></button>
                </span>
              </div>
              {pctv !== null && <><ProgressBar pct={pctv} tone={d.currentBalance <= 0 ? "emerald" : "petrol"} celebrate={d.currentBalance <= 0} /><div className="ff-small-text">{(pctv * 100).toFixed(1)}% pagado{d.installment ? ` · cuota ${fmt(d.installment)}` : ""}</div></>}
            </div>
          );
        })}
      </Card>

      <Card>
        <div className="ff-card__title">Ingreso mínimo sin déficit</div>
        <div className="ff-card__sub">Las obligaciones fijas familiares suman {fmt(fixedObligationsTotal(state))}/mes.</div>
        <div className="ff-stat-card__value">{fmt(minIncome)}</div>
      </Card>

      <button className="ff-btn ff-btn--outline ff-btn--full" onClick={onOpenSetup}><RefreshCw size={15} /> Cargar otra situación financiera</button>
    </div>
  );
}

/* ============================================================
   TAB: MÁS
   ============================================================ */

function MasTab({ state, activeUser, onUpdateSettings, onUpdatePins, onLogout, onReset, onUpdatePeople, onResetFinancialData, onOpenSetup }) {
  const [rates, setRates] = useState({ ...state.settings.rates });
  const [fondoTarget, setFondoTarget] = useState(state.settings.fondoTarget);
  const [invDate, setInvDate] = useState(state.settings.investmentStartDate);
  const [fixed, setFixed] = useState(state.settings.fixedExpenses);
  const [theme, setTheme] = useState(state.settings.theme);
  const [people, setPeople] = useState(state.people.map((p) => ({ ...p })));
  const [pinOld, setPinOld] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinMsg, setPinMsg] = useState("");

  const ratesSum = rates.emergencia + rates.inversion + rates.ocio + rates.necesidades;
  const ratesValid = Math.abs(ratesSum - 1) < 0.001;

  const save = () => {
    const cleanFixed = fixed.filter((f) => f.name.trim()).map((f) => ({ ...f, amount: Number(f.amount) || 0, dueDay: f.dueDay ? Number(f.dueDay) : null }));
    onUpdateSettings({ rates: ratesValid ? rates : state.settings.rates, fondoTarget: Number(fondoTarget), investmentStartDate: invDate, fixedExpenses: cleanFixed, theme });
    onUpdatePeople(people);
  };

  return (
    <div className="ff-tab">
      <div className="ff-tab-header"><h2>Más</h2><p>Configuración del sistema financiero familiar</p></div>

      <Card>
        <div className="ff-card__title"><Shield size={15} className="ff-ic-emerald" /> Seguridad — {personName(state, activeUser)}</div>
        <p className="ff-card__sub">Cambiá tu PIN de 4 dígitos. Solo vos podés cambiar el tuyo mientras estés adentro con tu sesión.</p>
        <Field label="PIN actual"><input type="password" inputMode="numeric" maxLength={4} value={pinOld} onChange={(e) => setPinOld(e.target.value.replace(/\D/g, ""))} /></Field>
        <Field label="PIN nuevo (4 dígitos)"><input type="password" inputMode="numeric" maxLength={4} value={pinNew} onChange={(e) => setPinNew(e.target.value.replace(/\D/g, ""))} /></Field>
        {pinMsg && <div className={`ff-note ${pinMsg.startsWith("✓") ? "ff-note--emerald" : "ff-note--amber"}`}>{pinMsg}</div>}
        <button
          className="ff-btn ff-btn--secondary ff-btn--full"
          disabled={pinOld.length !== 4 || pinNew.length !== 4}
          onClick={() => {
            if (state.settings.pins[activeUser] !== pinOld) { setPinMsg("El PIN actual no coincide."); return; }
            onUpdatePins({ ...state.settings.pins, [activeUser]: pinNew });
            setPinMsg("✓ PIN actualizado."); setPinOld(""); setPinNew("");
          }}
        >
          Cambiar mi PIN
        </button>
        <button className="ff-btn ff-btn--outline ff-btn--full" onClick={onLogout}><User size={15} /> Cerrar sesión</button>
      </Card>

      <Card>
        <div className="ff-card__title"><Users size={15} /> Personas</div>
        {people.map((p, i) => (
          <div className="ff-mini-row" key={p.id}>
            <input type="text" className="ff-inline-input" style={{ width: "100%", textAlign: "left" }} value={p.name} onChange={(e) => setPeople((prev) => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} />
          </div>
        ))}
      </Card>

      <Card>
        <div className="ff-card__title"><SettingsIcon size={15} /> Reglas de distribución (regla, no automatismo rígido)</div>
        <p className="ff-card__sub">Se aplican sobre el ingreso familiar combinado. Deben sumar 100%.</p>
        {[["emergencia", "Fondo de emergencia"], ["inversion", "Inversión"], ["ocio", "Ocio"], ["necesidades", "Necesidades"]].map(([k, l]) => (
          <div className="ff-mini-row" key={k}>
            <span>{l}</span>
            <input type="number" className="ff-inline-input" value={Math.round(rates[k] * 100)} onChange={(e) => setRates((prev) => ({ ...prev, [k]: (Number(e.target.value) || 0) / 100 }))} />
          </div>
        ))}
        <div className={`ff-note ${ratesValid ? "ff-note--emerald" : "ff-note--amber"}`}>{ratesValid ? "Suma 100% ✓" : `Suma ${Math.round(ratesSum * 100)}% — tiene que sumar 100% para guardarse.`}</div>
        <Field label="Meta del fondo de emergencia (Gs.)"><input type="number" value={fondoTarget} onChange={(e) => setFondoTarget(e.target.value)} /></Field>
        <Field label="Fecha de inicio de inversiones"><input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} /></Field>
        <div className="ff-card__title" style={{ marginTop: 12 }}>Gastos fijos mensuales</div>
        <p className="ff-card__sub">Podés modificarlos cuando quieras: cambiar el monto, el nombre, el día de vencimiento, agregar uno nuevo o quitarlo. Marcá "Variable" para los que cambian mes a mes (como electricidad) — así el sistema toma tu último gasto real como estimado en vez de pedirte actualizarlo a mano.</p>
        {fixed.map((f, i) => (
          <div key={f.id} className="ff-setup-block">
            <input type="text" placeholder="Nombre" value={f.name} onChange={(e) => setFixed((prev) => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} />
            <div className="ff-setup-row">
              <input type="number" placeholder="Monto (Gs.)" value={f.amount} onChange={(e) => setFixed((prev) => prev.map((x, idx) => idx === i ? { ...x, amount: Number(e.target.value) || 0 } : x))} className="ff-setup-amount" />
              <input type="number" placeholder="Día venc." min="1" max="31" value={f.dueDay || ""} onChange={(e) => setFixed((prev) => prev.map((x, idx) => idx === i ? { ...x, dueDay: e.target.value ? Number(e.target.value) : null } : x))} style={{ maxWidth: 90 }} />
              <button className="ff-icon-btn ff-icon-btn--ghost" onClick={() => setFixed((prev) => prev.filter((_, idx) => idx !== i))}><Trash2 size={14} /></button>
            </div>
            <label className="ff-checkbox-row" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={!!f.variable} onChange={(e) => setFixed((prev) => prev.map((x, idx) => idx === i ? { ...x, variable: e.target.checked } : x))} />
              Es variable (el monto de arriba es solo el estimado inicial)
            </label>
          </div>
        ))}
        <button className="ff-btn ff-btn--outline ff-btn--full" onClick={() => setFixed((prev) => [...prev, { id: uid(), name: "", owner: "familia", amount: 0, dueDay: null, variable: false }])}><Plus size={15} /> Agregar gasto fijo</button>
      </Card>

      <Card>
        <div className="ff-card__title">Apariencia</div>
        <div className="ff-segmented">
          <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}><Sun size={14} /> Claro</button>
          <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}><Moon size={14} /> Oscuro</button>
          <button className={theme === "auto" ? "active" : ""} onClick={() => setTheme("auto")}><Monitor size={14} /> Auto</button>
        </div>
      </Card>

      <button className="ff-btn ff-btn--primary ff-btn--full" onClick={save}>Guardar cambios</button>

      <Card>
        <div className="ff-card__title"><Info size={15} /> Regla vs. recomendación</div>
        <p className="ff-card__sub">
          Los porcentajes de arriba son tu <b>regla</b>: lo que ustedes decidieron. El fondo de emergencia y las inversiones
          se calculan siempre sobre el ingreso familiar combinado, sin importar quién lo generó. Cuando el fondo llega a su
          meta, el sistema redirige automáticamente ese porcentaje hacia inversión — eso lo decidieron ustedes también, y
          podés desactivarlo cambiando las reglas manualmente en cualquier momento. El resto de los mensajes que ven en
          Inicio (gastos que suben, dinero libre, cuánto podrían invertir) son <b>recomendaciones</b>: el sistema las sugiere,
          pero ninguna mueve dinero sola.
        </p>
      </Card>

      <Card>
        <div className="ff-card__title"><Calendar size={15} className="ff-ic-petrol" /> Configuración financiera inicial</div>
        {state.meta?.initialSetupDate ? (
          <p className="ff-card__sub">El historial financiero real de la familia empieza el <b>{humanDate(state.meta.initialSetupDate)}</b>.</p>
        ) : (
          <p className="ff-card__sub">Todavía no cargaron una configuración financiera inicial con fecha de corte.</p>
        )}
        <button className="ff-btn ff-btn--secondary ff-btn--full" onClick={onOpenSetup}><RefreshCw size={15} /> {state.meta?.initialSetupDate ? "Volver a cargar la situación inicial" : "Cargar situación financiera inicial"}</button>
      </Card>

      <Card className="ff-card--outline">
        <div className="ff-card__title"><AlertTriangle size={15} className="ff-ic-red" /> Restablecer datos financieros</div>
        <p className="ff-card__sub">
          Pone en cero todas las cuentas, ingresos, gastos, deudas, ahorros, inversiones, patrimonio y objetivos —
          sin tocar la app, las personas, el diseño ni la configuración. Después vas a poder cargar la situación real
          desde cero con una fecha de corte.
        </p>
        <button className="ff-btn ff-btn--danger ff-btn--full" onClick={onResetFinancialData}><Trash2 size={15} /> Restablecer datos financieros</button>
      </Card>

      <Card className="ff-card--outline">
        <div className="ff-card__title"><Info size={15} /> Volver a los datos de ejemplo</div>
        <p className="ff-card__sub">Solo para pruebas: vuelve a la fotografía de demostración original (Richard, agosto 2026) y borra el perfil de Raquel.</p>
        <button className="ff-btn ff-btn--outline ff-btn--full" onClick={onReset}>Restaurar datos de ejemplo</button>
      </Card>
    </div>
  );
}

/* ============================================================
   TAB: AGENDA
   ============================================================ */

function daysSince(dateStr) {
  return Math.floor((new Date(today()) - new Date(dateStr)) / 86400000);
}

function TaskRow({ t, onToggle, onDelete }) {
  const cat = TASK_CATEGORIES.find((c) => c.id === t.category) || TASK_CATEGORIES[3];
  const CatIcon = cat.icon;
  const overdue = t.dueDate && t.dueDate < today() && !t.done;
  const isToday = t.dueDate === today();
  return (
    <div className={`ff-task-row ${t.done ? "ff-task-row--done" : ""}`}>
      <button className="ff-task-check" onClick={() => onToggle(t.id)}>
        {t.done ? <CheckCircle size={22} className="ff-ic-emerald" /> : <Circle size={22} />}
      </button>
      <div className="ff-task-mid">
        <div className="ff-task-title">{t.title}</div>
        <div className="ff-task-meta">
          <span className={`ff-task-cat ff-task-cat--${cat.tone}`}><CatIcon size={11} /> {cat.name}</span>
          {t.dueDate && !t.done && (
            <span className={overdue ? "ff-task-due ff-task-due--overdue" : isToday ? "ff-task-due ff-task-due--today" : "ff-task-due"}>
              {overdue ? `Atrasada · hace ${daysSince(t.dueDate)} ${daysSince(t.dueDate) === 1 ? "día" : "días"}` : isToday ? "Hoy" : humanDate(t.dueDate)}
            </span>
          )}
        </div>
      </div>
      <button className="ff-icon-btn ff-icon-btn--ghost" onClick={() => onDelete(t.id)}><Trash2 size={14} /></button>
    </div>
  );
}

function AgendaTab({ state, activeUser, onAdd, onToggle, onDelete }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("personal");
  const [dueDate, setDueDate] = useState("");
  const [showDate, setShowDate] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const mine = state.tasks.filter((t) => t.owner === activeUser);
  const pending = mine.filter((t) => !t.done);
  const done = mine.filter((t) => t.done).sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
  const todayStr = today();
  const overdue = pending.filter((t) => t.dueDate && t.dueDate < todayStr).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const dueToday = pending.filter((t) => t.dueDate === todayStr);
  const upcoming = pending.filter((t) => t.dueDate && t.dueDate > todayStr).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const noDate = pending.filter((t) => !t.dueDate);

  function submit() {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), category, dueDate: dueDate || null, owner: activeUser });
    setTitle(""); setDueDate(""); setShowDate(false);
  }

  return (
    <div className="ff-tab">
      <div className="ff-tab-header"><h2>Agenda</h2><p>¿Qué tengo que hacer, {personName(state, activeUser)}?</p></div>

      <Card className="ff-agenda-add">
        <div className="ff-agenda-add__row">
          <input type="text" placeholder="¿Qué tenés que hacer?" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          <button className="ff-agenda-add__btn" disabled={!title.trim()} onClick={submit}><Plus size={18} /></button>
        </div>
        <div className="ff-agenda-add__opts">
          {TASK_CATEGORIES.map((c) => {
            const CIcon = c.icon;
            return (
              <button key={c.id} className={`ff-cat-chip ff-cat-chip--${c.tone} ${category === c.id ? "active" : ""}`} onClick={() => setCategory(c.id)}>
                <CIcon size={13} /> {c.name}
              </button>
            );
          })}
          <button className={`ff-cat-chip ${showDate ? "active" : ""}`} onClick={() => setShowDate((v) => !v)}><Calendar size={13} /> Fecha</button>
        </div>
        {showDate && <input type="date" className="ff-agenda-add__date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}
      </Card>

      {mine.length === 0 && (
        <EmptyState icon={<ListChecks size={28} />} title="Tu agenda está vacía" subtitle="Escribí lo primero que tengas que hacer arriba — comprar algo, un pendiente del trabajo, lo que sea." />
      )}

      {overdue.length > 0 && (
        <div className="ff-agenda-group">
          <div className="ff-agenda-group__title ff-agenda-group__title--red"><AlertTriangle size={14} /> Atrasadas ({overdue.length})</div>
          {overdue.map((t) => <TaskRow key={t.id} t={t} onToggle={onToggle} onDelete={onDelete} />)}
        </div>
      )}
      {dueToday.length > 0 && (
        <div className="ff-agenda-group">
          <div className="ff-agenda-group__title ff-agenda-group__title--amber">Hoy ({dueToday.length})</div>
          {dueToday.map((t) => <TaskRow key={t.id} t={t} onToggle={onToggle} onDelete={onDelete} />)}
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="ff-agenda-group">
          <div className="ff-agenda-group__title">Próximas</div>
          {upcoming.map((t) => <TaskRow key={t.id} t={t} onToggle={onToggle} onDelete={onDelete} />)}
        </div>
      )}
      {noDate.length > 0 && (
        <div className="ff-agenda-group">
          <div className="ff-agenda-group__title">Sin fecha</div>
          {noDate.map((t) => <TaskRow key={t.id} t={t} onToggle={onToggle} onDelete={onDelete} />)}
        </div>
      )}
      {done.length > 0 && (
        <div className="ff-agenda-group">
          <button className="ff-link-btn" onClick={() => setShowDone((v) => !v)}>{showDone ? "Ocultar completadas" : `Ver completadas (${done.length})`}</button>
          {showDone && done.map((t) => <TaskRow key={t.id} t={t} onToggle={onToggle} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   NAVEGACIÓN
   ============================================================ */

const TABS = [
  { id: "inicio", label: "Inicio", icon: LayoutDashboard },
  { id: "movimientos", label: "Movs.", icon: ArrowLeftRight },
  { id: "agenda", label: "Agenda", icon: ListChecks },
  { id: "objetivos", label: "Objetivos", icon: Target },
  { id: "patrimonio", label: "Patrimonio", icon: PieChartIcon },
  { id: "mas", label: "Más", icon: SettingsIcon },
];

const TASK_CATEGORIES = [
  { id: "compras", name: "Compras", icon: ShoppingCart, tone: "amber" },
  { id: "trabajo", name: "Trabajo", icon: Briefcase, tone: "petrol" },
  { id: "facultad", name: "Facultad", icon: GraduationCap, tone: "emerald" },
  { id: "personal", name: "Personal", icon: Sparkles, tone: "red" },
];

const FAB_ACTIONS = [
  { id: "ingreso", label: "Recibí dinero", icon: ArrowDownCircle, tone: "ff-ic-emerald" },
  { id: "gasto", label: "Gasté dinero", icon: ArrowUpCircle, tone: "ff-ic-red" },
  { id: "transferencia", label: "Transferí dinero", icon: Repeat, tone: "ff-ic-petrol" },
  { id: "ahorro", label: "Ahorré", icon: PiggyBank, tone: "ff-ic-amber" },
  { id: "inversion", label: "Invertí", icon: TrendingUp, tone: "ff-ic-petrol" },
  { id: "pago", label: "Pagué deuda", icon: CreditCard, tone: "ff-ic-red" },
  { id: "retiro", label: "Retiré dinero", icon: ArrowDownToLine, tone: "ff-ic-amber" },
  { id: "otro", label: "Otro", icon: HelpCircle, tone: "ff-ic-carbon" },
];

/* ============================================================
   APP PRINCIPAL
   ============================================================ */

export default function App() {
  const [state, setState] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("inicio");
  const [activeUser, setActiveUserState] = useState(DEFAULT_STATE.settings.lastActiveUser);
  const [unlockedPerson, setUnlockedPerson] = useState(() => localStorage.getItem("ff-unlocked-person"));
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [switchRequest, setSwitchRequest] = useState(null); // personId pedido desde el TopBar, o null
  const [viewMode, setViewMode] = useState("familia");
  const [fabOpen, setFabOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [editingMovement, setEditingMovement] = useState(null);
  const [editingAccount, setEditingAccount] = useState(null);
  const [editingDebt, setEditingDebt] = useState(null);
  const prevFundComplete = useRef(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY);
        const loadedState = reconcileState(res && res.value ? JSON.parse(res.value) : DEFAULT_STATE);
        if (mounted) {
          setState(loadedState);
          if (loadedState.settings?.lastActiveUser) setActiveUserState(loadedState.settings.lastActiveUser);
        }
      } catch (e) { if (mounted) setState(DEFAULT_STATE); }
      if (mounted) setLoaded(true);
    })();
    return () => { mounted = false; };
  }, []);

  // Sincronización en vivo entre celulares: si Raquel guarda algo desde el suyo,
  // acá se actualiza solo, sin recargar la página.
  const isRemoteUpdateRef = useRef(false);
  useEffect(() => {
    if (!loaded) return;
    const unsubscribe = subscribeToRemoteChanges(STORAGE_KEY, (remoteState) => {
      isRemoteUpdateRef.current = true; // evita que este cambio dispare un guardado de vuelta (eco innecesario)
      setState(reconcileState(remoteState));
    });
    return unsubscribe;
  }, [loaded]);

  const pendingSaveRef = useRef(null); // { timeoutId, flush } — guardado pendiente que todavía no se disparó

  useEffect(() => {
    if (!loaded || !state) return;
    if (isRemoteUpdateRef.current) {
      // Este cambio de estado vino de la sincronización en vivo (otro dispositivo ya lo guardó),
      // no hace falta volver a guardarlo — ahorra escrituras y reduce el riesgo de choques.
      isRemoteUpdateRef.current = false;
      return;
    }
    setSaveStatus("saving");
    const flush = () => {
      window.storage.set(STORAGE_KEY, JSON.stringify(state))
        .then((res) => setSaveStatus(res ? "saved" : "error"))
        .catch(() => setSaveStatus("error"));
      pendingSaveRef.current = null;
    };
    const t = setTimeout(flush, 350);
    pendingSaveRef.current = { timeoutId: t, flush };
    return () => {
      clearTimeout(t);
      if (pendingSaveRef.current && pendingSaveRef.current.timeoutId === t) pendingSaveRef.current = null;
    };
  }, [state, loaded]);

  // En celular, "beforeunload" casi nunca se dispara cuando cambiás de app, apagás
  // la pantalla o el navegador manda la pestaña a segundo plano — es un aviso pensado
  // para computadora. Acá usamos "visibilitychange" y "pagehide", que sí son confiables
  // en celular: apenas la app deja de estar visible, disparamos el guardado pendiente
  // de inmediato (sin esperar los 350ms de espera normal), para no perder el cambio.
  useEffect(() => {
    function flushPendingSave() {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current.timeoutId);
        pendingSaveRef.current.flush();
      }
    }
    function handleVisibility() {
      if (document.visibilityState === "hidden") flushPendingSave();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", flushPendingSave);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", flushPendingSave);
    };
  }, []);

  // En computadora sí funciona bien "beforeunload" — lo dejamos como capa extra de
  // aviso ahí, aunque el mecanismo de arriba ya debería haber guardado antes de esto.
  useEffect(() => {
    function handler(e) {
      if (saveStatus === "saving") { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);

  useEffect(() => {
    if (saveStatus !== "saved") return;
    const t = setTimeout(() => setSaveStatus("idle"), 2500);
    return () => clearTimeout(t);
  }, [saveStatus]);

  useEffect(() => {
    if (!state) return;
    const c = fundComplete(state);
    if (c && !prevFundComplete.current) showToast("🎉 ¡Fondo de emergencia familiar completado!");
    prevFundComplete.current = c;
  }, [state]);

  // snapshot de patrimonio del mes en curso
  useEffect(() => {
    if (!loaded || !state) return;
    const hist = computeSnapshot(state);
    if (JSON.stringify(hist) !== JSON.stringify(state.patrimonioHistory)) {
      setState((prev) => ({ ...prev, patrimonioHistory: hist }));
    }
  }, [loaded, state?.accounts, state?.debts, state?.investments]); // eslint-disable-line

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3800); }

  if (!loaded || !state) return <div className="ff-root"><StyleSheet theme="light" /><div className="ff-loading">Cargando el sistema financiero familiar…</div></div>;

  const resolvedTheme = state.settings.theme === "auto" ? (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : state.settings.theme;
  const effectiveOwner = viewMode === "familia" ? "familia" : activeUser;
  function setActiveUser(id) {
    setActiveUserState(id);
    setState((prev) => ({ ...prev, settings: { ...prev.settings, lastActiveUser: id } }));
  }

  /* ---- Handlers ---- */

  function addIngreso({ amount, owner, incomeType, tipo, accountId, date, description }) {
    setState((prev) => {
      const accounts = prev.accounts.map((a) => (a.id === accountId ? { ...a, balance: a.balance + amount } : a));
      let allocation = null, distributed = false;
      if (incomeType === "familiar") {
        const rates = getRates(prev, date);
        allocation = allocate(amount, rates);
      } else {
        distributed = null; // los ingresos personales nunca "se distribuyen" a fondo/inversión
      }
      const movement = { id: uid(), type: "ingreso", owner, incomeType, subtype: tipo, amount, accountId, date, description, allocation, distributed, status: "activo" };
      return { ...prev, accounts, movements: [movement, ...prev.movements] };
    });
    setModal(null);
    showToast(`Ingreso de ${fmt(amount)} registrado${incomeType === "personal" ? " (personal)" : " (aporte familiar)"}.`);
  }

  function distribute(movementIds, category = "all") {
    const ids = Array.isArray(movementIds) ? movementIds : [movementIds];
    setState((prev) => {
      let accounts = prev.accounts.map((a) => ({ ...a }));
      let movements = [...prev.movements];
      const extra = [];
      ids.forEach((movementId) => {
        const mv = movements.find((m) => m.id === movementId);
        if (!mv || !mv.allocation) return;
        const ds = distStatus(mv);
        const doEmergencia = (category === "all" || category === "emergencia") && !ds.emergencia && mv.allocation.emergencia > 0;
        const doInversion = (category === "all" || category === "inversion") && !ds.inversion && mv.allocation.inversion > 0;
        if (!doEmergencia && !doInversion) return;
        const rates = getRates(prev, mv.date);
        const src = accounts.find((a) => a.id === mv.accountId);
        if (doEmergencia) {
          const emergAmt = mv.allocation.emergencia;
          src.balance -= emergAmt;
          accounts.find((a) => a.id === "fondo").balance += emergAmt;
          extra.push({ id: uid(), type: "aporte", destino: "fondo", amount: emergAmt, date: mv.date, status: "activo", ref: movementId });
        }
        if (doInversion) {
          const invAmt = mv.allocation.inversion;
          const invTargetId = rates.invStarted ? "inv-disponible" : "inv-pendiente";
          src.balance -= invAmt;
          accounts.find((a) => a.id === invTargetId).balance += invAmt;
          extra.push({ id: uid(), type: "aporte", destino: invTargetId, amount: invAmt, date: mv.date, status: "activo", ref: movementId });
        }
        const newParts = { emergencia: ds.emergencia || doEmergencia, inversion: ds.inversion || doInversion };
        movements = movements.map((m) => (m.id === movementId ? { ...m, distributedParts: newParts, distributed: newParts.emergencia && newParts.inversion } : m));
      });
      return { ...prev, accounts, movements: [...extra, ...movements] };
    });
    showToast(ids.length > 1 ? `${ids.length} ingresos distribuidos.` : "Ingreso distribuido.");
  }

  function addGasto({ amount, owner, paidBy, accountId, classification, category, date, description }) {
    setState((prev) => {
      let accounts = prev.accounts, debts = prev.debts;
      const fixedRef = prev.settings.fixedExpenses.find((f) => f.name === category)?.id || null;
      const tarjetaMatch = prev.debts.find((d) => d.id === accountId && d.kind === "tarjeta");
      if (tarjetaMatch) debts = prev.debts.map((d) => (d.id === accountId ? { ...d, currentBalance: d.currentBalance + amount, consumptions: [...d.consumptions, { date, amount, category }] } : d));
      else accounts = prev.accounts.map((a) => (a.id === accountId ? { ...a, balance: a.balance - amount } : a));
      const movement = { id: uid(), type: "gasto", owner, paidBy: owner === "familia" ? paidBy : owner, amount, accountId, classification, category, fixedRef, date, description, status: "activo" };
      return { ...prev, accounts, debts, movements: [movement, ...prev.movements] };
    });
    setModal(null); setEditingMovement(null);
    showToast(`Gasto de ${fmt(amount)} registrado.`);
  }

  function addTransfer({ fromId, toId, amount, date, description }) {
    setState((prev) => {
      const accounts = prev.accounts.map((a) => {
        if (a.id === fromId) return { ...a, balance: a.balance - amount };
        if (a.id === toId) return { ...a, balance: a.balance + amount };
        return a;
      });
      const fromAcc = getAcc(prev, fromId);
      const movement = { id: uid(), type: "transferencia", owner: fromAcc.owner, amount, fromId, toId, date, description, status: "activo" };
      return { ...prev, accounts, movements: [movement, ...prev.movements] };
    });
    setModal(null);
    showToast("Transferencia registrada.");
  }

  function addPagoDeuda({ debtId, amount, accountId, date }) {
    setState((prev) => {
      const accounts = prev.accounts.map((a) => (a.id === accountId ? { ...a, balance: a.balance - amount } : a));
      const debts = prev.debts.map((d) => {
        if (d.id !== debtId) return d;
        const updated = { ...d, currentBalance: Math.max(0, d.currentBalance - amount), payments: [...d.payments, { date, amount }] };
        if (d.kind === "cuota") updated.lastPaidPeriod = ym(date);
        return updated;
      });
      const debt = prev.debts.find((d) => d.id === debtId);
      const movement = { id: uid(), type: "pago_deuda", owner: debt.owner, amount, debtId, accountId, date, status: "activo" };
      return { ...prev, accounts, debts, movements: [movement, ...prev.movements] };
    });
    setModal(null); setEditingMovement(null);
    showToast("Pago de deuda registrado.");
  }

  function addInversion({ mode, investmentId, name, type, owner, amount, sourceId, date, notes }) {
    setState((prev) => {
      const accounts = prev.accounts.map((a) => (a.id === sourceId ? { ...a, balance: a.balance - amount } : a));
      let investments = [...prev.investments];
      let targetId = investmentId;
      if (mode === "new" || investments.length === 0) {
        const newInv = { id: uid(), name, type, owner, contributedTotal: amount, currentValue: amount, entries: [{ date, amount, notes }] };
        investments.push(newInv);
        targetId = newInv.id;
      } else {
        investments = investments.map((i) => i.id === investmentId ? { ...i, contributedTotal: i.contributedTotal + amount, currentValue: i.currentValue + amount, entries: [...i.entries, { date, amount, notes }] } : i);
      }
      const movement = { id: uid(), type: "inversion", owner, amount, sourceId, investmentId: targetId, date, description: notes, status: "activo" };
      return { ...prev, accounts, investments, movements: [movement, ...prev.movements] };
    });
    setModal(null);
    showToast(`Inversión de ${fmt(amount)} registrada.`);
  }

  function updateInvestmentValue(investmentId, newValue) {
    setState((prev) => ({ ...prev, investments: prev.investments.map((i) => i.id === investmentId ? { ...i, currentValue: newValue } : i) }));
    showToast("Valor actualizado.");
  }

  function addOtro({ owner, amount, description, date }) {
    setState((prev) => ({ ...prev, movements: [{ id: uid(), type: "otro", owner, amount, description, date, status: "activo" }, ...prev.movements] }));
    setModal(null);
    showToast("Movimiento registrado.");
  }

  function voidMovement(id) {
    setState((prev) => {
      const mv = prev.movements.find((m) => m.id === id);
      if (!mv || mv.status === "anulado") return prev;
      let accounts = prev.accounts.map((a) => ({ ...a }));
      let debts = prev.debts.map((d) => ({ ...d }));
      let investments = prev.investments.map((i) => ({ ...i }));
      if (mv.type === "ingreso") {
        const acc = accounts.find((a) => a.id === mv.accountId);
        acc.balance -= mv.amount;
        if (mv.allocation) {
          // Solo se revierte lo que efectivamente se distribuyó (puede ser parcial:
          // por ejemplo, fondo sí y inversión todavía no).
          const ds = distStatus(mv);
          if (ds.emergencia) {
            acc.balance += mv.allocation.emergencia;
            accounts.find((a) => a.id === "fondo").balance -= mv.allocation.emergencia;
          }
          if (ds.inversion) {
            acc.balance += mv.allocation.inversion;
            const invTargetId = investmentsStarted(prev, mv.date) ? "inv-disponible" : "inv-pendiente";
            accounts.find((a) => a.id === invTargetId).balance -= mv.allocation.inversion;
          }
        }
      } else if (mv.type === "gasto") {
        const tarjetaMatch = debts.find((d) => d.id === mv.accountId && d.kind === "tarjeta");
        if (tarjetaMatch) tarjetaMatch.currentBalance -= mv.amount;
        else accounts.find((a) => a.id === mv.accountId).balance += mv.amount;
      } else if (mv.type === "transferencia") {
        accounts.find((a) => a.id === mv.fromId).balance += mv.amount;
        accounts.find((a) => a.id === mv.toId).balance -= mv.amount;
      } else if (mv.type === "pago_deuda") {
        accounts.find((a) => a.id === mv.accountId).balance += mv.amount;
        debts.find((d) => d.id === mv.debtId).currentBalance += mv.amount;
      } else if (mv.type === "inversion") {
        accounts.find((a) => a.id === mv.sourceId).balance += mv.amount;
        const inv = investments.find((i) => i.id === mv.investmentId);
        if (inv) { inv.contributedTotal -= mv.amount; inv.currentValue -= mv.amount; }
      }
      const movements = prev.movements.map((m) => (m.id === id ? { ...m, status: "anulado" } : m));
      return { ...prev, accounts, debts, investments, movements };
    });
    showToast("Movimiento anulado.");
  }

  function editMovement(mv) {
    setEditingMovement(mv);
    setModal(mv.type === "gasto" ? "gasto" : mv.type === "pago_deuda" ? "pago" : mv.type === "ingreso" ? "ingreso" : null);
  }
  function submitEdit(type, payload) {
    if (editingMovement) voidMovement(editingMovement.id);
    if (type === "gasto") addGasto(payload);
    else if (type === "pago") addPagoDeuda(payload);
    else if (type === "ingreso") addIngreso(payload);
    setEditingMovement(null);
  }

  function activatePending() {
    setState((prev) => {
      const invPend = prev.accounts.find((a) => a.id === "inv-pendiente");
      if (invPend.balance <= 0) return prev;
      const amount = invPend.balance;
      const accounts = prev.accounts.map((a) => {
        if (a.id === "inv-pendiente") return { ...a, balance: 0 };
        if (a.id === "inv-disponible") return { ...a, balance: a.balance + amount };
        return a;
      });
      const movement = { id: uid(), type: "aporte", destino: "inv-disponible", amount, date: today(), status: "activo", description: "Activación de capital pendiente" };
      return { ...prev, accounts, movements: [movement, ...prev.movements] };
    });
    showToast("Capital pendiente activado.");
  }

  function updateSettings(patch) { setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } })); showToast("Configuración guardada."); }
  function updatePeople(people) { setState((prev) => ({ ...prev, people })); }
  function addTask({ title, category, dueDate, owner }) {
    setState((prev) => ({ ...prev, tasks: [{ id: uid(), title, category, dueDate, owner, done: false, createdAt: today() }, ...prev.tasks] }));
  }
  function toggleTask(id) {
    setState((prev) => ({ ...prev, tasks: prev.tasks.map((t) => (t.id === id ? { ...t, done: !t.done, completedAt: !t.done ? today() : null } : t)) }));
  }
  function deleteTask(id) {
    setState((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));
  }

  function addGoal({ goalType, name, target, targetDate, owner }) {
    setState((prev) => {
      if (goalType === "patrimonio") {
        const goal = { id: uid(), name, type: "patrimonio", target, targetDate, owner, custom: true };
        return { ...prev, goals: [...prev.goals, goal] };
      }
      const accId = uid();
      const account = { id: accId, name, icon: "piggy", kind: "ahorro", owner, balance: 0, active: true };
      const goal = { id: uid(), name, type: "ahorro", ref: accId, target, owner, custom: true };
      return { ...prev, accounts: [...prev.accounts, account], goals: [...prev.goals, goal] };
    });
    showToast(goalType === "patrimonio" ? "Objetivo de patrimonio creado." : "Objetivo de ahorro creado.");
  }

  function editGoal(goal, { name, target, targetDate, owner }) {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => (g.id === goal.id ? { ...g, name, target, targetDate: targetDate ?? g.targetDate, owner } : g)),
      accounts: goal.type === "ahorro" ? prev.accounts.map((a) => (a.id === goal.ref ? { ...a, name, owner } : a)) : prev.accounts,
    }));
    showToast("Objetivo actualizado.");
  }

  function deleteGoal(goal) {
    const extra = goal.type === "ahorro" ? " La cuenta de ahorro asociada NO se borra, solo el objetivo — la seguís viendo en Patrimonio." : "";
    if (!window.confirm(`¿Eliminar el objetivo "${goal.name}"?${extra}`)) return;
    setState((prev) => ({ ...prev, goals: prev.goals.filter((g) => g.id !== goal.id) }));
    showToast("Objetivo eliminado.");
  }

  function addAccount({ name, owner, kind, balance, icon }) {
    setState((prev) => ({ ...prev, accounts: [...prev.accounts, { id: uid(), name, owner, kind, balance, icon, active: true }] }));
    setModal(null);
    showToast("Cuenta creada.");
  }
  function editAccount(acc, { name, owner, kind, balance, icon }) {
    setState((prev) => {
      const old = prev.accounts.find((a) => a.id === acc.id);
      const diff = balance - old.balance;
      let movements = prev.movements;
      if (diff !== 0) movements = [{ id: uid(), type: "ajuste", owner, amount: diff, accountId: acc.id, date: today(), description: "Corrección manual de saldo", status: "activo" }, ...movements];
      const accounts = prev.accounts.map((a) => (a.id === acc.id ? { ...a, name, owner, kind, balance, icon } : a));
      return { ...prev, accounts, movements };
    });
    setModal(null); setEditingAccount(null);
    showToast("Cuenta actualizada.");
  }
  function hideAccount(id) {
    if (!window.confirm("¿Ocultar esta cuenta? Podés reactivarla luego editándola.")) return;
    setState((prev) => ({ ...prev, accounts: prev.accounts.map((a) => (a.id === id ? { ...a, active: false } : a)) }));
    showToast("Cuenta ocultada.");
  }

  function addDebt({ name, owner, kind, currentBalance, installment, dueDay }) {
    setState((prev) => ({ ...prev, debts: [...prev.debts, { id: uid(), name, owner, kind, icon: kind === "cuota" ? "car" : "card", currentBalance, initialBalance: currentBalance, installment, dueDay, lastPaidPeriod: null, payments: [], consumptions: [] }] }));
    setModal(null);
    showToast("Deuda creada.");
  }
  function editDebt(debt, { name, owner, kind, currentBalance, installment, dueDay }) {
    setState((prev) => ({ ...prev, debts: prev.debts.map((d) => (d.id === debt.id ? { ...d, name, owner, kind, currentBalance, installment, dueDay } : d)) }));
    setModal(null); setEditingDebt(null);
    showToast("Deuda actualizada.");
  }
  function deleteDebt(id) {
    if (!window.confirm("¿Eliminar esta deuda? Esta acción no se puede deshacer.")) return;
    setState((prev) => ({ ...prev, debts: prev.debts.filter((d) => d.id !== id) }));
    showToast("Deuda eliminada.");
  }

  function applySimulation(changes) {
    if (changes.extraIncome > 0) addIngreso({ amount: changes.extraIncome, owner: "richard", tipo: "Extra", accountId: changes.incomeAccountId || "ueno", date: today(), description: "Aplicado desde el simulador" });
    if (changes.investAmount > 0) addInversion({ mode: state.investments.length ? "existing" : "new", investmentId: state.investments[0]?.id, name: "Inversión simulada", type: "Otro", owner: "familia", amount: changes.investAmount, sourceId: "inv-disponible", date: today(), notes: "Aplicado desde el simulador" });
    if (changes.payDebtId && changes.payDebtAmount > 0) addPagoDeuda({ debtId: changes.payDebtId, amount: changes.payDebtAmount, accountId: activeAccounts(state).find((a) => a.kind === "liquido")?.id, date: today() });
    setModal(null);
    showToast("Simulación aplicada como movimientos reales.");
  }

  function resetApp() {
    if (!window.confirm("¿Seguro que querés restaurar los datos de ejemplo? Se borra todo lo que cargaron.")) return;
    setState(DEFAULT_STATE);
    showToast("Datos de ejemplo restaurados.");
  }
  function applySetup(newState) { setState(reconcileState(newState)); setModal(null); setTab("inicio"); showToast("Nueva situación financiera cargada."); }

  function resetFinancialData() {
    setState((prev) => ({
      ...prev,
      // Se conservan: people, settings (reglas, categorías, tema, fechas de config), y toda la arquitectura.
      // Se limpian: cuentas, deudas, inversiones, movimientos, objetivos, historial de patrimonio.
      accounts: [
        { id: "fondo", name: "Fondo de Emergencia", icon: "shield", kind: "fondo", owner: "familia", balance: 0, active: true },
        { id: "inv-pendiente", name: "Capital de Inversión Pendiente", icon: "package", kind: "inversion_pendiente", owner: "familia", balance: 0, active: true },
        { id: "inv-disponible", name: "Capital Disponible para Invertir", icon: "trending", kind: "inversion_disponible", owner: "familia", balance: 0, active: true },
      ],
      debts: [],
      investments: [],
      movements: [],
      goals: [
        { id: "g-fondo", name: "Fondo de emergencia", type: "fondo", ref: "fondo", target: prev.settings.fondoTarget, owner: "familia", custom: false },
        { id: "g-inversion", name: "Inversiones", type: "inversion", ref: "ALL", target: null, owner: "familia", custom: false },
      ],
      patrimonioHistory: [],
      settings: { ...prev.settings, fixedExpenses: prev.settings.fixedExpenses.map((f) => ({ ...f, amount: 0 })) },
      meta: { ...prev.meta, initialSetupDate: null },
    }));
    setModal("setup");
    showToast("Datos financieros restablecidos. Cargá la situación inicial cuando quieras.");
  }

  function openFab(id) {
    setFabOpen(false);
    if (id === "ahorro") setModal("ahorro-transfer");
    else if (id === "retiro") setModal("retiro-transfer");
    else setModal(id);
  }

  function handleUnlock(personId) {
    setUnlockedPerson(personId);
    localStorage.setItem("ff-unlocked-person", personId);
    setActiveUser(personId);
    setSwitchRequest(null);
  }
  function requestSwitch(personId) { setSwitchRequest(personId); }
  function logout() {
    localStorage.removeItem("ff-unlocked-person");
    setUnlockedPerson(null);
  }

  if (!unlockedPerson) {
    return <div className="ff-root" data-theme={resolvedTheme}><StyleSheet theme={resolvedTheme} /><CloudStatusBanner /><LockScreen state={state} onUnlock={handleUnlock} /></div>;
  }
  if (switchRequest) {
    return <div className="ff-root" data-theme={resolvedTheme}><StyleSheet theme={resolvedTheme} /><CloudStatusBanner /><LockScreen state={state} requestedPerson={switchRequest} onUnlock={handleUnlock} onCancel={() => setSwitchRequest(null)} /></div>;
  }

  return (
    <div className="ff-root" data-theme={resolvedTheme}>
      <CloudStatusBanner />
      <StyleSheet theme={resolvedTheme} />
      <div className="ff-app">
        <TopBar state={state} activeUser={activeUser} onRequestSwitch={requestSwitch} viewMode={viewMode} setViewMode={setViewMode} saveStatus={saveStatus} />
        <div className="ff-scroll">
          {tab === "inicio" && <DashboardTab state={state} viewOwner={effectiveOwner} activeUser={activeUser} onDistribute={distribute} onNavigate={setTab} onOpenSimulator={() => setModal("simulador")} />}
          {tab === "movimientos" && <MovimientosTab state={state} viewOwner={effectiveOwner} onVoid={voidMovement} onEdit={editMovement} />}
          {tab === "agenda" && <AgendaTab state={state} activeUser={activeUser} onAdd={addTask} onToggle={toggleTask} onDelete={deleteTask} />}
          {tab === "objetivos" && <ObjetivosTab state={state} onAddGoal={addGoal} onEditGoal={editGoal} onDeleteGoal={deleteGoal} onOpenAhorro={(accId) => setModal({ type: "ahorro-transfer", toId: accId })} />}
          {tab === "patrimonio" && (
            <PatrimonioTab
              state={state} viewOwner={effectiveOwner} onActivatePending={activatePending}
              onAddAccount={() => setModal("account-new")} onEditAccount={(a) => { setEditingAccount(a); setModal("account-edit"); }} onHideAccount={hideAccount}
              onAddDebt={() => setModal("debt-new")} onEditDebt={(d) => { setEditingDebt(d); setModal("debt-edit"); }} onDeleteDebt={deleteDebt}
              onUpdateInvestment={updateInvestmentValue} onOpenSetup={() => setModal("setup")}
            />
          )}
          {tab === "mas" && <MasTab state={state} activeUser={activeUser} onUpdateSettings={updateSettings} onUpdatePins={(pins) => updateSettings({ pins })} onLogout={logout} onReset={resetApp} onUpdatePeople={updatePeople} onResetFinancialData={() => setModal("reset-confirm")} onOpenSetup={() => setModal("setup")} />}
          <div style={{ height: 110 }} />
        </div>

        {fabOpen && (
          <div className="ff-fab-backdrop" onClick={() => setFabOpen(false)}>
            <div className="ff-fab-menu" onClick={(e) => e.stopPropagation()}>
              {FAB_ACTIONS.map((a) => { const A = a.icon; return <button key={a.id} onClick={() => openFab(a.id)}><A size={17} className={a.tone} /> {a.label}</button>; })}
            </div>
          </div>
        )}
        <button className={`ff-fab ${fabOpen ? "ff-fab--open" : ""}`} onClick={() => setFabOpen((v) => !v)}><Plus size={26} /></button>

        <nav className="ff-nav">
          {TABS.map((t) => { const T = t.icon; return (
            <button key={t.id} className={`ff-nav__item ${tab === t.id ? "active" : ""}`} onClick={() => { setTab(t.id); setFabOpen(false); }}><T size={20} /><span>{t.label}</span></button>
          ); })}
        </nav>

        {toast && <div className="ff-toast">{toast}</div>}

        {modal === "ingreso" && <IngresoModal state={state} defaultOwner={activeUser} onClose={() => { setModal(null); setEditingMovement(null); }} onSubmit={(p) => editingMovement ? submitEdit("ingreso", p) : addIngreso(p)} initial={editingMovement} />}
        {modal === "gasto" && <GastoModal state={state} defaultOwner={activeUser} onClose={() => { setModal(null); setEditingMovement(null); }} onSubmit={(p) => editingMovement ? submitEdit("gasto", p) : addGasto(p)} initial={editingMovement} />}
        {modal === "transferencia" && <TransferModal state={state} onClose={() => setModal(null)} onSubmit={addTransfer} />}
        {modal === "ahorro-transfer" && <TransferModal state={state} mode="ahorro" onClose={() => setModal(null)} onSubmit={addTransfer} />}
        {modal === "retiro-transfer" && <TransferModal state={state} mode="retiro" onClose={() => setModal(null)} onSubmit={addTransfer} />}
        {modal === "pago" && <PagoDeudaModal state={state} onClose={() => { setModal(null); setEditingMovement(null); }} onSubmit={(p) => editingMovement ? submitEdit("pago", p) : addPagoDeuda(p)} />}
        {modal === "inversion" && <InversionModal state={state} defaultOwner={activeUser} onClose={() => setModal(null)} onSubmit={addInversion} />}
        {modal === "otro" && <OtroModal state={state} defaultOwner={activeUser} onClose={() => setModal(null)} onSubmit={addOtro} />}
        {modal === "simulador" && <SimulatorSheet state={state} onClose={() => setModal(null)} onApply={applySimulation} />}
        {modal === "setup" && <SetupModal state={state} onClose={() => setModal(null)} onApply={applySetup} />}
        {modal === "reset-confirm" && <ResetConfirmSheet onClose={() => setModal(null)} onConfirm={resetFinancialData} />}
        {modal === "account-new" && <AccountModal state={state} onClose={() => setModal(null)} onSubmit={addAccount} />}
        {modal === "account-edit" && editingAccount && <AccountModal state={state} editing={editingAccount} onClose={() => { setModal(null); setEditingAccount(null); }} onSubmit={(p) => editAccount(editingAccount, p)} />}
        {modal === "debt-new" && <DebtModal state={state} onClose={() => setModal(null)} onSubmit={addDebt} />}
        {modal === "debt-edit" && editingDebt && <DebtModal state={state} editing={editingDebt} onClose={() => { setModal(null); setEditingDebt(null); }} onSubmit={(p) => editDebt(editingDebt, p)} />}
      </div>
    </div>
  );
}

/* ============================================================
   ESTILOS
   ============================================================ */

function StyleSheet() {
  return (
    <style>{`
      /* Tipografía cargada desde index.html (preconnect + no bloqueante), no acá adentro */

      :root{
        --ff-bg:#FAF7F1; --ff-surface:#FFFFFF; --ff-carbon:#22262B; --ff-carbon-soft:#767D87;
        --ff-border:#EAE4D8; --ff-emerald:#146C55; --ff-emerald-soft:#E7F3ED; --ff-petrol:#0C4C63;
        --ff-petrol-soft:#E6EEF2; --ff-amber:#B9852C; --ff-amber-soft:#FBF2DF; --ff-red:#B3564A; --ff-red-soft:#FBEAE7;
        --ff-radius:20px; --ff-shadow: 0 1px 2px rgba(34,38,43,0.04), 0 8px 24px rgba(34,38,43,0.05);
      }
      .ff-root[data-theme='dark']{
        --ff-bg:#15181C; --ff-surface:#1D2126; --ff-carbon:#F2F0EA; --ff-carbon-soft:#9AA1AA;
        --ff-border:#2B3138; --ff-emerald:#3FBF95; --ff-emerald-soft:#173A2E; --ff-petrol:#4FB6D9;
        --ff-petrol-soft:#12303B; --ff-amber:#E0AC55; --ff-amber-soft:#3A2E14; --ff-red:#E08277; --ff-red-soft:#3A1E1A;
        --ff-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.35);
      }

      .ff-root{ font-family:'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background:var(--ff-bg); color:var(--ff-carbon); min-height:100vh; -webkit-font-smoothing:antialiased; transition:background .3s ease, color .3s ease; }
      .ff-app{ max-width:480px; margin:0 auto; position:relative; min-height:100vh; }
      .ff-scroll{ padding:20px 16px 0; }

      .ff-cloud-banner{ position:fixed; top:0; left:0; right:0; z-index:200; background:var(--ff-red); color:#fff; padding:10px 16px; font-size:12.5px; font-weight:600; display:flex; align-items:center; gap:8px; text-align:left; }
      .ff-lock-overlay{ position:fixed; inset:0; background:var(--ff-bg); display:flex; align-items:center; justify-content:center; z-index:100; padding:20px; }
      .ff-lock-card{ background:var(--ff-surface); border:1px solid var(--ff-border); border-radius:24px; padding:32px 26px; max-width:340px; width:100%; text-align:center; box-shadow:var(--ff-shadow); }
      .ff-lock-card--shake{ animation: ff-shake .4s; }
      @keyframes ff-shake{ 0%,100%{transform:translateX(0);} 20%{transform:translateX(-8px);} 40%{transform:translateX(8px);} 60%{transform:translateX(-6px);} 80%{transform:translateX(6px);} }
      .ff-lock-emoji{ font-size:36px; margin-bottom:6px; }
      .ff-lock-title{ font-family:'Manrope',sans-serif; font-weight:800; font-size:20px; margin:0 0 20px; color:var(--ff-carbon); }
      .ff-lock-people{ display:flex; flex-direction:column; gap:10px; }
      .ff-lock-person{ display:flex; align-items:center; justify-content:center; gap:10px; padding:15px; border-radius:14px; border:1px solid var(--ff-border); background:var(--ff-bg); color:var(--ff-carbon); font-weight:700; font-size:15px; }
      .ff-lock-dots{ display:flex; justify-content:center; gap:14px; margin-bottom:24px; }
      .ff-lock-dot{ width:14px; height:14px; border-radius:50%; border:2px solid var(--ff-border); }
      .ff-lock-dot.filled{ background:var(--ff-emerald); border-color:var(--ff-emerald); }
      .ff-pinpad{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
      .ff-pinpad button{ aspect-ratio:1; border-radius:50%; border:1px solid var(--ff-border); background:var(--ff-bg); color:var(--ff-carbon); font-size:20px; font-weight:700; font-family:'Manrope',sans-serif; }
      .ff-pinpad button:active{ background:var(--ff-emerald-soft); }

      .ff-topbar{ display:flex; align-items:center; justify-content:space-between; gap:8px; padding:14px 16px 0; position:relative; z-index:5; }
      .ff-topbar__who{ position:relative; }
      .ff-save-indicator{ margin-left:8px; font-size:11px; font-weight:700; }
      .ff-save-indicator--amber{ color:var(--ff-amber); }
      .ff-save-indicator--emerald{ color:var(--ff-emerald); }
      .ff-save-indicator--red{ color:var(--ff-red); }
      .ff-who-btn{ display:flex; align-items:center; gap:5px; font-size:12.5px; font-weight:700; color:var(--ff-carbon-soft); background:var(--ff-surface); border:1px solid var(--ff-border); border-radius:99px; padding:7px 12px; }
      .ff-who-btn b{ color:var(--ff-carbon); }
      .ff-who-caret{ transform:rotate(90deg); opacity:.5; }
      .ff-who-menu{ position:absolute; top:calc(100% + 6px); left:0; background:var(--ff-surface); border:1px solid var(--ff-border); border-radius:14px; box-shadow:var(--ff-shadow); padding:6px; z-index:10; min-width:140px; }
      .ff-who-menu button{ display:flex; align-items:center; gap:8px; width:100%; padding:9px 12px; background:none; border:none; border-radius:10px; font-size:13px; font-weight:600; color:var(--ff-carbon); text-align:left; }
      .ff-who-menu button.active{ background:var(--ff-emerald-soft); color:var(--ff-emerald); }
      .ff-topbar__mode{ flex-shrink:0; }
      .ff-topbar__mode button{ padding:7px 10px; font-size:11.5px; }

      .ff-reset-list{ margin:0; padding-left:18px; font-size:13px; color:var(--ff-carbon-soft); line-height:1.8; }
      .ff-reset-list--keep{ color:var(--ff-emerald); }
      .ff-checkbox-row{ display:flex; align-items:flex-start; gap:8px; margin-top:16px; font-size:12.5px; color:var(--ff-carbon-soft); line-height:1.4; }
      .ff-checkbox-row input{ margin-top:2px; width:16px; height:16px; flex-shrink:0; }
      .ff-loading{ padding:60px 24px; text-align:center; color:var(--ff-carbon-soft); }

      .ff-tab{ display:flex; flex-direction:column; gap:14px; }
      .ff-tab-header h2{ font-family:'Manrope',sans-serif; font-weight:800; font-size:26px; margin:0 0 2px; }
      .ff-tab-header p{ margin:0 0 6px; color:var(--ff-carbon-soft); font-size:14px; }

      .ff-hero{ padding:6px 2px 4px; }
      .ff-hero__eyebrow{ font-size:13px; color:var(--ff-carbon-soft); font-weight:600; }
      .ff-hero__msg{ font-family:'Manrope',sans-serif; font-weight:800; font-size:22px; margin-top:2px; line-height:1.25; }

      .ff-person-tabs{ display:flex; gap:8px; margin-bottom:2px; }
      .ff-person-tabs button{ flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:9px 6px; border-radius:12px; border:1px solid var(--ff-border); background:var(--ff-surface); color:var(--ff-carbon-soft); font-weight:700; font-size:12.5px; }
      .ff-person-tabs button.active{ background:var(--ff-carbon); color:var(--ff-bg); border-color:var(--ff-carbon); }

      .ff-card{ background:var(--ff-surface); border:1px solid var(--ff-border); border-radius:var(--ff-radius); padding:18px; box-shadow:var(--ff-shadow); }
      .ff-card--outline{ background:transparent; cursor:pointer; }
      .ff-card--amber{ background:var(--ff-amber-soft); border-color:transparent; }

      .ff-pending-line{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:11px; padding-top:11px; border-top:1px dashed var(--ff-border); }
      .ff-capital-line{ display:flex; align-items:center; gap:6px; margin-top:9px; font-size:11.5px; font-weight:700; color:var(--ff-petrol); }
      .ff-pending-line--stacked{ flex-direction:column; align-items:flex-start; gap:6px; }
      .ff-pending-line span{ display:flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:var(--ff-red); }
      .ff-pending-line button{ background:var(--ff-red-soft); color:var(--ff-red); border:none; border-radius:9px; padding:6px 11px; font-size:12px; font-weight:700; flex-shrink:0; }
      .ff-pending-line--stacked button{ align-self:stretch; }
      .ff-pending-explain{ display:flex; gap:7px; align-items:flex-start; background:var(--ff-amber-soft); border-radius:14px; padding:12px 14px; font-size:12px; color:var(--ff-amber); line-height:1.5; }
      .ff-pending-explain svg{ flex-shrink:0; margin-top:2px; }
      .ff-pending-explain .ff-link-btn{ color:var(--ff-amber); text-decoration:underline; display:inline; padding:0; }
      .ff-card--emerald-soft{ background:var(--ff-emerald-soft); border-color:transparent; cursor:pointer; }
      .ff-total-card{ background:var(--ff-carbon); border-color:transparent; color:var(--ff-bg); }
      .ff-total-card__label{ font-size:13px; opacity:.7; font-weight:600; }
      .ff-total-card__value{ font-family:'Manrope',sans-serif; font-weight:800; font-size:34px; margin:4px 0 12px; letter-spacing:-0.01em; }
      .ff-total-card__breakdown{ display:flex; flex-direction:column; gap:6px; font-size:13px; opacity:.85; }
      .ff-total-card__breakdown > div{ display:flex; align-items:center; gap:6px; justify-content:space-between; }

      .ff-card__title{ display:flex; align-items:center; gap:7px; font-weight:700; font-size:14.5px; flex-wrap:wrap; }
      .ff-card__sub{ color:var(--ff-carbon-soft); font-size:13px; margin-top:3px; line-height:1.45; }
      .ff-stat-card{ cursor:pointer; }
      .ff-stat-card__value{ font-family:'Manrope',sans-serif; font-weight:800; font-size:24px; margin:8px 0 2px; }
      .ff-goal-card{ cursor:pointer; }
      .ff-goal-card__value{ font-family:'Manrope',sans-serif; font-weight:800; font-size:26px; margin:10px 0 10px; }
      .ff-goal-card__value span{ font-size:14px; font-weight:600; color:var(--ff-carbon-soft); }

      .ff-grid-2{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .ff-row-between{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .ff-row-inline{ display:flex; align-items:center; gap:8px; }
      .ff-small-text{ font-size:12.5px; color:var(--ff-carbon-soft); margin-top:4px; }
      .ff-muted{ color:var(--ff-carbon-soft); font-weight:600; }

      .ff-progress{ height:9px; border-radius:99px; background:var(--ff-border); overflow:hidden; margin:8px 0 2px; }
      .ff-progress__fill{ height:100%; border-radius:99px; transition:width .6s cubic-bezier(.22,1,.36,1); }
      .ff-progress__fill--emerald{ background:linear-gradient(90deg,#1F8E6E,var(--ff-emerald)); }
      .ff-progress__fill--petrol{ background:linear-gradient(90deg,#12718F,var(--ff-petrol)); }

      .ff-mini-row{ display:flex; align-items:center; justify-content:space-between; padding:9px 0; border-bottom:1px solid var(--ff-border); font-size:13.5px; width:100%; background:none; border-left:none; border-right:none; border-top:none; text-align:left; color:var(--ff-carbon); }
      button.ff-mini-row{ cursor:pointer; }
      .ff-mini-row:last-child{ border-bottom:none; }
      .ff-mini-row span{ display:flex; align-items:center; gap:6px; }
      .ff-link-btn{ display:flex; align-items:center; gap:4px; font-size:12.5px; font-weight:700; color:var(--ff-petrol); background:none; border:none; }
      .ff-link{ color:var(--ff-petrol); font-weight:700; font-size:13px; display:flex; align-items:center; gap:2px; }

      .ff-pill{ font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:99px; display:inline-flex; align-items:center; gap:4px; }
      .ff-pill--emerald{ background:var(--ff-emerald-soft); color:var(--ff-emerald); }
      .ff-pill--amber{ background:var(--ff-amber-soft); color:var(--ff-amber); }
      .ff-pill--neutral{ background:var(--ff-border); color:var(--ff-carbon-soft); }

      .ff-note{ font-size:12.5px; color:var(--ff-carbon-soft); margin-top:10px; display:flex; gap:6px; align-items:flex-start; line-height:1.4; }
      .ff-note--amber{ color:var(--ff-amber); }
      .ff-note--emerald{ color:var(--ff-emerald); }

      .ff-alloc-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:12px; }
      .ff-alloc-item{ display:flex; flex-direction:column; align-items:center; gap:4px; background:var(--ff-bg); border-radius:14px; padding:12px 4px; }
      .ff-alloc-item span{ font-weight:800; font-size:15px; font-family:'Manrope',sans-serif; }
      .ff-alloc-item small{ font-size:10.5px; color:var(--ff-carbon-soft); }

      .ff-donut-row{ display:flex; align-items:center; gap:10px; margin-top:10px; }
      .ff-alloc-grid--compact{ grid-template-columns:repeat(2,1fr); flex:1; margin-top:0; gap:6px; }
      .ff-alloc-grid--compact .ff-alloc-item{ padding:8px 4px; }
      .ff-alloc-grid--compact .ff-alloc-item span{ font-size:13px; }
      @media (max-width:360px){ .ff-donut-row{ flex-direction:column; } .ff-donut-row .ff-chart-wrap{ align-self:center; } }

      .ff-ic-emerald{ color:var(--ff-emerald); } .ff-ic-petrol{ color:var(--ff-petrol); } .ff-ic-amber{ color:var(--ff-amber); }
      .ff-ic-red{ color:var(--ff-red); } .ff-ic-carbon{ color:var(--ff-carbon); }

      .ff-debt-block{ padding:10px 0; border-bottom:1px solid var(--ff-border); }
      .ff-debt-block:last-child{ border-bottom:none; }

      .ff-insights{ display:flex; flex-direction:column; gap:8px; margin:10px 0 4px; }
      .ff-insight{ font-size:13px; padding:10px 12px; border-radius:12px; line-height:1.4; }
      .ff-insight--emerald{ background:var(--ff-emerald-soft); color:var(--ff-emerald); }
      .ff-insight--amber{ background:var(--ff-amber-soft); color:var(--ff-amber); }
      .ff-insight--petrol{ background:var(--ff-petrol-soft); color:var(--ff-petrol); }
      .ff-insight--red{ background:var(--ff-red-soft); color:var(--ff-red); }

      .ff-chart-wrap{ margin-top:10px; }
      .ff-legend{ display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; }
      .ff-legend__item{ display:flex; align-items:center; gap:6px; font-size:12px; color:var(--ff-carbon-soft); }
      .ff-legend__item span{ width:9px; height:9px; border-radius:50%; display:inline-block; }

      .ff-list{ display:flex; flex-direction:column; gap:8px; }
      .ff-move-row{ display:flex; align-items:center; gap:12px; background:var(--ff-surface); border:1px solid var(--ff-border); border-radius:16px; padding:12px 14px; }
      .ff-move-row--void{ opacity:.45; }
      .ff-move-icon{ width:36px; height:36px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .ff-move-icon--emerald{ background:var(--ff-emerald-soft); color:var(--ff-emerald); }
      .ff-move-icon--red{ background:var(--ff-red-soft); color:var(--ff-red); }
      .ff-move-icon--petrol{ background:var(--ff-petrol-soft); color:var(--ff-petrol); }
      .ff-move-mid{ flex:1; min-width:0; }
      .ff-move-desc{ font-weight:700; font-size:14px; display:flex; align-items:center; gap:6px; min-width:0; }
      .ff-move-desc__text{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .ff-move-sub{ font-size:11.5px; color:var(--ff-carbon-soft); margin-top:1px; }
      .ff-move-right{ text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:4px; }
      .ff-move-amount{ font-weight:800; font-family:'Manrope',sans-serif; font-size:14.5px; }
      .ff-move-amount--emerald{ color:var(--ff-emerald); } .ff-move-amount--red{ color:var(--ff-red); } .ff-move-amount--petrol{ color:var(--ff-petrol); }

      .ff-filter-scroll{ display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; }
      .ff-chip{ flex-shrink:0; border:1px solid var(--ff-border); background:var(--ff-surface); border-radius:99px; padding:7px 14px; font-size:13px; font-weight:600; color:var(--ff-carbon-soft); }
      .ff-chip.active{ background:var(--ff-carbon); color:var(--ff-bg); border-color:var(--ff-carbon); }

      .ff-empty{ text-align:center; padding:50px 20px; color:var(--ff-carbon-soft); }
      .ff-empty__icon{ display:flex; justify-content:center; margin-bottom:10px; opacity:.5; }
      .ff-empty__title{ font-weight:700; color:var(--ff-carbon); }
      .ff-empty__subtitle{ font-size:13px; margin-top:4px; }

      .ff-field{ display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
      .ff-field__label{ font-size:12.5px; font-weight:700; color:var(--ff-carbon-soft); }
      .ff-field input, .ff-field select{ border:1px solid var(--ff-border); border-radius:12px; padding:11px 13px; font-size:15px; background:var(--ff-bg); color:var(--ff-carbon); font-family:inherit; width:100%; }
      .ff-inline-input{ width:120px; border:1px solid var(--ff-border); border-radius:10px; padding:6px 9px; font-size:13.5px; text-align:right; background:var(--ff-bg); font-family:inherit; color:var(--ff-carbon); }

      .ff-segmented{ display:flex; border:1px solid var(--ff-border); border-radius:12px; overflow:hidden; flex-wrap:wrap; }
      .ff-segmented button{ flex:1; padding:10px 6px; font-size:12.5px; font-weight:700; background:var(--ff-surface); color:var(--ff-carbon-soft); border-right:1px solid var(--ff-border); display:flex; align-items:center; justify-content:center; gap:5px; }
      .ff-segmented button:last-child{ border-right:none; }
      .ff-segmented button.active{ background:var(--ff-carbon); color:var(--ff-bg); }

      .ff-btn{ border-radius:14px; padding:13px 18px; font-weight:700; font-size:14.5px; display:inline-flex; align-items:center; justify-content:center; gap:7px; border:none; }
      .ff-btn--primary{ background:var(--ff-carbon); color:var(--ff-bg); }
      .ff-btn--primary:disabled{ opacity:.35; }
      .ff-btn--secondary{ background:var(--ff-petrol-soft); color:var(--ff-petrol); }
      .ff-btn--outline{ background:transparent; border:1.5px dashed var(--ff-border); color:var(--ff-carbon-soft); }
      .ff-btn--danger{ background:var(--ff-red-soft); color:var(--ff-red); }
      .ff-btn--full{ width:100%; margin-top:10px; }

      .ff-icon-btn{ background:none; border:none; padding:6px; color:var(--ff-carbon-soft); display:flex; }
      .ff-icon-btn--ghost:hover{ color:var(--ff-red); }

      .ff-preview{ background:var(--ff-bg); border-radius:14px; padding:14px; margin-top:6px; }
      .ff-preview__title{ font-weight:700; font-size:13px; margin-bottom:8px; }
      .ff-preview__row{ display:flex; align-items:center; justify-content:space-between; font-size:13.5px; padding:5px 0; gap:10px; }
      .ff-preview__row span{ display:flex; align-items:center; gap:6px; color:var(--ff-carbon-soft); }
      .ff-preview__note{ font-size:12px; color:var(--ff-carbon-soft); margin-top:8px; line-height:1.4; }

      .ff-steps{ display:flex; gap:6px; margin:4px 0 16px; flex-wrap:wrap; }
      .ff-step{ font-size:11px; font-weight:700; padding:5px 10px; border-radius:99px; background:var(--ff-bg); color:var(--ff-carbon-soft); }
      .ff-step.active{ background:var(--ff-carbon); color:var(--ff-bg); }
      .ff-step.done{ background:var(--ff-emerald-soft); color:var(--ff-emerald); }
      .ff-setup-row{ display:flex; gap:8px; align-items:center; margin-bottom:8px; }
      .ff-setup-row input, .ff-setup-row select{ border:1px solid var(--ff-border); border-radius:12px; padding:10px 12px; font-size:14px; background:var(--ff-bg); color:var(--ff-carbon); font-family:inherit; flex:1; min-width:0; }
      .ff-setup-amount{ max-width:130px; text-align:right; }
      .ff-setup-block{ border:1px solid var(--ff-border); border-radius:14px; padding:12px; margin-bottom:10px; background:var(--ff-bg); }
      .ff-setup-block input, .ff-setup-block select{ width:100%; border:1px solid var(--ff-border); border-radius:10px; padding:9px 11px; font-size:14px; background:var(--ff-surface); color:var(--ff-carbon); font-family:inherit; margin-bottom:6px; }
      .ff-setup-block .ff-setup-row input, .ff-setup-block .ff-setup-row select{ margin-bottom:0; }

      .ff-agenda-add{ padding:14px; }
      .ff-agenda-add__row{ display:flex; gap:8px; align-items:center; }
      .ff-agenda-add__row input{ flex:1; border:1px solid var(--ff-border); border-radius:12px; padding:11px 13px; font-size:14.5px; background:var(--ff-bg); color:var(--ff-carbon); font-family:inherit; }
      .ff-agenda-add__btn{ width:42px; height:42px; border-radius:12px; background:var(--ff-carbon); color:var(--ff-bg); border:none; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .ff-agenda-add__btn:disabled{ opacity:.3; }
      .ff-agenda-add__opts{ display:flex; gap:6px; flex-wrap:wrap; margin-top:10px; }
      .ff-agenda-add__date{ margin-top:8px; width:100%; border:1px solid var(--ff-border); border-radius:12px; padding:10px 12px; font-size:14px; background:var(--ff-bg); color:var(--ff-carbon); font-family:inherit; }

      .ff-cat-chip{ display:flex; align-items:center; gap:5px; padding:6px 11px; border-radius:99px; font-size:12px; font-weight:700; border:1px solid var(--ff-border); background:var(--ff-surface); color:var(--ff-carbon-soft); }
      .ff-cat-chip--amber.active{ background:var(--ff-amber-soft); color:var(--ff-amber); border-color:transparent; }
      .ff-cat-chip--petrol.active{ background:var(--ff-petrol-soft); color:var(--ff-petrol); border-color:transparent; }
      .ff-cat-chip--emerald.active{ background:var(--ff-emerald-soft); color:var(--ff-emerald); border-color:transparent; }
      .ff-cat-chip--red.active{ background:var(--ff-red-soft); color:var(--ff-red); border-color:transparent; }
      .ff-cat-chip.active{ background:var(--ff-carbon); color:var(--ff-bg); border-color:transparent; }

      .ff-agenda-group{ display:flex; flex-direction:column; gap:8px; }
      .ff-agenda-group__title{ font-size:12.5px; font-weight:800; color:var(--ff-carbon-soft); text-transform:uppercase; letter-spacing:.03em; display:flex; align-items:center; gap:5px; padding-left:2px; }
      .ff-agenda-group__title--red{ color:var(--ff-red); }
      .ff-agenda-group__title--amber{ color:var(--ff-amber); }

      .ff-task-row{ display:flex; align-items:center; gap:11px; background:var(--ff-surface); border:1px solid var(--ff-border); border-radius:16px; padding:12px 13px; }
      .ff-task-row--done{ opacity:.5; }
      .ff-task-row--done .ff-task-title{ text-decoration:line-through; }
      .ff-task-check{ background:none; border:none; color:var(--ff-carbon-soft); display:flex; flex-shrink:0; }
      .ff-task-mid{ flex:1; min-width:0; }
      .ff-task-title{ font-weight:700; font-size:14px; }
      .ff-task-meta{ display:flex; align-items:center; gap:8px; margin-top:4px; flex-wrap:wrap; }
      .ff-task-cat{ display:flex; align-items:center; gap:4px; font-size:11px; font-weight:700; padding:2px 8px; border-radius:99px; }
      .ff-task-cat--amber{ background:var(--ff-amber-soft); color:var(--ff-amber); }
      .ff-task-cat--petrol{ background:var(--ff-petrol-soft); color:var(--ff-petrol); }
      .ff-task-cat--emerald{ background:var(--ff-emerald-soft); color:var(--ff-emerald); }
      .ff-task-cat--red{ background:var(--ff-red-soft); color:var(--ff-red); }
      .ff-task-due{ font-size:11px; font-weight:700; color:var(--ff-carbon-soft); }
      .ff-task-due--overdue{ color:var(--ff-red); }
      .ff-task-due--today{ color:var(--ff-amber); }

      .ff-nav{ position:sticky; bottom:0; left:0; right:0; display:flex; background:color-mix(in srgb, var(--ff-surface) 92%, transparent); backdrop-filter:blur(12px); border-top:1px solid var(--ff-border); padding:8px 6px calc(8px + env(safe-area-inset-bottom)); max-width:480px; margin:0 auto; }
      .ff-nav__item{ flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; padding:6px 1px; background:none; border:none; color:var(--ff-carbon-soft); min-width:0; }
      .ff-nav__item span{ font-size:9.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
      .ff-nav__item.active{ color:var(--ff-emerald); }

      .ff-fab{ position:absolute; right:18px; bottom:78px; width:58px; height:58px; border-radius:50%; background:var(--ff-emerald); color:#fff; border:none; display:flex; align-items:center; justify-content:center; box-shadow:0 10px 24px rgba(20,108,85,.35); transition:transform .25s ease; }
      .ff-fab--open{ transform:rotate(45deg); }
      .ff-fab-backdrop{ position:absolute; inset:0; z-index:20; }
      .ff-fab-menu{ position:absolute; right:18px; bottom:144px; display:flex; flex-direction:column; gap:6px; background:var(--ff-surface); border-radius:16px; padding:8px; box-shadow:var(--ff-shadow); border:1px solid var(--ff-border); max-height:70vh; overflow-y:auto; }
      .ff-fab-menu button{ display:flex; align-items:center; gap:10px; padding:11px 16px; background:none; border:none; font-weight:700; font-size:14px; white-space:nowrap; border-radius:10px; text-align:left; color:var(--ff-carbon); }
      .ff-fab-menu button:hover{ background:var(--ff-bg); }

      .ff-toast{ position:absolute; left:16px; right:16px; bottom:150px; background:var(--ff-carbon); color:var(--ff-bg); padding:13px 16px; border-radius:14px; font-size:13.5px; font-weight:600; text-align:center; z-index:30; box-shadow:0 10px 24px rgba(0,0,0,.25); }

      .ff-sheet-backdrop{ position:fixed; inset:0; background:rgba(20,20,20,.4); z-index:50; display:flex; align-items:flex-end; }
      .ff-sheet{ background:var(--ff-surface); width:100%; max-width:480px; margin:0 auto; border-radius:24px 24px 0 0; max-height:88vh; overflow-y:auto; padding:6px 20px 20px; animation:ff-sheet-up .28s cubic-bezier(.22,1,.36,1); }
      @keyframes ff-sheet-up{ from{ transform:translateY(24px); opacity:0;} to{ transform:translateY(0); opacity:1;} }
      .ff-sheet__header{ display:flex; align-items:center; justify-content:space-between; padding:14px 0 10px; position:sticky; top:0; background:var(--ff-surface); }
      .ff-sheet__header h3{ font-family:'Manrope',sans-serif; font-size:19px; margin:0; }
      .ff-sheet__footer{ padding-top:6px; }
      .ff-sheet__footer .ff-btn{ width:100%; }

      @media (min-width:481px){ .ff-app{ box-shadow:0 0 40px rgba(0,0,0,.06); min-height:100vh; } }
    `}</style>
  );
}
