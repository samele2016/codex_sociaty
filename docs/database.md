# 云数据库设计

## 集合

### users

字段：`_openid`、`nickName`、`avatarUrl`、`verified`、`building`、`unit`、`role`、`banned`、`createdAt`、`updatedAt`。

索引：

- `_openid`
- `verified, role`

### communities

字段：`name`、`notice`、`rules`、`buildings`、`createdAt`、`updatedAt`。

### invites

字段：`code`、`building`、`unit`、`maxUses`、`usedCount`、`expiresAt`、`disabled`、`createdAt`。

索引：

- `code`
- `expiresAt`

### posts

字段：`_openid`、`authorId`、`category`、`title`、`content`、`images`、`fields`、`contact`、`status`、`auditStatus`、`auditReason`、`pinned`、`featured`、`solved`、`expiredAt`、`viewCount`、`likeCount`、`favoriteCount`、`commentCount`、`createdAt`、`updatedAt`。

索引：

- `status, pinned, createdAt`
- `category, status, createdAt`
- `_openid, createdAt`

### comments

字段：`postId`、`_openid`、`authorId`、`content`、`parentId`、`status`、`createdAt`。

索引：

- `postId, status, createdAt`

### reports

字段：`targetType`、`targetId`、`reason`、`detail`、`_openid`、`status`、`createdAt`、`handledAt`、`handlerOpenid`。

索引：

- `status, createdAt`
- `targetType, targetId`

### likes / favorites

字段：`postId`、`_openid`、`createdAt`。

唯一约束建议：

- `postId, _openid`

### contact_logs

字段：`postId`、`viewerOpenid`、`authorOpenid`、`createdAt`。

### audit_logs

字段：`action`、`targetType`、`targetId`、`operatorOpenid`、`before`、`after`、`reason`、`createdAt`。

## 初始数据建议

1. 在 `communities` 创建一条社区记录，填写小区名、公告和公约。
2. 在 `invites` 创建楼栋邀请码，例如 `A1-2026`，设置 `maxUses` 和 `expiresAt`。
3. 管理员首次登录后，在 `users` 中将对应记录的 `role` 改为 `admin`。
