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

export function MetricCard({ title, value, icon: Icon, description, color = "text-tiktok-primary" }: MetricCardProps) {
  return (
    <Card className="border-t-2 border-t-tiktok-primary">
      <CardHeader className="space-y-1">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <CardDescription className="text-xs">{description || ""}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <span className={`text-2xl font-bold ${color}`}>{value}</span>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex items-center justify-between">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardFooter>
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Followers"
        value={followers.toLocaleString("id-ID")}
        icon={User}
        description="Pengikut akun"
      />
      <MetricCard
        title="Following"
        value={following.toLocaleString("id-ID")}
        icon={Users}
        description="Diikuti oleh akun"
      />
      <MetricCard
        title="Total Likes"
        value={likes.toLocaleString("id-ID")}
        icon={Heart}
        description="Total suka pada video"
      />
      <MetricCard
        title="Total Videos"
        value={videos.toLocaleString("id-ID")}
        icon={Video}
        description="Jumlah video yang diunggah"
      />
    </div>
  );
}