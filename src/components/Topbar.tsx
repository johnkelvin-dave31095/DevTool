import { Bell, CalendarDays, HelpCircle, Search } from "lucide-react";

import integrationMark from "../assets/integration-mark.svg";
import { Button } from "./ui/button";

type TopbarProps = {
  currentEmail: string;
};

export function Topbar({ currentEmail }: TopbarProps) {
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
