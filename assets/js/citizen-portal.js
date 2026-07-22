function showAlert(el, message) {
  el.textContent = message;
  el.classList.add("is-visible");
}

function hideAlert(el) {
  el.classList.remove("is-visible");
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

document.addEventListener("DOMContentLoaded", function () {
  // --- Register form ---
  const registerForm = document.querySelector("[data-register-form]");
  if (registerForm) {
    const alertEl = registerForm.querySelector("[data-form-alert]");
    registerForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      hideAlert(alertEl);

      const password = registerForm.password.value;
      const confirmPassword = registerForm.confirmPassword.value;
      if (password !== confirmPassword) {
        showAlert(alertEl, "Password and confirmation do not match.");
        return;
      }

      const submitBtn = registerForm.querySelector("button[type=submit]");
      submitBtn.disabled = true;

      const { ok, data } = await postJson("/citizens-portal/api/register", {
        username: registerForm.username.value.trim(),
        password,
        confirmPassword,
        robloxUsername: registerForm.robloxUsername.value.trim(),
        discordHandle: registerForm.discordHandle.value.trim(),
      });

      submitBtn.disabled = false;

      if (!ok) {
        showAlert(alertEl, data.error || "Registration failed. Please try again.");
        return;
      }

      window.location.href = "pending.html";
    });
  }

  // --- Login form ---
  const loginForm = document.querySelector("[data-login-form]");
  if (loginForm) {
    const alertEl = loginForm.querySelector("[data-form-alert]");
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      hideAlert(alertEl);

      const submitBtn = loginForm.querySelector("button[type=submit]");
      submitBtn.disabled = true;

      const { ok, data } = await postJson("/citizens-portal/api/login", {
        username: loginForm.username.value.trim(),
        password: loginForm.password.value,
      });

      submitBtn.disabled = false;

      if (!ok) {
        showAlert(alertEl, data.error || "Login failed. Please try again.");
        return;
      }

      window.location.href = "dashboard.html";
    });
  }

  // --- Dashboard ---
  const dashboard = document.querySelector("[data-citizen-dashboard]");
  if (dashboard) {
    fetch("/citizens-portal/api/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        dashboard.querySelector("[data-username]").textContent = data.username;
        const statusEl = dashboard.querySelector("[data-status]");
        statusEl.textContent = data.status;
        statusEl.classList.add("status-badge--" + data.status);
        dashboard.querySelector("[data-roblox]").textContent = data.robloxUsername;
        dashboard.querySelector("[data-discord]").textContent = data.discordHandle;
      })
      .catch(() => {
        window.location.href = "login.html";
      });

    const logoutBtn = dashboard.querySelector("[data-logout]");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async function () {
        await fetch("/citizens-portal/api/logout", { method: "POST", credentials: "same-origin" });
        window.location.href = "login.html";
      });
    }
  }
});
