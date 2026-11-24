"use client";


import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatNumber } from "@/lib/utils";

interface VideoItem {
  id: string;
  title: string;
  video_description?: string;
  cover_image_url: string;
  create_time: number | string;
  share_url: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
}

export function VideoList({ videos }: { videos: VideoItem[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const filtered = [...videos].filter(v => ((v.title ?? "") + " " + (v.video_description ?? "")).toLowerCase().includes(query.toLowerCase())).sort((a,b) => sort === "views" ? b.view_count-a.view_count : sort === "likes" ? b.like_count-a.like_count : (typeof b.create_time === "number" ? b.create_time * 1000 : Number(b.create_time) ? Number(b.create_time) * 1000 : Date.parse(b.create_time)) - (typeof a.create_time === "number" ? a.create_time * 1000 : Number(a.create_time) ? Number(a.create_time) * 1000 : Date.parse(a.create_time)));
  if (!videos || videos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Belum ada video yang tersedia.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4"><div className="flex flex-wrap gap-3"><label className="flex-1 text-sm">Cari video<input className="mt-1 block w-full rounded-md border bg-background p-2" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari judul atau keterangan"/></label><label className="text-sm">Urutkan<select className="mt-1 block rounded-md border bg-background p-2" value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">Terbaru</option><option value="views">Tayangan</option><option value="likes">Suka</option></select></label></div><p className="text-sm text-muted-foreground">{filtered.length} dari {videos.length} video</p>{filtered.length===0 && <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada video yang cocok.</p>}<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {filtered.map((video) => (
        <Card key={video.id} className="overflow-hidden shadow-none">
          <div className="relative aspect-[9/16] w-full bg-muted overflow-hidden">
            {video.cover_image_url && <img src={video.cover_image_url} alt={video.title || "Sampul video"} className="absolute inset-0 h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.visibility="hidden";}}/>}
            <div className="absolute bottom-1 right-1 bg-background/80 text-foreground text-xs px-1 py-0.5 rounded">
              {formatDate(video.create_time)}
            </div>
          </div>
          <CardContent className="p-2 pt-1">
            <CardTitle className="text-xs font-medium line-clamp-2 text-foreground mb-1">
              {video.title}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1" aria-label={`Tayangan: ${formatNumber(video.view_count)}`}>
                👁 {formatNumber(video.view_count)}
              </span>
              <span className="flex items-center gap-1" aria-label={`Suka: ${formatNumber(video.like_count)}`}>
                ❤ {formatNumber(video.like_count)}
              </span>
              <span className="flex items-center gap-1" aria-label={`Komentar: ${formatNumber(video.comment_count)}`}>
                💬 {formatNumber(video.comment_count)}
              </span>
              <span aria-label={`Bagikan: ${formatNumber(video.share_count)}`}>↗ {formatNumber(video.share_count)}</span>
            </div>
          </CardContent>
          <CardFooter className="p-2 pt-0">
            <a
              href={video.share_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline font-medium block text-center"
            >
              Buka di TikTok →
            </a>
          </CardFooter>
        </Card>
      ))}
    </div></div>
  );
}