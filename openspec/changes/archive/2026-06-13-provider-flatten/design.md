## Context

`App.tsx` 的 `AppProviders`：
```tsx
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <PluginProvider>
        <ProjectProvider>
          <NavigationProvider>
            <GitProvider>
              <FsProvider>
                <OpenspecProvider>
                  <CommandPaletteProvider>{children}</CommandPaletteProvider>
                </OpenspecProvider>
              </FsProvider>
            </GitProvider>
          </NavigationProvider>
        </ProjectProvider>
      </PluginProvider>
    </SessionProvider>
  );
}
```

## Goals / Non-Goals

**Goals:**
- 8 層巢狀改為扁平陣列宣告
- 不改變任何 Provider 的實作或 context value
- utility 可被其他地方重用（例如 test harness）

**Non-Goals:**
- 不合併任何 Provider
- 不改變 Provider 順序（順序有意義：下層可能依賴上層）
- 不改動 SocketProvider（它在 AppProviders 外面，有條件渲染）

## Decisions

### composeProviders 的 API

```tsx
type ProviderComponent = React.ComponentType<{ children: React.ReactNode }>;

function composeProviders(providers: ProviderComponent[]): ProviderComponent;
```

回傳一個新元件，渲染時從外到內依序包裹（陣列第一個 = 最外層）。

### 放置位置

`apps/web/src/utils/compose-providers.tsx` — 與其他 utility 同目錄。

## Risks / Trade-offs

- 極低風險：純語法糖，不改變任何執行邏輯
- 唯一可能踩到的坑：React DevTools 的 component 名稱變成 `ComposedProviders` 而非原本的 `AppProviders` — 可用 `displayName` 解決
