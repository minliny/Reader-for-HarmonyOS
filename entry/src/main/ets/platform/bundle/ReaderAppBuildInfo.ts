import { bundleManager } from '@kit.AbilityKit';

export interface ReaderAppBuildInfo {
  status: 'available' | 'legacy' | 'unavailable';
  versionName: string;
  versionCode: number;
  schema: string;
  channel: string;
  contentId: string;
  appContentHash: string;
  appBuildId: string;
}

export function emptyReaderAppBuildInfo(): ReaderAppBuildInfo {
  return { status: 'unavailable', versionName: '', versionCode: 0, schema: '', channel: '',
    contentId: '', appContentHash: '', appBuildId: '' };
}

/** Read the installed package, never a source constant or a locally cached manifest. */
export function readReaderAppBuildInfo(): ReaderAppBuildInfo {
  const result = emptyReaderAppBuildInfo();
  try {
    const bundle = bundleManager.getBundleInfoForSelfSync(
      bundleManager.BundleFlag.GET_BUNDLE_INFO_WITH_HAP_MODULE | bundleManager.BundleFlag.GET_BUNDLE_INFO_WITH_METADATA);
    result.versionName = bundle.versionName;
    result.versionCode = bundle.versionCode;
    const entries: string[] = [];
    for (const module of bundle.hapModulesInfo) {
      for (const metadata of module.metadata ?? []) {
        if (metadata.name === 'reader.appBuildIdentity') entries.push(metadata.value);
      }
    }
    if (entries.length === 0) { result.status = 'legacy'; return result; }
    if (entries.length !== 1) return result;
    const identity = JSON.parse(entries[0]) as ReaderAppBuildInfo;
    if (identity.schema !== 'reader-app-build-v1' || identity.versionName !== bundle.versionName ||
      identity.versionCode !== bundle.versionCode || !['DEV', 'RC', 'REL'].includes(identity.channel) ||
      typeof identity.appContentHash !== 'string' || !/^[0-9a-f]{64}$/.test(identity.appContentHash) ||
      identity.contentId !== identity.appContentHash.slice(0, 12) ||
      identity.appBuildId !== `${bundle.versionName}.${identity.channel}.${identity.contentId}`) return result;
    result.status = 'available';
    result.schema = identity.schema;
    result.channel = identity.channel;
    result.contentId = identity.contentId;
    result.appContentHash = identity.appContentHash;
    result.appBuildId = identity.appBuildId;
    return result;
  } catch (_) { return result; }
}

export function readerAppBuildDisplay(info: ReaderAppBuildInfo): string {
  if (info.status === 'available') return `${info.versionName} (${info.channel} · ${info.contentId})`;
  return info.status === 'legacy' ? `${info.versionName}（构建标识缺失）` : '版本信息暂不可用';
}

export function readerAppBuildCopy(info: ReaderAppBuildInfo): string {
  if (info.status !== 'available') return '';
  return `${info.appBuildId}\nversionName=${info.versionName}\nversionCode=${info.versionCode}\nappContentHash=${info.appContentHash}\nschema=${info.schema}`;
}
