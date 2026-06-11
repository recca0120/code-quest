## Why

`apps/web` 的測試套件累積了幾類品質問題：
- **Crash probe 測試**：只驗舊內容仍在 DOM，不驗事件本身的行為
- **零 assertion 測試**：只跑流程，沒有任何 expect
- **跨檔重複**：兩個測試檔有完全相同的 helper 函式和重疊的行為覆蓋
- **驗實作而非行為**：spy callback prop 被呼叫次數、驗 CSS class 字串、驗 stub 內部狀態
- **誤導性測試名稱**：測試名與 expect 方向相反

這些測試增加維護負擔但不增加信心，刪除或修正後 coverage 應持平或上升。

修 bug 而寫的測試（能指出回歸的）一律保留，不在清理範圍。

## What Changes

- 刪除 crash probe 測試（只驗「不壞」但不驗行為）
- 為零 assertion 測試補真實 expect 或刪除
- 抽取跨檔重複 helper 到共用位置
- 合併跨檔重複的行為測試
- 將「驗 callback 被呼叫」改為「驗 UI 效果」
- 修正誤導性測試名稱

## Capabilities

### Modified Capabilities
- `test-quality`: web 測試套件品質規範執行
