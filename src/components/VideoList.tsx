"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatNumber } from "@/lib/utils";

interface VideoItem {
  id: string;
  title: string;
  video_description?: string;
  cover_image_url: string;
  create_time: string;
  share_url: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
}

export function VideoList({ videos }: { videos: VideoItem[] }) {
  if (!videos || videos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Belum ada video yang tersedia.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {videos.map((video) => (
        <Card key={video.id} className="overflow-hidden">
          <div className="relative aspect-video w-full bg-muted">
            <img
              src={video.cover_image_url}
              alt={video.title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <CardHeader>
            <CardTitle className="text-sm line-clamp-1">{video.title}</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {formatDate(video.create_time)}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 grid grid-cols-4 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="text-foreground font-medium">👁</span>
              {formatNumber(video.view_count)}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-foreground font-medium">❤</span>
              {formatNumber(video.like_count)}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-foreground font-medium">💬</span>
              {formatNumber(video.comment_count)}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-foreground font-medium">🔁</span>
              {formatNumber(video.share_count)}
            </div>
          </CardContent>
          <CardFooter className="p-3">
            <a
              href={video.share_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-tiktok-primary hover:underline font-medium"
            >
              Buka di TikTok →
            </a>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}