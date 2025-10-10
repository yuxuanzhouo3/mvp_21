import { FileText, Shield, Globe, Smartphone, Zap, Lock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const features = [
  {
    icon: FileText,
    title: "Smart Contract Creation",
    description:
      "Create professional contracts with AI-powered templates in minutes. Support for both Chinese and English.",
  },
  {
    icon: Shield,
    title: "E-Signature Compliance",
    description: "Legally binding e-signatures compliant with US ESIGN Act and China Electronic Signature Law.",
  },
  {
    icon: Globe,
    title: "Cross-Border Ready",
    description: "Seamlessly manage contracts between China and USA with built-in compliance and localization.",
  },
  {
    icon: Smartphone,
    title: "Multi-Platform Access",
    description: "Access your contracts anywhere: Web, WeChat Mini Program, iOS, Android, and Desktop apps.",
  },
  {
    icon: Zap,
    title: "Real-Time Collaboration",
    description: "Collaborate with team members and clients in real-time with instant notifications and updates.",
  },
  {
    icon: Lock,
    title: "Bank-Level Security",
    description: "End-to-end encryption, blockchain verification, and secure cloud storage for all your documents.",
  },
]

export function Features() {
  return (
    <section id="features" className="container px-4 py-24 bg-muted/30">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
            Everything you need for digital contracts
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            Powerful features designed for businesses operating in China and the United States
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="border-border/50 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-pretty">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
