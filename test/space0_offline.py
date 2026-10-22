#!/usr/bin/env python3
# u-space0 · draws a frame that test/space0_offline.js wrote, with the game's own GLSL, on Mesa's llvmpipe through EGL
# (headless OpenGL ES 3.2 — no browser), into an RGBA16F target like the renderer's scene buffer, then tone-maps it as
# the composite does (exposure, ACES blended with the hue-keeping curve by `vivid`, saturation, contrast, vignette,
# gamma 2.2) and writes test/shots/space0_off_<tag>.png. A tool for tuning between the browser runs; regress: skip.
#   python3 test/space0_offline.py .tmp_tests/space0_off/<tag> [more folders …]
import ctypes, json, os, sys, struct
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
    attrs = (c_int * 3)(0x3040, 0x0040, 0x3038)   # RENDERABLE_TYPE = OPENGL_ES3
    cfg, n = c_void_p(), c_int()
    egl.eglChooseConfig.argtypes = [c_void_p, c_void_p, ctypes.POINTER(c_void_p), c_int, ctypes.POINTER(c_int)]
    egl.eglChooseConfig(c_void_p(dpy), attrs, ctypes.byref(cfg), 1, ctypes.byref(n))
    egl.eglCreateContext.restype = c_void_p
    egl.eglCreateContext.argtypes = [c_void_p, c_void_p, c_void_p, c_void_p]
    ctx = egl.eglCreateContext(c_void_p(dpy), cfg, None, (c_int * 3)(0x3098, 3, 0x3038))
    egl.eglMakeCurrent.argtypes = [c_void_p, c_void_p, c_void_p, c_void_p]
    if not egl.eglMakeCurrent(c_void_p(dpy), None, None, c_void_p(ctx)): raise SystemExit('eglMakeCurrent failed')

# ---- the GL entry points we use
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
glUniformMatrix3fv = P('glUniformMatrix3fv', None, c_int, c_int, c_uint, ctypes.POINTER(c_float))
glUniformMatrix4fv = P('glUniformMatrix4fv', None, c_int, c_int, c_uint, ctypes.POINTER(c_float))
glGenTextures = P('glGenTextures', None, c_int, ctypes.POINTER(c_uint))
glBindTexture = P('glBindTexture', None, c_uint, c_uint)
glTexImage2D = P('glTexImage2D', None, c_uint, c_int, c_int, c_int, c_int, c_int, c_uint, c_uint, c_void_p)
glTexParameteri = P('glTexParameteri', None, c_uint, c_uint, c_int)
glGenerateMipmap = P('glGenerateMipmap', None, c_uint)
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
GL_TEXTURE_2D, GL_RGBA, GL_UNSIGNED_BYTE, GL_FLOAT, GL_HALF_FLOAT = 0x0DE1, 0x1908, 0x1401, 0x1406, 0x140B
GL_SRGB8_ALPHA8, GL_RGBA8, GL_RGBA16F = 0x8C43, 0x8058, 0x881A
GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0 = 0x8D40, 0x8CE0
GL_BLEND, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_DEPTH_TEST, GL_CULL_FACE = 0x0BE2, 1, 0x0303, 0x0B71, 0x0B44

def shader(kind, src, name):
    s = glCreateShader(kind)
    b = src.encode(); arr = (c_char_p * 1)(b)
    glShaderSource(s, 1, arr, None); glCompileShader(s)
    ok = c_int(); glGetShaderiv(s, 0x8B81, ctypes.byref(ok))
    if not ok.value:
        log = ctypes.create_string_buffer(8192); glGetShaderInfoLog(s, 8192, None, log)
        print('SHADER COMPILE ERROR', name, log.value.decode(errors='replace'))
        lines = src.split('\n')
        for ln in log.value.decode(errors='replace').split('\n'):
            import re
            m = re.search(r'0:(\d+)', ln)
            if m:
                i = int(m.group(1)) - 1
                for k in range(max(0, i - 2), min(len(lines), i + 2)): print('   %4d %s' % (k + 1, lines[k]))
        return None
    return s
def program(vs, fs, name):
    a = shader(0x8B31, vs, name + '.vs'); b = shader(0x8B30, fs, name + '.fs')
    if not a or not b: return None
    p = glCreateProgram(); glAttachShader(p, a); glAttachShader(p, b); glLinkProgram(p)
    ok = c_int(); glGetProgramiv(p, 0x8B82, ctypes.byref(ok))
    if not ok.value:
        log = ctypes.create_string_buffer(8192); glGetProgramInfoLog(p, 8192, None, log); print('LINK ERROR', name, log.value.decode()); return None
    return p
def tex(w, h, internal, fmt, typ, data, mip, repeat):
    t = c_uint(); glGenTextures(1, ctypes.byref(t)); glBindTexture(GL_TEXTURE_2D, t.value)
    glTexImage2D(GL_TEXTURE_2D, 0, internal, w, h, 0, fmt, typ, data)
    if mip: glGenerateMipmap(GL_TEXTURE_2D)
    glTexParameteri(GL_TEXTURE_2D, 0x2801, 0x2703 if mip else 0x2601)   # MIN: LINEAR_MIPMAP_LINEAR | LINEAR
    glTexParameteri(GL_TEXTURE_2D, 0x2800, 0x2601)
    glTexParameteri(GL_TEXTURE_2D, 0x2802, 0x2901 if repeat else 0x812F)
    glTexParameteri(GL_TEXTURE_2D, 0x2803, 0x812F)
    return t.value
