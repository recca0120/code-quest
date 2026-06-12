## Why

測試品質審計高優先 7 項：act 未 await（假綠）、直接呼叫 context action（Skill 違規）、空 assertion（假綠）、不完整 Harness（假整合）、rerender 餵 sessions（Skill 違規）、模組級 mutable probe（污染風險）、Wrapper 重建 summoner（socket 斷線）。

## What Changes

修正上述 7 類問題，不改行為，只改測試品質。每個修正的 expect 語意必須等價。

## Out of Scope
- 中低優先的重複合併、命名修正（sub-change 2）
