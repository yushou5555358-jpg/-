/**
 * 提出書類管理システム ロジック
 * 機能を省略せず、すべての同期・処理プロセスを記述
 */

// GAS連携用エンドポイント
const GAS_URL = "https://script.google.com/macros/s/AKfycbwL-InP7z40rVvIbemlt6SG3Yadtkle6bnbIgJqfftWorjGnlYmE_ROF8MNSU2xFB49zQ/exec"; 

// グローバル変数
let projects = {};
let currentProjectId = "";
let viewDate = new Date();

// 重要度の重み付け（ソート用）
const IMPORTANCE_ORDER = { "至急": 1, "重要": 2, "通常": 3 };

// 新規案件作成時のデフォルト書類マスター
const INITIAL_MASTER = [
    { name: "施工計画書", target: "監督員", ref: "共通仕様書 1-1-1-6", status: "未着手", importance: "通常", deadline: "", fileData: "" },
    { name: "施工体制台帳", target: "監督員", ref: "適正化法 第11条", status: "未着手", importance: "通常", deadline: "", fileData: "" },
    { name: "段階確認願", target: "監督員", ref: "共通仕様書 1-1-1-17", status: "未着手", importance: "通常", deadline: "", fileData: "" },
    { name: "完成図書", target: "監督員", ref: "共通仕様書 1-1-1-23", status: "未着手", importance: "通常", deadline: "", fileData: "" }
];

/**
 * 初期化処理
 */
window.onload = async function() {
    console.log("System initialization started.");
    
    // 共通メモの復元
    loadFreeMemo();
    
    // クラウドからデータ取得
    if (GAS_URL.includes("http")) {
        await loadFromCloud();
    }
    
    // 案件選択リストの更新
    refreshProjectSelect();
    
    // 共通メモの自動保存設定
    document.getElementById("freeMemo").addEventListener("input", (e) => {
        localStorage.setItem("doc_manager_free_memo", e.target.value);
    });
};

/**
 * クラウド保存処理（同期強化版）
 */
async function saveAll() {
    if (!GAS_URL.includes("http")) return;
    
    try {
        console.log("Cloud saving initiated...");
        const response = await fetch(GAS_URL, { 
            method: "POST", 
            body: JSON.stringify({ 
                method: "save", 
                payload: JSON.stringify({ projects }) 
            }) 
        });
        
        const result = await response.json();
        if (result.status === "ok") {
            console.log("Cloud sync successful.");
        } else {
            console.error("Cloud sync failed with status:", result.status);
        }
        
        // 保存後にカレンダー表示なども最新にする
        renderCalendar();
    } catch (e) { 
        console.error("Critical Save Error:", e);
        alert("クラウドへの保存に失敗しました。接続状況を確認してください。");
    }
}

/**
 * クラウド読み込み処理
 */
async function loadFromCloud() {
    try {
        console.log("Fetching data from cloud...");
        const response = await fetch(GAS_URL, { 
            method: "POST", 
            body: JSON.stringify({ method: "load" }) 
        });
        
        const result = await response.json();
        if (result && result.projects) {
            projects = result.projects;
            console.log("Data loaded successfully.");
        }
        
        // 画面描画の更新
        if (currentProjectId) {
            renderTable();
            renderCalendar();
        }
    } catch (e) { 
        console.error("Critical Load Error:", e);
    }
}

/**
 * ファイルアップロード・添付処理
 * PDFデータをBase64に変換し、確実にクラウドへ送信する
 */
function handleFileUpload(index, file) {
    if (!file) return;
    
    // 容量制限 (5MB) - スプレッドシートのセル容量を考慮
    if (file.size > 5 * 1024 * 1024) {
        alert("ファイルサイズが大きすぎます（最大5MBまで）。");
        return;
    }

    const reader = new FileReader();
    
    // UI上での進捗表示
    const parentNode = event.target.parentNode;
    const statusMsg = document.createElement("span");
    statusMsg.innerText = " ⏳ クラウドへ転送中...";
    statusMsg.style.color = "#4a90e2";
    statusMsg.style.fontSize = "0.8rem";
    parentNode.appendChild(statusMsg);

    reader.onload = async function(e) {
        // fileDataにBase64エンコードされたPDFデータを格納
        projects[currentProjectId].docs[index].fileData = e.target.result;
        
        // クラウドへ即時保存（完了を待機）
        await saveAll();
        
        statusMsg.innerText = " ✅ 同期完了";
        setTimeout(() => {
            if (statusMsg.parentNode) statusMsg.remove();
        }, 3000);
        
        renderTable();
    };
    
    reader.onerror = function() {
        alert("ファイルの読み取り中にエラーが発生しました。");
        statusMsg.remove();
    };
    
    reader.readAsDataURL(file);
}

/**
 * 書類テーブルの描画
 */
