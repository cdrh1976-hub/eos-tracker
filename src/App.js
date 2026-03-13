import { useState, useMemo } from "react";

const LEAD_SOURCES = [
  { id: "self", label: "Self-Generated", focusDayFee: 0, commissionRate: 0.05 },
  { id: "eosww", label: "EOS Worldwide", focusDayFee: 0.5, commissionRate: 0.05 },
  { id: "tpr", label: "TPR / TPR Implementer", focusDayFee: 0.5, commissionRate: 0.15 },
  { id: "other_eosi", label: "Other EOSi Referral", focusDayFee: 0.5, commissionRate: 0.05 },
];

const SESSION_TYPES = ["Focus Day", "Annual", "Quarterly", "VB1", "VB2", "Other"];
const PAYMENT_METHODS = ["Per Session", "Monthly Retainer"];

const DEFAULT_IMPLEMENTERS = ["Carlos", "Cesar", "Fernando", "Gerardo", "Jennifer", "Liz", "Isabel", "Victor"];

const initialClients = [
  {
    id: 1,
    name: "Acme Corp",
    leadSource: "tpr",
    paymentMethod: "Monthly Retainer",
    annualSessions: 5,
    sessionRate: 3500,
    notes: "Started Q1 2025",
    implementer: "",
    sessions: [
      { id: 1, type: "Focus Day", date: "2025-01-15", grossFee: 3500, travelAirfare: 420, travelHotel: 180, travelPerDiem: 200, status: "Received" },
      { id: 2, type: "Quarterly", date: "2025-03-10", grossFee: 3500, travelAirfare: 0, travelHotel: 0, travelPerDiem: 0, status: "Received" },
      { id: 3, type: "Quarterly", date: "2025-06-12", grossFee: 3500, travelAirfare: 420, travelHotel: 180, travelPerDiem: 200, status: "Invoiced" },
    ]
  },
  {
    id: 2,
    name: "Sunrise Ventures",
    leadSource: "eosww",
    paymentMethod: "Per Session",
    annualSessions: 4,
    sessionRate: 4000,
    notes: "",
    implementer: "",
    sessions: [
      { id: 1, type: "Focus Day", date: "2025-02-20", grossFee: 4000, travelAirfare: 300, travelHotel: 0, travelPerDiem: 0, status: "Received" },
      { id: 2, type: "Quarterly", date: "2025-05-15", grossFee: 4000, travelAirfare: 0, travelHotel: 0, travelPerDiem: 0, status: "Received" },
    ]
  }
];

function calcPayout(session, client) {
  const source = LEAD_SOURCES.find(s => s.id === client.leadSource);
  const isFocusDay = session.type === "Focus Day";
  const gross = session.grossFee;
  let referralDeduction = 0;
  let commissionDeduction = 0;
  let referralLabel = "";

  if (source.id === "self") {
    commissionDeduction = gross * source.commissionRate;
    referralLabel = "Self-Gen (5%)";
  } else if (isFocusDay) {
    referralDeduction = gross * source.focusDayFee;
    referralLabel = source.id === "eosww" ? "EOS WW (50%)" : source.id === "tpr" ? "TPR (50%)" : "EOSi Referral (50%)";
  } else {
    commissionDeduction = gross * source.commissionRate;
    referralLabel = source.id === "tpr" ? "TPR (15%)" : `Commission (${source.commissionRate * 100}%)`;
  }

  const travelTotal = (session.travelAirfare || 0) + (session.travelHotel || 0) + (session.travelPerDiem || 0);
  const totalDeductions = referralDeduction + commissionDeduction;
  const netPayout = gross - totalDeductions;

  return { referralDeduction, commissionDeduction, travelTotal, netPayout, totalDeductions, referralLabel };
}

function calcMonthlyPayment(client) {
  if (client.paymentMethod !== "Monthly Retainer") return null;
  return (client.sessionRate * client.annualSessions) / 12;
}

