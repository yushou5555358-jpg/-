const GAS_URL = "https://script.google.com/macros/s/AKfycbzTWF1NEmCXQ1SGQDP92N7MU1hrnydKAoYzDAeCPGCUGiKKLZmXuZlX_Y9a0upMfAyy/exec"; // ★忘れずに！

let projects = {};
let currentProjectId = "";
let sourceFiles = [];
let viewDate = new Date();
const FREE_MEMO_KEY = "doc_manager_free_memo";

window.onload = async function() {
    loadFreeMemo();
    initPdfFeatures();
    await loadFromCloud();
    refreshProjectSelect();
    document.getElementById("freeMemo").addEventListener("input", () => {
        localStorage.setItem(FREE_MEMO_KEY, document.getElementById("freeMemo").value);
    });
};

/* --- クラウド同期 --- */
async function saveAll() {
    const status = document.getElementById("scanStatus");
    const data = JSON.stringify({ projects, sourceFiles });
    try {
        await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ method: "save", payload: data }) });
        if(status) status.innerText = "✅ 保存完了";
        renderCalendar();
    } catch (e) { console.error("Save Error"); }
}

async function loadFromCloud() {
    try {
        const response = await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ method: "load" }) });
        const result = await response.json();
        projects = result.projects || {};
        sourceFiles = result.sourceFiles || [];
    } catch (e) { console.error("Load Error"); }
}

/* --- 案件・リスト管理 --- */
function createNewProject() {
    const name = document.getElementById("newProjectName").value.trim();
    if (!name) return;
    const id = "pj_" + Date.now();
    projects[id] = { name: name, start: "", end: "", docs: [], projectMemo: "" };
    saveAll(); refreshProjectSelect(); switchProject(id);
}

function switchProject(id) {
    currentProjectId = id;
    const isSelected = !!id;
    document.getElementById("projectDateArea").style.display = isSelected ? "flex" : "none";
    document.getElementById("projectMemoArea").style.display = isSelected ? "block" : "none";
    document.getElementById("inputFormArea").style.display = isSelected ? "block" : "none";
    document.getElementById("listArea").style.display = isSelected ? "block" : "none";
    document.getElementById("noProjectMsg").style.display = isSelected ? "none" : "block";
    
    if (isSelected) {
        const pj = projects[id];
        document.getElementById("projectStart").value = pj.start || "";
        document.getElementById("projectEnd").value = pj.end || "";
        document.getElementById("projectSpecificMemo").value = pj.projectMemo || "";
        updateCountdown(); renderTable(); renderCalendar();
    }
}

function renderTable() {
    if (!currentProjectId) return;
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = "";
    (projects[currentProjectId].docs || []).forEach((item, i) => {
        const row = tbody.insertRow();
        row.innerHTML = `<td><input type="checkbox" ${item.completed ? "checked" : ""} onchange="toggleComplete(${i})"></td><td>${item.priority}</td><td>${item.docName}</td><td>${item.target}</td><td>${item.deadline}</td><td>${item.memo}</td><td><button onclick="copyPath('${item.filePath}')">📋</button></td><td><button onclick="deleteDoc(${i})">×</button></td>`;
    });
}

function addDoc() {
    if (!currentProjectId) return;
    projects[currentProjectId].docs.push({
        completed: false, docName: document.getElementById("docName").value,
        target: document.getElementById("target").value, deadline: document.getElementById("deadline").value,
        priority: document.getElementById("priority").value, filePath: document.getElementById("filePath").value,
        memo: document.getElementById("memo").value
    });
    saveAll(); renderTable();
}

function toggleComplete(idx) { projects[currentProjectId].docs[idx].completed = !projects[currentProjectId].docs[idx].completed; saveAll(); renderTable(); }
function deleteDoc(idx) { if(confirm("消す？")) { projects[currentProjectId].docs.splice(idx, 1); saveAll(); renderTable(); } }
function updateProjectDates() { projects[currentProjectId].start = document.getElementById("projectStart").value; projects[currentProjectId].end = document.getElementById("projectEnd").value; saveAll(); updateCountdown(); }
function saveProjectMemo() { projects[currentProjectId].projectMemo = document.getElementById("projectSpecificMemo").value; saveAll(); }
function updateCountdown() {
    const display = document.getElementById("projectCountdown");
    const pj = projects[currentProjectId];
    if (!pj.end) { display.innerText = "竣工日をセットしてください"; return; }
    const diff = Math.ceil((new Date(pj.end) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
    display.innerHTML = `🏁 ${pj.name} 竣工まで <span class="days-num">${diff}</span>日`;
}

/* --- カレンダー --- */
function changeMonth(diff) { viewDate.setMonth(viewDate.getMonth() + diff); renderCalendar(); }
function renderCalendar() {
    if (!currentProjectId) return;
    const grid = document.getElementById("calendarGrid");
    grid.innerHTML = "";
    const year = viewDate.getFullYear(); const month = viewDate.getMonth();
    document.getElementById("currentMonthDisplay").innerText = `${year}年 ${month + 1}月`;
    ["日", "月", "火", "水", "木", "金", "土"].forEach(d => { const h=document.createElement("div"); h.className="calendar-day-head"; h.innerText=d; grid.appendChild(h); });
    const first = new Date(year, month, 1).getDay();
    const last = new Date(year, month+1, 0).getDate();
    for (let i=0; i<first; i++) grid.appendChild(document.createElement("div")).className="calendar-day";
    const docs = projects[currentProjectId].docs || [];
    for (let d=1; d<=last; d++) {
        const cell = document.createElement("div"); cell.className="calendar-day";
        cell.innerHTML = `<div class="day-number">${d}</div>`;
        const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        docs.filter(doc => doc.deadline === dStr).forEach(doc => {
            const item = document.createElement("div"); item.className="event-item";
            if (doc.priority === "最優先★★") item.classList.add("event-high");
            item.innerText = doc.docName; cell.appendChild(item);
        });
        grid.appendChild(cell);
    }
}

/* --- その他 --- */
function refreshProjectSelect() {
    const s = document.getElementById("projectSelect");
    s.innerHTML = '<option value="">-- 選択 --</option>';
    for (let id in projects) s.innerHTML += `<option value="${id}">${projects[id].name}</option>`;
}
function switchTab(id, btn) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active'); btn.classList.add('active');
}
function loadFreeMemo() { document.getElementById("freeMemo").value = localStorage.getItem(FREE_MEMO_KEY) || ""; }
function copyPath(p) { navigator.clipboard.writeText(p).then(() => alert("コピー完了")); }
function exportExcel() { XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById("targetTable")), `書類リスト.xlsx`); }
function deleteCurrentProject() { if(confirm("削除？")) { delete projects[currentProjectId]; saveAll(); refreshProjectSelect(); switchProject(""); } }

/* --- PDF（簡易版） --- */
function initPdfFeatures() {
    const dz = document.getElementById('dropZone'); if(!dz) return;
    dz.onclick = () => document.getElementById('pdfInput').click();
    document.getElementById('pdfInput').onchange = (e) => handleScanFiles(e.target.files);
}
async function handleScanFiles(files) { /* 以前と同じ解析ロジック */ }
function clearAllScanData() { if(confirm("消去？")) { sourceFiles=[]; saveAll(); } }