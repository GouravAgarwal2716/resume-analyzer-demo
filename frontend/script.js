/********************
 * BASIC AUTH & NAV *
 ********************/

// Login page logic
document.getElementById("loginForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) return;
  localStorage.setItem("userEmail", email);
  localStorage.setItem("loggedIn", "true");
  window.location.href = "dashboard.html";
});

document.getElementById("demoCandidate")?.addEventListener("click", () => {
  localStorage.setItem("userEmail", "demo@candidate.dev");
  localStorage.setItem("loggedIn", "true");
  window.location.href = "dashboard.html";
});
document.getElementById("demoRecruiter")?.addEventListener("click", () => {
  localStorage.setItem("userEmail", "demo@recruiter.dev");
  localStorage.setItem("loggedIn", "true");
  window.location.href = "dashboard.html";
});

// On dashboard, enforce auth and set user badge
if (location.pathname.endsWith("dashboard.html")) {
  if (localStorage.getItem("loggedIn") !== "true") location.href = "index.html";
  const badge = document.getElementById("userBadge");
  if (badge) badge.textContent = localStorage.getItem("userEmail") || "";
}

function logout() {
  localStorage.removeItem("loggedIn");
  localStorage.removeItem("userEmail");
  location.href = "index.html";
}

// Sidebar nav
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.getAttribute("data-target");
    document.querySelectorAll(".section").forEach(sec => sec.classList.add("hidden"));
    document.getElementById(target).classList.remove("hidden");
  });
});

/***********************
 * TOAST / TOUR / HELP *
 ***********************/
function toast(msg, ok=true) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.style.background = ok ? 'var(--brand)' : '#ef4444';
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 2800);
}

function startTour() {
  toast("Step 1: Upload or paste your resume.", true);
  setTimeout(()=>toast("Step 2: Open ATS Analyzer to see score & keywords.", true), 2900);
  setTimeout(()=>toast("Step 3: Visit Job Matches to apply.", true), 5800);
  setTimeout(()=>toast("Step 4: See Smart Tips & Career Roadmap.", true), 8700);
}

/****************************
 * RESUME INPUT (UPLOAD/PASTE)
 ****************************/
let resumeText = "";   // normalized resume text used by analyzer
let lastAnalysis = null;

async function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Support any format: .pdf, .docx, .txt etc. Upload to backend for parsing.
  const formData = new FormData();
  formData.append("resume", file);

  try {
    toast("Uploading and parsing resume...", true);
    const res = await fetch("http://localhost:5000/api/resume/upload", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(()=>({error:'server error'}));
      toast("Parsing failed: " + (err.error || res.statusText), false);
      return;
    }

    const data = await res.json();
    // backend returns { text: "...", skills: [...] } or { text, preview, skills }
    resumeText = data.text || data.preview || "";
    document.getElementById("uploadStatus").textContent = `Loaded: ${file.name}`;
    storeHistory({ type:"upload", name:file.name, length: (resumeText||"").length });
    toast("Resume parsed. Now open ATS Analyzer.", true);
  } catch (err) {
    console.error(err);
    toast("Upload/parse error. Is backend running?", false);
  }
}

function handleDrop(event) {
  event.preventDefault();
  const file = event.dataTransfer.files?.[0];
  if (!file) return;
  document.getElementById('fileInput').files = event.dataTransfer.files; // sync input
  handleFile({ target: { files: [file] } });
}

function usePasted() {
  const txt = document.getElementById("pasteArea").value.trim();
  if (!txt) return toast("Paste some text first.", false);
  resumeText = txt;
  document.getElementById("uploadStatus").textContent = "Loaded: pasted text";
  storeHistory({ type:"paste", name:"pasted_text", length:resumeText.length });
  toast("Resume text captured. Open ATS Analyzer.", true);
}
function clearPasted() {
  document.getElementById("pasteArea").value = "";
}

/*****************
 * LOAD DICTIONARY
 *****************/
