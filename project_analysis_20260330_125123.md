# MornContract / ContractHub 项目现状分析与按模块开发清单

- 生成时间：2026-03-30 12:51:23 +08:00
- 分析依据：本结论基于当前仓库代码结构、页面路由、API 路由、数据层与组件实现，不依据仓库内旧文档。
- 分析范围：`app/`、`components/`、`lib/`、`middleware.ts`、支付/认证/管理后台相关 API。

## 一、先给结论

### 1. 这个项目从代码上看，目标是什么

这是一个“面向中国版与国际版双部署”的数字合同平台，目标不是单一的合同编辑器，而是一个完整业务系统，主要想完成这些能力：

1. 用户注册、登录、找回密码、第三方登录。
2. 基于聊天内容或 AI 对话生成合同。
3. 合同的创建、保存、管理、签署、查看、下载。
4. 企业资料管理，并支持营业执照 OCR 识别。
5. 订阅付费、支付状态跟踪、账单历史。
6. 管理后台，包括用户、订阅、广告、数据分析、版本管理。
7. 中国区与国际区分流部署：
   - 中国区偏向 CloudBase、微信、支付宝、通义千问。
   - 国际区偏向 Supabase、Google、Stripe/PayPal/OpenAI。
8. 补充终端形态，包括移动端页面、微信相关入口、下载页。

### 2. 当前整体完成度判断

从代码看，这个项目不是纯 Demo，也不是“只有静态页面”的半成品。它已经具备了几条真实业务链路，但仍然没有形成“全链路闭环的生产级合同平台”。

更准确地说，目前状态是：

- 已经有较完整底座：
  - 区域分流
  - 认证体系
  - 合同表/集合 CRUD
  - AI 分析/生成接口
  - 支付与订阅数据层
  - 管理后台主要模块
- 已经能跑通部分主链路：
  - 登录注册
  - 企业信息录入/OCR
  - 文本导入对话并做 AI 分析
  - AI 生成合同草稿
  - 合同列表读取/删除
  - 支付创建、账单历史、部分支付确认
- 但仍有明显未闭环区域：
  - 新版创建流程结果主要放在 `sessionStorage`，没有完整持久化闭环
  - 合同详情/下载/签署流程没有全部接通
  - 文档库、移动端、微信小程序、团队、签署待办等模块大量是演示态
  - 后台权限校验不完整
  - 国内支付确认逻辑存在明确 TODO

### 3. 一句话结论

如果按成熟度划分，这个项目更接近：

- “已完成平台骨架 + 若干真实业务模块已落地 + 关键闭环仍待补齐”

而不是：

- “可以直接上线的完整合同 SaaS”

---

## 二、按模块梳理：项目需要完成什么、现在完成了什么

## 1. 基础架构与双区部署

### 代码显示项目需要完成的功能

- 支持中国区与国际区两套部署模式。
- 根据地区切换认证、数据库、支付、AI 与下载配置。
- 中间件统一做鉴权、地区判断、请求限制、安全头处理。

### 当前已完成

- 已有明显双区架构：
  - 区域判断与配置：`lib/config/region.ts`、`lib/config/deployment.config.ts`
  - 数据层兼容 CloudBase / Supabase：`lib/data/*`、`lib/integrations/supabase*.ts`、`lib/cloudbase/*`
  - AI 双提供方：`lib/ai/contract-ai.ts`
  - 支付双区思路：`lib/payment/adapter.ts`
- `middleware.ts` 已实现：
  - 受保护路由拦截：`/create`、`/dashboard`、`/contracts`、`/profile`、`/settings`
  - API CORS 预检处理
  - POST 请求体大小限制
  - 地理区域检测与响应头注入
  - 欧洲地区访问阻断
  - CSRF 防护接入

### 当前不足

- `/admin` 未纳入 `middleware.ts` 的受保护路由列表。
- 管理后台 API 的权限模型不统一，只有部分接口校验登录。
- 下载页引用了 `/api/downloads`，但当前代码中没有对应路由。

### 模块状态

- 状态：部分完成，底座较强，但权限与部分配套路由未收口。

---

## 2. 认证与账户体系

### 代码显示项目需要完成的功能

- 邮箱密码登录/注册
- 国际版 OTP 登录与找回密码
- Google 登录
- 微信登录
- 登录态刷新、退出、获取当前用户
- 用户资料和账户设置管理
- 密码安全、锁定、防爆破

### 当前已完成

