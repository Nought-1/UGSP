import { Building2, CalendarDays, CheckCircle, Cog } from "lucide-react";
import { StatTile } from "@/components/stat-tile";

interface DepartmentCardStatsProps {
  departments: Array<{
    isActive: boolean;
    servicesCount?: number;
    holidaysCount?: number;
  }>;
}

export function DepartmentCardStats({ departments }: DepartmentCardStatsProps) {
  const total = departments.length;
  const active = departments.filter((d) => d.isActive).length;
  const services = departments.reduce((sum, d) => sum + (d.servicesCount ?? 0), 0);
  const holidays = departments.reduce((sum, d) => sum + (d.holidaysCount ?? 0), 0);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile label="Departments" value={total} icon={Building2} hint="Configured offices" />
      <StatTile
        label="Open for booking"
        value={active}
        icon={CheckCircle}
        hint={`${total ? Math.round((active / total) * 100) : 0}% of departments`}
      />
      <StatTile label="Services" value={services} icon={Cog} hint="Across all departments" />
      <StatTile label="Holidays" value={holidays} icon={CalendarDays} hint="Scheduled closures" />
    </div>
  );
}
