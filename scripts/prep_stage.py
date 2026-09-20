"""Registers every portrait of Aryan to one coordinate system and cuts a matte.

Run from the workspace root:  python site/scripts/prep_stage.py
Writes site/assets/stage/<name>.jpg (2560x1500: colour on the left half, matte on
the right half, so any static host can serve it) and shots/_stage_sheet.jpg.

The frame is 2:3 (u 0..1 across, v 0..1 down). Only v < VMAX holds any portrait,
so the texture stores just that band at 1280 px across; the shader divides v by
VMAX. Eye positions were measured once per source (pupil centres, read off a 2x
ruler crop, see shots/_eyes_*.png); the similarity transform puts the eyes on the
same two points in every output so states can morph without a jump.
"""
import math
import os
import cv2
import numpy as np
from PIL import Image

W, H = 1024, 1536                      # canonical frame the eye targets are given in
EYE_L, EYE_R = (448.7, 470.3), (575.3, 489.7)
OUT_W, OUT_H = 1280, 1500              # stored band: v in [0, VMAX)
S = OUT_W / W
VMAX = OUT_H / (H * S)                 # 0.78125, mirrored in js/stage.js
PROFILE = 'Aryan-Mehta-Website-and-Data/profile-and-resume/'
PACK = 'pack/02_portrait_style_assets/'
SOURCES = {
    # the relit headshot is the base photo for every procedural state and the final frame
    'real': (PROFILE + 'relit-headshot.jpg', (495, 426), (664, 445)),
    'lego': (PROFILE + '0more-imgs/ChatGPT Image Sep 20, 2026, 07_06_28 PM.png', (498, 473), (678, 499)),
    'felt': (PACK + 'handcrafted_felt_portrait_in_navy_suit.png', (690, 372), (872, 396)),
}


def similarity(src_l, src_r, scale=1.0):
    sx, sy = src_r[0] - src_l[0], src_r[1] - src_l[1]
    dx, dy = EYE_R[0] - EYE_L[0], EYE_R[1] - EYE_L[1]
    s = math.hypot(dx, dy) / math.hypot(sx, sy)
    a = math.atan2(dy, dx) - math.atan2(sy, sx)
    c, n = s * math.cos(a), s * math.sin(a)
    tx = EYE_L[0] - (c * src_l[0] - n * src_l[1])
    ty = EYE_L[1] - (n * src_l[0] + c * src_l[1])
    return np.float32([[c, -n, tx], [n, c, ty]]) * scale


