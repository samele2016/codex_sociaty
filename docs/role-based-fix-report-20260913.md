# 三身份测试修复记录（2026-09-13）

## 修复范围

- `QA-ROLE-001 / P0`：普通帖子联系方式增加服务端角色校验。商家不能读取住户联系方式，仅帖子作者可查看自己发布内容中的联系方式。
- `QA-ROLE-002 / P1`：点赞、收藏同时增加前端入口控制和云函数角色校验，商家请求会被明确拒绝。
- `QA-ROLE-003 / P1`：业主共议页不再向商家展示发起和投票入口，直接调用页面方法也会被阻断；服务端原有业主校验继续保留。
- `QA-ROLE-004 / P1`：普通用户直达管理后台或 M1 运营中心时，服务端拒绝后立即返回个人中心，不再停留在管理框架。
- 商家举报入口及 `reportContent` 云函数同步采用相同的邻里互动角色边界。

## UI 调整

- 全局迷你按钮、管理员页签和操作按钮、商家申请上传/删除控件、发布页图片删除控件统一到至少 `44px` 点击区域。
- 将遗留的 `12px`、`23rpx`、`24rpx` 辅助文字提升到可读的 `13px` 或 `14px`。
- 频道页和交付页保留微信原生导航返回，移除页面内重复返回控件。
- 保持页面最大宽度、平板断点及底部安全区规则，未引入会导致 1K/2K 逻辑宽度拉伸的固定内容宽度。

## 验证结果

- `scripts/validate-project.ps1`：通过，输出 `PROJECT_VALIDATION_OK`。
- `scripts/test-role-permissions.cjs`：通过，输出 `ROLE_PERMISSION_TESTS_OK`。
- UI 静态扫描：未再发现 `12px`、`20-24rpx` 字号或小于 `44px` 的已知点击目标模式。
- 修复文件已按文件同步至 `D:\WeChatProjects\YueShiFu_MiniSociety`。
- `getPostDetail`、`toggleLikeFavorite`、`reportContent` 已通过 CloudBase CLI 部署成功。

## 待人工环境验证

微信开发者工具的“服务端口”目前关闭，官方 `miniprogram-automator` 无法连接，因此本轮未重新生成三身份模拟器运行时报告。开启“设置 → 安全设置 → 服务端口”后，应重新执行：

```powershell
& 'D:\微信web开发者工具\cli.bat' auto --project 'D:\WeChatProjects\YueShiFu_MiniSociety' --auto-port 9420 --trust-project --lang zh
& 'D:\Program Files\nodejs\node.exe' 'C:\Users\neo\Documents\社区助手\scripts\role-runtime-e2e.cjs'
```

生产环境仍应使用三类真实 OpenID 再确认一次：商家打不开联系方式、点赞收藏和业主议题；住户直达管理页会被退回个人中心。
