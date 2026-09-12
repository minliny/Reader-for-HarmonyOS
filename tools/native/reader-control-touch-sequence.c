/* Standalone diagnostic, never linked into Reader. No HDC, service or network.
 * Compile READER_CONTROL_DRY_ONLY on the host to validate the same parser.
 * Real injection requires explicit flags AND a fresh public-API authorization.
 */
#define _POSIX_C_SOURCE 200809L
#include <stdbool.h>
#include <errno.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#ifndef READER_CONTROL_DRY_ONLY
#include <stdatomic.h>
#include <multimodalinput/oh_input_manager.h>
#endif

#define MAX_STEPS 256
#define MAX_DURATION_MS 10000
typedef enum { STEP_DOWN, STEP_MOVE, STEP_UP, STEP_CANCEL } StepAction;
typedef struct { int at_ms; StepAction action; int finger; int x; int y; } Step;
typedef struct { bool active; int x; int y; } Finger;
#ifndef READER_CONTROL_DRY_ONLY
static volatile sig_atomic_t interrupted = 0;
static const char *action_name(StepAction action)
{
    const char *names[] = { "DOWN", "MOVE", "UP", "CANCEL" };
    return names[action];
}
#endif

static int parse_positive(const char *s, int maximum)
{
    char *end = NULL;
    errno = 0;
    long value = strtol(s, &end, 10);
    return errno || end == s || *end || value <= 0 || value > maximum ? -1 : (int)value;
}

static int parse_nonnegative(const char *s, int maximum)
{
    if (!*s) return -1;
    for (const char *p = s; *p; p++) if (*p < '0' || *p > '9') return -1;
    char *end = NULL;
    errno = 0;
    long value = strtol(s, &end, 10);
    return errno || *end || value < 0 || value > maximum ? -1 : (int)value;
}

/* Parse the ENTIRE stream before requesting authorization or injecting DOWN.
 * Rows: milliseconds_from_start ACTION finger_id display_x display_y.
 * Time gaps are actual stationary holds; MOVE is one sample, no interpolation.
 */
static int read_plan(FILE *input, int width, int height, Step *steps)
{
    char line[160];
    int count = 0, line_number = 0, previous_ms = -1;
    bool active[2] = { false, false }, cancelling = false;
    while (fgets(line, sizeof(line), input)) {
        line_number++;
        if (!strchr(line, '\n') && !feof(input)) {
            fprintf(stderr, "invalid plan line %d: too long\n", line_number);
            return -1;
        }
        if (line[0] == '#' || line[0] == '\n') continue;
        char at_token[16], finger_token[16], x_token[16], y_token[16], action[12], tail;
        if (sscanf(line, "%15s %11s %15s %15s %15s %c", at_token, action, finger_token, x_token, y_token, &tail) != 5) {
            fprintf(stderr, "invalid plan line %d: fields\n", line_number);
            return -1;
        }
        int at = parse_nonnegative(at_token, MAX_DURATION_MS), finger = parse_nonnegative(finger_token, 1);
        int x = parse_nonnegative(x_token, width - 1), y = parse_nonnegative(y_token, height - 1);
        if (count >= MAX_STEPS || at < 0 || at < previous_ms || finger < 0 || x < 0 || y < 0) {
            fprintf(stderr, "invalid plan line %d: fields/range/order\n", line_number);
            return -1;
        }
        StepAction kind;
        if (!strcmp(action, "DOWN")) kind = STEP_DOWN;
        else if (!strcmp(action, "MOVE")) kind = STEP_MOVE;
        else if (!strcmp(action, "UP")) kind = STEP_UP;
        else if (!strcmp(action, "CANCEL")) kind = STEP_CANCEL;
        else { fprintf(stderr, "invalid plan line %d: action\n", line_number); return -1; }
        if (cancelling && (kind != STEP_CANCEL || at != previous_ms)) {
            fprintf(stderr, "invalid plan line %d: CANCEL must be the terminal release group\n", line_number);
            return -1;
        }
        if ((kind == STEP_DOWN) == active[finger]) {
            fprintf(stderr, "invalid plan line %d: pointer ownership\n", line_number);
            return -1;
        }
        if (kind == STEP_DOWN) active[finger] = true;
        if (kind == STEP_UP || kind == STEP_CANCEL) active[finger] = false;
        if (kind == STEP_CANCEL) cancelling = true;
        steps[count++] = (Step){ at, kind, finger, x, y };
        previous_ms = at;
    }
    if (ferror(input) || count == 0 || active[0] || active[1]) {
        fprintf(stderr, "invalid plan: empty/read error/unreleased pointer\n");
        return -1;
    }
    return count;
}

