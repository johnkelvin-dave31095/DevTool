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
    <aside className="sticky top-0 hidden h-screen border-r border-border/80 bg-card/95 backdrop-blur lg:flex lg:flex-col">
      <div className="flex items-center gap-3 border-b px-5 py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7f68a5,#4f3c5d)] text-sm font-semibold tracking-[0.18em] text-[hsl(var(--primary-foreground))] shadow-[0_12px_24px_rgba(40,24,52,0.28)]">
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
              ? "border-y border-primary/20 bg-primary/12 text-foreground hover:bg-primary/16 hover:text-foreground"
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
              ? "border-y border-primary/20 bg-primary/12 text-foreground hover:bg-primary/16 hover:text-foreground"
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
