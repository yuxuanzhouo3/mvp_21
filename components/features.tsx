"use client";

import { FileText, Globe, Lock, Shield, Smartphone, Zap } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslations, type Language } from "@/lib/i18n";

const featureIcons = [FileText, Shield, Globe, Smartphone, Zap, Lock];

export function Features() {
  const { language } = useLanguage();
  const t = useTranslations(language as Language);

  return (
    <section id="features" className="bg-muted/30 py-20 md:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-balance md:text-4xl">
            {t.features.title}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground text-pretty">
            {t.features.subtitle}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {t.featureCards.map((feature, index) => {
            const Icon = featureIcons[index] || FileText;

            return (
              <Card
                key={`${feature.title}-${index}`}
                className="border-border/50 transition-colors hover:border-primary/50"
              >
                <CardContent className="pt-6">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground text-pretty">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

