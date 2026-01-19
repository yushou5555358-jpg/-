const GAS_URL = "https://script.google.com/macros/s/AKfycbzTWF1NEmCXQ1SGQDP92N7MU1hrnydKAoYzDAeCPGCUGiKKLZmXuZlX_Y9a0upMfAyy/exec"; // ★ここに先ほどのURLを貼り付け！

let projects = {};
let currentProjectId = "";
let sourceFiles = [];
const FREE_MEMO_KEY = "doc_manager_free_memo";

// --- 起動時の処理 ---
window.onload = async function() {
    loadFreeMemo();
    initPdfFeatures();
    
    // クラウドからデータを読み込む
    await loadFromCloud();
    
    refreshProjectSelect();
    
    // 共通メモの保存設定
    document.getElementById("freeMemo").addEventListener("input", () => {
        localStorage.setItem(FREE_MEMO_KEY, document.getElementById("freeMemo").value);
    });
};

/* --- クラウド同期機能（GAS通信） --- */

// データを保存する関数
async function saveAll() {
    const status = document.getElementById("scanStatus");
    if(status) status.innerText = "⏳ 保存中...";

    const data = JSON.stringify({ projects, sourceFiles });
    
    try {
        const response = await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({ method: "save", payload: data })
        });
        if(status) status.innerText = "✅ クラウドに保存完了";
    } catch (e) {
        console.error("保存失敗:", e);
        if(status) status.innerText = "❌ 保存エラー（ネット接続を確認）";
    }
}

// データを読み込む関数
async function loadFromCloud() {
    const status = document.getElementById("scanStatus");
    if(status) status.innerText = "⏳ データを同期中...";

    try {
        const response = await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({ method: "load" })
        });
        const result = await response.json();
        
        projects = result.projects || {};
        sourceFiles = result.sourceFiles || [];
        
        if(status) status.innerText = "✅ 同期完了";
    } catch (e) {
        console.error("読み込み失敗:", e);
        if(status) status.innerText = "❌ 同期失敗";
    }
}

/* --- 案件・メモ管理ロジック --- */

function saveProjectMemo() {
    if (!currentProjectId) return;
    projects[currentProjectId].projectMemo = document.getElementById("projectSpecificMemo").value;
    saveAll(); // 入力するたびにクラウド保存
}

function updateProjectDates() {
    if (!currentProjectId) return;
    projects[currentProjectId].start = document.getElementById("projectStart").value;
    projects[currentProjectId].end = document.getElementById("projectEnd").value;
    saveAll();
    updateCountdown();
}

function createNewProject() {
    const name = document.getElementById("newProjectName").value.trim();
    if (!name) return alert("案件名を入力してください");
    const id = "pj_" + Date.now();
    projects[id] = { name: name, start: "", end: "", docs: [], projectMemo: "" };
    saveAll();
    refreshProjectSelect();
    switchProject(id);
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
        updateCountdown(); 
        renderTable();
    } else {
        document.getElementById("projectCountdown").innerText = "案件を選択してください";
    }
}

function updateCountdown() {
    const display = document.getElementById("projectCountdown");
    if (!currentProjectId || !projects[currentProjectId]) return;
    const pj = projects[currentProjectId];
    if (!pj.end) { display.innerText = "工期(終了日)をセットしてください"; return; }
    
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const endDay = new Date(pj.end);
    const diff = Math.ceil((endDay - today) / (1000 * 60 * 60 * 24));
    
    if (diff > 0) display.innerHTML = `🏁 ${pj.name} 竣工まで あと<span class="days-num">${diff}</span>日`;
    else if (diff === 0) display.innerHTML = `🏁 ${pj.name} 本日が竣工日です`;
    else display.innerHTML = `🏁 ${pj.name} 竣工から ${Math.abs(diff)}日経過`;
}

function refreshProjectSelect() {
    const select = document.getElementById("projectSelect");
    if(!select) return;
    select.innerHTML = '<option value="">-- 案件 --</option>';
    for (let id in projects) {
        const opt = document.createElement("option");
        opt.value = id; opt.innerText = projects[id].name;
        select.appendChild(opt);
    }
}

