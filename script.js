const GAS_URL = "ここに自分のURLを貼り付け"; // ★ここを忘れずに！

let projects = {};
let currentProjectId = "";
let sourceFiles = [];
let viewDate = new Date();
const FREE_MEMO_KEY = "doc_manager_free_memo";

window.onload = async function() {
    loadFreeMemo();
    initPdfFeatures(); // PDF機能を初期化
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
    } catch (e) { if(status) status.innerText = "❌ 保存エラー"; }
}

async function loadFromCloud() {
    try {
        const response = await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ method: "load" }) });
        const result = await response.json();
        projects = result.projects || {};
        sourceFiles = result.sourceFiles || [];
    } catch (e) { console.error("Load Error"); }
}

/* --- スキャン解析機能（完全版） --- */
function initPdfFeatures() {
    const dz = document.getElementById('dropZone');
    if(!dz) return;
    dz.onclick = () => document.getElementById('pdfInput').click();
    dz.ondrop = (e) => { e.preventDefault(); handleScanFiles(e.dataTransfer.files); };
    dz.ondragover = (e) => e.preventDefault();
    document.getElementById('pdfInput').onchange = (e) => handleScanFiles(e.target.files);
    document.getElementById('customSearchWords').oninput = () => analyzeCrossSearch();
}

async function handleScanFiles(files) {
    const status = document.getElementById('scanStatus');
    status.innerText = "⏳ 解析中...";
    try {
        for (let file of files) {
            if (file.type !== "application/pdf") continue;
            const base64 = await new Promise(r => { const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.readAsDataURL(file); });
            const pdf = await window['pdfjs-dist/build/pdf'].getDocument(await file.arrayBuffer()).promise;
            let pageData = {};
            for (let i=1; i<=pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                pageData[i] = content.items.map(it => it.str).join(' ');
            }
            sourceFiles.push({ fileName: file.name, pages: pageData, base64: base64 });
        }
        await saveAll();
        status.innerText = "✅ スキャン完了";
        renderFileList();
    } catch (e) { status.innerText = "❌ 解析エラー"; }
}

function renderFileList() {
    const list = document.getElementById('fileList');
    list.innerHTML = sourceFiles.map((f, i) => `<div class="file-chip">📄 ${f.fileName.substring(0,10)}... <span onclick="sourceFiles.splice(${i},1);saveAll();renderFileList();" style="cursor:pointer">×</span></div>`).join('');
}

function analyzeCrossSearch() {
    const container = document.getElementById('snippetContainer');
    const query = document.getElementById('customSearchWords').value;
    container.innerHTML = "";
    const keywords = query ? query.split(/[,、\s]+/).filter(w => w.length > 0) : [];
    if (keywords.length === 0) return;
    sourceFiles.forEach((file, fIdx) => {
        for (let p in file.pages) {
            keywords.forEach(word => {
                if (file.pages[p].includes(word)) {
                    const div = document.createElement("div"); div.className = "snippet-card";
                    div.onclick = () => openPdfPreview(fIdx, p);
                    const idx = file.pages[p].indexOf(word);
                    div.innerHTML = `<div style="font-weight:bold; font-size:0.8rem;">📄 ${file.fileName} (P.${p})</div><div style="font-size:0.75rem; color:#666;">...${file.pages[p].substring(idx-15, idx+30)}...</div>`;
                    container.appendChild(div);
                }
            });
        }
    });
}

function openPdfPreview(fIdx, pNum) {
    const viewer = document.getElementById('pdfViewer');
    viewer.src = sourceFiles[fIdx].base64 + "#page=" + pNum;
    document.getElementById('previewPlaceholder').style.display = "none";
}

function clearAllScanData() { if(confirm("全スキャンデータを消去しますか？")) { sourceFiles=[]; saveAll(); renderFileList(); } }

/* --- その他 案件/カレンダー/リスト管理（前回と同じ） --- */
function createNewProject() {
    const name = document.getElementById("newProjectName").value.trim();
    if (!name) return;
    const id = "pj_" + Date.now();
    projects[id] = { name, start: "", end: "", docs: [], projectMemo: "" };
    saveAll(); refreshProjectSelect(); switchProject(id);
}
function switchProject(id) {
    currentProjectId = id;
    const isSelected = !!id;
    document.getElementById("projectDateArea").style.display = isSelected ? "flex" : "none";
    document.getElementById("projectMemoArea").style.display = isSelected ? "block" : "none";
    document.getElementById("inputFormArea").style.display = isSelected ? "block" : "none";
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
    (projects[currentProjectId].docs || []).forEach((item, i) => {
        const row = tbody.insertRow();
        row.innerHTML = `<td><input type="checkbox" ${item.completed ? "checked" : ""} onchange="toggleComplete(${i})"></td><td>${item.priority}</td><td><b>${item.docName}</b></td><td>${item.target}</td><td>${item.deadline}</td><td>${item.memo}</td><td><button onclick="copyPath('${item.filePath}')">📋</button></td><td><button onclick="deleteDoc(${i})">×</button></td>`;
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
function deleteDoc(idx) { if(confirm("削除？")) { projects[currentProjectId].docs.splice(idx, 1); saveAll(); renderTable(); } }
function updateProjectDates() { projects[currentProjectId].start = document.getElementById("projectStart").value; projects[currentProjectId].end = document.getElementById("projectEnd").value; saveAll(); updateCountdown(); }
function saveProjectMemo() { projects[currentProjectId].projectMemo = document.getElementById("projectSpecificMemo").value; saveAll(); }
function updateCountdown() {
    const display = document.getElementById("projectCountdown");
    const pj = projects[currentProjectId];
    if (!pj || !pj.end) { display.innerText = "竣工日をセットしてください"; return; }
    const diff = Math.ceil((new Date(pj.end) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
    display.innerHTML = `🏁 ${pj.name} 竣工まで <span class="days-num">${diff}</span>日`;
}
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
            item.innerText = doc.docName; cell.appendChild(item);
        });
        grid.appendChild(cell);
    }
}
function changeMonth(diff) { viewDate.setMonth(viewDate.getMonth() + diff); renderCalendar(); }
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