#ifndef READER_CONTROL_DRY_ONLY
static atomic_int callback_status = ATOMIC_VAR_INIT(-1);
static void on_authorization(Input_InjectionStatus status) { atomic_store(&callback_status, status); }
static void on_signal(int number) { interrupted = number; }
static int64_t monotonic_ns(void)
{
    struct timespec now;
    if (clock_gettime(CLOCK_MONOTONIC, &now) != 0) return -1;
    return (int64_t)now.tv_sec * INT64_C(1000000000) + now.tv_nsec;
}
static bool wait_until(int64_t deadline)
{
    while (!interrupted) {
        int64_t now = monotonic_ns();
        if (now < 0) return false;
        int64_t remaining = deadline - now;
        if (remaining <= 0) return true;
        if (remaining > INT64_C(20000000)) remaining = INT64_C(20000000);
        struct timespec delay = { 0, (long)remaining };
        if (nanosleep(&delay, NULL) != 0 && errno != EINTR) return false;
    }
    return false;
}
static int query_authorization(const char *phase, Input_InjectionStatus *status)
{
    *status = UNAUTHORIZED;
    int code = OH_Input_QueryAuthorizedStatus(status);
    printf("{\"event\":\"authorization\",\"phase\":\"%s\",\"code\":%d,\"status\":%d,\"callback\":%d}\n",
        phase, code, *status, atomic_load(&callback_status));
    return code;
}
static int inject_step(const Step *step, int display_id)
{
    struct Input_TouchEvent *event = OH_Input_CreateTouchEvent();
    if (!event) return INPUT_PARAMETER_ERROR;
    const int actions[] = { TOUCH_ACTION_DOWN, TOUCH_ACTION_MOVE, TOUCH_ACTION_UP, TOUCH_ACTION_CANCEL };
    OH_Input_SetTouchEventAction(event, actions[step->action]);
    OH_Input_SetTouchEventFingerId(event, step->finger);
    OH_Input_SetTouchEventDisplayId(event, display_id);
    OH_Input_SetTouchEventDisplayX(event, step->x);
    OH_Input_SetTouchEventDisplayY(event, step->y);
    /* Do not invent an actionTime unit: this SDK header does not specify one.
     * Schedule real call times; separately inspect the app's received timestamps.
     */
    int code = OH_Input_InjectTouchEvent(event);
    OH_Input_DestroyTouchEvent(&event);
    return code;
}
static int run_plan(const Step *steps, int count, int display_id)
{
    struct sigaction handler = { 0 };
    handler.sa_handler = on_signal;
    sigemptyset(&handler.sa_mask);
    sigaction(SIGINT, &handler, NULL);
    sigaction(SIGTERM, &handler, NULL);
    sigaction(SIGHUP, &handler, NULL);
    signal(SIGPIPE, SIG_IGN); // A closed log pipe must not skip pointer cleanup.
    Input_InjectionStatus initial;
    if (query_authorization("before-request", &initial) != INPUT_SUCCESS || initial != UNAUTHORIZED) {
        fprintf(stderr, "refuse: unavailable or pre-existing authorization; not taking it over\n");
        return 3;
    }
    int request_code = OH_Input_RequestInjection(on_authorization);
    printf("{\"event\":\"request-authorization\",\"code\":%d}\n", request_code);
    if (request_code != INPUT_SUCCESS) {
        fprintf(stderr, "authorization request failed; no retry, no injection, no revocation of another owner\n");
        return 3;
    }
    bool authorized = false;
    int64_t authorization_start = monotonic_ns();
    if (authorization_start >= 0) {
        for (int poll = 0; poll < 100 && !interrupted; poll++) {
            Input_InjectionStatus current;
            int code = OH_Input_QueryAuthorizedStatus(&current);
            if (code != INPUT_SUCCESS) break;
            if (current == AUTHORIZED) { authorized = true; break; }
            if (!wait_until(authorization_start + (poll + 1) * INT64_C(100000000))) break;
        }
    }
    Input_InjectionStatus current;
    query_authorization("after-request", &current);
    if (!authorized || current != AUTHORIZED || interrupted) {
        /* Cancel only a request accepted for this process; never invoke this
         * path after AUTHORIZED_OTHERS/pre-existing authorization rejection. */
        OH_Input_CancelInjection();
        query_authorization("request-cancelled", &current);
        fprintf(stderr, "authorization not established within 10s; no touch injected\n");
        return 3;
    }
    Finger fingers[2] = { { false, 0, 0 }, { false, 0, 0 } };
    int result = 0;
    int64_t start = monotonic_ns();
    if (start < 0) result = 4;
    for (int i = 0; result == 0 && i < count; i++) {
        const Step *step = &steps[i];
        if (!wait_until(start + (int64_t)step->at_ms * INT64_C(1000000))) { result = 4; break; }
        if (ferror(stdout)) { result = 4; break; } // No continuing invisible injection after log loss.
        if (OH_Input_QueryAuthorizedStatus(&current) != INPUT_SUCCESS || current != AUTHORIZED) {
            fprintf(stderr, "authorization lost; stop forward injection\n"); result = 4; break;
        }
        int64_t before = monotonic_ns();
        if (before < 0 || before - start - (int64_t)step->at_ms * INT64_C(1000000) > INT64_C(100000000)) {
            fprintf(stderr, "schedule missed by >100ms; abort rather than burst catch-up\n"); result = 4; break;
        }
        /* A failing API might still have delivered DOWN; conservatively retain
         * ownership until a successful terminal event or cleanup attempt. */
        if (step->action == STEP_DOWN) fingers[step->finger].active = true;
        fingers[step->finger].x = step->x;
        fingers[step->finger].y = step->y;
        int code = inject_step(step, display_id);
        printf("{\"event\":\"touch\",\"index\":%d,\"action\":\"%s\",\"finger\":%d,\"x\":%d,\"y\":%d,\"scheduledMs\":%d,\"actualMs\":%.3f,\"code\":%d}\n",
            i, action_name(step->action), step->finger, step->x, step->y, step->at_ms,
            (double)(before - start) / 1e6, code);
        if (code != INPUT_SUCCESS) { result = 4; break; }
        if (step->action == STEP_UP || step->action == STEP_CANCEL) fingers[step->finger].active = false;
    }
    for (int finger = 0; finger < 2; finger++) {
        if (!fingers[finger].active) continue;
        Step cleanup = { 0, STEP_CANCEL, finger, fingers[finger].x, fingers[finger].y };
        int code = inject_step(&cleanup, display_id);
        printf("{\"event\":\"cleanup-cancel\",\"finger\":%d,\"code\":%d}\n", finger, code);
        result = 4; // Failed/interrupted sequences never become a pass via cleanup.
    }
    OH_Input_CancelInjection();
    int final_code = query_authorization("after-revoke", &current);
    if (final_code != INPUT_SUCCESS || current != UNAUTHORIZED || interrupted) result = 4;
    printf("{\"event\":\"complete\",\"result\":%d,\"signal\":%d,\"meaning\":\"API delivery only; verify actual app events and pixels\"}\n", result, interrupted);
    return result;
}
#endif

