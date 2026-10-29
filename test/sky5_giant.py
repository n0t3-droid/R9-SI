# f-sky5 · the giant's band edge contrast in a picture of it (test/sky_offline.js run <tag> giant_noon,giant_golden): the
# disc's inner 0.6 radii (centre 320,172, R 170 at 640 x 360, the 14° lens), a 7-px median (the stars off), the
# L* step over 4 px, its 90th and 98th percentile. usage: python3 test/sky5_giant.py test/shots/skyoff_giant_noon_<tag>.png …
import sys, numpy as np
from PIL import Image, ImageFilter
def lstar(a):
    a=a/255.0; a=np.where(a<=0.04045,a/12.92,((a+0.055)/1.055)**2.4)
    Y=0.2126*a[...,0]+0.7152*a[...,1]+0.0722*a[...,2]
    return np.where(Y>0.008856,116*np.cbrt(Y)-16,903.3*Y)
for p in sys.argv[1:]:
    a=np.asarray(Image.open(p).convert('RGB').filter(ImageFilter.MedianFilter(7))).astype(float); L=lstar(a)
    H,W=L.shape; cx,cy,R=320,172,170
    yy,xx=np.mgrid[0:H,0:W]; m=((xx-cx)**2+(yy-cy)**2<(0.6*R)**2)
    gy=np.abs(L[4:,:]-L[:-4,:]); gx=np.abs(L[:,4:]-L[:,:-4])
    g=np.zeros_like(L); g[2:-2,:]=gy; g2=np.zeros_like(L); g2[:,2:-2]=gx; G=np.maximum(g,g2)
    v=G[m]; print(p.split('/')[-1], 'P90 %.2f P98 %.2f' % (np.percentile(v,90), np.percentile(v,98)))