def matte_grabcut(img, valid):
    """img, valid: canonical 1024x1536 frame. Returns a hard 0/255 matte at that size."""
    small = cv2.resize(img, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
    v = cv2.resize(valid, (W // 2, H // 2), interpolation=cv2.INTER_NEAREST)
    mask = np.full(v.shape, cv2.GC_PR_BGD, np.uint8)
    ys, xs = np.where(v > 0)
    top, bottom, left, right = ys.min(), ys.max(), xs.min(), xs.max()
    cx = W // 4
    # likely subject: head oval plus the bust that runs off the bottom of the photo
    cv2.ellipse(mask, (cx, 225), (95, 140), 0, 0, 360, cv2.GC_PR_FGD, -1)
    cv2.rectangle(mask, (cx - 150, 400), (cx + 150, bottom), cv2.GC_PR_FGD, -1)
    cv2.ellipse(mask, (cx, 240), (55, 85), 0, 0, 360, cv2.GC_FGD, -1)
    cv2.rectangle(mask, (cx - 60, 420), (cx + 60, bottom), cv2.GC_FGD, -1)
    band = 14
    mask[top:top + band, :] = cv2.GC_BGD
    rows = np.arange(v.shape[0])[:, None] < 330
    mask[:, left:left + band] = np.where(rows, cv2.GC_BGD, mask[:, left:left + band])
    mask[:, right - band:right] = np.where(rows, cv2.GC_BGD, mask[:, right - band:right])
    mask[v == 0] = cv2.GC_BGD
    cv2.grabCut(small, mask, None, np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_MASK)
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(fg)
    if n > 1:
        keep = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        fg = np.where(labels == keep, 255, 0).astype(np.uint8)
    # close pinholes the cut leaves inside the figure
    inv = cv2.bitwise_not(fg)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(inv)
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if x > 0 and y > 0 and x + w < fg.shape[1] and y + h < fg.shape[0]:
            fg[labels == i] = 255
    return cv2.resize(fg, (W, H), interpolation=cv2.INTER_LINEAR)


def refine_lego(canon, hard):
    """The Lego render sits on a dark neutral backdrop that GrabCut cannot tell from navy
    brick. Below the chin, keep only what is blue (Lab b), bright (shirt), or the neck column."""
    lab = cv2.cvtColor(canon, cv2.COLOR_BGR2LAB).astype(np.int16)
    L, b = lab[..., 0], lab[..., 2]
    ys, xs = np.mgrid[0:H, 0:W]
    keep = (b < 119) | (L > 150) | (np.abs(xs - W * 0.5) < W * 0.12)
    out = np.where((ys < H * 0.478) | keep, hard, 0).astype(np.uint8)
    out = cv2.morphologyEx(out, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    out = cv2.morphologyEx(out, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(out)
    if n > 1:
        out = np.where(labels == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8)
    return out


def main():
    os.makedirs('site/assets/stage', exist_ok=True)
    sheet = []
    for name, (path, el, er) in SOURCES.items():
        src = cv2.imread(path)
        canon = cv2.warpAffine(src, similarity(el, er), (W, H), flags=cv2.INTER_AREA, borderValue=(0, 0, 0))
        valid = cv2.warpAffine(np.full(src.shape[:2], 255, np.uint8), similarity(el, er), (W, H), flags=cv2.INTER_NEAREST)
        hard = matte_grabcut(canon, valid)
        if name == 'lego':
            hard = refine_lego(canon, hard)

        big = (OUT_W, int(H * S))
        img = cv2.warpAffine(src, similarity(el, er, S), big, flags=cv2.INTER_CUBIC, borderValue=(0, 0, 0))[:OUT_H]
        valid_big = cv2.warpAffine(np.full(src.shape[:2], 255, np.uint8), similarity(el, er, S), big, flags=cv2.INTER_NEAREST)[:OUT_H]
        hard = cv2.resize(hard, big, interpolation=cv2.INTER_LINEAR)[:OUT_H]
        hard = np.where(hard > 127, 255, 0).astype(np.uint8)
        core = cv2.erode(hard, np.ones((9, 9), np.uint8))
        alpha = cv2.GaussianBlur(cv2.erode(hard, np.ones((5, 5), np.uint8)), (0, 0), 2.4)
        alpha = np.minimum(alpha, cv2.erode(valid_big, np.ones((7, 7), np.uint8)))

        # push the figure's own colour out over the soft edge so no backdrop shows through the matte
        band = cv2.dilate(hard, np.ones((25, 25), np.uint8)) & cv2.bitwise_not(core)
        img = cv2.inpaint(img, band, 6, cv2.INPAINT_TELEA)

        bottom = int(np.where(valid_big.max(axis=1) > 0)[0].max())
        print(f'{name}: content bottom v = {bottom / (H * S):.3f}  (VMAX {VMAX:.5f})')
        packed = np.hstack([cv2.cvtColor(img, cv2.COLOR_BGR2RGB), np.dstack([alpha] * 3)])
        Image.fromarray(packed).save(f'site/assets/stage/{name}.jpg', quality=90, optimize=True, subsampling=0)

        a = alpha[..., None].astype(np.float32) / 255
        comp = (img * a + np.array([14, 12, 11]) * (1 - a)).astype(np.uint8)
        for p in (EYE_L, EYE_R):
            cv2.circle(comp, (int(p[0] * S), int(p[1] * S)), 6, (0, 255, 255), 1)
        sheet.append(cv2.resize(comp, (OUT_W // 3, OUT_H // 3), interpolation=cv2.INTER_AREA))
    os.makedirs('shots', exist_ok=True)
    cv2.imwrite('shots/_stage_sheet.jpg', np.hstack(sheet), [cv2.IMWRITE_JPEG_QUALITY, 90])


if __name__ == '__main__':
    main()
