// QuizYou - Role-Based Frontend Application Logic

const FALLBACK_STUDENTS = [
  { id: "dbacon89", firstName: "David", lastName: "Bacon", email: "dbacon89@bu.edu", role: "Student", active: true },
  { id: "saranneh", firstName: "Saranne", lastName: "Hobbs", email: "saranneh@bu.edu", role: "Student", active: true },
  { id: "smuren", firstName: "Sophia", lastName: "Muren", email: "smuren@bu.edu", role: "Student", active: true },
  { id: "chaman11", firstName: "Amir", lastName: "Moshtchaman", email: "chaman11@bu.edu", role: "Student", active: true },
  { id: "abhikoka", firstName: "Abhishikth", lastName: "Koka", email: "abhikoka@bu.edu", role: "Student", active: true },
  { id: "csmith00", firstName: "Cole", lastName: "Smith", email: "csmith00@bu.edu", role: "Student", active: true },
  { id: "professor", firstName: "Demo", lastName: "Professor", email: "professor@bu.edu", role: "Professor", active: true },
  { id: "admin", firstName: "Platform", lastName: "Admin", email: "admin@bu.edu", role: "Admin", active: true }
];

const FALLBACK_QUESTIONS = [
  { id: 1, subject: "Testing", topic: "Regression", question: "Which type of testing ensures that new code changes do not break existing functionality?", options: ["Unit Testing", "Regression Testing", "Integration Testing", "System Testing"], correctAnswer: 1, active: true },
  { id: 2, subject: "Agile", topic: "Scrum", question: "What is the primary purpose of a Daily Standup meeting in Scrum?", options: ["To give detailed status updates", "To assign tasks", "To sync progress, identify blockers, and plan the next 24 hours", "To demonstrate finished features"], correctAnswer: 2, active: true },
  { id: 3, subject: "Design Patterns", topic: "Creational", question: "Which design pattern restricts the instantiation of a class to one single instance?", options: ["Factory", "Observer", "Singleton", "Strategy"], correctAnswer: 2, active: true },
  { id: 4, subject: "Git", topic: "Remote", question: "Which Git command updates your local branch with remote changes and merges them?", options: ["git fetch", "git pull", "git push", "git checkout"], correctAnswer: 1, active: true },
  { id: 5, subject: "Testing", topic: "Unit", question: "Which test usually verifies one small function or method in isolation?", options: ["Unit Test", "System Test", "Acceptance Test", "Load Test"], correctAnswer: 0, active: true },
  { id: 6, subject: "Agile", topic: "Planning", question: "What is a product backlog?", options: ["A list of bugs only", "A prioritized list of desired work", "A deployment server", "A coding standard"], correctAnswer: 1, active: true },
  { id: 7, subject: "Git", topic: "Branching", question: "Why do teams use branches in Git?", options: ["To delete history", "To isolate changes before merging", "To avoid commits", "To disable collaboration"], correctAnswer: 1, active: true },
  { id: 8, subject: "Design Patterns", topic: "Behavioral", question: "Which pattern lets an object notify many observers when its state changes?", options: ["Singleton", "Observer", "Adapter", "Builder"], correctAnswer: 1, active: true }
];

let appState = {
  currentUser: null,
  students: [],
  allQuestions: [],
  activeSubjects: {},
  settings: { quizzing: true, scoring: true, ranking: true },
  quizQuestions: [],
  currentQuestionIdx: 0,
  selectedAnswers: {},
  timerSecondsLeft: 0,
  timerInterval: null,
  totalTimeLimit: 0,
  activeSubject: "all",
  quizMode: "practice",
  lastAttempt: null
};

const screens = {
  landing: document.getElementById("screen-landing"),
  auth: document.getElementById("screen-auth"),
  config: document.getElementById("screen-config"),
  quiz: document.getElementById("screen-quiz"),
  results: document.getElementById("screen-results"),
  dashboard: document.getElementById("screen-dashboard"),
  history: document.getElementById("screen-history"),
  professor: document.getElementById("screen-professor"),
  admin: document.getElementById("screen-admin")
};

