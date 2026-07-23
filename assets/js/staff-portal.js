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

function formatDate(iso) {
  try {
    return new Date(iso + "Z").toLocaleString();
  } catch {
    return iso;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  // --- Staff login form ---
  const loginForm = document.querySelector("[data-staff-login-form]");
  if (loginForm) {
    const alertEl = loginForm.querySelector("[data-form-alert]");
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      hideAlert(alertEl);

      const submitBtn = loginForm.querySelector("button[type=submit]");
      submitBtn.disabled = true;

      try {
        const { ok, data } = await postJson("/group-community-management/api/login", {
          username: loginForm.username.value.trim(),
          password: loginForm.password.value,
        });

        if (!ok) {
          showAlert(alertEl, data.error || "Login failed. Please try again.");
          return;
        }

        window.location.href = "dashboard.html";
      } catch (err) {
        showAlert(alertEl, "Could not reach the server. Check your connection and try again.");
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // --- Staff dashboard ---
  const dashboard = document.querySelector("[data-staff-dashboard]");
  if (!dashboard) return;

  const pendingBody = dashboard.querySelector("[data-pending-body]");
  const pendingEmpty = dashboard.querySelector("[data-pending-empty]");
  const staffBody = dashboard.querySelector("[data-staff-body]");
  const addStaffForm = dashboard.querySelector("[data-add-staff-form]");
  const addStaffAlert = addStaffForm ? addStaffForm.querySelector("[data-form-alert]") : null;

  async function loadMe() {
    try {
      const res = await fetch("/group-community-management/api/me", { credentials: "same-origin" });
      if (!res.ok) {
        window.location.href = "login.html";
        return;
      }
      const data = await res.json();
      dashboard.querySelector("[data-staff-name]").textContent = data.displayName;
    } catch (err) {
      window.location.href = "login.html";
    }
  }

  async function loadPending() {
    try {
      const res = await fetch("/group-community-management/api/citizens/pending", {
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const { users } = await res.json();

      pendingBody.innerHTML = "";
      if (users.length === 0) {
        pendingEmpty.style.display = "block";
        return;
      }
      pendingEmpty.style.display = "none";

      for (const u of users) {
        const tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" + u.username + "</td>" +
          "<td>" + u.robloxUsername + "</td>" +
          "<td>" + u.discordHandle + "</td>" +
          "<td>" + formatDate(u.createdAt) + "</td>" +
          "<td class=\"row-actions\">" +
          "<button class=\"approve\" data-action=\"approve\" data-id=\"" + u.id + "\">Approve</button>" +
          "<button class=\"reject\" data-action=\"reject\" data-id=\"" + u.id + "\">Reject</button>" +
          "</td>";
        pendingBody.appendChild(tr);
      }
    } catch (err) {
      // leave existing table content in place; a stale list is better than a crash
    }
  }

  async function loadStaff() {
    try {
      const res = await fetch("/group-community-management/api/staff", { credentials: "same-origin" });
      if (!res.ok) return;
      const { staff } = await res.json();
      staffBody.innerHTML = "";
      for (const s of staff) {
        const tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" + s.username + "</td>" +
          "<td>" + s.displayName + "</td>" +
          "<td>" + formatDate(s.createdAt) + "</td>";
        staffBody.appendChild(tr);
      }
    } catch (err) {
      // leave existing table content in place
    }
  }

  pendingBody.addEventListener("click", async function (e) {
    const button = e.target.closest("button[data-action]");
    if (!button) return;
    button.disabled = true;

    try {
      const { ok } = await postJson("/group-community-management/api/citizens/review", {
        userId: Number(button.dataset.id),
        action: button.dataset.action,
      });

      if (ok) {
        await loadPending();
      } else {
        button.disabled = false;
      }
    } catch (err) {
      button.disabled = false;
    }
  });

  if (addStaffForm) {
    addStaffForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      hideAlert(addStaffAlert);

      const password = addStaffForm.password.value;
      const confirmPassword = addStaffForm.confirmPassword.value;
      if (password !== confirmPassword) {
        showAlert(addStaffAlert, "Password and confirmation do not match.");
        return;
      }

      const submitBtn = addStaffForm.querySelector("button[type=submit]");
      submitBtn.disabled = true;

      try {
        const { ok, data } = await postJson("/group-community-management/api/staff", {
          username: addStaffForm.username.value.trim(),
          password,
          confirmPassword,
          displayName: addStaffForm.displayName.value.trim(),
        });

        if (!ok) {
          showAlert(addStaffAlert, data.error || "Could not create staff account.");
          return;
        }

        addStaffForm.reset();
        await loadStaff();
      } catch (err) {
        showAlert(addStaffAlert, "Could not reach the server. Check your connection and try again.");
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  const logoutBtn = dashboard.querySelector("[data-logout]");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      try {
        await fetch("/group-community-management/api/logout", { method: "POST", credentials: "same-origin" });
      } finally {
        window.location.href = "login.html";
      }
    });
  }

  loadMe();
  loadPending();
  loadStaff();
});
