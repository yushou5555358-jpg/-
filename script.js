// 1. あなたの最新のGAS URL
const GAS_URL = "https://script.google.com/macros/s/AKfycbyO5DALn4wym6L1k0PRp49eulfoUiYgZNZPc1pXZw5bP65P8cyKyLUcnLrxvi27-msdVA/exec"; 

let projects = {};
let currentProjectId = "";
let viewDate = new Date();

const IMPORTANCE_ORDER = { "至急": 1, "重要": 2, "通常": 3 };

const INITIAL_MASTER = [
    { name: "施工計画書", target: "監督員", ref: "共通仕様書 1-1-1-6", status: "未着手", importance: "通常", deadline: "", fileData: "" },
    { name: "施工体制台帳", target: "監督員", ref: "適正化法 第11条", status: "未着手", importance: "通常", deadline: "", fileData: "" },
    { name: "段階確認願", target: "監督員", ref: "共通仕様書 1-1-1-17", status: "未着手", importance: "通常", deadline: "", fileData: "" },
    { name: "完成図書", target: "監督員", ref: "共通仕様書 1-1-1-23", status: "未着手", importance: "通常", deadline: "", fileData: "" }
];

window.onload = async function() {
    loadFreeMemo();
    if (GAS_URL.includes("http")) await loadFromCloud();
    refreshProjectSelect();
    document.getElementById("freeMemo").addEventListener("input", (e) => localStorage.setItem("doc_manager_free_memo", e.target.value));
};

async function saveAll() {
    if (!GAS_URL.includes("http")) return;
    try {
        await fetch(GAS_URL, { 
            method: "POST", 
            body: JSON.stringify({ method: "save", payload: JSON.stringify({ projects }) }) 
        });
        console.log("Cloud Saved");
    } catch (e) { console.error("Save Error:", e); }
}

async function loadFromCloud() {
    try {
        const response = await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ method: "load" }) });
        const result = await response.json();
        if (result && result.projects) projects = result.projects;
        renderTable();
        renderCalendar();
    } catch (e) { console.error("Load Error:", e); }
}

// 【重要】PDFをGoogleドライブへアップロードする関数
async function handleFileUpload(index, file) {
    if (!file) return;
    
    const parentNode = event.target.parentNode;
    const statusMsg = document.createElement("span");
    statusMsg.innerText = " ⏳ クラウド保存中...";
    statusMsg.style.color = "blue";
    parentNode.appendChild(statusMsg);

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            // GAS経由でGoogleドライブに保存
            const uploadRes = await fetch(GAS_URL, {
                method: "POST",
                body: JSON.stringify({
                    method: "uploadFile",
                    filename: file.name,
                    data: e.target.result
                })
            });
            const fileInfo = await uploadRes.json();
            
            // 取得したURL（ドライブのリンク）を保存
            projects[currentProjectId].docs[index].fileData = fileInfo.url;
            
            // 全体リストを更新保存
            await saveAll();
            
            statusMsg.innerText = " ✅ 同期完了";
            setTimeout(() => statusMsg.remove(), 2000);
            renderTable();
        } catch (err) {
            alert("アップロードに失敗しました。GASのコードが新しいものか確認してください。");
            statusMsg.remove();
        }
    };
    reader.readAsDataURL(file);
}

function renderTable() {
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = "";
    if(!currentProjectId || !projects[currentProjectId]) return;
    
    const sortedDocs = [...projects[currentProjectId].docs].sort((a, b) => {
        const statusA = a.status === '提出済' ? 1 : 0;
        const statusB = b.status === '提出済' ? 1 : 0;
        if (statusA !== statusB) return statusA - statusB;
        return (IMPORTANCE_ORDER[a.importance] || 3) - (IMPORTANCE_ORDER[b.importance] || 3);
    });

    sortedDocs.forEach((item) => {
        const realIndex = projects[currentProjectId].docs.indexOf(item);
        const row = tbody.insertRow();
        if (item.status === '提出済') row.style.opacity = "0.5";

        row.innerHTML = `
            <td><input type="checkbox" ${item.status==='提出済'?'checked':''} onchange="updateDocField(${realIndex}, 'status', this.checked?'提出済':'未着手');"></td>
            <td>
                <select onchange="updateDocField(${realIndex}, 'importance', this.value);" class="custom-select">
                    <option value="通常" ${item.importance==='通常'?'selected':''}>通常</option>
                    <option value="重要" ${item.importance==='重要'?'selected':''}>重要</option>
                    <option value="至急" ${item.importance==='至急'?'selected':''}>至急</option>
                </select>
            </td>
            <td><b style="${item.importance==='至急'?'color:red;':''}">${item.name}</b></td>
            <td>${item.target}</td>
            <td><input type="date" value="${item.deadline}" onchange="updateDocField(${realIndex}, 'deadline', this.value);" class="custom-date"></td>
            <td><input type="text" value="${item.ref || ''}" onchange="updateDocField(${realIndex}, 'ref', this.value)" class="custom-input"></td>
            <td>
                ${item.fileData ? `<a href="${item.fileData}" target="_blank" class="btn-pdf-link">📄 表示/保存</a><br>` : ''}
                <button onclick="document.getElementById('fileInput${realIndex}').click()" class="btn-add-blue" style="margin-top:5px;">
                    ${item.fileData ? '再添付' : '📎 添付'}
                </button>
                <input type="file" id="fileInput${realIndex}" style="display:none" accept="application/pdf" onchange="handleFileUpload(${realIndex}, this.files[0])">
            </td>
            <td><button onclick="deleteDoc(${realIndex})" class="btn-icon-delete">×</button></td>
        `;
    });
}

