#!/usr/bin/python3
"""Read fetched ORIGINAL native JPEGs. No HDC, input injection, or interpolation.

Semantic phases/anchor coordinates must come from inspecting original images.
Without manual annotations, pixel changes are candidates and verdict stays OPEN.
Clock windows describe native commands, not VSync or exact touch/frame instants.
"""
import argparse
import hashlib
import json
import re
import statistics
from decimal import Decimal, InvalidOperation
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageStat

SCENES = {"dir-open", "dir-close", "mode-open", "mode-close", "settings-open", "settings-close"}
LINE = re.compile(r"^(frame-(\d+)|click) start=\[([^]]*)\] end=\[([^]]*)\] exit=(\d+)$")
NUMBER = re.compile(r"^\d+\.\d{9}$")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def stamp(value):
    if not NUMBER.fullmatch(value):
        return None
    try:
        return Decimal(value)
    except InvalidOperation:
        return None


def window(line):
    match = LINE.fullmatch(line.strip())
    if not match:
        return None
    label, ordinal, start, end, code = match.groups()
    start_value, end_value = stamp(start), stamp(end)
    valid = start_value is not None and end_value is not None and end_value >= start_value
    return {"label": label, "index": int(ordinal) if ordinal else None,
            "start": start, "end": end, "exit_code": int(code), "valid_clock_window": valid,
            "command_duration_ms": float((end_value-start_value)*1000) if valid else None}


def rectangle(value, size):
    if value is None:
        return (0, 0, size[0], size[1])
    x, y, width, height = value
    if min(x, y) < 0 or min(width, height) <= 0 or x+width > size[0] or y+height > size[1]:
        raise ValueError("ROI must be inside the original JPEG and use its pixel coordinates")
    return (x, y, x+width, y+height)


def milliseconds(values):
    return {"min": min(values), "median": statistics.median(values), "max": max(values)} if values else None


