cmake_minimum_required(VERSION 3.5.0)
project(reader_core_napi)

set(NATIVERENDER_ROOT_PATH ${CMAKE_CURRENT_SOURCE_DIR})

if(DEFINED PACKAGE_FIND_FILE)
    include(${PACKAGE_FIND_FILE})
endif()

if(NOT OHOS_ARCH STREQUAL "arm64-v8a")
    message(FATAL_ERROR "reader_core_napi currently supports arm64-v8a only, got ${OHOS_ARCH}")
endif()

get_filename_component(READER_HARMONY_ROOT
    "${CMAKE_CURRENT_SOURCE_DIR}/../../../.." ABSOLUTE)
get_filename_component(READER_CORE_NATIVE_ROOT
    "${READER_HARMONY_ROOT}/../Reader-Core-Native" ABSOLUTE)

set(READER_CORE_STATICLIB
    "${READER_CORE_NATIVE_ROOT}/target/aarch64-unknown-linux-ohos/release/libreader_core.a")

execute_process(
    COMMAND "${READER_CORE_NATIVE_ROOT}/scripts/build-ohos.sh"
    WORKING_DIRECTORY "${READER_CORE_NATIVE_ROOT}"
    RESULT_VARIABLE READER_CORE_BUILD_RESULT
)

if(NOT READER_CORE_BUILD_RESULT EQUAL 0)
    message(FATAL_ERROR "Reader-Core-Native OHOS staticlib build failed")
endif()

if(NOT EXISTS "${READER_CORE_STATICLIB}")
    message(FATAL_ERROR "Missing ${READER_CORE_STATICLIB}")
endif()

add_library(reader_core_static STATIC IMPORTED GLOBAL)
set_target_properties(reader_core_static PROPERTIES
    IMPORTED_LOCATION "${READER_CORE_STATICLIB}")

include_directories(
    ${NATIVERENDER_ROOT_PATH}
    ${NATIVERENDER_ROOT_PATH}/include
    ${READER_CORE_NATIVE_ROOT}/include
)

add_library(reader_core_napi SHARED reader_napi.cpp)
target_link_libraries(reader_core_napi PUBLIC reader_core_static libace_napi.z.so)
