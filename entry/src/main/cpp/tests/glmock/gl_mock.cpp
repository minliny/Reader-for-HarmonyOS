// Recording implementation behind the glmock headers. The renderer is
// compiled unchanged against the mock headers and linked with this file, so
// the state log reflects the exact GL command stream the real renderer emits.
#include "gl_mock.h"

#include "EGL/egl.h"
#include "GLES3/gl3.h"

#include <mutex>
#include <string>
#include <vector>

namespace glmock {

std::mutex g_mutex;
std::vector<Entry> g_log;
int g_nextHandle = 1;
bool g_blendEnabled = false;
bool g_depthMaskOn = true;
std::function<void()> g_textureUploadHook;
int g_swapFailureCount = 0;

void SetSwapFailureCount(int count)
{
    std::lock_guard<std::mutex> lock(g_mutex);
    g_swapFailureCount = count;
}

void SetTextureUploadHook(std::function<void()> hook)
{
    std::lock_guard<std::mutex> lock(g_mutex);
    g_textureUploadHook = std::move(hook);
}

void RunTextureUploadHook()
{
    std::function<void()> hook;
    { std::lock_guard<std::mutex> lock(g_mutex); hook = g_textureUploadHook; }
    if (hook) hook();
}

void Reset()
{
    std::lock_guard<std::mutex> lock(g_mutex);
    g_log.clear();
    g_nextHandle = 1;
    g_blendEnabled = false;
    g_depthMaskOn = true;
    g_swapFailureCount = 0;
}

std::vector<Entry> Log()
{
    std::lock_guard<std::mutex> lock(g_mutex);
    return g_log;
}

void Record(const char* name, int64_t a, int64_t b)
{
    std::lock_guard<std::mutex> lock(g_mutex);
    g_log.push_back({ name, a, b });
}

}  // namespace glmock

using namespace glmock;

EGLDisplay eglGetDisplay(EGLNativeDisplayType)
{
    return (EGLDisplay)1;
}

EGLBoolean eglInitialize(EGLDisplay, EGLint*, EGLint*)
{
    return EGL_TRUE;
}

EGLBoolean eglChooseConfig(EGLDisplay, const EGLint*, EGLConfig* configs, EGLint, EGLint* count)
{
    if (configs != nullptr && count != nullptr) {
        configs[0] = (EGLConfig)2;
        *count = 1;
    }
    return EGL_TRUE;
}

EGLContext eglCreateContext(EGLDisplay, EGLConfig, EGLContext, const EGLint*)
{
    return (EGLContext)3;
}

EGLSurface eglCreateWindowSurface(EGLDisplay, EGLConfig, EGLNativeWindowType, const EGLint*)
{
    return (EGLSurface)4;
}

EGLBoolean eglMakeCurrent(EGLDisplay, EGLSurface, EGLSurface, EGLContext)
{
    return EGL_TRUE;
}

EGLBoolean eglSwapBuffers(EGLDisplay, EGLSurface)
{
    Record("eglSwapBuffers", 0, 0);
    std::lock_guard<std::mutex> lock(g_mutex);
    if (g_swapFailureCount > 0) {
        --g_swapFailureCount;
        return EGL_FALSE;
    }
    return EGL_TRUE;
}

EGLBoolean eglSwapInterval(EGLDisplay, EGLint)
{
    Record("eglSwapInterval", 0, 0);
    return EGL_TRUE;
}

EGLBoolean eglDestroySurface(EGLDisplay, EGLSurface)
{
    return EGL_TRUE;
}

EGLBoolean eglDestroyContext(EGLDisplay, EGLContext)
{
    return EGL_TRUE;
}

EGLBoolean eglTerminate(EGLDisplay)
{
    return EGL_TRUE;
}

void glViewport(GLint, GLint, GLsizei, GLsizei) {}

void glClearColor(GLfloat, GLfloat, GLfloat, GLfloat) {}

void glClear(GLbitfield)
{
    Record("glClear", 0, 0);
}

void glEnable(GLenum capability)
{
    if (capability == GL_BLEND && !g_blendEnabled) {
        g_blendEnabled = true;
        Record("BLEND_SWITCH", 1, 0);
    }
    Record("glEnable", capability, 0);
}

void glDisable(GLenum capability)
{
    if (capability == GL_BLEND && g_blendEnabled) {
        g_blendEnabled = false;
        Record("BLEND_SWITCH", 0, 0);
    }
    Record("glDisable", capability, 0);
}

void glDepthFunc(GLenum function)
{
    Record("glDepthFunc", function, 0);
}

