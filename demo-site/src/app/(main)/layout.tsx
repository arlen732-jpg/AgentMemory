import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import { DialogProvider } from "@/components/dialogs";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DialogProvider>
        <AppShell>{children}</AppShell>
      </DialogProvider>
    </AuthGuard>
  );
}
