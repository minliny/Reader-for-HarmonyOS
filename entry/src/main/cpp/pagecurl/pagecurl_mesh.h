/* Static material mesh for the PageCurl V2 vertex-shader deformation. */
#ifndef READER_PAGECURL_MESH_H
#define READER_PAGECURL_MESH_H

#include <cstdint>
#include <vector>

namespace reader::pagecurl {

struct SheetMeshVertex {
    float u = 0.0F;
    float v = 0.0F;
};

/** Builds one immutable indexed page grid. No per-frame vertex work is needed. */
bool BuildStaticSheetMesh(
    uint32_t columns,
    uint32_t rows,
    std::vector<SheetMeshVertex>& vertices,
    std::vector<uint16_t>& indices);

} // namespace reader::pagecurl

#endif
