import { Suspense } from "react";
import { DepartmentDetail } from "@/components/departments/department-detail";
import { Skeleton } from "@/components/ui/skeleton";

// params is request data on this dynamic route, so the client view reads it behind Suspense (cacheComponents)
export default function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <DepartmentDetail params={params} />
    </Suspense>
  );
}
