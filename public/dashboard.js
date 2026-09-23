(() => {
  const params = new URLSearchParams(window.location.search);
  const code = (params.get("code") || "").toUpperCase();

  if (!code) {
    document.body.innerHTML = "<p style='padding:40px;font-family:sans-serif;'>No session code provided.</p>";
    return;
  }

  const topicHeading = document.getElementById("topic-heading");
  const topicEyebrow = document.getElementById("topic-eyebrow");
  const statusLine = document.getElementById("status-line");
  const codeDisplay = document.getElementById("code-display");
  const joinUrlDisplay = document.getElementById("join-url-display");
  const joinedCountEl = document.getElementById("joined-count");
  const submittedCountEl = document.getElementById("submitted-count");
  const timerDisplay = document.getElementById("timer-display");
  const timerLabel = document.getElementById("timer-label");
  const rosterGrid = document.getElementById("roster-grid");
  const dashError = document.getElementById("dash-error");

  const setupActions = document.getElementById("setup-actions");
  const activeActions = document.getElementById("active-actions");
  const reportActions = document.getElementById("report-actions");
  const startBtn = document.getElementById("start-btn");
  const endEarlyBtn = document.getElementById("end-early-btn");
  const downloadBtn = document.getElementById("download-report-btn");
  const endSessionBtn = document.getElementById("end-session-btn");
  const durationInput = document.getElementById("duration-input");

  const joinUrl = `${window.location.origin}/join.html?code=${code}`;
  joinUrlDisplay.textContent = joinUrl;
  codeDisplay.textContent = code;

  new QRCode(document.getElementById("qr-box"), {
    text: joinUrl,
    width: 128,
    height: 128,
    colorDark: "#1B1F3B",
    colorLight: "#ffffff",
  });

  let latestSession = null;
  let latestScores = null;
  let pollTimer = null;
  let reportDownloaded = false;

  function totalExpectedReviews(session) {
    // Each joined student reviews every other roster member (not themselves).
    // Using joined count, not roster count, since only joined students can submit.
    const n = session.claimedNames.length;
    return n * (session.roster.length - 1);
  }

  function render() {
    const s = latestSession;
    if (!s) return;

    topicEyebrow.textContent = "Peer Review";
    topicHeading.textContent = s.topic;

    if (s.status === "setup") {
      statusLine.textContent = "Waiting for students to join before you start grading.";
      setupActions.style.display = "flex";
      activeActions.style.display = "none";
      reportActions.style.display = "none";
      timerDisplay.textContent = "—";
      timerLabel.textContent = "Not started";
    } else if (s.status === "active") {
      statusLine.textContent = "Grading is live. Students are scoring their peers now.";
      setupActions.style.display = "none";
      activeActions.style.display = "flex";
      reportActions.style.display = "none";
      const remaining = s.endsAt - Date.now();
      if (remaining <= 0) {
        timerDisplay.textContent = "0:00";
        timerLabel.textContent = "Time's up";
      } else {
        timerDisplay.textContent = fmtTime(remaining);
        timerLabel.textContent = "Time remaining";
      }
    } else if (s.status === "ended") {
      statusLine.textContent = "Grading has closed. Download the report, then end the session.";
      setupActions.style.display = "none";
      activeActions.style.display = "none";
      reportActions.style.display = "flex";
      timerDisplay.textContent = "Closed";
      timerLabel.textContent = "Grading ended";
      endSessionBtn.disabled = !reportDownloaded;
    }

    joinedCountEl.textContent = `${s.claimedNames.length}/${s.roster.length}`;
    const submitted = latestScores ? latestScores.length : 0;
    const expected = totalExpectedReviews(s);
    submittedCountEl.textContent = expected > 0 ? `${submitted}/${expected}` : "0";

    rosterGrid.innerHTML = s.roster
      .map((name) => {
        const joined = s.claimedNames.includes(name);
        return `<div class="roster-item ${joined ? "joined" : ""}">
          <span class="dot"></span>${escapeHtml(name)}
        </div>`;
      })
      .join("");
  }

  async function poll() {
    try {
      const needsScores = latestSession && (latestSession.status === "active" || latestSession.status === "ended");
      const { session, scores } = await apiCall(
        `get-session?code=${code}${needsScores ? "&includeScores=1" : ""}`
      );
      latestSession = session;
      if (scores) latestScores = scores;
      dashError.textContent = "";
      render();

      // Auto-close grading when the timer runs out, from the teacher's own
      // browser polling loop (simplest reliable trigger without a backend cron).
      if (session.status === "active" && Date.now() >= session.endsAt) {
        await endGradingNow();
      }
    } catch (err) {
      dashError.textContent = err.message;
    }
  }

  async function endGradingNow() {
    try {
      // "Ending grading" moves status to ended via end-session's semantics
      // being reused: the server only has active->ended today, which is
      // exactly the transition we want here (closes grading, unlocks report).
      const { session } = await apiCall("end-session", "POST", { code });
      latestSession = session;
      const { scores } = await apiCall(`get-session?code=${code}&includeScores=1`);
      latestScores = scores;
      render();
    } catch (err) {
      dashError.textContent = err.message;
    }
  }

  startBtn.addEventListener("click", async () => {
    const minutes = Number(durationInput.value) || 10;
    startBtn.disabled = true;
    startBtn.textContent = "Starting…";
    try {
      const { session } = await apiCall("start-session", "POST", { code, durationMinutes: minutes });
      latestSession = session;
      render();
    } catch (err) {
      dashError.textContent = err.message;
      startBtn.disabled = false;
      startBtn.textContent = "Start peer review";
    }
  });

  endEarlyBtn.addEventListener("click", async () => {
    if (!confirm("End grading now? Students will no longer be able to submit scores.")) return;
    endEarlyBtn.disabled = true;
    await endGradingNow();
    endEarlyBtn.disabled = false;
  });

  downloadBtn.addEventListener("click", () => {
    generateReport(latestSession, latestScores || []);
    reportDownloaded = true;
    endSessionBtn.disabled = false;
    downloadBtn.textContent = "Download report (PDF) — again";
  });

  endSessionBtn.addEventListener("click", async () => {
    if (!confirm("End this session for good? This closes the dashboard.")) return;
    try {
      await apiCall("end-session", "POST", { code });
      clearInterval(pollTimer);
      document.querySelector(".wrap").innerHTML = `
        <div class="empty-state">
          <div class="big-icon">✓</div>
          <h2>Session ended</h2>
          <p>The peer review session for "${escapeHtml(latestSession.topic)}" has been closed.</p>
        </div>`;
    } catch (err) {
      dashError.textContent = err.message;
    }
  });

  function generateReport(session, scores) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const marginX = 18;
    let y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Peer Review Report", marginX, y);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Topic: ${session.topic}`, marginX, y); y += 7;
    doc.text(`Facilitator: ${session.teacherEmail}`, marginX, y); y += 7;
    doc.text(`Date: ${new Date(session.startedAt || session.createdAt).toLocaleString()}`, marginX, y); y += 7;
    doc.text(`Rubric total: ${session.totalMax} points`, marginX, y); y += 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Rubric", marginX, y); y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    session.rubric.forEach((c) => {
      doc.text(`• ${c.criterion} — ${c.maxPoints} pts`, marginX + 2, y);
      y += 6;
    });
    y += 6;

    const expectedReviewersPerStudent = session.claimedNames.length - 1;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Scores by student", marginX, y); y += 9;

    session.roster.forEach((name) => {
      if (y > 265) { doc.addPage(); y = 20; }

      const received = scores.filter((s) => s.targetName === name);
      const avg = received.length ? received.reduce((sum, s) => sum + s.total, 0) / received.length : null;
      const joined = session.claimedNames.includes(name);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(name, marginX, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const scoreText = avg !== null ? `${avg.toFixed(1)} / ${session.totalMax}` : "No scores received";
      doc.text(scoreText, 140, y);
      y += 6;

      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      const completeness = joined
        ? `${received.length} of ${Math.max(expectedReviewersPerStudent, 0)} expected peer reviews received`
        : "Did not join the session";
      doc.text(completeness, marginX, y);
      doc.setTextColor(0, 0, 0);
      y += 9;
    });

    const total = scores.length;
    const expectedTotal = totalExpectedReviews(session);
    if (total < expectedTotal) {
      if (y > 260) { doc.addPage(); y = 20; }
      y += 4;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(140, 90, 20);
      doc.text(
        `Note: grading closed with ${total} of ${expectedTotal} expected reviews submitted. Averages above reflect only submitted scores.`,
        marginX,
        y,
        { maxWidth: 174 }
      );
      doc.setTextColor(0, 0, 0);
    }

    doc.save(`peer-review-${session.code}.pdf`);
  }

  poll();
  pollTimer = setInterval(poll, 3000);
})();
