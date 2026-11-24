import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { APP_CONFIG } from "@/config/app";
import { initPublish, uploadVideoChunk } from "@/lib/tiktok";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(APP_CONFIG.cookieNames.accessToken)?.value;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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

    let sourceType: string;
    let posterUrl: string | undefined;
    let videoBuffer: Uint8Array | undefined;

    if (mode === "inbox") {
      if (!videoUrl) {
        return NextResponse.json(
          { error: "Video URL is required for inbox mode" },
          { status: 400 }
        );
      }
      sourceType = "PULL_FROM_URL";
      posterUrl = videoUrl;
    } else {
      if (!file) {
        return NextResponse.json(
          { error: "Video file is required for profile mode" },
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
      video_metadata: {
        title: caption,
        privacy_level: privacy,
        disable_comment: disableComment,
        disable_duet: disableDuet,
        disable_stitch: disableStitch,
      },
    };

    if (posterUrl) {
      (initBody.source_info as Record<string, unknown>)[
        "poster_url"
      ] = posterUrl;
    }

    const initResult = await initPublish(accessToken, initBody);
    const { publish_id, upload_url } = initResult;

    if (sourceType === "FILE_UPLOAD" && upload_url && videoBuffer) {
      await uploadVideoChunk(upload_url, videoBuffer, "video/mp4");
    }

    return NextResponse.json({
      success: true,
      publish_id,
      upload_url,
      message: "Upload initiated successfully",
    });
  } catch (error) {
    console.error("Publish error:", error);
    return NextResponse.json(
      { error: "Failed to initiate publish" },
      { status: 500 }
    );
  }
}