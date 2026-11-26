// Builds the phone mockups. Each direction (a, b or c) differs in its navigation,
// search, pipeline and form; the content is the shared sample data.
Object.assign(ICONS, {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  move: '<path d="M4 12h12M12 6l6 6-6 6"/><path d="M20 5v14"/>',
});

const STATUS_BAR = '<div class="status"><span>9:41</span><span>●●● ▮</span></div>';
const SECTIONS = { dash: "Dashboard", pipe: "Pipeline", deal: "Deals", contact: "Contacts", org: "Organizations" };

function tabbar(active, withPlus) {
  const keys = withPlus ? ["dash", "pipe", "+", "contact", "more"] : ["dash", "pipe", "deal", "contact", "org"];
  return `<nav class="tabbar">${keys
    .map((k) => {
      if (k === "+") return `<div class="plus"><span>${icon("plus", 24)}</span></div>`;
      if (k === "more") return `<a><span class="pip">${icon("more", 22)}</span>More</a>`;
      const label = k === "org" ? "Orgs" : SECTIONS[k];
      return `<a class="${k === active ? "on" : ""}"><span class="pip">${icon(k, 22)}</span>${label}</a>`;
    })
    .join("")}</nav>`;
}

function rail(active) {
  return `<nav class="rail">${Object.keys(SECTIONS)
    .map((k) => `<a class="${k === active ? "on" : ""}">${icon(k, 22)}${k === "org" ? "Orgs" : SECTIONS[k]}</a>`)
    .join("")}<div style="flex:1"></div><div class="avatar">TU</div></nav>`;
}

function topbar(v, title) {
  if (v === "b")
    return `<div class="top"><span class="icon-btn filled">${icon("menu", 22)}</span><h1>${title}</h1><span class="avatar-hit"><span class="avatar">TU</span></span></div>
      <div class="searchbar">${icon("search", 18)}Search organizations, contacts and deals</div>`;
  if (v === "c")
    return `<div class="searchbar" style="margin-top:6px">${icon("search", 18)}<span style="flex:1">Search</span><span class="avatar">TU</span></div>
      <div class="top" style="padding-top:0"><h1>${title}</h1></div>`;
  return `<div class="top"><h1>${title}</h1><span class="icon-btn filled">${icon("search", 20)}</span><span class="avatar-hit"><span class="avatar">TU</span></span></div>`;
}

function bottom(v, active) {
  if (v === "a") return tabbar(active, false);
  if (v === "c") return tabbar(active, true);
  return "";
}

function phone(inner, label, land = false) {
  return `<div><p class="frame-label">${label}</p><div class="phone ${land ? "land" : ""}">${inner}</div></div>`;
}

function dashboard(v) {
  const open = sum(OPEN, (d) => d.value);
  const tiles = [
    ["Open pipeline", money(open), OPEN.length + " open deals"],
    ["Expected revenue", money(sum(OPEN, expected)), "weighted by stage"],
    ["Won this month", money(REVENUE_WON[11]), DEALS_WON[11] + " deals"],
    ["Follow-ups", "3 overdue", "3 this week"],
  ];
  const fups = FOLLOW_UPS.slice(0, 4)
    .map(
      (f) => `<div class="list-item"><span class="ic">${icon(f.type, 18)}</span><div class="main"><div class="t">${f.label}</div><div class="s">${f.who}</div></div><span class="chip ${f.overdue ? "overdue" : "upcoming"}">${shortDate(f.due)}</span></div>`,
    )
    .join("");
  return `${STATUS_BAR}<div class="screen">${topbar(v, "Dashboard")}
    <div class="content">
      <div class="tiles">${tiles.map((t) => `<div class="panel tile"><div class="lbl">${t[0]}</div><div class="v">${t[1]}</div><div class="n">${t[2]}</div></div>`).join("")}</div>
      <div class="panel"><h2>Revenue won <span class="muted" style="font:500 12px var(--mono)">12 months</span></h2>${lineChart({ values: REVENUE_WON, labels: MONTHS.map((m, i) => (i % 3 === 2 ? m : "")), w: 330, h: 150, grid: "var(--line)" })}</div>
      <div class="panel"><h2>Follow-ups <span class="muted" style="font-size:12px;font-weight:500">See all</span></h2>${fups}</div>
    </div></div>${bottom(v, "dash")}`;
}

