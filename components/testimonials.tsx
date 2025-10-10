import { Card, CardContent } from "@/components/ui/card"
import { Star } from "lucide-react"

const testimonials = [
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
    content: "这个平台让我们与美国客户的合同签署变得简单高效。WeChat集成特别方便。",
    rating: 5,
  },
  {
    name: "Michael Rodriguez",
    role: "Operations Manager, Global Trade Co.",
    location: "New York, USA",
    content: "The multi-platform access is a game-changer. Our team can manage contracts from anywhere, on any device.",
    rating: 5,
  },
]

export function Testimonials() {
  return (
    <section className="container px-4 py-24 bg-muted/30">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">Trusted by businesses worldwide</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            See what our customers in China and the USA are saying
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
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