let DICT = {};
fetch("keywords.json").then(r=>r.json()).then(json => { DICT = json; });

/*****************
 * ATS ANALYZER  *
 *****************/
const roleSelect = document.getElementById("targetRole");
roleSelect?.addEventListener("change", () => analyze());

function normalize(s){ return (s||"").toLowerCase(); }

async function analyze() {
  if (!resumeText) { toast("Upload or paste your resume first.", false); return; }

  const role = roleSelect?.value || "General (All)";
  // Build keyword set: General + role specific (if selected)
  let keys = new Set(DICT["General"] || []);
  if (role && role !== "General (All)" && DICT[role]) {
    DICT[role].forEach(k => keys.add(k));
  } else {
    // include all role dictionaries lightly for generic evaluation
    Object.keys(DICT).forEach(group=>{
      if (group !== "General") (DICT[group]||[]).forEach(k=>keys.add(k));
    });
  }
  const keyArr = [...keys];
  const text = normalize(resumeText);

  const found = [];
  const missing = [];
  keyArr.forEach(k => {
    if (text.includes(normalize(k))) found.push(k); else missing.push(k);
  });

  // Score: weighted by found / total with small penalty if resume is very short
  let score = Math.round((found.length / (found.length + missing.length)) * 100);
  if (resumeText.length < 800) score = Math.max(0, score - 10);
  updateScore(score);
  renderChips(found, missing);

  lastAnalysis = { role, found, missing, score, ts: Date.now() };
  storeHistory({ type:"analysis", role, score, found:found.length, missing:missing.length });

  // Auto-refresh jobs/tips/roadmap
  await renderJobs(found);      // now calls backend LinkedIn job fetch
  renderTips(found, missing, score, role);
  renderRoadmap(missing, role);

  toast("Analysis updated.", true);
}

function updateScore(score){
  const bar = document.getElementById("scoreBar");
  const lab = document.getElementById("scoreLabel");
  if (!bar || !lab) return;
  bar.style.width = `${score}%`;
  bar.style.background = score >= 75 ? "#10b981" : score >= 55 ? "#f59e0b" : "#ef4444";
  lab.textContent = `${score}/100`;
}

function renderChips(found, missing){
  const f = document.getElementById("foundList");
  const m = document.getElementById("missingList");
  if (!f || !m) return;
  f.innerHTML = ""; m.innerHTML = "";
  found.slice().sort().forEach(k=>{
    const el = document.createElement("span");
    el.className = "chip good"; el.textContent = k; f.appendChild(el);
  });
  missing.slice().sort().forEach(k=>{
    const el = document.createElement("span");
    el.className = "chip bad"; el.textContent = k; m.appendChild(el);
  });
}

/*****************
 * ONE-CLICK SUMMARY
 *****************/