function renderTable() {
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = "";
    
    if (!currentProjectId || !projects[currentProjectId]) return;
    
    // 表示用にソート（未完了を上、かつ重要度順）
    const sortedDocs = [...projects[currentProjectId].docs].sort((a, b) => {
        const statusA = a.status === '提出済' ? 1 : 0;
        const statusB = b.status === '提出済' ? 1 : 0;
        
        if (statusA !== statusB) return statusA - statusB;
        return (IMPORTANCE_ORDER[a.importance] || 3) - (IMPORTANCE_ORDER[b.importance] || 3);
    });

    sortedDocs.forEach((item) => {
        const realIndex = projects[currentProjectId].docs.indexOf(item);
        const row = tbody.insertRow();
        
        if (item.status === '提出済') {
            row.style.opacity = "0.6";
            row.style.backgroundColor = "#fdfdfd";
        }

        row.innerHTML = `
            <td style="text-align:center;">
                <input type="checkbox" style="transform: scale(1.5);" ${item.status==='提出済'?'checked':''} 
                       onchange="updateDocField(${realIndex}, 'status', this.checked?'提出済':'未着手');">
            </td>
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
                ${item.fileData ? `<a href="${item.fileData}" download="${item.name}.pdf" class="btn-pdf-link">📄 表示/保存</a><br>` : ''}
                <button onclick="document.getElementById('fileInput${realIndex}').click()" class="btn-add-blue" style="margin-top:8px; font-size:0.8rem; padding:8px 12px;">
                    ${item.fileData ? '再添付' : '📎 ファイル添付'}
                </button>
                <input type="file" id="fileInput${realIndex}" style="display:none" accept="application/pdf" onchange="handleFileUpload(${realIndex}, this.files[0])">
            </td>
            <td><button onclick="deleteDoc(${realIndex})" class="btn-icon-delete">削除</button></td>
        `;
    });
}

/**
 * 書類フィールドの更新
 */
function updateDocField(index, field, value) {
    if (!currentProjectId) return;
    
    projects[currentProjectId].docs[index][field] = value;
    saveAll();
    
    // 状態や日付が変わった場合は再描画
    if (field === 'status' || field === 'importance' || field === 'deadline') {
        renderTable();
    }
}

/**
 * 案件作成・切替
 */
function createNewProject() {
    const name = document.getElementById("newProjectName").value.trim();
    if (!name) {
        alert("案件名を入力してください。");
        return;
    }
    
    const id = "pj_" + Date.now();
    projects[id] = { 
        name: name, 
        start: "", 
        end: "", 
        docs: JSON.parse(JSON.stringify(INITIAL_MASTER)), 
        projectMemo: "" 
    };
    
    document.getElementById("newProjectName").value = "";
    saveAll();
    refreshProjectSelect();
    switchProject(id);
}

function switchProject(id) {
    currentProjectId = id;
    const isSelected = !!id;
    
    // 表示制御
    document.getElementById("projectDateArea").style.display = isSelected ? "flex" : "none";
    document.getElementById("projectMemoArea").style.display = isSelected ? "block" : "none";
    document.getElementById("listArea").style.display = isSelected ? "block" : "none";
    
    if (isSelected) {
        const pj = projects[id];
        document.getElementById("projectStart").value = pj.start || "";
        document.getElementById("projectEnd").value = pj.end || "";
        document.getElementById("projectSpecificMemo").value = pj.projectMemo || "";
        document.getElementById("projectSelect").value = id;
        
        updateCountdown();
        renderTable();
        renderCalendar();
    }
}

function refreshProjectSelect() {
    const select = document.getElementById("projectSelect");
    select.innerHTML = '<option value="">案件を選択してください</option>';
    
    for (let id in projects) {
        const option = document.createElement("option");
        option.value = id;
        option.innerText = projects[id].name;
        select.appendChild(option);
    }
    
    if (currentProjectId) {
        select.value = currentProjectId;
    }
}

/**
 * 竣工カウントダウン
 */
function updateCountdown() {
    const element = document.getElementById("projectCountdown");
    const pj = projects[currentProjectId];
    
    if (!pj || !pj.end) {
        element.innerText = "竣工日を設定してください";
        return;
    }
    
    const today = new Date().setHours(0,0,0,0);
    const endDate = new Date(pj.end).getTime();
    const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        element.innerHTML = `🏁 ${pj.name}： <strong>竣工済み</strong>`;
    } else {
        element.innerHTML = `🏁 ${pj.name} 竣工まで： あと <strong>${diffDays}</strong> 日`;
    }
}

/**
 * 案件個別メモ・工期保存
 */
function saveProjectMemo() {
    if (!currentProjectId) return;
    projects[currentProjectId].projectMemo = document.getElementById("projectSpecificMemo").value;
    saveAll();
}