document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  await loadData();
  loadPlatformSettings();
  hydrateSubjects();
  restoreSession();
});

async function loadData() {
  try {
    const res = await fetch("students.json");
    if (!res.ok) throw new Error("students not found");
    const loaded = await res.json();
    appState.students = normalizeUsers(loaded);
  } catch {
    appState.students = [...FALLBACK_STUDENTS];
  }

  const localUsers = readJSON("quizyou_users", []);
  appState.students = mergeById(appState.students, localUsers);

  try {
    const res = await fetch("questions.json");
    if (!res.ok) throw new Error("questions not found");
    const loaded = await res.json();
    appState.allQuestions = normalizeQuestions(loaded);
  } catch {
    appState.allQuestions = [...FALLBACK_QUESTIONS];
  }

  const localQuestions = readJSON("quizyou_question_bank", []);
  appState.allQuestions = mergeById(appState.allQuestions, localQuestions);
}

function normalizeUsers(users) {
  const base = users.map(u => ({ ...u, role: u.role || "Student", active: u.active !== false }));
  return mergeById(base, FALLBACK_STUDENTS.filter(u => u.role !== "Student"));
}

function normalizeQuestions(questions) {
  return questions.map((q, i) => ({ ...q, id: q.id || Date.now() + i, topic: q.topic || q.subject || "General", active: q.active !== false }));
}

function mergeById(a, b) {
  const map = new Map();
  [...a, ...b].forEach(item => map.set(String(item.id).toLowerCase(), item));
  return [...map.values()];
}

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadPlatformSettings() {
  appState.settings = { ...appState.settings, ...readJSON("quizyou_settings", {}) };
}

function savePlatformSettings() {
  writeJSON("quizyou_settings", appState.settings);
}

function hydrateSubjects() {
  const savedSubjects = readJSON("quizyou_active_subjects", {});
  const subjects = [...new Set(appState.allQuestions.map(q => q.subject))].sort();
  subjects.forEach(subject => {
    appState.activeSubjects[subject] = savedSubjects[subject] !== false;
  });
  writeJSON("quizyou_active_subjects", appState.activeSubjects);
  renderSubjectOptions();
}

function renderSubjectOptions() {
  const select = document.getElementById("config-subject");
  const historyFilter = document.getElementById("history-filter");
  if (!select) return;
  const subjects = Object.keys(appState.activeSubjects).filter(s => appState.activeSubjects[s]).sort();
  select.innerHTML = `<option value="all">All Active Subjects</option>` + subjects.map(s => `<option value="${escapeAttr(s)}">${escapeHTML(getSubjectLabel(s))}</option>`).join("");
  if (historyFilter) {
    historyFilter.innerHTML = `<option value="all">All Subjects</option>` + [...new Set(appState.allQuestions.map(q => q.subject))].sort().map(s => `<option value="${escapeAttr(s)}">${escapeHTML(getSubjectLabel(s))}</option>`).join("");
  }
}

function restoreSession() {
  const savedUser = readJSON("quizyou_user", null);
  if (savedUser) {
    const freshUser = appState.students.find(u => u.id === savedUser.id && u.active !== false);
    if (freshUser) {
      appState.currentUser = freshUser;
      updateHeaderStatus(true);
      routeByRole();
      return;
    }
    localStorage.removeItem("quizyou_user");
  }
  navigateTo("landing");
}

function routeByRole() {
  if (!appState.currentUser) return navigateTo("landing");
  if (appState.currentUser.role === "Professor") return navigateTo("professor");
  if (appState.currentUser.role === "Admin") return navigateTo("admin");
  return navigateTo("config");
}

function updateHeaderStatus(isLoggedIn) {
  const avatar = document.getElementById("user-status-avatar");
  const statusText = document.getElementById("user-status-text");
  if (isLoggedIn && appState.currentUser) {
    avatar.classList.add("logged-in");
    statusText.textContent = `${appState.currentUser.firstName} ${appState.currentUser.lastName} • ${appState.currentUser.role}`;
  } else {
    avatar.classList.remove("logged-in");
    statusText.textContent = "Guest Mode";
  }
}

