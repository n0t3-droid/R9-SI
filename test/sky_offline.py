#!/usr/bin/env python3
# f-sky4 · draws the frames test/sky_offline.js prepared, with the game's own GLSL (its SKY program, the bloom's prefilter,
# down and up passes, the composite with t-light2's grade), on Mesa's llvmpipe through EGL (headless OpenGL ES 3.2 — no
# browser; u-space0's way, test/space0_offline.py): the sky into an RGBA16F scene like the renderer's, the bloom's five
# levels from half size down, the composite into RGBA8 → out.png in each view's folder. A tool; regress: skip.
#   python3 test/sky_offline.py .tmp_tests/skyoff/<tag>
import ctypes, json, os, sys
os.environ.setdefault('LP_NUM_THREADS', '1')
os.environ.setdefault('EGL_PLATFORM', 'surfaceless')
from PIL import Image

egl = ctypes.CDLL('libEGL.so.1')
gl = ctypes.CDLL('libGLESv2.so.2')
c_void_p, c_int, c_uint, c_float, c_char_p = ctypes.c_void_p, ctypes.c_int, ctypes.c_uint, ctypes.c_float, ctypes.c_char_p

def init_egl():
    egl.eglGetProcAddress.restype = c_void_p
    egl.eglGetProcAddress.argtypes = [c_char_p]
    gpd = ctypes.CFUNCTYPE(c_void_p, c_uint, c_void_p, c_void_p)(egl.eglGetProcAddress(b'eglGetPlatformDisplayEXT'))
    dpy = gpd(0x31DD, None, None)   # EGL_PLATFORM_SURFACELESS_MESA
    egl.eglInitialize.argtypes = [c_void_p, ctypes.POINTER(c_int), ctypes.POINTER(c_int)]
    a, b = c_int(), c_int()
    if not egl.eglInitialize(c_void_p(dpy), ctypes.byref(a), ctypes.byref(b)): raise SystemExit('eglInitialize failed')
    egl.eglBindAPI(0x30A0)
    attrs = (c_int * 3)(0x3040, 0x0040, 0x3038)
    cfg, n = c_void_p(), c_int()
    egl.eglChooseConfig.argtypes = [c_void_p, c_void_p, ctypes.POINTER(c_void_p), c_int, ctypes.POINTER(c_int)]
    egl.eglChooseConfig(c_void_p(dpy), attrs, ctypes.byref(cfg), 1, ctypes.byref(n))
    egl.eglCreateContext.restype = c_void_p
    egl.eglCreateContext.argtypes = [c_void_p, c_void_p, c_void_p, c_void_p]
    ctx = egl.eglCreateContext(c_void_p(dpy), cfg, None, (c_int * 3)(0x3098, 3, 0x3038))
    egl.eglMakeCurrent.argtypes = [c_void_p, c_void_p, c_void_p, c_void_p]
    if not egl.eglMakeCurrent(c_void_p(dpy), None, None, c_void_p(ctx)): raise SystemExit('eglMakeCurrent failed')

def P(name, res, *args):
    f = getattr(gl, name); f.restype = res; f.argtypes = list(args); return f