- 认证页面较完整：`app/auth/page.tsx`
  - 登录/注册切换
  - 密码登录
  - 国际版 OTP 登录
  - 忘记密码与重设密码
  - 中国区隐私同意校验
  - 中国区微信登录入口
  - 国际区 Google 登录入口
- 后端认证接口较全：
  - 登录：`app/api/auth/login/route.ts`
  - 注册：`app/api/auth/register/route.ts`
  - 获取当前用户：`app/api/auth/me/route.ts`
  - 刷新：`app/api/auth/refresh/route.ts`
  - 退出：`app/api/auth/logout/route.ts`
  - 更新：`app/api/auth/update/route.ts`
  - 状态：`app/api/auth/status/route.ts`
  - 配置：`app/api/auth/config/route.ts`
  - 微信相关：`app/api/auth/wechat/route.ts`、`app/api/auth/cloudbase-wechat/route.ts`
- 用户资料与设置页已落地：
  - 资料页：`app/profile/page.tsx`
  - 设置页：`app/settings/page.tsx`
  - 控制台设置页：`app/dashboard/settings/page.tsx`
  - API：`app/api/profile/route.ts`
- 安全能力已有实现：
  - 密码强度：`lib/security/password-security.ts`
  - 账户锁定：`lib/security/account-lockout.ts`
  - 令牌处理：`lib/auth/*`

### 当前不足

- 短信验证码发送仍未接真实短信服务：
  - `app/api/auth/sms/send/route.ts` 中有 TODO。
- 管理员解锁接口权限不完整：
  - `app/api/auth/unlock/route.ts` 明确写了“TODO: 添加管理员角色检查”。
- 登录与账户功能整体可用，但后台管理权限边界仍未闭环。

### 模块状态

- 状态：基本完成，属于当前仓库里完成度较高的模块之一。

---

## 3. 合同创建主流程

这个模块是项目核心，但当前存在“新版流程”和“旧版入口”并存的问题。

### 3.1 新版流程：`/create`

#### 代码显示项目需要完成的功能

- 选择导入方式
- 导入聊天内容
- AI 提取关键信息
- 人工校对
- AI 生成正式合同
- 编辑、保存、导出
- 最终沉淀为真实合同记录

#### 当前已完成

- 新版 4 步流转页面已经存在：
  - 入口：`app/create/page.tsx`
  - 导入：`app/create/import/page.tsx`
  - 分析确认：`app/create/analyze/page.tsx`
  - 编辑导出：`app/create/edit/page.tsx`
- 导入方式选择已做：
  - 文本导入可用
  - 截图 OCR、微信会话导入被明确标为不可用/即将上线
  - 见：`components/create/create-contract-screen.tsx`
- AI 能力已接真实接口：
  - 对话分析：`app/api/contracts/analyze/route.ts`
  - 合同生成：`app/api/contracts/generate/route.ts`
  - AI 实现：`lib/ai/contract-ai.ts`
- 编辑页已支持：
  - 富文本基础操作
  - 复制文本
  - 浏览器打印/导出 PDF

#### 当前不足

- 这条新版流程的关键问题是：主要依赖 `sessionStorage` 串联页面，而不是服务端持久化。
  - `app/create/import/page.tsx`
  - `app/create/analyze/page.tsx`
  - `app/create/edit/page.tsx`
- 编辑页“保存”只是保存回 `sessionStorage`，没有真正写入合同表。
- 生成完成后没有自动调用 `/api/contracts` 把合同正式入库。
- 没有“生成完成 -> 合同详情页 -> 可再次编辑/下载/签署”的闭环。

#### 模块状态

- 状态：部分完成，AI 工作流可跑，但业务闭环未完成。

### 3.2 旧版合同创建入口：`/contracts/new`

#### 当前已完成

- 旧入口页展示了两种创建方式：
  - 上传 PDF 模板：`/contracts/upload-template`
  - AI 对话生成：`/contracts/ai-generate`
- 企业信息检查逻辑已接入：`app/contracts/new/page.tsx`

#### 当前不足

- PDF 模板导入页是明显演示态：
  - `app/contracts/upload-template/page.tsx`
  - 使用了“模拟上传和分析过程”的注释与 `setTimeout`
  - 没有真实 PDF 解析/识别/模板字段映射
- AI 对话页可对话生成文本合同，但更像独立旧方案：
  - `app/contracts/ai-generate/page.tsx`
  - 生成后是下载 `.txt`，并未进入统一合同管理闭环
