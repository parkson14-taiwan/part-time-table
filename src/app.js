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

const formatDateTimeInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
};

const getEntryEventInfo = (entry, events) => {
  if (entry.eventName || entry.refNo) {
    return {
      name: entry.eventName || "-",
      refNo: entry.refNo || "-",
    };
  }
  const eventItem = events.find((eventRecord) => eventRecord.id === entry.eventId);
  return {
    name: eventItem?.code || "-",
    refNo: "-",
  };
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
  admin: "Admin/Payroll / 管理者",
  lead: "Lead Chef / 主廚",
  crew: "Crew / 夥伴",
};

const statusLabels = {
  Submitted: "已提交 / Submitted",
  Approved: "已核准 / Approved",
  "Request Edit": "要求更正 / Request Edit",
  Rejected: "已退回 / Rejected",
};

const lockTypeLabels = {
  week: "週 / Week",
  month: "月 / Month",
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
    { key: "#/events", label: "填報工時 / Timesheet" },
  ];
  if (user.role === "lead") {
    routes.push({ key: "#/approve", label: "核准 / Approvals" });
  }
  if (user.role === "admin") {
    routes.push({ key: "#/admin", label: "活動管理 / Admin" });
    routes.push({ key: "#/payroll", label: "Payroll / 薪資匯出" });
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
    <button class="link" id="logout">登出 / Sign out</button>
  `;
  userBadge.querySelector("#logout").addEventListener("click", () => {
    setSession(null);
    router();
  });
};

const routeMap = {
  "#/login": renderLogin,
  "#/events": renderEvents,
  "#/approve": renderApprove,
  "#/admin": renderAdmin,
  "#/payroll": renderPayroll,
};

function renderLogin() {
  render(`
    <section class="card">
      <h2>登入 / Sign in</h2>
      <p class="notice">此版本使用簡化登入：新帳號預設為 Crew，需由管理者調整角色。 / Simplified sign-in: new accounts default to Crew and must be updated by Admin.</p>
      <form id="login-form" class="grid two">
        <label class="field">
          Email / 電子郵件
          <input name="email" type="email" placeholder="name@example.com" required />
        </label>
        <label class="field">
          名稱 / Name
          <input name="name" type="text" placeholder="顯示名稱 / Display name" required />
        </label>
        <div class="actions" style="align-items: flex-end;">
          <button type="submit">登入 / Sign in</button>
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
    if (!existing) {
      const user = {
        id: payload.email,
        name: payload.name,
        email: payload.email,
        role: "crew",
      };
      data.users.push(user);
      await persist();
      setSession(user);
    } else {
      setSession(existing);
    }
    router();
  });
}