function navigateTo(screenKey) {
  Object.keys(screens).forEach(key => screens[key].classList.toggle("active", key === screenKey));
  if (screenKey === "dashboard") renderDashboard();
  if (screenKey === "history") renderHistory();
  if (screenKey === "professor") renderProfessorPortal();
  if (screenKey === "admin") renderAdminPortal();
}

function setupEventListeners() {
  document.getElementById("brand-link").addEventListener("click", e => { e.preventDefault(); routeByRole(); });
  document.getElementById("btn-landing-start").addEventListener("click", () => navigateTo("auth"));
  document.getElementById("btn-landing-about").addEventListener("click", () => alert("QuizYou includes secure access, customizable quizzes, timed practice, saved scores, dashboards, professor content management, and admin role management."));
  document.getElementById("btn-auth-back").addEventListener("click", () => navigateTo("landing"));

  document.getElementById("auth-form").addEventListener("submit", e => {
    e.preventDefault();
    const inputId = document.getElementById("student-id").value.trim().toLowerCase();
    const alertBox = document.getElementById("auth-alert");
    const user = appState.students.find(u => (u.id.toLowerCase() === inputId || (u.email || "").split("@")[0].toLowerCase() === inputId) && u.active !== false);
    if (user) {
      alertBox.style.display = "none";
      appState.currentUser = user;
      writeJSON("quizyou_user", user);
      updateHeaderStatus(true);
      routeByRole();
    } else {
      alertBox.style.display = "block";
    }
  });

  document.getElementById("config-form").addEventListener("submit", e => { e.preventDefault(); setupQuiz(); });
  document.getElementById("btn-config-dashboard").addEventListener("click", () => navigateTo("dashboard"));
  document.getElementById("btn-config-history").addEventListener("click", () => navigateTo("history"));
  document.getElementById("btn-quiz-prev").addEventListener("click", () => { if (appState.currentQuestionIdx > 0) { appState.currentQuestionIdx--; renderQuestion(); }});
  document.getElementById("btn-quiz-next").addEventListener("click", () => { if (appState.currentQuestionIdx < appState.quizQuestions.length - 1) { appState.currentQuestionIdx++; renderQuestion(); } else finishQuiz(false); });
  document.getElementById("btn-results-retry").addEventListener("click", () => navigateTo("config"));
  document.getElementById("btn-results-dashboard").addEventListener("click", () => navigateTo("dashboard"));
  document.getElementById("btn-results-history").addEventListener("click", () => navigateTo("history"));
  document.getElementById("btn-dash-config").addEventListener("click", () => navigateTo("config"));
  document.getElementById("btn-dash-history").addEventListener("click", () => navigateTo("history"));
  document.getElementById("btn-dash-logout").addEventListener("click", logout);
  document.getElementById("btn-history-config").addEventListener("click", () => navigateTo("config"));
  document.getElementById("btn-history-dashboard").addEventListener("click", () => navigateTo("dashboard"));
  document.getElementById("history-filter").addEventListener("change", renderHistory);
  document.getElementById("btn-history-clear").addEventListener("click", clearHistory);

  document.getElementById("btn-prof-add-question").addEventListener("click", addProfessorQuestion);
  ["toggle-quizzing", "toggle-scoring", "toggle-ranking"].forEach(id => document.getElementById(id).addEventListener("change", updateFeatureToggles));
  document.getElementById("btn-prof-logout").addEventListener("click", logout);
  document.getElementById("btn-admin-add-user").addEventListener("click", addAdminUser);
  document.getElementById("btn-admin-logout").addEventListener("click", logout);
}

function logout() {
  clearInterval(appState.timerInterval);
  localStorage.removeItem("quizyou_user");
  appState.currentUser = null;
  updateHeaderStatus(false);
  document.getElementById("student-id").value = "";
  navigateTo("landing");
}

