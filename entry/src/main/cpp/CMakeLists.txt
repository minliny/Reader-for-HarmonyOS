cmake_minimum_required(VERSION 3.5.0)
project(reader_pagecurl)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
add_definitions(-DOHOS_PLATFORM)

add_library(pagecurl SHARED
    napi_init.cpp
    pagecurl/pagecurl_motion.cpp
    pagecurl/pagecurl_engine.cpp
    pagecurl/pagecurl_mesh.cpp
    pagecurl/pagecurl_renderer.cpp
    pagecurl/pagecurl_native_host.cpp
)

target_include_directories(pagecurl PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})

find_library(EGL_LIB EGL)
find_library(GLES_LIB GLESv3)
find_library(ACE_NDK_LIB ace_ndk.z)
find_library(ACE_NAPI_LIB ace_napi.z)
find_library(VSYNC_LIB native_vsync)
find_library(PIXELMAP_LIB pixelmap_ndk.z)

target_link_libraries(pagecurl PUBLIC
    ${EGL_LIB}
    ${GLES_LIB}
    ${ACE_NDK_LIB}
    ${ACE_NAPI_LIB}
    ${VSYNC_LIB}
    ${PIXELMAP_LIB}
)