function fmt(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

const emptySession = { type: "Focus Day", date: "", grossFee: "", travelAirfare: "", travelHotel: "", travelPerDiem: "", status: "Invoiced" };
const emptyClient = { name: "", leadSource: "self", paymentMethod: "Per Session", annualSessions: 4, sessionRate: "", notes: "", implementer: "" };

export default function App() {
  const [clients, setClients] = useState(initialClients);
  const [view, setView] = useState("dashboard");
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddSession, setShowAddSession] = useState(false);
  const [showDashboardSession, setShowDashboardSession] = useState(false);
  const [dashboardSessionClientId, setDashboardSessionClientId] = useState("");
  const [editingSession, setEditingSession] = useState(null); // { clientId, session }
  const [newClient, setNewClient] = useState(emptyClient);
  const [newSession, setNewSession] = useState(emptySession);
  const [filterSource, setFilterSource] = useState("all");
  const [implementers, setImplementers] = useState(DEFAULT_IMPLEMENTERS);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const stats = useMemo(() => {
    let totalGross = 0, totalNet = 0, totalPaid = 0, totalUnpaid = 0, totalTravel = 0;
    clients.forEach(client => {
      client.sessions.forEach(s => {
        const { netPayout, travelTotal } = calcPayout(s, client);
        totalGross += s.grossFee;
        totalNet += netPayout;
        totalTravel += travelTotal;
        if (s.status === "Received" || s.status === "Paid to EOSi") totalPaid += netPayout; else totalUnpaid += netPayout;
      });
    });
    const monthlyForecast = clients
      .filter(c => c.paymentMethod === "Monthly Retainer")
      .reduce((sum, c) => sum + (calcMonthlyPayment(c) || 0), 0);
    return { totalGross, totalNet, totalPaid, totalUnpaid, totalTravel, monthlyForecast };
  }, [clients]);

  function addClient() {
    if (!newClient.name || !newClient.sessionRate) return;
    const id = Date.now();
    setClients(prev => [...prev, { ...newClient, id, sessionRate: Number(newClient.sessionRate), annualSessions: Number(newClient.annualSessions), sessions: [] }]);
    setNewClient(emptyClient);
    setShowAddClient(false);
  }

  function addSession() {
    if (!newSession.date || !newSession.grossFee) return;
    const sessionId = Date.now();
    setClients(prev => prev.map(c => c.id === selectedClientId
      ? { ...c, sessions: [...c.sessions, { ...newSession, id: sessionId, grossFee: Number(newSession.grossFee), travelAirfare: Number(newSession.travelAirfare || 0), travelHotel: Number(newSession.travelHotel || 0), travelPerDiem: Number(newSession.travelPerDiem || 0) }] }
      : c
    ));
    setNewSession(emptySession);
    setShowAddSession(false);
  }

  function saveEditedSession() {
    const s = editingSession.session;
    setClients(prev => prev.map(c => c.id === editingSession.clientId
      ? { ...c, sessions: c.sessions.map(sess => sess.id === s.id
          ? { ...s, grossFee: Number(s.grossFee), travelAirfare: Number(s.travelAirfare || 0), travelHotel: Number(s.travelHotel || 0), travelPerDiem: Number(s.travelPerDiem || 0), status: s.status || "Invoiced" }
          : sess
        )}
      : c
    ));
    setEditingSession(null);
  }

  function setSessionStatus(clientId, sessionId, status) {
    setClients(prev => prev.map(c => c.id === clientId
      ? { ...c, sessions: c.sessions.map(s => s.id === sessionId ? { ...s, status } : s) }
      : c
    ));
  }

  const filteredClients = filterSource === "all" ? clients : clients.filter(c => c.leadSource === filterSource);

  return (
    <div style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", background: "#0f0f13", minHeight: "100vh", color: "#e8e6e1" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #1a1a22; } ::-webkit-scrollbar-thumb { background: #3a3a4a; border-radius: 2px; }
        input, select, textarea { font-family: inherit; }
        .btn { cursor: pointer; border: none; border-radius: 8px; font-family: inherit; font-weight: 600; transition: all 0.15s; }
        .btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .btn-primary { background: #c8f04a; color: #0f0f13; padding: 9px 18px; font-size: 13px; }
        .btn-ghost { background: #1e1e28; color: #9e9cb5; padding: 9px 18px; font-size: 13px; border: 1px solid #2a2a38; }
        .btn-ghost:hover { background: #25252f; color: #e8e6e1; }
        .btn-sm { padding: 5px 12px; font-size: 12px; }
        .btn-danger { background: #2e1a1a; color: #ef6060; border: 1px solid #4a2a2a; padding: 9px 18px; font-size: 13px; }
        .card { background: #16161f; border: 1px solid #22222e; border-radius: 14px; padding: 20px; }
        .input { background: #1e1e28; border: 1px solid #2a2a38; color: #e8e6e1; padding: 9px 12px; border-radius: 8px; font-size: 13px; width: 100%; outline: none; transition: border 0.15s; }
        .input:focus { border-color: #c8f04a; }
        .label { font-size: 11px; font-weight: 600; color: #6b6986; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 5px; display: block; }
        .nav-item { cursor: pointer; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; color: #6b6986; transition: all 0.15s; }
        .nav-item:hover { color: #e8e6e1; background: #1e1e28; }
        .nav-item.active { color: #c8f04a; background: #1e2a10; }
        .row-hover:hover { background: #1c1c26 !important; }
        .session-row { cursor: pointer; }
        .session-row:hover td { background: #1c1c26; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
        .modal { background: #16161f; border: 1px solid #2a2a38; border-radius: 16px; padding: 28px; width: 460px; max-width: 95vw; }
        .stat-card { background: #16161f; border: 1px solid #22222e; border-radius: 14px; padding: 20px 24px; }
        .accentbar { width: 3px; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e1e28", padding: "0 32px", display: "flex", alignItems: "center", gap: 32, height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: "#c8f04a", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#0f0f13" }}>E</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em", color: "#e8e6e1" }}>EOSTrack</span>
        </div>
        <nav style={{ display: "flex", gap: 4 }}>
          {[["dashboard", "Dashboard"], ["clients", "Clients"]].map(([v, l]) => (
            <div key={v} className={`nav-item ${view === v || (view === "client-detail" && v === "clients") ? "active" : ""}`} onClick={() => setView(v)}>{l}</div>
          ))}
        </nav>
        <div style={{ marginLeft: "auto" }}>
          <span style={{ fontSize: 12, color: "#4a4860" }}>Carlos · EOS Implementer</span>
        </div>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Dashboard</h1>
                <p style={{ fontSize: 13, color: "#5a5872", marginTop: 3 }}>Your earnings, deductions, and cash forecast at a glance.</p>
              </div>
              <button className="btn btn-primary" onClick={() => { setDashboardSessionClientId(""); setShowDashboardSession(true); }}>+ Add Session</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
              {[
                { label: "Total Gross Billed", value: fmt(stats.totalGross), accent: "#c8f04a", sub: "All sessions" },
                { label: "Total Net Payout", value: fmt(stats.totalNet), accent: "#60efb8", sub: "After all deductions" },
                { label: "Collected", value: fmt(stats.totalPaid), accent: "#60b4ef", sub: "Paid sessions only" },
                { label: "Outstanding", value: fmt(stats.totalUnpaid), accent: "#ef9f60", sub: "Unpaid sessions" },
                { label: "Travel Reimbursable", value: fmt(stats.totalTravel), accent: "#b060ef", sub: "Pass-through" },
                { label: "Monthly Retainer Income", value: fmt(stats.monthlyForecast), accent: "#ef60b0", sub: "Per month (retainer clients)" },
              ].map(s => (
                <div key={s.label} className="stat-card" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div className="accentbar" style={{ background: s.accent, height: 42, marginTop: 3 }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#5a5872", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: s.accent, letterSpacing: "-0.02em", fontFamily: "'DM Mono', monospace" }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "#3f3e52", marginTop: 2 }}>{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: "#9e9cb5" }}>ALL SESSIONS <span style={{ fontSize: 11, color: "#3a3a4a", fontWeight: 400 }}>— click a row to edit</span></div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #22222e" }}>
                    {["Date", "Client", "Session", "Gross", "Deduction", "Net Payout", "Travel", "Status"].map(h => (
                      <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "#4a4860", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.flatMap(client =>
                    client.sessions.map(s => {
                      const { referralDeduction, commissionDeduction, travelTotal, netPayout, referralLabel } = calcPayout(s, client);
                      const deduction = referralDeduction + commissionDeduction;
                      return (
                        <tr key={`${client.id}-${s.id}`} className="session-row" style={{ borderBottom: "1px solid #1a1a22" }}
                          onClick={() => setEditingSession({ clientId: client.id, session: { ...s } })}>
                          <td style={{ padding: "10px 10px", color: "#6b6986", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{s.date}</td>
                          <td style={{ padding: "10px 10px", fontWeight: 600, color: "#c8c5e0" }}>{client.name}</td>
                          <td style={{ padding: "10px 10px" }}><span style={{ fontSize: 12, color: s.type === "Focus Day" ? "#c8f04a" : "#9e9cb5" }}>{s.type}</span></td>
                          <td style={{ padding: "10px 10px", fontFamily: "'DM Mono', monospace" }}>{fmt(s.grossFee)}</td>
                          <td style={{ padding: "10px 10px" }}>
                            {deduction > 0 ? <span style={{ color: "#ef6060", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>-{fmt(deduction)} <span style={{ fontSize: 10, color: "#6b6986" }}>{referralLabel}</span></span> : <span style={{ color: "#3a3a4a" }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 10px", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#60efb8" }}>{fmt(netPayout)}</td>
                          <td style={{ padding: "10px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#6b6986" }}>{travelTotal > 0 ? fmt(travelTotal) : "—"}</td>
                          <td style={{ padding: "10px 10px" }} onClick={e => e.stopPropagation()}>
                            <select value={s.status} onChange={e => setSessionStatus(client.id, s.id, e.target.value)}
                              style={{ background: "#1e1e28", border: "1px solid #2a2a38", color: "#e8e6e1", borderRadius: 8, fontSize: 11, fontWeight: 600, padding: "3px 8px", cursor: "pointer", outline: "none" }}>
                              {["Invoiced","Pending","Received","Paid to EOSi"].map(st => <option key={st} value={st}>{st}</option>)}
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CLIENTS LIST */}
        {view === "clients" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Clients</h1>
                <p style={{ fontSize: 13, color: "#5a5872", marginTop: 3 }}>{clients.length} total clients</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <select className="input" style={{ width: "auto", fontSize: 12 }} value={filterSource} onChange={e => setFilterSource(e.target.value)}>
                  <option value="all">All Sources</option>
                  {LEAD_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <button className="btn btn-primary" onClick={() => setShowAddClient(true)}>+ Add Client</button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredClients.map(client => {
                const source = LEAD_SOURCES.find(s => s.id === client.leadSource);
                const monthly = calcMonthlyPayment(client);
                const totalNet = client.sessions.reduce((sum, s) => sum + calcPayout(s, client).netPayout, 0);
                const unpaidNet = client.sessions.filter(s => s.status === "Invoiced" || s.status === "Pending").reduce((sum, s) => sum + calcPayout(s, client).netPayout, 0);
                return (
                  <div key={client.id} className="card row-hover" style={{ cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 20 }}
                    onClick={() => { setSelectedClientId(client.id); setView("client-detail"); }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "#1e2a10", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, color: "#c8f04a", flexShrink: 0 }}>
                      {client.name[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#e8e6e1" }}>{client.name}</div>
                      <div style={{ fontSize: 12, color: "#5a5872", marginTop: 2 }}>{source?.label} · {client.paymentMethod} · {client.sessions.length} sessions</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#60efb8", fontSize: 15 }}>{fmt(totalNet)}</div>
                      <div style={{ fontSize: 11, color: "#5a5872" }}>net earned</div>
                    </div>
                    {unpaidNet > 0 && (
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#ef9f60", fontSize: 14 }}>{fmt(unpaidNet)}</div>
                        <div style={{ fontSize: 11, color: "#5a5872" }}>outstanding</div>
                      </div>
                    )}
                    {monthly && (
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#ef60b0" }}>{fmt(monthly)}/mo</div>
                        <div style={{ fontSize: 11, color: "#5a5872" }}>retainer</div>
                      </div>
                    )}
                    <span style={{ color: "#3a3a4a", fontSize: 16 }}>›</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CLIENT DETAIL */}
        {view === "client-detail" && selectedClient && (() => {
          const source = LEAD_SOURCES.find(s => s.id === selectedClient.leadSource);
          const monthly = calcMonthlyPayment(selectedClient);
          const totalGross = selectedClient.sessions.reduce((s, sess) => s + sess.grossFee, 0);
          const totalNet = selectedClient.sessions.reduce((s, sess) => s + calcPayout(sess, selectedClient).netPayout, 0);
          const totalDeductions = totalGross - totalNet;
          const paidNet = selectedClient.sessions.filter(s => s.status === "Received" || s.status === "Paid to EOSi").reduce((s, sess) => s + calcPayout(sess, selectedClient).netPayout, 0);
          return (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setView("clients")}>← Back</button>
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{selectedClient.name}</h1>
                <span style={{ fontSize: 12, background: "#1e2a10", color: "#c8f04a", padding: "3px 10px", borderRadius: 20, fontWeight: 700 }}>{source?.label}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                {[
                  { label: "Gross Billed", value: fmt(totalGross), color: "#c8f04a" },
                  { label: "Total Deductions", value: fmt(totalDeductions), color: "#ef6060" },
                  { label: "Net Earned", value: fmt(totalNet), color: "#60efb8" },
                  { label: "Collected", value: fmt(paidNet), color: "#60b4ef" },
                ].map(s => (
                  <div key={s.label} className="stat-card">
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#5a5872", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "'DM Mono', monospace" }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="card" style={{ marginBottom: 18, display: "flex", gap: 32, flexWrap: "wrap" }}>
                <div><span className="label">Payment</span><span style={{ fontSize: 13, color: "#c8c5e0" }}>{selectedClient.paymentMethod}</span></div>
                <div><span className="label">Session Rate</span><span style={{ fontSize: 13, color: "#c8c5e0", fontFamily: "'DM Mono', monospace" }}>{fmt(selectedClient.sessionRate)}</span></div>
                <div><span className="label">Annual Sessions</span><span style={{ fontSize: 13, color: "#c8c5e0" }}>{selectedClient.annualSessions}</span></div>
                {monthly && <div><span className="label">Monthly Payment</span><span style={{ fontSize: 13, color: "#ef60b0", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{fmt(monthly)}/mo</span></div>}
                <div><span className="label">Commission Rate</span><span style={{ fontSize: 13, color: "#c8c5e0" }}>{source?.commissionRate * 100}%{source?.focusDayFee > 0 ? " + 50% FD" : ""}</span></div>
                {selectedClient.implementer && <div><span className="label">Implementer</span><span style={{ fontSize: 13, color: "#c8c5e0" }}>{selectedClient.implementer}</span></div>}
                {selectedClient.notes && <div><span className="label">Notes</span><span style={{ fontSize: 13, color: "#6b6986" }}>{selectedClient.notes}</span></div>}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#9e9cb5", textTransform: "uppercase", letterSpacing: "0.06em" }}>Sessions <span style={{ fontSize: 11, color: "#3a3a4a", fontWeight: 400 }}>— click a row to edit</span></span>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddSession(true)}>+ Add Session</button>
              </div>
              <div className="card">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #22222e" }}>
                      {["Date", "Type", "Gross", "Deduction", "Net Payout", "Travel", "Status"].map(h => (
                        <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "#4a4860", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedClient.sessions.map(s => {
                      const { referralDeduction, commissionDeduction, travelTotal, netPayout, referralLabel } = calcPayout(s, selectedClient);
                      const deduction = referralDeduction + commissionDeduction;
                      return (
                        <tr key={s.id} className="session-row" style={{ borderBottom: "1px solid #1a1a22" }}
                          onClick={() => setEditingSession({ clientId: selectedClient.id, session: { ...s } })}>
                          <td style={{ padding: "10px 10px", color: "#6b6986", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{s.date}</td>
                          <td style={{ padding: "10px 10px" }}><span style={{ fontSize: 12, color: s.type === "Focus Day" ? "#c8f04a" : "#9e9cb5" }}>{s.type}</span></td>
                          <td style={{ padding: "10px 10px", fontFamily: "'DM Mono', monospace" }}>{fmt(s.grossFee)}</td>
                          <td style={{ padding: "10px 10px" }}>
                            {deduction > 0 ? <span style={{ color: "#ef6060", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>-{fmt(deduction)} <span style={{ fontSize: 10, color: "#5a5872" }}>{referralLabel}</span></span> : <span style={{ color: "#3a3a4a" }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 10px", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#60efb8" }}>{fmt(netPayout)}</td>
                          <td style={{ padding: "10px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#6b6986" }}>{travelTotal > 0 ? fmt(travelTotal) : "—"}</td>
                          <td style={{ padding: "10px 10px" }} onClick={e => e.stopPropagation()}>
                            <select value={s.status} onChange={e => setSessionStatus(selectedClient.id, s.id, e.target.value)}
                              style={{ background: "#1e1e28", border: "1px solid #2a2a38", color: "#e8e6e1", borderRadius: 8, fontSize: 11, fontWeight: 600, padding: "3px 8px", cursor: "pointer", outline: "none" }}>
                              {["Invoiced","Pending","Received","Paid to EOSi"].map(st => <option key={st} value={st}>{st}</option>)}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="modal-overlay" onClick={() => setShowAddClient(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Add New Client</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label className="label">Client Name</label><input className="input" value={newClient.name} onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))} placeholder="Company name" /></div>
              <div><label className="label">Lead Source</label>
                <select className="input" value={newClient.leadSource} onChange={e => setNewClient(p => ({ ...p, leadSource: e.target.value }))}>
                  {LEAD_SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="label">Session Rate ($)</label><input className="input" type="number" value={newClient.sessionRate} onChange={e => setNewClient(p => ({ ...p, sessionRate: e.target.value }))} placeholder="3500" /></div>
                <div><label className="label">Annual Sessions</label><input className="input" type="number" value={newClient.annualSessions} onChange={e => setNewClient(p => ({ ...p, annualSessions: e.target.value }))} /></div>
              </div>
              <div><label className="label">Payment Method</label>
                <select className="input" value={newClient.paymentMethod} onChange={e => setNewClient(p => ({ ...p, paymentMethod: e.target.value }))}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div><label className="label">Notes</label><input className="input" value={newClient.notes} onChange={e => setNewClient(p => ({ ...p, notes: e.target.value }))} placeholder="Optional" /></div>
              <div>
                <label className="label">Implementer</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <select className="input" value={newClient.implementer} onChange={e => setNewClient(p => ({ ...p, implementer: e.target.value }))}>
                    <option value="">— None —</option>
                    {implementers.map(i => <option key={i} value={i}>{i}</option>)}
                    <option value="__new__">+ Add new...</option>
                  </select>
                  {newClient.implementer === "__new__" && (
                    <input className="input" placeholder="Type name, press Enter"
                      onKeyDown={e => {
                        if (e.key === "Enter" && e.target.value.trim()) {
                          const name = e.target.value.trim();
                          setImplementers(p => [...p, name]);
                          setNewClient(p => ({ ...p, implementer: name }));
                        }
                      }} />
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button className="btn btn-ghost" onClick={() => setShowAddClient(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={addClient}>Add Client</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Session Modal */}
      {showAddSession && (
        <div className="modal-overlay" onClick={() => setShowAddSession(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Add Session — {selectedClient?.name}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="label">Session Type</label>
                  <select className="input" value={newSession.type} onChange={e => setNewSession(p => ({ ...p, type: e.target.value }))}>
                    {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="label">Date</label><input className="input" type="date" value={newSession.date} onChange={e => setNewSession(p => ({ ...p, date: e.target.value }))} /></div>
              </div>
              <div><label className="label">Gross Session Fee ($)</label><input className="input" type="number" value={newSession.grossFee} onChange={e => setNewSession(p => ({ ...p, grossFee: e.target.value }))} placeholder={selectedClient?.sessionRate} /></div>
              <div style={{ borderTop: "1px solid #1e1e28", paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#5a5872", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Travel (reimbursable)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div><label className="label">Airfare</label><input className="input" type="number" value={newSession.travelAirfare} onChange={e => setNewSession(p => ({ ...p, travelAirfare: e.target.value }))} placeholder="0" /></div>
                  <div><label className="label">Hotel</label><input className="input" type="number" value={newSession.travelHotel} onChange={e => setNewSession(p => ({ ...p, travelHotel: e.target.value }))} placeholder="0" /></div>
                  <div><label className="label">Per Diem ($200)</label><input className="input" type="number" value={newSession.travelPerDiem} onChange={e => setNewSession(p => ({ ...p, travelPerDiem: e.target.value }))} placeholder="200" /></div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button className="btn btn-ghost" onClick={() => setShowAddSession(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={addSession}>Add Session</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Add Session Modal */}
      {showDashboardSession && (
        <div className="modal-overlay" onClick={() => setShowDashboardSession(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Add Session</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="label">Client</label>
                <select className="input" value={dashboardSessionClientId} onChange={e => setDashboardSessionClientId(e.target.value)}>
                  <option value="">— Select a client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {dashboardSessionClientId && (() => {
                const client = clients.find(c => c.id === Number(dashboardSessionClientId));
                return (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div><label className="label">Session Type</label>
                        <select className="input" value={newSession.type} onChange={e => setNewSession(p => ({ ...p, type: e.target.value }))}>
                          {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div><label className="label">Date</label><input className="input" type="date" value={newSession.date} onChange={e => setNewSession(p => ({ ...p, date: e.target.value }))} /></div>
                    </div>
                    <div><label className="label">Gross Session Fee ($)</label><input className="input" type="number" value={newSession.grossFee} onChange={e => setNewSession(p => ({ ...p, grossFee: e.target.value }))} placeholder={client?.sessionRate} /></div>
                    <div style={{ borderTop: "1px solid #1e1e28", paddingTop: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#5a5872", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Travel (reimbursable)</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <div><label className="label">Airfare</label><input className="input" type="number" value={newSession.travelAirfare} onChange={e => setNewSession(p => ({ ...p, travelAirfare: e.target.value }))} placeholder="0" /></div>
                        <div><label className="label">Hotel</label><input className="input" type="number" value={newSession.travelHotel} onChange={e => setNewSession(p => ({ ...p, travelHotel: e.target.value }))} placeholder="0" /></div>
                        <div><label className="label">Per Diem ($200)</label><input className="input" type="number" value={newSession.travelPerDiem} onChange={e => setNewSession(p => ({ ...p, travelPerDiem: e.target.value }))} placeholder="200" /></div>
                      </div>
                    </div>
                  </>
                );
              })()}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button className="btn btn-ghost" onClick={() => { setShowDashboardSession(false); setNewSession(emptySession); }}>Cancel</button>
                <button className="btn btn-primary"
                  disabled={!dashboardSessionClientId || !newSession.date || !newSession.grossFee}
                  style={{ opacity: (!dashboardSessionClientId || !newSession.date || !newSession.grossFee) ? 0.4 : 1 }}
                  onClick={() => {
                    const sessionId = Date.now();
                    setClients(prev => prev.map(c => c.id === Number(dashboardSessionClientId)
                      ? { ...c, sessions: [...c.sessions, { ...newSession, id: sessionId, grossFee: Number(newSession.grossFee), travelAirfare: Number(newSession.travelAirfare || 0), travelHotel: Number(newSession.travelHotel || 0), travelPerDiem: Number(newSession.travelPerDiem || 0) }] }
                      : c
                    ));
                    setNewSession(emptySession);
                    setShowDashboardSession(false);
                  }}>Add Session</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {editingSession && (
        <div className="modal-overlay" onClick={() => setEditingSession(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Edit Session</h2>
            <p style={{ fontSize: 12, color: "#5a5872", marginBottom: 20 }}>{clients.find(c => c.id === editingSession.clientId)?.name}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="label">Session Type</label>
                  <select className="input" value={editingSession.session.type} onChange={e => setEditingSession(p => ({ ...p, session: { ...p.session, type: e.target.value } }))}>
                    {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="label">Date</label><input className="input" type="date" value={editingSession.session.date} onChange={e => setEditingSession(p => ({ ...p, session: { ...p.session, date: e.target.value } }))} /></div>
              </div>
              <div><label className="label">Gross Session Fee ($)</label><input className="input" type="number" value={editingSession.session.grossFee} onChange={e => setEditingSession(p => ({ ...p, session: { ...p.session, grossFee: e.target.value } }))} /></div>
              <div><label className="label">Status</label>
                <select className="input" value={editingSession.session.status || "Invoiced"} onChange={e => setEditingSession(p => ({ ...p, session: { ...p.session, status: e.target.value } }))}>
                  {["Invoiced","Pending","Received","Paid to EOSi"].map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
              <div style={{ borderTop: "1px solid #1e1e28", paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#5a5872", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Travel (reimbursable)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div><label className="label">Airfare</label><input className="input" type="number" value={editingSession.session.travelAirfare} onChange={e => setEditingSession(p => ({ ...p, session: { ...p.session, travelAirfare: e.target.value } }))} /></div>
                  <div><label className="label">Hotel</label><input className="input" type="number" value={editingSession.session.travelHotel} onChange={e => setEditingSession(p => ({ ...p, session: { ...p.session, travelHotel: e.target.value } }))} /></div>
                  <div><label className="label">Per Diem</label><input className="input" type="number" value={editingSession.session.travelPerDiem} onChange={e => setEditingSession(p => ({ ...p, session: { ...p.session, travelPerDiem: e.target.value } }))} /></div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 4 }}>
                <button className="btn btn-danger" onClick={() => {
                  setClients(prev => prev.map(c => c.id === editingSession.clientId
                    ? { ...c, sessions: c.sessions.filter(s => s.id !== editingSession.session.id) }
                    : c
                  ));
                  setEditingSession(null);
                }}>Delete Session</button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost" onClick={() => setEditingSession(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveEditedSession}>Save Changes</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
