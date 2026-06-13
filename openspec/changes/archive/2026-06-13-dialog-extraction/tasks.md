## Tasks

- [x] 建立 `WorkspaceDialogsContext`（state + actions 分離）
- [x] 建立 `WorkspaceDialogs` 元件（渲染三個 dialog）
- [x] 寫測試：驗證 trigger → dialog open、close 歸零
- [x] Workspace.tsx 移除三個 dialog state，改用 context trigger
- [x] 更新 Workspace 內各 caller（EmptyState / PanePicker / TabBar）改呼叫 context
- [x] 確認所有既有測試通過 + tsc clean