glCreateShader = P('glCreateShader', c_uint, c_uint)
glShaderSource = P('glShaderSource', None, c_uint, c_int, ctypes.POINTER(c_char_p), c_void_p)
glCompileShader = P('glCompileShader', None, c_uint)
glGetShaderiv = P('glGetShaderiv', None, c_uint, c_uint, ctypes.POINTER(c_int))
glGetShaderInfoLog = P('glGetShaderInfoLog', None, c_uint, c_int, c_void_p, c_char_p)
glCreateProgram = P('glCreateProgram', c_uint)
glAttachShader = P('glAttachShader', None, c_uint, c_uint)
glLinkProgram = P('glLinkProgram', None, c_uint)
glGetProgramiv = P('glGetProgramiv', None, c_uint, c_uint, ctypes.POINTER(c_int))
glGetProgramInfoLog = P('glGetProgramInfoLog', None, c_uint, c_int, c_void_p, c_char_p)
glUseProgram = P('glUseProgram', None, c_uint)
glGetUniformLocation = P('glGetUniformLocation', c_int, c_uint, c_char_p)
glUniform1f = P('glUniform1f', None, c_int, c_float)
glUniform2f = P('glUniform2f', None, c_int, c_float, c_float)
glUniform3f = P('glUniform3f', None, c_int, c_float, c_float, c_float)
glUniform4f = P('glUniform4f', None, c_int, c_float, c_float, c_float, c_float)
glUniform1i = P('glUniform1i', None, c_int, c_int)
glUniform3fv = P('glUniform3fv', None, c_int, c_int, ctypes.POINTER(c_float))
glUniform4fv = P('glUniform4fv', None, c_int, c_int, ctypes.POINTER(c_float))
glUniformMatrix4fv = P('glUniformMatrix4fv', None, c_int, c_int, c_uint, ctypes.POINTER(c_float))
glGenTextures = P('glGenTextures', None, c_int, ctypes.POINTER(c_uint))
glBindTexture = P('glBindTexture', None, c_uint, c_uint)
glTexImage2D = P('glTexImage2D', None, c_uint, c_int, c_int, c_int, c_int, c_int, c_uint, c_uint, c_void_p)
glTexParameteri = P('glTexParameteri', None, c_uint, c_uint, c_int)
glActiveTexture = P('glActiveTexture', None, c_uint)
glGenFramebuffers = P('glGenFramebuffers', None, c_int, ctypes.POINTER(c_uint))
glBindFramebuffer = P('glBindFramebuffer', None, c_uint, c_uint)
glFramebufferTexture2D = P('glFramebufferTexture2D', None, c_uint, c_uint, c_uint, c_uint, c_int)
glCheckFramebufferStatus = P('glCheckFramebufferStatus', c_uint, c_uint)
glViewport = P('glViewport', None, c_int, c_int, c_int, c_int)
glClearColor = P('glClearColor', None, c_float, c_float, c_float, c_float)
glClear = P('glClear', None, c_uint)
glEnable = P('glEnable', None, c_uint)
glDisable = P('glDisable', None, c_uint)
glBlendFunc = P('glBlendFunc', None, c_uint, c_uint)
glGenVertexArrays = P('glGenVertexArrays', None, c_int, ctypes.POINTER(c_uint))
glBindVertexArray = P('glBindVertexArray', None, c_uint)
glDrawArrays = P('glDrawArrays', None, c_uint, c_int, c_int)
glReadPixels = P('glReadPixels', None, c_int, c_int, c_int, c_int, c_uint, c_uint, c_void_p)
glFinish = P('glFinish', None)
glGetError = P('glGetError', c_uint)
GL_TEXTURE_2D, GL_RGBA, GL_UNSIGNED_BYTE, GL_HALF_FLOAT = 0x0DE1, 0x1908, 0x1401, 0x140B
GL_RGBA8, GL_RGBA16F = 0x8058, 0x881A
GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0 = 0x8D40, 0x8CE0
GL_BLEND, GL_ONE, GL_DEPTH_TEST, GL_CULL_FACE = 0x0BE2, 1, 0x0B71, 0x0B44

def shader(kind, src, name):
    s = glCreateShader(kind)
    arr = (c_char_p * 1)(src.encode())
    glShaderSource(s, 1, arr, None); glCompileShader(s)
    ok = c_int(); glGetShaderiv(s, 0x8B81, ctypes.byref(ok))
    if not ok.value:
        log = ctypes.create_string_buffer(16384); glGetShaderInfoLog(s, 16384, None, log)
        print('SHADER COMPILE ERROR', name, log.value.decode(errors='replace')[:3000])
        import re
        lines = src.split('\n')
        for ln in log.value.decode(errors='replace').split('\n')[:6]:
            m = re.search(r'0:(\d+)', ln)
            if m:
                i = int(m.group(1)) - 1
                for k in range(max(0, i - 2), min(len(lines), i + 2)): print('   %5d %s' % (k + 1, lines[k]))
        raise SystemExit(1)
    return s
def program(vs, fs, name):
    a = shader(0x8B31, vs, name + '.vs'); b = shader(0x8B30, fs, name + '.fs')
    p = glCreateProgram(); glAttachShader(p, a); glAttachShader(p, b); glLinkProgram(p)
    ok = c_int(); glGetProgramiv(p, 0x8B82, ctypes.byref(ok))
    if not ok.value:
        log = ctypes.create_string_buffer(8192); glGetProgramInfoLog(p, 8192, None, log); raise SystemExit('LINK ERROR ' + name + ' ' + log.value.decode())
    return p
def tex(w, h, internal, typ):
    t = c_uint(); glGenTextures(1, ctypes.byref(t)); glBindTexture(GL_TEXTURE_2D, t.value)
    glTexImage2D(GL_TEXTURE_2D, 0, internal, w, h, 0, GL_RGBA, typ, None)
    for k, v in ((0x2801, 0x2601), (0x2800, 0x2601), (0x2802, 0x812F), (0x2803, 0x812F)): glTexParameteri(GL_TEXTURE_2D, k, v)
    return t.value
def target(w, h, internal=GL_RGBA16F, typ=GL_HALF_FLOAT):
    t = tex(w, h, internal, typ)
    fb = c_uint(); glGenFramebuffers(1, ctypes.byref(fb)); glBindFramebuffer(GL_FRAMEBUFFER, fb.value)
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, t, 0)
    if glCheckFramebufferStatus(GL_FRAMEBUFFER) != 0x8CD5: raise SystemExit('incomplete target')
    return {'t': t, 'fb': fb.value, 'w': w, 'h': h}
