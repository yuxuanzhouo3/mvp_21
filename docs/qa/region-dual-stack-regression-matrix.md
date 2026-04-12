# CN/INTL 区域双栈一致性回归矩阵

- 更新时间：2026-04-12（Asia/Shanghai）
- 目标：系统化验证 CN/INTL 在认证、支付、数据写入、邀请、分享核心链路上的“预期差异”和“行为一致”。
- 原则：
1. 区域差异必须可解释（例如支付通道支持不同）。
2. 非区域相关能力必须同语义同状态码（例如公开验真、邀请错误映射）。
3. 每个矩阵项都绑定自动化测试。

## 1. 认证域

| 能力 | CN 预期 | INTL 预期 | 自动化覆盖 |
|---|---|---|---|
| 鉴权提供方 | CloudBase / WeChat 体系 | Supabase / Google 体系 | `tests/region-dual-stack-capabilities.test.ts` |
| 缺失 Supabase 配置时行为 | 不强依赖 Supabase | 生产环境严格阻断 | `tests/supabase-runtime-config.test.ts` |

## 2. 支付域

| 能力 | CN 预期 | INTL 预期 | 自动化覆盖 |
|---|---|---|---|
| 支付方式支持矩阵 | `wechat`/`alipay` 支持，`stripe`/`paypal` 不支持 | `stripe`/`paypal` 支持，`wechat`/`alipay` 不支持 | `tests/region-dual-stack-capabilities.test.ts` |
| 一次性支付会员生效入口 | 使用统一入口，默认货币 CNY | 使用统一入口，默认货币 USD | `tests/region-dual-stack-onetime-sync.test.ts` |
| 幂等收敛 | confirm/webhook 共用同一状态更新入口 | confirm/webhook 共用同一状态更新入口 | `tests/onetime-membership-sync.test.ts` |

## 3. 数据写入域

| 能力 | CN 预期 | INTL 预期 | 自动化覆盖 |
|---|---|---|---|
| 一次性支付兜底记录写入 | CloudBase `payments` 集合 | Supabase `payments` 表 | `tests/region-dual-stack-onetime-sync.test.ts` |
| 订阅状态更新 | 统一由 `applySubscriptionPaymentSuccess` 收敛 | 统一由 `applySubscriptionPaymentSuccess` 收敛 | `tests/onetime-membership-sync.test.ts` |

## 4. 邀请与分享域

| 能力 | CN 预期 | INTL 预期 | 自动化覆盖 |
|---|---|---|---|
| 公开团队邀请预览接口 | 同状态码同返回结构 | 同状态码同返回结构 | `tests/region-dual-stack-public-routes.test.ts` |
| 公开文档验真接口 | 同状态码同返回结构 | 同状态码同返回结构 | `tests/region-dual-stack-public-routes.test.ts` |
| 邀请接受错误映射 | 同错误码映射同 HTTP 状态 | 同错误码映射同 HTTP 状态 | `tests/region-dual-stack-public-routes.test.ts` |

## 5. 执行方式

1. 本地执行：`npm run test:region-consistency`
2. 发布门禁建议：在 CI 中加入 `test:region-consistency`（可与 `test:release-gate` 并行）。

