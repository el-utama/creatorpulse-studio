import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { APP_CONFIG } from "@/config/app";
import { publicationKey, reservePublication, finishPublication } from "@/lib/publication-idempotency";
import { explainTikTok, isAuthError, TikTokApiError } from "@/lib/tiktok-errors";
import { sessionToken } from "@/lib/session";
import { initPublish, uploadVideoChunk, getCreatorCapabilities } from "@/lib/tiktok";

export async function POST(request: Request) {
  let accessToken = await sessionToken();

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let acceptedId: string | null = null;
  let reservationKey: string | null = null;
  try {
    const formData = await request.formData();
    const requestId = formData.get("requestId");
    if (typeof requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) return NextResponse.json({error:"ID permintaan tidak valid."},{status:400});
    const mode = formData.get("mode") as string;
    const videoUrl = formData.get("videoUrl") as string;
    const caption = formData.get("caption") as string;
    const privacy = formData.get("privacy") as string;
    const disableComment = formData.get("disableComment") === "true";
    const disableDuet = formData.get("disableDuet") === "true";
    const disableStitch = formData.get("disableStitch") === "true";
    const brandOrganic = formData.get("brandOrganic") === "true";
    const brandContent = formData.get("brandContent") === "true";
    const isAigc = formData.get("isAigc") === "true";
    const duration = Number(formData.get("duration"));
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
      let capabilities;
      try {capabilities=await getCreatorCapabilities(accessToken);} catch(error) {
        if(!isAuthError(error)) throw error;
        accessToken=await sessionToken(true);
        if(!accessToken) throw new TikTokApiError("access_token_invalid",401);
        capabilities=await getCreatorCapabilities(accessToken);
      }
      if (!Number.isFinite(duration) || duration <= 0 || duration > capabilities.max_video_post_duration_sec) return NextResponse.json({error:"Durasi video tidak sesuai batas akun."},{status:400});
      if (brandContent && !["PUBLIC_TO_EVERYONE","MUTUAL_FOLLOW_FRIENDS"].includes(privacy)) return NextResponse.json({error:"Konten kemitraan berbayar memerlukan visibilitas publik atau teman."},{status:400});
      if (!capabilities.privacy_level_options.includes(privacy) || (capabilities.comment_disabled && !disableComment) || (capabilities.duet_disabled && !disableDuet) || (capabilities.stitch_disabled && !disableStitch)) return NextResponse.json({error:"Pengaturan akun berubah. Muat ulang dan tinjau kembali publikasi."},{status:400});
    }
    let sourceType: string;
    let posterUrl: string | undefined;
    let videoBuffer: Uint8Array | undefined;

    if (typeof videoUrl === "string" && videoUrl.trim() && !file) {
      let valid = false;
      try { const url = new URL(videoUrl); valid = url.protocol === "https:" && !url.username && !url.password; } catch {}
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
        source: sourceType,
      },
      ...(mode === "profile" ? { post_info: {
        title: caption,
        privacy_level: privacy,
        disable_comment: disableComment,
        disable_duet: disableDuet,
        disable_stitch: disableStitch,
        brand_organic_toggle: brandOrganic,
        brand_content_toggle: brandContent,
        is_aigc: isAigc,
      } } : {}),
    };

    if (posterUrl) {
      (initBody.source_info as Record<string, unknown>)[
        "video_url"
      ] = posterUrl;
    }

    if (videoBuffer) Object.assign(initBody.source_info as Record<string, unknown>, { video_size: videoBuffer.length, chunk_size: videoBuffer.length, total_chunk_count: 1 });
    const key = await publicationKey(accessToken, requestId);
    const previous = await reservePublication(key);
    if (previous?.state === "complete") return NextResponse.json(previous.body,{status:previous.status});
    if (previous) return NextResponse.json({error:"Permintaan sebelumnya sedang diproses atau hasilnya belum pasti. Periksa aktivitas TikTok; jangan kirim ulang konten."},{status:409});
    reservationKey = key;
    const initResult = await initPublish(accessToken, initBody, mode);
    const { publish_id, upload_url } = initResult;
    acceptedId = publish_id;

    if (sourceType === "FILE_UPLOAD") {
      if (!upload_url || !videoBuffer || !file) throw new Error("Missing upload information");
      await uploadVideoChunk(upload_url, videoBuffer, file.type);
    }

    const reply = {success:true,publish_id,message:"Upload initiated successfully"};
    try { await finishPublication(reservationKey,reply); } catch { /* Preserve the accepted ID even if storage fails. */ }
    return NextResponse.json(reply);
  } catch (error) {
    console.error("Publication request failed", error instanceof TikTokApiError ? error.code : "unknown");
    if (acceptedId) {
      const reply = {publish_id:acceptedId,warning:"TikTok menerima inisialisasi, tetapi transfer belum terkonfirmasi. Periksa status sebelum mencoba ulang."};
      if (reservationKey) try { await finishPublication(reservationKey,reply,202); } catch { /* Preserve the accepted ID. */ }
      return NextResponse.json(reply,{status:202});
    }
    return NextResponse.json(
      { error: explainTikTok(error,"Publikasi belum dapat dikonfirmasi. Periksa akun TikTok sebelum mencoba ulang.") },
      { status: isAuthError(error) ? 401 : error instanceof TikTokApiError && error.status===400 ? 400 : 502 }
    );
  }
}