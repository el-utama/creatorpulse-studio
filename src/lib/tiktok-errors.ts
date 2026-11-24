// Only show known, actionable upstream codes; never expose raw response bodies.
export class TikTokApiError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
const messages: Record<string,string> = {
  account_changed:"Akun yang terhubung berubah. Muat ulang dasbor sebelum mempublikasikan.",
  access_token_invalid:"Sesi TikTok berakhir. Hubungkan kembali akun.",
  scope_not_authorized:"Akun belum memberi izin yang diperlukan untuk fitur ini.",
  url_ownership_unverified:"Domain atau awalan URL video belum diverifikasi oleh TikTok. Gunakan sumber terverifikasi atau file lokal.",
  invalid_param:"TikTok menolak parameter video atau publikasi. Periksa kembali pengaturan.",
  privacy_level_option_mismatch:"Visibilitas tidak sesuai pilihan akun TikTok. Muat ulang pengaturan.",
  spam_risk_too_many_posts:"Batas publikasi TikTok tercapai. Coba lagi nanti.",
  spam_risk_too_many_pending_share:"Terlalu banyak video menunggu di inbox TikTok. Selesaikan draft terlebih dahulu.",
  rate_limit_exceeded:"Batas permintaan TikTok tercapai. Coba lagi nanti.",
  unaudited_client_can_only_post_to_private_accounts:"TikTok membatasi publikasi dari aplikasi yang belum diaudit.",
  video_format_check_failed:"Format video ditolak TikTok.",
  duration_check_failed:"Durasi video tidak memenuhi ketentuan TikTok.",
  file_format_check_failed:"Format file tidak memenuhi ketentuan TikTok.",
  video_pull_failed:"TikTok gagal mengambil video dari URL. Periksa akses publik tautan.",
  picture_size_check_failed:"Ukuran media tidak memenuhi ketentuan TikTok.",
  publish_cancelled:"Publikasi dibatalkan.",
};
export async function readTikTok<T>(res: Response): Promise<T> {
  const result = await res.json().catch(()=>null);
  if (!res.ok || result?.error?.code !== "ok") {
    const code = typeof result?.error?.code === "string" && /^[a-z0-9_]{1,100}$/.test(result.error.code) ? result.error.code : "upstream_error";
    throw new TikTokApiError(code,res.status);
  }
  if (!result.data) throw new TikTokApiError("upstream_error",502);
  return result.data as T;
}
export function isAuthError(error: unknown) {return error instanceof TikTokApiError && (error.status===401 || error.code==="access_token_invalid");}
export function explainTikTok(error: unknown, fallback: string) {
  return error instanceof TikTokApiError ? (messages[error.code] ?? fallback) + (error.code==="upstream_error"?"":` (TikTok: ${error.code})`) : fallback;
}
export function explainFailure(code: unknown) {
  if (typeof code !== "string" || !/^[a-z0-9_]{1,100}$/.test(code)) return "TikTok tidak memberikan alasan kegagalan yang dapat ditampilkan.";
  return (messages[code] ?? "TikTok melaporkan kegagalan publikasi.") + ` (TikTok: ${code})`;
}