- 新旧两套创建流程并存，产品路径不统一。

#### 模块状态

- 状态：部分完成，但存在历史方案与新方案并存的问题。

---

## 4. 合同数据层与合同管理

### 代码显示项目需要完成的功能

- 合同的新增、查询、详情、更新、删除
- 用户侧合同列表
- 控制台合同列表
- 后续详情、下载、签署等动作

### 当前已完成

- 合同数据层已存在真实 CRUD：
  - 数据层：`lib/data/contracts-store.ts`
  - 用户端客户端：`lib/contracts/client.ts`
  - API：
    - `app/api/contracts/route.ts`
    - `app/api/contracts/[id]/route.ts`
- 支持中国区 CloudBase / 国际区 Supabase 的合同读取和写入。
- 用户侧合同列表页已接真实数据：
  - `app/contracts/page.tsx`
- 控制台合同列表页已接真实数据：
  - `app/dashboard/contracts/page.tsx`
  - `components/dashboard/contract-list.tsx`
- 删除合同已经可用。

### 当前不足

- “查看详情”按钮仍是占位：
  - `app/contracts/page.tsx`
  - `components/dashboard/contract-list.tsx`
  - 当前点击后仍是 `Coming Soon` / `window.alert`
- “下载合同”按钮仍是占位。
- 缺少真正的合同详情页、预览页、下载导出接口。
- 创建流程与合同数据层没有完全打通，导致“有合同 CRUD API，但新版创建流程没有真正写入它”。

### 模块状态

- 状态：数据层和列表层已完成较多，详情/下载/创建闭环未完成。

---

## 5. 企业信息与营业执照 OCR

### 代码显示项目需要完成的功能

- 用户保存企业基础信息
- 营业执照上传
- OCR 自动识别公司名称、统一信用代码、法人、地址
- 保存后复用于合同生成

### 当前已完成

- 企业信息页面完整：
  - `app/contracts/company-setup/page.tsx`
- 企业信息 API 已完成：
  - `app/api/company-info/route.ts`
- 数据层已完成：
  - `lib/data/company-profile-store.ts`
- OCR 接口已接真实能力：
  - `app/api/ocr/business-license/route.ts`
  - `lib/ocr/business-license.ts`
- OCR 可根据地区切换：
  - 中国区 DashScope
  - 国际区 OpenAI

### 当前不足

- 识别后与合同创建流程的自动填充还不够深，只完成了企业资料侧的保存。
- 截图导入合同内容与营业执照 OCR 是两条独立能力，尚未融合成统一“图片理解+合同生成”产品流程。

### 模块状态

- 状态：完成度较高，可视为已落地模块。

---

## 6. 支付、订阅与账单

### 代码显示项目需要完成的功能

- 订阅方案展示
- 支付创建
- 支付继续/取消/确认/状态查询
- 支付回调处理
- 账单历史
- 订阅状态同步到用户

### 当前已完成

- 支付页较完整：
  - `app/payment/page.tsx`
  - 订阅方案、支付表单、账单历史三段式 UI
- 账单历史已经接 API：
  - `components/payment/billing-history.tsx`
  - `app/api/payment/history/route.ts`
- 支付 API 较全：
  - 创建：`app/api/payment/create/route.ts`
  - 继续：`app/api/payment/continue/route.ts`
  - 取消：`app/api/payment/cancel/route.ts`
  - 确认：`app/api/payment/confirm/route.ts`
  - 状态/验证/Webhook 若干：`app/api/payment/*`
- 支付数据层已经存在：
  - `lib/data/billing-store.ts`
- 一次性支付确认成功页已存在：
  - `app/payment/success/page.tsx`
- 已做一定安全与幂等控制：
  - 支付限流
  - 重复支付拦截
  - 支付记录写库

### 当前不足

- 国内版支付确认逻辑没有真正更新订阅状态：
  - `app/api/payment/confirm/route.ts`
  - 代码中有明确 TODO：CloudBase 订阅更新逻辑未实现
- `app/api/payment/continue/route.ts` 中有基于金额推断套餐/周期的兜底逻辑，说明支付恢复流程仍较粗糙。
- 管理后台订阅 API 虽然做了认证，但没有看到严格管理员校验。
- 支付体系可用，但“不同支付方式 + 双区 + 订阅状态同步”的一致性仍需收口。

### 模块状态

- 状态：部分完成，支付主链路存在，但订阅闭环仍需强化，尤其是中国区。

---

## 7. 管理后台

