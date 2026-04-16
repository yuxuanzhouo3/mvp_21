import { normalizeContractEnhancementMeta } from "@/lib/contracts/enhancements";
import { type UnifiedContractRecord } from "@/lib/data/unified-models";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import {
  type DashboardActivity,
  type DashboardBillingRecord,
  type DashboardBillingSummary,
  type DashboardOverviewData,
  type DashboardTeamData,
  type DashboardTeamInvite,
  type DashboardTeamInvitePreview,
  type DashboardTeamMember,
  type DashboardTeamPermissions,
  type DashboardTemplate,
  type DashboardTemplatePermissions,
} from "@/lib/dashboard/types";
import { type DashboardCurrentUser } from "@/lib/dashboard/server-auth";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import { buildMembershipEntitlements } from "@/lib/membership/policy";

import { getLatestSubscriptionByUser, listPaymentsByUser } from "@/lib/data/billing-store";
import { listContracts } from "@/lib/data/contracts-store";
import {
  buildWorkspaceInviteUrl,
  createWorkspaceInvite,
  getWorkspaceInviteByToken,
  incrementWorkspaceInviteAccess,
  isWorkspaceInviteExpired,
  listWorkspaceInvitesByOwner,
  revokeWorkspaceInvitesForMember,
  updateWorkspaceInvite,
} from "@/lib/data/workspace-invites-store";

