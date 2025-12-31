# Event-based Part-timer 工時填報與核准（GitHub Pages）

此專案提供純前端版本的「Event-based Part-timer 工時填報與核准」系統，適合活動現場快速填報、Lead Chef 核准與 Payroll 匯出。

## 專案架構

```
.
├── index.html           # 主頁面
├── src/
│   ├── app.js           # 主要邏輯與路由
│   ├── firebase.js      # Firebase 設定
│   ├── store.js         # 資料存取（Firestore / LocalStorage fallback）
│   └── styles.css       # 介面樣式
└── README.md
```

> 可直接部署至 GitHub Pages；若需要多人共用資料，請使用 Firebase Firestore。

## 資料模型

- **Event**
  - `id`, `code`, `date`, `location`, `startEstimate`, `endEstimate`
  - `leadChefId`, `crewIds[]`, `createdBy`, `createdAt`
- **Assignment**（已合併在 Event）
  - `eventId`, `userId`, `role`
- **TimeEntry**
  - `id`, `eventId`, `userId`, `start`, `end`, `breakMinutes`, `notes`
  - `status`（Submitted / Approved / Rejected / Request Edit）
  - `approvedBy`, `approvedAt`, `createdAt`
- **Adjustment**（預留）
  - `id`, `timeEntryId`, `requestedBy`, `reason`, `status`
  - `before`, `after`, `approvedBy`, `approvedAt`
- **AuditLog**
  - `id`, `entityType`, `entityId`, `action`, `actorId`, `actorName`
  - `timestamp`, `before`, `after`

## 主要頁面與路由

- `#/login`：登入（簡化版）
- `#/events`：我的活動列表
- `#/event?id=...`：活動詳情與 Timesheet 填報
- `#/approve`：Lead Chef 核准（批次核准 / 批次套用 break）
- `#/admin`：Admin 建立活動、指派人員
- `#/payroll`：Payroll 匯出 CSV、鎖帳期

## CSV 匯出格式範例

- **依人員彙總** `payroll_by_user.csv`

```
"Name","Role","Total Hours"
"王小明","Crew", "32.50"
"林主廚","Lead Chef", "28.00"
```

- **依活動彙總** `payroll_by_event.csv`

```
"Event Code","Date","Total Hours","Total Crew"
"EVT-0328","2024-03-28","120.50","12"
"EVT-0402","2024-04-02","78.00","8"
```

## GitHub Pages 部署方式

1. 在 `src/firebase.js` 填入 Firebase 專案設定（可在 Firebase Console 建立 Web App 取得）。
2. 在 GitHub Repo 開啟 Pages：
   - Settings → Pages → Build and deployment → Source 選擇 `Deploy from a branch`。
   - Branch 選擇 `main`（或你的分支）與 `/root`。
3. 推送後即可透過 GitHub Pages URL 存取。

> 若未設定 Firebase，系統將自動使用 LocalStorage 作為單機 Demo。多人共享請務必設定 Firebase。

## 使用說明簡述

- Admin/Payroll：建立活動、指派 Lead Chef 與 Crew、匯出 CSV、鎖帳期
- Lead Chef：批次核准、批次套用 Break、快速識別異常
- Crew：填報工時、提交 Notes

## 計算規則

- 工時 = End - Start - Break minutes
- 若 End 早於 Start，視為跨日處理（自動補 +24 小時）

## Firebase 設定建議（Firestore 結構）

```
users/{id}
  name, email, role

events/{id}
  code, date, location, startEstimate, endEstimate
  leadChefId, crewIds, createdBy, createdAt

timeEntries/{id}
  eventId, userId, start, end, breakMinutes, notes
  status, approvedBy, approvedAt, createdAt

auditLogs/{id}
  entityType, entityId, action, actorId, actorName, timestamp, before, after

locks/{id}
  type, start, end, lockedBy, lockedAt
```
