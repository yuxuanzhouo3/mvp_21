// app/api/payment/onetime/confirm/route.ts - 一次性支付确认API
import { NextRequest, NextResponse } from "next/server";
import { PayPalProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/paypal-provider";
import { StripeProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/stripe-provider";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { requireAuth, createAuthErrorResponse } from "@/lib/auth/auth";
import { isChinaRegion } from "@/lib/config/region";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { logInfo, logError, logWarn, logBusinessEvent } from "@/lib/utils/logger";

/**
 * 延长用户会员时间
 * 架构：subscriptions 表是数据源（source of truth），web_users.membership_expires_at 从 subscriptions 同步而来
 */
async function extendMembership(
  userId: string,
  days: number,
  transactionId: string
): Promise<boolean> {
  console.log(
    "🔥🔥🔥 [CONFIRM extendMembership] CALLED - Starting membership extension",
    {
      userId,
      days,
      transactionId,
      isChinaRegion: isChinaRegion(),
    }
  );

  try {
    if (isChinaRegion()) {
      // CloudBase 用户
      const db = getDatabase();
      const webUsersCollection = db.collection("web_users");
      const subscriptionsCollection = db.collection("subscriptions");

      // 🔐 步骤0：幂等性检查 - 检查这个 transaction_id 是否已经处理过
      try {
        const existingRecord = await subscriptionsCollection
          .where({
            user_id: userId,
            transaction_id: transactionId,
          })
          .get();

        if (existingRecord.data && existingRecord.data.length > 0) {
          logInfo("Transaction already processed (idempotent check passed)", {
            userId,
            transactionId,
            existingExpiresAt: existingRecord.data[0].current_period_end,
          });
          return true; // 已处理过，直接返回成功
        }
      } catch (error) {
        logWarn("Error checking idempotent status in CloudBase", {
          userId,
          transactionId,
        });
        // 继续处理，不因为检查失败而中断流程
      }

      // 🔐 SUPABASE 幂等性检查：确保相同 transaction_id 或 provider_subscription_id 不会被重复处理
      try {
        const { data: existingByTransaction } = await supabaseAdmin
          .from("subscriptions")
          .select("id")
          .or(
            `transaction_id.eq.${transactionId},provider_subscription_id.eq.${transactionId}`
          )
          .maybeSingle();

        if (existingByTransaction && existingByTransaction.id) {
          logInfo(
            "Transaction already processed in subscriptions (idempotent check passed)",
            {
              userId,
              transactionId,
              subscriptionId: existingByTransaction.id,
            }
          );
          return true; // 已处理过，直接返回成功
        }
      } catch (idempotentErr) {
        // 如果检查失败，不阻止后续逻辑，但记录警告
        logWarn("Error checking idempotent status in Supabase subscriptions", {
          userId,
          transactionId,
          error: idempotentErr,
        });
      }

      // 1. 获取用户当前会员到期时间（从 subscriptions 表读取，这是源数据）
      let currentExpiresAt: Date | null = null;
      try {
        const existingSubscription = await db
          .collection("subscriptions")
          .where({
            user_id: userId,
            plan_id: "pro",
          })
          .get();

        if (existingSubscription.data && existingSubscription.data.length > 0) {
          currentExpiresAt = new Date(
            existingSubscription.data[0].current_period_end
          );
        }
      } catch (error) {
        logWarn("Error fetching existing subscription", {
          userId,
          transactionId,
        });
      }

      // 2. 计算新的到期时间（基于 subscriptions 源数据）
      const now = new Date();
      let newExpiresAt: Date;

      if (currentExpiresAt && currentExpiresAt > now) {
        // 如果当前还有有效会员,从当前到期时间延长
        newExpiresAt = new Date(currentExpiresAt);
        newExpiresAt.setDate(newExpiresAt.getDate() + days);
        logInfo("Extending existing membership in CloudBase", {
          userId,
          currentExpiresAt: currentExpiresAt.toISOString(),
          daysToAdd: days,
          newExpiresAt: newExpiresAt.toISOString(),
        });
      } else {
        // 如果没有有效会员或已过期,从现在开始计算
        newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + days);
        logInfo("Creating new membership in CloudBase", {
          userId,
          daysToAdd: days,
          newExpiresAt: newExpiresAt.toISOString(),
        });
      }

      // 3. FIRST: 更新或创建 subscriptions 记录（源数据）
      try {
        const currentDate = new Date();

        // 查询用户是否已有 subscriptions 记录
        const existingSubscription = await db
          .collection("subscriptions")
          .where({
            user_id: userId,
            plan_id: "pro",
          })
          .get();

        if (existingSubscription.data && existingSubscription.data.length > 0) {
          // 如果有，更新现有记录
          const subscriptionId = existingSubscription.data[0]._id;
          await db.collection("subscriptions").doc(subscriptionId).update({
            current_period_end: newExpiresAt.toISOString(),
            transaction_id: transactionId,
            updated_at: currentDate.toISOString(),
          });

          logInfo(
            "Updated subscription record in CloudBase (source of truth)",
            {
              userId,
              subscriptionId,
              transactionId,
              expiresAt: newExpiresAt.toISOString(),
            }
          );
        } else {
          // 如果没有，创建新记录
          await db.collection("subscriptions").add({
            user_id: userId,
            plan_id: "pro",
            status: "active",
            current_period_start: currentDate.toISOString(),
            current_period_end: newExpiresAt.toISOString(),
            cancel_at_period_end: false,
            payment_method: "wechat",
            transaction_id: transactionId,
            created_at: currentDate.toISOString(),
            updated_at: currentDate.toISOString(),
          });

          logInfo(
            "Created subscription record in CloudBase (source of truth)",
            {
              userId,
              transactionId,
              planId: "pro",
              expiresAt: newExpiresAt.toISOString(),
            }
          );
        }
      } catch (subscriptionError) {
        logError(
          "Error managing CloudBase subscription record",
          subscriptionError as Error,
          {
            userId,
            transactionId,
          }
        );
        return false; // 订阅创建失败，中断流程
      }

      // 4. SECOND: 同步到 web_users（派生数据）
      try {
        const updateResult = await webUsersCollection.doc(userId).update({
          membership_expires_at: newExpiresAt.toISOString(),
          pro: true,
          updated_at: new Date().toISOString(),
        });

        if (updateResult.updated === 0) {
          logError("Failed to update CloudBase user profile", undefined, {
            userId,
            newExpiresAt: newExpiresAt.toISOString(),
            transactionId,
          });
          return false;
        }

        logInfo("Synced membership time to web_users (derived data)", {
          userId,
          membershipExpiresAt: newExpiresAt.toISOString(),
        });
      } catch (updateError) {
        logError(
          "Error updating CloudBase user profile (derived data)",
          updateError as Error,
          {
            userId,
            transactionId,
          }
        );
        return false;
      }

      logBusinessEvent("membership_extended_cloudbase", userId, {
        transactionId,
        daysAdded: days,
        newExpiresAt: newExpiresAt.toISOString(),
      });

      return true;
    } else {
      // Supabase 用户 - 从 subscriptions 表读取用户信息
      // 1. 获取用户当前会员到期时间（从 subscriptions 表读取，这是源数据）
      let currentExpiresAt: Date | null = null;
      try {
        const { data: existingSubscriptions } = await supabaseAdmin
          .from("subscriptions")
          .select("current_period_end")
          .eq("user_id", userId)
          .eq("plan_id", "pro");

        if (existingSubscriptions && existingSubscriptions.length > 0) {
          currentExpiresAt = new Date(
            existingSubscriptions[0].current_period_end
          );
        }
      } catch (error) {
        logWarn("Error fetching existing subscription", {
          userId,
          transactionId,
        });
      }

      // 2. 计算新的到期时间（基于 subscriptions 源数据）
      const now = new Date();
      let newExpiresAt: Date;

      if (currentExpiresAt && currentExpiresAt > now) {
        // 如果当前还有有效会员,从当前到期时间延长
        newExpiresAt = new Date(currentExpiresAt);
        newExpiresAt.setDate(newExpiresAt.getDate() + days);
        logInfo("Extending existing membership", {
          userId,
          currentExpiresAt: currentExpiresAt.toISOString(),
          daysToAdd: days,
          newExpiresAt: newExpiresAt.toISOString(),
        });
      } else {
        // 如果没有有效会员或已过期,从现在开始计算
        newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + days);
        logInfo("Creating new membership", {
          userId,
          daysToAdd: days,
          newExpiresAt: newExpiresAt.toISOString(),
        });
      }

      // 3. FIRST: 更新或创建 subscriptions 记录（源数据）
      try {
        const currentDate = new Date();

        // 查询用户是否已有 subscriptions 记录（需要查询 transaction_id 字段）
        const { data: existingSubscriptions } = await supabaseAdmin
          .from("subscriptions")
          .select("id, transaction_id")
          .eq("user_id", userId)
          .eq("plan_id", "pro");

        if (existingSubscriptions && existingSubscriptions.length > 0) {
          // 如果有，更新现有记录
          const subscriptionId = existingSubscriptions[0].id;
          const existingTransactionId = existingSubscriptions[0].transaction_id;

          // ✅ 修复 PayPal 重复问题：如果订阅的 transaction_id 为空，设置它；如果已有值，保持不变
          const updateData: any = {
            current_period_end: newExpiresAt.toISOString(),
            updated_at: currentDate.toISOString(),
          };

          // 只在 transaction_id 为空时设置
          if (!existingTransactionId) {
            updateData.transaction_id = transactionId;
          }

          await supabaseAdmin
            .from("subscriptions")
            .update(updateData)
            .eq("id", subscriptionId);

          logInfo("Updated subscription record in Supabase (source of truth)", {
            userId,
            subscriptionId,
            transactionId,
            existingTransactionId,
            setTransactionId: !existingTransactionId,
            expiresAt: newExpiresAt.toISOString(),
          });
        } else {
          // 如果没有，创建新记录
          await supabaseAdmin.from("subscriptions").insert({
            user_id: userId,
            plan_id: "pro",
            status: "active",
            current_period_start: currentDate.toISOString(),
            current_period_end: newExpiresAt.toISOString(),
            cancel_at_period_end: false,
            payment_method: "wechat",
            transaction_id: transactionId,
            created_at: currentDate.toISOString(),
            updated_at: currentDate.toISOString(),
          });

          logInfo("Created subscription record in Supabase (source of truth)", {
            userId,
            transactionId,
            planId: "pro",
            expiresAt: newExpiresAt.toISOString(),
          });
        }
      } catch (subscriptionError) {
        logError(
          "Error managing Supabase subscription record",
          subscriptionError as Error,
          {
            userId,
            transactionId,
          }
        );
        return false; // 订阅创建失败，中断流程
      }

      // 4. SECOND: 同步到 auth metadata（派生数据）
      try {
        const { error: updateError } =
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: {
              pro: true,
              subscription_plan: "pro",
              subscription_status: "active",
              membership_expires_at: newExpiresAt.toISOString(),
              updated_at: new Date().toISOString(),
            },
          });

        if (updateError) {
          logError(
            "Error updating user auth metadata (derived data)",
            updateError,
            {
              userId,
              newExpiresAt: newExpiresAt.toISOString(),
              transactionId,
            }
          );
          return false;
        }

        logInfo("Synced membership time to auth metadata (derived data)", {
          userId,
          membershipExpiresAt: newExpiresAt.toISOString(),
        });
      } catch (error) {
        logError("Error updating Supabase auth metadata", error as Error, {
          userId,
          transactionId,
        });
        return false;
      }

      logBusinessEvent("membership_extended", userId, {
        transactionId,
        daysAdded: days,
        newExpiresAt: newExpiresAt.toISOString(),
      });

      return true;
    }
  } catch (error) {
    logError("Error extending membership", error as Error, {
      userId,
      days,
      transactionId,
    });
    return false;
  }
}