export const DEFAULT_TEMPLATE_SEED = [
  {
    name: "通用服务协议",
    description: "适用于项目制、顾问制与持续服务场景的标准服务合同模板。",
    category: "Business",
    content: `通用服务协议

甲方：__________
统一社会信用代码：__________
联系人：__________
联系方式：__________

乙方：__________
统一社会信用代码/身份证号：__________
联系人：__________
联系方式：__________

第一条 服务内容
1. 乙方根据甲方业务需求提供如下服务：__________。
2. 服务交付范围包括：需求沟通、方案制定、执行交付、阶段汇报及验收配合。
3. 除双方书面确认的工作范围外，任何新增需求均应另行确认交付周期、费用及责任边界。

第二条 服务期限
1. 本协议服务期限自____年__月__日起至____年__月__日止。
2. 如存在分阶段交付，具体节点以附件《项目计划表》或双方书面确认为准。

第三条 服务费用及支付方式
1. 本协议总服务费为人民币（大写）__________元（小写：￥__________）。
2. 付款安排：
（1）合同签署后__个工作日内支付预付款__%；
（2）阶段验收通过后支付进度款__%；
（3）全部服务完成并验收后支付尾款__%。
3. 乙方收款账户信息如下：__________。
4. 甲方付款前，乙方应按约定提供合法有效发票。

第四条 双方权利义务
1. 甲方应及时提供开展服务所需资料、接口、人员配合及确认意见。
2. 乙方应按专业标准独立完成服务，并保证关键里程碑按期推进。
3. 任一方发现影响进度或质量的风险，应在__个工作日内书面通知对方。

第五条 验收与整改
1. 乙方提交交付成果后，甲方应于__个工作日内完成验收并书面反馈。
2. 如验收不通过，甲方应明确列明问题清单，乙方应在合理期限内完成整改。
3. 甲方逾期未反馈且实际使用交付成果的，视为阶段性交付已验收。

第六条 知识产权与成果归属
1. 双方各自原有知识产权归原权利人所有。
2. 因本协议形成的定制成果归属按以下约定执行：__________。
3. 未经对方书面许可，任何一方不得擅自使用、披露、转让对方享有权利的成果、资料或商业标识。

第七条 保密条款
1. 双方对在合作过程中知悉的商业秘密、技术资料、客户信息及交易信息承担保密义务。
2. 保密义务不因本协议终止而当然解除，保密期限为协议终止后__年。

第八条 违约责任
1. 任一方未按约定履行义务，应承担继续履行、采取补救措施及赔偿损失等责任。
2. 甲方逾期付款的，每逾期一日，应按应付未付金额的万分之__支付违约金。
3. 乙方无正当理由逾期交付的，每逾期一日，应按合同总额的万分之__承担违约责任。

第九条 争议解决
1. 本协议适用中华人民共和国法律。
2. 因本协议引起的争议，双方应优先协商解决；协商不成的，提交__________人民法院/仲裁委员会处理。

第十条 其他
1. 本协议未尽事项，由双方另行签署补充协议，补充协议与本协议具有同等法律效力。
2. 本协议自双方签字盖章之日起生效。`,
    is_public: true,
  },
  {
    name: "双向保密协议（NDA）",
    description: "适用于商务洽谈、技术对接与合作前期交流的双向保密模板。",
    category: "Legal",
    content: `双向保密协议

披露方：__________
接收方：__________

鉴于双方拟就__________事项开展接洽、评估或合作，为保护双方在交流过程中披露的保密信息，订立本协议。

第一条 保密信息范围
1. 保密信息包括但不限于商业计划、报价方案、技术文档、源代码、接口信息、客户名单、财务数据、运营数据、样品、图纸及其他标注为保密或按性质应认定为保密的信息。
2. 口头披露的信息，如披露方于披露后__个工作日内以书面方式确认，也属于保密信息。

第二条 接收方义务
1. 仅可为本次合作评估、磋商或履约目的使用保密信息。
2. 应采取不低于保护自身同类重要信息的合理安全措施保存保密信息。
3. 未经披露方书面同意，不得向任何第三方披露、复制、传播、转让或许可使用保密信息。
4. 仅可向确有知悉必要且受保密义务约束的员工、顾问或关联方披露。

第三条 保密信息例外
如接收方能够证明相关信息存在以下情形之一的，不受本协议限制：
1. 披露时已为公众所知；
2. 非因接收方原因进入公开领域；
3. 接收方在披露前已合法持有；
4. 接收方从有权披露的第三方合法取得；
5. 依据法律法规、司法机关或监管要求必须披露，但应在允许范围内及时通知披露方。

第四条 知识产权
1. 披露方披露保密信息不视为授予接收方任何专利、商标、著作权、商业秘密或其他知识产权许可。
2. 接收方不得依据保密信息申请相关知识产权或进行反向工程，除非双方另有书面约定。

第五条 资料返还与销毁
1. 披露方要求时，接收方应立即停止使用相关保密信息。
2. 接收方应在__个工作日内返还或销毁载有保密信息的资料及复制件，并可按要求出具销毁证明。

第六条 保密期限
1. 本协议自双方签署之日起生效。
2. 保密义务期限为自最后一次披露之日起__年；涉及商业秘密或个人信息的，依法或依其性质需长期保密的，从其规定。

第七条 违约责任
1. 接收方违反保密义务的，应立即停止侵害、采取补救措施并赔偿披露方因此遭受的全部损失。
2. 如损失难以计算，违约方应至少承担违约金人民币__________元，且不足以弥补损失的，仍应继续赔偿。

第八条 争议解决
因本协议引起的争议，由双方协商解决；协商不成的，提交__________人民法院/仲裁委员会处理。`,
    is_public: true,
  },
  {
    name: "标准劳动合同",
    description: "适用于正式员工录用、试用期约定、薪酬福利与离职交接管理。",
    category: "HR",
    content: `劳动合同

甲方（用人单位）：__________
住所地：__________
法定代表人/负责人：__________

乙方（劳动者）：__________
身份证号码：__________
联系方式：__________
住址：__________

第一条 合同期限
1. 本合同为固定期限劳动合同，自____年__月__日起至____年__月__日止。
2. 试用期为__个月，自____年__月__日起至____年__月__日止。

第二条 工作内容与工作地点
1. 乙方担任__________岗位，具体职责包括但不限于：__________。
2. 工作地点为__________。因经营需要，甲方可依法合理调整乙方工作地点或岗位职责范围。

第三条 工作时间和休息休假
1. 甲方实行__________工时制度。
2. 乙方依法享有法定节假日、年休假、婚假、产假、病假等休假权利。
3. 加班安排及报酬支付按国家及公司制度执行。

第四条 劳动报酬
1. 乙方月工资标准为人民币（税前）￥__________元。
2. 试用期工资为转正工资的__%，即人民币￥__________元。
3. 绩效奖金、补贴、提成、年终奖等按甲方制度及考核结果执行。
4. 甲方应于每月__日前以银行转账方式支付乙方上月工资。

第五条 社会保险与福利
1. 甲方依法为乙方缴纳社会保险及住房公积金。
2. 乙方应配合提供办理社保、公积金所需资料。
3. 甲方可根据公司制度向乙方提供补充商业保险、餐补、交通补助、通讯补助等福利。

第六条 劳动纪律与规章制度
1. 乙方应遵守甲方依法制定并公示的规章制度、员工手册、考勤制度、信息安全制度及行为规范。
2. 乙方严重违反规章制度、严重失职、营私舞弊或其他法律规定情形的，甲方有权依法解除劳动合同。

第七条 保密与竞业限制
1. 乙方对任职期间知悉的商业秘密、技术秘密、客户信息及经营资料承担保密义务。
2. 如双方另行签署竞业限制协议，则按竞业限制协议执行。

第八条 合同解除与终止
1. 双方解除或终止劳动合同，应依法办理通知、工资结算、社保转移、工作交接、文件归还等手续。
2. 乙方离职时应完成账号、设备、资料、客户信息及项目事项交接。

第九条 争议解决
因履行本合同发生争议的，双方应先协商；协商不成的，可依法申请劳动仲裁。`,
    is_public: true,
  },
  {
    name: "软件开发委托合同",
    description: "适用于 SaaS、网站、小程序、系统定制开发等技术项目委托。",
    category: "Technology",
    content: `软件开发委托合同

甲方：__________
乙方：__________

第一条 项目概况
1. 项目名称：__________。
2. 项目目标：乙方根据甲方业务需求完成__________系统/平台/小程序的设计、开发、测试与部署支持。
3. 项目需求文件、原型图、技术方案、排期表等作为本合同附件，与本合同具有同等法律效力。

第二条 开发范围
1. 产品功能模块包括：__________。
2. 交付成果包括但不限于：需求分析文档、原型稿、源代码、部署文档、测试报告、操作手册。
3. 不在本合同范围内的新增功能、第三方采购费用、云资源费用、短信费用、证书费用等，由双方另行确认。

第三条 项目周期与里程碑
1. 项目总周期预计为__日/周，自____年__月__日起算。
2. 主要里程碑：
（1）需求冻结：__________；
（2）原型确认：__________；
（3）测试环境交付：__________；
（4）正式上线：__________。
3. 因甲方需求反复变更、资料迟延提供、验收迟延等导致工期延误的，乙方交付时间相应顺延。

第四条 项目费用与付款安排
1. 项目总价为人民币￥__________元。
2. 付款节点：
（1）合同签署后支付__%；
（2）原型确认后支付__%；
（3）测试版交付后支付__%；
（4）最终验收通过后支付__%。

第五条 验收标准
1. 乙方交付测试版本后，甲方应依据需求文件和验收清单进行验收。
2. 验收重点包括：核心功能实现、主要流程可用、严重缺陷关闭、部署可执行。
3. 甲方应于收到验收通知后__个工作日内完成验收；逾期未反馈视为阶段验收通过。

第六条 知识产权与授权
1. 乙方已有技术组件、通用底层框架、预先存在的代码库、开发工具及通用方法论归乙方所有。
2. 项目定制部分的知识产权归属方式如下：__________。
3. 如项目涉及第三方开源组件，双方应遵守对应开源许可证要求。

第七条 运维与质保
1. 乙方提供自最终验收之日起__个月的免费缺陷修复服务。
2. 免费质保不包含新增需求、接口变更、第三方平台政策变化、服务器故障或非乙方原因引发的问题。
3. 质保期后如需持续维护，双方可签订运维服务协议。

第八条 保密与数据安全
1. 乙方应对甲方业务数据、客户数据、接口密钥及后台权限承担保密义务。
2. 未经甲方许可，乙方不得擅自留存、使用、披露甲方生产数据。

第九条 违约责任
1. 任一方违约给对方造成损失的，应承担赔偿责任。
2. 因甲方长期拖欠付款，乙方有权暂停开发并顺延工期。
3. 因乙方无正当理由严重延误里程碑，甲方有权要求整改并追究相应责任。`,
    is_public: true,
  },
  {
    name: "采购框架协议",
    description: "适用于长期采购合作、批次下单、质量验收与售后责任约定。",
    category: "Procurement",
    content: `采购框架协议

甲方（采购方）：__________
乙方（供应方）：__________

第一条 合作模式
1. 本协议为双方建立长期采购合作关系的框架协议，具体订单以双方后续订单、采购单、对账单或补充协议为准。
2. 本协议有效期内，甲方有权根据业务需要向乙方采购相关产品/服务。

第二条 标的与价格
1. 采购品类包括：__________。
2. 单价、规格、数量、交期、包装、技术标准等以订单文件为准。
3. 如市场价格波动较大，双方可依据书面确认机制调整报价。

第三条 交付与验收
1. 乙方应按订单约定时间、地点、方式交付。
2. 甲方有权在收货后__个工作日内进行数量、外观、规格及基础质量验收。
3. 如存在隐蔽瑕疵，甲方有权在合理期限内提出质量异议。

第四条 付款与结算
1. 双方结算周期为__________。
2. 乙方应按约定开具合法有效发票后，甲方于__个工作日内付款。
3. 如乙方存在质量问题、交付迟延或未完成售后义务，甲方有权暂缓支付相应款项。

第五条 质量保证与售后
1. 乙方保证所供产品符合国家标准、行业标准及双方约定标准。
2. 质保期为自验收通过之日起__个月。
3. 在质保期内出现非甲方原因造成的质量问题，乙方应负责退换、维修或补发，并承担相关费用。

第六条 违约责任
1. 乙方逾期交付的，应按订单金额的万分之__承担违约责任。
2. 乙方交付产品不符合约定质量标准的，甲方有权拒收、退货、要求换货或追究赔偿责任。
3. 甲方逾期付款的，应按应付未付金额的万分之__支付违约金，但乙方存在先违约情形的除外。`,
    is_public: true,
  },
  {
    name: "渠道合作协议",
    description: "适用于联合拓客、渠道分销、客户归属与结算分成场景。",
    category: "Partnership",
    content: `渠道合作协议

甲方：__________
乙方：__________

第一条 合作内容
1. 双方基于__________产品/服务开展渠道合作。
2. 乙方负责渠道推广、客户开拓、商务引荐或销售转化，甲方负责产品交付、售后服务及合同履约。

第二条 客户归属与保护
1. 乙方报备并经甲方确认的客户，按照先报备先保护原则管理。
2. 客户保护期为自报备确认之日起__天。
3. 如客户由双方共同推进，双方应就归属与分成事先书面确认。

第三条 商务政策与分成
1. 合作产品价格体系、折扣政策、返佣比例及激励方案以附件或甲方发布并经乙方确认的渠道政策为准。
2. 分成结算条件为：客户回款到账且不存在退款、重大投诉或违约风险。
3. 结算周期为__________，结算凭证包括合同、回款记录、对账单及开票资料。

第四条 品牌与宣传规范
1. 乙方使用甲方商标、品牌、产品资料、案例材料进行宣传前，应取得甲方授权。
2. 乙方不得作出夸大宣传、虚假承诺或超出甲方授权范围的商务表述。

第五条 保密与合规
1. 双方对合作中知悉的客户信息、报价政策、商业数据承担保密义务。
2. 乙方在推广及销售过程中应遵守法律法规，不得实施商业贿赂、不正当竞争或侵犯第三方权益的行为。

第六条 违约与终止
1. 任一方严重违约，经书面催告后在合理期限内仍未整改的，守约方有权解除协议。
2. 协议终止前已确认的有效订单及应结算分成，双方仍应继续履行结算义务。`,
    is_public: true,
  },
] as const;

