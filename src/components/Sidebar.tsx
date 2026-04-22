import {
  CalendarClock,
  Gauge,
  History,
  KeyRound,
  LogOut,
  RefreshCw,
  Settings2,
} from "lucide-react";

import integrationMark from "../assets/integration-mark.svg";
import { Button } from "./ui/button";

const navItems = [
  { label: "Overview", icon: Gauge, active: true },
  { label: "Sync rules", icon: RefreshCw, active: false },
  { label: "Credentials", icon: KeyRound, active: false },
  { label: "Activity", icon: History, active: false },
  { label: "Settings", icon: Settings2, active: false },
];

type SidebarProps = {
  currentEmail: string;
  onEditSetup: () => void;
  onLogout: () => void;
};

export function Sidebar({ currentEmail, onEditSetup, onLogout }: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen border-r bg-card lg:flex lg:flex-col">
      <div className="flex items-center gap-3 border-b px-5 py-5">
        <img
          src={integrationMark}
          alt="Clockify Outlook integration"
          className="h-11 w-11 rounded-md"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">TimeBridge</p>
          <p className="truncate text-xs text-muted-foreground">
            Clockify to Outlook
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <Button
            key={item.label}
            variant={item.active ? "outline" : "ghost"}
            className="h-11 w-full justify-start"
            onClick={item.label === "Credentials" ? onEditSetup : undefined}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Button>
        ))}
      </nav>

      <div className="mt-auto border-t p-4">
        <div className="space-y-3">
          <div className="rounded-lg border bg-background p-4">
            <p className="truncate text-sm font-semibold text-foreground">{currentEmail}</p>
            <p className="mt-1 text-xs text-muted-foreground">Active DevTool session</p>
          </div>
          <Button variant="outline" onClick={onLogout} className="h-11 w-full justify-start rounded-full">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </aside>
  );
}
