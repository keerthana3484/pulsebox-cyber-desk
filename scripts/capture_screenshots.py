import subprocess
import shutil
import time
import os

EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
TEMP_DIR = r"C:\Users\ASUS\AppData\Local\Temp"
OUT_DIR = r"C:\Users\ASUS\OneDrive\Desktop\cyber desk\docs\screenshots"

os.makedirs(OUT_DIR, exist_ok=True)

SCREENS = [
    ("home", "overview", "home_overview.png"),
    ("home", "detail", "home_detail.png"),
    ("servers", "overview", "cluster_health_overview.png"),
    ("servers", "detail", "cluster_health_detail.png"),
    ("incidents", "overview", "incidents_overview.png"),
    ("incidents", "detail", "incidents_detail.png"),
    ("costs", "overview", "costs_overview.png"),
    ("costs", "detail", "costs_detail.png"),
    ("deploy", "overview", "deploy_overview.png"),
    ("deploy", "detail", "deploy_detail.png"),
    ("companion", "overview", "weather_clock_overview.png"),
    ("companion", "overview&sky=day", "weather_clock_day_overview.png"),
    ("companion", "detail", "weather_clock_detail.png"),
    ("focusTimer", "overview", "focus_timer_overview.png"),
    ("focusTimer", "detail", "focus_timer_detail.png"),
    ("settings", "overview", "settings_overview.png"),
    ("settings", "detail", "settings_detail.png"),
]

for screen_id, view_mode, filename in SCREENS:
    url = f"http://127.0.0.1:5173/screen_capture.html?screen={screen_id}&view={view_mode}"
    temp_shot = os.path.join(TEMP_DIR, f"cap_{screen_id}_{view_mode}.png")
    final_shot = os.path.join(OUT_DIR, filename)

    print(f"Capturing [{screen_id} - {view_mode}] -> {filename}...", flush=True)

    cmd = [
        EDGE_EXE,
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        "--hide-scrollbars",
        "--window-size=320,240",
        f"--screenshot={temp_shot}",
        url,
    ]

    res = subprocess.run(cmd, capture_output=True, text=True)

    if os.path.exists(temp_shot):
        shutil.copy(temp_shot, final_shot)
        size = os.path.getsize(final_shot)
        print(f"  [OK] Saved {filename} ({size} bytes)", flush=True)
    else:
        print(f"  [ERR] Failed to capture {filename}: returncode {res.returncode}, stderr: {res.stderr}", flush=True)

print("\nAll screenshot captures completed.", flush=True)
