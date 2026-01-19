const GAS_URL = "https://script.google.com/macros/s/AKfycbzTWF1NEmCXQ1SGQDP92N7MU1hrnydKAoYzDAeCPGCUGiKKLZmXuZlX_Y9a0upMfAyy/exec"; // ★ここに必ず自分のURLを入れてください

let projects = {};
let currentProjectId = "";
let sourceFiles = [];
let viewDate = new Date();
const FREE_MEMO_KEY = "doc_manager_free_memo";

// 起動時
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
    if(status) status.innerText = "⏳ 保存中...";
    const data = JSON.stringify({ projects, sourceFiles });
    try {
        await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({ method: "save", payload: data })
        });
        if(status) status.innerText = "✅ 保存完了";
        renderCalendar();
    } catch (e) {
        if(status) status.innerText = "❌ 保存失敗";
    }
}

async function loadFromCloud() {
    const status = document.getElementById("scanStatus");
    if(status) status.innerText = "⏳ データを同期中...";
    try {
        const response = await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ method: "load" }) });
        const result = await response.json();
        projects = result.projects || {};
        sourceFiles = result.sourceFiles || [];
        if(status) status.innerText = "✅ 同期完了";
    } catch (e) {
        if(status) status.innerText = "❌ 同期失敗";
    }
}

/* --- 案件管理 --- */
function createNewProject() {
    const name = document.getElementById("newProjectName").value.trim();
    if (!name) return alert("案件名を入力");
    const id = "pj_" + Date.now();
    projects[id] = { name: name, start: "", end: "", docs: [], projectMemo: "" };
    saveAll(); refreshProjectSelect(); switchProject(id);
    document.getElementById("newProjectName").value = "";
}

function switchProject(id) {
    currentProjectId = id;
    document.getElementById("projectSelect").value = id;
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

/* --- カレンダー描画 --- */
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

    ["日", "月", "火", "水", "木", "金", "土"].forEach(day => {
        const d = document.createElement("div");
        d.className = "calendar-day-head"; d.innerText = day;
        grid.appendChild(d);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement("div");
        empty.className = "calendar-day"; grid.appendChild(empty);
    }

    const docs = projects[currentProjectId].docs || [];
    for (let date = 1; date <= lastDate; date++) {
        const cell = document.createElement("div");
        cell.className = "calendar-day";
        cell.innerHTML = `<div class="day-number">${date}</div>`;
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

/* --- 書類リスト・その他 --- */
function renderTable() {
    if (!currentProjectId) return;
    const docs = projects[currentProjectId].docs || [];
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = "";
    docs.forEach((item, i) => {
        const row = tbody.insertRow();
        if (item.completed) row.className = "row-completed";
        row.innerHTML = `
            <td><input type="checkbox" ${item.completed ? "checked" : ""} onchange="toggleComplete(${i})"></td>
            <td>${item.priority}</td>
            <td><b>${item.docName}</b></td>
            <td>${item.target}</td>
            <td>${item.deadline}</td>
            <td>${item.memo}</td>
            <td><button onclick="copyPath('${item.filePath}')">📋</button></td>
            <td><button onclick="deleteDoc(${i})" class="btn-delete">×</button></td>
        `;
    });
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
}

function toggleComplete(idx) { projects[currentProjectId].docs[idx].completed = !projects[currentProjectId].docs[idx].completed; saveAll(); renderTable(); }
function deleteDoc(idx) { if (confirm("削除？")) { projects[currentProjectId].docs.splice(idx, 1); saveAll(); renderTable(); } }
function updateProjectDates() { projects[currentProjectId].start = document.getElementById("projectStart").value; projects[currentProjectId].end = document.getElementById("projectEnd").value; saveAll(); updateCountdown(); }
function saveProjectMemo() { projects[currentProjectId].projectMemo = document.getElementById("projectSpecificMemo").value; saveAll(); }
function updateCountdown() {
    const display = document.getElementById("projectCountdown");
    const pj = projects[currentProjectId];
    if (!pj.end) { display.innerText = "竣工日をセットしてください"; return; }
    const diff = Math.ceil((new Date(pj.end) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
    display.innerHTML = diff >= 0 ? `🏁 ${pj.name} 竣工まで <span class="days-num">${diff}</span>日` : `🏁 ${pj.name} 竣工済み`;
}
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

/* --- スキャン機能 --- */
function initPdfFeatures() {
    const dz = document.getElementById('dropZone'); if(!dz) return;
    dz.onclick = () => document.getElementById('pdfInput').click();
    dz.ondrop = (e) => { e.preventDefault(); handleScanFiles(e.dataTransfer.files); };
    dz.ondragover = (e) => e.preventDefault();
    document.getElementById('pdfInput').onchange = (e) => handleScanFiles(e.target.files);
    document.getElementById('customSearchWords').oninput = () => analyzeCrossSearch();
}
async function handleScanFiles(files) {
    const status = document.getElementById('scanStatus'); status.innerText = "⏳ 解析中...";
    try {
        for (let file of files) {
            if (file.type !== "application/pdf") continue;
            const base64 = await new Promise(r => { const f=new FileReader(); f.onload=()=>r(f.result); f.readAsDataURL(file); });
            const pdf = await window['pdfjs-dist/build/pdf'].getDocument(await file.arrayBuffer()).promise;
            let pageData = {};
            for (let i=1; i<=pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                pageData[i] = content.items.map(it => it.str).join(' ');
            }
            sourceFiles.push({ fileName: file.name, pages: pageData, base64: base64 });
        }
        await saveAll(); status.innerText = "✅ スキャン完了"; renderFileList();
    } catch (e) { status.innerText = "❌ エラー"; }
}
function renderFileList() {
    document.getElementById('fileList').innerHTML = sourceFiles.map((f, i) => `<div class="file-chip">📄 ${f.fileName.substring(0,10)}... <span onclick="sourceFiles.splice(${i},1);saveAll();renderFileList();">×</span></div>`).join('');
}
function analyzeCrossSearch() {
    const container = document.getElementById('snippetContainer'); const query = document.getElementById('customSearchWords').value;
    container.innerHTML = ""; const keywords = query ? query.split(/[,、\s]+/).filter(w => w.length > 0) : [];
    if (keywords.length === 0) return;
    sourceFiles.forEach((file, fIdx) => {
        for (let p in file.pages) {
            keywords.forEach(word => {
                if (file.pages[p].includes(word)) {
                    const div = document.createElement("div"); div.className = "snippet-card"; div.onclick = () => openPdfPreview(fIdx, p);
                    const idx = file.pages[p].indexOf(word);
                    div.innerHTML = `<div class="snippet-header"><span>📄 ${file.fileName}</span><span>P.${p}</span></div><div style="font-size:0.75rem;">...${file.pages[p].substring(idx-15, idx+30)}...</div>`;
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
function clearAllScanData() { if(confirm("消去？")) { sourceFiles=[]; saveAll(); renderFileList(); } }