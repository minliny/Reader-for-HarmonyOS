// The recorded source identity plus complete loginUrl of src-669-d510a10eb1ba.json
// is the compatibility key. This projects only its primary login() browser page;
// xflogin()/dp() are not interpreted or executed, and Core's source stays intact.
// Any changed or unknown script retains the executor's ordinary URL validation.
const SHUBA66_PRIMARY_LOGIN_SCRIPT = `function login() {
     java.startBrowserAwait("https://66shuba.com/login", '66书吧');
}

function xflogin() {
java.startBrowserAwait(ho, '起点');
}

function dp() {
	let dpkg = String(source.getVariable())
	if (dpkg == '0') {
		source.setVariable('1');
		java.longToast("\\n\\n段评已开启");
		} else {
			source.setVariable('0');
		java.longToast("\\n\\n段评已关闭");
			}
	}`;

/** Select a known primary browser page without changing the source rule. */
export function sourceLoginPageUrl(sourceId: string, loginUrl: string): string {
  const knownSource = sourceId === 'corpus-d510a10eb1ba' || sourceId === 'https://66shuba.com';
  return knownSource && loginUrl === SHUBA66_PRIMARY_LOGIN_SCRIPT ? 'https://66shuba.com/login' : loginUrl;
}