// 以下、共通機能（省略なし）
function updateDocField(i, f, v) { projects[currentProjectId].docs[i][f] = v; saveAll(); if (['status','importance','deadline'].includes(f)) renderTable(); }
function refreshProjectSelect() {
    const s = document.getElementById("projectSelect");
    s.innerHTML = '<option value="">案件を選択</option>';
    for (let id in projects) s.innerHTML += `<option value="${id}">${projects[id].name}</option>`;
    if(currentProjectId) s.value = currentProjectId;
}
function createNewProject() {
    const name = document.getElementById("newProjectName").value.trim();
    if (!name) return;
    const id = "pj_" + Date.now();
    projects[id] = { name, start: "", end: "", docs: JSON.parse(JSON.stringify(INITIAL_MASTER)), projectMemo: "" };
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
function switchTab(id, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active'); btn.classList.add('active');
}
function updateCountdown() {
    const el = document.getElementById("projectCountdown");
    const pj = projects[currentProjectId];
    if (!pj || !pj.end) { el.innerText = "竣工日をセットしてください"; return; }
    const diff = Math.ceil((new Date(pj.end) - new Date().setHours(0,0,0,0)) / 86400000);
    el.innerHTML = `🏁 ${pj.name} 竣工まで あと <strong>${diff}</strong> 日`;
}
function saveProjectMemo() { if(!currentProjectId) return; projects[currentProjectId].projectMemo = document.getElementById("projectSpecificMemo").value; saveAll(); }
function updateProjectDates() { if(!currentProjectId) return; projects[currentProjectId].start = document.getElementById("projectStart").value; projects[currentProjectId].end = document.getElementById("projectEnd").value; saveAll(); updateCountdown(); renderCalendar(); }
function loadFreeMemo() { document.getElementById("freeMemo").value = localStorage.getItem("doc_manager_free_memo") || ""; }
function renderCalendar() {
    const grid = document.getElementById("calendarGrid");
    if (!grid) return; grid.innerHTML = "";
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    document.getElementById("currentMonthDisplay").innerText = `${y}年 ${m + 1}月`;
    const firstDay = new Date(y, m, 1).getDay();
    const lastDate = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) grid.appendChild(document.createElement("div")).className = "calendar-day";
    for (let d = 1; d <= lastDate; d++) {
        const cell = document.createElement("div"); cell.className = "calendar-day"; cell.innerHTML = `<b>${d}</b>`;
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (currentProjectId && projects[currentProjectId]) {
            projects[currentProjectId].docs.forEach(doc => {
                if (doc.deadline === dateStr) {
                    const label = document.createElement("div"); label.className = "event-label";
                    if (doc.importance !== "通常") label.classList.add("important");
                    label.innerText = doc.name; cell.appendChild(label);
                }
            });
        }
        grid.appendChild(cell);
    }
}
function changeMonth(d) { viewDate.setMonth(viewDate.getMonth() + d); renderCalendar(); }
function deleteDoc(i) { if(confirm("削除しますか？")){ projects[currentProjectId].docs.splice(i, 1); saveAll(); renderTable(); } }
function deleteCurrentProject() { if(confirm("消去しますか？")) { delete projects[currentProjectId]; saveAll(); refreshProjectSelect(); switchProject(""); } }
function addNewDocument() {
    if (!currentProjectId) return;
    const name = document.getElementById("newDocName").value.trim();
    if (!name) return;
    projects[currentProjectId].docs.push({ status: "未着手", importance: document.getElementById("newDocImportance").value, name, target: document.getElementById("newDocTarget").value, deadline: document.getElementById("newDocDeadline").value, ref: document.getElementById("newDocRef").value, fileData: "" });
    document.getElementById("newDocName").value = "";
    saveAll(); renderTable();
}
async function handleFileSelect(e) { processPDF(e.target.files[0]); }
async function processPDF(file) {
    if (!file || file.type !== "application/pdf") return;
    const status = document.getElementById("scanStatus");
    const previewArea = document.getElementById("pdfPreviewArea");
    status.innerText = "読み込み中...";
    previewArea.innerHTML = "";
    const reader = new FileReader();
    reader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({scale: 0.5});
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            canvas.height = viewport.height; canvas.width = viewport.width;
            await page.render({canvasContext: context, viewport: viewport}).promise;
            previewArea.appendChild(canvas);
        }
        status.innerText = "完了";
    };
    reader.readAsArrayBuffer(file);

}