### 代码显示项目需要完成的功能

- 平台总览
- 用户管理
- 订阅管理
- 数据分析
- 广告管理
- 应用版本管理
- 后台设置

### 当前已完成

- 后台页面体系完整：
  - `app/admin/page.tsx`
  - `app/admin/users/page.tsx`
  - `app/admin/subscriptions/page.tsx`
  - `app/admin/analytics/page.tsx`
  - `app/admin/ads/page.tsx`
  - `app/admin/versions/page.tsx`
  - `app/admin/settings/page.tsx`
- 用户管理能力较完整：
  - 列表、搜索、套餐过滤、详情、封禁/恢复
  - API：
    - `app/api/admin/users/route.ts`
    - `app/api/admin/users/[id]/route.ts`
  - 数据层：`lib/data/admin-management-store.ts`
- 订阅后台较完整：
  - 列表、支付记录、统计
  - API：`app/api/admin/subscriptions/route.ts`
- 分析后台较完整：
  - 用户趋势、合同趋势、收入趋势、分布图
  - API：`app/api/admin/analytics/route.ts`
  - 数据层：`lib/data/admin-insights-store.ts`
- 版本管理较完整：
  - 上传安装包
  - 版本记录
  - 启用/停用
  - 删除
  - API：
    - `app/api/admin/versions/route.ts`
    - `app/api/admin/versions/[id]/route.ts`
    - `app/api/admin/upload/route.ts`

### 当前不足

- 后台首页总览页本身是接真实 API 的，但控制台首页并不是：
  - `/admin` 数据来自真实统计
  - `/dashboard` 首页的 `DashboardStats` 与 `RecentActivity` 是写死数据
- 广告后台页面以统计为主，“创建广告位”按钮未接完整的新增流程。
- 最关键问题是后台权限安全明显不完整：
  - `middleware.ts` 未保护 `/admin`
  - `app/api/admin/*` 中只有 `subscriptions` 路由显式做了 token 校验
  - 其他如 `users`、`analytics`、`stats`、`versions`、`ads` 等接口当前代码中未见统一认证/管理员校验

### 模块状态

- 状态：功能面很完整，但后台安全边界没有收口，这是当前高优先级问题。

---

## 8. 控制台工作台、模板、签署、团队

### 当前已完成

- 控制台基础布局完成：
  - `app/dashboard/layout.tsx`
  - `components/layout/console-shell.tsx`
  - `components/dashboard/app-sidebar.tsx`
- 合同列表页已接真实数据。

### 当前不足

- 以下模块多数还是展示态/占位态：
  - 模板页：`app/dashboard/templates/page.tsx`
  - 签署待办页：`app/dashboard/signatures/page.tsx`
  - 团队页：`app/dashboard/team/page.tsx`
- 控制台首页统计与最近活动是静态数据：
  - `components/dashboard/dashboard-stats.tsx`
  - `components/dashboard/recent-activity.tsx`

### 模块状态

- 状态：控制台骨架已完成，但除合同列表外，大量业务页仍为演示态。

---

## 9. 文档库、验签与存证

### 代码显示项目需要完成的功能

- 文档存储
- 文档检索与下载
- 验签/区块链验证
- 合规与审计展示

### 当前已完成

- 页面与组件都已经搭好：
  - `app/dashboard/documents/page.tsx`
  - `app/dashboard/documents/[id]/verify/page.tsx`
  - `components/documents/document-library.tsx`
  - `components/documents/document-verification.tsx`
  - `components/documents/storage-stats.tsx`

### 当前不足

- 这些模块当前主要是静态演示数据：
  - `document-library.tsx` 里有写死的 `documents`
  - `document-verification.tsx` 里是固定展示内容
  - `storage-stats.tsx` 里是写死统计
- 没看到真实文档表、上传、下载、验签存证入库、哈希生成与链上交互闭环。

### 模块状态

- 状态：演示态，基本未进入真实业务闭环。

---

## 10. 移动端、微信小程序与微信生态

### 当前已完成

- 已有移动端页面壳：
  - `app/mobile/page.tsx`
  - `app/mobile/contracts/page.tsx`
  - `app/mobile/sign/page.tsx`
- 已有微信相关能力：
  - 微信登录入口与 OAuth 状态处理
  - 微信支付二维码页：`app/payment/wechat-qrcode/page.tsx`
  - 微信相关工具：`lib/wechat/*`

### 当前不足

