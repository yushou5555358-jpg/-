const GAS_URL = "https://script.google.com/macros/s/AKfycbyo_O-OvbHjTnSxPuS5wxGLPt1nDithb-CQWynlK_iBidPv4rQOxYfBShV77YZ2CpuV/exec"; // ★GASのウェブアプリURLを貼り付けてください

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
    
    // 共通メモの保存
    document.getElementById("freeMemo").addEventListener("input", () => {
        localStorage.setItem(FREE_MEMO_KEY, document.getElementById("freeMemo").value);
    });
};

/* --- クラウド保存・読み込み --- */
async function saveAll() {
    const status = document.getElementById("scanStatus");
    if(status) status.innerText = "⏳ 保存中...";
    const data = JSON.stringify({ projects, sourceFiles });
    try {
        await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ method: "save", payload: data }) });
        if(status) status.innerText = "✅ 保存完了";
        renderCalendar();
    } catch (e) {
        if(status) status.innerText = "❌ 保存エラー";
    }
}

async function loadFromCloud() {
    try {
        const response = await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ method: "load" }) });
        const result = await response.json();
        projects = result.projects || {};
        sourceFiles = result.sourceFiles || [];
    } catch (e) {
        console.error("データ読み込み失敗");
    }
}

/* --- 案件・書類管理 --- */
function renderTable() {
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = "";
    if(!currentProjectId) return;

    (projects[currentProjectId].docs || []).forEach((item, i) => {
        const row = tbody.insertRow();
        if (item.completed) row.style.opacity = "0.5";
        row.innerHTML = `
            <td><input type="checkbox" ${item.completed ? "checked" : ""} onchange="updateDocField(${i}, 'completed', this.checked)"></td>
            <td>
                <select onchange="updateDocField(${i}, 'priority', this.value)">
                    <option value="最優先★★" ${item.priority === '最優先★★' ? 'selected' : ''}>最優先★★</option>
                    <option value="重要★" ${item.priority === '重要★' ? 'selected' : ''}>重要★</option>
                    <option value="通常" ${item.priority === '通常' ? 'selected' : ''}>通常</option>
                </select>
            </td>
            <td><input type="text" value="${item.docName || ''}" onchange="updateDocField(${i}, 'docName', this.value)"></td>
            <td><input type="text" value="${item.target || ''}" onchange="updateDocField(${i}, 'target', this.value)"></td>
            <td><input type="date" value="${item.deadline || ''}" onchange="updateDocField(${i}, 'deadline', this.value)"></td>
            <td><input type="text" value="${item.memo || ''}" onchange="updateDocField(${i}, 'memo', this.value)"></td>
            <td><button onclick="copyPath('${item.filePath}')">📋</button></td>
            <td><button onclick="deleteDoc(${i})" class="btn-delete">×</button></td>
        `;
    });
}

function updateDocField(index, field, value) {
    projects[currentProjectId].docs[index][field] = value;
    saveAll();
    if (['completed', 'deadline', 'priority'].includes(field)) renderTable();
}

function addDoc() {
    if (!currentProjectId) return;
    projects[currentProjectId].docs.push({
        completed: false,
        docName: document.getElementById("docName").value,
        target: document.getElementById("target").value,
        deadline: document.getElementById("deadline").value,
        priority: document.getElementById("priority").value,
        filePath: document.getElementById("filePath").value,
        memo: document.getElementById("memo").value
    });
    ["docName", "target", "deadline", "filePath", "memo"].forEach(id => document.getElementById(id).value = "");
    saveAll(); renderTable();
}

function saveProjectMemo() {
    if (!currentProjectId) return;
    projects[currentProjectId].projectMemo = document.getElementById("projectSpecificMemo").value;
    saveAll();
}

function createNewProject() {
    const name = document.getElementById("newProjectName").value.trim();
    if (!name) return;
    const id = "pj_" + Date.now();
    projects[id] = { name, start: "", end: "", docs: [], projectMemo: "" };
    document.getElementById("newProjectName").value = "";
    saveAll(); refreshProjectSelect(); switchProject(id);
}

function switchProject(id) {
    currentProjectId = id;
    const isSelected = !!id;
    ["projectDateArea", "projectMemoArea", "inputFormArea", "listArea"].forEach(domId => {
        document.getElementById(domId).style.display = isSelected ? "block" : "none";
    });
    if (isSelected) {
        const pj = projects[id];
        document.getElementById("projectStart").value = pj.start || "";
        document.getElementById("projectEnd").value = pj.end || "";
        document.getElementById("projectSpecificMemo").value = pj.projectMemo || "";
        document.getElementById("projectDateArea").style.display = "flex";
        updateCountdown(); renderTable(); renderCalendar();
    }
}

function refreshProjectSelect() {
    const s = document.getElementById("projectSelect");
    s.innerHTML = '<option value="">-- 案件を選択 --</option>';
    for (let id in projects) {
        const option = document.createElement("option");
        option.value = id;
        option.innerText = projects[id].name;
        if(id === currentProjectId) option.selected = true;
        s.appendChild(option);
    }
}

/* --- カレンダー --- */
function renderCalendar() {
    const grid = document.getElementById("calendarGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    document.getElementById("currentMonthDisplay").innerText = `${year}年 ${month + 1}月`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement("div");
        empty.className = "calendar-day";
        grid.appendChild(empty);
    }
    
    const docs = currentProjectId ? projects[currentProjectId].docs || [] : [];
    
    for (let d = 1; d <= lastDate; d++) {
        const cell = document.createElement("div");
        cell.className = "calendar-day";
        cell.innerHTML = `<div class="day-number">${d}</div>`;
        const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        
        docs.filter(doc => doc.deadline === dStr).forEach(doc => {
            const item = document.createElement("div");
            item.className = "event-item";
            if(doc.priority === "最優先★★") item.style.background = "#d9534f";
            item.innerText = doc.docName;
            cell.appendChild(item);
        });
        grid.appendChild(cell);
    }
}

