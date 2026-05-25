# 部署验收清单

## 微信开发者工具

1. 导入项目根目录 `C:\Users\neo\Documents\社区助手`。
2. 将 `project.config.json` 的 `appid` 改成真实小程序 AppID。
3. 开通云开发环境，复制环境 ID。
4. 将 `miniprogram/app.js` 的 `env` 改成真实云环境 ID。
5. 右键 `cloudfunctions` 下每个函数，选择“上传并部署：云端安装依赖”。

## 云数据库

按 `docs/database.md` 创建集合和索引：

- `users`
- `communities`
- `invites`
- `posts`
- `comments`
- `reports`
- `likes`
- `favorites`
- `contact_logs`
- `audit_logs`

初始邀请码示例：

```json
{
  "code": "A1-2026",
  "building": "1号楼",
  "unit": "",
  "maxUses": 100,
  "usedCount": 0,
  "disabled": false,
  "expiresAt": "2026-12-31T15:59:59.000Z"
}
```

## 管理员设置

1. 管理员先打开小程序完成一次登录。
2. 在 `users` 集合找到管理员的记录。
3. 将 `role` 从 `member` 改为 `admin`。
4. 重新进入“我的”，应看到“管理后台”入口。

## 验收路径

- 未认证用户：能浏览帖子，发布/评论/查看联系方式会跳转认证。
- 认证用户：能发布普通帖子，详情页能评论、点赞、收藏、举报。
- 广告/团购：发布后进入待审核，管理员通过后才出现在广场。
- 举报处理：用户举报后，管理员后台能看到并标记处理。
- 权限校验：非管理员访问 `adminModerate` 应返回“需要管理员权限”。
