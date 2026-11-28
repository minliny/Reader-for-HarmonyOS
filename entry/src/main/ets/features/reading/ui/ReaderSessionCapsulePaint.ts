import { readerAppColor, type ReaderAppColorRole } from '../../../ui/foundation/ReaderAppColors';

type ReaderSessionCapsuleColor = 'surface' | 'border' | 'ink' | 'primary' | 'onPrimary';

const CAPSULE_COLOR_ROLES: Record<ReaderSessionCapsuleColor, ReaderAppColorRole> = {
  surface: 'app.sessionCapsule.surface',
  border: 'app.sessionCapsule.border',
  ink: 'app.sessionCapsule.ink',
  primary: 'TOK_READ_PRIMARY',
  onPrimary: 'app.sessionCapsule.onPrimary',
};

/** The standing capsule and its launch actor use the same theme roles. */
export function readerSessionCapsuleColor(color: ReaderSessionCapsuleColor, scheme: string, override: string = ''): string {
  return override.length > 0 ? override : readerAppColor(CAPSULE_COLOR_ROLES[color], scheme);
}
