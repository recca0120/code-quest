## ADDED Requirements

### Requirement: Git status cache entries are evicted when no subscribers remain
`createQueryCache` SHALL provide an `evict(key)` method that removes the cached value for the given key. `GitProvider` SHALL call `evict(cwd)` when the last subscriber for a given cwd unsubscribes, preventing stale git status data from accumulating across worktree/project switches.

#### Scenario: Single subscriber unsubscribes
- **WHEN** the only subscriber for cwd `/repo` calls its unsubscribe function
- **THEN** the cache entry for `/repo` is removed from the query cache

#### Scenario: Multiple subscribers — partial unsubscribe does not evict
- **WHEN** two subscribers exist for cwd `/repo` and one unsubscribes
- **THEN** the cache entry for `/repo` is retained

#### Scenario: All subscribers unsubscribe
- **WHEN** all subscribers for cwd `/repo` have unsubscribed
- **THEN** the cache entry for `/repo` is removed

#### Scenario: New subscription after eviction fetches fresh data
- **WHEN** a cache entry has been evicted and a new subscriber subscribes to the same cwd
- **THEN** a fresh git status fetch is triggered (cache miss)
