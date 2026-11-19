"""Whiteboard "hand drawing" animation, v2.

usage: python3 wb2.py scene.png hand.png out.mp4 [--number 1] [--seconds 15] [--start 0.2,0.25]

- Lines are drawn stroke by stroke (skeleton split at junctions), pen tip exactly on the line,
  quick hand travel between strokes.
- Colors are scribbled in, region by region, with a hatching brush the hand follows.
- The number is drawn the same way, after the scene.
- The forearm is extended by repeating its own skin texture along the arm axis (no stretching).
"""
import argparse, subprocess
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
from skimage.morphology import skeletonize

W, H, FPS = 1920, 1080, 30
NB8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def fit(im, box_w=W, box_x=0):
    # trim white margins, then fit into a box of width box_w (left at box_x) with padding
    nz = np.nonzero(im.min(axis=2) < 240)
    if len(nz[0]):
        y0, y1, x0, x1 = nz[0].min(), nz[0].max(), nz[1].min(), nz[1].max()
        im = im[max(y0 - 20, 0):y1 + 21, max(x0 - 20, 0):x1 + 21] if box_w < W else im
    s = min(box_w / im.shape[1], H / im.shape[0]) * (0.92 if box_w < W else 1.0)
    im = cv2.resize(im, (round(im.shape[1] * s), round(im.shape[0] * s)), interpolation=cv2.INTER_AREA)
    c = np.full((H, W, 3), 255, np.uint8)
    y, x = (H - im.shape[0]) // 2, box_x + (box_w - im.shape[1]) // 2
    c[y:y + im.shape[0], x:x + im.shape[1]] = im
    return c