function renderEvents() {
  const user = getUser();
  if (!user) return;
  const myEntries = data.timeEntries.filter((entry) => entry.userId === user.id);
  const entriesHtml = myEntries
    .map((entry) => {
      const eventInfo = getEntryEventInfo(entry, data.events);
      return `
        <tr>
          <td>${eventInfo.name}</td>
          <td>${eventInfo.refNo}</td>
          <td>${formatDateTime(entry.start)}</td>
          <td>${formatDateTime(entry.end)}</td>
          <td>${entry.breakMinutes}</td>
          <td>${diffHours(entry.start, entry.end, entry.breakMinutes).toFixed(2)}</td>
          <td>${statusLabels[entry.status] || entry.status}</td>
        </tr>
      `;
    })
    .join("");
  render(`
    <section class="card">
      <h2>填報工時 / Timesheet</h2>
      <p class="notice">Ref No 必填，未填寫將無法提交工時。 / Ref No is required to submit.</p>
      <form id="timesheet-form" class="grid three">
        <label class="field">
          活動名稱 / Event name
          <input type="text" name="eventName" placeholder="今日活動 / Event name" required />
        </label>
        <label class="field">
          Ref No
          <input type="text" name="refNo" placeholder="REF-0001" required />
        </label>
        <label class="field">
          到場時間 / Start time
          <input type="datetime-local" name="start" required />
        </label>
        <label class="field">
          離場時間 / End time
          <input type="datetime-local" name="end" required />
        </label>
        <label class="field">
          Break 分鐘 / Break (minutes)
          <input type="number" name="breakMinutes" value="0" min="0" />
        </label>
        <label class="field">
          備註 / Notes
          <textarea name="notes" placeholder="延時、等候、額外搬運 / Overtime, waiting, extra handling"></textarea>
        </label>
        <div class="actions" style="align-items: flex-end;">
          <button type="submit">提交 / Submit</button>
        </div>
      </form>
    </section>
    <section class="card">
      <h2>我的工時記錄 / My time entries</h2>
      <table class="table">
        <thead>
          <tr>
            <th>活動 / Event</th>
            <th>Ref No</th>
            <th>Start / 開始</th>
            <th>End / 結束</th>
            <th>Break / 休息</th>
            <th>工時 / Hours</th>
            <th>狀態 / Status</th>
          </tr>
        </thead>
        <tbody>${entriesHtml || `<tr><td colspan="7">尚未填報 / No entries yet</td></tr>`}</tbody>
      </table>
    </section>
  `);

  document.querySelector("#timesheet-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const payload = Object.fromEntries(new FormData(form));
    const entry = {
      id: uuid(),
      eventName: payload.eventName,
      refNo: payload.refNo,
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
    render(`<section class="card">沒有權限。 / Access denied.</section>`);
    return;
  }
  const entryRows = data.timeEntries
    .map((entry) => {
      const member = data.users.find((userItem) => userItem.id === entry.userId);
      const hours = diffHours(entry.start, entry.end, entry.breakMinutes);
      const anomalies = [];
      if (!entry.refNo) anomalies.push("未填 Ref No / Missing Ref No");
      if (!entry.breakMinutes) anomalies.push("未填 break / Missing break");
      if (!entry.start || !entry.end) anomalies.push("時間缺漏 / Missing time");
      if (hours > 12) anomalies.push("工時過長 / Long hours");
      const eventInfo = getEntryEventInfo(entry, data.events);
      return `
        <tr>
          <td><input type="checkbox" data-entry="${entry.id}" /></td>
          <td>${eventInfo.name}</td>
          <td>${eventInfo.refNo}</td>
          <td>${member?.name || "-"}</td>
          <td>${formatDateTime(entry.start)}</td>
          <td>${formatDateTime(entry.end)}</td>
          <td>${entry.breakMinutes}</td>
          <td>${hours.toFixed(2)}</td>
          <td>${statusLabels[entry.status] || entry.status}</td>
          <td>${
            anomalies.length
              ? `<span class="badge warning">${anomalies.join("、")}</span>`
              : `<span class="badge success">正常 / OK</span>`
          }</td>
        </tr>
      `;
    })
    .join("");

  render(`
    <section class="card">
      <h2>Lead Chef 核准 / Lead approvals</h2>
      <div class="actions">
        <button id="apply-break" class="secondary">批次套用 Break 30 分鐘 / Apply 30-min break</button>
        <button id="approve-selected">批次核准 / Approve selected</button>
        <button id="request-edit" class="warning">要求更正 / Request edit</button>
        <button id="reject" class="danger">退回 / Reject</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th></th>
            <th>活動 / Event</th>
            <th>Ref No</th>
            <th>成員 / Member</th>
            <th>Start / 開始</th>
            <th>End / 結束</th>
            <th>Break / 休息</th>
            <th>工時 / Hours</th>
            <th>狀態 / Status</th>
            <th>異常 / Alerts</th>
          </tr>
        </thead>
        <tbody>${entryRows || `<tr><td colspan="10">尚無提交紀錄 / No submissions yet</td></tr>`}</tbody>
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
    render(`<section class="card">沒有權限。 / Access denied.</section>`);
    return;
  }

  render(`
    <section class="card">
      <h2>建立活動 / Create event</h2>
      <form id="event-form" class="grid two">
        <label class="field">
          Event Code / 活動代碼
          <input name="code" required />
        </label>
        <label class="field">
          日期 / Date
          <input type="date" name="date" required />
        </label>
        <label class="field">
          地點 / Location
          <input name="location" required />
        </label>
        <label class="field">
          預估開始時間 / Est. start
          <input type="time" name="startEstimate" />
        </label>
        <label class="field">
          預估結束時間 / Est. end
          <input type="time" name="endEstimate" />
        </label>
        <label class="field">
          Lead Chef / 主廚
          <select name="leadChefId" required>
            <option value="">請選擇 / Select</option>
            ${data.users
              .filter((userItem) => userItem.role === "lead")
              .map(
                (userItem) =>
                  `<option value="${userItem.id}">${userItem.name}</option>`
              )
              .join("")}
          </select>
        </label>
        <div class="actions" style="align-items:flex-end;">
          <button type="submit">建立 / Create</button>
        </div>
      </form>
    </section>
    <section class="card">
      <h2>活動列表 / Event list</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Event Code / 活動代碼</th>
            <th>日期 / Date</th>
            <th>地點 / Location</th>
            <th>Lead Chef / 主廚</th>
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
                </tr>
              `
                  )
                  .join("")
              : `<tr><td colspan="4">尚無活動 / No events yet</td></tr>`
          }
        </tbody>
      </table>
    </section>
    <section class="card">
      <h2>人員管理 / Team management</h2>
      <table class="table">
        <thead>
          <tr>
            <th>姓名 / Name</th>
            <th>Email</th>
            <th>角色 / Role</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${
            data.users.length
              ? data.users
                  .map(
                    (userItem) => `
                <tr>
                  <td>${userItem.name}</td>
                  <td>${userItem.email}</td>
                  <td>
                    <select data-role="${userItem.id}">
                      <option value="crew" ${
                        userItem.role === "crew" ? "selected" : ""
                      }>Crew / 夥伴</option>
                      <option value="lead" ${
                        userItem.role === "lead" ? "selected" : ""
                      }>Lead Chef / 主廚</option>
                      <option value="admin" ${
                        userItem.role === "admin" ? "selected" : ""
                      }>Admin/Payroll / 管理者</option>
                    </select>
                  </td>
                  <td><button class="secondary" data-user="${userItem.id}">更新 / Update</button></td>
                </tr>
              `
                  )
                  .join("")
              : `<tr><td colspan="4">尚無成員 / No members yet</td></tr>`
          }
        </tbody>
      </table>
    </section>
    <section class="card">
      <h2>工時調整 / Time adjustment</h2>
      ${
        data.timeEntries.length
          ? `
            <form id="adjust-form" class="grid two">
              <label class="field">
                選擇工時 / Select entry
                <select name="entryId" id="adjust-entry">
                  ${data.timeEntries
                    .map((entry) => {
                      const entryUser = data.users.find(
                        (userItem) => userItem.id === entry.userId
                      );
                      const entryEvent = data.events.find(
                        (eventItem) => eventItem.id === entry.eventId
                      );
                      return `<option value="${entry.id}">${entryEvent?.code || "-"}｜${
                        entryUser?.name || "-"
                      }｜${formatDateTime(entry.start)}（${
                        statusLabels[entry.status] || entry.status
                      }）</option>`;
                    })
                    .join("")}
                </select>
              </label>
              <label class="field">
                到場時間 / Start time
                <input type="datetime-local" name="start" required />
              </label>
              <label class="field">
                離場時間 / End time
                <input type="datetime-local" name="end" required />
              </label>
              <label class="field">
                Break 分鐘 / Break (minutes)
                <input type="number" name="breakMinutes" min="0" />
              </label>
              <label class="field">
                狀態 / Status
                <select name="status">
                  <option value="Submitted">已提交 / Submitted</option>
                  <option value="Approved">已核准 / Approved</option>
                  <option value="Request Edit">要求更正 / Request Edit</option>
                  <option value="Rejected">已退回 / Rejected</option>
                </select>
              </label>
              <label class="field">
                調整原因 / Reason
                <input name="reason" type="text" placeholder="補登、修正錯誤 / Corrections" />
              </label>
              <label class="field">
                備註 / Notes
                <textarea name="notes"></textarea>
              </label>
              <div class="actions" style="align-items:flex-end;">
                <button type="submit">套用調整 / Apply adjustment</button>
              </div>
            </form>
          `
          : `<p class="notice">尚無工時資料。 / No time entries yet.</p>`
      }
    </section>
  `);

  document.querySelector("#event-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const payload = Object.fromEntries(new FormData(form));
    const eventItem = {
      id: uuid(),
      code: payload.code,
      date: payload.date,
      location: payload.location,
      startEstimate: payload.startEstimate,
      endEstimate: payload.endEstimate,
      leadChefId: payload.leadChefId,
      crewIds: [],
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

  document.querySelectorAll("button[data-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const targetId = button.dataset.user;
      const select = document.querySelector(`select[data-role="${targetId}"]`);
      const nextRole = select?.value;
      const targetUser = data.users.find((userItem) => userItem.id === targetId);
      if (!targetUser || !nextRole || targetUser.role === nextRole) return;
      const before = { ...targetUser };
      targetUser.role = nextRole;
      data.auditLogs.push({
        id: uuid(),
        entityType: "User",
        entityId: targetUser.id,
        action: "Update Role",
        actorId: user.id,
        actorName: user.name,
        timestamp: new Date().toISOString(),
        before,
        after: { ...targetUser },
      });
      await persist();
      router();
    });
  });

  if (data.timeEntries.length) {
    const entryMap = new Map(data.timeEntries.map((entry) => [entry.id, entry]));
    const entrySelect = document.querySelector("#adjust-entry");
    const adjustForm = document.querySelector("#adjust-form");

    const fillAdjustForm = (entry) => {
      if (!entry) return;
      adjustForm.start.value = formatDateTimeInput(entry.start);
      adjustForm.end.value = formatDateTimeInput(entry.end);
      adjustForm.breakMinutes.value = entry.breakMinutes ?? 0;
      adjustForm.status.value = entry.status;
      adjustForm.notes.value = entry.notes || "";
    };

    fillAdjustForm(entryMap.get(entrySelect.value));

    entrySelect.addEventListener("change", () => {
      fillAdjustForm(entryMap.get(entrySelect.value));
    });

    adjustForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(adjustForm));
      const entry = entryMap.get(payload.entryId);
      if (!entry) return;
      const before = { ...entry };
      entry.start = payload.start;
      entry.end = payload.end;
      entry.breakMinutes = Number(payload.breakMinutes || 0);
      entry.notes = payload.notes;
      entry.status = payload.status;
      if (entry.status === "Approved") {
        entry.approvedBy = user.id;
        entry.approvedAt = new Date().toISOString();
      } else {
        entry.approvedBy = null;
        entry.approvedAt = null;
      }
      data.adjustments.push({
        id: uuid(),
        timeEntryId: entry.id,
        adjustedBy: user.id,
        adjustedAt: new Date().toISOString(),
        reason: payload.reason,
        before,
        after: { ...entry },
      });
      data.auditLogs.push({
        id: uuid(),
        entityType: "TimeEntry",
        entityId: entry.id,
        action: "Admin Adjust",
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
}

function renderPayroll() {
  const user = getUser();
  if (user.role !== "admin") {
    render(`<section class="card">沒有權限。 / Access denied.</section>`);
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

  const summaryByEvent = Array.from(
    data.timeEntries
      .filter((entry) => entry.status === "Approved")
      .reduce((map, entry) => {
        const eventInfo = getEntryEventInfo(entry, data.events);
        const key = `${eventInfo.refNo}-${eventInfo.name}`;
        if (!map.has(key)) {
          map.set(key, {
            name: eventInfo.name,
            refNo: eventInfo.refNo,
            totalHours: 0,
            totalCrew: 0,
          });
        }
        const record = map.get(key);
        record.totalHours += diffHours(entry.start, entry.end, entry.breakMinutes);
        record.totalCrew += 1;
        return map;
      }, new Map())
      .values()
  ).map((record) => ({
    ...record,
    totalHours: record.totalHours.toFixed(2),
  }));

  render(`
    <section class="card">
      <h2>Payroll 匯出 / Payroll export</h2>
      <div class="actions">
        <button id="export-user">依人員匯出 CSV / Export by user</button>
        <button id="export-event" class="secondary">依活動匯出 CSV / Export by event</button>
      </div>
      <div class="grid two" style="margin-top:16px;">
        <div>
          <h3>依人員彙總 / Summary by user</h3>
          <table class="table">
            <thead>
              <tr><th>人員 / Name</th><th>角色 / Role</th><th>總工時 / Total hours</th></tr>
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
                  : `<tr><td colspan="3">尚無核准工時 / No approved entries</td></tr>`
              }
            </tbody>
          </table>
        </div>
        <div>
          <h3>依活動彙總 / Summary by event</h3>
          <table class="table">
            <thead>
              <tr><th>活動 / Event</th><th>Ref No</th><th>工時 / Hours</th><th>人數 / Crew</th></tr>
            </thead>
            <tbody>
              ${
                summaryByEvent.length
                  ? summaryByEvent
                      .map(
                        (row) =>
                          `<tr><td>${row.name}</td><td>${row.refNo}</td><td>${
                            row.totalHours
                          }</td><td>${row.totalCrew}</td></tr>`
                      )
                      .join("")
                  : `<tr><td colspan="4">尚無核准工時 / No approved entries</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
    <section class="card">
      <h2>鎖帳期 / Closing period</h2>
      <form id="lock-form" class="grid three">
        <label class="field">
          鎖帳類型 / Period type
          <select name="type">
            <option value="week">週 / Week</option>
            <option value="month">月 / Month</option>
          </select>
        </label>
        <label class="field">
          開始日 / Start date
          <input type="date" name="start" required />
        </label>
        <label class="field">
          結束日 / End date
          <input type="date" name="end" required />
        </label>
        <div class="actions" style="align-items:flex-end;">
          <button type="submit">鎖定 / Lock</button>
        </div>
      </form>
      <table class="table" style="margin-top:12px;">
        <thead>
          <tr><th>類型 / Type</th><th>期間 / Period</th><th>鎖定時間 / Locked at</th></tr>
        </thead>
        <tbody>
          ${
            data.locks.length
              ? data.locks
                  .map(
                    (lock) => `
                <tr>
                  <td>${lockTypeLabels[lock.type] || lock.type}</td>
                  <td>${lock.start} ~ ${lock.end}</td>
                  <td>${formatDateTime(lock.lockedAt)}</td>
                </tr>
              `
                  )
                  .join("")
              : `<tr><td colspan="3">尚無鎖帳 / No lock periods</td></tr>`
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
      ["Name / 姓名", "Role / 角色", "Total Hours / 總工時"],
      ...summaryByUser.map((row) => [row.name, row.role, row.totalHours]),
    ];
    downloadCsv(rows, "payroll_by_user.csv");
  });

  document.querySelector("#export-event").addEventListener("click", () => {
    const rows = [
      ["Event / 活動", "Ref No", "Total Hours / 總工時", "Total Crew / 人數"],
      ...summaryByEvent.map((row) => [row.name, row.refNo, row.totalHours, row.totalCrew]),
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