- 移动端页面主要是静态数据演示：
  - `components/mobile/mobile-dashboard.tsx`
  - `components/mobile/mobile-contract-list.tsx`
  - `components/mobile/mobile-signature.tsx`
- 微信小程序展示组件也是静态数据：
  - `components/wechat/wechat-mini-program.tsx`
- 截图导入、微信会话直选等在新版创建流程里仍是不可用状态。

### 模块状态

- 状态：入口与展示已搭好，真实业务接入不足。

---

## 11. 广告与增长模块

### 当前已完成

- 有公共广告获取与曝光/点击统计 API：
  - `app/api/ads/route.ts`
  - `app/api/ads/track/route.ts`
- 有后台广告统计页：
  - `app/admin/ads/page.tsx`
- 数据汇总逻辑存在：
  - `lib/data/admin-insights-store.ts`

### 当前不足

- 后台广告页现在更偏“统计看板”，创建/编辑广告活动的完整前台流程未完成。
- 广告模块与前台页面的插槽接入情况，从当前代码中看并不充分。

### 模块状态

- 状态：部分完成，统计层较强，投放运营层不足。

---

## 12. 下载页、营销页与公开站点

### 当前已完成

- 官网公开页面体系较完整：
  - 首页、功能页、价格页、How it works、隐私、条款、联系页等
- 下载页已具备平台识别和下载配置读取逻辑：
  - `app/download/page.tsx`
  - `lib/config/download.config.ts`

### 当前不足

- 联系页信息是示例值：
  - `app/contact/page.tsx`
  - 邮箱与电话仍是 example/demo 风格
- 下载页在中国区会拼接 `/api/downloads`，但当前仓库没有该 API 路由。

### 模块状态

- 状态：公开站点可展示，但下载与联系信息仍需产品化。

---

## 三、哪些功能可以视为“已经做完”，哪些只能算“做了一半”

## 可以视为已经做完或接近做完的模块

- 双区部署底座与统一数据适配层
- 登录注册与基础账户体系
- 企业信息维护与营业执照 OCR
- 合同数据层 CRUD API
- 账单历史与部分支付链路
- 管理后台中的用户管理、订阅管理、分析统计、版本管理基础能力

## 只能算“做了一半”的模块

- 新版 AI 合同创建流程
- 合同详情/下载/导出闭环
- 支付订阅全链路，尤其中国区
- 后台权限与安全治理
- 广告运营闭环
- 下载页实际下载链路

## 明显还是演示态/占位态的模块

- 文档库与文档验签
- 控制台首页统计与最近活动
- 团队页
- 签署待办页
- PDF 模板导入页
- 移动端页面
- 微信小程序展示页

---

## 四、按模块拆解的开发清单

下面这部分是建议直接作为下一阶段执行清单使用。

## P0：优先级最高，必须先补齐

### 1. 合同创建闭环

- [ ] 把 `/create/import -> /create/analyze -> /create/edit` 从 `sessionStorage` 流程改为“服务端持久化流程”。
- [ ] 在 AI 分析完成后创建草稿合同记录，而不是只缓存浏览器数据。
- [ ] 在编辑页点击保存时，调用 `/api/contracts/[id]` 更新真实合同记录。
- [ ] 新增合同详情页，打通列表页“查看详情”按钮。
- [ ] 新增真实下载导出能力，替换列表页“下载即将上线”占位逻辑。
- [ ] 统一新版 `/create` 与旧版 `/contracts/new` 的产品路径，避免双入口分裂。

### 2. 后台权限与安全治理

- [ ] 把 `/admin` 加入路由保护。
- [ ] 为所有 `app/api/admin/*` 接口补充统一认证与管理员角色校验。
- [ ] 审计所有后台页面 `fetch('/api/admin/...')` 的访问链路，统一带 token。
- [ ] 完成 `app/api/auth/unlock/route.ts` 的管理员角色检查。
- [ ] 补充后台接口审计日志与错误告警。

### 3. 支付订阅闭环

- [ ] 完成中国区 `payment confirm` 的 CloudBase 订阅更新逻辑。
- [ ] 清理 `payment continue` 中按金额推断套餐/周期的兜底逻辑，改为读取真实订单元数据。
- [ ] 统一支付成功后“用户资料/订阅表/支付记录”的状态同步。
- [ ] 增加支付失败、退款、取消后的状态一致性处理。

---

## P1：高优先级，补齐核心业务体验

### 4. 合同管理与工作台真实数据化

