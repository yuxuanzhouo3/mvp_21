"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Star } from "lucide-react"
import { useLanguage } from "@/components/language-provider"

const testimonialsData = {
  en: [
    {
      name: "Sarah Chen",
      role: "CEO, TechBridge Inc.",
      location: "San Francisco, USA",
      content:
        "ContractHub has streamlined our cross-border agreements with our Chinese partners. The dual-language support and compliance features are exceptional.",
      rating: 5,
    },
    {
      name: "Li Wei",
      role: "Legal Director, Dragon Enterprises",
      location: "Shanghai, China",
      content: "This platform makes contract signing with our US clients simple and efficient. The WeChat integration is especially convenient.",
      rating: 5,
    },
    {
      name: "Michael Rodriguez",
      role: "Operations Manager, Global Trade Co.",
      location: "New York, USA",
      content: "The multi-platform access is a game-changer. Our team can manage contracts from anywhere, on any device.",
      rating: 5,
    },
  ],
  zh: [
    {
      name: "Sarah Chen",
      role: "CEO, TechBridge Inc.",
      location: "美国旧金山",
      content:
        "ContractHub 简化了我们与中国合作伙伴的跨境协议流程。双语支持和合规功能非常出色。",
      rating: 5,
    },
    {
      name: "李伟",
      role: "法务总监, 龙腾企业",
      location: "中国上海",
      content: "这个平台让我们与美国客户的合同签署变得简单高效。微信集成特别方便。",
      rating: 5,
    },
    {
      name: "Michael Rodriguez",
      role: "运营经理, Global Trade Co.",
      location: "美国纽约",
      content: "多平台访问是一个颠覆性的功能。我们的团队可以在任何地方、任何设备上管理合同。",
      rating: 5,
    },
  ],
}

const textData = {
  en: {
    title: "Trusted by businesses worldwide",
    subtitle: "See what our customers in China and the USA are saying",
  },
  zh: {
    title: "全球企业信赖之选",
    subtitle: "看看我们在中美两地的客户怎么说",
  },
}

export function Testimonials() {
  const { language } = useLanguage()
  const locale = language as "en" | "zh"
  const testimonials = testimonialsData[locale]
  const text = textData[locale]

  return (
    <section className="bg-muted/30 py-20 md:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">{text.title}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            {text.subtitle}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="border-border/50">
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4 text-pretty">{testimonial.content}</p>
                <div className="border-t border-border pt-4">
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.location}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
