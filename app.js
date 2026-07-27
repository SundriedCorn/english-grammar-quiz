(function () {
  const app = document.getElementById("app");

  const state = {
    topic: null,
    order: [],       // shuffled question objects (with shuffled options for mc)
    index: 0,
    score: 0,
    mistakes: [],
    answered: false,
    reviewMode: false
  };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function bestScoreKey(topicId) {
    return "aep_best_" + topicId;
  }

  function getBest(topicId) {
    return localStorage.getItem(bestScoreKey(topicId));
  }

  function setBest(topicId, pct) {
    const cur = getBest(topicId);
    if (!cur || pct > parseInt(cur, 10)) {
      localStorage.setItem(bestScoreKey(topicId), String(pct));
    }
  }

  function renderHome() {
    state.reviewMode = false;
    const cards = TOPICS.map((t) => {
      const best = getBest(t.id);
      const bestLabel = best ? `Best: ${best}%` : "Not tried yet";
      return `
        <button class="topic-card ${t.id === "mixed" ? "mixed" : ""}" data-topic="${t.id}">
          <span class="icon">${t.icon}</span>
          <h3>${t.name}</h3>
          <p>${t.description}</p>
          <div class="meta">
            <span>${t.questions.length} questions</span>
            <span class="best">${bestLabel}</span>
          </div>
        </button>
      `;
    }).join("");

    app.innerHTML = `
      <header class="site-header">
        <h1>English Grammar Practice</h1>
        <p>Quick drills to practice grammar. Pick a topic below.</p>
      </header>
      <div class="topic-grid">${cards}</div>
      <footer class="site-footer">Good luck! 🎓</footer>
    `;

    app.querySelectorAll(".topic-card").forEach((btn) => {
      btn.addEventListener("click", () => startQuiz(btn.dataset.topic));
    });
  }

  function startQuiz(topicId, questionsOverride) {
    const topic = TOPICS.find((t) => t.id === topicId);
    state.topic = topic;
    const source = questionsOverride || topic.questions;
    state.order = shuffle(source).map((q) => {
      if (q.type === "mc") {
        return Object.assign({}, q, { options: shuffle(q.options) });
      }
      return q;
    });
    state.index = 0;
    state.score = 0;
    state.mistakes = [];
    state.answered = false;
    renderQuestion();
  }

  function renderQuestion() {
    const q = state.order[state.index];
    const total = state.order.length;
    const pct = Math.round((state.index / total) * 100);

    let inputHtml = "";
    if (q.type === "mc") {
      inputHtml = `<div class="options">` +
        q.options.map((opt) => `<button class="option-btn" data-value="${escapeAttr(opt)}">${escapeHtml(opt)}</button>`).join("") +
        `</div>`;
    } else {
      inputHtml = `
        <div class="fill-row">
          <input type="text" class="fill-input" id="fillInput" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type your answer..." />
          <button class="btn" id="submitFill">Check</button>
        </div>
      `;
    }

    app.innerHTML = `
      <div class="card">
        <div class="quiz-top">
          <button class="back-btn" id="backBtn" title="Back to menu">←</button>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="progress-label">${state.index + 1} / ${total}</div>
        </div>
        <div class="topic-label">${state.topic.icon} ${state.topic.name}${state.reviewMode ? " — Mistakes only" : ""}</div>
        <div class="question-text">${escapeHtml(q.q)}</div>
        ${inputHtml}
        <div class="feedback" id="feedback"></div>
        <div class="quiz-footer">
          <button class="btn hidden" id="nextBtn">Next →</button>
        </div>
      </div>
    `;

    document.getElementById("backBtn").addEventListener("click", renderHome);
    document.getElementById("nextBtn").addEventListener("click", nextQuestion);

    state.answered = false;

    if (q.type === "mc") {
      app.querySelectorAll(".option-btn").forEach((btn) => {
        btn.addEventListener("click", () => handleAnswer(btn.dataset.value, btn));
      });
    } else {
      const input = document.getElementById("fillInput");
      const submit = document.getElementById("submitFill");
      input.focus();
      const submitHandler = () => handleAnswer(input.value, input);
      submit.addEventListener("click", submitHandler);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          if (state.answered) {
            nextQuestion();
          } else {
            submitHandler();
          }
        }
      });
    }
  }

  function normalize(s) {
    return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/’/g, "'");
  }

  function handleAnswer(rawValue, el) {
    if (state.answered) return;
    state.answered = true;
    const q = state.order[state.index];
    let correct = false;
    let correctText = "";

    if (q.type === "mc") {
      correct = rawValue === q.answer;
      correctText = q.answer;
      app.querySelectorAll(".option-btn").forEach((btn) => {
        btn.disabled = true;
        if (btn.dataset.value === q.answer) btn.classList.add("correct");
        else if (btn === el && !correct) btn.classList.add("wrong");
      });
    } else {
      correct = q.answers.some((a) => normalize(a) === normalize(rawValue));
      correctText = q.answers[0];
      el.disabled = true;
      document.getElementById("submitFill").disabled = true;
      el.classList.add(correct ? "correct" : "wrong");
    }

    const fb = document.getElementById("feedback");
    fb.classList.add("show", correct ? "correct" : "wrong");
    fb.textContent = correct
      ? `Correct! ${q.exp || ""}`
      : `Not quite. Correct answer: "${correctText}". ${q.exp || ""}`;

    if (correct) {
      state.score++;
    } else {
      state.mistakes.push(q);
    }

    document.getElementById("nextBtn").classList.remove("hidden");
    document.getElementById("nextBtn").focus();
  }

  function nextQuestion() {
    if (state.index + 1 >= state.order.length) {
      renderResults();
    } else {
      state.index++;
      renderQuestion();
    }
  }

  function renderResults() {
    const total = state.order.length;
    const pct = Math.round((state.score / total) * 100);
    if (!state.reviewMode) setBest(state.topic.id, pct);

    let msg;
    if (pct === 100) msg = "Perfect score! 🎉";
    else if (pct >= 80) msg = "Great job — almost there!";
    else if (pct >= 50) msg = "Good progress, keep practicing.";
    else msg = "Keep going — practice makes it stick.";

    const mistakesHtml = state.mistakes.length
      ? `<div class="mistake-list">` +
        state.mistakes.map((q) => {
          const ans = q.type === "mc" ? q.answer : q.answers[0];
          return `
            <div class="mistake-item">
              <div class="q">${escapeHtml(q.q)}</div>
              <div class="a">✓ ${escapeHtml(ans)}</div>
              <div class="exp">${escapeHtml(q.exp || "")}</div>
            </div>
          `;
        }).join("") +
        `</div>`
      : `<p style="color:var(--muted);margin-top:16px;">No mistakes — nice work!</p>`;

    app.innerHTML = `
      <div class="card">
        <div class="result-score">
          <div class="big">${state.score}/${total}</div>
          <div class="msg">${msg}</div>
        </div>
        ${mistakesHtml}
        <div class="result-actions">
          <button class="btn" id="retryBtn">Try Again</button>
          ${state.mistakes.length ? '<button class="btn secondary" id="reviewBtn">Review Mistakes Only</button>' : ""}
          <button class="btn secondary" id="homeBtn">Back to Topics</button>
        </div>
      </div>
    `;

    document.getElementById("retryBtn").addEventListener("click", () => startQuiz(state.topic.id));
    document.getElementById("homeBtn").addEventListener("click", renderHome);
    const reviewBtn = document.getElementById("reviewBtn");
    if (reviewBtn) {
      reviewBtn.addEventListener("click", () => {
        state.reviewMode = true;
        startQuiz(state.topic.id, state.mistakes);
      });
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, "&quot;");
  }

  renderHome();
})();
