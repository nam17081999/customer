"use client";

import { useState } from "react";
import Sidebar from "./sidebar";
import Header from "./header";

export default function AppLayout({ children, title, subtitle }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-dvh">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--bg)] h-dvh">
        <Header
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setSidebarOpen((v) => !v)}
        />

        <main className="flex-1 flex flex-col content">{children}
        </main>
      </div>
    </div>
  );
}
