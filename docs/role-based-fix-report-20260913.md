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
- `scripts/test-page-role-guards.cjs`：通过，输出 `PAGE_ROLE_GUARD_TESTS_OK`；覆盖商家详情页互动阻断、业主议题编辑器阻断，以及普通住户直达管理后台/M1 运营中心后的退出逻辑。
- `scripts/role-runtime-e2e.cjs`：在微信开发者工具模拟器中完成 32 项运行态回归，32 项通过、0 项失败、P0/P1 均为 0。
- UI 静态扫描：未再发现 `12px`、`20-24rpx` 字号或小于 `44px` 的已知点击目标模式。
- 修复文件已按文件同步至 `D:\WeChatProjects\YueShiFu_MiniSociety`。
- `getPostDetail`、`toggleLikeFavorite`、`reportContent` 已通过 CloudBase CLI 部署成功。

## 运行态验证

2026-09-19 已开启微信开发者工具服务端口，并通过官方 `miniprogram-automator` 完成公共链路、普通住户、系统管理员和商家四组运行态测试。报告写入 `docs/test-evidence-20260913/role-runtime-results.json`。

```powershell
& 'D:\微信web开发者工具\cli.bat' auto --project 'D:\WeChatProjects\YueShiFu_MiniSociety' --auto-port 9420 --trust-project --lang zh
& 'D:\Program Files\nodejs\node.exe' 'C:\Users\neo\Documents\社区助手\scripts\role-runtime-e2e.cjs' '--ws=ws://127.0.0.1:9420'
```

本轮已确认商家不能查看普通帖子联系方式、不能评论/点赞收藏或参与业主议题；普通住户直达管理页会退回个人中心；管理员 M1 运营操作链路正常。正式发布前仍建议使用生产环境的真实 OpenID 做一次三身份冒烟验收。
