# PH95：搜索主线程停顿的最小取证

触发：现有682组发布生产方法本地为1.65–3.70ms；真实C++NAPI的大响应同步段存在长任务，但本次实际响应大小未知。不能从代码或本地桌面计时推出VM/手机帧率。

当前VM的RenderService帮助提供fps/hitchs接口；只读查到Reader PID2810、窗口harmonyos0/WinId78。现有 `harmonyos0 fps` 只返回标题、无样本，surface只列ScreenNode。没有改系统配置、清统计、GC、重启VM或全系统trace。命令参数按照本机帮助并核对[OpenHarmony HiDumper官方文档](https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/dfx/hidumper.md)。没有把空记录判作0掉帧或性能通过。

补充一次性的debug诊断：只有cold start、生成DEBUG=true且BUILD_MODE_NAME=debug、`readerEventLoopProbe`为原始boolean true时生效；正常启动和release完全不开计时器。只读平台现有ACTIVE uptime，50ms周期测量实际回调迟到量，每秒输出一条数字摘要，120秒自动停止；窗口销毁、退后台、Ability销毁均停止，不重启，延迟loadContent回调也不能复活。它不渲染任何UI、不驱动搜索动效、不读写书籍/源/网络内容、不持久化开关。

记录elapsedMs/uptimeMs、采样数、该秒最大迟到ms、迟到超过50ms的次数及结束原因。该指标是ArkTS主线程可用性，不是FPS，也不能区分网络、Native、ArkUI布局中的具体长任务来源。后续同包实搜按日志时段判断是否仍有秒级停顿；只在实测命中后进一步定位，不为了允许的64MiB上限直接重构Core ABI。

实际模块回归覆盖严格开启条件、1100ms模拟迟到、后续正常窗口不继承最大值、重复start/stop、先退后台后load、120秒自动结束、无效时钟停止、字段不含内容。首轮测试使用Node26已不支持的transform模式失败；改为原生可擦除的类字段声明并使用strip模式，未替换被测模块，修后通过。原失败和通过日志保留在event-loop-probe目录。本地回归不是设备性能通过。