function setupQuiz() {
  if (!appState.settings.quizzing) return alert("Quizzing is currently disabled by the professor.");
  const subject = document.getElementById("config-subject").value;
  const numQuestionsInput = Math.max(1, Math.min(parseInt(document.getElementById("config-questions").value) || 10, 40));
  const minutesInput = parseInt(document.getElementById("config-time").value) || 10;
  appState.activeSubject = subject;
  appState.totalTimeLimit = minutesInput;
  appState.quizMode = document.getElementById("config-mode").value;

  let pool = appState.allQuestions.filter(q => q.active !== false && appState.activeSubjects[q.subject] !== false);
  if (subject !== "all") pool = pool.filter(q => q.subject === subject);
  shuffle(pool);
  appState.quizQuestions = pool.slice(0, Math.min(numQuestionsInput, pool.length));
  if (appState.quizQuestions.length === 0) return alert("No active questions found. Ask a professor to enable or import questions.");
  appState.currentQuestionIdx = 0;
  appState.selectedAnswers = {};
  appState.timerSecondsLeft = minutesInput * 60;
  renderQuestion();
  navigateTo("quiz");
  startTimer();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function startTimer() {
  clearInterval(appState.timerInterval);
  updateTimerUI();
  appState.timerInterval = setInterval(() => {
    appState.timerSecondsLeft--;
    updateTimerUI();
    if (appState.timerSecondsLeft <= 0) {
      clearInterval(appState.timerInterval);
      finishQuiz(true);
    }
  }, 1000);
}

function updateTimerUI() {
  const timerText = document.getElementById("quiz-timer-text");
  const timerContainer = document.querySelector(".quiz-timer");
  const min = Math.floor(Math.max(appState.timerSecondsLeft, 0) / 60);
  const sec = Math.max(appState.timerSecondsLeft, 0) % 60;
  timerText.textContent = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  timerContainer.className = appState.timerSecondsLeft <= 30 ? "quiz-timer danger" : appState.timerSecondsLeft <= 120 ? "quiz-timer warning" : "quiz-timer";
}

function renderQuestion() {
  const total = appState.quizQuestions.length;
  const current = appState.currentQuestionIdx;
  const question = appState.quizQuestions[current];
  document.getElementById("quiz-current-num").textContent = current + 1;
  document.getElementById("quiz-total-num").textContent = total;
  document.getElementById("quiz-progress-bar").style.width = `${((current + 1) / total) * 100}%`;
  document.getElementById("quiz-question-text").textContent = question.question;
  const optionsList = document.getElementById("quiz-options-list");
  optionsList.innerHTML = "";
  question.options.forEach((option, idx) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    if (appState.selectedAnswers[current] === idx) btn.classList.add("selected");
    const indexLabel = String.fromCharCode(65 + idx);
    btn.innerHTML = `<span style="display:flex;align-items:center;"><span class="option-index">${indexLabel}</span><span>${escapeHTML(option)}</span></span>`;
    btn.addEventListener("click", () => selectOption(idx));
    optionsList.appendChild(btn);
  });
  document.getElementById("btn-quiz-prev").style.visibility = current === 0 ? "hidden" : "visible";
  document.getElementById("btn-quiz-next").textContent = current === total - 1 ? "Submit Quiz" : "Next Question";
}

function selectOption(optionIndex) {
  appState.selectedAnswers[appState.currentQuestionIdx] = optionIndex;
  document.querySelectorAll(".option-btn").forEach((btn, idx) => btn.classList.toggle("selected", idx === optionIndex));
}