export async function GET(request: NextRequest) {
  console.log("🚀🚀🚀 [CONFIRM API] STARTED - Entry point");

  const startTime = Date.now();
  const operationId = `onetime_confirm_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  try {
    // 验证用户认证
    const authResult = await requireAuth(request);
    if (!authResult) {
      return createAuthErrorResponse();
    }

    const { user } = authResult;
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("session_id"); // Stripe
    const token = searchParams.get("token"); // PayPal
    const outTradeNo = searchParams.get("out_trade_no"); // Alipay / WeChat
    const tradeNo = searchParams.get("trade_no"); // Alipay交易号
    const wechatOutTradeNo = searchParams.get("wechat_out_trade_no"); // WeChat Native

    console.log("🚀🚀🚀 [CONFIRM API] Parameters extracted", {
      hasSessionId: !!sessionId,
      hasToken: !!token,
      hasOutTradeNo: !!outTradeNo,
      hasTradeNo: !!tradeNo,
      hasWechatOutTradeNo: !!wechatOutTradeNo,
    });

    logInfo("Processing one-time payment confirmation", {
      operationId,
      userId: user.id,
      hasSessionId: !!sessionId,
      hasToken: !!token,
      hasOutTradeNo: !!outTradeNo,
      hasTradeNo: !!tradeNo,
      hasWechatOutTradeNo: !!wechatOutTradeNo,
    });

    if (!sessionId && !token && !outTradeNo && !tradeNo && !wechatOutTradeNo) {
      logWarn("Missing payment confirmation parameters", {
        operationId,
        userId: user.id,
      });
      return NextResponse.json(
        { success: false, error: "Missing payment confirmation parameters" },
        { status: 400 }
      );
    }

    const isAlipayReturn = !!outTradeNo || !!tradeNo;
    const alipayOutTradeNo = outTradeNo || "";
    let transactionId = "";
    let amount = 0;
    let currency = "USD";
    let days = 0;

    if (sessionId) {
      // Stripe 支付确认
      logInfo("Confirming Stripe one-time payment", {
        operationId,
        userId: user.id,
        sessionId,
      });

      const stripeProvider = new StripeProvider(process.env);
      const confirmation = await stripeProvider.confirmPayment(sessionId);

      if (!confirmation.success) {
        logWarn("Stripe payment confirmation failed", {
          operationId,
          userId: user.id,
          sessionId,
        });
        return NextResponse.json(
          { success: false, error: "Payment not completed" },
          { status: 400 }
        );
      }

      transactionId = confirmation.transactionId;
      amount = confirmation.amount;
      currency = confirmation.currency;

      // 从 pending payment 中获取天数信息
      const { data: stripePendingPayment } = await supabaseAdmin
        .from("payments")
        .select("metadata")
        .eq("transaction_id", sessionId)
        .eq("status", "pending")
        .maybeSingle();

      days = stripePendingPayment?.metadata?.days || (amount > 50 ? 365 : 30);
    } else if (token) {
      // PayPal 支付确认
      logInfo("Confirming PayPal one-time payment", {
        operationId,
        userId: user.id,
        token,
      });

      const paypalProvider = new PayPalProvider(process.env);

      try {
        // 首先尝试从 pending payment 获取金额信息（备用方案）
        let { data: paypalPendingPayment } = await supabaseAdmin
          .from("payments")
          .select("amount, currency, metadata")
          .eq("transaction_id", token)
          .eq("status", "pending")
          .maybeSingle();

        // 捕获 PayPal 订单
        const captureResult = await paypalProvider.captureOnetimePayment(token);

        if (captureResult.status !== "COMPLETED") {
          logWarn("PayPal payment not completed", {
            operationId,
            userId: user.id,
            token,
            status: captureResult.status,
          });
          return NextResponse.json(
            { success: false, error: "Payment not completed" },
            { status: 400 }
          );
        }

        // ✅ 关键修复: transactionId应该使用Capture ID,但查找pending payment时要用Order ID (token)
        // Order ID: 72C40158BX438952W (CREATE API创建pending payment时用的ID)
        // Capture ID: 83P92523MR1516802 (capture后的ID,用于最终的transaction_id)
        const captureId = captureResult.id;
        transactionId = captureId;

        // 🔑 关键修复：从 payment_source 和 purchase_units 中提取金额
        // PayPal API 可能返回不同的结构，需要多层备份方案
        let purchaseUnit = captureResult.purchase_units?.[0];

        if (purchaseUnit?.payments?.captures?.[0]) {
          // 方案1: 从 captures 中获取
          const capture = purchaseUnit.payments.captures[0];
          amount = parseFloat(capture?.amount?.value || "0");
          currency =
            capture?.amount?.currency_code ||
            purchaseUnit?.amount?.currency_code ||
            "USD";
          logInfo("Amount from captures", { amount, currency });
        } else if (purchaseUnit?.amount) {
          // 方案2: 从 purchase_units.amount 获取
          amount = parseFloat(purchaseUnit.amount.value || "0");
          currency = purchaseUnit.amount.currency_code || "USD";
          logInfo("Amount from purchase_units", { amount, currency });
        } else {
          // 方案3: 尝试从 processor_response 获取
          const processor =
            captureResult.payment_source?.paypal?.processor_response;
          if (processor?.verify_response?.gross_amount) {
            amount = parseFloat(processor.verify_response.gross_amount);
            currency = processor.verify_response.currency_code || "USD";
            logInfo("Amount from processor_response", { amount, currency });
          }
        }

        // 如果仍然为0，使用 pending payment 中的金额
        if (amount === 0 && paypalPendingPayment?.amount) {
          amount = paypalPendingPayment.amount;
          currency = paypalPendingPayment.currency || "USD";
          logInfo("Recovered amount from pending payment", {
            operationId,
            userId: user.id,
            amount,
            currency,
          });
        }

        // 从 pending payment 获取天数信息
        days = paypalPendingPayment?.metadata?.days || (amount > 50 ? 365 : 30);

        logInfo("PayPal capture successful", {
          operationId,
          userId: user.id,
          transactionId,
          amount,
          currency,
          days,
          captureStatus: captureResult.status,
        });
      } catch (error) {
        logError("PayPal capture error", error as Error, {
          operationId,
          userId: user.id,
          token,
        });
        return NextResponse.json(
          {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to capture PayPal payment",
          },
          { status: 500 }
        );
      }
    } else if (outTradeNo || tradeNo) {
      // Alipay 支付确认 - 对于同步跳转，只验证支付参数，不处理会员延期
      // ✅ 关键改动：会员延期由 webhook 负责（webhook 有 metadata 中的正确 days）
      logInfo("Confirming Alipay one-time payment (sync return)", {
        operationId,
        userId: user.id,
        outTradeNo,
        tradeNo,
      });

      try {
        // 对于同步跳转（return_url），我们只验证支付参数
        // 不需要再次查询支付宝API，因为支付宝只有支付成功才会跳转
        const actualOutTradeNo = outTradeNo || tradeNo;
        transactionId = tradeNo || outTradeNo || "";

        // ✅ 关键修复：同步 return 中支付宝不提供签名参数
        // 支付宝的 return_url 同步返回只包含 out_trade_no 和 trade_no
        // 真正的签名验证应该在异步 notify_url 中进行
        // 这里只需要验证参数存在即可

        // 检查必需参数
        if (!actualOutTradeNo || !tradeNo) {
          logWarn("Alipay return missing required parameters", {
            operationId,
            userId: user.id,
            actualOutTradeNo,
            tradeNo,
          });
          return NextResponse.json(
            { success: false, error: "Missing Alipay order parameters" },
            { status: 400 }
          );
        }

        logInfo("Alipay sync return validated (no signature check needed)", {
          operationId,
          userId: user.id,
          outTradeNo: actualOutTradeNo,
          tradeNo,
          reason: "Sync return does not include signature from Alipay. Membership extension delegated to webhook.",
        });

        // ✅ 重要：设置 amount 和 currency，但不计算 days（不需要）
        // days 的计算和会员延期完全由 webhook 负责
        amount = 0; // 在同步返回中我们无法获取金额，webhook 会处理
        currency = "CNY";
        days = 0; // 不再使用
      } catch (error) {
        logError("Alipay verification error", error as Error, {
          operationId,
          userId: user.id,
          outTradeNo,
          tradeNo,
        });
        return NextResponse.json(
          {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to verify Alipay payment",
          },
          { status: 500 }
        );
      }
    } else if (wechatOutTradeNo) {
      // WeChat 支付确认 - Native QR Code 扫码支付
      logInfo("Confirming WeChat one-time payment (Native QR)", {
        operationId,
        userId: user.id,
        wechatOutTradeNo,
      });

      try {
        // 从 pending payment 中获取支付信息
        let wechatPendingPayment: any = null;

        if (isChinaRegion()) {
          // CloudBase 用户：从 CloudBase 获取 pending payment
          try {
            const db = getDatabase();
            const paymentsCollection = db.collection("payments");

            const result = await paymentsCollection
              .where({
                $or: [
                  { out_trade_no: wechatOutTradeNo },
                  { transaction_id: wechatOutTradeNo },
                  { _id: wechatOutTradeNo },
                ],
              })
              .get();

            wechatPendingPayment = result.data?.[0] || null;
          } catch (error) {
            logError(
              "Error fetching CloudBase pending WeChat payment",
              error as Error,
              {
                operationId,
                userId: user.id,
                wechatOutTradeNo,
              }
            );
          }
        } else {
          // 国际用户：从 Supabase 获取 pending payment
          try {
            const { data } = await supabaseAdmin
              .from("payments")
              .select("*")
              .or(
                `out_trade_no.eq.${wechatOutTradeNo},transaction_id.eq.${wechatOutTradeNo},id.eq.${wechatOutTradeNo}`
              )
              .single();

            wechatPendingPayment = data || null;
          } catch (error) {
            logError(
              "Error fetching Supabase pending WeChat payment",
              error as Error,
              {
                operationId,
                userId: user.id,
                wechatOutTradeNo,
              }
            );
          }
        }

        if (!wechatPendingPayment) {
          logWarn("WeChat payment record not found", {
            operationId,
            userId: user.id,
            wechatOutTradeNo,
          });
          return NextResponse.json(
            { success: false, error: "Payment record not found" },
            { status: 400 }
          );
        }

        // 提取支付信息
        transactionId =
          wechatPendingPayment.transaction_id ||
          wechatPendingPayment.out_trade_no ||
          wechatOutTradeNo;
        amount = wechatPendingPayment.amount || 0;
        currency = wechatPendingPayment.currency || "CNY";

        // 从元数据获取天数，或根据金额推断（CNY定价）
        if (wechatPendingPayment.metadata?.days) {
          days = wechatPendingPayment.metadata.days;
        } else {
          // ¥300 = 1年，¥30 = 1个月
          days = amount >= 300 ? 365 : 30;
        }

        logInfo("WeChat payment details extracted", {
          operationId,
          userId: user.id,
          transactionId,
          amount,
          currency,
          days,
        });
      } catch (error) {
        logError("WeChat payment verification error", error as Error, {
          operationId,
          userId: user.id,
          wechatOutTradeNo,
        });
        return NextResponse.json(
          {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to verify WeChat payment",
          },
          { status: 500 }
        );
      }
    }

    // 检查是否已存在完成状态的支付记录(防止重复)
    let existingCompletedPayment: any = null;
    let existingCheckError: any = null;

    if (isChinaRegion()) {
      // CloudBase 用户：从 CloudBase 检查重复支付
      try {
        const db = getDatabase();
        const paymentsCollection = db.collection("payments");

        let result = await paymentsCollection
          .where({
            transaction_id: transactionId,
            status: "completed",
          })
          .get();

        existingCompletedPayment = result.data?.[0] || null;

        if (!existingCompletedPayment && isAlipayReturn && alipayOutTradeNo) {
          result = await paymentsCollection
            .where({
              out_trade_no: alipayOutTradeNo,
              status: "completed",
            })
            .get();

          existingCompletedPayment = result.data?.[0] || null;
        }
      } catch (error) {
        logError("Error checking existing CloudBase payment", error as Error, {
          operationId,
          userId: user.id,
          transactionId,
        });
        existingCheckError = error;
      }
    } else {
      // 国际用户：从 Supabase 检查重复支付
      let { data, error } = await supabaseAdmin
        .from("payments")
        .select("id, status")
        .eq("transaction_id", transactionId)
        .eq("status", "completed")
        .maybeSingle();

      existingCompletedPayment = data;
      existingCheckError = error;

      if (
        !existingCompletedPayment &&
        isAlipayReturn &&
        alipayOutTradeNo &&
        (!error || error.code === "PGRST116")
      ) {
        const fallbackResult = await supabaseAdmin
          .from("payments")
          .select("id, status")
          .eq("out_trade_no", alipayOutTradeNo)
          .eq("status", "completed")
          .maybeSingle();

        existingCompletedPayment = fallbackResult.data;
        existingCheckError = fallbackResult.error;
      }
    }

    if (existingCheckError) {
      logError("Error checking existing payment", existingCheckError as Error, {
        operationId,
        userId: user.id,
        transactionId,
      });
    }

    if (existingCompletedPayment) {
      logInfo("Payment already processed", {
        operationId,
        userId: user.id,
        transactionId,
        existingPaymentId:
          existingCompletedPayment.id || existingCompletedPayment._id,
      });

      // 即使支付已处理，也应该确保会员已延期（防止webhook失败的情况）
      // 特别是对于WeChat Native QR Code支付
      // ✅ 策略：PayPal 和 Stripe 依赖 webhook，跳过 confirm 中的会员延期
      if (days > 0 && transactionId) {
        logInfo("Ensuring membership extension for already-processed payment", {
          operationId,
          userId: user.id,
          transactionId,
          days,
        });

        // 检测是否为 PayPal 或 Stripe（依赖 webhook 的支付方式）
        const isPayPalOrStripe = !!sessionId || !!token;

        if (!isChinaRegion()) {
          if (isPayPalOrStripe) {
            // PayPal 和 Stripe：跳过 extendMembership，依赖 webhook
            console.log(
              "✅✅✅ [ALREADY-PROCESSED FLOW] PayPal/Stripe payment - SKIPPING extendMembership in confirm, relying on webhook",
              {
                operationId,
                userId: user.id,
                transactionId,
                isStripe: !!sessionId,
                isPayPal: !!token,
                days,
              }
            );
          } else {
            // 国际版的其他支付方式：使用 idempotency check
            try {
              const { data: existingSub } = await supabaseAdmin
                .from("subscriptions")
                .select("id")
                .or(
                  `transaction_id.eq.${transactionId},provider_subscription_id.eq.${transactionId}`
                )
                .maybeSingle();

              if (existingSub && existingSub.id) {
                logInfo(
                  "Subscription already exists for transaction - skipping extendMembership",
                  {
                    operationId,
                    userId: user.id,
                    transactionId,
                    subscriptionId: existingSub.id,
                  }
                );
              } else {
                const membershipExtended = await extendMembership(
                  user.id,
                  days,
                  transactionId
                );

                if (!membershipExtended) {
                  logWarn(
                    "Failed to extend membership for already-processed payment",
                    {
                      operationId,
                      userId: user.id,
                      transactionId,
                    }
                  );
                }
              }
            } catch (err) {
              logWarn("Error during supabase subscription idempotency check", {
                operationId,
                userId: user.id,
                transactionId,
                err,
              });
              // 兜底：尝试延长
              const membershipExtended = await extendMembership(
                user.id,
                days,
                transactionId
              );

              if (!membershipExtended) {
                logWarn(
                  "Failed to extend membership for already-processed payment (fallback)",
                  {
                    operationId,
                    userId: user.id,
                    transactionId,
                  }
                );
              }
            }
          }
        } else {
          // China region: 保持原有行为
          const membershipExtended = await extendMembership(
            user.id,
            days,
            transactionId
          );
          if (!membershipExtended) {
            logWarn(
              "Failed to extend membership for already-processed payment",
              {
                operationId,
                userId: user.id,
                transactionId,
              }
            );
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: "Payment already processed",
        transactionId,
      });
    }

    // 查找 pending 支付记录并更新为 completed
    const paymentIdToUpdate =
      sessionId || token || outTradeNo || tradeNo || wechatOutTradeNo;
    let pendingPayment: any = null;
    let findError: any = null;

    if (isChinaRegion()) {
      // CloudBase 用户：从 CloudBase 查找 pending 支付
      try {
        const db = getDatabase();
        const paymentsCollection = db.collection("payments");

        let result = await paymentsCollection
          .where({
            transaction_id: paymentIdToUpdate,
            user_id: user.id,
            status: "pending",
          })
          .get();

        pendingPayment = result.data?.[0] || null;

        if (!pendingPayment && isAlipayReturn && alipayOutTradeNo) {
          result = await paymentsCollection
            .where({
              out_trade_no: alipayOutTradeNo,
              user_id: user.id,
              status: "pending",
            })
            .get();

          pendingPayment = result.data?.[0] || null;
        }
      } catch (error) {
        logError("Error finding CloudBase pending payment", error as Error, {
          operationId,
          userId: user.id,
          transactionId: paymentIdToUpdate,
        });
        findError = error;
      }
    } else {
      // 国际用户：从 Supabase 查找 pending 支付
      let { data, error } = await supabaseAdmin
        .from("payments")
        .select("id, amount, currency") // 获取原始金额和货币
        .eq("transaction_id", paymentIdToUpdate)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle();

      pendingPayment = data;
      findError = error;

      if (
        !pendingPayment &&
        isAlipayReturn &&
        alipayOutTradeNo &&
        (!error || error.code === "PGRST116")
      ) {
        const fallbackResult = await supabaseAdmin
          .from("payments")
          .select("id, amount, currency, out_trade_no")
          .eq("out_trade_no", alipayOutTradeNo)
          .eq("user_id", user.id)
          .eq("status", "pending")
          .maybeSingle();

        pendingPayment = fallbackResult.data;
        findError = fallbackResult.error;
      }
    }

    if (
      findError &&
      (!isChinaRegion() || (findError as any)?.code !== "PGRST116")
    ) {
      logError("Error finding pending payment", findError as Error, {
        operationId,
        userId: user.id,
        transactionId: paymentIdToUpdate,
      });
    }

    if (pendingPayment) {
      // 如果从支付提供商获取的金额为0,使用 pending 记录中的金额
      if (amount === 0 && pendingPayment.amount) {
        amount = pendingPayment.amount;
        logInfo("Using amount from pending payment", {
          operationId,
          userId: user.id,
          amount,
        });
      }
      if (!currency && pendingPayment.currency) {
        currency = pendingPayment.currency;
      }

      // 更新现有 pending 记录
      let updateError: any = null;

      if (isChinaRegion()) {
        // CloudBase 用户：更新 CloudBase 记录
        try {
          const db = getDatabase();
          const paymentsCollection = db.collection("payments");

          await paymentsCollection.doc(pendingPayment._id).update({
            status: "completed",
            transaction_id: transactionId, // 更新为最终的 transaction ID
            out_trade_no:
              isAlipayReturn && alipayOutTradeNo
                ? alipayOutTradeNo
                : pendingPayment.out_trade_no,
            amount,
            currency,
            updatedAt: new Date().toISOString(),
          });
        } catch (error) {
          logError("Error updating CloudBase payment status", error as Error, {
            operationId,
            userId: user.id,
            paymentId: pendingPayment._id,
          });
          updateError = error;
        }
      } else {
        // 国际用户：更新 Supabase 记录
        const { error } = await supabaseAdmin
          .from("payments")
          .update({
            status: "completed",
            transaction_id: transactionId, // 更新为最终的 transaction ID
            out_trade_no:
              isAlipayReturn && alipayOutTradeNo
                ? alipayOutTradeNo
                : pendingPayment.out_trade_no,
            amount,
            currency,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pendingPayment.id);

        updateError = error;
      }

      if (updateError) {
        logError("Error updating payment status", updateError as Error, {
          operationId,
          userId: user.id,
          paymentId: pendingPayment.id || pendingPayment._id,
        });
      }
    } else {
      // 创建新的支付记录(如果找不到 pending 记录)
      logWarn("No pending payment found, creating new record", {
        operationId,
        userId: user.id,
        transactionId,
        amount,
        days,
      });

      // 验证金额 - 只有在金额大于0时才创建记录
      if (amount <= 0) {
        logError(
          "Cannot create payment with zero or negative amount",
          undefined,
          {
            operationId,
            userId: user.id,
            transactionId,
            amount,
            currency,
          }
        );
      } else {
        const paymentData: any = {
          user_id: user.id,
          amount,
          currency,
          status: "completed",
          payment_method: sessionId ? "stripe" : token ? "paypal" : "alipay",
          transaction_id: transactionId,
          metadata: {
            days,
            paymentType: "onetime",
            billingCycle: days === 365 ? "yearly" : "monthly",
          },
        };

        if (isAlipayReturn && alipayOutTradeNo) {
          paymentData.out_trade_no = alipayOutTradeNo;
        }

        let insertError: any = null;

        if (isChinaRegion()) {
          // CloudBase 用户：插入到 CloudBase
          try {
            const db = getDatabase();
            const paymentsCollection = db.collection("payments");

            await paymentsCollection.add({
              ...paymentData,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            logInfo("Payment record created successfully in CloudBase", {
              operationId,
              userId: user.id,
              transactionId,
              amount,
              days,
            });
          } catch (error) {
            logError(
              "Error creating CloudBase payment record",
              error as Error,
              {
                operationId,
                userId: user.id,
                transactionId,
                amount,
              }
            );
            insertError = error;
          }
        } else {
          // 国际用户：插入到 Supabase
          const { data: insertedPayment, error } = await supabaseAdmin
            .from("payments")
            .insert(paymentData)
            .select("id")
            .single();

          if (error) {
            logError("Error creating payment record in Supabase", error, {
              operationId,
              userId: user.id,
              transactionId,
              amount,
              currency,
              paymentData,
              errorCode: error.code,
              errorMessage: error.message,
              errorDetails: error.details,
              errorHint: error.hint,
            });
            insertError = error;
          } else if (insertedPayment) {
            logInfo("Payment record created successfully in Supabase", {
              operationId,
              userId: user.id,
              paymentId: insertedPayment.id,
              transactionId,
              amount,
              days,
            });
          }
        }

        if (insertError) {
          logError(
            "Failed to create payment record - continuing anyway",
            insertError as Error,
            {
              operationId,
              userId: user.id,
              transactionId,
            }
          );
          // 继续处理,不中断流程
        }
      }
    }

    // ✅ 延长用户会员时间
    // 策略：
    // - PayPal 和 Stripe 依赖 webhook 增加会员时间，confirm 只确认支付成功
    // - Alipay 也依赖 webhook（webhook 有 metadata 中的正确 days），confirm 只验证支付
    // - WeChat 在 confirm 中增加会员时间（因为有 pending payment 记录）
    let membershipExtended = false;
    const isPayPalOrStripe = !!sessionId || !!token; // Stripe 有 sessionId，PayPal 有 token
    const isAlipay = !!outTradeNo || !!tradeNo; // Alipay 有 outTradeNo 或 tradeNo

    if (isPayPalOrStripe) {
      // PayPal 和 Stripe：跳过 extendMembership，依赖 webhook
      console.log(
        "✅✅✅ [MAIN FLOW] PayPal/Stripe payment confirmed - SKIPPING extendMembership in confirm, relying on webhook",
        {
          operationId,
          userId: user.id,
          transactionId,
          isStripe: !!sessionId,
          isPayPal: !!token,
          days,
        }
      );
      membershipExtended = true; // 标记为成功，实际由 webhook 处理
    } else if (isAlipay) {
      // ✅ Alipay 同步返回：webhook 将负责会员延期
      // webhook 有 metadata 中的正确 days，confirm 不负责计算和延期
      console.log(
        "✅✅✅ [MAIN FLOW] Alipay payment confirmed - SKIPPING extendMembership in confirm, delegating to webhook",
        {
          operationId,
          userId: user.id,
          transactionId,
          reason: "Webhook has access to metadata with correct days value",
        }
      );
      membershipExtended = true; // 标记为成功，实际由 webhook 处理
    } else if (!isChinaRegion()) {
      // 国际版的其他支付方式（如果有）
      try {
        const { data: existingSub } = await supabaseAdmin
          .from("subscriptions")
          .select("id")
          .or(
            `transaction_id.eq.${transactionId},provider_subscription_id.eq.${transactionId}`
          )
          .maybeSingle();

        if (existingSub && existingSub.id) {
          logInfo(
            "Subscription already exists for transaction - skipping extendMembership",
            {
              operationId,
              userId: user.id,
              transactionId,
              subscriptionId: existingSub.id,
            }
          );
          membershipExtended = true; // 已处理
        } else {
          membershipExtended = await extendMembership(
            user.id,
            days,
            transactionId
          );
        }
      } catch (err) {
        logWarn(
          "Error during supabase subscription idempotency check before extend",
          {
            operationId,
            userId: user.id,
            transactionId,
            err,
          }
        );
        membershipExtended = await extendMembership(
          user.id,
          days,
          transactionId
        );
      }
    } else {
      // 国内版：只有 WeChat 在 confirm 中增加会员时间
      // Alipay 已在上面处理了
      membershipExtended = await extendMembership(user.id, days, transactionId);
    }

    if (!membershipExtended) {
      logError("Failed to extend membership", undefined, {
        operationId,
        userId: user.id,
        transactionId,
        days,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Payment confirmed but failed to extend membership",
        },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    logInfo("One-time payment confirmed successfully", {
      operationId,
      userId: user.id,
      transactionId,
      amount,
      currency,
      daysAdded: days,
      duration: `${duration}ms`,
    });

    return NextResponse.json({
      success: true,
      transactionId,
      amount,
      currency,
      daysAdded: days,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logError("One-time payment confirmation error", error as Error, {
      operationId,
      duration: `${duration}ms`,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
