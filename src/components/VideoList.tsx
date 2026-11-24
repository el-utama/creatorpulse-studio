"use client";

import Image from "next/image";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {videos.map((video) => (
        <Card key={video.id} className="cursor-pointer hover:border-tiktok-primary/50 transition-colors">
          <div className="relative aspect-video w-full bg-muted overflow-hidden">
            <Image
              src={video.cover_image_url}
              alt={video.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              loading="lazy"
            />
            <div className="absolute bottom-1 right-1 bg-background/80 text-foreground text-xs px-1 py-0.5 rounded">
              {formatDate(video.create_time)}
            </div>
          </div>
          <CardContent className="p-2 pt-1">
            <CardTitle className="text-xs font-medium line-clamp-2 text-foreground mb-1">
              {video.title}
            </CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1" aria-label={`Views: ${formatNumber(video.view_count)}`}>
                👁 {formatNumber(video.view_count)}
              </span>
              <span className="flex items-center gap-1" aria-label={`Likes: ${formatNumber(video.like_count)}`}>
                ❤ {formatNumber(video.like_count)}
              </span>
              <span className="flex items-center gap-1" aria-label={`Comments: ${formatNumber(video.comment_count)}`}>
                💬 {formatNumber(video.comment_count)}
              </span>
            </div>
          </CardContent>
          <CardFooter className="p-2 pt-0">
            <a
              href={video.share_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-tiktok-primary hover:underline font-medium block text-center"
            >
              Buka di TikTok →
            </a>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}