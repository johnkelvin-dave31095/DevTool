import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Copy, Search } from "lucide-react";

import { cn } from "../../lib/utils";

export type SearchSelectOption = {
  value: string;
  label: string;
};

type SearchSelectProps = {
  value: string;
  options: SearchSelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyResultsLabel: string;
  disabled?: boolean;
  className?: string;
  allowCopySelected?: boolean;
};

type DropdownPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: "top" | "bottom";
};

const DROPDOWN_GAP = 8;
const VIEWPORT_PADDING = 12;
const MAX_DROPDOWN_HEIGHT = 288;

export function SearchSelect({
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyResultsLabel,
  disabled = false,
  className,
  allowCopySelected = false,
}: SearchSelectProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [position, setPosition] = React.useState<DropdownPosition | null>(null);
  const [isCopied, setIsCopied] = React.useState(false);

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);

  const copyText = value ? selectedOption?.label?.trim() ?? "" : "";

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
    const spaceAbove = rect.top - VIEWPORT_PADDING;
    const placeAbove = spaceBelow < 220 && spaceAbove > spaceBelow;

    setPosition({
      left: Math.min(
        rect.left,
        window.innerWidth - rect.width - VIEWPORT_PADDING,
      ),
      top: placeAbove ? rect.top - DROPDOWN_GAP : rect.bottom + DROPDOWN_GAP,
      width: rect.width,
      maxHeight: Math.max(
        120,
        Math.min(
          MAX_DROPDOWN_HEIGHT,
          placeAbove ? spaceAbove : spaceBelow,
        ),
      ),
      placement: placeAbove ? "top" : "bottom",
    });
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }

    updatePosition();
    searchInputRef.current?.focus();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }

      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleViewportChange = () => updatePosition();

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen, updatePosition]);

  React.useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  React.useEffect(() => {
    if (!isCopied) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsCopied(false);
    }, 1500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isCopied]);

  function handleSelect(nextValue: string) {
    onChange(nextValue);
    setIsOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && filteredOptions.length > 0) {
      event.preventDefault();
      handleSelect(filteredOptions[0].value);
    }
  }

  async function handleCopySelected() {
    if (!copyText) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyText);
      } else {
        const input = document.createElement("textarea");
        input.value = copyText;
        input.setAttribute("readonly", "true");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }

      setIsCopied(true);
    } catch {
      setIsCopied(false);
    }
  }

  const triggerLabel = selectedOption?.label ?? placeholder;

  return (
    <>
      <div
        ref={containerRef}
        className={cn("relative flex items-center gap-2", className)}
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            if (disabled) {
              return;
            }

            setIsOpen((open) => !open);
          }}
          disabled={disabled}
          className={cn(
            "flex h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-none border border-input bg-background px-3 text-left text-sm text-foreground opacity-100 shadow-none transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-50",
            !selectedOption && "text-muted-foreground",
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </button>
        {allowCopySelected && copyText ? (
          <button
            type="button"
            onClick={handleCopySelected}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none border border-input bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isCopied ? "Project copied" : "Copy selected project"}
            title={isCopied ? "Copied" : "Copy selected project"}
          >
            {isCopied ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>
      {isOpen && position
        ? createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-50 overflow-hidden rounded-md border border-border bg-card text-card-foreground opacity-100 shadow-[0_18px_38px_rgba(10,8,18,0.42)]"
              style={{
                left: position.left,
                top: position.top,
                width: position.width,
                transform:
                  position.placement === "top" ? "translateY(-100%)" : undefined,
              }}
            >
              <div className="border-b border-border bg-card p-2">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder={searchPlaceholder}
                    className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground opacity-100 shadow-line transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
              </div>
              <div
                className="overflow-y-auto bg-card p-1"
                style={{ maxHeight: position.maxHeight }}
                role="listbox"
              >
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => {
                    const isSelected = option.value === value;

                    return (
                      <button
                        key={`${option.value}::${option.label}`}
                        type="button"
                        onClick={() => handleSelect(option.value)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-sm bg-card px-3 py-2 text-left text-sm opacity-100 transition-colors",
                          isSelected
                            ? "bg-primary/15 text-foreground"
                            : "text-foreground hover:bg-muted",
                        )}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <span className="truncate">{option.label}</span>
                        {isSelected ? (
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                        ) : null}
                      </button>
                    );
                  })
                ) : (
                  <div className="bg-card px-3 py-4 text-sm text-muted-foreground">
                    {emptyResultsLabel}
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