def contact(frames, directory, destination):
    # Paste each decoded original at 1:1. Label bars are outside its pixels.
    width, height = frames[0]["dimensions"]
    if any(frame["dimensions"] != [width, height] for frame in frames):
        raise ValueError("contact sheet requires equal-size originals; no resizing performed")
    columns, label_height = min(3, len(frames)), 54
    rows = (len(frames)+columns-1)//columns
    canvas = Image.new("RGB", (columns*width, rows*(height+label_height)), "#101010")
    draw = ImageDraw.Draw(canvas)
    for rank, frame in enumerate(frames):
        x, y = rank % columns*width, rank//columns*(height+label_height)
        captured = frame.get("capture") or {}
        draw.text((x+5, y+4), "frame-%s / %s" % (frame["index"], frame["phase"]), fill="white")
        draw.text((x+5, y+20), "%s .. %s" % (captured.get("start", "INVALID"), captured.get("end", "INVALID")), fill="white")
        draw.text((x+5, y+36), "command window; original JPEG below", fill="white")
        with Image.open(directory/frame["filename"]) as original:
            canvas.paste(original.convert("RGB"), (x, y+label_height))
    canvas.save(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--scene", choices=sorted(SCENES), required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--annotations", type=Path)
    parser.add_argument("--roi", type=lambda value: tuple(map(int, value.split(","))))
    parser.add_argument("--scrim-roi", type=lambda value: tuple(map(int, value.split(","))))
    parser.add_argument("--contact", action="store_true")
    args = parser.parse_args()
    if any(value is not None and len(value) != 4 for value in [args.roi,args.scrim_roi]):
        parser.error("ROI is x,y,width,height in the ORIGINAL JPEG coordinate space")
    if args.out.exists():
        parser.error("choose a fresh output directory; originals and prior reports are never overwritten")
    files = sorted(((int(match.group(1)), path) for path in args.directory.glob("frame-*.jpeg")
                    if (match := re.fullmatch(r"frame-(\d+)\.jpeg", path.name))), key=lambda value: value[0])
    if not files:
        parser.error("no original frame-N.jpeg files")
    lines = (args.directory/"timestamps.txt").read_text().splitlines() if (args.directory/"timestamps.txt").exists() else []
    captures, invalid_lines, duplicates = {}, [], []
    for line in lines:
        parsed = window(line)
        if parsed is None or parsed["index"] is None:
            invalid_lines.append(line)
        elif parsed["index"] in captures:
            duplicates.append(parsed["index"])
        else:
            captures[parsed["index"]] = parsed
    click_text = (args.directory/"click-time.txt").read_text().strip() if (args.directory/"click-time.txt").exists() else ""
    click = window(click_text)
    annotations = json.loads(args.annotations.read_text()) if args.annotations else {"frames": {}}
    if annotations.get("scene", args.scene) != args.scene:
        parser.error("annotations must belong to this exact scene")
    manual = annotations.get("frames", {})
    frames, problems, dimension = [], [], None
    with Image.open(files[0][1]) as original:
        baseline = original.convert("RGB")
        dimension = baseline.size
        roi = rectangle(args.roi, dimension)
        scrim_roi = rectangle(args.scrim_roi, dimension) if args.scrim_roi else None
        baseline = baseline.crop(roi)
    with Image.open(files[-1][1]) as original:
        last = original.convert("RGB")
        if last.size != dimension:
            parser.error("original JPEG sizes differ; cannot compare without altering them")
        last = last.crop(roi)
    for index, path in files:
        with Image.open(path) as original:
            rgb = original.convert("RGB")
            if rgb.size != dimension:
                parser.error("original JPEG sizes differ")
            cropped = rgb.crop(roi)
            fact = manual.get(str(index), {})
            for y in fact.get("anchor_y", {}).values():
                if not isinstance(y,(int,float)) or not 0 <= y < dimension[1]:
                    parser.error("all anchors must use original JPEG y pixels")
            phase = fact.get("phase", "unreviewed")
            if phase not in {"closed", "middle", "open", "unreviewed"}:
                parser.error("phase must be closed/middle/open/unreviewed")
            captured = captures.get(index)
            if not captured or not captured["valid_clock_window"] or captured["exit_code"] != 0:
                problems.append("frame-%s capture window missing/invalid/nonzero" % index)
            frames.append({"index": index, "filename": path.name, "dimensions": list(rgb.size),
                           "jpeg_sha256": sha(path.read_bytes()), "rgb_sha256": sha(rgb.tobytes()),
                           "roi_sha256": sha(cropped.tobytes()), "phase": phase, "annotation": fact,
                           "capture": captured,
                           "roi_mean_absolute_rgb_difference_from_first": sum(ImageStat.Stat(ImageChops.difference(cropped, baseline)).mean)/3,
                           "roi_mean_absolute_rgb_difference_from_last": sum(ImageStat.Stat(ImageChops.difference(cropped, last)).mean)/3})
            if scrim_roi:
                means=ImageStat.Stat(rgb.crop(scrim_roi)).mean
                frames[-1]["scrim_roi_mean_rgb"]=means
                frames[-1]["scrim_roi_luma_proxy"]=sum(channel*weight for channel,weight in zip(means,[.299,.587,.114]))
    if click is None or not click["valid_clock_window"] or click["exit_code"] != 0:
        problems.append("click command window missing/invalid/nonzero")
    if invalid_lines or duplicates:
        problems.append("unparsed or duplicate frame timestamp lines")
    if click and click["valid_clock_window"]:
        for frame in frames:
            captured = frame.get("capture")
            if captured and captured["valid_clock_window"]:
                # Request intervals relative to unknown input time within CLI call.
                # No claim that displayed pixels were committed inside this interval.
                frame["capture_request_relative_to_click_command_ms"] = [
                    float((stamp(captured["start"])-stamp(click["end"]))*1000),
                    float((stamp(captured["end"])-stamp(click["start"]))*1000)]
    starts = [(frame["index"], stamp(frame["capture"]["start"])) for frame in frames
              if frame.get("capture") and frame["capture"]["valid_clock_window"]]
    request_order_differs = any(right[1] < left[1] for left, right in zip(starts, starts[1:]))
    # Parallel request windows may overlap; neither file ordinal nor start-time
    # sorting tells us the actual order in which the compositor buffers were read.
    overlap_groups=[]
    for frame in sorted((frame for frame in frames if frame.get("capture") and frame["capture"]["valid_clock_window"]),
                        key=lambda frame:stamp(frame["capture"]["start"])):
        captured=frame["capture"]
        if overlap_groups and stamp(captured["start"]) <= stamp(overlap_groups[-1]["end"]):
            overlap_groups[-1]["indices"].append(frame["index"])
            if stamp(captured["end"]) > stamp(overlap_groups[-1]["end"]):
                overlap_groups[-1]["end"]=captured["end"]
        else:
            overlap_groups.append({"indices":[frame["index"]],"start":captured["start"],"end":captured["end"]})
    groups = []
    for frame in frames:
        if groups and groups[-1]["roi_sha256"] == frame["roi_sha256"]:
            groups[-1]["indices"].append(frame["index"])
        else:
            groups.append({"roi_sha256": frame["roi_sha256"], "indices": [frame["index"]]})
    opening = args.scene.endswith("open")
    expected_first, expected_last = ("closed", "open") if opening else ("open", "closed")
    reference = frames[-1] if opening else frames[0]
    movement, observed = [], []
    for frame in frames:
        if frame["phase"] != "middle":
            continue
        anchors, endpoint = frame["annotation"].get("anchor_y", {}), reference["annotation"].get("anchor_y", {})
        keys = sorted(set(anchors)&set(endpoint))
        if any(not isinstance(anchors[key], (int, float)) or not 0 <= anchors[key] < dimension[1] for key in keys):
            parser.error("anchors must use original JPEG y pixels")
        shifts = [anchors[key]-endpoint[key] for key in keys]
        valid = len(shifts) >= 2 and max(shifts)-min(shifts) <= 2 and abs(statistics.mean(shifts)) >= 1
        valid = valid and frame["roi_sha256"] not in {frames[0]["roi_sha256"], frames[-1]["roi_sha256"]}
        movement.append({"frame": frame["index"], "anchor_keys": keys, "y_displacements_to_reference": shifts,
                         "at_least_two_anchors_co_translate": valid,
                         "content_visible_manual": frame["annotation"].get("content_visible") is True})
        if valid:
            observed.append(frame["index"])
    endpoints = frames[0]["phase"] == expected_first and frames[-1]["phase"] == expected_last
    middle_evidence = endpoints and bool(observed)
    retention = not opening and middle_evidence and any(value["at_least_two_anchors_co_translate"] and value["content_visible_manual"] for value in movement)
    durations = [frame["capture"]["command_duration_ms"] for frame in frames if frame.get("capture") and frame["capture"]["valid_clock_window"]]
    output = {"scene": args.scene, "source_directory": str(args.directory.resolve()),
              "original_dimensions": list(dimension), "roi": list(roi), "frame_count": len(frames),
              "click": click, "command_window_problems": problems, "invalid_lines": invalid_lines, "duplicate_indices": duplicates,
              "capture_command_duration_ms": milliseconds(durations), "file_ordinal_pixel_groups": groups,
              "request_start_order_differs_from_file_ordinal":request_order_differs,
              "capture_request_start_order":[index for index,time in sorted(starts,key=lambda value:value[1])],
              "overlap_groups":overlap_groups,
              "manual_anchor_movement": movement, "frames": frames,
              "transition_existence": "OBSERVED_REAL_MIDDLE_POSITION" if middle_evidence else "OPEN",
              "exit_content_retention": "OBSERVED_CONTENT_IN_EXIT_MIDDLE" if retention else "OPEN" if not opening else "NOT_APPLICABLE",
              "timing_window_integrity": "VALID_COMMAND_WINDOWS" if not problems else "OPEN",
              "actual_curve_duration_scrim_equivalence": "OPEN",
              "boundary": "Command wall-clock windows are not exact input/VSync/present timestamps. Native snapshot calls can serialize, reuse a committed buffer and perturb rendering. Pixel differences alone are not semantic motion; original-image inspection and declared anchors are required. No interpolated frames, UI reconstruction, font-paint or curve pass is produced."}
    if scrim_roi:
        output["scrim_roi"]=list(scrim_roi)
        first_luma,last_luma=frames[0]["scrim_roi_luma_proxy"],frames[-1]["scrim_roi_luma_proxy"]
        output["nonendpoint_scrim_luma_candidates"]=[frame["index"] for frame in frames
            if min(first_luma,last_luma)+1 < frame["scrim_roi_luma_proxy"] < max(first_luma,last_luma)-1]
        output["scrim_proxy_boundary"]="Candidates only: verify this is the same static underlying image region, above sheet/shadow and other changing controls. Luma changes cannot alone prove scrim fade or its timing."
    args.out.mkdir(parents=True)
    (args.out/"report.json").write_text(json.dumps(output, indent=2, ensure_ascii=False)+"\n")
    if args.contact:
        contact(frames, args.directory, args.out/"original-contact.png")
    print(json.dumps({"scene": args.scene, "frames": len(frames), "pixel_groups": len(groups),
                      "transition_existence": output["transition_existence"], "timing_window_integrity": output["timing_window_integrity"],
                      "capture_command_duration_ms": output["capture_command_duration_ms"], "report": str(args.out/"report.json")}, indent=2))


if __name__ == "__main__":
    main()
