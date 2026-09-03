#ifndef READER_PAGECURL_PIXEL_BUFFER_H
#define READER_PAGECURL_PIXEL_BUFFER_H

#include <cstdint>
#include <vector>

namespace reader::pagecurl {

struct PixelBuffer {
    uint32_t width = 0;
    uint32_t height = 0;
    std::vector<uint8_t> rgba;

    [[nodiscard]] bool IsValid() const
    {
        return width > 0 && height > 0 && rgba.size() == static_cast<size_t>(width) * height * 4;
    }
};

} // namespace reader::pagecurl

#endif
