const GAS_URL = "https://script.google.com/macros/s/AKfycbyo_O-OvbHjTnSxPuS5wxGLPt1nDithb-CQWynlK_iBidPv4rQOxYfBShV77YZ2CpuV/exec"; 

let projects = {};
let currentProjectId = "";
let sourceFiles = [];
let viewDate = new Date();
let currentPhaseFilter = 'all';

const INITIAL_MASTER = [
    { phase: "着手前", name: "施工計画書", ref: "仕様書 1-1-1-6", target: "監督員", link: "N:\\標準雛形\\01_施工計画書.docx" },
    { phase: "着手前", name: "施工体制台帳", ref: "適正化法 第11条", target: "監督員", link: "N:\\標準雛形\\02_施工体制台帳.xlsx" },
    { phase: "施工中", name: "段階確認願", ref: "仕様書 1-1-1-17", target: "監督員", link: "" },
    { phase: "完成", name: "完成図書", ref: "仕様書 1-1-1-23", target: "監督員", link: "" }
];

window.onload = async function() {
    loadFreeMemo();
    initPdfFeatures();
    if (GAS_URL.includes("http")) {
        await loadFromCloud();
    } else {
        alert("GASのURLが設定されていません。script.jsの1行目を確認してください。");
    }
    refreshProjectSelect();
    document.getElementById("freeMemo").addEventListener("input", () => {
        localStorage.setItem("doc_manager_free_memo", document.getElementById("freeMemo").value);
    });
};

/* クラウド同期 */
async function saveAll() {
    if (!GAS_URL.includes("http")) return;
    const data = JSON.stringify({ projects, sourceFiles });
    try {
        await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ method: "save", payload: data }) });
        renderCalendar();
    } catch (e) { console.error("Save Error", e); }
}

async function loadFromCloud() {
    try {
        const response = await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ method: "load" }) });
        const result = await response.json();
        projects = result.projects || {};
        sourceFiles = result.sourceFiles || [];
    } catch (e) { console.error("Load Error", e); }
}

/* 案件管理 */
function createNewProject() {
    const name = document.getElementById("newProjectName").value.trim();
    if (!name) return;
    const id = "pj_" + Date.now();
    const docs = INITIAL_MASTER.map(m => ({
        status: "未着手", phase: m.phase, docName: m.name, ref: m.ref, target: m.target, deadline: "", filePath: m.link
    }));
    projects[id] = { name, start: "", end: "", docs: docs, projectMemo: "" };
    document.getElementById("newProjectName").value = "";
    saveAll(); refreshProjectSelect(); switchProject(id);
}

function switchProject(id) {
    currentProjectId = id;
    const isSelected = !!id;
    document.getElementById("projectDateArea").style.display = isSelected ? "flex" : "none";
    document.getElementById("projectMemoArea").style.display = isSelected ? "block" : "none";
    document.getElementById("listArea").style.display = isSelected ? "block" : "none";
    if (isSelected) {
        const pj = projects[id];
        document.getElementById("projectStart").value = pj.start || "";
        document.getElementById("projectEnd").value = pj.end || "";
        document.getElementById("projectSpecificMemo").value = pj.projectMemo || "";
        updateCountdown(); renderTable(); renderCalendar();
    }
}

function renderTable() {
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = "";
    if(!currentProjectId) return;

    projects[currentProjectId].docs.forEach((item, i) => {
        if (currentPhaseFilter !== 'all' && item.phase !== currentPhaseFilter) return;
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>
                <select onchange="updateDocField(${i}, 'status', this.value)" style="background:${item.status==='提出済'?'#d1e7dd':item.status==='作成中'?'#fff3cd':'#fff'}">
                    <option value="未着手" ${item.status==='未着手'?'selected':''}>未着手</option>
                    <option value="作成中" ${item.status==='作成中'?'selected':''}>作成中</option>
                    <option value="提出済" ${item.status==='提出済'?'selected':''}>提出済</option>
                </select>
            </td>
            <td>${item.phase}</td>
            <td><b>${item.docName}</b><br><small style="color:#999">${item.ref}</small></td>
            <td><input type="date" value="${item.deadline}" onchange="updateDocField(${i}, 'deadline', this.value)"></td>
            <td>${item.filePath ? `<button onclick="copyPath('${item.filePath}')">📋</button>` : '-'}</td>
            <td><button onclick="deleteDoc(${i})" class="btn-delete">×</button></td>
        `;
    });
}

function updateDocField(index, field, value) {
    projects[currentProjectId].docs[index][field] = value;
    saveAll();
    if (field === 'status') renderTable();
}

function refreshProjectSelect() {
    const s = document.getElementById("projectSelect");
    s.innerHTML = '<option value="">-- 案件を選択 --</option>';
    for (let id in projects) s.innerHTML += `<option value="${id}">${projects[id].name}</option>`;
    if(currentProjectId) s.value = currentProjectId;
}

/* タブ切り替え */
function switchTab(id, btn) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active'); btn.classList.add('active');
}

/* その他共通関数 */
function updateCountdown() {
    const display = document.getElementById("projectCountdown"); const pj = projects[currentProjectId];
    if (!pj || !pj.end) { display.innerText = "竣工日をセットしてね！"; return; }
    const diff = Math.ceil((new Date(pj.end) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
    display.innerHTML = `🏁 ${pj.name} 竣工まで あと <span class="days-num">${diff}</span> 日`;
}
function filterPhase(phase, btn) {
    currentPhaseFilter = phase;
    document.querySelectorAll('.phase-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); renderTable();
}
function loadFreeMemo() { document.getElementById("freeMemo").value = localStorage.getItem("doc_manager_free_memo") || ""; }
function copyPath(p) { navigator.clipboard.writeText(p).then(() => alert("コピーしたよ！")); }
function saveProjectMemo() { projects[currentProjectId].projectMemo = document.getElementById("projectSpecificMemo").value; saveAll(); }
function updateProjectDates() { projects[currentProjectId].start = document.getElementById("projectStart").value; projects[currentProjectId].end = document.getElementById("projectEnd").value; saveAll(); updateCountdown(); }
function deleteDoc(idx) { if(confirm("消す？")) { projects[currentProjectId].docs.splice(idx, 1); saveAll(); renderTable(); } }
function deleteCurrentProject() { if(confirm("案件ごと消す？")) { delete projects[currentProjectId]; saveAll(); refreshProjectSelect(); switchProject(""); } }

/* カレンダー (簡易) */
function renderCalendar() { /* 実装済みコードを維持 */ }
function changeMonth(d) { viewDate.setMonth(viewDate.getMonth()+d); renderCalendar(); }
function initPdfFeatures() { /* 実装済みコードを維持 */ }