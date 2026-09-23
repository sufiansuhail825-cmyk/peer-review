(() => {
  const codeInput = document.getElementById("code-input");
  const nameWrap = document.getElementById("name-select-wrap");
  const nameSelect = document.getElementById("name-select");
  const form = document.getElementById("join-form");
  const errorEl = document.getElementById("join-error");
  const joinBtn = document.getElementById("join-btn");

  let lookedUpSession = null;
  let step = "code"; // "code" -> "name"

  const params = new URLSearchParams(window.location.search);
  const prefillCode = params.get("code");
  if (prefillCode) {
    codeInput.value = prefillCode.toUpperCase();
  }

  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.toUpperCase();
    if (step === "name") {
      // code changed after a lookup; reset to step 1
      step = "code";
      nameWrap.style.display = "none";
      joinBtn.textContent = "Continue";
    }
  });

  async function lookupCode(code) {
    const { session } = await apiCall(`get-session?code=${code}`);
    if (session.status === "ended") {
      throw new Error("This session has ended.");
    }
    const available = session.roster.filter((n) => !session.claimedNames.includes(n));
    if (available.length === 0) {
      throw new Error("Every name on the roster has already been claimed.");
    }
    lookedUpSession = session;
    nameSelect.innerHTML = available
      .map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`)
      .join("");
    nameWrap.style.display = "block";
    step = "name";
    joinBtn.textContent = "Join session";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    const code = codeInput.value.trim().toUpperCase();
    if (!code || code.length < 4) {
      errorEl.textContent = "Enter the session code your teacher shared.";
      return;
    }

    joinBtn.disabled = true;

    try {
      if (step === "code") {
        joinBtn.textContent = "Looking up…";
        await lookupCode(code);
        joinBtn.disabled = false;
        return;
      }

      // step === "name"
      const name = nameSelect.value;
      joinBtn.textContent = "Joining…";
      const { session } = await apiCall("join-session", "POST", { code, name });
      sessionStorage.setItem("pr_student_code", code);
      sessionStorage.setItem("pr_student_name", name);
      window.location.href = `/grade.html?code=${code}`;
    } catch (err) {
      errorEl.textContent = err.message;
      joinBtn.disabled = false;
      joinBtn.textContent = step === "name" ? "Join session" : "Continue";
    }
  });
})();
