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
import sys
import cv2
import numpy as np
from PIL import Image

W, H = 1024, 1536                      # canonical frame the eye targets are given in
EYE_L, EYE_R = (448.7, 470.3), (575.3, 489.7)
OUT_W, OUT_H = 1280, 1500              # stored band: v in [0, VMAX)
S = OUT_W / W
VMAX = OUT_H / (H * S)                 # 0.78125, mirrored in js/stage.js
PROFILE = 'Aryan-Mehta-Website-and-Data/profile-and-resume/'
SOURCES = {
    # the relit headshot is the base photo for every procedural state and the final frame
    'real': (PROFILE + 'relit-headshot.jpg', (495, 426), (664, 445)),
}
# the summary's still: the cartoon felt character, cut out of his mock-up page. Pupil centres as eye points.
FELT = (PROFILE + '0more-imgs/ChatGPT Image Sep 20, 2026, 07_07_15 PM.png', (700, 400), (868, 420))


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


def felt_still():
    """site/assets/felt-still.webp: the felt character matted off the cream mock-up he was drawn on
    (handwriting, tape and arrows all sit outside his silhouette), centred in a 1536x1024 frame with
    the bust running off the bottom edge. The summary shows it until the head-turn clip
    (site/assets/felt-look.mp4, same framing) exists."""
    src = cv2.imread(FELT[0])
    h, w = src.shape[:2]
    small = cv2.resize(src, (w // 2, h // 2), interpolation=cv2.INTER_AREA)
    mask = np.full(small.shape[:2], cv2.GC_PR_BGD, np.uint8)
    cx = int((FELT[1][0] + FELT[2][0]) / 4)
    cv2.ellipse(mask, (cx, 195), (135, 165), 0, 0, 360, cv2.GC_PR_FGD, -1)
    cv2.fillPoly(mask, [np.int32([[cx - 95, 340], [cx + 95, 340], [cx + 215, 440], [cx + 225, 511], [cx - 255, 511], [cx - 225, 450]])], cv2.GC_PR_FGD)
    cv2.ellipse(mask, (cx, 210), (85, 110), 0, 0, 360, cv2.GC_FGD, -1)
    cv2.rectangle(mask, (cx - 110, 420), (cx + 110, 511), cv2.GC_FGD, -1)
    # the page furniture is never him: margins, the tape label, the notes on the right
    mask[:14, :] = cv2.GC_BGD
    mask[:, :120] = cv2.GC_BGD
    mask[:, 640:] = cv2.GC_BGD
    mask[:330, :235] = cv2.GC_BGD
    mask[:400, 545:] = cv2.GC_BGD
    cv2.grabCut(small, mask, None, np.zeros((1, 65)), np.zeros((1, 65)), 8, cv2.GC_INIT_WITH_MASK)
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(fg)
    if n > 1:
        fg = np.where(labels == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8)
    inv = cv2.bitwise_not(fg)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(inv)
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        if x > 0 and y > 0 and x + bw < fg.shape[1] and y + bh < fg.shape[0]:
            fg[labels == i] = 255
    hard = cv2.resize(fg, (w, h), interpolation=cv2.INTER_LINEAR)
    hard = np.where(hard > 127, 255, 0).astype(np.uint8)

    # felt is fuzzy: inside a band round the cut, alpha is how far each pixel sits from the paper
    # behind it, and the paper's share is taken back out of the colour so no cream fringe is left
    f = src.astype(np.float32)
    paper_mask = (cv2.dilate(hard, np.ones((41, 41), np.uint8)) == 0).astype(np.float32)
    paper = cv2.GaussianBlur(f * paper_mask[..., None], (0, 0), 45) / np.maximum(cv2.GaussianBlur(paper_mask, (0, 0), 45), 1e-3)[..., None]
    dist = np.linalg.norm(cv2.cvtColor(src, cv2.COLOR_BGR2LAB).astype(np.float32) - cv2.cvtColor(np.clip(paper, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32), axis=2)
    soft = np.clip((dist - 14) / 30, 0, 1)
    soft = soft * soft * (3 - 2 * soft)
    core = cv2.erode(hard, np.ones((15, 15), np.uint8)).astype(np.float32) / 255
    reach = cv2.GaussianBlur(cv2.dilate(hard, np.ones((7, 7), np.uint8)), (0, 0), 2).astype(np.float32) / 255
    alpha = np.maximum(core, np.minimum(soft, reach))
    # the tape label touches his left shoulder; it is yellow where he is navy, so it goes by colour
    lab_b = cv2.cvtColor(src, cv2.COLOR_BGR2LAB)[..., 2]
    tape = np.zeros((h, w), bool)
    tape[690:, :460] = cv2.dilate((lab_b[690:, :460] > 133).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    alpha = np.where(tape, 0, alpha)
    clean = (f - (1 - alpha[..., None]) * paper) / np.maximum(alpha[..., None], .08)
    clean = np.where(alpha[..., None] > .02, np.clip(clean, 0, 255), 0).astype(np.uint8)
    # loose fibres take the colour of the felt just inside them, so the fuzz never reads as a pale rim
    band = cv2.dilate(hard, np.ones((21, 21), np.uint8)) & cv2.bitwise_not(cv2.erode(hard, np.ones((11, 11), np.uint8)))
    inner = cv2.inpaint(src, band, 7, cv2.INPAINT_TELEA)
    k = np.clip((alpha - .45) / .5, 0, 1)[..., None]
    clean = (inner * (1 - k) + clean * k).astype(np.uint8)
    # a hair of the cut pulled in, so what is left of the paper never shows on the dark page
    alpha = np.clip(alpha * 1.15 - .15, 0, 1)

    FW, FH = 1536, 1024
    ex = (FELT[1][0] + FELT[2][0]) / 2
    M = np.float32([[1, 0, FW / 2 - ex], [0, 1, FH - h]])
    rgb = cv2.warpAffine(clean, M, (FW, FH), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0))
    a = cv2.warpAffine((alpha * 255).astype(np.uint8), M, (FW, FH), flags=cv2.INTER_LINEAR, borderValue=0)
    out = np.dstack([cv2.cvtColor(rgb, cv2.COLOR_BGR2RGB), a])
    Image.fromarray(out).save('site/assets/felt-still.webp', quality=90, method=6)
    os.makedirs('shots', exist_ok=True)
    for name, bg in (('dark', (14, 11, 10)), ('light', (236, 240, 243))):
        comp = rgb * (a[..., None] / 255.0) + np.array(bg) * (1 - a[..., None] / 255.0)
        cv2.imwrite(f'shots/_felt_still_{name}.jpg', comp.astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 92])
    print('felt-still.webp', out.shape)


def main():
    os.makedirs('site/assets/stage', exist_ok=True)
    felt_still()
    if '--felt' in sys.argv:
        return
    sheet = []
    for name, (path, el, er) in SOURCES.items():
        src = cv2.imread(path)
        canon = cv2.warpAffine(src, similarity(el, er), (W, H), flags=cv2.INTER_AREA, borderValue=(0, 0, 0))
        valid = cv2.warpAffine(np.full(src.shape[:2], 255, np.uint8), similarity(el, er), (W, H), flags=cv2.INTER_NEAREST)
        hard = matte_grabcut(canon, valid)

        big = (OUT_W, int(H * S))
        img = cv2.warpAffine(src, similarity(el, er, S), big, flags=cv2.INTER_CUBIC, borderValue=(0, 0, 0))[:OUT_H]
        valid_big = cv2.warpAffine(np.full(src.shape[:2], 255, np.uint8), similarity(el, er, S), big, flags=cv2.INTER_NEAREST)[:OUT_H]
        hard = cv2.resize(hard, big, interpolation=cv2.INTER_LINEAR)[:OUT_H]
        hard = np.where(hard > 127, 255, 0).astype(np.uint8)
        core = cv2.erode(hard, np.ones((9, 9), np.uint8))
        alpha = cv2.GaussianBlur(cv2.erode(hard, np.ones((5, 5), np.uint8)), (0, 0), 2.4)
        alpha = np.minimum(alpha, cv2.erode(valid_big, np.ones((7, 7), np.uint8)))
        # where the source photo itself ends (a shoulder against the picture's edge) the figure
        # would stop in a straight cut: let it thin out over the last stretch instead
        inside = valid_big.copy()
        inside[:, :2] = 0
        inside[:, -2:] = 0
        reach = np.clip(cv2.distanceTransform(inside, cv2.DIST_L2, 5) / 170.0, 0, 1)
        alpha = (alpha * (reach * reach * (3 - 2 * reach))).astype(np.uint8)

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
