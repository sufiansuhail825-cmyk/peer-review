(() => {
  const roster = [];
  const rubric = [];

  const rosterListEl = document.getElementById("roster-list");
  const rosterCountEl = document.getElementById("roster-count");
  const studentInput = document.getElementById("student-name-input");
  const addStudentBtn = document.getElementById("add-student-btn");

  const rubricListEl = document.getElementById("rubric-list");
  const rubricTotalEl = document.getElementById("rubric-total");
  const criterionInput = document.getElementById("criterion-input");
  const pointsInput = document.getElementById("points-input");
  const addCriterionBtn = document.getElementById("add-criterion-btn");

  const form = document.getElementById("setup-form");
  const errorEl = document.getElementById("form-error");

  function renderRoster() {
    rosterListEl.innerHTML = roster
      .map(
        (name, i) => `
      <span class="chip">${escapeHtml(name)}
        <button type="button" data-i="${i}" aria-label="Remove ${escapeHtml(name)}">&times;</button>
      </span>`
      )
      .join("");
    rosterCountEl.textContent = `${roster.length} student${roster.length === 1 ? "" : "s"} added`;
    rosterListEl.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        roster.splice(Number(btn.dataset.i), 1);
        renderRoster();
      });
    });
  }

  function addStudent() {
    const name = studentInput.value.trim();
    if (!name) return;
    if (roster.includes(name)) {
      errorEl.textContent = "That name is already on the roster.";
      return;
    }
    errorEl.textContent = "";
    roster.push(name);
    studentInput.value = "";
    studentInput.focus();
    renderRoster();
  }

  addStudentBtn.addEventListener("click", addStudent);
  studentInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addStudent();
    }
  });

  function renderRubric() {
    rubricListEl.innerHTML = rubric
      .map(
        (c, i) => `
      <div class="rubric-row">
        <span class="criterion">${escapeHtml(c.criterion)}</span>
        <span class="points">${c.maxPoints} pts</span>
        <button type="button" class="btn-secondary" data-i="${i}" style="padding:4px 10px;">Remove</button>
      </div>`
      )
      .join("");
    const total = rubric.reduce((s, c) => s + c.maxPoints, 0);
    rubricTotalEl.textContent = `Total: ${total} points`;
    rubricListEl.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        rubric.splice(Number(btn.dataset.i), 1);
        renderRubric();
      });
    });
  }

  function addCriterion() {
    const criterion = criterionInput.value.trim();
    const points = Number(pointsInput.value);
    if (!criterion) return;
    if (!Number.isFinite(points) || points <= 0) {
      errorEl.textContent = "Enter a positive point value for the criterion.";
      return;
    }
    errorEl.textContent = "";
    rubric.push({ criterion, maxPoints: points });
    criterionInput.value = "";
    pointsInput.value = "";
    criterionInput.focus();
    renderRubric();
  }

  addCriterionBtn.addEventListener("click", addCriterion);
  [criterionInput, pointsInput].forEach((el) =>
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addCriterion();
      }
    })
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";

    const teacherEmail = document.getElementById("teacherEmail").value.trim();
    const topic = document.getElementById("topic").value.trim();

    if (roster.length < 2) {
      errorEl.textContent = "Add at least 2 students to the roster.";
      return;
    }
    if (rubric.length < 1) {
      errorEl.textContent = "Add at least 1 rubric criterion.";
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating session…";

    try {
      const { session } = await apiCall("create-session", "POST", {
        teacherEmail,
        topic,
        roster,
        rubric,
      });
      sessionStorage.setItem("pr_teacher_code", session.code);
      window.location.href = `/dashboard.html?code=${session.code}`;
    } catch (err) {
      errorEl.textContent = err.message;
      submitBtn.disabled = false;
      submitBtn.textContent = "Create session";
    }
  });
})();
