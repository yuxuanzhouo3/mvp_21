"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Globe } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function LoginPage() {
  const [region, setRegion] = useState("us")

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <FileText className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">ContractHub</span>
          </Link>
          <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
          <p className="text-muted-foreground">Sign in to your account to continue</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Choose your region and enter your credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="us" className="w-full mb-6" onValueChange={setRegion}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="us">
                  <Globe className="h-4 w-4 mr-2" />
                  USA
                </TabsTrigger>
                <TabsTrigger value="cn">
                  <Globe className="h-4 w-4 mr-2" />
                  China
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{region === "us" ? "Email" : "邮箱"}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={region === "us" ? "name@company.com" : "name@company.com"}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{region === "us" ? "Password" : "密码"}</Label>
                  <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                    {region === "us" ? "Forgot password?" : "忘记密码？"}
                  </Link>
                </div>
                <Input id="password" type="password" />
              </div>

              <Button className="w-full" asChild>
                <Link href="/dashboard">{region === "us" ? "Sign In" : "登录"}</Link>
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">
                {region === "us" ? "Don't have an account?" : "还没有账户？"}
              </span>{" "}
              <Link href="/signup" className="text-primary hover:underline font-medium">
                {region === "us" ? "Sign up" : "注册"}
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {region === "us"
            ? "By signing in, you agree to our Terms of Service and Privacy Policy"
            : "登录即表示您同意我们的服务条款和隐私政策"}
        </p>
      </div>
    </div>
  )
}