function finishQuiz(autoSubmitted) {
  clearInterval(appState.timerInterval);
  let correctCount = 0;
  const totalQuestions = appState.quizQuestions.length;
  const review = appState.quizQuestions.map((q, idx) => {
    const selected = appState.selectedAnswers[idx];
    const isCorrect = selected === q.correctAnswer;
    if (isCorrect) correctCount++;
    return {
      id: q.id,
      subject: q.subject,
      topic: q.topic || q.subject,
      question: q.question,
      selectedAnswerIndex: selected ?? null,
      selectedAnswerText: selected === undefined ? "No answer" : q.options[selected],
      correctAnswerIndex: q.correctAnswer,
      correctAnswerText: q.options[q.correctAnswer],
      isCorrect
    };
  });
  const percentage = Math.round((correctCount / totalQuestions) * 100);
  const timeTakenSec = Math.max(0, appState.totalTimeLimit * 60 - appState.timerSecondsLeft);
  const attempt = {
    id: `attempt_${Date.now()}`,
    userId: appState.currentUser.id,
    userName: `${appState.currentUser.firstName} ${appState.currentUser.lastName}`,
    subject: getSubjectLabel(appState.activeSubject),
    subjectKey: appState.activeSubject,
    mode: appState.quizMode,
    score: `${correctCount}/${totalQuestions}`,
    correctCount,
    totalQuestions,
    percentage: appState.settings.scoring ? percentage : null,
    timeTaken: formatSeconds(timeTakenSec),
    timeTakenSec,
    autoSubmitted,
    date: new Date().toLocaleDateString(),
    timestamp: new Date().toISOString(),
    review
  };
  appState.lastAttempt = attempt;
  saveExamToHistory(attempt);
  renderResults(attempt);
  navigateTo("results");
}

function renderResults(attempt) {
  document.getElementById("results-welcome-message").textContent = `${attempt.autoSubmitted ? "Time expired" : "Great effort"}, ${appState.currentUser.firstName}. Your results were saved to your profile.`;
  document.getElementById("results-subject").textContent = attempt.subject;
  document.getElementById("results-raw").textContent = attempt.score;
  document.getElementById("results-percent").textContent = appState.settings.scoring ? `${attempt.percentage}%` : "Hidden";
  document.getElementById("results-time-taken").textContent = attempt.timeTaken;
  const list = document.getElementById("results-review-list");
  list.innerHTML = attempt.review.map((r, idx) => `
    <div class="review-item ${r.isCorrect ? "correct" : "incorrect"}">
      <strong>${idx + 1}. ${escapeHTML(r.question)}</strong>
      <span>Your answer: ${escapeHTML(r.selectedAnswerText)}</span>
      <span>Correct answer: ${escapeHTML(r.correctAnswerText)}</span>
    </div>
  `).join("");
}

function saveExamToHistory(attempt) {
  if (!appState.currentUser) return;
  const personalKey = `quizyou_history_${appState.currentUser.id}`;
  const personal = readJSON(personalKey, []);
  personal.unshift(attempt);
  writeJSON(personalKey, personal);
  const all = readJSON("quizyou_all_attempts", []);
  all.unshift(attempt);
  writeJSON("quizyou_all_attempts", all);
}

function getHistory() {
  if (!appState.currentUser) return [];
  return readJSON(`quizyou_history_${appState.currentUser.id}`, []);
}

function renderDashboard() {
  const history = getHistory();
  const count = history.length;
  document.getElementById("dash-exams-count").textContent = count;
  const percentages = history.map(h => h.percentage).filter(n => typeof n === "number");
  document.getElementById("dash-avg-score").textContent = percentages.length ? `${Math.round(percentages.reduce((a,b)=>a+b,0)/percentages.length)}%` : "--";
  document.getElementById("dash-best-score").textContent = percentages.length ? `${Math.max(...percentages)}%` : "--";
  const avg = percentages.length ? Math.round(percentages.reduce((a,b)=>a+b,0)/percentages.length) : 0;
  document.getElementById("dash-mastery-rank").textContent = !appState.settings.ranking ? "Hidden" : avg >= 90 ? "Expert" : avg >= 75 ? "Proficient" : avg >= 60 ? "Developing" : count ? "Beginner" : "--";
  renderTopicMastery("dash-topic-mastery", history);
  renderHistorySummary("dash-history-list", history.slice(0, 5));
}

