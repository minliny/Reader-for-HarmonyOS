// Minimal EGL mock for standalone renderer tests (not part of the HAP build).
// Signatures mirror the real EGL headers; the implementation lives in
// gl_mock.cpp and records every call for the state-assertion test.
#ifndef READER_TEST_GLMOCK_EGL_H
#define READER_TEST_GLMOCK_EGL_H

#include <cstdint>

typedef void* EGLDisplay;
typedef void* EGLSurface;
typedef void* EGLContext;
typedef void* EGLConfig;
typedef void* EGLNativeDisplayType;
typedef void* EGLNativeWindowType;
typedef void* EGLNativePixmapType;
typedef int32_t EGLint;
typedef uint32_t EGLBoolean;
typedef uint32_t EGLenum;

#define EGL_DEFAULT_DISPLAY ((EGLNativeDisplayType)0)
#define EGL_NO_DISPLAY ((EGLDisplay)0)
#define EGL_NO_SURFACE ((EGLSurface)0)
#define EGL_NO_CONTEXT ((EGLContext)0)
#define EGL_TRUE 1
#define EGL_FALSE 0
#define EGL_SURFACE_TYPE 0x3033
#define EGL_WINDOW_BIT 0x0004
#define EGL_RENDERABLE_TYPE 0x3040
#define EGL_OPENGL_ES3_BIT 0x0040
#define EGL_RED_SIZE 0x3024
#define EGL_GREEN_SIZE 0x3023
#define EGL_BLUE_SIZE 0x3022
#define EGL_ALPHA_SIZE 0x3021
#define EGL_DEPTH_SIZE 0x3025
#define EGL_NONE 0x3038
#define EGL_CONTEXT_CLIENT_VERSION 0x3098

#ifdef __cplusplus
extern "C" {
#endif

EGLDisplay eglGetDisplay(EGLNativeDisplayType display);
EGLBoolean eglInitialize(EGLDisplay display, EGLint* major, EGLint* minor);
EGLBoolean eglChooseConfig(EGLDisplay display, const EGLint* attributes, EGLConfig* configs,
    EGLint configSize, EGLint* configCount);
EGLContext eglCreateContext(EGLDisplay display, EGLConfig config, EGLContext share,
    const EGLint* attributes);
EGLSurface eglCreateWindowSurface(EGLDisplay display, EGLConfig config,
    EGLNativeWindowType window, const EGLint* attributes);
EGLBoolean eglMakeCurrent(EGLDisplay display, EGLSurface draw, EGLSurface read, EGLContext context);
EGLBoolean eglSwapBuffers(EGLDisplay display, EGLSurface surface);
EGLBoolean eglDestroySurface(EGLDisplay display, EGLSurface surface);
EGLBoolean eglDestroyContext(EGLDisplay display, EGLContext context);
EGLBoolean eglTerminate(EGLDisplay display);

#ifdef __cplusplus
}
#endif

#endif  // READER_TEST_GLMOCK_EGL_H