/* --- 書類リスト管理 --- */
function renderTable() {
    if (!currentProjectId) return;
    const docs = projects[currentProjectId].docs || [];
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = "";
    const priorityOrder = { "最優先★★": 1, "重要★": 2, "通常": 3 };
    
    docs.map((d, i) => ({...d, originalIndex: i})).sort((a, b) => {
        if (a.completed !== b.completed) return a.completed - b.completed;
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    }).forEach(item => {
        const row = tbody.insertRow();
        if (item.completed) row.className = "row-completed";
        row.innerHTML = `
            <td style="text-align:center"><input type="checkbox" ${item.completed ? "checked" : ""} onchange="toggleComplete(${item.originalIndex})" style="width:20px;height:20px;"></td>
            <td><select style="border:none; background:transparent; font-size:0.8rem;" onchange="updateCell(${item.originalIndex}, 'priority', this.value)">
                <option value="最優先★★" ${item.priority === '最優先★★' ? 'selected' : ''}>最優先★★</option>
                <option value="重要★" ${item.priority === '重要★' ? 'selected' : ''}>重要★</option>
                <option value="通常" ${item.priority === '通常' ? 'selected' : ''}>通常</option>
            </select></td>
            <td contenteditable="true" onblur="updateCell(${item.originalIndex}, 'docName', this.innerText)"><b>${item.docName}</b></td>
            <td contenteditable="true" onblur="updateCell(${item.originalIndex}, 'target', this.innerText)">${item.target}</td>
            <td contenteditable="true" onblur="updateCell(${item.originalIndex}, 'deadline', this.innerText)">${item.deadline}</td>
            <td contenteditable="true" onblur="updateCell(${item.originalIndex}, 'memo', this.innerText)">${item.memo}</td>
            <td>${item.filePath ? `<button onclick="copyPath('${item.filePath.replace(/\\/g, "\\\\")}')">📋</button>` : '-'}</td>
            <td><button onclick="deleteDoc(${item.originalIndex})" class="btn-delete" style="padding:5px 10px;">×</button></td>
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
    saveAll(); 
    renderTable();
    ["docName", "target", "deadline", "filePath", "memo"].forEach(id => document.getElementById(id).value = "");
}

function updateCell(idx, field, val) { projects[currentProjectId].docs[idx][field] = val; saveAll(); renderTable(); }
function toggleComplete(idx) { projects[currentProjectId].docs[idx].completed = !projects[currentProjectId].docs[idx].completed; saveAll(); renderTable(); }
function deleteDoc(idx) { if (confirm("削除？")) { projects[currentProjectId].docs.splice(idx, 1); saveAll(); renderTable(); } }

/* --- PDF/スキャン機能 --- */
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
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window['pdfjs-dist/build/pdf'].getDocument(arrayBuffer).promise;
            let pageData = {};
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                pageData[i] = content.items.map(item => item.str).join(' ');
            }
            sourceFiles.push({ fileName: file.name, pages: pageData, base64: base64 });
        }
        await saveAll(); // クラウドに保存
        renderFileList(); 
        analyzeCrossSearch();
        status.innerText = "✅ スキャン完了";
    } catch (e) { status.innerText = "❌ 解析エラー"; }
}

function analyzeCrossSearch() {
    const container = document.getElementById('snippetContainer');
    const query = document.getElementById('customSearchWords').value;
    if(!container) return;
    container.innerHTML = "";
    const keywords = query ? query.split(/[,、\s]+/).filter(w => w.length > 0) : [];
    if (keywords.length === 0) return;

    sourceFiles.forEach((file, fileIdx) => {
        for (let p in file.pages) {
            keywords.forEach(word => {
                if (file.pages[p].includes(word)) {
                    const div = document.createElement("div");
                    div.className = "snippet-card";
                    div.onclick = () => openPdfPreview(fileIdx, p);
                    const idx = file.pages[p].indexOf(word);
                    div.innerHTML = `
                        <div class="snippet-header"><span>📄 ${file.fileName}</span><span>P.${p}</span></div>
                        <div style="font-size:0.8rem;">...${file.pages[p].substring(idx-15, idx+30)}...</div>
                    `;
                    container.appendChild(div);
                }
            });
        }
    });
}

function openPdfPreview(fileIdx, pageNum) {
    const file = sourceFiles[fileIdx];
    const viewer = document.getElementById('pdfViewer');
    const placeholder = document.getElementById('previewPlaceholder');
    viewer.style.display = "none";
    viewer.src = "";
    setTimeout(() => {
        viewer.src = file.base64 + "#page=" + pageNum;
        viewer.style.display = "block";
        placeholder.style.display = "none";
    }, 50); 
}

/* --- その他共通機能 --- */
function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}

function loadFreeMemo() { 
    document.getElementById("freeMemo").value = localStorage.getItem(FREE_MEMO_KEY) || ""; 
}

// 念のためのエクスポート機能（手元にjson保存）
function exportData() {
    const data = JSON.stringify({ projects, sourceFiles });
    const blob = new Blob([data], {type: "application/json"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "書類管理バックアップ.json"; a.click();
}

function renderFileList() {
    const list = document.getElementById('fileList');
    if(!list) return;
    list.innerHTML = sourceFiles.map((f, i) => `<div class="file-chip" style="font-size:0.7rem; padding:3px 8px;">📄 ${f.fileName.substring(0,10)}... <span onclick="sourceFiles.splice(${i},1);saveAll();renderFileList();">×</span></div>`).join('');
}

function exportExcel() { XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById("targetTable")), `書類リスト.xlsx`); }
function copyPath(p) { navigator.clipboard.writeText(p).then(() => alert("パスをコピーしました")); }
function deleteCurrentProject() { if(confirm("この案件を削除しますか？")) { delete projects[currentProjectId]; saveAll(); refreshProjectSelect(); switchProject(""); } }
function clearAllScanData() { if(confirm("スキャンした全資料を消去しますか？")) { sourceFiles=[]; saveAll(); renderFileList(); } }