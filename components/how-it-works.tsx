"use client"

import { FileEdit, UserCheck, Shield, CheckCircle } from "lucide-react"
import { useLanguage } from "@/components/language-provider"

const stepsData = {
  en: [
    {
      icon: FileEdit,
      title: "Create Contract",
      description: "Choose from templates or create custom contracts with our intuitive editor",
      step: "01",
    },
    {
      icon: UserCheck,
      title: "Add Signers",
      description: "Invite parties from China or USA to review and sign the contract",
      step: "02",
    },
    {
      icon: Shield,
      title: "E-Sign Securely",
      description: "All parties sign with legally compliant e-signatures",
      step: "03",
    },
    {
      icon: CheckCircle,
      title: "Store & Manage",
      description: "Contracts are encrypted, verified, and stored securely in the cloud",
      step: "04",
    },
  ],
  zh: [
    {
      icon: FileEdit,
      title: "创建合同",
      description: "从模板中选择或使用我们直观的编辑器创建自定义合同",
      step: "01",
    },
    {
      icon: UserCheck,
      title: "添加签署方",
      description: "邀请来自中国或美国的各方审阅并签署合同",
      step: "02",
    },
    {
      icon: Shield,
      title: "安全电子签名",
      description: "所有各方使用合法合规的电子签名进行签署",
      step: "03",
    },
    {
      icon: CheckCircle,
      title: "存储与管理",
      description: "合同经过加密、验证，并安全存储在云端",
      step: "04",
    },
  ],
}

const textData = {
  en: {
    title: "How it works",
    subtitle: "Get your contracts signed in four simple steps",
  },
  zh: {
    title: "工作原理",
    subtitle: "通过四个简单步骤完成合同签署",
  },
}

export function HowItWorks() {
  const { language } = useLanguage()
  const locale = language as "en" | "zh"
  const steps = stepsData[locale]
  const text = textData[locale]

  return (
    <section id="how-it-works" className="py-20 md:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">{text.title}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            {text.subtitle}
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <step.icon className="h-8 w-8 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {step.step}
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-pretty">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-px bg-border" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
