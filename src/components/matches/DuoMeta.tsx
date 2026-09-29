import { DuoAvatar } from "@/components/app/DuoAvatar";
import { TierBadge } from "@/components/app/TierBadge";
import { Skeleton } from "@/components/ui/skeleton";

/** Regel onder een paginatitel: welk duo je bekijkt (+ regio en tier als bekend). */
export function DuoMeta({
  name,
  regionName,
  tier,
  own = false,
}: {
  name: string | null;
  regionName?: string;
  tier?: number;
  own?: boolean;
}) {
  if (!name) {
    return <Skeleton className="h-8 w-48 rounded-full" />;
  }
  return (
    <>
      <span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold">
        <DuoAvatar name={name} size="sm" own={own} />
        <span className="truncate">{name}</span>
      </span>
      {regionName ? <span className="text-sm text-muted-foreground">{regionName}</span> : null}
      {tier !== undefined ? <TierBadge tier={tier} /> : null}
    </>
  );
}