function changeMonth(diff) { viewDate.setMonth(viewDate.getMonth() + diff); renderCalendar(); }

/* --- PDFスキャン & キーワード検索 --- */
function initPdfFeatures() {
    const dz = document.getElementById('dropZone');
    if(!dz) return;
    
    dz.onclick = () => document.getElementById('pdfInput').click();
    dz.ondragover = (e) => { e.preventDefault(); dz.style.backgroundColor = "#e1efff"; };
    dz.ondragleave = () => { dz.style.backgroundColor = "#f0f7ff"; };
    dz.ondrop = (e) => { 
        e.preventDefault(); 
        dz.style.backgroundColor = "#f0f7ff";
        handleScanFiles(e.dataTransfer.files); 
    };
    document.getElementById('pdfInput').onchange = (e) => handleScanFiles(e.target.files);
    document.getElementById('customSearchWords').oninput = () => analyzeCrossSearch();
}

async function handleScanFiles(files) {
    const status = document.getElementById('scanStatus');
    status.innerText = "⏳ 解析中...";
    try {
        for (let file of files) {
            if (file.type !== "application/pdf") continue;
            const arrayBuffer = await file.arrayBuffer();
            const base64 = await new Promise(r => {
                const fr = new FileReader();
                fr.onload = () => r(fr.result);
                fr.readAsDataURL(file);
            });
            const pdf = await window['pdfjs-dist/build/pdf'].getDocument(arrayBuffer).promise;
            let pageData = {};
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                pageData[i] = textContent.items.map(it => it.str).join(' ');
            }
            sourceFiles.push({ fileName: file.name, pages: pageData, base64: base64 });
        }
        await saveAll();
        status.innerText = "✅ スキャン完了";
        renderFileList();
    } catch (e) {
        status.innerText = "❌ 解析エラー";
        console.error(e);
    }
}

function renderFileList() {
    const list = document.getElementById('fileList');
    list.innerHTML = sourceFiles.map((f, i) => `
        <div class="file-chip">
            📄 ${f.fileName.substring(0, 12)}... 
            <span onclick="sourceFiles.splice(${i},1);saveAll();renderFileList();" style="cursor:pointer; font-weight:bold;">×</span>
        </div>
    `).join('');
}

function analyzeCrossSearch() {
    const container = document.getElementById('snippetContainer');
    const query = document.getElementById('customSearchWords').value;
    container.innerHTML = "";
    const keywords = query ? query.split(/[,、\s]+/).filter(w => w.length > 0) : [];
    if (keywords.length === 0) return;

    sourceFiles.forEach((file, fIdx) => {
        for (let p in file.pages) {
            const text = file.pages[p];
            keywords.forEach(word => {
                if (text.includes(word)) {
                    const div = document.createElement("div");
                    div.className = "snippet-card";
                    div.onclick = () => openPdfPreview(fIdx, p);
                    const idx = text.indexOf(word);
                    const snippet = text.substring(Math.max(0, idx - 20), idx + 30);
                    div.innerHTML = `
                        <div style="font-weight:bold; color:var(--primary);">📄 ${file.fileName} (P.${p})</div>
                        <div style="font-size:0.8rem; color:#444;">...${snippet}...</div>
                    `;
                    container.appendChild(div);
                }
            });
        }
    });
}

function openPdfPreview(fIdx, pNum) {
    const viewer = document.getElementById('pdfViewer');
    viewer.src = sourceFiles[fIdx].base64 + "#page=" + pNum;
}

/* --- その他ユーティリティ --- */
function updateProjectDates() {
    if(!currentProjectId) return;
    projects[currentProjectId].start = document.getElementById("projectStart").value;
    projects[currentProjectId].end = document.getElementById("projectEnd").value;
    saveAll(); updateCountdown();
}

function updateCountdown() {
    const display = document.getElementById("projectCountdown");
    const pj = projects[currentProjectId];
    if (!pj || !pj.end) {
        display.innerText = "竣工日をセットしてください";
        return;
    }
    const diff = Math.ceil((new Date(pj.end) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
    display.innerHTML = `🏁 ${pj.name} 竣工まで <span class="days-num">${diff}</span>日`;
}

function switchTab(id, btn) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');
}

function loadFreeMemo() {
    document.getElementById("freeMemo").value = localStorage.getItem(FREE_MEMO_KEY) || "";
}

function deleteDoc(idx) {
    if(confirm("この書類を削除しますか？")) {
        projects[currentProjectId].docs.splice(idx, 1);
        saveAll(); renderTable();
    }
}

function deleteCurrentProject() {
    if(confirm("この案件を削除しますか？")) {
        delete projects[currentProjectId];
        saveAll(); refreshProjectSelect(); switchProject("");
    }
}

function copyPath(p) {
    if(!p) { alert("パスが設定されていません"); return; }
    navigator.clipboard.writeText(p).then(() => alert("フォルダパスをコピーしました"));
}

function exportExcel() {
    const wb = XLSX.utils.table_to_book(document.getElementById("targetTable"));
    XLSX.writeFile(wb, `${projects[currentProjectId].name}_書類リスト.xlsx`);
}

function clearAllScanData() {
    if(confirm("スキャンしたすべてのPDFデータを完全に消去しますか？")) {
        sourceFiles = [];
        saveAll();
        renderFileList();
        document.getElementById('snippetContainer').innerHTML = "";
    }
}