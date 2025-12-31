import { getStore, getSession, setSession } from "./store.js";

const view = document.querySelector("#view");
const nav = document.querySelector("#nav");
const userBadge = document.querySelector("#user-badge");

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return date.toISOString().slice(0, 10);
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString("zh-TW", { hour12: false });
};

const diffHours = (start, end, breakMinutes = 0) => {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  let endDate = new Date(end);
  if (endDate < startDate) {
    endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
  }
  const minutes = (endDate - startDate) / 60000 - Number(breakMinutes || 0);
  return Math.max(minutes / 60, 0);
};

const uuid = () => crypto.randomUUID();

const render = (html) => {
  view.innerHTML = html;
};

let store;
let data;

const ensureData = async () => {
  if (!store) {
    store = await getStore();
  }
  data = await store.getSnapshot();
  if (!data.users?.length) {
    data.users = [];
  }
};

const persist = async () => {
  await store.setSnapshot(data);
};

const getUser = () => getSession();

const roleLabels = {
  admin: "Admin/Payroll",
  lead: "Lead Chef",
  crew: "Crew",
};

const setActiveTab = (route) => {
  nav.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === route);
  });
};

const renderNav = () => {
  const user = getUser();
  if (!user) {
    nav.innerHTML = "";
    return;
  }
  const routes = [
    { key: "#/events", label: "我的活動" },
    { key: "#/event", label: "活動詳情" },
  ];
  if (user.role === "lead") {
    routes.push({ key: "#/approve", label: "核准" });
  }
  if (user.role === "admin") {
    routes.push({ key: "#/admin", label: "活動管理" });
    routes.push({ key: "#/payroll", label: "Payroll" });
  }
  nav.innerHTML = routes
    .map(
      (route) =>
        `<button data-route="${route.key}">${route.label}</button>`
    )
    .join("");
  nav.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      window.location.hash = button.dataset.route;
    });
  });
};

const updateUserBadge = () => {
  const user = getUser();
  if (!user) {
    userBadge.innerHTML = "";
    return;
  }
  userBadge.innerHTML = `
    <span>${user.name}</span>
    <span class="badge info">${roleLabels[user.role]}</span>
    <button class="link" id="logout">登出</button>
  `;
  userBadge.querySelector("#logout").addEventListener("click", () => {
    setSession(null);
    router();
  });
};

const routeMap = {
  "#/login": renderLogin,
  "#/events": renderEvents,
  "#/event": renderEventDetail,
  "#/approve": renderApprove,
  "#/admin": renderAdmin,
  "#/payroll": renderPayroll,
};

function renderLogin() {
  render(`
    <section class="card">
      <h2>登入</h2>
      <p class="notice">此版本使用簡化登入：角色由 Admin 管理，新帳號預設為 Crew。</p>
      <form id="login-form" class="grid two">
        <label class="field">
          Email
          <input name="email" type="email" placeholder="name@example.com" required />
        </label>
        <label class="field">
          名稱
          <input name="name" type="text" placeholder="顯示名稱" required />
        </label>
        <div class="actions" style="align-items: flex-end;">
          <button type="submit">登入</button>
        </div>
      </form>
    </section>
  `);

  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const payload = Object.fromEntries(new FormData(form));
    await ensureData();
    const existing = data.users.find((entry) => entry.id === payload.email);
    const user = existing || {
      id: payload.email,
      name: payload.name,
      email: payload.email,
      role: "crew",
    };
    if (!existing) {
      data.users.push(user);
      await persist();
    }
    if (existing && existing.name !== payload.name) {
      existing.name = payload.name;
      await persist();
    }
    setSession(user);
    router();
  });
}