function contact(v) {
  const items = [
    ["call", "Call: agreed pricing for 3 sites", "Today, 09:15", "Test User"],
    ["stage", "Enterprise renewal moved to Negotiation", "Today", ""],
    ["email", "Email: sent the revised quote", "12 Nov", "Test User"],
    ["note", "Note: wants a phased rollout", "4 Nov", "Sam Lee"],
  ]
    .map(
      (i) => `<div class="list-item"><span class="ic">${icon(i[0], 18)}</span><div class="main"><div style="font-weight:500">${i[1]}</div><div class="when">${i[2]}${i[3] ? " · " + i[3] : ""}</div></div></div>`,
    )
    .join("");
  const head =
    v === "b"
      ? `<div class="top"><span class="icon-btn filled">${icon("left", 22)}</span><h1>Contact</h1><span class="icon-btn filled">${icon("more", 22)}</span></div>`
      : `<div class="top"><span class="icon-btn filled">${icon("left", 22)}</span><span style="flex:1"></span><span class="icon-btn filled">${icon("more", 22)}</span></div>`;
  return `${STATUS_BAR}<div class="screen">${head}
    <div class="content">
      <div class="record-head"><div class="name">Tom Becker</div><div class="muted">Head of Operations · <a>Brightwater Energy</a></div><div style="margin-top:8px"><span class="pill customer">Customer</span></div></div>
      <div class="actions"><span class="btn ghost">${icon("call", 18)}Call</span><span class="btn ghost">${icon("email", 18)}Email</span><span class="btn">${icon("plus", 18)}Log activity</span></div>
      <div class="panel"><h2>Deals <span class="muted" style="font-size:12px;font-weight:500">2</span></h2>
        <div class="list-item"><div class="main"><div class="t">Enterprise renewal</div><div class="s">Negotiation · Close 28 Nov 2026</div></div><span class="mono">$68,000</span></div>
        <div class="list-item"><div class="main"><div class="t">Annual licence</div><div class="s">Qualified · Close 30 Jan 2027</div></div><span class="mono">$42,000</span></div></div>
      <div class="panel timeline"><h2>Timeline</h2>${items}</div>
    </div></div>${bottom(v, "contact")}`;
}

function dealCard(d, v) {
  const s = STAGES.find((x) => x.key === d.stage);
  const move = v === "b" ? "" : `<span class="move-btn">${icon("move", 14)}Move to</span>`;
  return `<div class="card"><div class="t">${d.name}</div><div class="o">${d.org} · ${d.contact}</div>
    <div class="r"><span class="v">${money(d.value)}</span><span class="ring" style="--p:${d.prob};--c:${s.color}"><span>${d.prob}%</span></span></div>
    <div class="r" style="margin-top:8px"><span class="muted">Close ${fmtDate(d.close)} ${isLate(d) ? '<span class="late">Late</span>' : ""}</span>${move}${v === "b" ? `<span class="icon-btn" style="width:36px;height:36px">${icon("more", 18)}</span>` : ""}</div></div>`;
}