def set_u(p, k, v):
    loc = glGetUniformLocation(p, k.encode())
    if loc < 0: return
    if isinstance(v, dict):
        if 'i' in v: glUniform1i(loc, int(v['i']))
        elif 'v4' in v: glUniform4fv(loc, len(v['v4']) // 4, (c_float * len(v['v4']))(*v['v4']))
        elif 'v3' in v: glUniform3fv(loc, len(v['v3']) // 3, (c_float * len(v['v3']))(*v['v3']))
    elif isinstance(v, (int, float)): glUniform1f(loc, float(v))
    elif len(v) == 2: glUniform2f(loc, *map(float, v))
    elif len(v) == 3: glUniform3f(loc, *map(float, v))
    elif len(v) == 4: glUniform4f(loc, *map(float, v))
    elif len(v) == 16: glUniformMatrix4fv(loc, 1, 0, (c_float * 16)(*v))
def bind(p, name, unit, t):
    loc = glGetUniformLocation(p, name.encode())
    glActiveTexture(0x84C0 + unit); glBindTexture(GL_TEXTURE_2D, t)
    if loc >= 0: glUniform1i(loc, unit)
def full(): glDrawArrays(4, 0, 3)

def render(folder):
    meta = json.load(open(os.path.join(folder, 'views.json')))
    progs = {k: program(s['vs'], s['fs'], k) for k, s in meta['programs'].items()}
    vao = c_uint(); glGenVertexArrays(1, ctypes.byref(vao)); glBindVertexArray(vao.value)
    dummy = tex(1, 1, GL_RGBA16F, GL_HALF_FLOAT)
    for V in meta['views']:
        F = json.load(open(os.path.join(folder, V['name'], 'frame.json')))
        W, H = F['W'], F['H']
        glDisable(GL_DEPTH_TEST); glDisable(GL_CULL_FACE); glDisable(GL_BLEND)
        scene = target(W, H)
        glViewport(0, 0, W, H); glClearColor(0, 0, 0, 1); glClear(0x4000)
        p = progs['sky']; glUseProgram(p)
        for k, v in F['sky'].items(): set_u(p, k, v)
        full()
        if F.get('land'):
            p = progs['land']; glUseProgram(p)
            for k, v in F['land'].items(): set_u(p, k, v)
            full()
        # the bloom (renderer.post): the prefilter at half size, four levels down, then up again added
        levels, bw, bh = [], max(1, W >> 1), max(1, H >> 1)
        for i in range(5): levels.append(target(bw, bh)); bw, bh = max(1, bw >> 1), max(1, bh >> 1)
        if F['bloom']:
            b0 = levels[0]; glBindFramebuffer(GL_FRAMEBUFFER, b0['fb']); glViewport(0, 0, b0['w'], b0['h'])
            p = progs['bloomPre']; glUseProgram(p); bind(p, 'u_src', 0, scene['t']); set_u(p, 'u_texel', [1 / W, 1 / H]); set_u(p, 'u_threshold', F['threshold']); full()
            p = progs['down']; glUseProgram(p)
            for i in range(1, 5):
                s, d = levels[i - 1], levels[i]; glBindFramebuffer(GL_FRAMEBUFFER, d['fb']); glViewport(0, 0, d['w'], d['h'])
                bind(p, 'u_src', 0, s['t']); set_u(p, 'u_texel', [1 / s['w'], 1 / s['h']]); full()
            p = progs['up']; glUseProgram(p); glEnable(GL_BLEND); glBlendFunc(GL_ONE, GL_ONE)
            for i in range(4, 0, -1):
                s, d = levels[i], levels[i - 1]; glBindFramebuffer(GL_FRAMEBUFFER, d['fb']); glViewport(0, 0, d['w'], d['h'])
                bind(p, 'u_src', 0, s['t']); set_u(p, 'u_texel', [1 / s['w'], 1 / s['h']]); set_u(p, 'u_radius', 1.0); full()
            glDisable(GL_BLEND)
        # the composite (the game's, with the grade by the hour and the flare)
        out = target(W, H, GL_RGBA8, GL_UNSIGNED_BYTE)
        glViewport(0, 0, W, H)
        p = progs['composite']; glUseProgram(p)
        bind(p, 'u_scene', 0, scene['t']); bind(p, 'u_bloom', 1, levels[0]['t'] if F['bloom'] else scene['t']); bind(p, 'u_rays', 2, dummy)
        bind(p, 'u_l2Vol', 3, dummy); bind(p, 'u_l2Depth', 4, dummy); set_u(p, 'u_l2VolOn', 0)
        for k, v in F['composite'].items(): set_u(p, k, v)
        full(); glFinish()
        e = glGetError()
        if e: print('GL error', hex(e), V['name'])
        buf = ctypes.create_string_buffer(W * H * 4)
        glReadPixels(0, 0, W, H, GL_RGBA, GL_UNSIGNED_BYTE, buf)
        img = Image.frombuffer('RGBA', (W, H), buf.raw, 'raw', 'RGBA', 0, 1).transpose(Image.FLIP_TOP_BOTTOM).convert('RGB')
        img.save(os.path.join(folder, V['name'], 'out.png'))
        print('drew', V['name'], W, 'x', H)

if __name__ == '__main__':
    init_egl()
    for f in sys.argv[1:]: render(f)
