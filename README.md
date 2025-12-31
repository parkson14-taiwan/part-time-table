# Event-based Part-timer 工時填報與核准 / Timesheet & Approvals (GitHub Pages)

此專案提供純前端版本的「Event-based Part-timer 工時填報與核准」系統，適合活動現場快速填報、Lead Chef 核准與 Payroll 匯出。  
This project provides a front-end-only “Event-based Part-timer Timesheet & Approvals” system for fast on-site entry, Lead Chef approvals, and payroll export.

## 專案架構 / Project structure

```
.
├── index.html           # 主頁面 / Main page
├── src/
│   ├── app.js           # 主要邏輯與路由 / Core logic & routing
│   ├── firebase.js      # Firebase 設定 / Firebase config
│   ├── store.js         # 資料存取（Firestore / LocalStorage fallback）/ Data access (Firestore / LocalStorage fallback)
│   └── styles.css       # 介面樣式 / UI styles
└── README.md
```

> 可直接部署至 GitHub Pages；若需要多人共用資料，請使用 Firebase Firestore。  
> You can deploy directly to GitHub Pages; use Firebase Firestore for shared data across multiple users.

## 資料模型 / Data model

- **Event**
  - `id`, `code`, `date`, `location`, `startEstimate`, `endEstimate`
  - `leadChefId`, `crewIds[]`, `createdBy`, `createdAt`
- **Assignment**（已合併在 Event）/ (Merged into Event)
  - `eventId`, `userId`, `role`
- **TimeEntry**
  - `id`, `eventId`, `userId`, `start`, `end`, `breakMinutes`, `notes`
  - `status`（Submitted / Approved / Rejected / Request Edit）
  - `approvedBy`, `approvedAt`, `createdAt`
- **Adjustment**（預留）/ (Reserved)
  - `id`, `timeEntryId`, `requestedBy`, `reason`, `status`
  - `before`, `after`, `approvedBy`, `approvedAt`
- **AuditLog**
  - `id`, `entityType`, `entityId`, `action`, `actorId`, `actorName`
  - `timestamp`, `before`, `after`

## 主要頁面與路由 / Main pages & routes

- `#/login`：登入（簡化版）/ Sign in (simplified)
- `#/events`：我的活動列表 / My event list
- `#/event?id=...`：活動詳情與 Timesheet 填報 / Event details and timesheet entry
- `#/approve`：Lead Chef 核准（批次核准 / 批次套用 break）/ Lead approvals (batch approve / batch break)
- `#/admin`：Admin 建立活動、指派人員 / Admin create events & assign members
- `#/payroll`：Payroll 匯出 CSV、鎖帳期 / Payroll CSV export & closing period

## CSV 匯出格式範例 / CSV export examples

- **依人員彙總 / Summary by user** `payroll_by_user.csv`

```
"Name / 姓名","Role / 角色","Total Hours / 總工時"
"王小明","Crew", "32.50"
"林主廚","Lead Chef", "28.00"
```

- **依活動彙總 / Summary by event** `payroll_by_event.csv`

```
"Event Code / 活動代碼","Date / 日期","Total Hours / 總工時","Total Crew / 人數"
"EVT-0328","2024-03-28","120.50","12"
"EVT-0402","2024-04-02","78.00","8"
```

## GitHub Pages 部署方式 / Deployment (GitHub Pages)

1. 在 `src/firebase.js` 填入 Firebase 專案設定（可在 Firebase Console 建立 Web App 取得）。  
   Fill in Firebase config in `src/firebase.js` (create a Web App in Firebase Console).
2. 在 GitHub Repo 開啟 Pages：  
   Enable Pages on your GitHub repo:
   - Settings → Pages → Build and deployment → Source 選擇 `Deploy from a branch`。  
     Settings → Pages → Build and deployment → Source = `Deploy from a branch`.
   - Branch 選擇 `main`（或你的分支）與 `/root`。  
     Choose branch `main` (or your branch) and `/root`.
3. 推送後即可透過 GitHub Pages URL 存取。  
   Push and access via the GitHub Pages URL.

> 若未設定 Firebase，系統將自動使用 LocalStorage 作為單機 Demo。多人共享請務必設定 Firebase。  
> Without Firebase, the system uses LocalStorage as a single-user demo. Configure Firebase for multi-user sharing.

## 使用說明簡述 / Quick usage

- Admin/Payroll：建立活動、指派 Lead Chef 與 Crew、匯出 CSV、鎖帳期  
  Admin/Payroll: Create events, assign Lead Chef and Crew, export CSV, set closing periods.
- Lead Chef：批次核准、批次套用 Break、快速識別異常  
  Lead Chef: Batch approve, batch apply breaks, quickly spot anomalies.
- Crew：填報工時、提交 Notes  
  Crew: Submit time entries and notes.

## 計算規則 / Calculation rules

- 工時 = End - Start - Break minutes  
  Hours = End - Start - Break minutes.
- 若 End 早於 Start，視為跨日處理（自動補 +24 小時）  
  If End is earlier than Start, treat as overnight (+24 hours).

## Firebase 設定建議（Firestore 結構）/ Firebase suggested structure (Firestore)

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