function sentenceCase(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
function generateSummary(){
  if (!lastAnalysis) return toast("Run ATS Analyzer first.", false);
  const { role, found, score } = lastAnalysis;
  const highlights = found.slice(0,6).join(", ");
  const impact = score >= 75 ? "proven track record" :
                 score >= 55 ? "hands-on experience" : "growing expertise";
  const template = `Results-driven ${role === "General (All)" ? "professional" : role.toLowerCase()} with ${impact} in ${highlights}. Adept at cross-functional collaboration, delivering measurable outcomes, and continuously improving through data-driven decisions. Seeking opportunities to add value in a high-impact team.`;
  document.getElementById("summaryBox").value = sentenceCase(template);
  toast("Tailored summary generated.", true);
}

/*****************
 * JOB MATCHER    *
 * Now calls backend LinkedIn job fetch endpoint.
 *****************/
let JOBS = []; // will be replaced by backend-sourced jobs

async function renderJobs(found){
  const grid = document.getElementById("jobGrid");
  const empty = document.getElementById("jobEmpty");
  if (!grid || !empty) return;

  if (!found || found.length === 0) {
    grid.innerHTML = ""; empty.classList.remove("hidden"); return;
  }

  // Call backend for LinkedIn jobs (POST with skills array)
  try {
    const res = await fetch("http://localhost:5000/api/jobs/linkedin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skills: found.slice(0,6) })
    });
    if (!res.ok) {
      // fallback to local JOBS.json (if present) or empty
      const fallback = await fetch("jobs.json").then(r=>r.ok? r.json(): []);
      JOBS = fallback;
    } else {
      const payload = await res.json();
      // backend returns array of { title, company, link, skills? }
      JOBS = payload.jobs || payload;
    }
  } catch (err) {
    console.error("Job fetch error:", err);
    const fallback = await fetch("jobs.json").then(r=>r.ok? r.json(): []);
    JOBS = fallback;
  }

  // Score jobs based on found keywords vs job.skills if job.skills provided, else simple match scoring
  const scored = JOBS.map(job=>{
    const jobSkills = job.skills || job.required_skills || [];
    const score = jobSkills.length ? jobSkills.filter(s => found.includes(s)).length : 1;
    const pct = jobSkills.length ? Math.round((score / jobSkills.length) * 100) : 50;
    return { ...job, match: score, pct };
  }).filter(j => j.match > 0 || (j.pct && j.pct>0))
    .sort((a,b) => b.pct - a.pct)
    .slice(0,9);

  grid.innerHTML = scored.map(j => `
    <div class="rounded-xl bg-white shadow-sm p-4 border border-indigo-50">
      <div class="flex items-start justify-between">
        <div>
          <h3 class="font-semibold">${j.title}</h3>
          <p class="text-sm text-gray-600">${j.company || j.employer_name || j.company_name || ""}</p>
        </div>
        <span class="text-xs px-2 py-1 rounded-full ${j.pct>=70?'bg-emerald-100 text-emerald-700': j.pct>=40?'bg-amber-100 text-amber-700':'bg-rose-100 text-rose-700'}">${j.pct}% match</span>
      </div>
      <p class="mt-2 text-xs text-gray-500">Requires: ${ (j.skills||j.required_skills||[]).slice(0,5).join(", ") }</p>
      <a href="${j.link || j.job_apply_url || j.job_url}" target="_blank" class="btn-secondary mt-3 inline-block">Apply on LinkedIn</a>
    </div>
  `).join("");

  empty.classList.toggle("hidden", scored.length>0);
}

/*****************
 * SMART TIPS     *
 *****************/
function renderTips(found, missing, score, role){
  const box = document.getElementById("tipsList"); if (!box) return;
  const tips = [];

  if (score < 55) tips.push("Keep it concise: 1–2 pages improves ATS readability.");
  if ((resumeText.match(/\n/g)||[]).length < 10) tips.push("Use bullet points to structure achievements.");
  if (!/(\d+%|\d{4,})/.test(resumeText)) tips.push("Quantify impact (e.g., “reduced costs by 15%” or “processed 10k records”).");
  if (!/project|built|developed|led|designed/i.test(resumeText)) tips.push("Add action verbs at the start of bullet points.");
  if (missing.includes("Git")) tips.push("Include Git (or VCS) to pass many engineering ATS screens.");
  if (role.includes("Frontend") && missing.includes("Accessibility")) tips.push("Mention Accessibility (a11y) for front-end roles.");
  if (role.includes("Cloud") && missing.includes("Terraform")) tips.push("IaC like Terraform is often required for cloud roles.");
  if (role.includes("Product") && missing.includes("OKRs")) tips.push("Add OKRs/KPIs to show product outcome focus.");

  if (tips.length === 0) tips.push("Great job! Your resume already covers most ATS basics for this role.");

  box.innerHTML = tips.map(t => `
    <div class="flex items-start gap-3 p-3 bg-white rounded-lg shadow-sm border-l-4 border-indigo-300">
      <span>💡</span><p class="text-sm text-gray-700">${t}</p>
    </div>
  `).join("");
}

