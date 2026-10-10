"use client";

import React, { useState } from "react";
import { Check, ChevronsUpDown, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const COMMON_TIMEZONES = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST, UTC+05:30)", region: "India & South Asia" },
  { value: "Asia/Dhaka", label: "Asia/Dhaka (BST, UTC+06:00)", region: "India & South Asia" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST, UTC+04:00)", region: "Middle East" },
  { value: "Asia/Riyadh", label: "Asia/Riyadh (AST, UTC+03:00)", region: "Middle East" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT, UTC+08:00)", region: "Asia Pacific" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST, UTC+09:00)", region: "Asia Pacific" },
  { value: "Asia/Hong_Kong", label: "Asia/Hong_Kong (HKT, UTC+08:00)", region: "Asia Pacific" },
  { value: "Asia/Bangkok", label: "Asia/Bangkok (ICT, UTC+07:00)", region: "Asia Pacific" },
  { value: "Europe/London", label: "Europe/London (GMT/BST, UTC+00:00)", region: "Europe" },
  { value: "Europe/Paris", label: "Europe/Paris (CET, UTC+01:00)", region: "Europe" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET, UTC+01:00)", region: "Europe" },
  { value: "Europe/Amsterdam", label: "Europe/Amsterdam (CET, UTC+01:00)", region: "Europe" },
  { value: "America/New_York", label: "America/New_York (EST/EDT, UTC-05:00)", region: "Americas" },
  { value: "America/Chicago", label: "America/Chicago (CST/CDT, UTC-06:00)", region: "Americas" },
  { value: "America/Denver", label: "America/Denver (MST/MDT, UTC-07:00)", region: "Americas" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT, UTC-08:00)", region: "Americas" },
  { value: "America/Toronto", label: "America/Toronto (EST/EDT, UTC-05:00)", region: "Americas" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST, UTC+10:00)", region: "Oceania" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)", region: "Global" },
];

interface TimezoneSelectProps {
  value: string;
  onChange: (tz: string) => void;
  disabled?: boolean;
}

export function TimezoneSelect({
  value = "Asia/Kolkata",
  onChange,
  disabled = false,
}: TimezoneSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedTz = COMMON_TIMEZONES.find((tz) => tz.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          />
        }
      >
        <div className="flex items-center gap-2 truncate">
          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {selectedTz ? selectedTz.label : value || "Select timezone..."}
          </span>
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[340px] sm:w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search timezone..." />
          <CommandList className="max-h-64">
            <CommandEmpty>
              <div className="p-3 text-center text-sm">
                <p className="text-muted-foreground">No timezone found.</p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto p-0 text-xs"
                  onClick={() => {
                    // if user typed custom timezone
                    setOpen(false);
                  }}
                >
                  Use custom timezone value
                </Button>
              </div>
            </CommandEmpty>
            {COMMON_TIMEZONES.map((tz) => (
              <CommandItem
                key={tz.value}
                value={`${tz.value} ${tz.label} ${tz.region}`}
                onSelect={() => {
                  onChange(tz.value);
                  setOpen(false);
                }}
                className="flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{tz.value}</span>
                  <span className="text-xs text-muted-foreground">{tz.label}</span>
                </div>
                <Check
                  className={cn(
                    "ml-2 h-4 w-4 text-primary",
                    value === tz.value ? "opacity-100" : "opacity-0"
                  )}
                />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
