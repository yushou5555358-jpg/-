// 【重要】ここにGASのデプロイURLを貼ってください
const GAS_URL = "https://script.google.com/macros/s/AKfycbzhC0sz7u3He5LhlTDjnoEOD8ORBu7-lYVRyVxq5efByc_CkuOpPAGU6JrnaRCO43PZ/exec"; 

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
    try {
        await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ method: "save", payload: JSON.stringify({ projects }) }) });
        renderCalendar();
    } catch (e) { console.error(e); }
}

async function loadFromCloud() {
    try {
        const response = await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ method: "load" }) });
        const result = await response.json();
        projects = result.projects || {};
    } catch (e) { console.error(e); }
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
    document.getElementById("projectDateArea").style.display = isSelected ? "block" : "none";
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

function handleFileUpload(index, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        projects[currentProjectId].docs[index].fileData = e.target.result;
        saveAll(); renderTable();
    };
    reader.readAsDataURL(file);
}

function renderTable() {
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = "";
    if(!currentProjectId) return;
    
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
            <td><input type="checkbox" ${item.status==='提出済'?'checked':''} onchange="updateDocField(${realIndex}, 'status', this.checked?'提出済':'未着手'); renderTable();"></td>
            <td>
                <select onchange="updateDocField(${realIndex}, 'importance', this.value); renderTable();" class="custom-select">
                    <option value="通常" ${item.importance==='通常'?'selected':''}>通常</option>
                    <option value="重要" ${item.importance==='重要'?'selected':''}>重要</option>
                    <option value="至急" ${item.importance==='至急'?'selected':''}>至急</option>
                </select>
            </td>
            <td><b style="${item.importance==='至急'?'color:red;':''}">${item.name}</b></td>
            <td>${item.target}</td>
            <td><input type="date" value="${item.deadline}" onchange="updateDocField(${realIndex}, 'deadline', this.value); renderTable();" class="custom-date"></td>
            <td><input type="text" value="${item.ref}" onchange="updateDocField(${realIndex}, 'ref', this.value)" class="custom-input"></td>
            <td>
                ${item.fileData ? `<a href="${item.fileData}" download="${item.name}" class="btn-pdf-link">📄 表示/保存</a><br>` : ''}
                <button onclick="document.getElementById('fileInput${realIndex}').click()" class="btn-add-blue" style="margin-top:5px;">
                    ${item.fileData ? '再添付' : '📎 添付'}
                </button>
                <input type="file" id="fileInput${realIndex}" style="display:none" onchange="handleFileUpload(${realIndex}, this.files[0])">
            </td>
            <td><button onclick="deleteDoc(${realIndex})" class="btn-icon-delete">×</button></td>
        `;
    });
    renderCalendar();
}

function updateDocField(i, f, v) { projects[currentProjectId].docs[i][f] = v; saveAll(); }
function refreshProjectSelect() {
    const s = document.getElementById("projectSelect");
    s.innerHTML = '<option value="">案件を選択</option>';
    for (let id in projects) s.innerHTML += `<option value="${id}">${projects[id].name}</option>`;
    if(currentProjectId) s.value = currentProjectId;
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
                    if (doc.status === "提出済") label.classList.add("completed");
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