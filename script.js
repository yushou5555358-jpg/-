const GAS_URL = "https://script.google.com/macros/s/AKfycbzTWF1NEmCXQ1SGQDP92N7MU1hrnydKAoYzDAeCPGCUGiKKLZmXuZlX_Y9a0upMfAyy/exec"; // ★ここを自分のものに変える

let projects = {};
let currentProjectId = "";
let sourceFiles = [];
let viewDate = new Date(); // カレンダー表示用の日付
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

/* --- クラウド同期機能 --- */
async function saveAll() {
    const status = document.getElementById("scanStatus");
    if(status) status.innerText = "⏳ 保存中...";
    const data = JSON.stringify({ projects, sourceFiles });
    try {
        await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({ method: "save", payload: data })
        });
        if(status) status.innerText = "✅ 同期完了";
        renderCalendar(); // カレンダーを更新
    } catch (e) {
        if(status) status.innerText = "❌ 保存失敗";
    }
}

async function loadFromCloud() {
    try {
        const response = await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ method: "load" }) });
        const result = await response.json();
        projects = result.projects || {};
        sourceFiles = result.sourceFiles || [];
    } catch (e) { console.error("通信エラー"); }
}

/* --- カレンダー機能 (新設) --- */
function changeMonth(diff) {
    viewDate.setMonth(viewDate.getMonth() + diff);
    renderCalendar();
}

function renderCalendar() {
    if (!currentProjectId) return;
    const grid = document.getElementById("calendarGrid");
    const display = document.getElementById("currentMonthDisplay");
    grid.innerHTML = "";

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    display.innerText = `${year}年 ${month + 1}月`;

    // 曜日ヘッダー
    ["日", "月", "火", "水", "木", "金", "土"].forEach(day => {
        const d = document.createElement("div");
        d.className = "calendar-day-head";
        d.innerText = day;
        grid.appendChild(d);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    // 空白のマス
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement("div");
        empty.className = "calendar-day";
        grid.appendChild(empty);
    }

    // 日付のマス
    const today = new Date();
    const docs = projects[currentProjectId].docs || [];

    for (let date = 1; date <= lastDate; date++) {
        const cell = document.createElement("div");
        cell.className = "calendar-day";
        if (year === today.getFullYear() && month === today.getMonth() && date === today.getDate()) {
            cell.classList.add("today");
        }

        cell.innerHTML = `<div class="day-number">${date}</div>`;

        // この日の書類を検索
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
        docs.filter(doc => doc.deadline === dateStr).forEach(doc => {
            const div = document.createElement("div");
            div.className = "event-item";
            if (doc.priority === "最優先★★") div.classList.add("event-high");
            if (doc.priority === "重要★") div.classList.add("event-mid");
            if (doc.completed) div.classList.add("event-done");
            div.innerText = doc.docName;
            cell.appendChild(div);
        });

        grid.appendChild(cell);
    }
}

// --- その他の関数 (前回と同様) ---
function refreshProjectSelect() {
    const select = document.getElementById("projectSelect");
    if(!select) return;
    select.innerHTML = '<option value="">-- 選択 --</option>';
    for (let id in projects) {
        const opt = document.createElement("option");
        opt.value = id; opt.innerText = projects[id].name;
        select.appendChild(opt);
    }
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
        updateCountdown(); 
        renderTable();
        renderCalendar();
    }
}

function addDoc() {
    if (!currentProjectId) return;
    const name = document.getElementById("docName").value;
    if (!name) return alert("書類名を入力");
    projects[currentProjectId].docs.push({
        completed: false, docName: name, target: document.getElementById("target").value,
        deadline: document.getElementById("deadline").value, priority: document.getElementById("priority").value,
        filePath: document.getElementById("filePath").value, memo: document.getElementById("memo").value
    });
    saveAll(); renderTable();
    ["docName", "target", "deadline", "filePath", "memo"].forEach(id => document.getElementById(id).value = "");
}

// ※ updateCell, toggleComplete, deleteDoc などの関数も以前のものを維持して貼り付けてください
function updateCell(idx, field, val) { projects[currentProjectId].docs[idx][field] = val; saveAll(); renderTable(); }
function toggleComplete(idx) { projects[currentProjectId].docs[idx].completed = !projects[currentProjectId].docs[idx].completed; saveAll(); renderTable(); }
function deleteDoc(idx) { if (confirm("削除？")) { projects[currentProjectId].docs.splice(idx, 1); saveAll(); renderTable(); } }
function updateProjectDates() { if (!currentProjectId) return; projects[currentProjectId].start = document.getElementById("projectStart").value; projects[currentProjectId].end = document.getElementById("projectEnd").value; saveAll(); updateCountdown(); }
function saveProjectMemo() { if (!currentProjectId) return; projects[currentProjectId].projectMemo = document.getElementById("projectSpecificMemo").value; saveAll(); }
function updateCountdown() {
    const display = document.getElementById("projectCountdown");
    if (!currentProjectId || !projects[currentProjectId]) return;
    const pj = projects[currentProjectId];
    if (!pj.end) { display.innerText = "竣工日をセットしてください"; return; }
    const today = new Date(); today.setHours(0,0,0,0);
    const endDay = new Date(pj.end);
    const diff = Math.ceil((endDay - today) / (1000 * 60 * 60 * 24));
    display.innerHTML = diff > 0 ? `🏁 ${pj.name} 竣工まで <span class="days-num">${diff}</span>日` : `🏁 ${pj.name} 竣工済み`;
}
function renderTable() {
    if (!currentProjectId) return;
    const docs = projects[currentProjectId].docs || [];
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = "";
    docs.forEach((item, i) => {
        const row = tbody.insertRow();
        if (item.completed) row.className = "row-completed";
        row.innerHTML = `<td><input type="checkbox" ${item.completed ? "checked" : ""} onchange="toggleComplete(${i})"></td><td>${item.priority}</td><td>${item.docName}</td><td>${item.target}</td><td>${item.deadline}</td><td>${item.memo}</td><td><button onclick="copyPath('${item.filePath}')">📋</button></td><td><button onclick="deleteDoc(${i})">×</button></td>`;
    });
}
function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}
function loadFreeMemo() { document.getElementById("freeMemo").value = localStorage.getItem(FREE_MEMO_KEY) || ""; }
function copyPath(p) { navigator.clipboard.writeText(p).then(() => alert("コピー完了")); }
function exportExcel() { XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById("targetTable")), `書類リスト.xlsx`); }
function deleteCurrentProject() { if(confirm("削除？")) { delete projects[currentProjectId]; saveAll(); refreshProjectSelect(); switchProject(""); } }

// PDF関連の関数も以前のものを維持
function initPdfFeatures() {
    const dz = document.getElementById('dropZone'); if(!dz) return;
    dz.onclick = () => document.getElementById('pdfInput').click();
    dz.ondrop = (e) => { e.preventDefault(); handleScanFiles(e.dataTransfer.files); };
    dz.ondragover = (e) => e.preventDefault();
    document.getElementById('pdfInput').onchange = (e) => handleScanFiles(e.target.files);
    document.getElementById('customSearchWords').oninput = () => analyzeCrossSearch();
}
async function handleScanFiles(files) { /* 以前と同じ内容 */ }
function analyzeCrossSearch() { /* 以前と同じ内容 */ }
function openPdfPreview() { /* 以前と同じ内容 */ }