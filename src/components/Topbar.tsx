import { useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  Bell,
  FolderKanban,
  Search,
} from "lucide-react";

import integrationMark from "../assets/integration-mark.svg";
import { Button } from "./ui/button";

type TopbarProps = {
  currentEmail: string;
};

const notifications = [
  {
    id: "merge-review-enhancement",
    title: "Duplicate Clockify rows now get a merge review",
    detail:
      "When Outlook rows share the same Clockify project and task, the app now opens a merge step so users can combine hours and descriptions before pushing.",
    label: "Outlook to Clockify",
    icon: ArrowRightLeft,
  },
  {
    id: "ez-project-tracker-enhancement",
    title: "EZ Project Tracker enhancement added",
    detail:
      "Makes it easier to track project requirements and completeness.",
    label: "EZ Project Tracker",
    icon: FolderKanban,
  },
] as const;

export function Topbar({ currentEmail }: TopbarProps) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

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
          <div className="relative" ref={notificationsRef}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              aria-expanded={isNotificationsOpen}
              aria-haspopup="dialog"
              onClick={() => setIsNotificationsOpen((current) => !current)}
              className="relative rounded-full border-0"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
            </Button>

            {isNotificationsOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[360px] border border-border/80 bg-card shadow-[0_24px_60px_rgba(18,12,24,0.42)]">
                <div className="border-b border-border/80 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                        Notifications
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Latest enhancements in DevTool
                      </p>
                    </div>
                    <span className="border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground">
                      {notifications.length} new
                    </span>
                  </div>
                </div>

                <div className="max-h-[420px] overflow-y-auto">
                  {notifications.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.id}
                        className="border-b border-border/70 bg-card px-4 py-4 last:border-b-0"
                      >
                        <div className="flex gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-background text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                {item.label}
                              </span>
                              <span className="text-[11px] font-semibold text-primary">
                                New enhancement
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-foreground">
                              {item.title}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              {item.detail}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
