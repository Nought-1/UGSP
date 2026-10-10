"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const DAYS_OF_WEEK = [
  { index: 0, label: "Sun", full: "Sunday" },
  { index: 1, label: "Mon", full: "Monday" },
  { index: 2, label: "Tue", full: "Tuesday" },
  { index: 3, label: "Wed", full: "Wednesday" },
  { index: 4, label: "Thu", full: "Thursday" },
  { index: 5, label: "Fri", full: "Friday" },
  { index: 6, label: "Sat", full: "Saturday" },
];

interface WeekOffPickerProps {
  value: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}

export function WeekOffPicker({
  value = [0, 6],
  onChange,
  disabled = false,
}: WeekOffPickerProps) {
  const toggleDay = (dayIndex: number) => {
    if (disabled) return;
    const exists = value.includes(dayIndex);
    let updated: number[];
    if (exists) {
      updated = value.filter((d) => d !== dayIndex);
    } else {
      updated = [...value, dayIndex].sort((a, b) => a - b);
    }
    onChange(updated);
  };

  const selectedCount = value.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {DAYS_OF_WEEK.map((day) => {
          const isSelected = value.includes(day.index);
          return (
            <button
              key={day.index}
              type="button"
              disabled={disabled}
              onClick={() => toggleDay(day.index)}
              title={day.full}
              className={cn(
                "relative flex h-10 w-11 sm:w-12 items-center justify-center rounded-lg border text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  : "border-input bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {day.label}
              {isSelected && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-50"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-background border border-primary"></span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {selectedCount === 0
            ? "No weekly off days configured (7 days operational)"
            : selectedCount === 7
            ? "All days marked as off"
            : `${selectedCount} day${selectedCount > 1 ? "s" : ""} selected as weekly off`}
        </span>
        {value.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {value.map((dayIdx) => (
              <Badge
                key={dayIdx}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 font-normal"
              >
                {DAYS_OF_WEEK[dayIdx]?.label}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
