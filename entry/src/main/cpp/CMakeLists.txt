cmake_minimum_required(VERSION 3.16)

project(reader_bookturn_harmony_napi LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(reader_bookturn_napi SHARED
  bookturn/bookturn_host.cpp
  bookturn/bookturn_motion.cpp
  bookturn/bookturn_napi.cpp
  bookturn/bookturn_renderer.cpp
  bookturn/bookturn_solver.cpp)

target_include_directories(reader_bookturn_napi PRIVATE
  "${CMAKE_CURRENT_LIST_DIR}/bookturn")

find_library(ACE_NAPI_LIB ace_napi.z REQUIRED)
find_library(ACE_NDK_LIB ace_ndk.z REQUIRED)
find_library(EGL_LIB EGL REQUIRED)
find_library(GLES_V3_LIB GLESv3 REQUIRED)
find_library(NATIVE_VSYNC_LIB native_vsync REQUIRED)
find_library(NATIVE_WINDOW_LIB native_window REQUIRED)
find_library(PIXELMAP_LIB pixelmap REQUIRED)

target_link_libraries(reader_bookturn_napi PRIVATE
  ${ACE_NAPI_LIB}
  ${ACE_NDK_LIB}
  ${EGL_LIB}
  ${GLES_V3_LIB}
  ${NATIVE_VSYNC_LIB}
  ${NATIVE_WINDOW_LIB}
  ${PIXELMAP_LIB})

target_compile_options(reader_bookturn_napi PRIVATE
  -Wall
  -Wextra
  -Werror
  -Wno-error=unused-command-line-argument)

set_target_properties(reader_bookturn_napi PROPERTIES
  OUTPUT_NAME "reader_bookturn_napi")