- [ ] 将 `DashboardStats` 改成真实统计数据，而不是静态数值。
- [ ] 将 `RecentActivity` 改成基于合同/签署/支付/用户行为的真实活动流。
- [ ] 完成控制台首页、合同列表页、详情页之间的导航闭环。

### 5. 文档与存证模块落地

- [ ] 设计真实文档表/集合与上传存储结构。
- [ ] 实现合同导出文件的实际落库与下载。
- [ ] 将文档库改为真实数据读取。
- [ ] 将验签页改为按真实文档 ID 查询。
- [ ] 若要做链上存证，补充哈希生成、链上写入、链上查询与错误处理。

### 6. 签署流程落地

- [ ] 设计签署任务、签署方、签署状态、签署顺序的数据模型。
- [ ] 打通 `/dashboard/contracts/[id]/sign` 与实际签署数据。
- [ ] 将“签署待办”页从空态展示改为真实任务列表。
- [ ] 打通提醒、完成状态、签署日志。

### 7. PDF 模板导入真实化

- [ ] 为 `/contracts/upload-template` 接入真实 PDF 上传。
- [ ] 增加模板内容解析与可编辑字段识别。
- [ ] 让模板导入结果进入统一合同数据层，而不是停留在前端模拟流程。

### 8. 截图导入/OCR 合同输入

- [ ] 打通新版创建流程中的 screenshot 导入。
- [ ] 增加聊天截图 OCR 与结构化字段提取。
- [ ] 将 OCR 导入和文本导入统一进入同一分析接口与同一合同草稿模型。

---

## P2：中优先级，补齐扩展能力

### 9. 团队协作

- [ ] 为团队页设计真实成员、角色、邀请、移除、权限模型。
- [ ] 接入邀请链路、角色变更、成员列表真实数据。

### 10. 广告运营闭环

- [ ] 补充广告创建/编辑前台页面。
- [ ] 统一广告位配置、投放状态、排期、展示条件。
- [ ] 补充广告投放数据与公共页面插槽的真实联动。

### 11. 下载模块

- [ ] 补上 `/api/downloads` 或调整中国区下载实现路径。
- [ ] 核对下载配置、文件存储、平台识别与版本管理的联动。
- [ ] 将下载日志与版本管理打通。

### 12. 短信与本地化生态

- [ ] 完成短信发送服务接入。
- [ ] 统一手机号登录/验证与当前账号体系。
- [ ] 继续补齐微信生态相关流程。

---

## P3：后续优化项

### 13. 移动端与微信小程序正式化

- [ ] 将移动端仪表盘、合同列表、签署页改成真实数据驱动。
- [ ] 将微信小程序组件从展示样例改成真实业务容器。

### 14. 公开站点产品化

- [ ] 替换联系页示例邮箱与电话。
- [ ] 补充真实线索收集与转化链路。
- [ ] 将营销页与广告/下载/注册转化串联起来。

### 15. 技术债收口

- [ ] 清理旧版 `/contracts/new` 与新版 `/create` 的重复实现。
- [ ] 清理演示数据组件与历史占位页面。
- [ ] 补齐关键流程的自动化测试：
  - 认证
  - 合同 CRUD
  - AI 分析/生成接口
  - 支付确认
  - 后台权限

---

## 五、推荐的下一阶段实施顺序

如果要尽快把项目推进到“可上线试运行”状态，建议按下面顺序推进：

1. 先收口后台权限与管理员校验。
2. 再把新版合同创建流程持久化，打通合同详情/下载闭环。
3. 补齐中国区订阅支付确认逻辑。
4. 将工作台首页与文档模块数据化。
5. 再做 PDF 模板导入、截图导入、签署流、团队协作。
6. 最后处理移动端、小程序、广告运营、下载链路等扩展模块。

---

## 六、最终判断

当前代码说明这个项目的核心方向已经非常明确：

- 它要做的不是“单点 AI 写合同工具”，而是“合同生成 + 合同管理 + 支付订阅 + 双区部署 + 运营后台”的平台。

当前真正已经做出来的，是：

- 底座
- 认证
- OCR
- 合同 CRUD 基础
- AI 分析/生成接口
- 支付与后台的大部分骨架

当前最需要补的，不是再继续铺新页面，而是把这几条关键链路彻底闭环：

1. 新版创建流程持久化
2. 合同详情/下载/签署
3. 后台管理员权限
4. 中国区支付确认

只要这四块补齐，项目就会从“骨架完整的半成品平台”，进入“可以试运营的产品”阶段。
