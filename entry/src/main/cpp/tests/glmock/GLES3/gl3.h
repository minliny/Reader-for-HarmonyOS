// Minimal GLES3 mock for standalone renderer tests (not part of the HAP
// build). Only the symbols bookturn_renderer.cpp actually uses are declared;
// any renderer use of an unlisted capability (FBOs, MSAA, blits, readback)
// fails the link, which is itself a structural assertion of contract 13.3-4.
#ifndef READER_TEST_GLMOCK_GLES3_H
#define READER_TEST_GLMOCK_GLES3_H

#include <stddef.h>
#include <stdint.h>

typedef uint32_t GLenum;
typedef uint32_t GLuint;
typedef uint32_t GLbitfield;
typedef int32_t GLint;
typedef int32_t GLsizei;
typedef uint8_t GLboolean;
typedef float GLfloat;
typedef uint8_t GLubyte;
typedef char GLchar;
typedef uint16_t GLushort;
typedef ptrdiff_t GLsizeiptr;
typedef ptrdiff_t GLintptr;
typedef uint64_t GLuint64;

#define GL_FALSE 0
#define GL_TRUE 1
#define GL_NO_ERROR 0
#define GL_BLEND 0x0BE2
#define GL_CULL_FACE 0x0B44
#define GL_DEPTH_TEST 0x0B71
#define GL_MULTISAMPLE 0x809D
#define GL_SRC_ALPHA 0x0302
#define GL_ONE_MINUS_SRC_ALPHA 0x0303
#define GL_LEQUAL 0x0203
#define GL_COLOR_BUFFER_BIT 0x00004000
#define GL_DEPTH_BUFFER_BIT 0x00000100
#define GL_VERTEX_SHADER 0x8B31
#define GL_FRAGMENT_SHADER 0x8B20
#define GL_COMPILE_STATUS 0x8B81
#define GL_LINK_STATUS 0x8B82
#define GL_FLOAT 0x1406
#define GL_STATIC_DRAW 0x88E4
#define GL_ARRAY_BUFFER 0x8892
#define GL_ELEMENT_ARRAY_BUFFER 0x8893
#define GL_TRIANGLE_STRIP 0x0005
#define GL_TRIANGLES 0x0004
#define GL_LINEAR 0x2601
#define GL_TEXTURE_MIN_FILTER 0x2801
#define GL_TEXTURE_MAG_FILTER 0x2800
#define GL_CLAMP_TO_EDGE 0x812F
#define GL_TEXTURE_WRAP_S 0x2802
#define GL_TEXTURE_WRAP_T 0x2803
#define GL_ACTIVE_TEXTURE 0x84E0
#define GL_TEXTURE0 0x84C0
#define GL_TEXTURE_2D 0x0DE1
#define GL_UNPACK_ALIGNMENT 0x0CF5
#define GL_RGB 0x1907
#define GL_RGB8 0x8051
#define GL_UNSIGNED_BYTE 0x1401
#define GL_UNSIGNED_SHORT 0x1403
#define GL_DEPTH_WRITEMASK 0x0B72

#ifdef __cplusplus
extern "C" {
#endif

void glViewport(GLint x, GLint y, GLsizei width, GLsizei height);
void glClearColor(GLfloat red, GLfloat green, GLfloat blue, GLfloat alpha);
void glClear(GLbitfield mask);
void glEnable(GLenum capability);
void glDisable(GLenum capability);
void glDepthFunc(GLenum function);
void glDepthMask(GLboolean flag);
void glBlendFunc(GLenum source, GLenum destination);
void glActiveTexture(GLenum unit);
void glBindTexture(GLenum target, GLuint texture);
void glUniform1i(GLint location, GLint value);
void glUniform1f(GLint location, GLfloat value);
void glUniform2f(GLint location, GLfloat x, GLfloat y);
void glUniform3f(GLint location, GLfloat x, GLfloat y, GLfloat z);
GLint glGetUniformLocation(GLuint program, const GLchar* name);
GLuint glCreateShader(GLenum type);
void glDeleteShader(GLuint shader);
void glShaderSource(GLuint shader, GLsizei count, const GLchar* const* source, const GLint* length);
void glCompileShader(GLuint shader);
void glGetShaderiv(GLuint shader, GLenum parameter, GLint* value);
GLuint glCreateProgram();
void glAttachShader(GLuint program, GLuint shader);
void glLinkProgram(GLuint program);
void glGetProgramiv(GLuint program, GLenum parameter, GLint* value);
void glDeleteProgram(GLuint program);
void glUseProgram(GLuint program);
void glGenVertexArrays(GLsizei count, GLuint* arrays);
void glDeleteVertexArrays(GLsizei count, const GLuint* arrays);
void glBindVertexArray(GLuint array);
void glGenBuffers(GLsizei count, GLuint* buffers);
void glDeleteBuffers(GLsizei count, const GLuint* buffers);
void glBindBuffer(GLenum target, GLuint buffer);
void glBufferData(GLenum target, GLsizeiptr size, const void* data, GLenum usage);
void glGenTextures(GLsizei count, GLuint* textures);
void glDeleteTextures(GLsizei count, const GLuint* textures);
void glTexParameteri(GLenum target, GLenum name, GLint value);
void glVertexAttribPointer(GLuint index, GLint size, GLenum type, GLboolean normalized,
    GLsizei stride, const void* pointer);
void glEnableVertexAttribArray(GLuint index);
void glPixelStorei(GLenum name, GLint value);
void glTexImage2D(GLenum target, GLint level, GLint internalFormat, GLsizei width, GLsizei height,
    GLint border, GLenum format, GLenum type, const void* pixels);
GLenum glGetError();
void glDrawArrays(GLenum mode, GLint first, GLsizei count);
void glDrawElements(GLenum mode, GLsizei count, GLenum type, const void* indices);

#ifdef __cplusplus
}
#endif

#endif  // READER_TEST_GLMOCK_GLES3_H
