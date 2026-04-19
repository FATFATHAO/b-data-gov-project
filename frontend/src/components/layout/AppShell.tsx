import { type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: "var(--color-background, #0f0f1a)" }}
    >
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <Header />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
