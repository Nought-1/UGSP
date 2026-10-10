import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={twMerge("flex items-center gap-2 border-b border-border overflow-x-auto pb-1 scrollbar-none", className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={clsx(
              "px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all border-b-2 min-h-[44px] flex items-center gap-2",
              isActive
                ? "border-brand text-brand bg-brand/5 rounded-t-lg"
                : "border-transparent text-muted hover:text-ink hover:border-border"
            )}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={clsx(
                  "px-2 py-0.5 text-xs rounded-full font-bold",
                  isActive ? "bg-brand text-white" : "bg-cream text-muted"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