void glDepthMask(GLboolean flag)
{
    const bool on = flag != 0;
    if (on != g_depthMaskOn) {
        g_depthMaskOn = on;
        Record("DEPTH_MASK_SWITCH", on ? 1 : 0, 0);
    }
    Record("glDepthMask", on ? 1 : 0, 0);
}

void glBlendFunc(GLenum source, GLenum destination)
{
    Record("glBlendFunc", source, destination);
}

void glBlendFuncSeparate(GLenum sourceRGB, GLenum destinationRGB, GLenum sourceAlpha,
    GLenum destinationAlpha)
{
    Record("glBlendFuncSeparate", sourceRGB, destinationRGB);
    Record("glBlendFuncSeparateAlpha", sourceAlpha, destinationAlpha);
}

void glActiveTexture(GLenum unit)
{
    Record("glActiveTexture", unit, 0);
}

void glBindTexture(GLenum target, GLuint texture)
{
    Record("glBindTexture", target, texture);
}

void glUniform4fv(GLint location, GLsizei count, const GLfloat* values)
{
    (void)values;
    Record("glUniform4fv", location, count);
}

void glUniform1i(GLint location, GLint value)
{
    Record("glUniform1i", location, value);
}

void glUniform1f(GLint location, GLfloat value)
{
    (void)value;
    Record("glUniform1f", location, 0);
}

void glUniform2f(GLint location, GLfloat x, GLfloat y)
{
    Record("glUniform2f", location, (int64_t)(x * 100.0F) * 10000 + (int64_t)(y * 100.0F));
}

void glUniform3f(GLint location, GLfloat x, GLfloat y, GLfloat z)
{
    (void)x;
    (void)y;
    (void)z;
    Record("glUniform3f", location, 0);
}

GLint glGetUniformLocation(GLuint program, const GLchar* name)
{
    const GLint location = g_nextHandle++;
    Record("glGetUniformLocation", program, location);
    (void)name;
    return location;
}

GLuint glCreateShader(GLenum type)
{
    return (GLuint)(g_nextHandle++ * 10 + (type == GL_VERTEX_SHADER ? 1 : 2));
}

void glDeleteShader(GLuint) {}

void glShaderSource(GLuint, GLsizei, const GLchar* const*, const GLint*) {}

void glCompileShader(GLuint) {}

void glGetShaderiv(GLuint, GLenum, GLint* value)
{
    *value = GL_TRUE;
}

GLuint glCreateProgram()
{
    return (GLuint)g_nextHandle++;
}

void glAttachShader(GLuint, GLuint) {}

void glLinkProgram(GLuint) {}

void glGetProgramiv(GLuint, GLenum, GLint* value)
{
    *value = GL_TRUE;
}

void glDeleteProgram(GLuint) {}

void glUseProgram(GLuint program)
{
    Record("glUseProgram", program, 0);
}

void glGenVertexArrays(GLsizei count, GLuint* arrays)
{
    for (GLsizei index = 0; index < count; ++index) {
        arrays[index] = (GLuint)g_nextHandle++;
    }
}

void glDeleteVertexArrays(GLsizei, const GLuint*) {}

void glBindVertexArray(GLuint array)
{
    Record("glBindVertexArray", array, 0);
}

void glGenBuffers(GLsizei count, GLuint* buffers)
{
    for (GLsizei index = 0; index < count; ++index) {
        buffers[index] = (GLuint)g_nextHandle++;
    }
}

void glDeleteBuffers(GLsizei, const GLuint*) {}

void glBindBuffer(GLenum, GLuint) {}

void glBufferData(GLenum, GLsizeiptr, const void*, GLenum) {}

void glGenTextures(GLsizei count, GLuint* textures)
{
    for (GLsizei index = 0; index < count; ++index) {
        textures[index] = (GLuint)g_nextHandle++;
    }
}

void glDeleteTextures(GLsizei, const GLuint*) {}

void glTexParameteri(GLenum, GLenum, GLint) {}

void glVertexAttribPointer(GLuint, GLint, GLenum, GLboolean, GLsizei, const void*) {}

void glEnableVertexAttribArray(GLuint) {}

void glPixelStorei(GLenum, GLint) {}

void glTexImage2D(GLenum, GLint, GLint, GLsizei, GLsizei, GLint, GLenum, GLenum, const void*)
{
    RunTextureUploadHook();
    Record("glTexImage2D", 0, 0);
}

GLenum glGetError()
{
    return GL_NO_ERROR;
}

void glDrawArrays(GLenum mode, GLint first, GLsizei count)
{
    Record("glDrawArrays", mode, (int64_t)first << 32 | count);
}

void glDrawElements(GLenum mode, GLsizei count, GLenum type, const void* indices)
{
    (void)indices;
    Record("glDrawElements", mode, (int64_t)count << 32 | type);
}