function renderHistorySummary(containerId, items) {
  const list = document.getElementById(containerId);
  if (!items.length) {
    list.innerHTML = `<div class="history-item" style="color: var(--text-dim);">No quizzes taken yet.</div>`;
    return;
  }
  list.innerHTML = items.map(item => `<div class="history-item"><span>${escapeHTML(item.subject)} <span class="history-date">(${item.date})</span></span><span class="history-score" style="${scoreStyle(item.percentage)}">${item.score} ${item.percentage === null ? "" : `(${item.percentage}%)`}</span></div>`).join("");
}

function renderHistory() {
  const filter = document.getElementById("history-filter").value || "all";
  const items = getHistory().filter(h => filter === "all" || h.subjectKey === filter || h.subject === filter);
  const list = document.getElementById("history-full-list");
  if (!items.length) {
    list.innerHTML = `<div class="dash-card">No saved quiz attempts match this filter.</div>`;
    return;
  }
  list.innerHTML = items.map(item => `
    <div class="dash-card history-detail-card">
      <div class="history-detail-header"><strong>${escapeHTML(item.subject)}</strong><span class="history-score" style="${scoreStyle(item.percentage)}">${item.score} ${item.percentage === null ? "" : `(${item.percentage}%)`}</span></div>
      <div class="history-date">${new Date(item.timestamp).toLocaleString()} • ${item.mode} • ${item.timeTaken}${item.autoSubmitted ? " • Auto-submitted" : ""}</div>
      <details><summary>Review Questions</summary><div class="review-list">${item.review.map((r, idx) => `<div class="review-item ${r.isCorrect ? "correct" : "incorrect"}"><strong>${idx + 1}. ${escapeHTML(r.question)}</strong><span>Your answer: ${escapeHTML(r.selectedAnswerText)}</span><span>Correct answer: ${escapeHTML(r.correctAnswerText)}</span></div>`).join("")}</div></details>
    </div>
  `).join("");
}

function clearHistory() {
  if (!confirm("Clear your saved quiz history?")) return;
  localStorage.removeItem(`quizyou_history_${appState.currentUser.id}`);
  const all = readJSON("quizyou_all_attempts", []).filter(a => a.userId !== appState.currentUser.id);
  writeJSON("quizyou_all_attempts", all);
  renderHistory();
}

function renderTopicMastery(containerId, attempts) {
  const container = document.getElementById(containerId);
  const topicMap = {};
  attempts.forEach(a => a.review?.forEach(r => {
    const key = r.subject || "General";
    topicMap[key] ||= { correct: 0, total: 0 };
    topicMap[key].total++;
    if (r.isCorrect) topicMap[key].correct++;
  }));
  const entries = Object.entries(topicMap);
  if (!entries.length) {
    container.innerHTML = `<div class="history-item" style="color: var(--text-dim);">No topic data yet.</div>`;
    return;
  }
  container.innerHTML = entries.map(([topic, v]) => {
    const pct = Math.round((v.correct / v.total) * 100);
    return `<div class="mastery-row"><div><strong>${escapeHTML(topic)}</strong><span>${v.correct}/${v.total} correct</span></div><div class="mastery-bar"><span style="width:${pct}%"></span></div><strong>${pct}%</strong></div>`;
  }).join("");
}

function renderProfessorPortal() {
  document.getElementById("toggle-quizzing").checked = appState.settings.quizzing;
  document.getElementById("toggle-scoring").checked = appState.settings.scoring;
  document.getElementById("toggle-ranking").checked = appState.settings.ranking;
  const controls = document.getElementById("prof-subject-controls");
  controls.innerHTML = Object.keys(appState.activeSubjects).sort().map(subject => `<label class="toggle-row"><input type="checkbox" data-subject="${escapeAttr(subject)}" ${appState.activeSubjects[subject] ? "checked" : ""}> ${escapeHTML(subject)} question set active</label>`).join("");
  controls.querySelectorAll("input[data-subject]").forEach(input => input.addEventListener("change", e => {
    appState.activeSubjects[e.target.dataset.subject] = e.target.checked;
    writeJSON("quizyou_active_subjects", appState.activeSubjects);
    renderSubjectOptions();
  }));
  const attempts = readJSON("quizyou_all_attempts", []);
  const scored = attempts.filter(a => typeof a.percentage === "number");
  document.getElementById("prof-attempts").textContent = attempts.length;
  document.getElementById("prof-class-avg").textContent = scored.length ? `${Math.round(scored.reduce((s,a)=>s+a.percentage,0)/scored.length)}%` : "--";
  renderTopicMastery("prof-topic-analytics", attempts);
}