/*****************
 * ROADMAP (unique)
 *****************/
function renderRoadmap(missing, role){
  const list = document.getElementById("roadmapList"); if (!list) return;
  const steps = [];

  // Group missing skills into 3 sprints
  const sprint1 = missing.slice(0, 5);
  const sprint2 = missing.slice(5, 10);
  const sprint3 = missing.slice(10, 15);

  if (sprint1.length) steps.push({ title:"Sprint 1 (2 weeks)", desc:"Cover the must-have gaps for quick wins.", skills:sprint1 });
  if (sprint2.length) steps.push({ title:"Sprint 2 (2–4 weeks)", desc:"Build depth and complete core stack.", skills:sprint2 });
  if (sprint3.length) steps.push({ title:"Sprint 3 (4–6 weeks)", desc:"Add advanced/bonus skills to stand out.", skills:sprint3 });

  if (steps.length === 0) {
    list.innerHTML = `<li class="text-gray-500">No roadmap needed. You’re ready for ${role} roles!</li>`;
    return;
  }

  list.innerHTML = steps.map(s => `
    <li>
      <div class="absolute -left-1.5 w-3 h-3 rounded-full bg-indigo-400"></div>
      <div class="bg-white border rounded-xl shadow-sm p-4">
        <h4 class="font-semibold">${s.title}</h4>
        <p class="text-sm text-gray-600">${s.desc}</p>
        <p class="mt-2 text-sm"><span class="font-medium">Focus:</span> ${s.skills.join(", ")}</p>
      </div>
    </li>
  `).join("");
}

/*****************
 * HISTORY        *
 *****************/
function storeHistory(entry){
  const h = JSON.parse(localStorage.getItem("history") || "[]");
  h.unshift({ ...entry, at: new Date().toISOString() });
  localStorage.setItem("history", JSON.stringify(h));
  renderHistory();
}

function renderHistory(){
  const ul = document.getElementById("historyList"); if (!ul) return;
  const h = JSON.parse(localStorage.getItem("history") || "[]");
  if (h.length === 0) { ul.innerHTML = `<li class="p-4 text-gray-500">No history yet.</li>`; return; }
  ul.innerHTML = h.map(i => `
    <li class="p-4 flex items-center justify-between hover:bg-gray-50">
      <div class="text-sm">
        <div class="font-medium">${i.type.toUpperCase()}</div>
        <div class="text-gray-500">${new Date(i.at).toLocaleString()}${i.name? ` • ${i.name}`:''}${i.role? ` • ${i.role}`:''}${typeof i.score==='number'?` • Score ${i.score}`:''}</div>
      </div>
      ${i.length? `<span class="text-xs text-gray-500">${i.length} chars</span>`:''}
    </li>
  `).join("");
}

function exportHistory(){
  const h = localStorage.getItem("history") || "[]";
  const blob = new Blob([h], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "history.json"; a.click();
  URL.revokeObjectURL(url);
}
function clearHistory(){
  if (!confirm("Clear all history?")) return;
  localStorage.removeItem("history");
  renderHistory();
}

/*****************
 * INIT HELPERS   *
 *****************/
window.addEventListener("load", () => {
  // If we’re on dashboard, show default sections
  if (!location.pathname.endsWith("dashboard.html")) return;
  document.querySelector(".nav-item[data-target='upload']")?.click();
  renderHistory();

  // Encourage the tour for first-time users
  if (!localStorage.getItem("didTour")) {
    setTimeout(()=> { startTour(); localStorage.setItem("didTour","1"); }, 600);
  }
});

// Expose for inline handlers
window.handleFile = handleFile;
window.handleDrop = handleDrop;
window.usePasted = usePasted;
window.clearPasted = clearPasted;
window.analyze = analyze;
window.generateSummary = generateSummary;
window.exportHistory = exportHistory;
window.clearHistory = clearHistory;
window.startTour = startTour;
window.logout = logout;
