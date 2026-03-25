/**
 * 合同生成 API
 * POST /api/contracts/generate
 *
 * 根据分析结果生成正式合同
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateContract } from '@/lib/ai';
import { AIAnalysisResult } from '@/lib/ai/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { analysisResult, templateId, customFields } = body as {
      analysisResult: AIAnalysisResult;
      templateId?: string;
      customFields?: Record<string, string>;
    };

    // 验证必填字段
    if (!analysisResult || !analysisResult.contractType) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: '请提供有效的分析结果',
          },
        },
        { status: 400 }
      );
    }

    // 验证关键条款
    if (!analysisResult.keyTerms || analysisResult.keyTerms.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_KEY_TERMS',
            message: '未提取到关键条款，请检查对话内容',
          },
        },
        { status: 400 }
      );
    }

    // 调用 AI 生成合同
    const contract = await generateContract({
      analysisResult,
      templateId,
      customFields,
    });

    return NextResponse.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    console.error('生成合同失败:', error);

    // 检查是否是 API 密钥问题
    if (error instanceof Error && error.message.includes('API')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AI_SERVICE_ERROR',
            message: 'AI 服务暂时不可用，请稍后重试',
          },
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GENERATE_FAILED',
          message: '生成失败，请重试',
        },
      },
      { status: 500 }
    );
  }
}
