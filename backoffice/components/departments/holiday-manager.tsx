"use client";

import React, { useState } from "react";
import { format, parseISO, isBefore, isToday, differenceInDays } from "date-fns";
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Search,
  Sparkles,
  AlertCircle,
  CalendarCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export interface HolidayItem {
  date: string; // YYYY-MM-DD
  name: string;
}

interface HolidayManagerProps {
  holidays: HolidayItem[];
  onChange: (holidays: HolidayItem[]) => void;
  disabled?: boolean;
}

export function HolidayManager({
  holidays = [],
  onChange,
  disabled = false,
}: HolidayManagerProps) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Common public holidays quick presets for India / General
  const quickSuggestions = [
    { date: `${new Date().getFullYear()}-01-26`, name: "Republic Day" },
    { date: `${new Date().getFullYear()}-08-15`, name: "Independence Day" },
    { date: `${new Date().getFullYear()}-10-02`, name: "Gandhi Jayanti" },
    { date: `${new Date().getFullYear()}-12-25`, name: "Christmas Day" },
    { date: `${new Date().getFullYear()}-05-01`, name: "Labour Day / Gujarat Day" },
  ];

  const handleAddHoliday = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!date || !name.trim()) {
      toast.error("Please enter both holiday date and name");
      return;
    }

    // Validate format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error("Date must be in YYYY-MM-DD format");
      return;
    }

    const exists = holidays.some((h) => h.date === date);
    if (exists) {
      toast.error(`A holiday is already scheduled on ${date}`);
      return;
    }

    const updated = [...holidays, { date, name: name.trim() }].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    onChange(updated);
    toast.success(`Added holiday: "${name.trim()}"`);
    setDate("");
    setName("");
    setIsAdding(false);
  };

  const handleDeleteHoliday = (targetDate: string) => {
    const item = holidays.find((h) => h.date === targetDate);
    const updated = holidays.filter((h) => h.date !== targetDate);
    onChange(updated);
    toast.success(`Removed holiday "${item?.name || targetDate}"`);
  };

  const handleQuickAdd = (suggestion: HolidayItem) => {
    if (holidays.some((h) => h.date === suggestion.date)) {
      toast.info(`Holiday on ${suggestion.date} already exists`);
      return;
    }
    const updated = [...holidays, suggestion].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    onChange(updated);
    toast.success(`Added ${suggestion.name}`);
  };

  // Filter & sort
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredHolidays = holidays
    .filter((h) => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return h.name.toLowerCase().includes(s) || h.date.includes(s);
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const getStatusBadge = (dateStr: string) => {
    try {
      const parsed = parseISO(dateStr);
      if (isToday(parsed)) {
        return (
          <Badge className="border-status-pending-border bg-status-pending-bg text-status-pending">
            Today
          </Badge>
        );
      }
      if (isBefore(parsed, today)) {
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Past
          </Badge>
        );
      }
      const days = differenceInDays(parsed, today);
      return (
        <Badge variant="secondary" className="font-normal text-xs text-primary">
          In {days} day{days === 1 ? "" : "s"}
        </Badge>
      );
    } catch {
      return null;
    }
  };

  const formatHolidayDate = (dateStr: string) => {
    try {
      const parsed = parseISO(dateStr);
      return {
        formatted: format(parsed, "MMM dd, yyyy"),
        weekday: format(parsed, "EEEE"),
      };
    } catch {
      return { formatted: dateStr, weekday: "" };
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick suggestions if few holidays */}
      {holidays.length < 3 && !disabled && (
        <div className="rounded-lg border border-dashed p-3 bg-muted/40">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Quick add common gazetted holidays:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickSuggestions
              .filter((s) => !holidays.some((h) => h.date === s.date))
              .map((s) => (
                <Button
                  key={s.date}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAdd(s)}
                  className="h-7 text-xs bg-background hover:border-primary"
                >
                  <Plus className="mr-1 h-3 w-3 text-primary" />
                  {s.name} ({s.date})
                </Button>
              ))}
          </div>
        </div>
      )}

      {/* Add Form Card */}
      {!disabled && (
        <Card className="border shadow-xs">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                Add Department Holiday
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <form
              onSubmit={handleAddHoliday}
              className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
            >
              <div className="sm:col-span-4 space-y-1.5">
                <Label htmlFor="holiday-date" className="text-xs font-medium">
                  Date (YYYY-MM-DD) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="holiday-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9 text-sm"
                  required
                />
              </div>

              <div className="sm:col-span-6 space-y-1.5">
                <Label htmlFor="holiday-name" className="text-xs font-medium">
                  Holiday Name / Reason <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="holiday-name"
                  placeholder="e.g., Independence Day, Local Holiday"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 text-sm"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  size="sm"
                  className="w-full h-9 text-xs"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Table & Toolbar */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Configured Holidays ({holidays.length})
            </span>
          </div>

          {holidays.length > 3 && (
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter holidays..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          )}
        </div>

        {holidays.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 border rounded-lg border-dashed text-center bg-card">
            <CalendarCheck className="h-8 w-8 text-muted-foreground/60 mb-2" />
            <p className="text-sm font-medium">No holidays scheduled</p>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Add gazetted public holidays and departmental non-working dates
              above. Daily token booking will automatically be disabled on these days.
            </p>
          </div>
        ) : filteredHolidays.length === 0 ? (
          <div className="text-center py-6 border rounded-lg text-sm text-muted-foreground">
            No holidays matched &ldquo;{search}&rdquo;.
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-xs">
                  <TableHead className="w-[160px]">Date</TableHead>
                  <TableHead className="w-[120px]">Day</TableHead>
                  <TableHead>Holiday Name</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  {!disabled && (
                    <TableHead className="w-[60px] text-right">Action</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHolidays.map((holiday) => {
                  const { formatted, weekday } = formatHolidayDate(holiday.date);
                  return (
                    <TableRow key={holiday.date} className="text-xs sm:text-sm">
                      <TableCell className="font-mono text-xs font-medium">
                        {holiday.date}
                        <span className="block text-[10px] font-sans text-muted-foreground">
                          {formatted}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {weekday}
                      </TableCell>
                      <TableCell className="font-medium">
                        {holiday.name}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(holiday.date)}
                      </TableCell>
                      {!disabled && (
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteHoliday(holiday.date)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Remove holiday"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