function updateProjectDates() {
    if (!currentProjectId) return;
    projects[currentProjectId].start = document.getElementById("projectStart").value;
    projects[currentProjectId].end = document.getElementById("projectEnd").value;
    saveAll();
    updateCountdown();
    renderCalendar();
}

/**
 * 書類追加・削除
 */
function addNewDocument() {
    if (!currentProjectId) return;
    
    const name = document.getElementById("newDocName").value.trim();
    if (!name) return;
    
    projects[currentProjectId].docs.push({
        status: "未着手",
        importance: document.getElementById("newDocImportance").value,
        name: name,
        target: document.getElementById("newDocTarget").value,
        deadline: document.getElementById("newDocDeadline").value,
        ref: document.getElementById("newDocRef").value,
        fileData: ""
    });
    
    // フォームリセット
    document.getElementById("newDocName").value = "";
    document.getElementById("newDocTarget").value = "";
    document.getElementById("newDocRef").value = "";
    
    saveAll();
    renderTable();
}

function deleteDoc(index) {
    if (confirm("この書類をリストから完全に削除しますか？")) {
        projects[currentProjectId].docs.splice(index, 1);
        saveAll();
        renderTable();
    }
}

function deleteCurrentProject() {
    if (!currentProjectId) return;
    if (confirm(`案件「${projects[currentProjectId].name}」の全データを完全に削除しますか？`)) {
        delete projects[currentProjectId];
        saveAll();
        currentProjectId = "";
        refreshProjectSelect();
        switchProject("");
    }
}

/**
 * タブ切り替え
 */
function switchTab(tabId, buttonElement) {
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    buttonElement.classList.add('active');
}

/**
 * 共通メモ処理
 */
function loadFreeMemo() {
    document.getElementById("freeMemo").value = localStorage.getItem("doc_manager_free_memo") || "";
}

/**
 * カレンダー描画
 */
function renderCalendar() {
    const grid = document.getElementById("calendarGrid");
    if (!grid) return;
    grid.innerHTML = "";
    
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    document.getElementById("currentMonthDisplay").innerText = `${year}年 ${month + 1}月`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    // 曜日の見出し
    const days = ['日','月','火','水','木','金','土'];
    days.forEach(d => {
        const head = document.createElement("div");
        head.style.backgroundColor = "#f1f4f7";
        head.style.fontWeight = "bold";
        head.style.textAlign = "center";
        head.style.padding = "10px";
        head.innerText = d;
        grid.appendChild(head);
    });

    // 空白マス
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement("div");
        empty.className = "calendar-day";
        empty.style.backgroundColor = "#fafafa";
        grid.appendChild(empty);
    }
    
    // 日付マス
    for (let d = 1; d <= lastDate; d++) {
        const cell = document.createElement("div");
        cell.className = "calendar-day";
        cell.innerHTML = `<b>${d}</b>`;
        
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        
        // 全案件の締切をチェック（現在選択中案件のみに絞ることも可能）
        if (currentProjectId && projects[currentProjectId]) {
            projects[currentProjectId].docs.forEach(doc => {
                if (doc.deadline === dateStr) {
                    const label = document.createElement("div");
                    label.className = "event-label";
                    if (doc.importance !== "通常") label.style.fontWeight = "bold";
                    if (doc.status === "提出済") {
                        label.style.opacity = "0.5";
                        label.style.textDecoration = "line-through";
                    }
                    label.innerText = doc.name;
                    cell.appendChild(label);
                }
            });
        }
        grid.appendChild(cell);
    }
}

function changeMonth(delta) {
    viewDate.setMonth(viewDate.getMonth() + delta);
    renderCalendar();
}

/**
 * 資料スキャン（PDFプレビュー）処理
 */
async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) processPDF(file);
}

async function processPDF(file) {
    if (!file || file.type !== "application/pdf") {
        alert("PDFファイルを選択してください。");
        return;
    }
    
    const status = document.getElementById("scanStatus");
    const previewArea = document.getElementById("pdfPreviewArea");
    
    status.innerText = "⏳ PDFを解析してプレビューを生成中...";
    previewArea.innerHTML = "";

    try {
        const reader = new FileReader();
        reader.onload = async function() {
            const typedarray = new Uint8Array(this.result);
            // pdf.jsでドキュメント読み込み
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            status.innerText = `全 ${pdf.numPages} ページを読み込みました。`;

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 0.6 });
                
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                await page.render({ 
                    canvasContext: context, 
                    viewport: viewport 
                }).promise;
                
                previewArea.appendChild(canvas);
            }
            status.innerText = `読み込み完了（全${pdf.numPages}ページ）`;
        };
        reader.readAsArrayBuffer(file);
    } catch (e) {
        console.error("PDF Processing Error:", e);
        status.innerText = "PDFの読み込みに失敗しました。";
    }
}