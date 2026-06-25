/*
 * reader_core.h - Phase 3 C ABI/NAPI POC 接口定义。
 *
 * HOS-ADR-001: C ABI/NAPI 为长期可选轨道，先做 POC。
 * POC 不接全量 Core，只接 3 个纯函数级能力。
 *
 * 硬性门槛:
 *   - Toolchain: 能在 HarmonyOS 构建/加载 native module
 *   - ABI: C ABI 稳定，JSON DTO，版本字段，错误码
 *   - Memory: 明确 alloc/free 所有权，无跨语言悬空引用
 *   - Threading: 不暴露 Swift actor/async 到 ArkTS
 *   - Security: 不允许网络、文件、cookie、credential 由 ABI 层直接执行
 *   - CI: 真机/模拟器加载、1000 次调用、错误路径、内存增长检查
 *
 * Clean-room: 不复制 Legado Android 源码，只对齐 Core DTO/契约语义。
 * 本文件为接口定义，不包含实现。
 */

#ifndef READER_CORE_H
#define READER_CORE_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* MARK: - 版本与错误码 */

#define READER_CORE_ABI_VERSION 1

typedef enum {
    READER_CORE_OK = 0,
    READER_CORE_ERROR_INVALID_ARGUMENT = 1,
    READER_CORE_ERROR_INVALID_JSON = 2,
    READER_CORE_ERROR_RULE_EVALUATION_FAILED = 3,
    READER_CORE_ERROR_OUT_OF_MEMORY = 4,
    READER_CORE_ERROR_UNSUPPORTED = 5,
    READER_CORE_ERROR_ABI_VERSION_MISMATCH = 6,
    READER_CORE_ERROR_INTERNAL = 99
} reader_core_error_t;

/* MARK: - 所有权约定
 *
 * - reader_core_apply_replace_rules / reader_core_parse_rule_chain 的 json_response_out
 *   由 ABI 层分配，调用方必须用 reader_core_free 释放。
 * - json_request 由调用方拥有，ABI 层不释放。
 * - 所有字符串以 NUL 结尾 UTF-8。
 */

/* MARK: - 纯函数级 POC 接口（3 个能力 + 1 个 free） */

/*
 * reader_core_version - 返回 ABI 版本和 Core 版本字符串。
 * 调用方不释放返回值（静态字符串）。
 */
const char* reader_core_version(void);

/*
 * reader_core_apply_replace_rules - 应用替换规则。
 *
 * json_request: JSON DTO，格式:
 *   {
 *     "content": "string",
 *     "rules": [
 *       { "id": "string", "pattern": "string", "replacement": "string", "isRegex": bool }
 *     ]
 *   }
 *
 * json_response_out: 输出 JSON DTO，格式:
 *   {
 *     "result": "string",
 *     "appliedCount": int,
 *     "error": null | "error_class"
 *   }
 *
 * 返回: READER_CORE_OK 或错误码。
 * json_response_out 由 ABI 层分配，调用方必须 reader_core_free。
 */
reader_core_error_t reader_core_apply_replace_rules(
    const char* json_request,
    char** json_response_out
);

/*
 * reader_core_parse_rule_chain - 解析规则链。
 *
 * json_request: JSON DTO，格式:
 *   {
 *     "rules": [
 *       { "kind": "css|xpath|jsonpath|template|regex", "expression": "string", "input": "string" }
 *     ]
 *   }
 *
 * json_response_out: 输出 JSON DTO，格式:
 *   {
 *     "results": [
 *       { "values": ["string"], "matchedCount": int, "diagnostics": ["string"] }
 *     ],
 *     "error": null | "error_class"
 *   }
 *
 * 返回: READER_CORE_OK 或错误码。
 * json_response_out 由 ABI 层分配，调用方必须 reader_core_free。
 */
reader_core_error_t reader_core_parse_rule_chain(
    const char* json_request,
    char** json_response_out
);

/*
 * reader_core_free - 释放 ABI 层分配的内存。
 * ptr 为 NULL 时安全无操作。
 */
void reader_core_free(void* ptr);

/* MARK: - 安全约束（硬性）
 *
 * ABI 层不允许直接执行:
 *   - 网络请求 (HTTP/WebSocket)
 *   - 文件读写
 *   - Cookie 存储
 *   - Credential 访问
 *   - WebView 渲染
 *
 * 所有动态能力必须通过 ArkTS Runtime Facade 执行。
 * ABI 层只做纯函数级规则求值。
 */

#ifdef __cplusplus
}
#endif

#endif /* READER_CORE_H */
