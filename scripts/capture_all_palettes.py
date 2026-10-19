import subprocess
import shutil
import os
import time

EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
TEMP_DIR = r"C:\Users\ASUS\AppData\Local\Temp"
OUT_DIR = r"C:\Users\ASUS\OneDrive\Desktop\cyber desk\docs\screenshots"

os.makedirs(OUT_DIR, exist_ok=True)

SCREENS = [
    ("home", "home"),
    ("servers", "cluster_health"),
    ("incidents", "incidents"),
    ("costs", "costs"),
    ("deploy", "deploy"),
    ("companion", "weather_clock"),
    ("focusTimer", "focus_timer"),
    ("settings", "settings"),
]

THEMES = ["night", "day"]

for theme in THEMES:
    print(f"\n--- CAPTURING {theme.upper()} PALETTE ---")
    for screen_id, file_prefix in SCREENS:
        sky_param = "&sky=day" if (theme == "day" and screen_id == "companion") else ""
        url = f"http://127.0.0.1:5173/screen_capture.html?screen={screen_id}&view=overview&theme={theme}{sky_param}"
        temp_shot = os.path.join(TEMP_DIR, f"cap_{screen_id}_{theme}.png")
        final_filename = f"{file_prefix}_{theme}.png"
        final_shot = os.path.join(OUT_DIR, final_filename)

        print(f"Capturing [{screen_id}] -> {final_filename}...", flush=True)

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
            print(f"  [OK] Saved {final_filename} ({size} bytes)", flush=True)
        else:
            print(f"  [ERR] Failed: {res.returncode}", flush=True)

print("\nAll Day and Night screenshots captured successfully.", flush=True)
