# 云数据库设计

## 集合

### users

字段：`_openid`、`nickName`、`avatarUrl`、`verified`、`verificationStatus`、`verificationRequestedAt`、`verifiedAt`、`privacyAcceptedAt`、`houseNumber`、`building`、`unit`、`role`、`merchantCategories`、`managedCategories`、`banned`、`lastActiveAt`、`createdAt`、`updatedAt`。

索引：

- `_openid`
- `verified, role`
- `lastActiveAt`

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

### notifications

字段：`_openid`、`type`、`title`、`content`、`route`、`read`、`readAt`、`createdAt`。通知仅包含业务进展，不得记录房号、联系方式、身份证号或评论正文。

索引：

- `_openid, createdAt`
- `_openid, read, createdAt`

## M1 新增集合

- `delivery_updates`：工程进度，包含来源、来源类型、适用范围、版本、附件、发布状态和更新时间。
- `delivery_documents`：交付标准、户型资料等公开资料，包含楼栋、户型、来源、版本和文件 ID。
- `renovation_requests`：认证业主提交的装修需求。联系方式只有在业主勾选授权时写入，并记录 `authorizationAt`；业主撤回授权后会清空联系方式并记录 `authorizationRevokedAt`。
- `merchant_applications`：商家入驻申请、服务类别、审核联系方式、公开服务介绍、服务范围、报价说明、公开案例图、仅审核可见的资质附件、审核结果和系统管理员指定的 `postCategories`；服务类别不等同于发帖板块。
- `lead_assignments`：装修需求与商家的分配关系及处理状态；只在业主明确授权联系方式后创建。索引：`merchantId, createdAt`、`requestId, merchantId, status`。
- `ad_campaigns`：首页广告位，包含投放时间、位置、置顶标识和上下架状态。
- `ad_events`：广告的按日去重曝光和点击记录，保存广告 ID、事件类型、日期键和内部用户标识；仅用于运营统计，不向商家提供业主身份数据。索引：`dedupeKey`（唯一）、`adId, eventType, createdAt`。
- `revenue_logs`：广告位、商家套餐等收入流水，由系统管理员录入，M1 不接入微信支付。
- `merchant_agreements`：系统管理员维护的线下商家合作台账，保存已授权商家、合作项目、合同/订单编号、服务期、合同金额、实收金额、退款金额、退款规则、履约状态和备注；不得保存业主联系方式或付款凭证原件。索引：`merchantId, updatedAt`、`status, updatedAt`。
- `privacy_requests`：用户主动提交的信息更正、账号注销和隐私投诉申请，保存 `userId`、类型、说明、状态、处理说明、处理人和处理时间；不得向商家开放。索引：`_openid, createdAt`、`status, createdAt`。
- `community_topics`：业主公开问题，包含分类、正文、投票数和发布状态。
- `topic_votes`：认证业主与问题的投票关系；建议为 `topicId, _openid` 建立唯一约束。

## M1 云函数

- `deliveryHub`：公开查询和管理员维护工程进度、交付资料。
- `renovationLead`：认证业主提交需求，管理员查看和更新线索状态。
- `merchantApply`：商家申请、管理员审核。
- `adManage`：首页广告查询和系统管理员投放管理。
- `opsStats`：运营统计、系统管理员收入流水录入和线下商家合作台账维护。
- `accountService`：用户查看并提交隐私、资料更正、账号注销和投诉申请。
- `communityTopics`：公开问题浏览、认证业主发起问题和投票。
- `merchantDirectory`：公开返回已审核商家的名称、服务类别和服务介绍，不返回联系方式、资质附件或业主数据。

## 初始数据建议

1. 在 `communities` 创建一条社区记录，填写小区名、公告和公约。
2. 在 `invites` 创建楼栋邀请码，例如 `A1-2027`，设置 `maxUses` 和覆盖交付前后认证周期的 `expiresAt`。
3. 系统管理员首次登录后，在 `users` 中将对应记录的 `role` 改为 `system_admin`（兼容旧值 `admin`，两者在权限上都视为系统管理员）；系统管理员只能保留 1 人。
4. 系统管理员在小程序管理后台为商家配置 `merchantCategories`，例如 `['renovation', 'ad', 'groupbuy']`。
