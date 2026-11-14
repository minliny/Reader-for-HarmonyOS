import { media } from '@kit.MediaKit';
import { fileIo } from '@kit.CoreFileKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

interface FrameworkCaptureSession {
  id: number;
  seconds: number;
  path: string;
  retired: boolean;
  started: boolean;
  timer: number;
  recorder?: media.AVScreenCaptureRecorder;
  file?: fileIo.File;
}

/** Explicit DEBUG warm-Want diagnostic. Platform consent owns screen access.
 * Captures playback audio with the microphone disabled and writes cache only. */
export class ReaderFrameworkCapture {
  private session: FrameworkCaptureSession | undefined = undefined;

  start(debug: boolean, mode: string, seconds: Object | undefined, cacheDir: string): void {
    if (!debug || mode !== 'debug' || typeof seconds !== 'number' || !Number.isInteger(seconds) ||
      seconds < 1 || seconds > 15 || this.session !== undefined) return;
    const id = Date.now();
    const session: FrameworkCaptureSession = { id, seconds,
      path: `${cacheDir}/reader-framework-capture-${id}.mp4`, retired: false, started: false, timer: -1 };
    this.session = session;
    session.timer = setTimeout((): void => { void this.finish(session, 'deadline'); }, 30000);
    void this.prepare(session);
  }

  close(): void {
    if (this.session !== undefined) void this.finish(this.session, 'destroyed');
  }

  private current(session: FrameworkCaptureSession): boolean {
    return this.session === session && !session.retired;
  }

  private log(session: FrameworkCaptureSession, event: string, detail: string = ''): void {
    hilog.info(0x5244, 'Reader', 'READER_FRAMEWORK_CAPTURE %{public}s',
      JSON.stringify({ id: session.id, event, detail, path: session.path, at: Date.now() }));
  }

  private async prepare(session: FrameworkCaptureSession): Promise<void> {
    try {
      this.log(session, 'create');
      const recorder = await media.createAVScreenCaptureRecorder();
      if (recorder === undefined || recorder === null) throw new Error('Recorder unavailable');
      if (!this.current(session)) {
        await recorder.release();
        return;
      }
      session.recorder = recorder;
      recorder.on('error', (error: Error): void => {
        this.log(session, 'error', String(error));
        void this.finish(session, 'error');
      });
      recorder.on('stateChange', (state: media.AVScreenCaptureStateCode): void => {
        this.log(session, 'state', String(state));
        if (!this.current(session)) return;
        if (state === media.AVScreenCaptureStateCode.SCREENCAPTURE_STATE_STARTED) {
          session.started = true;
          clearTimeout(session.timer);
          session.timer = setTimeout((): void => { void this.finish(session, 'duration'); }, session.seconds * 1000);
        } else if (state <= media.AVScreenCaptureStateCode.SCREENCAPTURE_STATE_STOPPED_BY_CALL ||
          state === media.AVScreenCaptureStateCode.SCREENCAPTURE_STATE_STOPPED_BY_USER_SWITCHES ||
          state === media.AVScreenCaptureStateCode.SCREENCAPTURE_STATE_MIC_UNMUTED_BY_USER) {
          void this.finish(session, 'platform-stopped');
        }
      });
      if (fileIo.accessSync(session.path)) throw new Error('Capture output already exists');
      session.file = fileIo.openSync(session.path, fileIo.OpenMode.CREATE | fileIo.OpenMode.WRITE_ONLY);
      await recorder.init({ fd: session.file.fd, videoBitrate: 6000000, audioSampleRate: 48000,
        audioChannelCount: 2, audioBitrate: 128000 });
      if (!this.current(session)) return;
      await recorder.setMicEnabled(false);
      if (!this.current(session)) return;
      this.log(session, 'start-request');
      await recorder.startRecording();
      this.log(session, 'start-returned');
    } catch (error) {
      this.log(session, 'prepare-failed', String(error));
      await this.finish(session, 'prepare-failed');
    }
  }

  private async finish(session: FrameworkCaptureSession, reason: string): Promise<void> {
    if (session.retired) return;
    session.retired = true;
    clearTimeout(session.timer);
    try {
      if (session.started) await session.recorder?.stopRecording();
    } catch (error) {
      this.log(session, 'stop-failed', String(error));
    }
    try {
      await session.recorder?.release();
    } catch (error) {
      this.log(session, 'release-failed', String(error));
    } finally {
      if (session.file !== undefined) {
        try { fileIo.closeSync(session.file); }
        catch (error) { this.log(session, 'file-close-failed', String(error)); }
      }
      if (this.session === session) this.session = undefined;
      this.log(session, 'closed', reason);
    }
  }
}