def set_u(p, k, v):
    loc = glGetUniformLocation(p, k.encode())
    if loc < 0: return
    if isinstance(v, (int, float)): glUniform1f(loc, float(v))
    elif len(v) == 2: glUniform2f(loc, *map(float, v))
    elif len(v) == 3: glUniform3f(loc, *map(float, v))
    elif len(v) == 4: glUniform4f(loc, *map(float, v))
    elif len(v) == 9: glUniformMatrix3fv(loc, 1, 0, (c_float * 9)(*v))
    elif len(v) == 16: glUniformMatrix4fv(loc, 1, 0, (c_float * 16)(*v))

COMP_VS = '''#version 300 es
out vec2 v_uv;
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); v_uv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }'''
COMP_FS = '''#version 300 es
precision highp float;
uniform sampler2D u_scene; uniform float u_exposure, u_saturation, u_contrast, u_vignette, u_vivid;
in vec2 v_uv; out vec4 o;
vec3 aces(vec3 x) { const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
float acesL(float x) { const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
vec3 tonemap(vec3 x) { vec3 f = aces(x); if (u_vivid <= 0.0) return f; float l = dot(x, vec3(0.2126, 0.7152, 0.0722)); vec3 h = x * (acesL(l) / max(l, 1e-5)); float m = max(h.r, max(h.g, h.b)); if (m > 1.0) h = mix(h / m, vec3(1.0), clamp((m - 1.0) * 0.35, 0.0, 1.0)); return mix(f, clamp(h, 0.0, 1.0), u_vivid); }
void main() {
  vec3 c = texture(u_scene, v_uv).rgb * u_exposure;
  c = tonemap(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, u_saturation);
  c = clamp(c, 0.0, 1.0); c = mix(c, c * c * (3.0 - 2.0 * c), u_contrast);
  vec2 vc = v_uv - 0.5; c *= 1.0 - dot(vc, vc) * u_vignette;
  o = vec4(pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}'''

def render(folder, shots):
    F = json.load(open(os.path.join(folder, 'frame.json')))
    W, H = F['W'], F['H']
    textures = {}
    for name, ti in F['textures'].items():
        data = open(ti['file'], 'rb').read()
        textures[name] = tex(ti['w'], ti['h'], GL_SRGB8_ALPHA8 if ti['srgb'] else GL_RGBA8, GL_RGBA, GL_UNSIGNED_BYTE, data, True, ti['repeat'])
    progs = {}
    for k, s in F['programs'].items(): progs[k] = program(s['vs'], s['fs'], k)
    hdr = tex(W, H, GL_RGBA16F, GL_RGBA, GL_HALF_FLOAT, None, False, False)
    fb = c_uint(); glGenFramebuffers(1, ctypes.byref(fb)); glBindFramebuffer(GL_FRAMEBUFFER, fb.value)
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, hdr, 0)
    if glCheckFramebufferStatus(GL_FRAMEBUFFER) != 0x8CD5: raise SystemExit('the HDR target is incomplete')
    glViewport(0, 0, W, H); glClearColor(0, 0, 0, 1); glClear(0x4000)
    vao = c_uint(); glGenVertexArrays(1, ctypes.byref(vao)); glBindVertexArray(vao.value)
    glDisable(GL_DEPTH_TEST); glDisable(GL_CULL_FACE)
    for d in F['draws']:
        p = progs.get(d['prog'])
        if not p: continue
        glUseProgram(p)
        if d['prog'] == 'bg': glDisable(GL_BLEND)
        else:
            glEnable(GL_BLEND); glBlendFunc(GL_ONE, GL_ONE if d.get('add') else GL_ONE_MINUS_SRC_ALPHA)
        set_u(p, 'u_viewProj', F['viewProj']); set_u(p, 'u_invViewProj', F['invViewProj'])
        for k, v in d['u'].items(): set_u(p, k, v)
        unit = 0
        for k, name in d.get('tex', {}).items():
            loc = glGetUniformLocation(p, k.encode())
            if loc < 0: continue
            glActiveTexture(0x84C0 + unit); glBindTexture(GL_TEXTURE_2D, textures.get(name, 0)); glUniform1i(loc, unit); unit += 1
        glDrawArrays(4, 0, 3 if d.get('full') else 6)
    e = glGetError()
    if e: print('GL error', hex(e))
    # the composite
    ldr = tex(W, H, GL_RGBA8, GL_RGBA, GL_UNSIGNED_BYTE, None, False, False)
    fb2 = c_uint(); glGenFramebuffers(1, ctypes.byref(fb2)); glBindFramebuffer(GL_FRAMEBUFFER, fb2.value)
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, ldr, 0)
    glDisable(GL_BLEND)
    cp = program(COMP_VS, COMP_FS, 'composite'); glUseProgram(cp)
    lk = F['look']
    for k, v in [('u_exposure', lk['exposure']), ('u_saturation', lk['saturation']), ('u_contrast', lk['contrast']), ('u_vignette', lk['vignette']), ('u_vivid', lk['vivid'])]: set_u(cp, k, v)
    glActiveTexture(0x84C0); glBindTexture(GL_TEXTURE_2D, hdr); glUniform1i(glGetUniformLocation(cp, b'u_scene'), 0)
    glDrawArrays(4, 0, 3); glFinish()
    buf = ctypes.create_string_buffer(W * H * 4)
    glReadPixels(0, 0, W, H, GL_RGBA, GL_UNSIGNED_BYTE, buf)
    img = Image.frombuffer('RGBA', (W, H), buf.raw, 'raw', 'RGBA', 0, 1).transpose(Image.FLIP_TOP_BOTTOM).convert('RGB')
    path = os.path.join(shots, 'space0_off_' + F['tag'] + '.png')
    img.save(path); print('wrote', path)

if __name__ == '__main__':
    init_egl()
    shots = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots'); os.makedirs(shots, exist_ok=True)
    for f in sys.argv[1:]: render(f, shots)