function pipeline(v) {
  const stage = STAGES[3];
  const ds = dealsIn(stage.key);
  let picker;
  if (v === "a")
    picker = `<div class="stage-tabs">${STAGES.slice(1, 5)
      .map((s) => `<span class="stage-tab ${s.key === stage.key ? "on" : ""}"><span class="dot" style="background:${s.color}"></span>${s.name}<span class="count">${dealsIn(s.key).length}</span></span>`)
      .join("")}</div>`;
  else if (v === "b")
    picker = `<div class="stepper"><span class="icon-btn filled">${icon("left", 20)}</span><span class="sel"><span style="display:flex;gap:8px;align-items:center"><span class="dot" style="background:${stage.color}"></span>${stage.name} · ${ds.length}</span>${icon("down", 18)}</span><span class="icon-btn filled">${icon("right", 20)}</span></div>`;
  else picker = `<div class="dots">${STAGES.map((s) => `<i class="${s.key === stage.key ? "on" : ""}"></i>`).join("")}</div>`;
  const sheetOpts = STAGES.map(
    (s) => `<div class="opt ${s.key === "won" ? "on" : ""}"><span class="dot" style="background:${s.color}"></span>${s.name}${s.key === stage.key ? '<span class="muted" style="margin-left:6px">(now)</span>' : ""}${s.key === "won" ? `<span class="tick">${icon("check", 18)}</span>` : ""}</div>`,
  ).join("");
  const sheet =
    v === "b"
      ? `<div class="scrim"></div><div class="sheet"><div class="grab"></div><h3>Mobile app</h3><p class="muted" style="margin:0 0 8px">Alder &amp; Finch</p>
         <div class="opt">${icon("right", 18)}Open deal</div><div class="opt">${icon("deal", 18)}Edit</div><div class="opt on">${icon("move", 18)}Move to stage<span class="tick" style="color:var(--ink-muted)">${icon("right", 18)}</span></div><div class="opt">${icon("plus", 18)}Log activity</div></div>`
      : `<div class="scrim"></div><div class="sheet"><div class="grab"></div><h3>Move "Mobile app" to</h3><p class="muted" style="margin:0 0 8px">It goes to the top of that stage.</p>${sheetOpts}</div>`;
  return `${STATUS_BAR}<div class="screen">${topbar(v, "Pipeline")}${v === "c" ? `<div class="stage-head" style="padding:0 16px 6px"><span class="t"><span class="dot" style="background:${stage.color}"></span>${stage.name} · ${ds.length}</span><span class="stage-sum">${money(sum(ds, (d) => d.value))}</span></div>` : ""}${picker}
    <div class="content">${v !== "c" ? `<div class="stage-head"><span class="stage-sum">Total ${money(sum(ds, (d) => d.value))}</span><span class="stage-sum">exp. ${money(sum(ds, expected))}</span></div>` : ""}
      ${ds.map((d) => dealCard(d, v)).join("")}</div>
    ${sheet}</div>${bottom(v, "pipe")}`;
}

function logForm(v) {
  const head =
    v === "b"
      ? `<div class="top"><span class="icon-btn filled">${icon("left", 22)}</span><h1>Log activity</h1></div>`
      : `<div class="top"><h1>Log activity</h1><span class="icon-btn filled">${icon("x", 22)}</span></div>`;
  const foot =
    v === "a"
      ? `<div class="form-foot"><span class="btn ghost">Cancel</span><span class="btn">Save</span></div>`
      : v === "b"
        ? `<div class="form-foot"><span class="btn block">Save activity</span></div>`
        : `<div class="form-foot"><span class="btn block">Save</span></div>`;
  return `${STATUS_BAR}<div class="screen">${head}
    <div class="form">
      <div class="muted">For Tom Becker · Enterprise renewal</div>
      <div class="field"><label>Type</label><div class="seg"><span class="on">Call</span><span>Email</span><span>Note</span></div></div>
      <div class="field"><label>What happened *</label><div class="input area">Agreed pricing for 3 sites. Wants the contract by Friday.</div></div>
      <div class="field"><label>Date</label><div class="input mono">16 Nov 2026</div></div>
      <div class="field"><label>Follow-up</label><div class="input">Send the contract</div></div>
      <div class="field"><label>Follow-up date</label><div class="input mono" style="display:flex;justify-content:space-between">20 Nov 2026<span class="muted">${icon("down", 18)}</span></div></div>
    </div>${foot}</div>`;
}

