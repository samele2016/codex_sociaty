# 云数据库安全规则

## 基本原则

小程序客户端不直接读写任何云数据库集合。所有读取、发布、审核、认证、商家线索、广告统计和隐私请求均由云函数处理，云函数负责根据 `OPENID`、认证状态、角色和内容状态执行校验。

## 控制台配置

在微信云开发控制台，为下列所有集合设置“客户端读写均拒绝”的安全规则；管理员在控制台与云函数仍可维护数据。不要为方便调试而开放匿名读取或写入。

- `users`、`communities`、`invites`
- `posts`、`comments`、`reports`、`likes`、`favorites`
- `contact_logs`、`audit_logs`、`notifications`、`privacy_requests`
- `delivery_updates`、`delivery_documents`
- `renovation_requests`、`lead_assignments`
- `merchant_applications`、`merchant_agreements`
- `ad_campaigns`、`ad_events`、`revenue_logs`
- `community_topics`、`topic_votes`

公开内容同样通过 `listPosts`、`deliveryHub`、`merchantDirectory`、`communityTopics` 和 `adManage` 的受限查询返回。这样能保证草稿、待审核内容、业主联系方式、认证资料、资质文件与运营数据不会因数据库规则误配而暴露。

## 验收

1. 使用任意非管理员小程序账号尝试直接调用数据库 SDK 的读写操作，应被安全规则拒绝。
2. 小程序正常浏览、发帖、认证、评论、广告展示与管理员后台仍应通过云函数正常工作。
3. 每次新建集合都必须加入本文件和 [部署验收清单](deployment-checklist.md)，默认拒绝客户端读写后再发布。
