# 部署验收清单

## 微信开发者工具

1. 导入实际项目目录 `D:\WeChatProjects\YueShiFu_MiniSociety`。
2. 已配置的真实 AppID 和云环境 ID应保持不变，避免导入占位配置覆盖。
5. 右键 `cloudfunctions` 下每个函数，选择“上传并部署：云端安装依赖”。

## 已配置环境的 CLI 重部署

在 `D:\WeChatProjects\YueShiFu_MiniSociety` 执行：

```powershell
npx --yes --package @cloudbase/cli tcb fn deploy --all --force
```

数据库集合和索引可在源码根目录执行：

```powershell
node scripts/provision-cloudbase.mjs collections
node scripts/provision-cloudbase.mjs indexes
```

上述初始化脚本是幂等的：已有集合和索引会被跳过。它不设置数据库安全规则，安全规则仍必须在云开发控制台完成。

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
- `notifications`
- `privacy_requests`
- `community_topics`
- `topic_votes`
- `ad_events`
- `merchant_agreements`

创建后按照 [云数据库安全规则](database-security.md) 将所有集合的客户端读写设为拒绝；小程序只通过云函数访问数据。

初始邀请码示例：

```json
{
  "code": "A1-2027",
  "building": "1号楼",
  "unit": "",
  "maxUses": 100,
  "usedCount": 0,
  "disabled": false,
  "expiresAt": "2027-12-31T15:59:59.000Z"
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

## 新增交付前功能验收

1. 在项目根目录运行 `powershell -ExecutionPolicy Bypass -File scripts/validate-project.ps1`，应输出 `PROJECT_VALIDATION_OK`。
2. 创建 `privacy_requests`、`community_topics`、`topic_votes` 集合，并建立索引：
   - `privacy_requests`: `_openid, createdAt`、`status, createdAt`
   - `community_topics`: `status, voteCount, createdAt`
   - `topic_votes`: `topicId, _openid`（唯一）
3. 未认证用户可浏览问题投票；认证业主可发布、投票；商家账户不能参与投票。
4. 业主可提交信息更正、注销和投诉申请；同类型待处理申请不可重复提交。
5. 仅 `system_admin` 可在 M1 运营中心查看申请、标记处理或回复暂不受理；每次处理应写入 `audit_logs`。
5. 验房清单勾选后重进页面，进度应从本机恢复；清空后恢复为 0%。
6. 装修预算只展示参考区间和不可预见费，不得展示商家报价或支付入口。
7. 商家目录只展示审核通过的公开介绍和服务类别，不展示联系方式、资质附件或业主信息。
8. 系统管理员进入 M1 运营中心，检查认证业主、30 日活跃、装修需求、有效线索、合作商家、在投广告和收入数据。
9. 使用系统管理员审核商家申请时，必须勾选至少一个可发布板块；通过后申请人应成为 `merchant`，仅可在被授权的 `renovation`、`ad`、`groupbuy` 板块发帖，且其帖子进入审核队列。
10. 系统管理员只能把已获得联系方式授权的装修需求分配给商家；商家在“我的服务线索”中只可查看分配给自己的记录，且仅在授权后看到联系方式并标记已联系。
11. 商家目录只能展示审核通过申请的公开介绍、服务范围、报价说明和案例图；不得展示审核联系方式或资质附件。
12. 商家公开介绍、服务范围和报价说明应通过云端文本安全检测；案例图须在系统管理员审核后才可公开展示。
13. 创建 `ad_events` 集合及 `dedupeKey` 唯一索引；广告曝光和点击按用户、广告、日期、事件去重，M1 广告列表应显示累计曝光和点击。
14. 以认证业主创建一条已授权联系方式的装修需求，并完成商家分配；业主撤回授权后，商家线索页仍可查看需求摘要，但不得再返回或展示该联系方式，且 `audit_logs` 应有撤回记录。
15. 创建 `merchant_agreements` 集合及索引：`merchantId, updatedAt`、`status, updatedAt`；系统管理员可选择已授权商家建立线下合作记录，合同金额、实收金额和退款金额应满足“合同金额大于 0、实收不高于合同、退款不高于实收”，每次新增或修改应写入 `audit_logs`。
16. 部署 `createPost`、`merchantApply` 云函数时确认其 `config.json` 中已声明 `security.msgSecCheck` 与 `security.imgSecCheck`；分别上传一张合规公开图片并完成发帖/商家申请，违规或接口异常时不得写入公开图片记录。
17. 部署 `adManage` 云函数时确认其 `config.json` 声明 `security.msgSecCheck`；系统管理员必须选择已授权商家后才能创建广告位，首页轮播应展示“广告 · 商家名称”，广告创建、更新和下架应写入 `audit_logs`。
18. 认证申请页必须勾选“我已阅读并同意隐私说明”才能提交；直接调用 `verifyInvite` 且 `privacyAccepted` 不为 `true` 时服务端必须拒绝，成功申请的 `users` 记录应包含 `privacyAcceptedAt`。
19. 按 [云数据库安全规则](database-security.md) 配置所有集合为客户端读写拒绝；用非管理员账号直接访问数据库应失败，但通过小程序云函数的正常业务流程应成功。
20. 创建 `notifications` 集合及索引：`_openid, createdAt`、`_openid, read, createdAt`；依次执行认证审核、帖子审核、评论、商家审核、装修线索分配和撤回授权，确认只有对应当事人能在“消息通知”看到不含联系方式的进展消息。
