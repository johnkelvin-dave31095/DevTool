import { Bell, CalendarDays, HelpCircle, MoonStar, Search, SunMedium } from "lucide-react";

import integrationMark from "../assets/integration-mark.svg";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

type TopbarProps = {
  currentEmail: string;
  theme: "purple" | "light";
  onToggleTheme: () => void;
};

export function Topbar({ currentEmail, theme, onToggleTheme }: TopbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3 lg:hidden">
          <img
            src={integrationMark}
            alt="Clockify Outlook integration"
            className="h-9 w-9 rounded-md"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">TimeBridge</p>
            <p className="truncate text-xs text-muted-foreground">Sync center</p>
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 items-center gap-3 rounded-md border bg-background px-3 py-2 md:flex">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm text-muted-foreground">
            Search projects, clients, calendar rules
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label={`Switch to ${theme === "purple" ? "light" : "purple"} mode`}
            onClick={onToggleTheme}
            className="hidden items-center gap-1 rounded-full border border-border bg-background p-1 sm:inline-flex"
          >
            <span
              className={cn(
                "flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold transition-colors",
                theme === "light"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              <SunMedium className="h-3.5 w-3.5" />
              Light
            </span>
            <span
              className={cn(
                "flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold transition-colors",
                theme === "purple"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              <MoonStar className="h-3.5 w-3.5" />
              Purple
            </span>
          </button>
          <div className="hidden min-w-0 items-center gap-2 rounded-full border border-border bg-background px-3 py-2 md:flex">
            <span className="truncate text-sm text-muted-foreground">{currentEmail}</span>
          </div>
          <Button variant="ghost" size="icon" aria-label="Calendar">
            <CalendarDays className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Help">
            <HelpCircle className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
