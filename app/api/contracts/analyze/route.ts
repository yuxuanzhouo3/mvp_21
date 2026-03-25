/**
 * 对话分析 API
 * POST /api/contracts/analyze
 *
 * 分析用户提供的对话内容，提取合同关键信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeConversation } from '@/lib/ai';
import { SourceType } from '@/lib/ai/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, sourceType = 'text' } = body as {
      content: string;
      sourceType?: SourceType;
    };

    // 验证必填字段
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: '请提供对话内容',
          },
        },
        { status: 400 }
      );
    }

    // 验证内容长度
    if (content.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONTENT_TOO_SHORT',
            message: '对话内容太短，请提供更详细的对话',
          },
        },
        { status: 400 }
      );
    }

    if (content.length > 50000) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONTENT_TOO_LONG',
            message: '对话内容过长，请精简后重试',
          },
        },
        { status: 400 }
      );
    }

    // 调用 AI 分析
    const result = await analyzeConversation({
      content,
      sourceType,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('分析对话失败:', error);

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
          code: 'ANALYZE_FAILED',
          message: '分析失败，请重试',
        },
      },
      { status: 500 }
    );
  }
}
