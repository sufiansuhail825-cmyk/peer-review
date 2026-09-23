(() => {
  const params = new URLSearchParams(window.location.search);
  const code = (params.get("code") || sessionStorage.getItem("pr_student_code") || "").toUpperCase();
  const myName = sessionStorage.getItem("pr_student_name");

  const wrap = document.getElementById("grading-wrap");

  if (!code || !myName) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="big-icon">👋</div>
        <h2>Let's get you set up</h2>
        <p>Join a session with your code first.</p>
        <br>
        <a class="btn-primary" href="/join.html${code ? `?code=${code}` : ""}" style="display:inline-block; padding:12px 24px; text-decoration:none;">Go to join page</a>
      </div>`;
    return;
  }

  let session = null;
  let mySubmittedTargets = new Set();
  let queue = [];
  let queueIndex = 0;
  let pollTimer = null;

  function renderWaiting(message) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="big-icon">⏳</div>
        <h2>${escapeHtml(message)}</h2>
        <p>This page checks automatically, no need to refresh.</p>
      </div>`;
  }

  function renderEnded() {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="big-icon">✓</div>
        <h2>Grading has closed</h2>
        <p>Thanks for reviewing your peers. Your teacher will share the results.</p>
      </div>`;
  }

  function renderAllDone() {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="big-icon">🎉</div>
        <h2>All done, ${escapeHtml(myName)}</h2>
        <p>You've reviewed everyone. Sit tight while others finish.</p>
      </div>`;
  }

  function buildQueue() {
    queue = session.roster.filter((n) => n !== myName && !mySubmittedTargets.has(n));
  }

  function renderGradingForm() {
    if (queue.length === 0) {
      renderAllDone();
      return;
    }
    const target = queue[0];
    const totalPeers = session.roster.length - 1;
    const doneCount = totalPeers - queue.length;

    const criteriaHtml = session.rubric
      .map(
        (c, i) => `
      <div class="criterion-block">
        <div class="c-name">${escapeHtml(c.criterion)}</div>
        <div class="score-slider-row">
          <input type="range" min="0" max="${c.maxPoints}" step="1" value="${Math.round(c.maxPoints / 2)}" data-i="${i}" class="crit-slider">
          <span class="score-value" data-i="${i}">${Math.round(c.maxPoints / 2)}<span class="score-max"> / ${c.maxPoints}</span></span>
        </div>
      </div>`
      )
      .join("");

    wrap.innerHTML = `
      <p class="progress-line">Reviewing ${doneCount + 1} of ${totalPeers}</p>
      <h1 class="target-name">${escapeHtml(target)}</h1>
      ${criteriaHtml}
      <div style="height:90px;"></div>
      <div class="grading-footer">
        <div class="inner">
          <div class="total-preview">Total<br><strong id="total-preview-val">0</strong> / ${session.totalMax}</div>
          <button class="btn-primary" id="submit-score-btn" style="padding:14px 28px;">Submit &amp; next</button>
        </div>
      </div>
    `;

    const sliders = wrap.querySelectorAll(".crit-slider");
    function updateTotal() {
      let total = 0;
      sliders.forEach((s) => {
        const i = s.dataset.i;
        const valEl = wrap.querySelector(`.score-value[data-i="${i}"]`);
        valEl.firstChild.textContent = s.value;
        total += Number(s.value);
      });
      wrap.querySelector("#total-preview-val").textContent = total;
    }
    sliders.forEach((s) => s.addEventListener("input", updateTotal));
    updateTotal();

    document.getElementById("submit-score-btn").addEventListener("click", async () => {
      const btn = document.getElementById("submit-score-btn");
      btn.disabled = true;
      btn.textContent = "Submitting…";
      const criteriaScores = Array.from(sliders)
        .sort((a, b) => Number(a.dataset.i) - Number(b.dataset.i))
        .map((s) => Number(s.value));

      try {
        await apiCall("submit-score", "POST", {
          code,
          graderName: myName,
          targetName: target,
          criteriaScores,
        });
        mySubmittedTargets.add(target);
        queue.shift();
        renderGradingForm();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Submit & next";
        alert(err.message);
      }
    });
  }

  async function poll() {
    try {
      const { session: s, scores } = await apiCall(`get-session?code=${code}&includeScores=1`);
      session = s;

      if (session.status === "ended") {
        clearInterval(pollTimer);
        delete wrap.dataset.renderedTarget;
        renderEnded();
        return;
      }

      mySubmittedTargets = new Set(
        (scores || []).filter((sc) => sc.graderName === myName).map((sc) => sc.targetName)
      );

      if (session.status === "setup") {
        delete wrap.dataset.renderedTarget;
        renderWaiting("Waiting for your teacher to start grading");
        return;
      }

      // status === active
      buildQueue();
      // Only re-render the form if we're not already mid-entry on the same
      // target (avoid wiping slider positions on every 3s poll).
      const currentTarget = queue[0];
      if (!wrap.dataset.renderedTarget || wrap.dataset.renderedTarget !== currentTarget) {
        wrap.dataset.renderedTarget = currentTarget || "__done__";
        renderGradingForm();
      }
    } catch (err) {
      // transient network hiccup; keep prior render, don't nuke the form
      console.error(err);
    }
  }

  poll();
  pollTimer = setInterval(poll, 3000);
})();
