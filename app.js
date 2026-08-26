(function () {
  const app = document.getElementById("app");

  const state = {
    topic: null,     // { id, name, icon } — real topic or a synthesized test
    order: [],       // shuffled question objects (with shuffled options for mc)
    index: 0,
    score: 0,
    mistakes: [],
    answered: false,
    reviewMode: false,
    inQuiz: false,
    filter: ""
  };

  const FULL_TEST_SIZE = 30;
  const SECTION_TEST_SIZE = 20;

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

  // Topics in the order declared in questions.js, bucketed by their group,
  // so the quiz sections follow the same path as the lessons.
  function groupedTopics() {
    const groups = [];
    const byName = {};
    TOPICS.forEach((t) => {
      const key = t.group || "Practice";
      if (!byName[key]) {
        byName[key] = { name: key, topics: [] };
        groups.push(byName[key]);
      }
      byName[key].topics.push(t);
    });
    return groups;
  }

  function matchesFilter(t) {
    if (!state.filter) return true;
    const hay = (t.name + " " + t.description + " " + t.group).toLowerCase();
    return hay.indexOf(state.filter.toLowerCase()) !== -1;
  }

  function topicCardHtml(t) {
    const best = getBest(t.id);
    const bestLabel = best ? `Best: ${best}%` : "Not tried yet";
    return `
      <button class="topic-card" data-topic="${escapeAttr(t.id)}">
        <span class="icon">${t.icon}</span>
        <h3>${escapeHtml(t.name)}</h3>
        <p>${escapeHtml(t.description)}</p>
        <div class="meta">
          <span>${t.questions.length} questions</span>
          <span class="best">${bestLabel}</span>
        </div>
      </button>
    `;
  }

  function renderHome() {
    state.reviewMode = false;
    state.inQuiz = false;

    const groups = groupedTopics();
    const totalQuestions = TOPICS.reduce((n, t) => n + t.questions.length, 0);
    const tried = TOPICS.filter((t) => getBest(t.id)).length;

    const sectionsHtml = groups.map((g, i) => {
      const visible = g.topics.filter(matchesFilter);
      if (!visible.length) return "";
      const count = g.topics.reduce((n, t) => n + t.questions.length, 0);
      return `
        <section class="topic-section">
          <div class="section-head">
            <div>
              <span class="section-num">${i + 1}</span>
              <h2>${escapeHtml(g.name)}</h2>
            </div>
            <button class="section-test" data-section="${escapeAttr(g.name)}" title="Mixed test from this section">
              Test section <span class="dim">${Math.min(SECTION_TEST_SIZE, count)} Q</span>
            </button>
          </div>
          <div class="topic-grid">${visible.map(topicCardHtml).join("")}</div>
        </section>
      `;
    }).join("");

    const nothingFound = sectionsHtml.trim()
      ? ""
      : `<p class="empty">No topic matches “${escapeHtml(state.filter)}”.</p>`;

    app.innerHTML = `
      <header class="site-header">
        <h1>English Grammar Practice</h1>
        <p>The complete A1 course — ${TOPICS.length} topics, ${totalQuestions} questions.</p>
      </header>

      <div class="home-bar">
        <input type="search" id="search" class="search-input" placeholder="Search a topic…"
               autocomplete="off" spellcheck="false" value="${escapeAttr(state.filter)}" />
        <span class="tried-label">${tried}/${TOPICS.length} tried</span>
      </div>

      <button class="full-test" id="fullTest">
        <span class="icon">🎓</span>
        <span class="ft-text">
          <strong>Full A1 Test</strong>
          <small>${FULL_TEST_SIZE} random questions from every topic</small>
        </span>
        <span class="ft-best">${getBest("test-all") ? "Best: " + getBest("test-all") + "%" : ""}</span>
      </button>

      ${sectionsHtml}
      ${nothingFound}

      <footer class="site-footer">Good luck! 🎓</footer>
    `;

    app.querySelectorAll(".topic-card").forEach((btn) => {
      btn.addEventListener("click", () => startQuiz(btn.dataset.topic));
    });

    app.querySelectorAll(".section-test").forEach((btn) => {
      btn.addEventListener("click", () => {
        const g = groupedTopics().find((x) => x.name === btn.dataset.section);
        if (!g) return;
        const pool = g.topics.reduce((acc, t) => acc.concat(t.questions), []);
        startTest("test-" + slug(g.name), g.name + " — Test", "🎯", pool, SECTION_TEST_SIZE);
      });
    });

    document.getElementById("fullTest").addEventListener("click", () => {
      const pool = TOPICS.reduce((acc, t) => acc.concat(t.questions), []);
      startTest("test-all", "Full A1 Test", "🎓", pool, FULL_TEST_SIZE);
    });

    const search = document.getElementById("search");
    search.addEventListener("input", () => {
      const pos = search.selectionStart;
      state.filter = search.value;
      renderHome();
      const next = document.getElementById("search");
      next.focus();
      try { next.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
    });
  }

  function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function prepare(questions) {
    return shuffle(questions).map((q) => {
      if (q.type === "mc") {
        return Object.assign({}, q, { options: shuffle(q.options) });
      }
      return q;
    });
  }

  function startQuiz(topicId, questionsOverride) {
    const topic = TOPICS.find((t) => t.id === topicId);
    if (!topic) return;
    state.topic = topic;
    state.order = prepare(questionsOverride || topic.questions);
    beginRun();
  }

  // A mixed test assembled on the fly from a pool of questions, so section
  // tests and the full test always reflect whatever is in the bank.
  function startTest(id, name, icon, pool, size) {
    // size is kept on the topic so a retry after a "mistakes only" run redraws
    // the full test, not just as many questions as the review had.
    state.topic = { id: id, name: name, icon: icon, synthetic: true, size: size };
    state.order = prepare(pool).slice(0, size);
    beginRun();
  }

  function beginRun() {
    state.index = 0;
    state.score = 0;
    state.mistakes = [];
    state.answered = false;
    state.inQuiz = true;
    renderQuestion();
  }

  function renderQuestion() {
    const q = state.order[state.index];
    const total = state.order.length;
    const pct = Math.round((state.index / total) * 100);

    let inputHtml = "";
    if (q.type === "mc") {
      inputHtml = `<div class="options">` +
        q.options.map((opt, i) => `<button class="option-btn" data-value="${escapeAttr(opt)}"><span class="key">${i + 1}</span>${escapeHtml(opt)}</button>`).join("") +
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
        <div class="topic-label">${state.topic.icon} ${escapeHtml(state.topic.name)}${state.reviewMode ? " — Mistakes only" : ""}</div>
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

  // Number keys pick an option; Enter moves on. Typing in the fill-in box is
  // handled above, so ignore keys while a text field has focus.
  document.addEventListener("keydown", (e) => {
    if (!state.inQuiz) return;
    const q = state.order[state.index];
    if (!q) return;
    const typing = document.activeElement && document.activeElement.tagName === "INPUT";
    if (state.answered) {
      if (e.key === "Enter" && !typing) {
        e.preventDefault();
        nextQuestion();
      }
      return;
    }
    if (typing || q.type !== "mc") return;
    const n = parseInt(e.key, 10);
    if (!n) return;
    const btns = app.querySelectorAll(".option-btn");
    if (n >= 1 && n <= btns.length) {
      e.preventDefault();
      const btn = btns[n - 1];
      handleAnswer(btn.dataset.value, btn);
    }
  });

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
    state.inQuiz = false;
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

    document.getElementById("retryBtn").addEventListener("click", () => {
      state.reviewMode = false;
      if (state.topic.synthetic) {
        // Rebuild from the same pool so a retry is a fresh draw, not a rerun.
        const t = state.topic;
        const pool = t.id === "test-all"
          ? TOPICS.reduce((acc, x) => acc.concat(x.questions), [])
          : (groupedTopics().find((g) => "test-" + slug(g.name) === t.id) || { topics: [] })
              .topics.reduce((acc, x) => acc.concat(x.questions), []);
        startTest(t.id, t.name, t.icon, pool, t.size || state.order.length);
      } else {
        startQuiz(state.topic.id);
      }
    });
    document.getElementById("homeBtn").addEventListener("click", renderHome);
    const reviewBtn = document.getElementById("reviewBtn");
    if (reviewBtn) {
      reviewBtn.addEventListener("click", () => {
        state.reviewMode = true;
        state.order = prepare(state.mistakes);
        beginRun();
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
