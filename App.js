let surveyData = [];
let currentBlockIndex = 0;
let answers = {};
let viewedQuestions = new Set();
let skippedQuestions = new Set();
let locationName = "";
let auditDate = "";

const progressFill = document.querySelector(".progress-fill");
const uploadScreen = document.getElementById("uploadScreen");
const locationDateScreen = document.getElementById("locationDateScreen");
const surveyScreen = document.getElementById("surveyScreen");
const resultsScreen = document.getElementById("resultsScreen");
const skippedIndicator = document.getElementById("skippedIndicator");
const skippedCount = document.getElementById("skippedCount");

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        parseSurvey(rows);
    };
    reader.readAsArrayBuffer(file);
}

function parseSurvey(rows) {
    const blocks = {};

    rows.slice(1).forEach(row => {
        const block = row[0];
        const question = row[1];
        if (!block || !question) return;

        if (!blocks[block]) blocks[block] = [];
        blocks[block].push({
            id: crypto.randomUUID(),
            text: question
        });
    });

    surveyData = Object.keys(blocks).map(name => ({
        blockName: name,
        questions: blocks[name]
    }));

    uploadScreen.classList.add("hidden");
    locationDateScreen.classList.add("active");
}

function startAudit() {
    locationName = document.getElementById("locationInput").value.trim();
    auditDate = document.getElementById("dateInput").value;

    if (!locationName || !auditDate) return;

    locationDateScreen.classList.remove("active");
    surveyScreen.classList.add("active");

    renderBlock();
}

function renderBlock() {
    const block = surveyData[currentBlockIndex];
    document.getElementById("blockTitle").textContent = block.blockName;
    document.getElementById("blockCounter").textContent =
        `Блок ${currentBlockIndex + 1} из ${surveyData.length}`;

    const container = document.getElementById("questionsContainer");
    container.innerHTML = "";

    block.questions.forEach((q, index) => {
        viewedQuestions.add(q.id);

        const div = document.createElement("div");
        div.className = "question-item";

        div.innerHTML = `
            <div class="question-number">Вопрос ${index + 1}</div>
            <div class="question-text">${q.text}</div>
            <div class="answer-options">
                ${[0, 0.5, 1].map(val => `
                    <button class="answer-btn" onclick="selectAnswer('${q.id}', ${val}, this)">
                        ${val}
                    </button>
                `).join("")}
            </div>
            <div class="comment-section">
                <textarea placeholder="Комментарий..."
                    onchange="saveComment('${q.id}', this.value)"></textarea>
            </div>
            <div class="photo-section">
                <input type="file" accept="image/*" multiple
                    onchange="handlePhotoUpload(event, '${q.id}')">
                <div id="photos-${q.id}" class="photo-preview"></div>
            </div>
        `;
        container.appendChild(div);
    });

    updateSkipped();
    updateProgress();
}

function selectAnswer(id, value, btn) {
    answers[id] = answers[id] || {};
    answers[id].score = value;

    btn.parentNode.querySelectorAll("button")
        .forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");

    skippedQuestions.delete(id);
    updateSkipped();
}

function saveComment(id, text) {
    answers[id] = answers[id] || {};
    answers[id].comment = text;
}

function handlePhotoUpload(event, id) {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    answers[id] = answers[id] || {};
    if (!answers[id].photos) answers[id].photos = [];

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            answers[id].photos.push(e.target.result);
            renderPhotos(id);
        };
        reader.readAsDataURL(file);
    });

    event.target.value = "";
}

function renderPhotos(id) {
    const container = document.getElementById(`photos-${id}`);
    container.innerHTML = "";

    answers[id].photos.forEach((src, index) => {
        const div = document.createElement("div");
        div.className = "photo-item";
        div.innerHTML = `
            <img src="${src}">
            <button onclick="removePhoto('${id}', ${index})">×</button>
        `;
        container.appendChild(div);
    });
}

function removePhoto(id, index) {
    answers[id].photos.splice(index, 1);
    renderPhotos(id);
}

function nextBlock() {
    markSkipped();
    if (currentBlockIndex < surveyData.length - 1) {
        currentBlockIndex++;
        renderBlock();
    } else {
        finishAudit();
    }
}

function previousBlock() {
    if (currentBlockIndex > 0) {
        currentBlockIndex--;
        renderBlock();
    }
}

function markSkipped() {
    surveyData[currentBlockIndex].questions.forEach(q => {
        if (!answers[q.id] || answers[q.id].score == null) {
            skippedQuestions.add(q.id);
        }
    });
}

function updateSkipped() {
    if (skippedQuestions.size > 0) {
        skippedIndicator.style.display = "block";
        skippedCount.textContent = skippedQuestions.size;
    } else {
        skippedIndicator.style.display = "none";
    }
}

function goToSkipped() {
    alert("Перейдите к блоку с пропущенными вопросами.");
}

function updateProgress() {
    const percent = ((currentBlockIndex) / surveyData.length) * 100;
    progressFill.style.width = percent + "%";
}

function finishAudit() {
    surveyScreen.classList.remove("active");
    resultsScreen.classList.add("active");

    let total = 0;
    let max = 0;
    let blockHTML = "";

    surveyData.forEach(block => {
        let blockScore = 0;
        let blockMax = block.questions.length;
        block.questions.forEach(q => {
            max++;
            if (answers[q.id] && answers[q.id].score != null) {
                total += answers[q.id].score;
                blockScore += answers[q.id].score;
            }
        });

        const percent = Math.round((blockScore / blockMax) * 100);
        blockHTML += `
            <div class="block-result">
                <div>${block.blockName}</div>
                <div>${percent}%</div>
            </div>
        `;
    });

    document.getElementById("blockResults").innerHTML = blockHTML;
    document.getElementById("totalScore").textContent = total.toFixed(1);
    document.getElementById("totalPercentage").textContent =
        Math.round((total / max) * 100);
    document.getElementById("maxScore").textContent = max;
}

function generatePDF() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(locationName, 10, 10);
    doc.text(auditDate, 10, 18);

    doc.setFontSize(28);
    doc.text(document.getElementById("totalPercentage").textContent + "%", 10, 30);

    doc.save("audit.pdf");
}

function startOver() {
    location.reload();
}