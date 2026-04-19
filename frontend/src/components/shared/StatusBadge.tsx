import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "running" | "stopped" | "finished" | "error" | "pending";

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  running: { label: "运行中", variant: "default" },
  stopped: { label: "已停止", variant: "secondary" },
  finished: { label: "已完成", variant: "outline" },
  error: { label: "异常", variant: "destructive" },
  pending: { label: "等待中", variant: "secondary" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={cn(className)}>
      {config.label}
    </Badge>
  );
}
