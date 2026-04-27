import {
  ArrowRightLeft,
  Blocks,
  LogOut,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";

import toolMark from "../assets/tool.svg";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

type SidebarProps = {
  activeModule: "outlook" | "asana" | "rules";
  onSelectModule: (module: "outlook" | "asana" | "rules") => void;
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
        <img
          src={toolMark}
          alt="Oaktech DevTool"
          className="h-11 w-11 rounded-xl object-cover"
        />
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
        <div className="px-5 pb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Clockify
          </p>
        </div>
        <Button
          variant="ghost"
          className={cn(
            "relative h-11 w-full justify-start rounded-none px-5 transition-all",
            activeModule === "asana"
              ? "border-y border-primary/25 bg-[linear-gradient(90deg,rgba(111,76,154,0.22),rgba(111,76,154,0.08))] pl-6 font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(255,255,255,0.08)] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary before:content-[''] hover:bg-[linear-gradient(90deg,rgba(111,76,154,0.24),rgba(111,76,154,0.1))] hover:text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          onClick={() => onSelectModule("asana")}
        >
          <Blocks className="h-4 w-4" />
          Asana
        </Button>
        <Button
          variant="ghost"
          className={cn(
            "relative h-11 w-full justify-start rounded-none px-5 transition-all",
            activeModule === "outlook"
              ? "border-y border-primary/25 bg-[linear-gradient(90deg,rgba(111,76,154,0.22),rgba(111,76,154,0.08))] pl-6 font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(255,255,255,0.08)] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary before:content-[''] hover:bg-[linear-gradient(90deg,rgba(111,76,154,0.24),rgba(111,76,154,0.1))] hover:text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          onClick={() => onSelectModule("outlook")}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Outlook
        </Button>
        <Button
          variant="ghost"
          className={cn(
            "relative h-11 w-full justify-start rounded-none px-5 transition-all",
            activeModule === "rules"
              ? "border-y border-primary/25 bg-[linear-gradient(90deg,rgba(111,76,154,0.22),rgba(111,76,154,0.08))] pl-6 font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(255,255,255,0.08)] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary before:content-[''] hover:bg-[linear-gradient(90deg,rgba(111,76,154,0.24),rgba(111,76,154,0.1))] hover:text-foreground"
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
