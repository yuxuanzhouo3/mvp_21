"use client"

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  MessageSquare, 
  Upload, 
  FileText, 
  Sparkles,
  Image as ImageIcon,
  Copy,
  Edit3,
  Send,
  Bot,
  User
} from 'lucide-react';

/**
 * 智能合同创建页面 - 主界面
 * 
 * 布局理念：
 * 1. 左侧：创建方式选择（卡片式，一目了然）
 * 2. 右侧：智能对话区域（沉浸式交互）
 * 3. 底部：快速操作栏（常用功能）
 */

export function SmartContractCreator() {
  const [activeMode, setActiveMode] = useState<'chat' | 'upload' | 'paste' | null>(null);
  const [messages, setMessages] = useState<Array<{role: 'user' | 'ai', content: string}>>([]);
  const [input, setInput] = useState('');
  const [contractPreview, setContractPreview] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* 顶部导航 */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 sm:text-xl">智能合同助手</h1>
                <p className="text-xs text-gray-500 sm:text-sm">30秒生成专业合同</p>
              </div>
            </div>
            
            {/* 用户状态 */}
            <div className="hidden items-center gap-4 md:flex">
              <span className="text-sm text-gray-600">企业：北京科技有限公司</span>
              <Button variant="outline" size="sm">我的合同</Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8">
        {/* 主内容区域 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
          
          {/* 左侧：创建方式选择（占3列）*/}
          <div className="space-y-4 lg:col-span-3">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">选择创建方式</h2>
            
            {/* 方式1：智能对话生成（推荐）*/}
            <Card 
              className={`cursor-pointer transition-all hover:shadow-lg md:hover:scale-105 ${
                activeMode === 'chat' ? 'ring-2 ring-blue-500 shadow-lg' : ''
              }`}
              onClick={() => setActiveMode('chat')}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">智能对话</h3>
                      <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs rounded-full">
                        推荐
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      像聊天一样，AI引导您快速生成专业合同
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Sparkles className="w-3 h-3" />
                      <span>最快30秒</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 方式2：上传PDF模板 */}
            <Card 
              className={`cursor-pointer transition-all hover:shadow-lg md:hover:scale-105 ${
                activeMode === 'upload' ? 'ring-2 ring-blue-500 shadow-lg' : ''
              }`}
              onClick={() => setActiveMode('upload')}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">上传模板</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      上传PDF/Word，AI自动识别并转换
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <ImageIcon className="w-3 h-3" />
                      <span>支持OCR识别</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 方式3：粘贴文本 */}
            <Card 
              className={`cursor-pointer transition-all hover:shadow-lg md:hover:scale-105 ${
                activeMode === 'paste' ? 'ring-2 ring-blue-500 shadow-lg' : ''
              }`}
              onClick={() => setActiveMode('paste')}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Copy className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">粘贴内容</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      粘贴聊天记录、邮件等文本内容
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <FileText className="w-3 h-3" />
                      <span>AI智能分析</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 快速入口 */}
            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-700 mb-3">常用模板</h3>
              <div className="space-y-2">
                <Button variant="ghost" className="w-full justify-start text-sm" size="sm">
                  <FileText className="w-4 h-4 mr-2" />
                  劳动合同
                </Button>
                <Button variant="ghost" className="w-full justify-start text-sm" size="sm">
                  <FileText className="w-4 h-4 mr-2" />
                  劳务协议
                </Button>
                <Button variant="ghost" className="w-full justify-start text-sm" size="sm">
                  <FileText className="w-4 h-4 mr-2" />
                  保密协议
                </Button>
              </div>
            </div>
          </div>

          {/* 中间：对话/操作区域（占6列）*/}
          <div className="lg:col-span-6">
            {!activeMode ? (
              // 未选择模式：显示引导
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">
                    开始创建您的专业合同
                  </h2>
                  <p className="text-gray-600 mb-6">
                    选择左侧的创建方式，让AI助手帮您快速生成
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-sm text-blue-700">
                    <Sparkles className="w-4 h-4" />
                    <span>推荐使用"智能对话"模式，最快30秒生成</span>
                  </div>
                </div>
              </div>
            ) : activeMode === 'chat' ? (
              // 智能对话模式
              <Card className="h-full flex flex-col">
                <CardContent className="flex-1 flex flex-col p-0">
                  {/* 对话标题 */}
                  <div className="border-b bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <Bot className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">AI助手小慧</h3>
                        <p className="text-sm text-gray-500">正在帮您生成劳动合同...</p>
                      </div>
                    </div>
                  </div>

                  {/* 对话内容区域 */}
                  <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                    {messages.length === 0 && (
                      <ChatBubble
                        role="ai"
                        content="您好！我是AI合同助手小慧 👋

我将通过几个简单问题，帮您快速生成专业的劳动合同。

首次使用需要录入企业信息（只需一次），您可以：
📷 拍照上传营业执照，5秒自动识别
✍️ 手动输入企业信息

请问您需要哪种方式？"
                        time="刚刚"
                      />
                    )}
                    
                    {messages.map((msg, index) => (
                      <ChatBubble
                        key={index}
                        role={msg.role}
                        content={msg.content}
                        time="刚刚"
                      />
                    ))}
                  </div>

                  {/* 输入区域 */}
                  <div className="p-4 border-t bg-gray-50">
                    <div className="flex gap-3">
                      <Textarea
                        placeholder="输入您的回答..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="flex-1 resize-none"
                        rows={2}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            // 发送消息
                          }
                        }}
                      />
                      <Button 
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        size="lg"
                      >
                        <Send className="w-5 h-5" />
                      </Button>
                    </div>
                    
                    {/* 快捷操作 */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm">
                        <Upload className="w-4 h-4 mr-2" />
                        上传营业执照
                      </Button>
                      <Button variant="outline" size="sm">
                        <Copy className="w-4 h-4 mr-2" />
                        粘贴文本
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : activeMode === 'upload' ? (
              // 上传模式
              <Card className="h-full">
                <CardContent className="flex h-full flex-col items-center justify-center p-6 sm:p-8 lg:p-12">
                  <div className="w-32 h-32 bg-gradient-to-br from-green-100 to-emerald-100 rounded-3xl flex items-center justify-center mb-6">
                    <Upload className="w-16 h-16 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">上传您的模板文件</h3>
                  <p className="text-gray-600 mb-6 text-center">
                    支持 PDF、Word、图片格式<br/>
                    AI将自动识别内容并转换为可编辑合同
                  </p>
                  <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700" size="lg">
                    <Upload className="w-5 h-5 mr-2" />
                    选择文件上传
                  </Button>
                  <p className="text-sm text-gray-500 mt-4">或拖拽文件到此处</p>
                </CardContent>
              </Card>
            ) : (
              // 粘贴模式
              <Card className="h-full">
                <CardContent className="h-full flex flex-col p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">粘贴内容</h3>
                  <Textarea
                    placeholder="粘贴聊天记录、邮件内容或其他文本...

例如：
'我们需要招聘一名前端工程师，月薪18000元，2月1日入职...'

AI将自动分析内容并生成合同"
                    className="flex-1 resize-none"
                  />
                  <div className="flex justify-end gap-3 mt-4">
                    <Button variant="outline">清空</Button>
                    <Button className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700">
                      <Sparkles className="w-4 h-4 mr-2" />
                      开始分析
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 右侧：实时预览区域（占3列）*/}
          <div className="lg:col-span-3">
            <div className="space-y-4 lg:sticky lg:top-24">
              <h2 className="text-lg font-semibold text-gray-900">合同预览</h2>
              
              <Card>
                <CardContent className="p-6">
                  {contractPreview ? (
                    // 有合同内容
                    <div>
                      <div className="aspect-[210/297] bg-white border-2 border-gray-200 rounded-lg p-4 mb-4 overflow-hidden">
                        <div className="text-xs text-gray-600">
                          {/* 合同预览内容 */}
                          <div className="text-center mb-4">
                            <h4 className="text-base font-bold">劳动合同</h4>
                          </div>
                          <p>甲方：【待生成】</p>
                          <p>乙方：【待生成】</p>
                          <p className="mt-4">...</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Button className="w-full" variant="outline">
                          <Edit3 className="w-4 h-4 mr-2" />
                          编辑合同
                        </Button>
                        <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                          <Send className="w-4 h-4 mr-2" />
                          发送签署
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // 无合同内容
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500">
                        合同生成后将在此处预览
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 进度提示 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-600">生成进度</span>
                        <span className="font-medium text-blue-600">0%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-600 to-purple-600 w-0"></div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    等待用户回答问题...
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 对话气泡组件
function ChatBubble({ role, content, time }: { role: 'user' | 'ai', content: string, time: string }) {
  const isAI = role === 'ai';
  
  return (
    <div className={`flex gap-3 ${isAI ? '' : 'flex-row-reverse'}`}>
      {/* 头像 */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
        isAI 
          ? 'bg-gradient-to-br from-blue-500 to-purple-500' 
          : 'bg-gradient-to-br from-gray-600 to-gray-800'
      }`}>
        {isAI ? (
          <Bot className="w-6 h-6 text-white" />
        ) : (
          <User className="w-6 h-6 text-white" />
        )}
      </div>
      
      {/* 消息内容 */}
      <div className={`flex-1 ${isAI ? '' : 'flex justify-end'}`}>
        <div className={`inline-block max-w-[80%] ${
          isAI 
            ? 'bg-white border border-gray-200' 
            : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
        } rounded-2xl px-4 py-3`}>
          <p className={`text-sm whitespace-pre-wrap ${isAI ? 'text-gray-800' : 'text-white'}`}>
            {content}
          </p>
        </div>
        <p className="text-xs text-gray-400 mt-1 px-2">{time}</p>
      </div>
    </div>
  );
}
