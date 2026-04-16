// app/api/payment/onetime/confirm/route.ts - 一次性支付确认API
import { NextRequest, NextResponse } from "next/server";
import { StripeProvider } from "@/lib/architecture-modules/layers/third-party/payment/providers/stripe-provider";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { requireAuth, createAuthErrorResponse } from "@/lib/auth/auth";
import { isChinaRegion } from "@/lib/config/region";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { ensureOnetimeMembershipApplied } from "@/lib/payment/onetime-membership-sync";
import { logInfo, logError, logWarn } from "@/lib/utils/logger";

/**
 * 延长用户会员时间
 * 架构：subscriptions 表是数据源（source of truth），web_users.membership_expires_at 从 subscriptions 同步而来
 */
async function extendMembership(
  userId: string,
  days: number,
  transactionId: string,
): Promise<boolean> {
  const result = await ensureOnetimeMembershipApplied({
    userId,
    days,
    transactionId,
    source: "onetime-confirm",
  });

  if (!result.success) {
    logWarn("Unified onetime membership sync failed in confirm", {
      userId,
      days,
      transactionId,
      reason: result.reason,
    });
  }

  return result.success;
}

function readString(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function isSameOrigin(source: string, targetOrigin: string): boolean {
  try {
    return new URL(source).origin === targetOrigin;
  } catch {
    return false;
  }
}

function validateStateChangingRequestOrigin(request: NextRequest): boolean {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    return true;
  }

  const expectedOrigin = request.nextUrl.origin;
  const origin = request.headers.get("origin");
  if (origin && origin === expectedOrigin) {
    return true;
  }

  const referer = request.headers.get("referer");
  if (referer && isSameOrigin(referer, expectedOrigin)) {
    return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const operationId = `onetime_confirm_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  try {
    if (!validateStateChangingRequestOrigin(request)) {
      logWarn("Blocked one-time confirmation due to origin validation failure", {
        operationId,
        origin: request.headers.get("origin"),
        referer: request.headers.get("referer"),
      });
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request origin",
          code: "ORIGIN_VALIDATION_FAILED",
        },
        { status: 403 }
      );
    }

    // 验证用户认证
    const authResult = await requireAuth(request);
    if (!authResult) {
      return createAuthErrorResponse();
    }

    const { user } = authResult;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const searchParams = request.nextUrl.searchParams;
    const sessionId =
      readString(body.session_id) ||
      readString(body.sessionId) ||
      searchParams.get("session_id") ||
      "";
    const outTradeNo =
      readString(body.out_trade_no) ||
      readString(body.outTradeNo) ||
      searchParams.get("out_trade_no") ||
      "";
    const tradeNo =
      readString(body.trade_no) ||
      readString(body.tradeNo) ||
      searchParams.get("trade_no") ||
      "";
    const wechatOutTradeNo =
      readString(body.wechat_out_trade_no) ||
      readString(body.wechatOutTradeNo) ||
      searchParams.get("wechat_out_trade_no") ||
      "";

    logInfo("[onetime-confirm] Parameters extracted", {
      hasSessionId: !!sessionId,
      hasOutTradeNo: !!outTradeNo,
      hasTradeNo: !!tradeNo,
      hasWechatOutTradeNo: !!wechatOutTradeNo,
    });

    logInfo("Processing one-time payment confirmation", {
      operationId,
      userId: user.id,
      hasSessionId: !!sessionId,
      hasOutTradeNo: !!outTradeNo,
      hasTradeNo: !!tradeNo,
      hasWechatOutTradeNo: !!wechatOutTradeNo,
    });

    if (!sessionId && !outTradeNo && !tradeNo && !wechatOutTradeNo) {
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
      // ✅ 策略：Stripe 依赖 webhook，跳过 confirm 中的会员延期
      if (days > 0 && transactionId) {
        logInfo("Ensuring membership extension for already-processed payment", {
          operationId,
          userId: user.id,
          transactionId,
          days,
        });

        // 检测是否为 Stripe（依赖 webhook 的支付方式）
        const isStripe = !!sessionId;

        if (!isChinaRegion()) {
          if (isStripe) {
            // Stripe：跳过 extendMembership，依赖 webhook
            logInfo(
              "[onetime-confirm] already-processed Stripe payment, skipping extendMembership and relying on webhook",
              {
                operationId,
                userId: user.id,
                transactionId,
                isStripe: !!sessionId,
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
      sessionId || outTradeNo || tradeNo || wechatOutTradeNo;
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
        return NextResponse.json(
          {
            success: false,
            error: "PAYMENT_RECORD_UPDATE_FAILED",
            operationId,
          },
          { status: 500 }
        );
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
        return NextResponse.json(
          {
            success: false,
            error: "INVALID_PAYMENT_AMOUNT",
            operationId,
          },
          { status: 500 }
        );
      } else {
        const paymentData: any = {
          user_id: user.id,
          amount,
          currency,
          status: "completed",
          payment_method: sessionId ? "stripe" : "alipay",
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
            "Failed to create payment record in one-time confirm",
            insertError as Error,
            {
              operationId,
              userId: user.id,
              transactionId,
            }
          );
          return NextResponse.json(
            {
              success: false,
              error: "PAYMENT_RECORD_PERSIST_FAILED",
              operationId,
            },
            { status: 500 }
          );
        }
      }
    }

    const isStripe = !!sessionId;
    const isAlipay = !!outTradeNo || !!tradeNo; // Alipay 有 outTradeNo 或 tradeNo
    const membershipDeferredToWebhook = isStripe || isAlipay;

    if (membershipDeferredToWebhook) {
      logInfo(
        "[onetime-confirm] Payment confirmed, membership extension deferred to webhook",
        {
          operationId,
          userId: user.id,
          transactionId,
          isStripe,
          isAlipay,
          days,
          membershipStatus: "pending_webhook",
        }
      );

      return NextResponse.json(
        {
          success: true,
          transactionId,
          amount,
          currency,
          daysAdded: 0,
          membershipStatus: "pending_webhook",
        },
        { status: 202 }
      );
    }

    let membershipExtended = false;
    if (!isChinaRegion()) {
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
      membershipStatus: "active",
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

