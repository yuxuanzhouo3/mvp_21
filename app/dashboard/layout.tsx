import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="fixed bottom-4 right-4 z-40 md:hidden">
        <SidebarTrigger className="size-11 rounded-full border border-border/70 bg-background shadow-md" />
      </div>
      <SidebarInset className="bg-muted/25">
        <div className="mx-auto flex min-h-svh w-full max-w-[1440px] flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