function addProfessorQuestion() {
  const subject = document.getElementById("prof-subject").value.trim();
  const topic = document.getElementById("prof-topic").value.trim() || subject;
  const question = document.getElementById("prof-question").value.trim();
  const options = document.getElementById("prof-options").value.split("|").map(s => s.trim()).filter(Boolean);
  const correctAnswer = parseInt(document.getElementById("prof-answer").value);
  if (!subject || !question || options.length < 2) return alert("Add a subject, question, and at least two options separated by |.");
  const newQuestion = { id: `local_${Date.now()}`, subject, topic, question, options, correctAnswer, active: true };
  appState.allQuestions.push(newQuestion);
  const localQuestions = readJSON("quizyou_question_bank", []);
  localQuestions.push(newQuestion);
  writeJSON("quizyou_question_bank", localQuestions);
  hydrateSubjects();
  renderProfessorPortal();
  document.getElementById("prof-question-form").reset();
  alert("Question imported into the local question bank.");
}

function updateFeatureToggles() {
  appState.settings = {
    quizzing: document.getElementById("toggle-quizzing").checked,
    scoring: document.getElementById("toggle-scoring").checked,
    ranking: document.getElementById("toggle-ranking").checked
  };
  savePlatformSettings();
}

function renderAdminPortal() {
  const list = document.getElementById("admin-user-list");
  list.innerHTML = appState.students.map(u => `<div class="history-item"><span>${escapeHTML(u.firstName)} ${escapeHTML(u.lastName)} <span class="history-date">${escapeHTML(u.id)} • ${escapeHTML(u.role)}</span></span><button class="mini-btn" data-user="${escapeAttr(u.id)}">${u.active === false ? "Activate" : "Deactivate"}</button></div>`).join("");
  list.querySelectorAll("button[data-user]").forEach(btn => btn.addEventListener("click", () => toggleUserActive(btn.dataset.user)));
}

function addAdminUser() {
  const firstName = document.getElementById("admin-first").value.trim();
  const lastName = document.getElementById("admin-last").value.trim();
  const id = document.getElementById("admin-id").value.trim().toLowerCase();
  const role = document.getElementById("admin-role").value;
  if (!firstName || !lastName || !id) return alert("Enter first name, last name, and user ID.");
  if (appState.students.some(u => u.id.toLowerCase() === id)) return alert("That user ID already exists.");
  const user = { id, firstName, lastName, email: `${id}@bu.edu`, role, active: true };
  appState.students.push(user);
  const localUsers = readJSON("quizyou_users", []);
  localUsers.push(user);
  writeJSON("quizyou_users", localUsers);
  document.getElementById("admin-user-form").reset();
  renderAdminPortal();
}

function toggleUserActive(id) {
  appState.students = appState.students.map(u => u.id === id ? { ...u, active: u.active === false } : u);
  writeJSON("quizyou_users", appState.students.filter(u => !FALLBACK_STUDENTS.some(f => f.id === u.id)));
  renderAdminPortal();
}

function getSubjectLabel(sub) {
  if (sub === "all") return "All Subjects";
  if (sub === "Testing") return "Testing & QA";
  if (sub === "Agile") return "Agile Scrum";
  if (sub === "Git") return "Version Control (Git)";
  return sub;
}

function formatSeconds(total) {
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function scoreStyle(pct) {
  if (pct === null || pct === undefined) return "color: var(--text-muted);";
  return pct >= 80 ? "color: var(--success);" : pct >= 60 ? "color: var(--warning);" : "color: var(--error);";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}
function escapeAttr(value) { return escapeHTML(value); }
