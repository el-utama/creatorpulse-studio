import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { APP_CONFIG } from "@/config/app";
import { sessionToken } from "@/lib/session";
import { initPublish, uploadVideoChunk, getCreatorCapabilities } from "@/lib/tiktok";

export async function POST(request: Request) {
  const accessToken = await sessionToken();

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let acceptedId: string | null = null;
  try {
    const formData = await request.formData();
    const mode = formData.get("mode") as string;
    const videoUrl = formData.get("videoUrl") as string;
    const caption = formData.get("caption") as string;
    const privacy = formData.get("privacy") as string;
    const disableComment = formData.get("disableComment") === "true";
    const disableDuet = formData.get("disableDuet") === "true";
    const disableStitch = formData.get("disableStitch") === "true";
    const consent = formData.get("consent") === "true";
    const file = formData.get("file") as File | null;

    if (!consent) {
      return NextResponse.json(
        { error: "User consent is required" },
        { status: 400 }
      );
    }

    if (mode !== "inbox" && mode !== "profile") return NextResponse.json({ error: "Mode publikasi tidak valid." }, { status: 400 });
    if (mode === "profile" && (typeof caption !== "string" || caption.length > 2200)) return NextResponse.json({error:"Caption maksimal 2200 karakter."},{status:400});
    if (mode === "profile" && !["PUBLIC_TO_EVERYONE", "FOLLOWER_OF_CREATOR", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"].includes(privacy)) return NextResponse.json({ error: "Pilih visibilitas video." }, { status: 400 });
    if (mode === "profile") {
      const capabilities = await getCreatorCapabilities(accessToken);
      if (!capabilities.privacy_level_options.includes(privacy) || (capabilities.comment_disabled && !disableComment) || (capabilities.duet_disabled && !disableDuet) || (capabilities.stitch_disabled && !disableStitch)) return NextResponse.json({error:"Pengaturan akun berubah. Muat ulang dan tinjau kembali publikasi."},{status:400});
    }
    let sourceType: string;
    let posterUrl: string | undefined;
    let videoBuffer: Uint8Array | undefined;

    if (typeof videoUrl === "string" && videoUrl.trim() && !file) {
      let valid = false;
      try { valid = new URL(videoUrl).protocol === "https:"; } catch {}
      if (!valid) {
        return NextResponse.json(
          { error: "Gunakan tautan video HTTPS yang valid." },
          { status: 400 }
        );
      }
      sourceType = "PULL_FROM_URL";
      posterUrl = videoUrl;
    } else {
      if (videoUrl || !(file instanceof File) || !["video/mp4", "video/quicktime"].includes(file.type) || file.size === 0 || file.size > 4 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Pilih video MP4 atau MOV maksimal 4 MB." },
          { status: 400 }
        );
      }
      sourceType = "FILE_UPLOAD";
      const arrayBuffer = await file.arrayBuffer();
      videoBuffer = new Uint8Array(arrayBuffer);
    }

    const initBody: Record<string, unknown> = {
      source_info: {
        source_type: sourceType,
      },
      ...(mode === "profile" ? { post_info: {
        title: caption,
        privacy_level: privacy,
        disable_comment: disableComment,
        disable_duet: disableDuet,
        disable_stitch: disableStitch,
      } } : {}),
    };

    if (posterUrl) {
      (initBody.source_info as Record<string, unknown>)[
        "video_url"
      ] = posterUrl;
    }

    if (videoBuffer) Object.assign(initBody.source_info as Record<string, unknown>, { video_size: videoBuffer.length, chunk_size: videoBuffer.length, total_chunk_count: 1 });
    const initResult = await initPublish(accessToken, initBody, mode);
    const { publish_id, upload_url } = initResult;
    acceptedId = publish_id;

    if (sourceType === "FILE_UPLOAD") {
      if (!upload_url || !videoBuffer || !file) throw new Error("Missing upload information");
      await uploadVideoChunk(upload_url, videoBuffer, file.type);
    }

    return NextResponse.json({
      success: true,
      publish_id,
      message: "Upload initiated successfully",
    });
  } catch (error) {
    console.error("Publication request failed");
    if (acceptedId) return NextResponse.json({ publish_id: acceptedId, warning: "TikTok menerima inisialisasi, tetapi transfer belum terkonfirmasi. Periksa status sebelum mencoba ulang." }, {status:202});
    return NextResponse.json(
      { error: "Publikasi belum dapat dikonfirmasi. Periksa akun TikTok sebelum mencoba ulang." },
      { status: 500 }
    );
  }
}