function landscape(v) {
  const rows = [
    ["Tom Becker", "Brightwater Energy", "customer"],
    ["Maya Lin", "Harbor Freight Co.", "qualified"],
    ["Priya Shah", "Alder & Finch", "lead"],
    ["Omar Haddad", "Northwind Clinics", "customer"],
    ["Sara Novak", "Bluepeak Logistics", "qualified"],
    ["Grace Okafor", "Northwind Clinics", "lead"],
  ];
  const item = (r) =>
    `<div class="list-item"><div class="main"><div class="t">${r[0]}</div><div class="s">${r[1]}</div></div><span class="pill ${r[2]}">${r[2][0].toUpperCase() + r[2].slice(1)}</span><span class="chev">${icon("right", 18)}</span></div>`;
  const filters = `<div style="display:flex;gap:8px;flex:none">${["All 48", "Lead 17", "Qualified 14", "Customer 17"].map((f, i) => `<span class="stage-tab ${i ? "" : "on"}" style="height:36px">${f}</span>`).join("")}</div>`;
  const lists = `<div class="panel" style="padding:4px 14px">${rows.slice(0, 3).map(item).join("")}</div><div class="panel" style="padding:4px 14px">${rows.slice(3).map(item).join("")}</div>`;
  if (v === "a")
    return `${rail("contact")}<div class="screen"><div class="top" style="padding-top:12px"><h1>Contacts</h1>${filters}<span class="icon-btn filled">${icon("search", 20)}</span><span class="btn">${icon("plus", 16)}Add</span></div><div class="content two">${lists}</div></div>`;
  if (v === "b")
    return `<div class="screen"><div class="top" style="padding-top:12px"><span class="icon-btn filled">${icon("menu", 22)}</span><h1>Contacts</h1><div class="searchbar" style="margin:0;width:300px">${icon("search", 18)}Search</div><span class="avatar">TU</span></div><div style="padding:0 16px 10px">${filters}</div><div class="content two">${lists}</div></div>`;
  return `<div class="screen"><div class="top" style="padding-top:12px"><h1>Contacts</h1>${filters}<div class="searchbar" style="margin:0;width:180px">${icon("search", 18)}Search</div></div><div class="content two">${lists}</div>${tabbar("contact", true).replace('class="tabbar"', 'class="tabbar" style="padding-bottom:6px"')}</div>`;
}

function navigation(v) {
  if (v === "b")
    return `${STATUS_BAR}<div class="screen">${topbar(v, "Dashboard")}<div class="content"><div class="tiles"><div class="panel tile" style="height:90px"></div><div class="panel tile"></div></div></div>
      <div class="scrim"></div><div class="drawer"><div class="brand">Accountable</div>${Object.keys(SECTIONS)
        .map((k) => `<a class="${k === "contact" ? "on" : ""}">${icon(k, 20)}${SECTIONS[k]}</a>`)
        .join("")}</div></div>`;
  const items =
    v === "c"
      ? `<div class="opt">${icon("deal", 20)}Deals</div><div class="opt">${icon("org", 20)}Organizations</div><div class="grab" style="width:100%;height:1px;margin:8px 0"></div><div class="opt"><span class="avatar">TU</span>Test User<span class="muted" style="margin-left:auto;font-size:13px">test@accountable.local</span></div><div class="opt">Theme<span class="muted" style="margin-left:auto">Dark</span></div><div class="opt">Sign out</div>`
      : `<div class="opt"><span class="avatar">TU</span>Test User<span class="muted" style="margin-left:auto;font-size:13px">test@accountable.local</span></div><div class="seg" style="margin:8px 0"><span>Light</span><span class="on">Dark</span><span>System</span></div><div class="opt">Sign out</div>`;
  const title = v === "c" ? "More" : "Account";
  return `${STATUS_BAR}<div class="screen">${topbar(v, "Contacts")}<div class="content"></div><div class="scrim"></div><div class="sheet" style="bottom:0"><div class="grab"></div><h3>${title}</h3>${items}</div></div>${bottom(v, "contact")}`;
}

function renderDirection(v, title, sub) {
  document.body.innerHTML = `<h1 class="sheet-title">${title}</h1><p class="sheet-sub">${sub}</p>
    <div class="row">${phone(dashboard(v), "Dashboard")}${phone(contact(v), "Contact record")}${phone(pipeline(v), "Pipeline, moving a deal")}${phone(logForm(v), "Log activity")}</div>
    <div class="row">${phone(navigation(v), v === "b" ? "Menu" : v === "c" ? "More" : "Account menu")}${phone(landscape(v), "Contacts in landscape", true)}</div>`;
}
