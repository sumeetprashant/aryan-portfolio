"""Registers every portrait of Aryan to one coordinate system and cuts a matte.

Run from the workspace root:  python site/scripts/prep_stage.py
Writes site/assets/stage/<name>.jpg (2048x1536: colour on the left half, matte on
the right half, so any static host can serve it) and shots/_stage_sheet.jpg.
Eye positions were measured once per source; the similarity transform puts the
eyes on the same two pixels in every output so states can morph without a jump.
"""
import math
import os
import cv2
import numpy as np
from PIL import Image

W, H = 1024, 1536
EYE_L, EYE_R = (448.7, 470.3), (575.3, 489.7)
PACK = 'pack/02_portrait_style_assets/'
SOURCES = {
    'real': ('site/assets/headshot.jpg', (403, 216), (495, 230), 'grabcut'),
    'clay': (PACK + 'handcrafted_clay_portrait_of_a_smiling_man.png', (685, 362), (850, 388), 'grabcut'),
    'felt': (PACK + 'handcrafted_felt_portrait_in_navy_suit.png', (690, 372), (872, 396), 'grabcut'),
}


def similarity(src_l, src_r):
    sx, sy = src_r[0] - src_l[0], src_r[1] - src_l[1]
    dx, dy = EYE_R[0] - EYE_L[0], EYE_R[1] - EYE_L[1]
    s = math.hypot(dx, dy) / math.hypot(sx, sy)
    a = math.atan2(dy, dx) - math.atan2(sy, sx)
    c, n = s * math.cos(a), s * math.sin(a)
    tx = EYE_L[0] - (c * src_l[0] - n * src_l[1])
    ty = EYE_L[1] - (n * src_l[0] + c * src_l[1])
    return np.float32([[c, -n, tx], [n, c, ty]])


def matte_grabcut(img, valid):
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
    mask[:, left:left + band] = np.where(np.arange(v.shape[0])[:, None] < 330, cv2.GC_BGD, mask[:, left:left + band])
    mask[:, right - band:right] = np.where(np.arange(v.shape[0])[:, None] < 330, cv2.GC_BGD, mask[:, right - band:right])
    mask[v == 0] = cv2.GC_BGD
    cv2.grabCut(small, mask, None, np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_MASK)
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(fg)
    if n > 1:
        keep = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        fg = np.where(labels == keep, 255, 0).astype(np.uint8)
    fg = cv2.resize(fg, (W, H), interpolation=cv2.INTER_LINEAR)
    fg = cv2.erode(fg, np.ones((7, 7), np.uint8))
    return cv2.GaussianBlur(fg, (0, 0), 2.2)


def matte_luma(img):
    m = img.max(axis=2).astype(np.float32)
    a = np.clip((m - 14) / 34, 0, 1)
    return (a * a * (3 - 2 * a) * 255).astype(np.uint8)


def main():
    os.makedirs('site/assets/stage', exist_ok=True)
    sheet = []
    for name, (path, el, er, mode) in SOURCES.items():
        src = cv2.imread(path)
        M = similarity(el, er)
        img = cv2.warpAffine(src, M, (W, H), flags=cv2.INTER_CUBIC, borderValue=(0, 0, 0))
        valid = cv2.warpAffine(np.full(src.shape[:2], 255, np.uint8), M, (W, H), flags=cv2.INTER_NEAREST)
        alpha = matte_grabcut(img, valid) if mode == 'grabcut' else matte_luma(img)
        alpha = np.minimum(alpha, cv2.erode(valid, np.ones((5, 5), np.uint8)))
        bottom = int(np.where(valid.max(axis=1) > 0)[0].max())
        print(name, 'content bottom row', bottom, 'of', H)
        packed = np.hstack([cv2.cvtColor(img, cv2.COLOR_BGR2RGB), np.dstack([alpha] * 3)])
        Image.fromarray(packed).save(f'site/assets/stage/{name}.jpg', quality=90, optimize=True, subsampling=0)
        a = alpha[..., None].astype(np.float32) / 255
        comp = (img * a + np.array([14, 12, 11]) * (1 - a)).astype(np.uint8)
        for p in (EYE_L, EYE_R):
            cv2.circle(comp, (int(p[0]), int(p[1])), 5, (0, 255, 255), 1)
        sheet.append(cv2.resize(comp, (W // 3, H // 3), interpolation=cv2.INTER_AREA))
    os.makedirs('shots', exist_ok=True)
    cv2.imwrite('shots/_stage_sheet.jpg', np.hstack(sheet), [cv2.IMWRITE_JPEG_QUALITY, 88])


if __name__ == '__main__':
    main()
