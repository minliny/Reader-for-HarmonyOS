import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {choiceRowProbe} from './reader-choice-row-probe.mjs';
import {MANGA_DIRECTORY_VISUAL, mangaDirectoryColor} from '../../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';
import {readerAppColor} from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import {readerInteractiveSafeBottom, createDefaultReaderWindowMetrics} from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import * as readerFontFamilies from '../../entry/src/main/ets/features/common/ReaderFontFamilies.ts';

const file=new URL('../../entry/src/main/ets/features/common/ReaderMangaChoiceSelect.ets',import.meta.url);
export const readerMangaChoiceSelectSource=readFileSync(file,'utf8');

/** Real SDK consumer composition for the shared Manga sheet and its production
 * ReaderChoiceRow children. Only the window geometry and font-registration
 * boundary are supplied as platform ports. */
export function readerMangaChoiceSelectProbe({metrics=createDefaultReaderWindowMetrics(),source=readerMangaChoiceSelectSource}={}) {
  const rows=choiceRowProbe();
  const deps={...rows.properties.sdk,...rows.dependencies,
    MANGA_SHEET:MANGA_DIRECTORY_VISUAL,MANGA_DIRECTORY_VISUAL,mangaDirectoryColor,
    ReaderWindowCoordinator:{metrics:()=>metrics},readerInteractiveSafeBottom,
    readerAppColor,registerReaderFonts:()=>{},...readerFontFamilies};
  const hooks={...rows.hooks,onObserverEnter:rows.properties.hooks.onObserverEnter,
    childSources:{...rows.hooks.childSources,ReaderMangaChoiceSelect:source},
    mountChildren:true,lifecycleChildren:true};
  const result=createReaderBuilderProbe(source,
    ['options','selectedIndex','value','title','variant','selectionToken','choiceEnabled','scheme','viewportHeight','visible',
      'openOnMount','trigger','onSelect','onDismiss','sheetVisible','openEpoch','closed','mounted','lastVisible','optionSignature',
      'aboutToAppear','aboutToDisappear','emptyTrigger','onTokenChanged','onChoiceEnabledChanged','onVisibleChanged',
      'openSheet','owns','closeCurrent','dismissFor','choose','build','emptyTrigger','effectiveScheme','choiceOptions','onOptionsChanged','currentMetrics','sheetBuilder','sheetOptions','viewportHeightNow',
      'sheetHeight','sheetBodyHeight','rowHeight','rowSpec','sheetContent'],deps,hooks);
  return {...result,rows,metrics,dependencies:{...deps,ReaderMangaChoiceSelect:result.Component},hooks};
}

export function choiceSheetOwner(probe,params={}) {
  const owner=new probe.Component(undefined,params);
  owner.aboutToAppear();
  owner.initialRender();
  probe.rows.properties.flush();
  return owner;
}

export function choiceSheetAnchor(probe,owner) {
  return [...owner.nodes.values()].find(node=>node.bindSheet);
}

export function choiceSheetRows(probe,owner) {
  return [...owner.children.values()].filter(child=>child.constructor===probe.rows.Component);
}

export function assertChoiceSheetReady(probe,owner) {
  const anchor=choiceSheetAnchor(probe,owner);
  assert.ok(anchor,'actual ReaderMangaChoiceSelect root owns native bindSheet');
  assert.equal(anchor.bindSheet[0],true,'owner-mounted or trigger-open sheet is visible');
  assert.equal(typeof anchor.bindSheet[1],'function','production wrapper supplies a captured CustomBuilder');
  return anchor;
}
