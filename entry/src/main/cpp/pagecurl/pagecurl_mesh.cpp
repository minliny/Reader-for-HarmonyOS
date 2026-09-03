#include "pagecurl_mesh.h"

#include <limits>

namespace reader::pagecurl {

bool BuildStaticSheetMesh(
    uint32_t columns,
    uint32_t rows,
    std::vector<SheetMeshVertex>& vertices,
    std::vector<uint16_t>& indices)
{
    vertices.clear();
    indices.clear();
    if (columns < 2 || rows < 2 ||
        static_cast<uint64_t>(columns) * rows > std::numeric_limits<uint16_t>::max()) return false;

    vertices.reserve(static_cast<size_t>(columns) * rows);
    for (uint32_t row = 0; row < rows; ++row) {
        const float v = static_cast<float>(row) / static_cast<float>(rows - 1);
        for (uint32_t column = 0; column < columns; ++column) {
            const float u = static_cast<float>(column) / static_cast<float>(columns - 1);
            vertices.push_back({u, v});
        }
    }

    indices.reserve(static_cast<size_t>(columns - 1) * (rows - 1) * 6);
    for (uint32_t row = 0; row + 1 < rows; ++row) {
        for (uint32_t column = 0; column + 1 < columns; ++column) {
            const uint16_t top_left = static_cast<uint16_t>(row * columns + column);
            const uint16_t top_right = static_cast<uint16_t>(top_left + 1);
            const uint16_t bottom_left = static_cast<uint16_t>((row + 1) * columns + column);
            const uint16_t bottom_right = static_cast<uint16_t>(bottom_left + 1);
            indices.push_back(top_left);
            indices.push_back(bottom_left);
            indices.push_back(top_right);
            indices.push_back(top_right);
            indices.push_back(bottom_left);
            indices.push_back(bottom_right);
        }
    }
    return true;
}

} // namespace reader::pagecurl
