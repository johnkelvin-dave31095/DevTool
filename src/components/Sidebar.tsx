import {
  ArrowRightLeft,
  LogOut,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "./ui/button";
import { cn } from "../lib/utils";

type SidebarProps = {
  activeModule: "clockify" | "rules";
  onSelectModule: (module: "clockify" | "rules") => void;
  onOpenSettings: () => void;
  onLogout: () => void;
};

export function Sidebar({
  activeModule,
  onSelectModule,
  onOpenSettings,
  onLogout,
}: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen border-r bg-card lg:flex lg:flex-col">
      <div className="flex items-center gap-3 border-b px-5 py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(17,21,51,0.98),rgba(37,122,110,0.94))] text-sm font-semibold tracking-[0.18em] text-white shadow-[0_12px_24px_rgba(17,21,51,0.18)]">
          DEV
        </div>
        <div className="min-w-0 leading-tight">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Oaktech
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            DevTool
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 py-4">
        <Button
          variant="ghost"
          className={cn(
            "h-11 w-full justify-start rounded-none px-5 transition-colors",
            activeModule === "clockify"
              ? "border-y border-[rgba(88,174,160,0.18)] bg-[rgba(88,174,160,0.16)] text-[hsl(var(--sea-ink))] hover:bg-[rgba(88,174,160,0.20)] hover:text-[hsl(var(--sea-ink))]"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          onClick={() => onSelectModule("clockify")}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Clockify
        </Button>
        <Button
          variant="ghost"
          className={cn(
            "h-11 w-full justify-start rounded-none px-5 transition-colors",
            activeModule === "rules"
              ? "border-y border-[rgba(88,174,160,0.18)] bg-[rgba(88,174,160,0.16)] text-[hsl(var(--sea-ink))] hover:bg-[rgba(88,174,160,0.20)] hover:text-[hsl(var(--sea-ink))]"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          onClick={() => onSelectModule("rules")}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Preload Rules
        </Button>
      </nav>

      <div className="px-3 pb-3">
        <Button
          variant="ghost"
          className="h-11 w-full justify-start"
          onClick={onOpenSettings}
        >
          <Settings2 className="h-4 w-4" />
          Settings
        </Button>
      </div>

      <div className="mt-auto border-t p-4">
        <Button variant="outline" onClick={onLogout} className="h-11 w-full justify-start rounded-full">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
