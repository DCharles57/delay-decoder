const form = document.getElementById("delayForm");
const result = document.getElementById("result");
const statusDot = document.getElementById("statusDot");
const actionEl = document.getElementById("action");
const whyTextEl = document.getElementById("whyText");
const whyMetaEl = document.getElementById("whyMeta");
const reasonsWrap = document.getElementById("reasons");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const recentWrap = document.getElementById("recent");

let DATA = null;
let selectedReason = null;

// --- Load "API" data ---
async function loadData(){
  const res = await fetch("./delays.json");
  DATA = await res.json();
  renderReasons(DATA.reasons);
  renderRecent();
}

function renderReasons(reasons){
  reasonsWrap.innerHTML = "";
  reasons.forEach(r => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "track-btn";
    btn.dataset.id = r.id;
    btn.innerHTML = `<span>${r.label}</span>`;
    btn.addEventListener("click", () => {
      // toggle select
      const isSelected = btn.classList.contains("selected");
      document.querySelectorAll(".track-btn").forEach(b => b.classList.remove("selected"));
      if (!isSelected){
        btn.classList.add("selected");
        selectedReason = r;
      } else {
        selectedReason = null;
      }
    });
    reasonsWrap.appendChild(btn);
  });
}

function getRuleFor(inputs){
  // Try to find matching pattern record; fallback to generic logic
  const found = DATA.patterns.find(p =>
    p.line === inputs.line &&
    p.timeOfDay === inputs.timeOfDay &&
    p.dayType === inputs.dayType
  );

  const rules = found?.rules ?? [
    { min: 0, max: 0, status: "green", action: "All good—stay put.", why: "No delay reported. Normal service is likely." },
    { min: 1, max: 9, status: "yellow", action: "Wait it out.", why: "Short delays usually clear quickly." },
    { min: 10, max: 30, status: "yellow", action: "Wait 5–10 mins, then reassess.", why: "Moderate delays can turn into bunching depending on conditions." },
    { min: 31, max: 999, status: "red", action: "Reroute now.", why: "Severe delays are more likely to persist—don’t donate more time." }
  ];

  const m = inputs.minutes;
  return rules.find(r => m >= r.min && m <= r.max) ?? rules[rules.length - 1];
}

function applyStatus(status){
  const colors = {
    green: getComputedStyle(document.documentElement).getPropertyValue("--green").trim(),
    yellow: getComputedStyle(document.documentElement).getPropertyValue("--yellow").trim(),
    red: getComputedStyle(document.documentElement).getPropertyValue("--red").trim()
  };
  statusDot.style.background = colors[status] || colors.yellow;

  // Optional: subtle “emergency” vibe for red
  if (status === "red"){
    statusDot.style.boxShadow = "0 0 0 6px rgba(220,38,38,.18)";
  } else if (status === "yellow"){
    statusDot.style.boxShadow = "0 0 0 6px rgba(245,158,11,.18)";
  } else {
    statusDot.style.boxShadow = "0 0 0 6px rgba(22,163,74,.18)";
  }
}

function buildMeta(inputs){
  const reasonText = selectedReason ? `Reason selected: ${selectedReason.label}.` : "No reason selected.";
  return `Line ${inputs.line} • ${inputs.minutes} min • ${inputs.timeOfDay} • ${inputs.dayType}. ${reasonText}`;
}

function showResult(rule, inputs){
  applyStatus(rule.status);

  actionEl.textContent = rule.action;

  // Keep explanation short; let user expand it
  const reasonAddon = selectedReason
    ? ` This often aligns with “${selectedReason.label}” related disruptions.`
    : "";

  whyTextEl.textContent = rule.why + reasonAddon;
  whyMetaEl.textContent = buildMeta(inputs);

  result.classList.remove("hidden");
  result.scrollIntoView({ behavior: "smooth", block: "start" });
}

// --- "Database" (persistence) via localStorage ---
const KEY = "delayDecoder_recent";

function saveToDB(entry){
  const existing = JSON.parse(localStorage.getItem(KEY) || "[]");
  existing.unshift(entry);
  const trimmed = existing.slice(0, 5);
  localStorage.setItem(KEY, JSON.stringify(trimmed));
  renderRecent();
}

function renderRecent(){
  const items = JSON.parse(localStorage.getItem(KEY) || "[]");
  if (items.length === 0){
    recentWrap.innerHTML = `<p class="sub">Recent saves will show up here.</p>`;
    return;
  }
  recentWrap.innerHTML = `<h3 style="margin:0 0 6px;font-size:14px;color:rgba(71,85,105,.95);">Recent</h3>`;
  items.forEach(it => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <div style="font-weight:750;">${it.action}</div>
        <div style="color:rgba(71,85,105,.9);font-size:12px;margin-top:2px;">${it.meta}</div>
      </div>
      <span class="badge">${it.status.toUpperCase()}</span>
    `;
    recentWrap.appendChild(div);
  });
}

// --- Events ---
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!DATA) return;

  const inputs = {
    line: document.getElementById("line").value,
    minutes: Number(document.getElementById("minutes").value),
    timeOfDay: document.getElementById("timeOfDay").value,
    dayType: document.getElementById("dayType").value
  };

  const rule = getRuleFor(inputs);
  showResult(rule, inputs);

  // Stash last run in memory for Save button
  saveBtn.dataset.last = JSON.stringify({ inputs, rule });
});

saveBtn.addEventListener("click", () => {
  const last = saveBtn.dataset.last;
  if (!last) return;
  const { inputs, rule } = JSON.parse(last);
  const entry = {
    status: rule.status,
    action: rule.action,
    why: rule.why,
    meta: buildMeta(inputs),
    ts: Date.now()
  };
  saveToDB(entry);
});

clearBtn.addEventListener("click", () => {
  result.classList.add("hidden");
  form.reset();
  selectedReason = null;
  document.querySelectorAll(".track-btn").forEach(b => b.classList.remove("selected"));
});

// Boot
loadData().catch(err => {
  console.error(err);
  alert("Could not load delays.json. Make sure you’re running Live Server.");
});
