"""Read-only diagnostic for the existing Sandbox acceptance video; no API calls."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

VIDEO = Path(r"F:\TOY4U\test_upload.mp4")
EXPECTED_SHA256 = "dc71c7dc5583256ed3aeb97c42a8867c010c34a8231a68b08b4415f146432958"


def inspect(path=VIDEO, expected_sha256=EXPECTED_SHA256):
    report = {"state": "BLOCKED", "file": str(path), "expected_sha256": expected_sha256,
              "visual_playback_verified": False, "tiktok_playback_verified": False,
              "publication_calls": 0}
    try:
        if not path.is_file():
            report["blocker"] = "Original file unavailable"
            return report
        data = path.read_bytes()
        report.update(size=len(data), sha256=hashlib.sha256(data).hexdigest())
        if report["sha256"] != expected_sha256:
            report["blocker"] = "File does not match the originally reviewed SHA-256"
            return report
        probe, ffmpeg = shutil.which("ffprobe"), shutil.which("ffmpeg")
        if not probe or not ffmpeg:
            report["blocker"] = "Existing ffprobe/ffmpeg not found; do not install automatically"
            return report
        metadata = subprocess.run([probe, "-v", "error", "-protocol_whitelist", "file,pipe", "-show_streams", "-show_format", "-of", "json", str(path)], capture_output=True, text=True, timeout=60)
        if metadata.returncode:
            report["blocker"] = "ffprobe failed"
            report["probe_error"] = metadata.stderr.strip()[:2000]
            return report
        parsed = json.loads(metadata.stdout)
        fields = ("codec_type", "codec_name", "profile", "level", "pix_fmt", "width", "height", "r_frame_rate", "avg_frame_rate", "time_base", "start_time", "duration", "nb_frames", "sample_rate", "channels", "color_space", "color_range", "color_transfer", "color_primaries")
        report["streams"] = [{k: s[k] for k in fields if k in s} for s in parsed.get("streams", [])]
        report["format"] = {k: parsed["format"][k] for k in ("format_name", "duration", "start_time", "size", "bit_rate") if k in parsed.get("format", {})}
        if not any(s.get("codec_type") == "video" for s in report["streams"]):
            report["blocker"] = "No video stream"
            return report
        decode = subprocess.run([ffmpeg, "-nostdin", "-v", "error", "-xerror", "-protocol_whitelist", "file,pipe", "-i", str(path), "-map", "0:v", "-map", "0:a?", "-f", "null", "-"], capture_output=True, text=True, timeout=120)
        report["decode_returncode"] = decode.returncode
        report["decode_errors"] = decode.stderr.strip()[:2000]
        report["sha256_after"] = hashlib.sha256(path.read_bytes()).hexdigest()
        if report["sha256_after"] != expected_sha256:
            report["blocker"] = "File changed during diagnostic"
        elif decode.returncode or decode.stderr.strip():
            report["blocker"] = "Full decode reported errors"
            report["state"] = "DECODE_FAILED"
        else:
            report["state"] = "TECHNICAL_DECODE_PASSED"
    except (OSError, ValueError, subprocess.TimeoutExpired) as exc:
        report["blocker"] = type(exc).__name__
    return report


if __name__ == "__main__":
    print(json.dumps(inspect(), indent=2))
