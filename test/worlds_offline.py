#!/usr/bin/env python3
# u-moons1 · draws what test/worlds_offline.js wrote: a moon's sky with the game's own sky program on Mesa's llvmpipe
# through EGL (headless OpenGL ES 3, no browser) into an RGBA16F target, tone-mapped as the composite does; or a top-down
# map of the generator. → test/shots/worlds_off_<tag>.png. A tool for tuning between the browser runs; regress: skip.
#   python3 test/worlds_offline.py .tmp_tests/worlds_off/<tag> [more folders …]
import ctypes, json, os, sys, importlib.util
os.environ.setdefault('LP_NUM_THREADS', '1')
os.environ.setdefault('EGL_PLATFORM', 'surfaceless')
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('space0_offline', os.path.join(HERE, 'space0_offline.py'))
S0 = importlib.util.module_from_spec(spec); spec.loader.exec_module(S0)   # (the EGL set-up, the GL entry points, the composite)
c_int, c_float = ctypes.c_int, ctypes.c_float
glUniform4fv = S0.P('glUniform4fv', None, c_int, c_int, ctypes.POINTER(c_float))
glUniform1i = S0.glUniform1i

def sky(F, shots):
    W, H = F['W'], F['H']
    p = S0.program(F['vs'], F['fs'], 'sky')
    if not p: raise SystemExit('the sky program did not compile')
    hdr = S0.tex(W, H, S0.GL_RGBA16F, S0.GL_RGBA, S0.GL_HALF_FLOAT, None, False, False)
    fb = ctypes.c_uint(); S0.glGenFramebuffers(1, ctypes.byref(fb)); S0.glBindFramebuffer(S0.GL_FRAMEBUFFER, fb.value)
    S0.glFramebufferTexture2D(S0.GL_FRAMEBUFFER, S0.GL_COLOR_ATTACHMENT0, S0.GL_TEXTURE_2D, hdr, 0)
    S0.glViewport(0, 0, W, H); S0.glClearColor(0, 0, 0, 1); S0.glClear(0x4000)
    vao = ctypes.c_uint(); S0.glGenVertexArrays(1, ctypes.byref(vao)); S0.glBindVertexArray(vao.value)
    S0.glDisable(S0.GL_DEPTH_TEST); S0.glDisable(S0.GL_CULL_FACE); S0.glDisable(S0.GL_BLEND)
    S0.glUseProgram(p)
    for k, v in F['u'].items():
        if k in F.get('ints', []):
            loc = S0.glGetUniformLocation(p, k.encode())
            if loc >= 0: glUniform1i(loc, int(v))
        else: S0.set_u(p, k, v)
    for k, arr in F['arrays'].items():
        loc = S0.glGetUniformLocation(p, k.encode())
        if loc >= 0: glUniform4fv(loc, len(arr) // 4, (c_float * len(arr))(*arr))
    S0.glDrawArrays(4, 0, 3)
    e = S0.glGetError()
    if e: print('GL error', hex(e))
    ldr = S0.tex(W, H, S0.GL_RGBA8, S0.GL_RGBA, S0.GL_UNSIGNED_BYTE, None, False, False)
    fb2 = ctypes.c_uint(); S0.glGenFramebuffers(1, ctypes.byref(fb2)); S0.glBindFramebuffer(S0.GL_FRAMEBUFFER, fb2.value)
    S0.glFramebufferTexture2D(S0.GL_FRAMEBUFFER, S0.GL_COLOR_ATTACHMENT0, S0.GL_TEXTURE_2D, ldr, 0)
    cp = S0.program(S0.COMP_VS, S0.COMP_FS, 'composite'); S0.glUseProgram(cp)
    lk = F['look']
    for k, v in [('u_exposure', lk['exposure']), ('u_saturation', lk['saturation']), ('u_contrast', lk['contrast']), ('u_vignette', lk['vignette']), ('u_vivid', lk['vivid'])]: S0.set_u(cp, k, v)
    S0.glActiveTexture(0x84C0); S0.glBindTexture(S0.GL_TEXTURE_2D, hdr); glUniform1i(S0.glGetUniformLocation(cp, b'u_scene'), 0)
    S0.glDrawArrays(4, 0, 3); S0.glFinish()
    buf = ctypes.create_string_buffer(W * H * 4)
    S0.glReadPixels(0, 0, W, H, S0.GL_RGBA, S0.GL_UNSIGNED_BYTE, buf)
    img = Image.frombuffer('RGBA', (W, H), buf.raw, 'raw', 'RGBA', 0, 1).transpose(Image.FLIP_TOP_BOTTOM).convert('RGB')
    path = os.path.join(shots, 'worlds_off_' + F['tag'] + '.png'); img.save(path); print('wrote', path)

def mapimg(F, shots):
    W, H = F['W'], F['H']
    img = Image.frombytes('RGB', (W, H), open(F['file'], 'rb').read())
    path = os.path.join(shots, 'worlds_off_' + F['tag'] + '.png'); img.save(path); print('wrote', path)

if __name__ == '__main__':
    shots = os.path.join(HERE, 'shots'); os.makedirs(shots, exist_ok=True)
    inited = False
    for f in sys.argv[1:]:
        F = json.load(open(os.path.join(f, 'frame.json')))
        if F['kind'] == 'sky':
            if not inited: S0.init_egl(); inited = True
            sky(F, shots)
        else: mapimg(F, shots)
