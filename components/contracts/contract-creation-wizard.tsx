"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"
import { TemplateSelection } from "./template-selection"
import { ContractEditor } from "./contract-editor"
import { AddParties } from "./add-parties"
import { SignatureSetup } from "./signature-setup"
import { ReviewAndSend } from "./review-and-send"

const steps = [
  { id: 1, name: "Template", component: TemplateSelection },
  { id: 2, name: "Edit", component: ContractEditor },
  { id: 3, name: "Parties", component: AddParties },
  { id: 4, name: "Signatures", component: SignatureSetup },
  { id: 5, name: "Review", component: ReviewAndSend },
]

export function ContractCreationWizard() {
  const [currentStep, setCurrentStep] = useState(1)

  const CurrentStepComponent = steps[currentStep - 1].component

  return (
    <div>
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    currentStep > step.id
                      ? "bg-primary border-primary text-primary-foreground"
                      : currentStep === step.id
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {currentStep > step.id ? <Check className="h-5 w-5" /> : step.id}
                </div>
                <span
                  className={`text-sm mt-2 ${currentStep >= step.id ? "text-foreground font-medium" : "text-muted-foreground"}`}
                >
                  {step.name}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-px flex-1 -mt-8 transition-colors ${currentStep > step.id ? "bg-primary" : "bg-border"}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          <CurrentStepComponent />
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        <Button
          onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}
          disabled={currentStep === steps.length}
        >
          {currentStep === steps.length ? "Send Contract" : "Next"}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
