#!/usr/bin/env python3
"""make_part.py — 写真を配置用の透過PNG部品に変換し parts.json に登録する。

使い方(単体写真を部品化):
  python3 make_part.py --in photo.jpg --cat berry --id strawberry --name 苺 [--scale 0.34] [--crop x0 y0 x1 y1]

ポイント:
  - 背景除去は「明るく彩度の低い領域(白〜淡い背景)」を透過にする方式。
  - 白い被写体(白いトッパー等)を白背景で撮ると消えるため、淡色の被写体は
    グレー or 有色の背景で撮影してください(撮影ガイド参照)。
  - --crop は元画像に対する 0〜1 の割合 (左,上,右,下)。
"""
import argparse, json, os
import numpy as np
from collections import deque
from PIL import Image, ImageFilter

ASSETS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../assets
PARTS_DIR = os.path.join(ASSETS, 'parts')
MANIFEST = os.path.join(PARTS_DIR, 'parts.json')
DEFAULT_SCALE = {'berry':0.34,'flower':0.42,'macaron':0.36,'ribbon':0.70,'topper':1.10}

def _sv(arr):
    mx = arr.max(axis=2); mn = arr.min(axis=2)
    v = mx; s = np.where(mx < 1e-6, 0.0, (mx-mn)/(mx+1e-9))
    return s, v

def _largest(mask):
    H,W = mask.shape; seen = np.zeros((H,W), bool); best=None; bestsz=0
    for sy,sx in np.argwhere(mask):
        if seen[sy,sx]: continue
        q=deque([(sy,sx)]); seen[sy,sx]=True; comp=[]
        while q:
            y,x=q.popleft(); comp.append((y,x))
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    ny,nx=y+dy,x+dx
                    if 0<=ny<H and 0<=nx<W and mask[ny,nx] and not seen[ny,nx]:
                        seen[ny,nx]=True; q.append((ny,nx))
        if len(comp)>bestsz: bestsz=len(comp); best=comp
    res=np.zeros((H,W),bool)
    if best:
        ys=[p[0] for p in best]; xs=[p[1] for p in best]; res[ys,xs]=True
    return res

def _fill_holes(mask):
    H,W=mask.shape; bg=~mask; reach=np.zeros((H,W),bool); q=deque()
    for x in range(W):
        for y in (0,H-1):
            if bg[y,x] and not reach[y,x]: reach[y,x]=True; q.append((y,x))
    for y in range(H):
        for x in (0,W-1):
            if bg[y,x] and not reach[y,x]: reach[y,x]=True; q.append((y,x))
    while q:
        y,x=q.popleft()
        for dy in (-1,0,1):
            for dx in (-1,0,1):
                ny,nx=y+dy,x+dx
                if 0<=ny<H and 0<=nx<W and bg[ny,nx] and not reach[ny,nx]:
                    reach[ny,nx]=True; q.append((ny,nx))
    return mask | (bg & ~reach)

def make_alpha(img, tol=0.19, vbg=0.82, sbg=0.12, feather=1.2):
    rgb=np.asarray(img.convert('RGB')).astype(np.float32)/255.0
    H,W,_=rgb.shape
    ring=np.concatenate([rgb[:3].reshape(-1,3),rgb[-3:].reshape(-1,3),
                         rgb[:,:3].reshape(-1,3),rgb[:,-3:].reshape(-1,3)],axis=0)
    bgcol=np.median(ring,axis=0)
    dist=np.sqrt(((rgb-bgcol)**2).sum(axis=2))
    s,v=_sv(rgb)
    bg=(dist<tol)|((v>vbg)&(s<sbg))
    mask=_fill_holes(_largest(~bg))
    a=Image.fromarray((mask*255).astype(np.uint8),'L')
    if feather>0: a=a.filter(ImageFilter.GaussianBlur(feather))
    out=img.convert('RGBA'); out.putalpha(a); return out

def crop_frac(img, fr):
    W,H=img.size; x0,y0,x1,y1=fr
    return img.crop((int(W*x0),int(H*y0),int(W*x1),int(H*y1)))

def autotrim(rgba, pad=0.06):
    a=np.asarray(rgba)[...,3]; ys,xs=np.where(a>16)
    if len(xs)==0: return rgba
    x0,x1,y0,y1=int(xs.min()),int(xs.max()),int(ys.min()),int(ys.max())
    px=int(max(x1-x0,y1-y0)*pad)
    x0=max(0,x0-px); y0=max(0,y0-px); x1=min(rgba.width-1,x1+px); y1=min(rgba.height-1,y1+px)
    return rgba.crop((x0,y0,x1+1,y1+1))

def make_texture(inp, fr, out, size=512):
    img=Image.open(inp).convert('RGB'); c=crop_frac(img,fr); c.thumbnail((size,size)); c.save(out, quality=88)

def load_manifest():
    if os.path.exists(MANIFEST):
        return json.load(open(MANIFEST,encoding='utf-8'))
    return {}

def add_entry(cat, entry):
    m=load_manifest(); m.setdefault(cat,[])
    m[cat]=[e for e in m[cat] if e.get('id')!=entry['id']]
    m[cat].append(entry)
    os.makedirs(PARTS_DIR, exist_ok=True)
    json.dump(m, open(MANIFEST,'w',encoding='utf-8'), ensure_ascii=False, indent=2)
    return m

def process_part(inp, cat, pid, name, crop=None, scale=None, maxsize=640):
    img=Image.open(inp).convert('RGB')
    if crop: img=crop_frac(img,crop)
    img.thumbnail((maxsize,maxsize))
    rgba=autotrim(make_alpha(img))
    rel=os.path.join(cat, pid+'.png')
    outp=os.path.join(PARTS_DIR, rel)
    os.makedirs(os.path.dirname(outp), exist_ok=True)
    rgba.save(outp)
    w,h=rgba.size
    add_entry(cat, {'id':pid,'name':name,'file':'parts/'+rel.replace(os.sep,'/'),
                    'scale':scale if scale else DEFAULT_SCALE.get(cat,0.4),
                    'aspect':round(w/h,3)})
    return outp, rgba.size

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--in', dest='inp', required=True)
    ap.add_argument('--cat', required=True)
    ap.add_argument('--id', required=True)
    ap.add_argument('--name', required=True)
    ap.add_argument('--scale', type=float, default=None)
    ap.add_argument('--crop', nargs=4, type=float, default=None)
    a=ap.parse_args()
    p,sz=process_part(a.inp,a.cat,a.id,a.name,a.crop,a.scale)
    print('wrote', p, sz)
