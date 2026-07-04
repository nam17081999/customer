"use client";

import { useState } from "react";
import Sidebar from "./sidebar";
import Header from "./header";

export default function AppLayout({ children, title, subtitle }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-auto">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg)] h-dvh">
        <Header
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setSidebarOpen((v) => !v)}
        />

        <main className="flex-1 flex flex-col content max-w-[1700px] mx-auto w-full px-4 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
