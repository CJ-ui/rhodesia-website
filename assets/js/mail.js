// Shared correspondence (inbox/outbox) module for both the citizen and staff
// dashboards. Behaviour is parameterised through data attributes on the
// [data-mail-app] container:
//   data-mail-base  — API prefix, e.g. "/citizens-portal/api/mail"
//   data-mail-role  — "citizen" | "staff"
//
// SECURITY: message subjects and bodies are free-text authored by users. They
// are ONLY ever placed into the DOM via textContent / createElement — never
// innerHTML — so a message body can never inject markup or script.

(function () {
  const app = document.querySelector("[data-mail-app]");
  if (!app) return;

  const BASE = app.dataset.mailBase;
  const ROLE = app.dataset.mailRole; // "citizen" | "staff"

  function formatDate(iso) {
    try {
      return new Date(iso.replace(" ", "T") + "Z").toLocaleString("en-GB");
    } catch {
      return iso;
    }
  }

  async function getJson(path) {
    const res = await fetch(BASE + path, { credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function postJson(path, body) {
    const res = await fetch(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  // --- Element references ---
  const tabButtons = app.querySelectorAll("[data-mail-tab]");
  const unreadBadge = app.querySelector("[data-mail-unread]");
  const listView = app.querySelector("[data-mail-list-view]");
  const listEl = app.querySelector("[data-mail-list]");
  const emptyEl = app.querySelector("[data-mail-empty]");
  const threadView = app.querySelector("[data-mail-thread-view]");
  const threadSubject = app.querySelector("[data-mail-thread-subject]");
  const threadMeta = app.querySelector("[data-mail-thread-meta]");
  const threadMessages = app.querySelector("[data-mail-thread-messages]");
  const replyForm = app.querySelector("[data-mail-reply-form]");
  const replyAlert = replyForm.querySelector("[data-form-alert]");
  const composeView = app.querySelector("[data-mail-compose-view]");
  const composeForm = app.querySelector("[data-mail-compose-form]");
  const composeAlert = composeForm.querySelector("[data-form-alert]");
  const composeSuccess = composeForm.querySelector("[data-mail-compose-success]");
  const recipientGroup = app.querySelector("[data-mail-recipient-group]");
  const recipientSelect = app.querySelector("[data-mail-recipient]");
  const backBtn = app.querySelector("[data-mail-back]");

  let currentFilter = "inbox"; // "inbox" | "sent"
  let currentThreadId = null;

  function showAlert(el, message) {
    el.textContent = message;
    el.classList.add("is-visible");
  }
  function hideAlert(el) {
    el.textContent = "";
    el.classList.remove("is-visible");
  }

  function setView(view) {
    listView.hidden = view !== "list";
    threadView.hidden = view !== "thread";
    composeView.hidden = view !== "compose";
  }

  function setActiveTab(name) {
    tabButtons.forEach((b) => b.classList.toggle("is-active", b.dataset.mailTab === name));
  }

  // --- Thread list ---
  function threadCounterparty(t) {
    return ROLE === "citizen" ? t.counterparty : t.citizenUsername;
  }

  // Inbox = threads whose latest activity was NOT started/last-sent by me is a
  // weak proxy; instead we split by who the thread involves. For a two-party
  // government mailbox, "Inbox" shows everything and "Sent" shows threads this
  // side opened. We keep the full list and filter client-side.
  let allThreads = [];

  function renderList() {
    listEl.textContent = "";
    const startedByMineKey = ROLE === "citizen" ? "startedByYou" : "startedByStaff";
    const threads = allThreads.filter((t) =>
      currentFilter === "sent" ? t[startedByMineKey] : true
    );

    if (threads.length === 0) {
      emptyEl.hidden = false;
      emptyEl.textContent =
        currentFilter === "sent"
          ? "You have not started any conversations yet."
          : "Your inbox is empty.";
      return;
    }
    emptyEl.hidden = true;

    for (const t of threads) {
      const li = document.createElement("li");
      li.className = "mail-item" + (t.unread ? " mail-item--unread" : "");
      li.dataset.threadId = t.id;
      li.setAttribute("role", "button");
      li.tabIndex = 0;

      const top = document.createElement("div");
      top.className = "mail-item__top";

      const subject = document.createElement("span");
      subject.className = "mail-item__subject";
      subject.textContent = t.subject;
      top.appendChild(subject);

      if (t.kind === "notice") {
        const badge = document.createElement("span");
        badge.className = "mail-badge mail-badge--notice";
        badge.textContent = "Official Notice";
        top.appendChild(badge);
      }
      if (t.unread) {
        const dot = document.createElement("span");
        dot.className = "mail-badge mail-badge--unread";
        dot.textContent = "New";
        top.appendChild(dot);
      }

      const meta = document.createElement("div");
      meta.className = "mail-item__meta";
      const who = document.createElement("span");
      who.textContent = threadCounterparty(t);
      const when = document.createElement("span");
      when.textContent = formatDate(t.lastMessageAt);
      meta.appendChild(who);
      meta.appendChild(when);

      li.appendChild(top);
      li.appendChild(meta);
      listEl.appendChild(li);
    }
  }

  async function loadThreads() {
    const { ok, data } = await getJson("/threads");
    if (!ok) return;
    allThreads = data.threads || [];
    if (unreadBadge) {
      if (data.unreadCount > 0) {
        unreadBadge.textContent = data.unreadCount;
        unreadBadge.hidden = false;
      } else {
        unreadBadge.hidden = true;
      }
    }
    renderList();
  }

  // --- Single thread ---
  function renderMessages(messages) {
    threadMessages.textContent = "";
    for (const m of messages) {
      const wrap = document.createElement("div");
      wrap.className = "mail-message" + (m.mine ? " mail-message--mine" : "");

      const head = document.createElement("div");
      head.className = "mail-message__head";
      const name = document.createElement("span");
      name.className = "mail-message__sender";
      name.textContent = m.mine ? "You" : m.senderName;
      const time = document.createElement("span");
      time.className = "mail-message__time";
      time.textContent = formatDate(m.createdAt);
      head.appendChild(name);
      head.appendChild(time);

      const body = document.createElement("div");
      body.className = "mail-message__body";
      body.textContent = m.body; // pre-wrap CSS preserves newlines; textContent blocks XSS

      wrap.appendChild(head);
      wrap.appendChild(body);
      threadMessages.appendChild(wrap);
    }
    threadMessages.scrollTop = threadMessages.scrollHeight;
  }

  async function openThread(id) {
    const { ok, data } = await getJson("/thread?id=" + encodeURIComponent(id));
    if (!ok) return;
    currentThreadId = id;
    threadSubject.textContent = data.thread.subject;
    if (threadMeta) {
      threadMeta.textContent =
        ROLE === "staff" ? "Citizen: " + data.thread.citizenUsername : "Government of Rhodesia";
    }
    renderMessages(data.messages);
    hideAlert(replyAlert);
    replyForm.reset();
    setActiveTab(currentFilter);
    setView("thread");
  }

  // --- Events ---
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", function () {
      const tab = btn.dataset.mailTab;
      setActiveTab(tab);
      if (tab === "compose") {
        hideAlert(composeAlert);
        hideAlert(composeSuccess);
        composeForm.reset();
        setView("compose");
      } else {
        currentFilter = tab;
        renderList();
        setView("list");
      }
    });
  });

  listEl.addEventListener("click", function (e) {
    const li = e.target.closest("[data-thread-id]");
    if (li) openThread(Number(li.dataset.threadId));
  });
  listEl.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const li = e.target.closest("[data-thread-id]");
    if (li) {
      e.preventDefault();
      openThread(Number(li.dataset.threadId));
    }
  });

  if (backBtn) {
    backBtn.addEventListener("click", function () {
      setView("list");
      loadThreads();
    });
  }

  replyForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideAlert(replyAlert);
    const submitBtn = replyForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    try {
      const { ok, data } = await postJson("/reply", {
        threadId: currentThreadId,
        body: replyForm.body.value,
      });
      if (!ok) {
        showAlert(replyAlert, data.error || "Could not send your reply. Please try again.");
        return;
      }
      replyForm.reset();
      await openThread(currentThreadId);
    } catch {
      showAlert(replyAlert, "Could not reach the server. Check your connection and try again.");
    } finally {
      submitBtn.disabled = false;
    }
  });

  composeForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideAlert(composeAlert);
    hideAlert(composeSuccess);
    const submitBtn = composeForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    try {
      const payload = {
        subject: composeForm.subject.value.trim(),
        body: composeForm.body.value,
      };
      if (ROLE === "staff") payload.recipient = recipientSelect.value;

      const { ok, data } = await postJson("/compose", payload);
      if (!ok) {
        showAlert(composeAlert, data.error || "Could not send your message. Please try again.");
        return;
      }
      composeForm.reset();
      const msg =
        ROLE === "staff"
          ? "Notice sent to " + data.sent + (data.sent === 1 ? " citizen." : " citizens.")
          : "Your message has been sent to the government.";
      showAlert(composeSuccess, msg);
      await loadThreads();
    } catch {
      showAlert(composeAlert, "Could not reach the server. Check your connection and try again.");
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Staff: populate the recipient selector (specific citizen or broadcast).
  async function loadRecipients() {
    if (ROLE !== "staff" || !recipientSelect) return;
    const { ok, data } = await getJson("/recipients");
    if (!ok) return;
    recipientSelect.textContent = "";
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "All active citizens (broadcast)";
    recipientSelect.appendChild(all);
    for (const r of data.recipients || []) {
      const opt = document.createElement("option");
      opt.value = String(r.id);
      opt.textContent = r.username;
      recipientSelect.appendChild(opt);
    }
    if (recipientGroup) recipientGroup.hidden = false;
  }

  // Init
  setActiveTab("inbox");
  setView("list");
  loadThreads();
  loadRecipients();
})();
