import { type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p
              className="text-sm font-medium"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {title}
            </p>
            <p
              className="text-3xl font-bold"
              style={{ color: "var(--color-text)" }}
            >
              {value}
            </p>
            {trend && (
              <p
                className="text-sm"
                style={{ color: trend.isPositive ? "#22c55e" : "#ef4444" }}
              >
                {trend.isPositive ? "+" : "-"}
                {trend.value}%
              </p>
            )}
          </div>
          {icon && (
            <div
              className="p-3 rounded-full"
              style={{ backgroundColor: "var(--color-primary)", opacity: 0.1 }}
            >
              <div style={{ color: "var(--color-primary)" }}>{icon}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