int main(int argc, char **argv)
{
    setvbuf(stdout, NULL, _IONBF, 0);
    if (argc != 6 && argc != 7) {
        fprintf(stderr, "usage: reader-control-touch-sequence --dry-run WIDTH HEIGHT --display ID < plan\n"
            "   or: reader-control-touch-sequence --execute WIDTH HEIGHT --display ID --request-authorization < plan\n");
        return 2;
    }
    bool dry = !strcmp(argv[1], "--dry-run");
    bool execute = !strcmp(argv[1], "--execute");
    int width = parse_positive(argv[2], 16384), height = parse_positive(argv[3], 16384);
    char *display_end = NULL;
    errno = 0;
    long display = strtol(argv[5], &display_end, 10);
    if (width < 1 || height < 1 || strcmp(argv[4], "--display") || errno || display_end == argv[5] ||
        *display_end || display < 0 || display > 15 ||
        (!dry && !execute) || (dry && argc != 6) ||
        (execute && (argc != 7 || strcmp(argv[6], "--request-authorization")))) return 2;
    Step steps[MAX_STEPS];
    int count = read_plan(stdin, width, height, steps);
    if (count < 0) return 2;
    printf("{\"event\":\"validated-plan\",\"steps\":%d,\"durationMs\":%d,\"width\":%d,\"height\":%d,\"display\":%ld,\"dryRun\":%s}\n",
        count, steps[count - 1].at_ms, width, height, display, dry ? "true" : "false");
    if (dry) return 0;
#ifdef READER_CONTROL_DRY_ONLY
    fprintf(stderr, "this host parser build cannot inject input\n");
    return 3;
#else
    return run_plan(steps, count, (int)display);
#endif
}
