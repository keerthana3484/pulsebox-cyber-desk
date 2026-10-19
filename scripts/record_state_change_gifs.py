import os
import subprocess
import tempfile
import shutil
from PIL import Image

EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
TEMP_DIR = tempfile.gettempdir()
DOCS_SCREENSHOTS_DIR = r"C:\Users\ASUS\OneDrive\Desktop\cyber desk\docs\screenshots"
DOCS_ANIMATIONS_DIR = r"C:\Users\ASUS\OneDrive\Desktop\cyber desk\docs\animations"

os.makedirs(DOCS_SCREENSHOTS_DIR, exist_ok=True)
os.makedirs(DOCS_ANIMATIONS_DIR, exist_ok=True)

ANIMATIONS = [
    {
        "id": "screen_transition",
        "title": "Screen Transition (8-Step Chunky Block Wipe)",
        "frames": 9,
        "duration": 180,  # ms per frame
        "filename": "screen_transition.gif",
    },
    {
        "id": "incident_trigger",
        "title": "Incident Trigger (Nominal -> Worried PulseBot + Outage Alert)",
        "frames": 5,
        "duration": 650,  # ms per frame
        "filename": "incident_trigger.gif",
    },
    {
        "id": "recovery_trigger",
        "title": "Recovery Trigger (Restoring -> Celebrating PulseBot with Party Hat & Confetti)",
        "frames": 5,
        "duration": 650,  # ms per frame
        "filename": "recovery_trigger.gif",
    },
    {
        "id": "focus_session_levelup",
        "title": "Focus Session Level-Up (00:00 Fanfare + Session Increment)",
        "frames": 4,
        "duration": 700,  # ms per frame
        "filename": "focus_session_levelup.gif",
    },
    {
        "id": "idle_animation_6fps",
        "title": "Idle Animation at 6 FPS (Antenna Beacon Pulse + Eye Blink)",
        "frames": 6,
        "duration": 166,  # 166ms per frame = 6.02 FPS
        "filename": "idle_animation_6fps.gif",
    },
    {
        "id": "double_tap_wake",
        "title": "Double-Tap Wake (Standby -> Tap 1 Feedback -> Tap 2 Wake Animation -> Restored)",
        "frames": 5,
        "duration": 700,  # ms per frame
        "filename": "double_tap_wake.gif",
    },
]

def record_animation(anim_cfg):
    anim_id = anim_cfg["id"]
    title = anim_cfg["title"]
    num_frames = anim_cfg["frames"]
    duration_ms = anim_cfg["duration"]
    filename = anim_cfg["filename"]

    print(f"\n=======================================================", flush=True)
    print(f"Recording: {title} ({num_frames} frames @ {duration_ms}ms/frame)...", flush=True)

    frame_images = []
    temp_files = []

    for f in range(num_frames):
        url = f"http://127.0.0.1:5173/state_anim_capture.html?anim={anim_id}&frame={f}"
        shot_path = os.path.join(TEMP_DIR, f"pulsebox_anim_{anim_id}_{f}.png")
        temp_files.append(shot_path)
        frame_udir = tempfile.mkdtemp(prefix=f"edge_frame_{anim_id}_{f}_")

        cmd = [
            EDGE_EXE,
            "--headless",
            "--no-sandbox",
            "--disable-gpu",
            "--hide-scrollbars",
            f"--user-data-dir={frame_udir}",
            "--run-all-compositor-stages-before-draw",
            "--window-size=320,240",
            f"--screenshot={shot_path}",
            url,
        ]

        captured = False
        for attempt in range(2):
            try:
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=12)
                if os.path.exists(shot_path):
                    captured = True
                    break
            except subprocess.TimeoutExpired:
                print(f"  [RETRY] Frame {f} attempt {attempt+1} timed out, retrying...", flush=True)

        # Cleanup isolated temp profile
        shutil.rmtree(frame_udir, ignore_errors=True)

        if not captured or not os.path.exists(shot_path):
            print(f"  [ERR] Failed to capture frame {f}", flush=True)
            continue

        try:
            im = Image.open(shot_path).convert("RGBA")
            # Ensure strict 320x240 dimensions
            if im.size != (320, 240):
                im = im.crop((0, 0, 320, 240))
            # Quantize to adaptive palette with max 64 colors for crisp voxel look
            im_pal = im.convert("P", palette=Image.ADAPTIVE, colors=64)
            frame_images.append(im_pal)
            print(f"  [OK] Captured frame {f+1}/{num_frames} ({im.size[0]}x{im.size[1]})", flush=True)
        except Exception as e:
            print(f"  [ERR] Failed to process image frame {f}: {e}", flush=True)

    if not frame_images:
        print(f"  [FAIL] No frames captured for {anim_id}!", flush=True)
        return False

    # Save to docs/screenshots
    dest1 = os.path.join(DOCS_SCREENSHOTS_DIR, filename)
    dest2 = os.path.join(DOCS_ANIMATIONS_DIR, filename)

    frame_images[0].save(
        dest1,
        save_all=True,
        append_images=frame_images[1:],
        duration=duration_ms,
        loop=0,
        optimize=True,
    )
    shutil.copy(dest1, dest2)

    size_kb = os.path.getsize(dest1) / 1024.0
    print(f"  >>> SUCCESS: Saved GIF to {dest1} ({size_kb:.1f} KB, {len(frame_images)} frames)", flush=True)

    # Clean up temp frames
    for tf in temp_files:
        if os.path.exists(tf):
            try:
                os.remove(tf)
            except:
                pass

    return True

if __name__ == "__main__":
    success_count = 0
    for anim in ANIMATIONS:
        if record_animation(anim):
            success_count += 1

    print(f"\n=======================================================", flush=True)
    print(f"RECORDING SUMMARY: {success_count}/{len(ANIMATIONS)} GIFs successfully recorded!", flush=True)
    print(f"Output directories:\n  - {DOCS_SCREENSHOTS_DIR}\n  - {DOCS_ANIMATIONS_DIR}", flush=True)
