import { resolveDeploymentRegion as getDeploymentRegion } from '@/lib/config/deployment-region'
import type { AiLanguage, AiProvider, AiRegion } from '@/lib/admin/types'

export interface AiProviderRoute {
  region: AiRegion
  language: AiLanguage
  analysisProvider: AiProvider
  analysisModel: string
  posterProvider: AiProvider
  posterModel: string
  videoProvider: AiProvider
  videoModel: string
}

export function resolveAiLanguage(region: AiRegion): AiLanguage {
  return region === 'CN' ? 'zh-CN' : 'en-US'
}

export function resolveAiRegion(explicitRegion?: AiRegion): AiRegion {
  return explicitRegion ?? getDeploymentRegion()
}

export function resolveAiProviderRoute(explicitRegion?: AiRegion): AiProviderRoute {
  const region = resolveAiRegion(explicitRegion)
  return {
    region,
    language: region === 'CN' ? 'zh-CN' : 'en-US',
    analysisProvider: 'aliyun-bailian',
    analysisModel: process.env.ALIYUN_QWEN_MODEL || process.env.AI_MODEL || process.env.QWEN_MODEL || 'qwen-plus',
    posterProvider: 'aliyun-wanx-image',
    posterModel: process.env.ALIYUN_WAN_IMAGE_MODEL || 'wan2.5-t2i-preview',
    videoProvider: 'aliyun-wanx-video',
    videoModel: process.env.ALIYUN_WAN_VIDEO_MODEL || 'wan2.5-t2v-preview',
  }
}

export function getDashScopeApiBase(_region: AiRegion): string {
  return process.env.DASHSCOPE_API_BASE || 'https://dashscope.aliyuncs.com/api/v1'
}

export function getDashScopeCompatibleBase(_region: AiRegion): string {
  return process.env.DASHSCOPE_COMPAT_BASE || process.env.AI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
}

export function getGeminiApiBase(): string {
  return process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta'
}

export function getOpenAiApiBase(): string {
  return process.env.OPENAI_API_BASE || 'https://api.openai.com/v1'
}

export function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required AI environment variable: ${name}`)
  }
  return value
}