function toTimestamp(value?: string) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function extractPartyLabel(party: Record<string, unknown>) {
  const candidates = [
    party.name,
    party.fullName,
    party.company,
    party.companyName,
    party.company_name,
    party.email,
    party.role,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function calculatePeriodDelta(
  dates: string[],
  currentDays: number,
  previousDays: number = currentDays,
) {
  const now = Date.now();
  const currentStart = now - currentDays * 24 * 60 * 60 * 1000;
  const previousStart = currentStart - previousDays * 24 * 60 * 60 * 1000;

  let currentCount = 0;
  let previousCount = 0;

  for (const value of dates) {
    const time = toTimestamp(value);
    if (!time) {
      continue;
    }

    if (time >= currentStart) {
      currentCount += 1;
    } else if (time >= previousStart && time < currentStart) {
      previousCount += 1;
    }
  }

  return currentCount - previousCount;
}

function calculateSetDelta(
  values: Array<{ label: string; createdAt?: string }>,
  currentDays: number,
  previousDays: number = currentDays,
) {
  const now = Date.now();
  const currentStart = now - currentDays * 24 * 60 * 60 * 1000;
  const previousStart = currentStart - previousDays * 24 * 60 * 60 * 1000;

  const currentSet = new Set<string>();
  const previousSet = new Set<string>();

  for (const value of values) {
    const time = toTimestamp(value.createdAt);
    if (!time) {
      continue;
    }

    if (time >= currentStart) {
      currentSet.add(value.label);
    } else if (time >= previousStart && time < currentStart) {
      previousSet.add(value.label);
    }
  }

  return currentSet.size - previousSet.size;
}

function normalizeTemplateRecord(record: Record<string, any>): DashboardTemplate {
  const status =
    record.status === "draft" || record.status === "archived" || record.status === "active"
      ? record.status
      : record.is_public === false
        ? "archived"
        : "active";
  const version =
    typeof record.version === "number"
      ? record.version
      : Number(record.version || 1) || 1;
  const usageCount =
    typeof record.usage_count === "number"
      ? record.usage_count
      : typeof record.usageCount === "number"
        ? record.usageCount
        : Number(record.usage_count || record.usageCount || 0) || 0;

  return {
    id: String(record.id || record._id || ""),
    name: String(record.name || "Untitled Template"),
    description: String(record.description || ""),
    category: String(record.category || "General"),
    content: typeof record.content === "string" ? record.content : undefined,
    isPublic:
      typeof record.is_public === "boolean"
        ? record.is_public
        : typeof record.isPublic === "boolean"
          ? record.isPublic
          : true,
    userId:
      typeof record.user_id === "string"
        ? record.user_id
        : typeof record.userId === "string"
          ? record.userId
          : undefined,
    status,
    version: version > 0 ? version : 1,
    sourceTemplateId:
      typeof record.source_template_id === "string"
        ? record.source_template_id
        : typeof record.sourceTemplateId === "string"
          ? record.sourceTemplateId
          : undefined,
    usageCount,
    lastUsedAt:
      typeof record.last_used_at === "string"
        ? record.last_used_at
        : typeof record.lastUsedAt === "string"
          ? record.lastUsedAt
          : undefined,
    createdAt: record.created_at || record.createdAt,
    updatedAt: record.updated_at || record.updatedAt,
  };
}

function compareTemplates(left: DashboardTemplate, right: DashboardTemplate) {
  const statusOrder = { active: 0, draft: 1, archived: 2 };
  const statusCompare = statusOrder[left.status] - statusOrder[right.status];
  if (statusCompare !== 0) {
    return statusCompare;
  }

  const categoryCompare = left.category.localeCompare(right.category);
  if (categoryCompare !== 0) {
    return categoryCompare;
  }

  if (left.name !== right.name) {
    return left.name.localeCompare(right.name);
  }

  return right.version - left.version;
}

export function buildDashboardTemplatePermissions(input?: {
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  membershipExpiresAt?: string;
}): DashboardTemplatePermissions {
  const entitlements = buildMembershipEntitlements({
    plan: input?.subscriptionPlan,
    status: input?.subscriptionStatus,
    membershipExpiresAt: input?.membershipExpiresAt,
  });

  return {
    canCreate: entitlements.features.canCreateTemplate,
    canEditOwned: true,
    canCreateVersion: entitlements.features.canCreateTemplateVersion,
    canCopy: entitlements.features.canCopyTemplate,
  };
}

function sortTemplates(templates: DashboardTemplate[]) {
  return [...templates].sort(compareTemplates);
}

function getTemplateLineageRootId(template: DashboardTemplate) {
  return template.sourceTemplateId || template.id;
}

function buildInitials(name: string, email: string) {
  const source = (name || email || "U").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function normalizeWorkspaceMember(record: Record<string, any>): DashboardTeamMember {
  const name =
    String(record.name || record.full_name || record.display_name || record.email || "Member");
  const email = String(record.email || "");
  const role =
    record.role === "owner" || record.role === "admin" || record.role === "member"
      ? record.role
      : "member";
  const status =
    record.status === "invited" || record.status === "suspended" ? record.status : "active";

  return {
    id: String(record.id || record._id || record.user_id || record.userId || email || name),
    userId:
      typeof record.user_id === "string"
        ? record.user_id
        : typeof record.userId === "string"
          ? record.userId
          : undefined,
    workspaceOwnerId:
      typeof record.workspace_owner_id === "string"
        ? record.workspace_owner_id
        : typeof record.workspaceOwnerId === "string"
          ? record.workspaceOwnerId
          : undefined,
    name,
    email,
    role,
    status,
    avatar:
      typeof record.avatar === "string"
        ? record.avatar
        : typeof record.avatar_url === "string"
          ? record.avatar_url
          : undefined,
    initials: buildInitials(name, email),
    joinedAt: record.joined_at || record.created_at || record.createdAt,
    lastActiveAt: record.last_active_at || record.lastActiveAt,
  };
}

function sortTeamMembers(members: DashboardTeamMember[]) {
  const roleOrder = { owner: 0, admin: 1, member: 2 };

  return [...members].sort((left, right) => {
    const roleCompare = roleOrder[left.role] - roleOrder[right.role];
    if (roleCompare !== 0) {
      return roleCompare;
    }

    return (left.name || left.email).localeCompare(right.name || right.email);
  });
}

function attachInviteState(
  members: DashboardTeamMember[],
  invites: DashboardTeamInvite[],
) {
  const latestInviteByMember = new Map<string, DashboardTeamInvite>();
  const latestInviteByEmail = new Map<string, DashboardTeamInvite>();

  for (const invite of invites) {
    if (invite.memberId && !latestInviteByMember.has(invite.memberId)) {
      latestInviteByMember.set(invite.memberId, invite);
    }

    if (invite.email && !latestInviteByEmail.has(invite.email.toLowerCase())) {
      latestInviteByEmail.set(invite.email.toLowerCase(), invite);
    }
  }

  return members.map((member) => ({
    ...member,
    invite:
      latestInviteByMember.get(member.id) ||
      latestInviteByEmail.get(member.email.toLowerCase()) ||
      undefined,
  }));
}

async function listAllContractsForUser(userId: string): Promise<UnifiedContractRecord[]> {
  const batchSize = 200;
  const contracts: UnifiedContractRecord[] = [];
  let total = 0;
  let offset = 0;

  do {
    const result = await listContracts({
      userId,
      limit: batchSize,
      offset,
    });

    total = result.total;
    contracts.push(...result.contracts);
    offset += batchSize;
  } while (contracts.length < total);

  return contracts;
}

export async function getDashboardOverviewData(
  userId: string,
): Promise<DashboardOverviewData> {
  const contracts = await listAllContractsForUser(userId);
  const recentActivity: DashboardActivity[] = [];
  const createdDates: string[] = [];
  const pendingDates: string[] = [];
  const completedDates: string[] = [];
  const partyDates: Array<{ label: string; createdAt?: string }> = [];
  const currentParties = new Set<string>();

  for (const contract of contracts) {
    if (contract.createdAt) {
      createdDates.push(contract.createdAt);
      recentActivity.push({
        id: `${contract.id}-created`,
        type: "created",
        title: contract.title || "Untitled Contract",
        description: `Draft created for ${contract.title || "untitled contract"}`,
        createdAt: contract.createdAt,
        contractId: contract.id,
      });
    }

    for (const party of contract.parties) {
      const label = extractPartyLabel(party);
      if (!label) {
        continue;
      }

      currentParties.add(label);
      partyDates.push({
        label,
        createdAt: contract.updatedAt || contract.createdAt,
      });
    }

    const enhancement = normalizeContractEnhancementMeta(contract.metadata, contract);
    if (
      contract.status === "pending" ||
      enhancement.signFlow.status === "awaiting_sender" ||
      enhancement.signFlow.status === "awaiting_counterparty"
    ) {
      pendingDates.push(contract.updatedAt || contract.createdAt || new Date().toISOString());
    }

    if (contract.status === "signed" || contract.status === "completed") {
      completedDates.push(
        enhancement.signFlow.completedAt ||
          contract.updatedAt ||
          contract.createdAt ||
          new Date().toISOString(),
      );
    }

    for (const log of enhancement.operationLogs) {
      const activityType =
        log.action === "sender_confirmed" ||
        log.action === "counterparty_confirmed" ||
        log.action === "final_copy_ready"
          ? "signed"
          : log.action === "signing_started" || log.action === "reminder_sent"
            ? "pending"
            : log.action === "archived" || log.action === "unarchived"
              ? "archived"
              : "updated";

      recentActivity.push({
        id: `${contract.id}-${log.id}`,
        type: activityType,
        title: contract.title || "Untitled Contract",
        description: log.description || log.label || "Contract updated",
        createdAt: log.createdAt,
        contractId: contract.id,
      });
    }
  }

  recentActivity.sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));

  return {
    stats: {
      totalContracts: contracts.length,
      totalContractsDelta: calculatePeriodDelta(createdDates, 30),
      pendingSignatures: pendingDates.length,
      pendingSignaturesDelta: calculatePeriodDelta(pendingDates, 7),
      completedContracts: completedDates.length,
      completedContractsDelta: calculatePeriodDelta(completedDates, 30),
      activeParties: currentParties.size,
      activePartiesDelta: calculateSetDelta(partyDates, 30),
      lastUpdated: new Date().toISOString(),
    },
    recentActivity: recentActivity.slice(0, 10),
  };
}

async function seedDefaultTemplatesIfNeeded(userId: string) {
  if (isChinaRegion()) {
    const db = getDatabase();
    const collection = db.collection("contract_templates");

    try {
      const existing = await collection.limit(1).get();
      if (Array.isArray(existing.data) && existing.data.length > 0) {
        return;
      }
    } catch {
      // If the collection does not exist yet, fall through to seed it.
    }

    for (const template of DEFAULT_TEMPLATE_SEED) {
      await collection.add({
        ...template,
        user_id: userId,
        status: "active",
        version: 1,
        usage_count: 0,
        source_template_id: null,
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return;
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("contract_templates")
    .select("id")
    .limit(1);

  if (error) {
    throw error;
  }

  if (Array.isArray(data) && data.length > 0) {
    return;
  }

  const { error: insertError } = await admin.from("contract_templates").insert(
    DEFAULT_TEMPLATE_SEED.map((template) => ({
      name: template.name,
      description: template.description,
      category: template.category,
      content: template.content,
      is_public: true,
      user_id: null,
      status: "active",
      version: 1,
      usage_count: 0,
      source_template_id: null,
      last_used_at: null,
    })),
  );

  if (insertError) {
    throw insertError;
  }
}

export async function listDashboardTemplates(userId: string): Promise<DashboardTemplate[]> {
  await seedDefaultTemplatesIfNeeded(userId);

  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db.collection("contract_templates").limit(200).get();
    const rows = Array.isArray(result.data) ? result.data : [];

    return sortTemplates(
      rows
      .map((row: Record<string, any>) => normalizeTemplateRecord(row))
      .filter((row: DashboardTemplate) => row.isPublic || row.userId === userId)
    );
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("contract_templates")
    .select("*")
    .or(`is_public.eq.true,user_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return sortTemplates(
    (data || []).map((row: Record<string, any>) => normalizeTemplateRecord(row)),
  );
}

export async function getDashboardTemplateById(
  userId: string,
  templateId: string,
): Promise<DashboardTemplate | null> {
  const templates = await listDashboardTemplates(userId);
  return templates.find((template) => template.id === templateId) || null;
}

interface DashboardTemplateInput {
  name: string;
  description?: string;
  category?: string;
  content: string;
  status?: DashboardTemplate["status"];
}

export async function createDashboardTemplate(
  userId: string,
  input: DashboardTemplateInput,
): Promise<DashboardTemplate> {
  const now = new Date().toISOString();
  const payload = {
    name: input.name.trim(),
    description: input.description?.trim() || "",
    category: input.category?.trim() || "General",
    content: input.content,
    is_public: false,
    user_id: userId,
    status: input.status || "active",
    version: 1,
    usage_count: 0,
    source_template_id: null,
    last_used_at: null,
    created_at: now,
    updated_at: now,
  };

  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db.collection("contract_templates").add(payload);
    return normalizeTemplateRecord({
      ...payload,
      _id: result.id,
    });
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("contract_templates")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to create template");
  }

  return normalizeTemplateRecord(data as Record<string, any>);
}

export async function updateDashboardTemplate(
  userId: string,
  templateId: string,
  input: Partial<DashboardTemplateInput> & {
    status?: DashboardTemplate["status"];
    usageCount?: number;
    lastUsedAt?: string | null;
  },
): Promise<DashboardTemplate> {
  const template = await getDashboardTemplateById(userId, templateId);
  if (!template) {
    throw new Error("Template not found");
  }

  if (template.userId !== userId) {
    throw new Error("TEMPLATE_WRITE_FORBIDDEN");
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof input.name === "string") payload.name = input.name.trim();
  if (typeof input.description === "string") payload.description = input.description.trim();
  if (typeof input.category === "string") payload.category = input.category.trim() || "General";
  if (typeof input.content === "string") payload.content = input.content;
  if (input.status) payload.status = input.status;
  if (typeof input.usageCount === "number") payload.usage_count = input.usageCount;
  if (input.lastUsedAt !== undefined) payload.last_used_at = input.lastUsedAt;

  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection("contract_templates").doc(templateId).update(payload);
    const updated = await getDashboardTemplateById(userId, templateId);
    if (!updated) {
      throw new Error("Template not found after update");
    }
    return updated;
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("contract_templates")
    .update(payload)
    .eq("id", templateId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to update template");
  }

  return normalizeTemplateRecord(data as Record<string, any>);
}

export async function duplicateDashboardTemplate(
  userId: string,
  templateId: string,
): Promise<DashboardTemplate> {
  const source = await getDashboardTemplateById(userId, templateId);
  if (!source) {
    throw new Error("Template not found");
  }

  return createDashboardTemplate(userId, {
    name: `${source.name} Copy`,
    description: source.description,
    category: source.category,
    content: source.content || "",
    status: "draft",
  });
}

export async function createDashboardTemplateVersion(
  userId: string,
  templateId: string,
): Promise<DashboardTemplate> {
  const source = await getDashboardTemplateById(userId, templateId);
  if (!source) {
    throw new Error("Template not found");
  }

  if (source.userId !== userId) {
    throw new Error("TEMPLATE_WRITE_FORBIDDEN");
  }

  const templates = await listDashboardTemplates(userId);
  const lineageRootId = getTemplateLineageRootId(source);
  const nextVersion =
    templates
      .filter((template) => {
        const templateRootId = getTemplateLineageRootId(template);
        return template.id === lineageRootId || templateRootId === lineageRootId;
      })
      .reduce((maxVersion, template) => Math.max(maxVersion, template.version), 0) + 1;

  const now = new Date().toISOString();
  const payload = {
    name: source.name,
    description: source.description,
    category: source.category,
    content: source.content || "",
    is_public: false,
    user_id: userId,
    status: "draft" as const,
    version: nextVersion,
    usage_count: source.usageCount,
    source_template_id: lineageRootId,
    last_used_at: null,
    created_at: now,
    updated_at: now,
  };

  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db.collection("contract_templates").add(payload);
    return normalizeTemplateRecord({
      ...payload,
      _id: result.id,
    });
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("contract_templates")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to create template version");
  }

  return normalizeTemplateRecord(data as Record<string, any>);
}

interface WorkspaceContext {
  workspaceOwnerId: string;
  currentRole: DashboardTeamMember["role"];
}

async function getStoredWorkspaceMembership(userId: string) {
  if (isChinaRegion()) {
    const db = getDatabase();
    const membership = await db
      .collection("workspace_members")
      .where({ user_id: userId })
      .limit(1)
      .get();
    return membership.data?.[0] as Record<string, any> | undefined;
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("workspace_members")
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  return data as Record<string, any>;
}

async function resolveWorkspaceContext(userId: string): Promise<WorkspaceContext> {
  try {
    const row = await getStoredWorkspaceMembership(userId);
    if (row && typeof row.workspace_owner_id === "string" && row.workspace_owner_id.trim()) {
      return {
        workspaceOwnerId: row.workspace_owner_id,
        currentRole:
          row.role === "owner" || row.role === "admin" || row.role === "member"
            ? row.role
            : "member",
      };
    }
  } catch {
    return {
      workspaceOwnerId: userId,
      currentRole: "owner",
    };
  }

  return {
    workspaceOwnerId: userId,
    currentRole: "owner",
  };
}

export function buildDashboardTeamPermissions(
  currentRole: DashboardTeamMember["role"],
): DashboardTeamPermissions {
  return {
    currentRole,
    canInvite: currentRole === "owner" || currentRole === "admin",
    canManageRoles: currentRole === "owner",
    canRemoveMembers: currentRole === "owner" || currentRole === "admin",
    canChangeStatus: currentRole === "owner" || currentRole === "admin",
  };
}

export async function listDashboardTeamMembers(
  currentUser: DashboardCurrentUser,
  origin?: string,
): Promise<DashboardTeamData> {
  const context = await resolveWorkspaceContext(currentUser.id);
  const { workspaceOwnerId, currentRole } = context;
  const invites = await listWorkspaceInvitesByOwner(workspaceOwnerId, origin).catch(
    () => [] as DashboardTeamInvite[],
  );

  if (isChinaRegion()) {
    const db = getDatabase();

    try {
      const result = await db
        .collection("workspace_members")
        .where({ workspace_owner_id: workspaceOwnerId })
        .limit(200)
        .get();

      const rows = Array.isArray(result.data) ? result.data : [];
      if (rows.length > 0) {
        return {
          members: attachInviteState(
            sortTeamMembers(
              rows.map((row: Record<string, any>) => normalizeWorkspaceMember(row)),
            ),
            invites,
          ),
          permissions: buildDashboardTeamPermissions(currentRole),
          workspaceOwnerId,
        };
      }
    } catch {
      // Fall back to the current authenticated user below.
    }
  } else {
    const admin = getSupabaseAdmin() as any;
    const { data, error } = await admin
      .from("workspace_members")
      .select(
        "id,user_id,workspace_owner_id,name,email,role,status,avatar,joined_at,last_active_at,created_at",
      )
      .eq("workspace_owner_id", workspaceOwnerId)
      .order("created_at", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return {
        members: attachInviteState(
          sortTeamMembers(
            data.map((row: Record<string, any>) => normalizeWorkspaceMember(row)),
          ),
          invites,
        ),
        permissions: buildDashboardTeamPermissions(currentRole),
        workspaceOwnerId,
      };
    }
  }

  return {
    members: attachInviteState(
      [
        {
          id: currentUser.id,
          userId: currentUser.id,
          workspaceOwnerId: currentUser.id,
          name: currentUser.name || currentUser.email,
          email: currentUser.email,
          role: "owner",
          status: "active",
          avatar: currentUser.avatar,
          initials: buildInitials(currentUser.name, currentUser.email),
          joinedAt: undefined,
          lastActiveAt: new Date().toISOString(),
        },
      ],
      invites,
    ),
    permissions: buildDashboardTeamPermissions(currentRole),
    workspaceOwnerId,
  };
}

async function getWorkspaceMemberById(
  workspaceOwnerId: string,
  memberId: string,
): Promise<DashboardTeamMember | null> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db
      .collection("workspace_members")
      .where({
        workspace_owner_id: workspaceOwnerId,
        _id: memberId,
      })
      .limit(1)
      .get();
    const row = result.data?.[0] as Record<string, any> | undefined;
    return row ? normalizeWorkspaceMember(row) : null;
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("workspace_members")
    .select("*")
    .eq("workspace_owner_id", workspaceOwnerId)
    .eq("id", memberId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeWorkspaceMember(data as Record<string, any>);
}

async function getWorkspaceMemberByEmail(
  workspaceOwnerId: string,
  email: string,
): Promise<DashboardTeamMember | null> {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db
      .collection("workspace_members")
      .where({
        workspace_owner_id: workspaceOwnerId,
        email: email.trim().toLowerCase(),
      })
      .limit(1)
      .get();
    const row = result.data?.[0] as Record<string, any> | undefined;
    return row ? normalizeWorkspaceMember(row) : null;
  }

  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("workspace_members")
    .select("*")
    .eq("workspace_owner_id", workspaceOwnerId)
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeWorkspaceMember(data as Record<string, any>);
}

async function getDashboardUserIdentity(userId: string) {
  if (isChinaRegion()) {
    const db = getDatabase();
    const result = await db.collection("web_users").doc(userId).get();
    const row = result?.data?.[0] as Record<string, any> | undefined;
    if (!row) {
      return null;
    }

    return {
      id: String(row._id || row.id || userId),
      email: String(row.email || ""),
      name: String(row.name || row.full_name || row.email || "Workspace Owner"),
    };
  }

  const admin = getSupabaseAdmin() as any;
  const {
    data: { user },
    error,
  } = await admin.auth.admin.getUserById(userId);

  if (error || !user) {
    return null;
  }

  const metadata = user.user_metadata || {};
  return {
    id: user.id,
    email: String(user.email || ""),
    name: String(metadata.displayName || metadata.full_name || metadata.name || user.email || "Workspace Owner"),
  };
}

function resolveTeamInviteStatusLabel(invite: DashboardTeamInvite) {
  if (invite.status === "accepted") {
    return "accepted";
  }

  if (invite.status === "revoked") {
    return "revoked";
  }

  if (isWorkspaceInviteExpired(invite)) {
    return "expired";
  }

  return "pending";
}

export async function inviteDashboardTeamMember(
  currentUser: DashboardCurrentUser,
  input: {
    email: string;
    name?: string;
    role?: DashboardTeamMember["role"];
  },
  origin?: string,
) {
  const context = await resolveWorkspaceContext(currentUser.id);
  const permissions = buildDashboardTeamPermissions(context.currentRole);
  if (!permissions.canInvite) {
    throw new Error("TEAM_INVITE_FORBIDDEN");
  }

  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw new Error("TEAM_EMAIL_REQUIRED");
  }

  const role = input.role === "admin" || input.role === "member" ? input.role : "member";
  const now = new Date().toISOString();
  let memberId = "";
  const payload = {
    workspace_owner_id: context.workspaceOwnerId,
    email,
    name: input.name?.trim() || email,
    role,
    status: "invited" as const,
    invited_by: currentUser.id,
    joined_at: now,
    updated_at: now,
    created_at: now,
  };

  if (isChinaRegion()) {
    const db = getDatabase();
    const existing = await db
      .collection("workspace_members")
      .where({
        workspace_owner_id: context.workspaceOwnerId,
        email,
      })
      .limit(1)
      .get();

    const row = existing.data?.[0] as Record<string, any> | undefined;
    if (row?._id) {
      if (row.status === "active" && row.user_id) {
        throw new Error("TEAM_MEMBER_ALREADY_ACTIVE");
      }

      memberId = String(row._id);
      await db.collection("workspace_members").doc(String(row._id)).update({
        name: payload.name,
        role: payload.role,
        status: payload.status,
        invited_by: payload.invited_by,
        updated_at: payload.updated_at,
      });
    } else {
      const created = await db.collection("workspace_members").add(payload);
      memberId = created.id;
    }
  } else {
    const admin = getSupabaseAdmin() as any;
    const { data: existing } = await admin
      .from("workspace_members")
      .select("id,status,user_id")
      .eq("workspace_owner_id", context.workspaceOwnerId)
      .eq("email", email)
      .maybeSingle();

    if (existing?.id) {
      if (existing.status === "active" && existing.user_id) {
        throw new Error("TEAM_MEMBER_ALREADY_ACTIVE");
      }

      memberId = String(existing.id);
      const { error } = await admin
        .from("workspace_members")
        .update({
          name: payload.name,
          role: payload.role,
          status: payload.status,
          invited_by: payload.invited_by,
          updated_at: payload.updated_at,
        })
        .eq("id", existing.id);
      if (error) {
        throw error;
      }
    } else {
      const { data, error } = await admin
        .from("workspace_members")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        throw error;
      }
      memberId = String(data.id);
    }
  }

  await revokeWorkspaceInvitesForMember({
    workspaceOwnerId: context.workspaceOwnerId,
    memberId: memberId || undefined,
    email,
  });

  const latestInvite = await createWorkspaceInvite({
    workspaceOwnerId: context.workspaceOwnerId,
    memberId: memberId || undefined,
    email,
    name: payload.name,
    role,
    invitedBy: currentUser.id,
    origin,
  });

  return {
    ...(await listDashboardTeamMembers(currentUser, origin)),
    latestInvite,
  };
}

export async function updateDashboardTeamMember(
  currentUser: DashboardCurrentUser,
  memberId: string,
  input: Partial<{
    role: DashboardTeamMember["role"];
    status: DashboardTeamMember["status"];
    name: string;
  }>,
  origin?: string,
) {
  const context = await resolveWorkspaceContext(currentUser.id);
  const permissions = buildDashboardTeamPermissions(context.currentRole);
  const member = await getWorkspaceMemberById(context.workspaceOwnerId, memberId);
  if (!member) {
    throw new Error("TEAM_MEMBER_NOT_FOUND");
  }

  if (member.role === "owner") {
    throw new Error("TEAM_OWNER_IMMUTABLE");
  }

  if (input.role && !permissions.canManageRoles) {
    throw new Error("TEAM_ROLE_FORBIDDEN");
  }

  if (input.status && !permissions.canChangeStatus) {
    throw new Error("TEAM_STATUS_FORBIDDEN");
  }

  if (context.currentRole === "admin" && member.role !== "member") {
    throw new Error("TEAM_MEMBER_PROTECTED");
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof input.name === "string") payload.name = input.name.trim();
  if (input.role) payload.role = input.role;
  if (input.status) payload.status = input.status;

  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection("workspace_members").doc(memberId).update(payload);
  } else {
    const admin = getSupabaseAdmin() as any;
    const { error } = await admin
      .from("workspace_members")
      .update(payload)
      .eq("id", memberId)
      .eq("workspace_owner_id", context.workspaceOwnerId);
    if (error) {
      throw error;
    }
  }

  let latestInvite: DashboardTeamInvite | undefined;

  if (input.status === "invited") {
    await revokeWorkspaceInvitesForMember({
      workspaceOwnerId: context.workspaceOwnerId,
      memberId,
      email: member.email,
    });

    latestInvite = await createWorkspaceInvite({
      workspaceOwnerId: context.workspaceOwnerId,
      memberId,
      email: member.email,
      name: typeof input.name === "string" ? input.name.trim() : member.name,
      role: input.role || member.role,
      invitedBy: currentUser.id,
      origin,
    });
  } else if (input.status) {
    await revokeWorkspaceInvitesForMember({
      workspaceOwnerId: context.workspaceOwnerId,
      memberId,
      email: member.email,
    });
  }

  return {
    ...(await listDashboardTeamMembers(currentUser, origin)),
    latestInvite,
  };
}

export async function removeDashboardTeamMember(
  currentUser: DashboardCurrentUser,
  memberId: string,
  origin?: string,
) {
  const context = await resolveWorkspaceContext(currentUser.id);
  const permissions = buildDashboardTeamPermissions(context.currentRole);
  if (!permissions.canRemoveMembers) {
    throw new Error("TEAM_REMOVE_FORBIDDEN");
  }

  const member = await getWorkspaceMemberById(context.workspaceOwnerId, memberId);
  if (!member) {
    throw new Error("TEAM_MEMBER_NOT_FOUND");
  }

  if (member.role === "owner") {
    throw new Error("TEAM_OWNER_IMMUTABLE");
  }

  if (context.currentRole === "admin" && member.role !== "member") {
    throw new Error("TEAM_MEMBER_PROTECTED");
  }

  if (isChinaRegion()) {
    const db = getDatabase();
    await db.collection("workspace_members").doc(memberId).remove();
  } else {
    const admin = getSupabaseAdmin() as any;
    const { error } = await admin
      .from("workspace_members")
      .delete()
      .eq("id", memberId)
      .eq("workspace_owner_id", context.workspaceOwnerId);
    if (error) {
      throw error;
    }
  }

  await revokeWorkspaceInvitesForMember({
    workspaceOwnerId: context.workspaceOwnerId,
    memberId,
    email: member.email,
  });

  return listDashboardTeamMembers(currentUser, origin);
}

export async function getDashboardTeamInvitePreview(
  token: string,
  origin?: string,
): Promise<DashboardTeamInvitePreview | null> {
  const invite = await getWorkspaceInviteByToken(token, origin);
  if (!invite) {
    return null;
  }

  const workspaceOwner = await getDashboardUserIdentity(invite.workspaceOwnerId);
  const statusLabel = resolveTeamInviteStatusLabel(invite);

  return {
    invite: {
      ...invite,
      status: statusLabel as DashboardTeamInvite["status"],
      inviteUrl: buildWorkspaceInviteUrl(origin, token),
    },
    workspaceOwnerName: workspaceOwner?.name || "Workspace Owner",
    workspaceOwnerEmail: workspaceOwner?.email || "",
    canAccept: statusLabel === "pending",
    statusLabel,
  };
}

export async function getPublicDashboardTeamInvitePreview(
  token: string,
  origin?: string,
): Promise<DashboardTeamInvitePreview | null> {
  const preview = await getDashboardTeamInvitePreview(token, origin);
  if (!preview) {
    return null;
  }

  const trackedInvite = await incrementWorkspaceInviteAccess(preview.invite, origin);
  if (!trackedInvite) {
    return preview;
  }

  const statusLabel = resolveTeamInviteStatusLabel(trackedInvite);
  return {
    ...preview,
    invite: {
      ...trackedInvite,
      status: statusLabel as DashboardTeamInvite["status"],
      inviteUrl: buildWorkspaceInviteUrl(origin, token),
    },
    canAccept: statusLabel === "pending",
    statusLabel,
  };
}

export async function acceptDashboardTeamInvite(
  currentUser: DashboardCurrentUser,
  token: string,
  origin?: string,
) {
  const preview = await getDashboardTeamInvitePreview(token, origin);
  if (!preview) {
    throw new Error("TEAM_INVITE_NOT_FOUND");
  }

  const invite = preview.invite;
  if (invite.status === "revoked") {
    throw new Error("TEAM_INVITE_REVOKED");
  }
  if (invite.status === "accepted") {
    throw new Error("TEAM_INVITE_ACCEPTED");
  }
  if (invite.status === "expired") {
    throw new Error("TEAM_INVITE_EXPIRED");
  }

  if (currentUser.email.trim().toLowerCase() !== invite.email.trim().toLowerCase()) {
    throw new Error("TEAM_INVITE_EMAIL_MISMATCH");
  }

  const existingMembership = await getStoredWorkspaceMembership(currentUser.id);
  if (
    existingMembership &&
    typeof existingMembership.workspace_owner_id === "string" &&
    existingMembership.workspace_owner_id.trim() &&
    existingMembership.workspace_owner_id !== invite.workspaceOwnerId
  ) {
    throw new Error("TEAM_INVITE_WORKSPACE_CONFLICT");
  }

  const member =
    (invite.memberId
      ? await getWorkspaceMemberById(invite.workspaceOwnerId, invite.memberId)
      : null) || (await getWorkspaceMemberByEmail(invite.workspaceOwnerId, invite.email));
  const now = new Date().toISOString();

  if (isChinaRegion()) {
    const db = getDatabase();

    if (member?.id) {
      await db.collection("workspace_members").doc(member.id).update({
        user_id: currentUser.id,
        name: currentUser.name || member.name || invite.name || invite.email,
        email: invite.email,
        role: invite.role,
        status: "active",
        joined_at: member.joinedAt || now,
        last_active_at: now,
        updated_at: now,
      });
    } else {
      await db.collection("workspace_members").add({
        workspace_owner_id: invite.workspaceOwnerId,
        user_id: currentUser.id,
        email: invite.email,
        name: currentUser.name || invite.name || invite.email,
        role: invite.role,
        status: "active",
        invited_by: invite.invitedBy,
        joined_at: now,
        last_active_at: now,
        created_at: now,
        updated_at: now,
      });
    }
  } else {
    const admin = getSupabaseAdmin() as any;

    if (member?.id) {
      const { error } = await admin
        .from("workspace_members")
        .update({
          user_id: currentUser.id,
          name: currentUser.name || member.name || invite.name || invite.email,
          email: invite.email,
          role: invite.role,
          status: "active",
          joined_at: member.joinedAt || now,
          last_active_at: now,
          updated_at: now,
        })
        .eq("id", member.id);

      if (error) {
        throw error;
      }
    } else {
      const { error } = await admin.from("workspace_members").insert({
        workspace_owner_id: invite.workspaceOwnerId,
        user_id: currentUser.id,
        email: invite.email,
        name: currentUser.name || invite.name || invite.email,
        role: invite.role,
        status: "active",
        invited_by: invite.invitedBy,
        joined_at: now,
        last_active_at: now,
        created_at: now,
        updated_at: now,
      });

      if (error) {
        throw error;
      }
    }
  }

  await updateWorkspaceInvite(
    invite.id,
    {
      status: "accepted",
      accepted_at: now,
      accepted_by_user_id: currentUser.id,
      updated_at: now,
    },
    origin,
  );

  await revokeWorkspaceInvitesForMember({
    workspaceOwnerId: invite.workspaceOwnerId,
    memberId: invite.memberId,
    email: invite.email,
  });

  return {
    accepted: true,
    workspaceOwnerId: invite.workspaceOwnerId,
    workspaceOwnerName: preview.workspaceOwnerName,
  };
}

function normalizePaymentMethodLabel(method: string) {
  switch (method.toLowerCase()) {
    case "stripe":
      return "Stripe";
    case "wechat":
      return "WeChat Pay";
    case "alipay":
      return "Alipay";
    case "manual":
      return "Manual";
    default:
      return method || "Unknown";
  }
}

export async function getDashboardBillingSummary(
  currentUser: DashboardCurrentUser,
): Promise<DashboardBillingSummary> {
  const [subscription, paymentResult] = await Promise.all([
    getLatestSubscriptionByUser(currentUser.id),
    listPaymentsByUser({ userId: currentUser.id, limit: 10, offset: 0 }),
  ]);

  const recentPayments: DashboardBillingRecord[] = paymentResult.payments.map((payment) => ({
    id: payment.id,
    date: payment.createdAt,
    amount: payment.amount,
    currency: payment.currency || "USD",
    status:
      payment.status === "completed"
        ? "paid"
        : payment.status === "refunded"
          ? "refunded"
          : payment.status === "failed"
            ? "failed"
            : "pending",
    description:
      typeof payment.metadata?.description === "string"
        ? payment.metadata.description
        : "Subscription payment",
    paymentMethod: normalizePaymentMethodLabel(payment.paymentMethod),
    invoiceUrl: null,
  }));

  return {
    plan: subscription?.plan || currentUser.subscriptionPlan || "free",
    status: subscription?.status || currentUser.subscriptionStatus || "inactive",
    price: subscription?.price,
    currency: subscription?.currency || recentPayments[0]?.currency || "USD",
    billingCycle: subscription?.billingCycle,
    paymentMethod: subscription?.paymentMethod,
    membershipExpiresAt:
      subscription?.currentPeriodEnd || currentUser.membershipExpiresAt,
    totalPayments: paymentResult.total,
    totalSpent: paymentResult.payments.reduce((sum, payment) => {
      return payment.status === "completed" ? sum + payment.amount : sum;
    }, 0),
    lastPaymentAt: recentPayments[0]?.date,
    recentPayments,
  };
}
