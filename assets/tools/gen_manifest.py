"""assets/models/<カテゴリ>/*.glb を走査して assets/models/manifest.json を生成。
GLBを追加/差し替えたらこれを実行するだけで部品が登録される。"""
import json, glob, os
MODELS='assets/models'; OUT=os.path.join(MODELS,'manifest.json')
NAMES={'round':'ラウンド','square':'スクエア','heart':'ハート','strawberry':'苺','strawberry_half':'カット苺',
 'blueberry':'ブルーベリー','blackberry':'ブラックベリー','raspberry':'ラズベリー','cherry':'さくらんぼ',
 'rose':'バラ','flower':'お花','peony':'芍薬','babysbreath':'かすみ草','leaf':'葉','greenery':'グリーン',
 'macaron':'マカロン','cookie':'クッキー','bow':'リボン','ribbon':'リボン','topper':'トッパー','pearl':'パール'}
SIZE={'berry':0.42,'flower':0.55,'macaron':0.55,'ribbon':0.95,'topper':1.5,'pearl':0.16}
CATS=['tier','berry','flower','macaron','ribbon','topper','pearl']
m={}
for cat in CATS:
    arr=[]
    for f in sorted(glob.glob(os.path.join(MODELS,cat,'*.glb'))):
        pid=os.path.splitext(os.path.basename(f))[0]
        e={'id':pid,'name':NAMES.get(pid,pid),'file':f.replace(os.sep,'/')}
        if cat!='tier': e['size']=SIZE.get(cat,0.5)
        arr.append(e)
    if arr: m[cat]=arr
json.dump(m,open(OUT,'w',encoding='utf-8'),ensure_ascii=False,indent=2)
print('wrote',OUT,'\n'); print(json.dumps(m,ensure_ascii=False,indent=1))
