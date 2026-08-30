// Host-test stand-in for the HarmonyOS <qos/qos.h> (SDK-only header). The
// device build keeps using the real SDK header.
#ifndef READER_TEST_MOCKSDK_QOS_H
#define READER_TEST_MOCKSDK_QOS_H

typedef enum QoS_Level {
    QOS_BACKGROUND = 0,
    QOS_UTILITY,
    QOS_DEFAULT,
    QOS_USER_INITIATED,
    QOS_USER_INTERACTIVE,
} QoS_Level;

int OH_QoS_SetThreadQoS(QoS_Level level);

#endif  // READER_TEST_MOCKSDK_QOS_H
