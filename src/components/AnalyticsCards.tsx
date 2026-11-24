"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Users, Heart, Video } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  color?: string;
}

export function MetricCard({ title, value, icon: Icon, description, color = "text-foreground" }: MetricCardProps) {
  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader className="space-y-1 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-1"><CardTitle className="text-sm font-medium">{title}</CardTitle><Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true"/></div>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
        <div className={`break-words text-xl sm:text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}

export function AnalyticsCards({
  followers,
  following,
  likes,
  videos,
}: {
  followers: number;
  following: number;
  likes: number;
  videos: number;
}) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <MetricCard
        title="Pengikut"
        value={Number.isFinite(followers) ? followers.toLocaleString("id-ID") : "—"}
        icon={User}
        description="Pengikut akun"
      />
      <MetricCard
        title="Mengikuti"
        value={Number.isFinite(following) ? following.toLocaleString("id-ID") : "—"}
        icon={Users}
        description="Diikuti oleh akun"
      />
      <MetricCard
        title="Total suka"
        value={Number.isFinite(likes) ? likes.toLocaleString("id-ID") : "—"}
        icon={Heart}
        description="Total suka pada video"
      />
      <MetricCard
        title="Total video"
        value={Number.isFinite(videos) ? videos.toLocaleString("id-ID") : "—"}
        icon={Video}
        description="Jumlah video yang diunggah"
      />
    </div>
  );
}