function renderEvents() {
  const user = getUser();
  if (!user) return;
  const events = data.events.filter((eventItem) => {
    if (user.role === "admin") return true;
    if (user.role === "lead") return eventItem.leadChefId === user.id;
    return eventItem.crewIds?.includes(user.id);
  });
  render(`
    <section class="card">
      <h2>我的活動</h2>
      ${
        events.length
          ? `<div class="grid">${events
              .map(
                (eventItem) => `
              <div class="card" style="margin:0">
                <h3>${eventItem.code}</h3>
                <p>${eventItem.location}｜${formatDate(eventItem.date)}</p>
                <p class="muted">Lead Chef: ${
                  data.users.find((userItem) => userItem.id === eventItem.leadChefId)
                    ?.name || "-"
                }</p>
                <div class="actions">
                  <button data-id="${eventItem.id}" class="secondary open-event">查看</button>
                </div>
              </div>
            `
              )
              .join("")}</div>`
          : `<p class="notice">目前尚未指派活動。</p>`
      }
    </section>
  `);
  document.querySelectorAll(".open-event").forEach((button) => {
    button.addEventListener("click", () => {
      window.location.hash = `#/event?id=${button.dataset.id}`;
    });
  });
}

function renderEventDetail() {
  const user = getUser();
  const params = new URLSearchParams(window.location.hash.split("?")[1]);
  const eventId = params.get("id");
  const eventItem = data.events.find((entry) => entry.id === eventId);

  if (!eventItem) {
    render(`<section class="card"><p>找不到活動。</p></section>`);
    return;
  }

  const myEntries = data.timeEntries.filter(
    (entry) => entry.eventId === eventId && entry.userId === user.id
  );
  const entriesHtml = myEntries
    .map(
      (entry) => `
        <tr>
          <td>${formatDateTime(entry.start)}</td>
          <td>${formatDateTime(entry.end)}</td>
          <td>${entry.breakMinutes}</td>
          <td>${diffHours(entry.start, entry.end, entry.breakMinutes).toFixed(2)}</td>
          <td>${entry.status}</td>
        </tr>
      `
    )
    .join("");

  render(`
    <section class="card">
      <h2>${eventItem.code}｜${eventItem.location}</h2>
      <div class="grid two">
        <div>
          <p>日期：${formatDate(eventItem.date)}</p>
          <p>預估時間：${eventItem.startEstimate || "-"} ~ ${
    eventItem.endEstimate || "-"
  }</p>
          <p>Lead Chef：${
            data.users.find((userItem) => userItem.id === eventItem.leadChefId)
              ?.name || "-"
          }</p>
        </div>
        <div>
          <p>我的工時記錄 (${myEntries.length})</p>
          <table class="table">
            <thead>
              <tr>
                <th>Start</th>
                <th>End</th>
                <th>Break</th>
                <th>工時</th>
                <th>狀態</th>
              </tr>
            </thead>
            <tbody>${entriesHtml || `<tr><td colspan="5">尚未填報</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </section>
    <section class="card">
      <h2>填報 Timesheet</h2>
      <form id="timesheet-form" class="grid three">
        <label class="field">
          到場時間
          <input type="datetime-local" name="start" required />
        </label>
        <label class="field">
          離場時間
          <input type="datetime-local" name="end" required />
        </label>
        <label class="field">
          Break 分鐘
          <input type="number" name="breakMinutes" value="0" min="0" />
        </label>
        <label class="field">
          備註
          <textarea name="notes" placeholder="延時、等候、額外搬運"></textarea>
        </label>
        <div class="actions" style="align-items: flex-end;">
          <button type="submit">提交</button>
        </div>
      </form>
    </section>
  `);

  document.querySelector("#timesheet-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const payload = Object.fromEntries(new FormData(form));
    const entry = {
      id: uuid(),
      eventId,
      userId: user.id,
      start: payload.start,
      end: payload.end,
      breakMinutes: Number(payload.breakMinutes || 0),
      notes: payload.notes,
      status: "Submitted",
      createdAt: new Date().toISOString(),
    };
    data.timeEntries.push(entry);
    data.auditLogs.push({
      id: uuid(),
      entityType: "TimeEntry",
      entityId: entry.id,
      action: "Submit",
      actorId: user.id,
      actorName: user.name,
      timestamp: new Date().toISOString(),
      before: null,
      after: entry,
    });
    await persist();
    router();
  });
}

function renderApprove() {
  const user = getUser();
  if (user.role !== "lead") {
    render(`<section class="card">沒有權限。</section>`);
    return;
  }
  const leadEvents = data.events.filter((eventItem) => eventItem.leadChefId === user.id);
  const entryRows = leadEvents
    .map((eventItem) => {
      const entries = data.timeEntries.filter((entry) => entry.eventId === eventItem.id);
      if (!entries.length) {
        return "";
      }
      return entries
        .map((entry) => {
          const member = data.users.find((userItem) => userItem.id === entry.userId);
          const hours = diffHours(entry.start, entry.end, entry.breakMinutes);
          const anomalies = [];
          if (!entry.breakMinutes) anomalies.push("未填 break");
          if (!entry.start || !entry.end) anomalies.push("時間缺漏");
          if (hours > 12) anomalies.push("工時過長");
          return `
            <tr>
              <td><input type="checkbox" data-entry="${entry.id}" /></td>
              <td>${eventItem.code}</td>
              <td>${member?.name || "-"}</td>
              <td>${formatDateTime(entry.start)}</td>
              <td>${formatDateTime(entry.end)}</td>
              <td>${entry.breakMinutes}</td>
              <td>${hours.toFixed(2)}</td>
              <td>${entry.status}</td>
              <td>${
                anomalies.length
                  ? `<span class="badge warning">${anomalies.join("、")}</span>`
                  : `<span class="badge success">正常</span>`
              }</td>
            </tr>
          `;
        })
        .join("");
    })
    .join("");

  render(`
    <section class="card">
      <h2>Lead Chef 核准</h2>
      <div class="actions">
        <button id="apply-break" class="secondary">批次套用 Break 30 分鐘</button>
        <button id="approve-selected">批次核准</button>
        <button id="request-edit" class="warning">要求更正</button>
        <button id="reject" class="danger">退回</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th></th>
            <th>Event</th>
            <th>成員</th>
            <th>Start</th>
            <th>End</th>
            <th>Break</th>
            <th>工時</th>
            <th>狀態</th>
            <th>異常</th>
          </tr>
        </thead>
        <tbody>${entryRows || `<tr><td colspan="9">尚無提交紀錄</td></tr>`}</tbody>
      </table>
    </section>
  `);

  const selectedEntries = () =>
    Array.from(document.querySelectorAll("input[type=checkbox]:checked")).map(
      (checkbox) => checkbox.dataset.entry
    );

  const updateEntries = async (ids, updates, action) => {
    const now = new Date().toISOString();
    ids.forEach((id) => {
      const entry = data.timeEntries.find((item) => item.id === id);
      if (!entry) return;
      const before = { ...entry };
      Object.assign(entry, updates);
      data.auditLogs.push({
        id: uuid(),
        entityType: "TimeEntry",
        entityId: entry.id,
        action,
        actorId: user.id,
        actorName: user.name,
        timestamp: now,
        before,
        after: { ...entry },
      });
    });
    await persist();
    router();
  };

  document.querySelector("#apply-break").addEventListener("click", async () => {
    const ids = selectedEntries();
    if (!ids.length) return;
    await updateEntries(ids, { breakMinutes: 30 }, "Batch Apply Break");
  });

  document.querySelector("#approve-selected").addEventListener("click", async () => {
    const ids = selectedEntries();
    if (!ids.length) return;
    await updateEntries(
      ids,
      { status: "Approved", approvedBy: user.id, approvedAt: new Date().toISOString() },
      "Approve"
    );
  });

  document.querySelector("#request-edit").addEventListener("click", async () => {
    const ids = selectedEntries();
    if (!ids.length) return;
    await updateEntries(ids, { status: "Request Edit" }, "Request Edit");
  });

  document.querySelector("#reject").addEventListener("click", async () => {
    const ids = selectedEntries();
    if (!ids.length) return;
    await updateEntries(ids, { status: "Rejected" }, "Reject");
  });
}

function renderAdmin() {
  const user = getUser();
  if (user.role !== "admin") {
    render(`<section class="card">沒有權限。</section>`);
    return;
  }
  const crewOptions = data.users
    .filter((userItem) => userItem.role === "crew" || userItem.role === "lead")
    .map((userItem) =>
      `<option value="${userItem.id}">${userItem.name} (${roleLabels[userItem.role]})</option>`
    )
    .join("");

  const userRows = data.users
    .map(
      (userItem) => `
      <tr>
        <td>${userItem.name}</td>
        <td>${userItem.email}</td>
        <td>
          <select data-user="${userItem.id}" class="role-select">
            <option value="crew" ${userItem.role === "crew" ? "selected" : ""}>Crew</option>
            <option value="lead" ${userItem.role === "lead" ? "selected" : ""}>Lead Chef</option>
            <option value="admin" ${userItem.role === "admin" ? "selected" : ""}>Admin/Payroll</option>
          </select>
        </td>
      </tr>
    `
    )
    .join("");

  const adjustmentOptions = data.timeEntries
    .map((entry) => {
      const eventItem = data.events.find((eventData) => eventData.id === entry.eventId);
      const member = data.users.find((userItem) => userItem.id === entry.userId);
      return `<option value="${entry.id}">${eventItem?.code || "-"}｜${member?.name || "-"}｜${formatDateTime(
        entry.start
      )}</option>`;
    })
    .join("");

  render(`
    <section class="card">
      <h2>建立活動</h2>
      <form id="event-form" class="grid two">
        <label class="field">
          Event Code
          <input name="code" required />
        </label>
        <label class="field">
          日期
          <input type="date" name="date" required />
        </label>
        <label class="field">
          地點
          <input name="location" required />
        </label>
        <label class="field">
          預估開始時間
          <input type="time" name="startEstimate" />
        </label>
        <label class="field">
          預估結束時間
          <input type="time" name="endEstimate" />
        </label>
        <label class="field">
          Lead Chef
          <select name="leadChefId" required>
            <option value="">請選擇</option>
            ${data.users
              .filter((userItem) => userItem.role === "lead")
              .map(
                (userItem) =>
                  `<option value="${userItem.id}">${userItem.name}</option>`
              )
              .join("")}
          </select>
        </label>
        <label class="field">
          指派 Crew
          <select name="crewIds" multiple size="6">${crewOptions}</select>
        </label>
        <div class="actions" style="align-items:flex-end;">
          <button type="submit">建立</button>
        </div>
      </form>
    </section>
    <section class="card">
      <h2>使用者角色管理</h2>
      <p class="notice">Admin 可調整 Crew / Lead / Admin 角色，避免自行升級。</p>
      <table class="table">
        <thead>
          <tr><th>名稱</th><th>Email</th><th>角色</th></tr>
        </thead>
        <tbody>
          ${userRows || `<tr><td colspan="3">尚無使用者</td></tr>`}
        </tbody>
      </table>
      <div class="actions" style="margin-top:12px;">
        <button id="save-roles">儲存角色</button>
      </div>
    </section>
    <section class="card">
      <h2>活動列表</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Event Code</th>
            <th>日期</th>
            <th>地點</th>
            <th>Lead Chef</th>
            <th>Crew 人數</th>
          </tr>
        </thead>
        <tbody>
          ${
            data.events.length
              ? data.events
                  .map(
                    (eventItem) => `
                <tr>
                  <td>${eventItem.code}</td>
                  <td>${formatDate(eventItem.date)}</td>
                  <td>${eventItem.location}</td>
                  <td>${
                    data.users.find((userItem) => userItem.id === eventItem.leadChefId)
                      ?.name || "-"
                  }</td>
                  <td>${eventItem.crewIds?.length || 0}</td>
                </tr>
              `
                  )
                  .join("")
              : `<tr><td colspan="5">尚無活動</td></tr>`
          }
        </tbody>
      </table>
    </section>
    <section class="card">
      <h2>Admin 更正工時（Adjustment）</h2>
      <form id="adjustment-form" class="grid three">
        <label class="field">
          選擇工時紀錄
          <select name="entryId" required>
            <option value="">請選擇</option>
            ${adjustmentOptions}
          </select>
        </label>
        <label class="field">
          新到場時間
          <input type="datetime-local" name="start" required />
        </label>
        <label class="field">
          新離場時間
          <input type="datetime-local" name="end" required />
        </label>
        <label class="field">
          Break 分鐘
          <input type="number" name="breakMinutes" value="0" min="0" />
        </label>
        <label class="field">
          更正原因
          <textarea name="reason" placeholder="輸入更正原因" required></textarea>
        </label>
        <div class="actions" style="align-items:flex-end;">
          <button type="submit">送出更正</button>
        </div>
      </form>
    </section>
  `);

  document.querySelector("#event-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const crewIds = formData.getAll("crewIds");
    const payload = Object.fromEntries(formData.entries());
    const eventItem = {
      id: uuid(),
      code: payload.code,
      date: payload.date,
      location: payload.location,
      startEstimate: payload.startEstimate,
      endEstimate: payload.endEstimate,
      leadChefId: payload.leadChefId,
      crewIds,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    data.events.push(eventItem);
    data.auditLogs.push({
      id: uuid(),
      entityType: "Event",
      entityId: eventItem.id,
      action: "Create",
      actorId: user.id,
      actorName: user.name,
      timestamp: new Date().toISOString(),
      before: null,
      after: eventItem,
    });
    await persist();
    router();
  });

  document.querySelector("#save-roles").addEventListener("click", async () => {
    const selects = document.querySelectorAll(".role-select");
    const now = new Date().toISOString();
    selects.forEach((select) => {
      const userItem = data.users.find((entry) => entry.id === select.dataset.user);
      if (!userItem) return;
      if (userItem.role !== select.value) {
        const before = { ...userItem };
        userItem.role = select.value;
        data.auditLogs.push({
          id: uuid(),
          entityType: "User",
          entityId: userItem.id,
          action: "Role Update",
          actorId: user.id,
          actorName: user.name,
          timestamp: now,
          before,
          after: { ...userItem },
        });
      }
    });
    await persist();
    router();
  });

  document
    .querySelector("#adjustment-form")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(event.target));
      const entry = data.timeEntries.find((item) => item.id === payload.entryId);
      if (!entry) return;
      const before = { ...entry };
      entry.start = payload.start;
      entry.end = payload.end;
      entry.breakMinutes = Number(payload.breakMinutes || 0);
      entry.notes = entry.notes || "";
      data.adjustments.push({
        id: uuid(),
        timeEntryId: entry.id,
        requestedBy: user.id,
        reason: payload.reason,
        status: "Approved",
        before,
        after: { ...entry },
        approvedBy: user.id,
        approvedAt: new Date().toISOString(),
      });
      data.auditLogs.push({
        id: uuid(),
        entityType: "TimeEntry",
        entityId: entry.id,
        action: "Admin Adjustment",
        actorId: user.id,
        actorName: user.name,
        timestamp: new Date().toISOString(),
        before,
        after: { ...entry },
      });
      await persist();
      router();
    });
}

function renderPayroll() {
  const user = getUser();
  if (user.role !== "admin") {
    render(`<section class="card">沒有權限。</section>`);
    return;
  }

  const summaryByUser = data.users
    .filter((userItem) => userItem.role !== "admin")
    .map((userItem) => {
      const entries = data.timeEntries.filter(
        (entry) => entry.userId === userItem.id && entry.status === "Approved"
      );
      const totalHours = entries.reduce(
        (total, entry) => total + diffHours(entry.start, entry.end, entry.breakMinutes),
        0
      );
      return {
        name: userItem.name,
        role: roleLabels[userItem.role],
        totalHours: totalHours.toFixed(2),
      };
    });

  const summaryByEvent = data.events.map((eventItem) => {
    const entries = data.timeEntries.filter(
      (entry) => entry.eventId === eventItem.id && entry.status === "Approved"
    );
    const totalHours = entries.reduce(
      (total, entry) => total + diffHours(entry.start, entry.end, entry.breakMinutes),
      0
    );
    return {
      code: eventItem.code,
      date: formatDate(eventItem.date),
      totalHours: totalHours.toFixed(2),
      totalCrew: entries.length,
    };
  });

  render(`
    <section class="card">
      <h2>Payroll 匯出</h2>
      <div class="actions">
        <button id="export-user">依人員匯出 CSV</button>
        <button id="export-event" class="secondary">依活動匯出 CSV</button>
      </div>
      <div class="grid two" style="margin-top:16px;">
        <div>
          <h3>依人員彙總</h3>
          <table class="table">
            <thead>
              <tr><th>人員</th><th>角色</th><th>總工時</th></tr>
            </thead>
            <tbody>
              ${
                summaryByUser.length
                  ? summaryByUser
                      .map(
                        (row) =>
                          `<tr><td>${row.name}</td><td>${row.role}</td><td>${
                            row.totalHours
                          }</td></tr>`
                      )
                      .join("")
                  : `<tr><td colspan="3">尚無核准工時</td></tr>`
              }
            </tbody>
          </table>
        </div>
        <div>
          <h3>依活動彙總</h3>
          <table class="table">
            <thead>
              <tr><th>Event</th><th>日期</th><th>工時</th><th>人數</th></tr>
            </thead>
            <tbody>
              ${
                summaryByEvent.length
                  ? summaryByEvent
                      .map(
                        (row) =>
                          `<tr><td>${row.code}</td><td>${row.date}</td><td>${
                            row.totalHours
                          }</td><td>${row.totalCrew}</td></tr>`
                      )
                      .join("")
                  : `<tr><td colspan="4">尚無核准工時</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
    <section class="card">
      <h2>鎖帳期</h2>
      <form id="lock-form" class="grid three">
        <label class="field">
          鎖帳類型
          <select name="type">
            <option value="week">週</option>
            <option value="month">月</option>
          </select>
        </label>
        <label class="field">
          開始日
          <input type="date" name="start" required />
        </label>
        <label class="field">
          結束日
          <input type="date" name="end" required />
        </label>
        <div class="actions" style="align-items:flex-end;">
          <button type="submit">鎖定</button>
        </div>
      </form>
      <table class="table" style="margin-top:12px;">
        <thead>
          <tr><th>類型</th><th>期間</th><th>鎖定時間</th></tr>
        </thead>
        <tbody>
          ${
            data.locks.length
              ? data.locks
                  .map(
                    (lock) => `
                <tr>
                  <td>${lock.type}</td>
                  <td>${lock.start} ~ ${lock.end}</td>
                  <td>${formatDateTime(lock.lockedAt)}</td>
                </tr>
              `
                  )
                  .join("")
              : `<tr><td colspan="3">尚無鎖帳</td></tr>`
          }
        </tbody>
      </table>
    </section>
  `);

  const downloadCsv = (rows, filename) => {
    const csvContent = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  document.querySelector("#export-user").addEventListener("click", () => {
    const rows = [
      ["Name", "Role", "Total Hours"],
      ...summaryByUser.map((row) => [row.name, row.role, row.totalHours]),
    ];
    downloadCsv(rows, "payroll_by_user.csv");
  });

  document.querySelector("#export-event").addEventListener("click", () => {
    const rows = [
      ["Event Code", "Date", "Total Hours", "Total Crew"],
      ...summaryByEvent.map((row) => [row.code, row.date, row.totalHours, row.totalCrew]),
    ];
    downloadCsv(rows, "payroll_by_event.csv");
  });

  document.querySelector("#lock-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const payload = Object.fromEntries(new FormData(form));
    data.locks.push({
      id: uuid(),
      type: payload.type,
      start: payload.start,
      end: payload.end,
      lockedBy: user.id,
      lockedAt: new Date().toISOString(),
    });
    await persist();
    router();
  });
}

async function router() {
  await ensureData();
  const user = getUser();
  updateUserBadge();
  renderNav();

  if (!user) {
    renderLogin();
    setActiveTab("#/login");
    return;
  }

  const hash = window.location.hash || "#/events";
  const route = Object.keys(routeMap).find((key) => hash.startsWith(key));
  if (route) {
    routeMap[route]();
    setActiveTab(route);
  } else {
    renderEvents();
    setActiveTab("#/events");
  }
}

window.addEventListener("hashchange", router);

router();
