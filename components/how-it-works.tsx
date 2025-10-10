import { FileEdit, UserCheck, Shield, CheckCircle } from "lucide-react"

const steps = [
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
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="container px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">How it works</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            Get your contracts signed in four simple steps
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
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