def number_rgba(text, height=470):
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", height)
    img = Image.new("RGBA", (int(height * 0.8) * len(text) + 120, int(height * 1.35)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    depth = 26
    for off in range(depth, 0, -1):
        d.text((30 + off, 20 + off), text, font=font, fill=(120, 120, 124, 255))
    d.text((30 + depth, 20 + depth), text, font=font, fill=(0, 0, 0, 0), stroke_width=7, stroke_fill=(0, 0, 0, 255))
    d.text((30, 20), text, font=font, fill=(206, 17, 38, 255), stroke_width=7, stroke_fill=(0, 0, 0, 255))
    a = np.array(img)
    ys, xs = np.nonzero(a[..., 3])
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def line_alpha(img):
    """How much each pixel is black marker ink (0..1). Grey anti-aliasing counts only next to real lines."""
    f = img.astype(np.float32)
    mx, mn = f.max(axis=2), f.min(axis=2)
    strong = np.clip((130 - mx) / 70, 0, 1)
    near = cv2.dilate((strong > 0.5).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    soft = np.clip((235 - mx) / 150, 0, 1) * ((mx - mn) < 45) * near
    return np.maximum(strong, soft)


def strokes(mask):
    """Split the skeleton of mask into ordered pixel chains (strokes)."""
    sk = skeletonize(mask).astype(np.uint8)
    k = np.ones((3, 3), np.uint8)
    deg = cv2.filter2D(sk, -1, k, borderType=cv2.BORDER_CONSTANT) - 1
    junc = (sk > 0) & (deg >= 3)
    seg = (sk > 0) & ~cv2.dilate(junc.astype(np.uint8), k).astype(bool)
    n, lab = cv2.connectedComponents(seg.astype(np.uint8), connectivity=8)
    out = []
    ys, xs = np.nonzero(lab)
    order = np.argsort(lab[ys, xs], kind="stable")
    ys, xs, ls = ys[order], xs[order], lab[ys, xs][order]
    bounds = np.searchsorted(ls, np.arange(1, n + 1))
    for i in range(1, n):
        a, b = bounds[i - 1], bounds[i]
        if b - a < 6:
            continue
        pts = set(zip(ys[a:b].tolist(), xs[a:b].tolist()))
        nbrs = lambda p: [(p[0] + dy, p[1] + dx) for dy, dx in NB8 if (p[0] + dy, p[1] + dx) in pts]
        ends = [p for p in pts if len(nbrs(p)) <= 1]
        p = ends[0] if ends else next(iter(pts))
        chain, seen = [p], {p}
        while True:
            nx = [q for q in nbrs(p) if q not in seen]
            if not nx:
                rest = pts - seen
                if not rest:
                    break
                p = min(rest, key=lambda q: abs(q[0] - p[0]) + abs(q[1] - p[1]))
            else:
                nx.sort(key=lambda q: abs(q[0] - p[0]) + abs(q[1] - p[1]))  # prefer 4-neighbours
                p = nx[0]
            seen.add(p)
            chain.append(p)
        out.append(np.array(chain, np.float32))
    return out, sk


def order_strokes(chains, start):
    """Greedy nearest-endpoint ordering; flips a chain so it starts at the end closest to the pen."""
    left = list(range(len(chains)))
    starts = np.array([c[0] for c in chains]); ends = np.array([c[-1] for c in chains])
    cur = np.array(start, np.float32)
    res = []
    while left:
        L = np.array(left)
        ds = np.abs(starts[L] - cur).sum(1); de = np.abs(ends[L] - cur).sum(1)
        j = int(np.argmin(np.minimum(ds, de)))
        i = left.pop(j)
        c = chains[i] if ds[j] <= de[j] else chains[i][::-1]
        res.append(c)
        cur = c[-1]
    return res


class Timeline:
    """Pen keyframes (t, y, x) and per-pixel reveal times."""
    def __init__(self):
        self.keys = []

    def pen(self, t):
        k = self.keys
        if not k or t < k[0][0] or t > k[-1][0]:
            return None
        i = np.searchsorted(self.kt, t)
        i = min(max(i, 1), len(k) - 1)
        t0, y0, x0 = k[i - 1]; t1, y1, x1 = k[i]
        u = 0 if t1 == t0 else (t - t0) / (t1 - t0)
        return np.array([x0 + (x1 - x0) * u, y0 + (y1 - y0) * u])

    def done(self):
        self.kt = np.array([k[0] for k in self.keys])


def plan_lines(chains, t0, t1, tl, travel_speed=2600.0):
    total = sum(len(c) for c in chains)
    gaps = [np.abs(chains[i][0] - chains[i - 1][-1]).sum() for i in range(1, len(chains))]
    travel = sum(max(0.04, g / travel_speed) for g in gaps)
    speed = total / max((t1 - t0) - travel, 0.5)  # skeleton px per second
    t = t0
    pts, times = [], []
    for i, c in enumerate(chains):
        if i:
            t += max(0.04, gaps[i - 1] / travel_speed)
        n = len(c)
        ts = t + np.arange(n) / speed
        step = max(1, n // 40)
        for j in list(range(0, n, step)) + [n - 1]:
            tl.keys.append((ts[j], c[j][0], c[j][1]))
        pts.append(c); times.append(ts)
        t = ts[-1]
    return np.concatenate(pts), np.concatenate(times), t


def pixel_times(shape, pts, times):
    """Each pixel gets the time of the nearest skeleton point."""
    src = np.full(shape, 255, np.uint8)
    yi, xi = pts[:, 0].astype(int), pts[:, 1].astype(int)
    src[yi, xi] = 0
    _, lab = cv2.distanceTransformWithLabels(src, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    tmap = np.zeros(lab.max() + 1, np.float32)
    tmap[lab[yi, xi]] = times
    return tmap[lab]


def plan_colors(regions, t0, t1, tl, step=22):
    """regions: list of (mask_bool, bbox). Hatch each region left-right, row by row."""
    tm = np.full((H, W), np.inf, np.float32)
    weights = [max(np.sqrt(m.sum()), 12) for m, _ in regions]
    gap = min(0.08, 0.25 * (t1 - t0) / max(len(regions), 1))
    scale = (t1 - t0 - gap * len(regions)) / max(sum(weights), 1)
    t = t0
    for (m, (x, y, w, h)), wt in zip(regions, weights):
        dur = wt * scale
        rows = max(1, int(np.ceil(h / step)))
        yy, xx = np.nonzero(m[y:y + h, x:x + w])
        r = yy // step
        u = xx / max(w - 1, 1)
        u = np.where(r % 2 == 1, 1 - u, u)
        p = (r + u) / rows
        tm[yy + y, xx + x] = t + p * dur
        for k in range(rows * 6 + 1):
            pk = k / (rows * 6)
            rk = min(int(pk * rows), rows - 1); uk = pk * rows - rk
            if rk % 2:
                uk = 1 - uk
            tl.keys.append((t + pk * dur, y + rk * step + step / 2, x + uk * (w - 1)))
        t += dur + gap
    return tm, t


def load_hand(path, height):
    im = cv2.imread(path)
    h, w = im.shape[:2]
    nw = (im.min(axis=2) > 225).astype(np.uint8)
    n, lab = cv2.connectedComponents(nw, connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    alpha = (~(np.isin(lab, list(border)) & (nw > 0))).astype(np.uint8) * 255
    alpha = cv2.GaussianBlur(cv2.erode(alpha, np.ones((3, 3), np.uint8)), (5, 5), 0)
    ys, xs = np.nonzero(alpha > 128)
    k = np.argmin(xs + 0.2 * ys)
    tip = np.array([xs[k], ys[k]], np.float32)
    # forearm axis from the far half of the hand
    d = np.hypot(xs - tip[0], ys - tip[1])
    far = d > np.percentile(d, 70)
    pts = np.stack([xs[far], ys[far]], 1).astype(np.float32)
    mean = pts.mean(0)
    _, _, vt = np.linalg.svd(pts - mean, full_matrices=False)
    axis = vt[0] if np.dot(vt[0], mean - tip) > 0 else -vt[0]
    # extend: repeat a real skin band along the axis (band kept 40px inside the image edge)
    P, L = 1600, 150.0
    yy, xx = np.mgrid[0:h + P, 0:w + P].astype(np.float32)
    sx, sy = xx.copy(), yy.copy()
    for _ in range(40):
        out = (sx > w - 40) | (sy > h - 40)
        if not out.any():
            break
        sx = np.where(out, sx - L * axis[0], sx); sy = np.where(out, sy - L * axis[1], sy)
    sxi = np.clip(sx, 0, w - 1).astype(np.float32); syi = np.clip(sy, 0, h - 1).astype(np.float32)
    rgb = cv2.remap(cv2.cvtColor(im, cv2.COLOR_BGR2RGB), sxi, syi, cv2.INTER_LINEAR)
    al = cv2.remap(alpha, sxi, syi, cv2.INTER_LINEAR)
    # smooth the repeated arm outline along the arm axis (removes the saw-tooth edge)
    ks = int(L * 1.5) | 1
    ker = np.zeros((ks, ks), np.float32)
    c = ks // 2
    for i in range(-c, c + 1):
        ker[int(round(c + i * axis[1])), int(round(c + i * axis[0]))] = 1
    ker /= ker.sum()
    sm = cv2.filter2D(al.astype(np.float32), -1, ker, borderType=cv2.BORDER_REPLICATE)
    sm = np.clip((sm - 128) * 3 + 128, 0, 255)
    ext = ((xx > w - 60) | (yy > h - 60)).astype(np.float32)
    ext = cv2.GaussianBlur(ext, (0, 0), 20)
    al = (al * (1 - ext) + sm * ext).astype(np.uint8)
    s = height / h
    size = (round((w + P) * s), round((h + P) * s))
    rgb = cv2.resize(rgb, size, interpolation=cv2.INTER_AREA)
    al = cv2.resize(al, size, interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    shadow = cv2.GaussianBlur(al, (0, 0), 14) * 0.28
    return rgb, al, shadow, (tip * s).astype(int)


def over(frame, rgb, a, x, y, shadow=None, sdx=26, sdy=30):
    def blit(src_a, src_rgb, ox, oy):
        h, w = src_a.shape
        x0, y0, x1, y1 = max(ox, 0), max(oy, 0), min(ox + w, W), min(oy + h, H)
        if x0 >= x1 or y0 >= y1:
            return
        aa = src_a[y0 - oy:y1 - oy, x0 - ox:x1 - ox, None]
        sub = frame[y0:y1, x0:x1].astype(np.float32)
        top = 0 if src_rgb is None else src_rgb[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
        frame[y0:y1, x0:x1] = (sub * (1 - aa) + top * aa).astype(np.uint8)
    if shadow is not None:
        blit(shadow, None, x + sdx, y + sdy)
    blit(a, rgb, x, y)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scene"); ap.add_argument("hand"); ap.add_argument("out")
    ap.add_argument("--number", default="1")
    ap.add_argument("--seconds", type=float, default=15)
    ap.add_argument("--start", default="0.2,0.25")
    ap.add_argument("--hand-height", type=int, default=600)
    ap.add_argument("--person", default="")
    ap.add_argument("--person-x", type=float, default=0.27)
    ap.add_argument("--person-h", type=float, default=0.80)
    a = ap.parse_args()

    src = cv2.cvtColor(cv2.imread(a.scene), cv2.COLOR_BGR2RGB)
    scene = fit(src, int(W * 0.76), int(W * 0.02)) if (a.number and not a.person) else fit(src)
    person_area = np.zeros((H, W), bool)
    if a.person:
        pim = cv2.cvtColor(cv2.imread(a.person), cv2.COLOR_BGR2RGB)
        s_ = a.person_h * H / pim.shape[0]
        pim = cv2.resize(pim, (round(pim.shape[1] * s_), round(pim.shape[0] * s_)), interpolation=cv2.INTER_AREA)
        nw_ = (pim.min(axis=2) > 235).astype(np.uint8)
        n_, lab_ = cv2.connectedComponents(nw_, connectivity=4)
        border = set(np.unique(np.concatenate([lab_[0], lab_[-1], lab_[:, 0], lab_[:, -1]]))) - {0}
        pm = ~(np.isin(lab_, list(border)) & (nw_ > 0))
        pm = cv2.dilate(pm.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        ph, pw = pm.shape
        px, py = int(a.person_x * W - pw / 2), H - ph
        x0, x1 = max(px, 0), min(px + pw, W)
        sub = pm[:, x0 - px:x1 - px]
        region = scene[py:py + ph, x0:x1]
        region[sub] = pim[:, x0 - px:x1 - px][sub]
        person_area[py:py + ph, x0:x1] = sub
    num_ov = None
    if a.number:
        nr = number_rgba(a.number)
        nh, nw = nr.shape[:2]
        x, y = int(W * 0.87 - nw / 2), int(H * 0.5 - nh / 2)
        num_ov = (nr[..., :3], nr[..., 3].astype(np.float32) / 255, x, y)  # shown from the start, not drawn

    LA = line_alpha(scene)
    ink = LA > 0.5
    sx, sy = map(float, a.start.split(","))
    T = a.seconds
    tl = Timeline()
    tl.keys.append((0.0, H * 0.95, W + 300.0))  # hand enters

    f = scene.astype(np.int16)
    colored = (f.min(axis=2) < 238) & (LA < 0.35)
    colored = cv2.morphologyEx(colored.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, cent = cv2.connectedComponentsWithStats(colored, connectivity=4)
    big = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 300]
    small = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] < 300]
    in_p = lambda i: person_area[int(cent[i][1]), int(cent[i][0])]
    big.sort(key=lambda i: (cent[i][1] // 260, cent[i][0]))

    # groups: person (lines, then colour) and then background (lines, then colour)
    groups = [(person_area, [i for i in big if in_p(i)])] if a.person else []
    groups.append((~person_area, [i for i in big if not in_p(i)]))
    t_end = 0.4 + min(T * 0.80, T - 1.2)
    if len(groups) == 2:
        ws = [0.30, 0.18, 0.32, 0.20]
    else:
        ws = [0.62, 0.38]
    edges = np.cumsum([0.4] + [w * (t_end - 0.4) for w in ws])
    line_t = np.full((H, W), np.inf, np.float32)
    color_t = np.full((H, W), np.inf, np.float32)
    cur = (sy * H, sx * W)
    regions = []
    nstrokes = 0
    for gi, (area, regs) in enumerate(groups):
        tl0, tl1, tc0, tc1 = edges[2 * gi], edges[2 * gi + 1], edges[2 * gi + 1] + 0.15, edges[2 * gi + 2]
        ch, _ = strokes(ink & area)
        ch = order_strokes(ch, cur)
        nstrokes += len(ch)
        if ch:
            pts, times, _ = plan_lines(ch, tl0, tl1, tl)
            lt = pixel_times((H, W), pts, times)
            line_t = np.where(area & (LA > 0), np.minimum(line_t, lt), line_t)
            cur = ch[-1][-1]
        rr = [(lab == i, tuple(st[i, :4])) for i in regs]
        regions += rr
        if rr:
            ct, _ = plan_colors(rr, tc0, tc1 - 0.05, tl)
            color_t = np.minimum(color_t, ct)
            last = tl.keys[-1]
            cur = (last[1], last[2])
    t_col1 = t_end
    ch_scene, ch_num = [None] * nstrokes, []
    rest = np.isin(lab, small) | ((f.min(axis=2) < 238) & ~np.isfinite(color_t) & (LA < 0.5))
    color_t[rest] = t_col1  # tiny leftovers fade in at the end
    tl.keys.append((t_col1 + 0.6, H * 0.95, W + 500))  # hand leaves
    tl.done()

    hand_rgb, hand_a, hand_sh, tip = load_hand(a.hand, a.hand_height)
    scene_f = scene.astype(np.float32)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                           "-crf", "18", "-preset", "medium", "-movflags", "+faststart", a.out], stdin=subprocess.PIPE)
    last = np.array([W + 500.0, H * 0.95])
    for fi in range(int(T * FPS)):
        t = fi / FPS
        ca = np.clip((t - color_t) / 0.12, 0, 1)[..., None]
        frame = 255 * (1 - ca) + scene_f * ca
        la = (LA * np.clip((t - line_t) / 0.05, 0, 1))[..., None]
        line_col = np.where(ca > 0.5, scene_f, 0)  # black ink, true colour once painted
        frame = frame * (1 - la) + line_col * la
        frame = frame.astype(np.uint8)
        if num_ov is not None and t >= 0.15:
            k = min((t - 0.15) / 0.35, 1.0)
            sc = 0.55 + 0.45 * (k * k * (3 - 2 * k)) + 0.07 * np.sin(k * np.pi)
            rgb_n, a_n, nx0, ny0 = num_ov
            hh, ww = a_n.shape
            nh2, nw2 = max(1, int(hh * sc)), max(1, int(ww * sc))
            over(frame, cv2.resize(rgb_n, (nw2, nh2)), cv2.resize(a_n, (nw2, nh2)) * min(k * 3, 1),
                 int(nx0 + ww / 2 - nw2 / 2), int(ny0 + hh / 2 - nh2 / 2))
        p = tl.pen(t)
        if p is None:
            p = last if t < tl.kt[0] else np.array([W + 500.0, H * 0.95])
        last = p
        over(frame, hand_rgb, hand_a, int(p[0] - tip[0]), int(p[1] - tip[1]), hand_sh)
        ff.stdin.write(frame.tobytes())
    ff.stdin.close(); ff.wait()
    print("ok", a.out, "strokes", len(ch_scene) + len(ch_num), "regions", len(regions))


if __name__ == "__main__":
    main()
