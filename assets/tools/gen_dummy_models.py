"""ダミーGLB部品を生成（本番モデルが届くまでのデモ用）。本番は同じパスに置けば差し替わる。"""
import trimesh, math, os
import numpy as np
T=trimesh.transformations
def col(m,c): m.visual.face_colors=c; return m
def yup(m): m.apply_transform(T.rotation_matrix(-math.pi/2,[1,0,0])); return m
def base0(m):
    b=m.bounds; m.apply_translation([-(b[0][0]+b[1][0])/2,-b[0][1],-(b[0][2]+b[1][2])/2]); return m
def save(m,p):
    os.makedirs(os.path.dirname(p),exist_ok=True); m.export(p); print('wrote',p, 'verts',len(m.vertices))

# tier
cyl=yup(trimesh.creation.cylinder(radius=1.0,height=0.6,sections=96)); col(cyl,[243,233,216,255]); base0(cyl); save(cyl,'assets/models/tier/round.glb')
# strawberry
body=trimesh.creation.icosphere(subdivisions=3,radius=0.5); body.apply_scale([1,1.35,1]); col(body,[196,56,47,255])
calyx=yup(trimesh.creation.cone(radius=0.28,height=0.18,sections=10)); calyx.apply_translation([0,0.62,0]); col(calyx,[110,150,80,255])
save(base0(trimesh.util.concatenate([body,calyx])),'assets/models/berry/strawberry.glb')
# blueberry / blackberry
save(base0(col(trimesh.creation.icosphere(subdivisions=3,radius=0.32),[74,90,138,255])),'assets/models/berry/blueberry.glb')
save(base0(col(trimesh.creation.icosphere(subdivisions=3,radius=0.36),[60,44,66,255])),'assets/models/berry/blackberry.glb')
# rose
center=col(trimesh.creation.icosphere(subdivisions=2,radius=0.45),[236,170,175,255]); center.apply_scale([1,0.5,1])
petals=[center]
for i in range(6):
    p=trimesh.creation.icosphere(subdivisions=2,radius=0.28); p.apply_scale([1.4,0.4,0.9])
    a=i/6*2*math.pi; p.apply_translation([math.cos(a)*0.4,0.05,math.sin(a)*0.4]); col(p,[240,185,190,255]); petals.append(p)
save(base0(trimesh.util.concatenate(petals)),'assets/models/flower/rose.glb')
# macaron
sb=yup(trimesh.creation.cylinder(radius=0.5,height=0.16,sections=48)); col(sb,[240,200,205,255])
fl=yup(trimesh.creation.cylinder(radius=0.46,height=0.08,sections=48)); fl.apply_translation([0,0.09,0]); col(fl,[250,240,225,255])
st=yup(trimesh.creation.cylinder(radius=0.5,height=0.16,sections=48)); st.apply_translation([0,0.18,0]); col(st,[240,200,205,255])
save(base0(trimesh.util.concatenate([sb,fl,st])),'assets/models/macaron/macaron.glb')
# bow
lL=trimesh.creation.torus(major_radius=0.28,minor_radius=0.08); lL.apply_scale([1.2,1,0.5]); lL.apply_translation([-0.28,0,0])
lR=trimesh.creation.torus(major_radius=0.28,minor_radius=0.08); lR.apply_scale([1.2,1,0.5]); lR.apply_translation([0.28,0,0])
kn=trimesh.creation.icosphere(subdivisions=2,radius=0.12); kn.apply_scale([0.7,1,0.7])
save(base0(col(trimesh.util.concatenate([lL,lR,kn]),[201,169,106,255])),'assets/models/ribbon/bow.glb')
# topper
pl=trimesh.creation.box(extents=[0.95,0.36,0.03]); pl.apply_translation([0,0.7,0]); col(pl,[202,168,78,255])
s1=yup(trimesh.creation.cylinder(radius=0.02,height=0.55,sections=12)); s1.apply_translation([-0.3,0.27,0]); col(s1,[202,168,78,255])
s2=yup(trimesh.creation.cylinder(radius=0.02,height=0.55,sections=12)); s2.apply_translation([0.3,0.27,0]); col(s2,[202,168,78,255])
save(base0(trimesh.util.concatenate([pl,s1,s2])),'assets/models/topper/topper.glb')
# pearl
save(base0(col(trimesh.creation.icosphere(subdivisions=2,radius=0.12),[244,236,220,255])),'assets/models/pearl/pearl.glb')
