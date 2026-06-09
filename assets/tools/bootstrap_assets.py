import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_part as mp
SRC='images/original'
def src(n): return os.path.join(SRC,n)
tiers=[
 ('white','ホワイト','LINE_ALBUM_ウェディング系_260403_2.jpg',(0.32,0.56,0.52,0.80)),
 ('pistachio','ピスタチオ','LINE_ALBUM_ケーキ_260403_6.jpg',(0.37,0.53,0.61,0.69)),
 ('naked','ネイキッド','686E89D3-07BB-4AE6-A220-17829DD1C71A.jpg',(0.40,0.47,0.62,0.59)),
]
for tid,name,fn,fr in tiers:
    out=os.path.join(mp.PARTS_DIR,'tiers',tid+'.jpg')
    mp.make_texture(src(fn),fr,out); mp.add_entry('tiers',{'id':tid,'name':name,'file':'parts/tiers/'+tid+'.jpg'}); print('tier',tid)
berries=[
 ('strawberry','苺','LINE_ALBUM_ケーキ_260403_7.jpg',(0.29,0.52,0.55,0.93),0.34),
 ('strawberry_half','カット苺','LINE_ALBUM_ケーキ_260403_7.jpg',(0.06,0.40,0.30,0.71),0.30),
 ('blackberry','ブラックベリー','LINE_ALBUM_ケーキ_260403_7.jpg',(0.55,0.45,0.75,0.67),0.22),
 ('blueberry','ブルーベリー','LINE_ALBUM_ケーキ_260403_7.jpg',(0.65,0.49,0.83,0.69),0.20),
]
for pid,name,fn,fr,sc in berries:
    p,sz=mp.process_part(src(fn),'berry',pid,name,crop=fr,scale=sc); print('berry',pid,sz)
