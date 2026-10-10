import { APP_NAME } from "@/lib/constants";

export function Loader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-brand/20" />
          <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-brand border-r-brand animate-spin" />
          <div className="absolute inset-5 rounded-full bg-brand/10" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
            {APP_NAME}
          </p>
          <p className="text-sm text-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}
